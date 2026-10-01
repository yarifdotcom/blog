// YarifBlog — aplikasi publik.
// Memuat pengaturan & konten dari Firestore, lalu merender view lewat tema aktif.

import { initFirebase, loadConfig } from '../../core/firebase.js';
import * as store from '../../core/store.js';
import { Theme } from '../../core/theme.js';
import { Router } from '../../core/router.js';
import { safe } from '../../core/template.js';
import { markdown } from '../../core/markdown.js';
import { escapeHtml, formatDate, readingTime, stripHtml, truncate, toDate } from '../../core/utils.js';
import { initColorMode, hydrateSwitches, ensureFloatingSwitch } from '../../core/color-mode.js';

const el = document.getElementById('app');
const state = { settings: null, theme: null, posts: [], categories: [], tags: [] };

// Mode pratinjau (?preview=1): dipakai iframe di Admin › Tampilan. Draf (opsi & file
// template yang belum disimpan) dibaca dari localStorage dan diperbarui secara langsung.
const params = new URLSearchParams(location.search);
const PREVIEW = params.has('preview');
const PREVIEW_KEY = 'simpleblog.preview';
const readPreview = () => { try { return JSON.parse(localStorage.getItem(PREVIEW_KEY) || 'null'); } catch { return null; } };

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
async function boot() {
  initColorMode();
  const { config } = loadConfig();
  if (!config) {
    return bootMessage('Blog belum dikonfigurasi',
      'Buka <a href="admin/">panel admin</a> untuk mengisi konfigurasi Firebase, lalu unduh <code>firebase-config.js</code> ke folder <code>config/</code>.');
  }
  try {
    await initFirebase(config);
    state.settings = await store.getSettings();
    await loadContent();
  } catch (err) {
    console.error(err);
    return bootMessage('Gagal terhubung ke database', escapeHtml(err.message));
  }

  // ?theme=nama untuk pratinjau tema tanpa mengubah pengaturan.
  const themeName = params.get('theme') || state.settings.theme || 'default';
  try {
    await loadTheme(themeName);
  } catch (err) {
    console.error(err);
    return bootMessage(`Tema "${escapeHtml(themeName)}" gagal dimuat`, escapeHtml(err.message));
  }

  applySiteHead();
  bindEvents();
  if (PREVIEW) setupPreview(themeName);

  const router = new Router()
    .on('/', (ctx) => viewHome(ctx))
    .on('/post/:slug', (ctx) => viewPost(ctx))
    .on('/category/:slug', (ctx) => viewArchive('category', ctx))
    .on('/tag/:slug', (ctx) => viewArchive('tag', ctx))
    .on('/search', (ctx) => viewSearch(ctx))
    .otherwise((ctx) => viewNotFound(ctx));
  state.router = router;
  router.start();
}

/** Muat tema + override file (Firestore) + opsi Kustomisasi (+ draf bila mode pratinjau). */
async function loadTheme(name) {
  let overrides = {};
  try { overrides = await store.listThemeFiles(name); } catch (err) { console.warn('Override tema tidak dimuat:', err); }
  let options = state.settings.themeOptions?.[name] || {};
  if (PREVIEW) {
    const draft = readPreview();
    if (draft?.theme === name) {
      overrides = { ...overrides, ...(draft.files || {}) };
      for (const k of draft.reset || []) delete overrides[k];
      options = { ...options, ...(draft.options || {}) };
    }
  }
  state.theme = await new Theme(name, { overrides, options }).load();
  // CSS tambahan dari Pengaturan harus selalu paling akhir agar bisa menimpa tema.
  document.head.appendChild(document.getElementById('custom-css'));
}

function setupPreview(name) {
  const badge = document.createElement('div');
  badge.textContent = 'Pratinjau';
  badge.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:9999;background:#f59e0b;color:#111;font:600 12px system-ui;padding:4px 10px;border-radius:999px;opacity:.9;pointer-events:none';
  document.body.appendChild(badge);
  // Admin menulis draf ke localStorage → event "storage" sampai ke iframe ini.
  window.addEventListener('storage', async (e) => {
    if (e.key !== PREVIEW_KEY) return;
    try {
      await loadTheme(name);
      state.keepScrollOnce = true;
      state.router.resolve();
    } catch (err) {
      console.error(err);
    }
  });
}

function bootMessage(title, body) {
  el.innerHTML = `<div class="sb-boot"><h1>${escapeHtml(title)}</h1><p>${body}</p></div>`;
}

async function loadContent() {
  const [posts, categories, tags] = await Promise.all([
    store.listPublicPosts(),
    store.listTerms('categories'),
    store.listTerms('tags'),
  ]);
  state.categories = categories.map((c) => ({
    ...c,
    url: `#/category/${c.slug}`,
    count: posts.filter((p) => p.categoryIds?.includes(c.id)).length,
  }));
  state.tags = tags.map((t) => ({
    ...t,
    url: `#/tag/${t.slug}`,
    count: posts.filter((p) => p.tagIds?.includes(t.id)).length,
  }));
  const catMap = new Map(state.categories.map((c) => [c.id, c]));
  const tagMap = new Map(state.tags.map((t) => [t.id, t]));

  state.posts = posts.map((p) => decoratePost(p, {
    categories: (p.categoryIds || []).map((id) => catMap.get(id)).filter(Boolean),
    tags: (p.tagIds || []).map((id) => tagMap.get(id)).filter(Boolean),
  }));
}

