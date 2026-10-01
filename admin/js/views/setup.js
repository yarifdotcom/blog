// Admin › Setup Firebase: isi config, akun admin, tes koneksi, klaim admin pertama, data demo.

import {
  CONFIG_FIELDS, isConfigValid, cleanConfig, parseConfigText, getLocalConfig, getFileConfig,
  saveLocalConfig, clearLocalConfig, buildConfigFile,
  initializeApp, deleteApp, getFirestore, getAuth, doc, getDoc,
  signInWithEmailAndPassword, connectEmulators, getEmulatorHost,
} from '../../../core/firebase.js';
import * as store from '../../../core/store.js';
import { withTimeout } from '../../../core/utils.js';
import { html, raw, $, toast, busy, readForm, confirmAction } from '../ui.js';
import {
  DEFAULT_USERNAME, DEFAULT_PASSWORD, CREDENTIAL_ERRORS, toEmail, toAuthPassword, displayName, authMessage,
} from '../auth.js';

const FIELD_HELP = {
  apiKey: 'Web API Key',
  authDomain: 'contoh: proyekku.firebaseapp.com',
  projectId: 'ID proyek Firebase',
  storageBucket: 'opsional',
  messagingSenderId: 'opsional',
  appId: 'opsional, contoh: 1:123:web:abc',
  measurementId: 'opsional (Analytics)',
};

const ERROR_HINTS = {
  'permission-denied': 'Akses ditolak oleh Security Rules. Deploy file firestore.rules ke proyek Anda.',
  unavailable: 'Firestore tidak dapat dijangkau. Pastikan Firestore Database sudah dibuat dan projectId benar.',
  'auth/invalid-api-key': 'API key tidak valid.',
  'auth/invalid-credential': 'Username atau password salah.',
  'auth/user-not-found': 'Pengguna tidak ditemukan.',
  'auth/wrong-password': 'Username atau password salah.',
  'auth/operation-not-allowed': 'Metode login Email/Password belum diaktifkan di Firebase Console › Authentication.',
  'auth/network-request-failed': 'Gagal terhubung ke server Firebase (cek koneksi internet / authDomain).',
  'auth/configuration-not-found': 'Authentication belum diaktifkan di proyek ini.',
};

const hint = (err) => ERROR_HINTS[err?.code] || err?.message || String(err);

