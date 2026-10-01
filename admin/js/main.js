// SimpleBlog Admin — shell aplikasi: koneksi Firebase, autentikasi, routing.

import { initFirebase, loadConfig, getAuthInstance, onAuthStateChanged, signOut } from '../../core/firebase.js';
import * as store from '../../core/store.js';
import { Router } from '../../core/router.js';
import { withTimeout } from '../../core/utils.js';
import { initColorMode } from '../../core/color-mode.js';
import { html, $, $$, toast } from './ui.js';
import {
  DEFAULT_PASSWORD, CREDENTIAL_ERRORS, signInFirebase, checkLocal, isLocalDefault,
  startLocalSession, getLocalSession, clearLocalSession, displayName,
} from './auth.js';

import * as setupView from './views/setup.js';
import * as loginView from './views/login.js';
import * as dashboardView from './views/dashboard.js';
import * as postsView from './views/posts.js';
import * as editorView from './views/editor.js';
import * as taxonomyView from './views/taxonomy.js';
import * as commentsView from './views/comments.js';
import * as settingsView from './views/settings.js';
import * as accountView from './views/account.js';
import * as themesView from './views/themes.js';
import * as customizeView from './views/customize.js';
import * as themeEditorView from './views/theme-editor.js';

/** State global admin, diteruskan ke setiap view. */
export const app = {
  configured: false,
  configSource: null,
  connectError: null,
  user: null,          // user Firebase Auth
  admin: null,         // isi dokumen admins/{uid}
  isAdmin: false,
  localSession: null,  // username login lokal (sebelum/tanpa Firebase)
  authBusy: false,
  router: null,
  connect,
  login,
  refreshAdmin,
  refreshPendingCount,
  renderChrome,
  logout,
};

let unsubscribeAuth = null;
let routerStarted = false;

/** (Re)koneksi ke Firebase dan tunggu status auth pertama. */
async function connect() {
  const { config, source } = loadConfig();
  Object.assign(app, {
    configured: false, configSource: source, connectError: null,
    user: null, admin: null, isAdmin: false, localSession: getLocalSession(),
  });
  unsubscribeAuth?.();
  unsubscribeAuth = null;
  if (!config) { renderChrome(); return; }

  try {
    await initFirebase(config);
    app.configured = true;
  } catch (err) {
    app.connectError = err;
    renderChrome();
    return;
  }

  await new Promise((resolve) => {
    let first = true;
    unsubscribeAuth = onAuthStateChanged(getAuthInstance(), async (user) => {
      app.user = user;
      await refreshAdmin();
      if (first) { first = false; resolve(); } else if (!app.authBusy) app.router?.resolve();
    });
  });
}

/** Muat ulang status admin dari Firestore lalu perbarui tampilan. */
async function refreshAdmin() {
  app.admin = app.user ? await store.getAdmin(app.user.uid) : null;
  app.isAdmin = !!app.admin;
  renderChrome();
  if (app.isAdmin) {
    refreshPendingCount();
    store.getSettings().then((s) => { $('#brand-title').textContent = s.title || 'SimpleBlog'; }).catch(() => {});
  }
}

/**
 * Login dari halaman Masuk / Setup. Kembalikan 'firebase' atau 'local'.
 * - Firebase aktif: login Firebase; jika situs belum punya admin, akun dibuat & diklaim otomatis.
 * - Firebase belum aktif / tidak bisa dihubungi: cek kredensial lokal (default admin / 123).
 */
async function login(username, password) {
  username = username.trim();
  if (app.configured) {
    app.authBusy = true;
    try {
      const installed = await withTimeout(store.isInstalled(), 8000).catch(() => true);
      const { user } = await signInFirebase(getAuthInstance(), username, password, { canBootstrap: !installed });
      app.user = user;
      if (!installed) {
        await store.claimFirstAdmin(user, { defaultPassword: password === DEFAULT_PASSWORD });
        // Dokumen settings dibutuhkan rules untuk validasi komentar.
        await store.saveSettings(await store.getSettings());
      }
      startLocalSession(username);
      app.localSession = username;
      await refreshAdmin();
      return 'firebase';
    } catch (err) {
      if (CREDENTIAL_ERRORS.includes(err.code) || err.code === 'auth/too-many-requests') throw err;
      // Masalah koneksi/config: izinkan login lokal agar Setup bisa diperbaiki.
      if (await checkLocal(username, password)) return loginLocal(username);
      throw err;
    } finally {
      app.authBusy = false;
    }
  }
  if (!(await checkLocal(username, password))) throw new Error('Username atau password salah.');
  return loginLocal(username);
}

function loginLocal(username) {
  startLocalSession(username);
  app.localSession = username;
  renderChrome();
  return 'local';
}

async function logout() {
  clearLocalSession();
  app.localSession = null;
  if (app.user) await signOut(getAuthInstance());
  renderChrome();
  toast('Anda telah keluar.');
  app.router.navigate('/login');
}

async function refreshPendingCount() {
  try {
    const pending = await store.listComments({ status: 'pending' });
    const pill = $('#pending-count');
    pill.hidden = pending.length === 0;
    pill.textContent = pending.length;
  } catch { /* abaikan */ }
}