/** Tambahkan field turunan yang memudahkan template. */
function decoratePost(p, extra) {
  const html = markdown(p.content || '');
  const date = toDate(p.publishedAt || p.createdAt);
  return {
    ...p,
    ...extra,
    url: `#/post/${p.slug}`,
    date,
    dateFormatted: formatDate(date, state.settings.dateFormat, state.settings.language),
    html: safe(html),
    excerpt: p.excerpt || truncate(stripHtml(html), Number(state.settings.excerptLength) || 180),
    readingTime: readingTime(html),
    category: extra.categories[0] || null,
  };
}

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------
function globalData(ctx) {
  const s = state.settings;
  return {
    site: s,
    categories: state.categories,
    navCategories: s.showCategoriesInNav ? state.categories.filter((c) => c.count > 0) : [],
    tags: state.tags.filter((t) => t.count > 0),
    recentPosts: state.posts.slice(0, 5),
    year: new Date().getFullYear(),
    route: ctx,
    query: ctx.query?.q || '',
  };
}

function render(view, ctx, data, meta = {}) {
  const full = { ...globalData(ctx), view, ...data };
  try {
    el.innerHTML = state.theme.render(view, full);
  } catch (err) {
    console.error(err);
    el.innerHTML = `<div class="sb-boot"><h1>Kesalahan template</h1><p>${escapeHtml(err.message)}</p></div>`;
    return;
  }
  setMeta(meta);
  // Saklar mode terang/gelap dari layout tema; tema tanpa saklar mendapat saklar mengambang.
  hydrateSwitches(el);
  ensureFloatingSwitch(el);
  state.theme.hooks.afterRender?.(el, view, full);
  if (state.theme.errors.length && PREVIEW) {
    el.insertAdjacentHTML('afterbegin', `<div style="background:#fee2e2;color:#991b1b;padding:10px 16px;font:13px system-ui">
      Template tidak valid, memakai file asli: ${state.theme.errors.map((e) => escapeHtml(`${e.key}: ${e.message}`)).join(' · ')}</div>`);
  }
  if (!ctx.keepScroll && !state.keepScrollOnce) window.scrollTo(0, 0);
  state.keepScrollOnce = false;
}

function paginate(items, ctx, baseUrl) {
  const perPage = Math.max(1, Number(state.settings.postsPerPage) || 6);
  const totalPages = Math.max(1, Math.ceil(items.length / perPage));
  const page = Math.min(Math.max(1, parseInt(ctx.query.page, 10) || 1), totalPages);
  const sep = baseUrl.includes('?') ? '&' : '?';
  const url = (n) => (n === 1 ? baseUrl : `${baseUrl}${sep}page=${n}`);
  return {
    items: items.slice((page - 1) * perPage, page * perPage),
    pagination: {
      page,
      totalPages,
      total: items.length,
      hasPrev: page > 1,
      hasNext: page < totalPages,
      prevUrl: url(page - 1),
      nextUrl: url(page + 1),
      pages: Array.from({ length: totalPages }, (_, i) => ({ number: i + 1, url: url(i + 1), current: i + 1 === page })),
    },
  };
}

function setMeta({ title, description, image, keywords } = {}) {
  const s = state.settings;
  document.title = title ? `${title} — ${s.title}` : (s.tagline ? `${s.title} — ${s.tagline}` : s.title);
  const set = (selector, value) => { const m = document.head.querySelector(selector); if (m) m.setAttribute('content', value || ''); };
  const desc = description || s.description || s.tagline;
  set('meta[name="description"]', desc);
  set('meta[name="keywords"]', keywords || s.keywords);
  set('meta[name="author"]', s.author);
  set('meta[property="og:title"]', title || s.title);
  set('meta[property="og:description"]', desc);
  set('meta[property="og:image"]', image || s.ogImage);
}