export async function render({ el, app }) {
  const current = getLocalConfig() || getFileConfig() || {};
  const sourceLabel = { local: 'browser ini (localStorage)', file: 'config/firebase-config.js' }[app.configSource] || 'belum ada';

  let installed = null;
  if (app.configured) {
    try { installed = await withTimeout(store.isInstalled(), 8000); } catch { installed = null; }
  }

  el.innerHTML = String(html`
    <div class="grid-2">
      <div class="stack">
        <div class="card">
          <h2 class="card-title">Status</h2>
          <dl class="kv">
            <dt>Sumber config</dt><dd>${sourceLabel}${getEmulatorHost() ? html` <span class="badge badge-amber">emulator ${getEmulatorHost()}</span>` : ''}</dd>
            <dt>Koneksi</dt><dd>${app.configured ? raw('<span class="badge badge-green">Terhubung</span>') : raw('<span class="badge badge-gray">Belum</span>')}
              ${app.connectError ? html`<small class="text-red">${app.connectError.message}</small>` : ''}</dd>
            <dt>Pengguna</dt><dd>${app.user ? displayName(app.user.email) : app.localSession ? html`${app.localSession} <span class="badge badge-gray">login lokal</span>` : '—'}</dd>
            <dt>UID</dt><dd>${app.user ? html`<code>${app.user.uid}</code>` : '—'}</dd>
            <dt>Hak admin</dt><dd>${app.user ? (app.isAdmin ? raw('<span class="badge badge-green">Ya</span>') : raw('<span class="badge badge-amber">Tidak</span>')) : '—'}</dd>
            <dt>Instalasi</dt><dd>${installed === null ? '—' : installed ? 'Sudah (admin pertama sudah diklaim)' : 'Belum'}</dd>
          </dl>
        </div>

        <form class="card" id="config-form" autocomplete="off">
          <h2 class="card-title">Konfigurasi Firebase</h2>
          <p class="muted">Ambil dari <em>Firebase Console › Project settings › Your apps › SDK setup and configuration</em>.
            Tempel seluruh potongan <code>firebaseConfig</code> di bawah, lalu klik <b>Isi otomatis</b>.</p>
          <div class="field">
            <textarea id="paste" rows="4" placeholder='const firebaseConfig = { apiKey: "…", authDomain: "…", projectId: "…" };'></textarea>
            <div class="row-end"><button type="button" class="btn btn-sm" id="parse-btn">Isi otomatis</button></div>
          </div>
          ${CONFIG_FIELDS.map((k) => html`
            <div class="field">
              <label for="cfg-${k}">${k}${['apiKey', 'authDomain', 'projectId'].includes(k) ? raw(' <span class="req">*</span>') : ''}</label>
              <input id="cfg-${k}" name="${k}" value="${current[k] || ''}" placeholder="${FIELD_HELP[k]}" spellcheck="false">
            </div>`)}

          <h2 class="card-title mt">Akun Admin</h2>
          <p class="muted">Username tanpa <code>@</code> (mis. <code>${DEFAULT_USERNAME}</code>) atau email user Firebase.
            Jika situs belum punya admin, akun ini <b>dibuat otomatis</b> di Firebase Authentication dan dijadikan owner
            saat klik <b>Simpan &amp; Hubungkan</b>. Default: <code>${DEFAULT_USERNAME}</code> / <code>${DEFAULT_PASSWORD}</code>.</p>
          <div class="field">
            <label for="username">Username</label>
            <input id="username" name="username" value="${app.user ? displayName(app.user.email) : (app.localSession || DEFAULT_USERNAME)}"
              autocomplete="username" autocapitalize="none" spellcheck="false">
          </div>
          <div class="field">
            <label for="password">Password</label>
            <input id="password" name="password" type="password" autocomplete="current-password">
          </div>

          <div class="actions">
            <button type="button" class="btn" id="test-btn">Tes Koneksi</button>
            <button type="submit" class="btn btn-primary" id="save-btn">Simpan &amp; Hubungkan</button>
          </div>
          <div class="actions">
            <button type="button" class="btn btn-ghost btn-sm" id="download-btn">Unduh firebase-config.js</button>
            <button type="button" class="btn btn-ghost btn-sm text-red" id="clear-btn">Hapus config lokal</button>
          </div>
        </form>
      </div>

      <div class="stack">
        <div class="card">
          <h2 class="card-title">Hasil Tes Koneksi</h2>
          <ol class="testlog" id="testlog"><li class="muted">Belum dijalankan.</li></ol>
        </div>

        ${installPanel(app, installed)}

        <div class="card">
          <h2 class="card-title">Langkah Persiapan</h2>
          <ol class="steps">
            <li>Buat proyek di <a href="https://console.firebase.google.com" target="_blank" rel="noopener">Firebase Console</a> lalu tambahkan <b>Web App</b>.</li>
            <li>Aktifkan <b>Firestore Database</b> (mode production).</li>
            <li>Aktifkan <b>Authentication › Email/Password</b> (user admin akan dibuat otomatis).</li>
            <li>Deploy <code>firestore.rules</code> (Console › Firestore › Rules, atau <code>firebase deploy --only firestore:rules</code>).</li>
            <li>Isi form di samping, <b>Tes Koneksi</b>, lalu <b>Simpan &amp; Hubungkan</b> — akun admin dibuat &amp; diklaim otomatis.</li>
            <li>Ganti password default di menu <b>Akun Saya</b>.</li>
            <li>Unduh <code>firebase-config.js</code> dan timpa file di folder <code>config/</code> agar situs publik bisa membaca data.</li>
          </ol>
        </div>
      </div>
    </div>`);

  const form = $('#config-form', el);
  const getConfig = () => cleanConfig(readForm(form));

  $('#parse-btn', el).addEventListener('click', () => {
    const parsed = parseConfigText($('#paste', el).value);
    if (!Object.keys(parsed).length) return toast('Tidak menemukan field config pada teks.', 'error');
    for (const [k, v] of Object.entries(parsed)) { const i = $(`#cfg-${k}`, el); if (i) i.value = v; }
    toast(`${Object.keys(parsed).length} field terisi.`, 'success');
  });

  $('#test-btn', el).addEventListener('click', (e) => busy(e.currentTarget, () => {
    const { username, password } = readForm(form);
    return runTest(getConfig(), username, password, $('#testlog', el));
  }));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    busy($('#save-btn', el), async () => {
      const config = getConfig();
      if (!isConfigValid(config)) return toast('apiKey, authDomain, dan projectId wajib diisi.', 'error');
      const { username, password } = readForm(form);
      saveLocalConfig(config);
      await app.connect();
      if (!app.configured) return toast('Gagal menginisialisasi Firebase: ' + app.connectError?.message, 'error');

      if (username && password && app.user?.email !== toEmail(username)) {
        try {
          const mode = await app.login(username, password);
          if (mode === 'local') toast('Firebase belum bisa dihubungi — masih mode lokal. Jalankan Tes Koneksi.', 'error', 6000);
        } catch (err) {
          toast('Login Firebase gagal: ' + authMessage(err), 'error', 6000);
          return render({ el, app });
        }
      } else if (!app.user) {
        toast('Config disimpan. Isi password lalu simpan lagi untuk login ke Firebase.', 'info', 6000);
        return render({ el, app });
      }
      toast('Konfigurasi disimpan.', 'success');
      if (app.isAdmin) app.router.navigate('/dashboard');
      else render({ el, app });
    });
  });

  $('#download-btn', el).addEventListener('click', () => {
    const config = getConfig();
    if (!isConfigValid(config)) return toast('Lengkapi config terlebih dahulu.', 'error');
    const blob = new Blob([buildConfigFile(config)], { type: 'text/javascript' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'firebase-config.js';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  $('#clear-btn', el).addEventListener('click', async () => {
    if (!confirmAction('Hapus config Firebase yang tersimpan di browser ini?')) return;
    clearLocalConfig();
    await app.connect();
    toast('Config lokal dihapus.');
    render({ el, app });
  });

  bindInstallPanel(el, app);
}

function installPanel(app, installed) {
  if (!app.user && app.localSession) {
    return html`
      <div class="card card-highlight">
        <h2 class="card-title">Mode Lokal</h2>
        <p>Anda masuk dengan login lokal (Firebase belum terhubung). Menu konten akan aktif setelah
          config Firebase diisi dan <b>Simpan &amp; Hubungkan</b> berhasil login sebagai admin.</p>
      </div>`;
  }
  if (!app.configured || !app.user) return '';
  if (app.isAdmin) {
    return html`
      <div class="card">
        <h2 class="card-title">Data Awal</h2>
        <p class="muted">Isi kategori, tag, dan 3 post contoh untuk mencoba tampilan publik.</p>
        <button class="btn" id="seed-btn">Isi Data Demo</button>
      </div>`;
  }
  if (installed === false) {
    return html`
      <div class="card card-highlight">
        <h2 class="card-title">Klaim Admin Pertama</h2>
        <p>Belum ada admin terdaftar. Jadikan akun <b>${app.user.email}</b> sebagai pemilik (owner) blog ini.
          Langkah ini hanya bisa dilakukan sekali.</p>
        <button class="btn btn-primary" id="claim-btn">Klaim sebagai Admin</button>
      </div>`;
  }
  return html`
    <div class="card card-highlight">
      <h2 class="card-title">Bukan Admin</h2>
      <p>Akun <b>${app.user.email}</b> belum memiliki hak admin. Minta admin yang ada untuk menambahkan dokumen
        <code>admins/${app.user.uid}</code> di Firestore (field bebas, misal <code>email</code>).</p>
    </div>`;
}

function bindInstallPanel(el, app) {
  $('#claim-btn', el)?.addEventListener('click', (e) => busy(e.currentTarget, async () => {
    try {
      await store.claimFirstAdmin(app.user);
      await app.connect();
      // Buat dokumen settings default (dibutuhkan rules untuk validasi komentar).
      const settings = await store.getSettings();
      await store.saveSettings(settings);
      toast('Selamat! Anda sekarang admin.', 'success');
      app.router.navigate('/dashboard');
    } catch (err) {
      toast('Gagal klaim admin: ' + hint(err), 'error', 6000);
    }
  }));

  $('#seed-btn', el)?.addEventListener('click', (e) => busy(e.currentTarget, async () => {
    if (!confirmAction('Tambahkan data demo (2 kategori, 3 tag, 3 post)?')) return;
    try {
      await store.seedDemo();
      toast('Data demo ditambahkan.', 'success');
    } catch (err) {
      toast('Gagal: ' + hint(err), 'error');
    }
  }));
}

/** Tes koneksi memakai instance Firebase terpisah (tidak mengganggu sesi aktif). */
async function runTest(config, username, password, log) {
  log.innerHTML = '';
  const step = (label) => {
    const li = document.createElement('li');
    li.className = 'run';
    li.textContent = label;
    log.appendChild(li);
    return {
      ok: (msg) => { li.className = 'ok'; if (msg) li.textContent = `${label} — ${msg}`; },
      fail: (msg) => { li.className = 'fail'; li.textContent = `${label} — ${msg}`; },
      warn: (msg) => { li.className = 'warn'; li.textContent = `${label} — ${msg}`; },
    };
  };

  const s0 = step('Validasi config');
  if (!isConfigValid(config)) return s0.fail('apiKey, authDomain, dan projectId wajib diisi');
  s0.ok(`projectId: ${config.projectId}`);

  let testApp;
  let installed = null;
  try {
    const s1 = step('Inisialisasi Firebase SDK');
    try {
      testApp = initializeApp(config, `sb-test-${Date.now()}`);
      s1.ok();
    } catch (err) { return s1.fail(hint(err)); }

    const db = getFirestore(testApp);
    const testAuth = getAuth(testApp);
    connectEmulators(db, testAuth);
    if (getEmulatorHost()) step('Mode emulator').warn(`aktif (${getEmulatorHost()})`);
    const s2 = step('Membaca Firestore (settings/site)');
    try {
      const snap = await withTimeout(getDoc(doc(db, 'settings', 'site')), 10000, 'Waktu habis (10 dtk) — cek projectId & pastikan Firestore sudah dibuat');
      s2.ok(snap.exists() ? 'OK, pengaturan ditemukan' : 'OK (pengaturan belum dibuat)');
    } catch (err) { s2.fail(hint(err)); }

    const s3 = step('Status instalasi (meta/install)');
    try {
      const snap = await withTimeout(getDoc(doc(db, 'meta', 'install')), 10000);
      installed = snap.exists();
      s3.ok(installed ? 'sudah diinstal' : 'belum ada admin — akun dibuat otomatis saat Simpan & Hubungkan');
    } catch (err) { s3.fail(hint(err)); }

    if (!username || !password) {
      step('Login admin').warn('dilewati (username/password kosong)');
      return;
    }
    const s4 = step(`Login sebagai ${username}`);
    let user;
    try {
      const cred = await withTimeout(signInWithEmailAndPassword(testAuth, toEmail(username), toAuthPassword(password)), 15000);
      user = cred.user;
      s4.ok(`UID ${user.uid}`);
    } catch (err) {
      if (installed === false && CREDENTIAL_ERRORS.includes(err.code)) {
        s4.warn('akun belum ada — akan dibuat otomatis saat Simpan & Hubungkan');
        step('Selesai').ok('koneksi Firebase berhasil');
        return;
      }
      return s4.fail(hint(err));
    }

    const s5 = step('Cek hak admin (admins/{uid})');
    try {
      const snap = await withTimeout(getDoc(doc(db, 'admins', user.uid)), 10000);
      if (snap.exists()) s5.ok('akun ini admin ✔');
      else s5.warn('belum admin — simpan lalu klaim admin pertama');
    } catch (err) { s5.fail(hint(err)); }

    step('Selesai').ok('koneksi berhasil');
  } finally {
    if (testApp) deleteApp(testApp).catch(() => {});
  }
}