function renderChrome() {
  const loggedIn = !!(app.user || app.localSession);
  document.body.classList.toggle('no-auth', !loggedIn);
  // Login lokal / belum admin: hanya menu Setup & Akun yang aktif.
  document.body.classList.toggle('limited', loggedIn && !app.isAdmin);

  const name = app.user ? displayName(app.user.email) : app.localSession;
  const box = $('#userbox');
  box.innerHTML = loggedIn
    ? String(html`<div class="who"><span class="avatar">${(name || '?')[0].toUpperCase()}</span>
        <span class="email" title="${app.user?.email || 'login lokal'}">${name}${app.user ? '' : ' (lokal)'}</span></div>
        <button class="btn btn-ghost btn-sm" id="logout-btn">Keluar</button>`)
    : '';
  $('#logout-btn')?.addEventListener('click', logout);

  const usingDefault = app.user ? !!app.admin?.defaultPassword : (loggedIn && isLocalDefault());
  const notice = $('#notice');
  notice.hidden = !usingDefault;
  notice.innerHTML = usingDefault
    ? `⚠ Anda masih memakai password default <b>${DEFAULT_PASSWORD}</b>. Siapa pun yang tahu bisa masuk — <a href="#/account">ganti password sekarang</a>.`
    : '';
}

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------
const routes = [
  ['/setup', 'Setup Firebase', 'setup', (c) => setupView.render(c)],
  ['/login', 'Masuk', null, (c) => loginView.render(c)],
  ['/dashboard', 'Dasbor', 'dashboard', (c) => dashboardView.render(c)],
  ['/posts', 'Semua Pos', 'posts', (c) => postsView.render(c)],
  ['/posts/new', 'Tambah Pos Baru', 'new', (c) => editorView.render(c)],
  ['/posts/edit/:id', 'Edit Pos', 'posts', (c) => editorView.render(c)],
  ['/categories', 'Kategori', 'categories', (c) => taxonomyView.render({ ...c, type: 'categories' })],
  ['/tags', 'Tag', 'tags', (c) => taxonomyView.render({ ...c, type: 'tags' })],
  ['/comments', 'Komentar', 'comments', (c) => commentsView.render(c)],
  ['/settings/:section', 'Pengaturan', null, (c) => settingsView.render(c)],
  ['/account', 'Akun Saya', 'account', (c) => accountView.render(c)],
  ['/appearance/themes', 'Tema', 'themes', (c) => themesView.render(c)],
  ['/appearance/customize', 'Kustomisasi', 'customize', (c) => customizeView.render(c)],
  ['/appearance/editor', 'Editor Template', 'theme-editor', (c) => themeEditorView.render(c)],
];

const SETTINGS_TITLES = Object.fromEntries(settingsView.SECTIONS);

function mount(title, navKey, handler) {
  return (ctx) => {
    // Halaman pengaturan: judul & menu aktif mengikuti bagian (Umum, Menulis, ...).
    if (ctx.params.section) {
      navKey = ctx.params.section;
      title = ctx.params.section === 'appearance' ? 'Identitas & CSS' : `Pengaturan ${SETTINGS_TITLES[navKey] || ''}`.trim();
    }
    $('#page-title').textContent = title;
    document.title = `${title} — Admin`;
    $$('.menu a').forEach((a) => a.classList.toggle('active', a.dataset.nav === navKey));
    $$('.menu-group').forEach((g) => g.classList.toggle('open', !!g.querySelector(`[data-nav="${navKey}"]`)));
    document.body.classList.remove('menu-open');
    // Setiap navigasi mendapat elemen baru: view lama yang masih memuat data
    // akan menulis ke elemen yang sudah terlepas sehingga tidak bentrok.
    const el = document.createElement('div');
    $('#view').replaceChildren(el);
    window.scrollTo(0, 0);
    return Promise.resolve(handler({ ...ctx, el, app })).catch((err) => {
      console.error(err);
      el.innerHTML = String(html`<div class="alert alert-error"><strong>Kesalahan:</strong> ${err.message}</div>`);
    });
  };
}

async function boot() {
  initColorMode();
  $('#view').innerHTML = '<div class="loading"><span class="spin"></span> Menghubungkan…</div>';
  await connect();

  const router = new Router();
  app.router = router;
  routes.forEach(([path, title, nav, handler]) => router.on(path, mount(title, nav, handler)));
  router.on('/', () => router.navigate('/dashboard'));
  router.on('/settings', () => router.navigate('/settings/general'));
  router.on('/appearance', () => router.navigate('/appearance/themes'));
  router.otherwise(() => router.navigate('/dashboard'));

  router.guard(({ path }) => {
    const loggedIn = !!(app.user || app.localSession);
    if (path === '/login') return loggedIn ? (app.isAdmin ? '/dashboard' : '/setup') : null;
    if (!loggedIn) return '/login';
    if (path === '/setup' || path === '/account') return null;
    if (!app.configured || !app.isAdmin) {
      if (routerStarted) toast('Menu ini terbuka setelah login Firebase sebagai admin (lihat Setup Firebase).', 'info', 5000);
      return '/setup';
    }
    return null;
  });

  $('#menu-btn').addEventListener('click', () => document.body.classList.toggle('menu-open'));
  $('#backdrop').addEventListener('click', () => document.body.classList.remove('menu-open'));

  await router.start();
  routerStarted = true;
}

boot();