function applySiteHead() {
  const s = state.settings;
  document.documentElement.lang = s.language || 'id';
  if (s.faviconUrl) document.querySelector('link[rel="icon"]').href = s.faviconUrl;
  document.getElementById('custom-css').textContent = s.customCss || '';
  if (s.discourageSearch) {
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex, nofollow';
    document.head.appendChild(robots);
  }
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------
function viewHome(ctx) {
  const { items, pagination } = paginate(state.posts, ctx, '#/');
  render('home', ctx, { posts: items, pagination, isHome: true }, {});
}

async function viewPost(ctx) {
  const idx = state.posts.findIndex((p) => p.slug === ctx.params.slug);
  if (idx === -1) return viewNotFound(ctx);
  const post = state.posts[idx];
  const s = state.settings;

  let comments = [];
  const closeDays = Number(s.closeCommentsAfterDays) || 0;
  const expired = closeDays > 0 && post.date && Date.now() - post.date.getTime() > closeDays * 86400000;
  const commentsOpen = s.commentsEnabled && post.allowComments !== false && !expired;
  if (s.commentsEnabled) {
    try {
      const approved = await store.listApprovedComments(post.id);
      if (s.commentsOrder === 'desc') approved.reverse();
      comments = approved.map((c) => ({
        ...c,
        website: /^https?:\/\//i.test(c.website || '') ? c.website : '',
        date: toDate(c.createdAt),
        dateFormatted: formatDate(c.createdAt, s.dateFormat, s.language),
      }));
    } catch (err) {
      console.warn('Gagal memuat komentar:', err);
    }
  }

  const related = state.posts
    .filter((p) => p.id !== post.id && p.categoryIds?.some((id) => post.categoryIds?.includes(id)))
    .slice(0, 3);

  render('post', ctx, {
    post,
    comments,
    commentsOpen,
    relatedPosts: related,
    prevPost: state.posts[idx + 1] || null, // lebih lama
    nextPost: state.posts[idx - 1] || null, // lebih baru
    savedName: safeStorage('simpleblog.commenterName'),
  }, {
    title: post.metaTitle || post.title,
    description: post.metaDescription || post.excerpt,
    image: post.coverImage,
    keywords: post.tags.map((t) => t.name).join(', '),
  });
}

function viewArchive(type, ctx) {
  const list = type === 'category' ? state.categories : state.tags;
  const term = list.find((t) => t.slug === ctx.params.slug);
  if (!term) return viewNotFound(ctx);
  const field = type === 'category' ? 'categoryIds' : 'tagIds';
  const posts = state.posts.filter((p) => p[field]?.includes(term.id));
  const { items, pagination } = paginate(posts, ctx, term.url);
  const label = type === 'category' ? 'Kategori' : 'Tag';
  render('archive', ctx, {
    archive: { type, label, term, title: term.name, description: term.description },
    posts: items,
    pagination,
  }, { title: `${label}: ${term.name}`, description: term.description });
}

function viewSearch(ctx) {
  const q = (ctx.query.q || '').trim().toLowerCase();
  const results = q
    ? state.posts.filter((p) => [p.title, p.excerpt, p.content, ...p.tags.map((t) => t.name)]
      .join(' ').toLowerCase().includes(q))
    : [];
  const { items, pagination } = paginate(results, ctx, `#/search?q=${encodeURIComponent(ctx.query.q || '')}`);
  render('search', ctx, { searchQuery: ctx.query.q || '', posts: items, pagination, total: results.length },
    { title: `Pencarian: ${ctx.query.q || ''}` });
}

function viewNotFound(ctx) {
  render('404', ctx, {}, { title: 'Halaman tidak ditemukan' });
}

// ---------------------------------------------------------------------------
// Interaksi (event delegation — tetap berfungsi setelah re-render)
// ---------------------------------------------------------------------------
function bindEvents() {
  el.addEventListener('submit', async (e) => {
    const form = e.target;

    if (form.matches('[data-search-form]')) {
      e.preventDefault();
      const q = new FormData(form).get('q')?.toString().trim();
      state.router.navigate(q ? `/search?q=${encodeURIComponent(q)}` : '/');
      return;
    }

    if (form.matches('[data-comment-form]')) {
      e.preventDefault();
      await submitComment(form);
    }
  });
}

async function submitComment(form) {
  const fd = new FormData(form);
  const status = form.querySelector('[data-comment-status]');
  const button = form.querySelector('[type="submit"]');
  const show = (msg, type) => { if (status) { status.textContent = msg; status.dataset.type = type; } };

  if (fd.get('hp')) return; // honeypot anti-bot
  const name = String(fd.get('name') || '').trim();
  const content = String(fd.get('content') || '').trim();
  if (!name || !content) return show('Nama dan komentar wajib diisi.', 'error');

  const post = state.posts.find((p) => p.id === form.dataset.postId);
  if (!post) return;
  const moderation = state.settings.commentModeration !== false;

  button && (button.disabled = true);
  try {
    await store.addComment({
      postId: post.id,
      postTitle: post.title,
      name,
      website: String(fd.get('website') || ''),
      content,
    }, { moderation });
    try { localStorage.setItem('simpleblog.commenterName', name); } catch { /* abaikan */ }
    form.reset();
    if (moderation) {
      show('Terima kasih! Komentar Anda menunggu moderasi.', 'success');
    } else {
      const ctx = { ...state.router.current(), params: { slug: post.slug }, keepScroll: true };
      await viewPost(ctx);
      document.getElementById('comments')?.scrollIntoView({ behavior: 'smooth' });
    }
  } catch (err) {
    console.error(err);
    show('Gagal mengirim komentar: ' + err.message, 'error');
  } finally {
    button && (button.disabled = false);
  }
}

function safeStorage(key) {
  try { return localStorage.getItem(key) || ''; } catch { return ''; }
}

boot();
