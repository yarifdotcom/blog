// Admin › Tampilan › Editor Template.
// Edit layout, template, partial, dan CSS tema langsung dari admin. Perubahan disimpan sebagai
// override di Firestore (koleksi themeFiles) — file asli di folder themes/ tidak diubah dan
// bisa dikembalikan kapan saja.

import * as store from '../../../core/store.js';
import { resolveTheme } from '../../../core/theme.js';
import { TemplateEngine } from '../../../core/template.js';
import { html, $, loading, toast, busy, confirmAction } from '../ui.js';
import { setDraftFile, setDraftReset, clearDraft, previewPanel, bindPreviewPanel, previewUrl } from '../preview.js';

const TYPE_LABEL = { layout: 'Layout', template: 'Template', partial: 'Partial', style: 'Stylesheet' };
const TYPE_ORDER = ['layout', 'template', 'partial', 'style'];

const GLOBAL_VARS = [
  ['site.*', 'Pengaturan situs: title, tagline, description, logoUrl, footerText, …'],
  ['options.*', 'Nilai Kustomisasi tema (mis. options.sidebar, options.accent)'],
  ['categories', 'Semua kategori { name, slug, url, count }'],
  ['navCategories', 'Kategori untuk menu'],
  ['tags', 'Tag yang punya pos { name, url, count }'],
  ['recentPosts', '5 pos terbaru'],
  ['year', 'Tahun sekarang'],
  ['query', 'Kata kunci pencarian aktif'],
  ['view', 'home | post | archive | search | 404'],
];
const VIEW_VARS = {
  layout: [['content', 'HTML hasil render view — tulis {{{ content }}}']],
  'template:home': [['posts', 'Pos halaman ini'], ['pagination', '{ page, totalPages, hasPrev, hasNext, prevUrl, nextUrl, pages[] }']],
  'template:post': [['post', 'title, html, url, date, dateFormatted, excerpt, coverImage, categories, tags, readingTime, authorName'],
    ['comments', 'Komentar disetujui { name, website, content, date }'], ['commentsOpen', 'Form komentar boleh tampil'],
    ['relatedPosts', 'Pos terkait'], ['prevPost / nextPost', 'Navigasi pos']],
  'template:archive': [['archive', '{ type, label, title, description, term }'], ['posts', 'Pos di arsip'], ['pagination', 'Paginasi']],
  'template:search': [['searchQuery', 'Kata kunci'], ['total', 'Jumlah hasil'], ['posts', 'Hasil'], ['pagination', 'Paginasi']],
  'template:404': [],
  'partial:post-card': [['(konteks)', 'Satu objek pos: title, url, excerpt, coverImage, category, …']],
};

/** Daftar nama filter yang dipakai di template (untuk mendeteksi filter tak dikenal). */
function usedFilters(src) {
  const names = new Set();
  for (const m of src.matchAll(/\{\{\{?([\s\S]+?)\}?\}\}/g)) {
    const body = m[1].replace(/"[^"]*"|'[^']*'/g, '');
    for (const f of body.matchAll(/(?<!\|)\|(?!\|)\s*([a-zA-Z_]\w*)/g)) names.add(f[1]);
  }
  return [...names];
}

/** Engine dengan filter bawaan + filter dari script tema (untuk validasi). */
async function validationEngine(manifest) {
  const engine = new TemplateEngine();
  const fake = { engine, hooks: {}, options: {}, name: manifest.id };
  for (const src of manifest.scripts) {
    try {
      const mod = await import(new URL(src, location.href).href);
      if (typeof mod.default === 'function') await mod.default(fake);
    } catch { /* script tema gagal dimuat — validasi filter seadanya */ }
  }
  return engine;
}

async function previewHash(entry) {
  try {
    if (entry.key === 'template:post' || entry.key === 'partial:comments') {
      const post = (await store.listPublicPosts())[0];
      return post ? `#/post/${post.slug}` : '#/';
    }
    if (entry.key === 'template:archive') {
      const cat = (await store.listTerms('categories'))[0];
      return cat ? `#/category/${cat.slug}` : '#/';
    }
  } catch { /* abaikan */ }
  if (entry.key === 'template:search') return '#/search?q=a';
  if (entry.key === 'template:404') return '#/halaman-tidak-ada';
  return '#/';
}

export async function render({ el, query }) {
  el.innerHTML = String(loading());
  const [settings, themeList] = await Promise.all([
    store.getSettings(),
    fetch('../themes/index.json', { cache: 'no-cache' }).then((r) => r.json()).catch(() => []),
  ]);
  const themeId = query.theme || settings.theme || 'default';
  const manifest = await resolveTheme(themeId, '../themes/');
  // Rules lama (sebelum v1.3.0) belum mengizinkan koleksi themeFiles → tetap tampilkan editor
  // dengan petunjuk, alih-alih gagal total.
  let overrides = {};
  let rulesOutdated = false;
  try {
    overrides = await store.listThemeFiles(themeId);
  } catch (err) {
    if (err.code !== 'permission-denied') throw err;
    rulesOutdated = true;
  }
  const failMessage = (e) => (e.code === 'permission-denied'
    ? 'Ditolak Firestore rules. Deploy ulang firestore.rules terbaru (Console › Firestore › Rules › Publish).'
    : e.message);
  const engine = await validationEngine(manifest);
  const entries = Object.values(manifest.files)
    .sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) || a.name.localeCompare(b.name));

  let current = manifest.files[query.file] || entries[0];
  let original = '';
  let dirty = false;

  el.innerHTML = String(html`
    ${rulesOutdated ? html`<div class="alert alert-error rules-alert">
      <strong>Firestore rules belum diperbarui.</strong> Koleksi <code>themeFiles</code> (dipakai Editor Template) belum diizinkan
      di proyek Firebase Anda, jadi perubahan belum bisa disimpan. Salin isi <code>firestore.rules</code> dari project ini ke
      <em>Firebase Console › Firestore Database › Rules</em> lalu klik <b>Publish</b> (atau
      <code>firebase deploy --only firestore:rules</code>), kemudian muat ulang halaman ini.
      File tema tetap bisa dilihat dan dipratinjau.</div>` : ''}
    <div class="editor-toolbar">
      <label class="small muted">Tema
        <select id="theme-select">${themeList.map((t) => html`<option value="${t.id}" ${t.id === themeId ? 'selected' : ''}>${t.name}${t.id === settings.theme ? ' (aktif)' : ''}</option>`)}</select>
      </label>
      <span class="muted small">Perubahan disimpan sebagai <b>override</b> di Firestore; file asli di <code>themes/${themeId}/</code> tidak diubah.</span>
    </div>
    <div class="te-layout">
      <nav class="te-files card no-pad" id="file-list"></nav>
      <section class="te-main">
        <div class="card no-pad">
          <div class="te-head">
            <div><b id="file-title"></b><div class="muted small" id="file-meta"></div></div>
            <div class="actions">
              <button class="btn btn-sm btn-ghost text-red" id="revert-btn" hidden>Kembalikan ke asli</button>
              <button class="btn btn-sm" id="preview-btn">Pratinjau</button>
              <button class="btn btn-sm btn-primary" id="save-btn">Simpan</button>
            </div>
          </div>
          <div class="te-error" id="te-error" hidden></div>
          <textarea id="code" class="code-editor" spellcheck="false" autocapitalize="off" wrap="off"></textarea>
          <div class="te-foot muted small"><span id="cursor-pos"></span><span>Tab = 2 spasi · Ctrl+S simpan</span></div>
        </div>
        <div id="preview-slot"></div>
      </section>
      <aside class="te-help card" id="help"></aside>
    </div>`);

  const code = $('#code', el);

  const drawFiles = () => {
    let lastType = '';
    $('#file-list', el).innerHTML = String(html`${entries.map((e) => {
      const header = e.type !== lastType ? html`<div class="te-group">${TYPE_LABEL[e.type]}</div>` : '';
      lastType = e.type;
      return html`${header}<button class="te-file ${e.key === current.key ? 'active' : ''}" data-key="${e.key}">
        <span>${e.type === 'layout' ? 'layout' : e.name}</span>
        ${overrides[e.key] != null ? html`<span class="badge badge-amber" title="Ada perubahan tersimpan">diubah</span>` : ''}
        ${e.theme !== themeId ? html`<span class="badge badge-gray" title="Diwarisi dari ${e.theme}">induk</span>` : ''}
      </button>`;
    })}`);
  };

  const drawHelp = () => {
    const isStyle = current.type === 'style';
    const vars = [...(VIEW_VARS[current.key] || VIEW_VARS[current.type] || []), ...(current.type === 'partial' && !VIEW_VARS[current.key] ? [['(konteks)', 'Konteks pemanggil, atau objek yang dikirim: {{> nama obj}}']] : [])];
    $('#help', el).innerHTML = String(isStyle ? html`
      <h3 class="card-title">CSS</h3>
      <p class="small">Variabel dari Kustomisasi tersedia sebagai CSS variable, mis. <code>var(--accent)</code>, <code>var(--max)</code>, <code>var(--radius)</code>, <code>var(--font)</code>.</p>
      <p class="small muted">Override CSS disisipkan sebagai &lt;style&gt;, jadi <code>url()</code> relatif tidak berlaku — pakai URL absolut.</p>` : html`
      <h3 class="card-title">Sintaks</h3>
      <dl class="cheat">
        <dt>{{ x }}</dt><dd>Tampilkan (di-escape)</dd>
        <dt>{{{ x }}}</dt><dd>HTML mentah</dd>
        <dt>{{ x | filter:arg }}</dt><dd>Filter</dd>
        <dt>{{#if a == b}}…{{else}}…{{/if}}</dt><dd>Kondisi (and, or, not, &gt;, &lt;)</dd>
        <dt>{{#each list}}…{{/each}}</dt><dd>Perulangan (@index, @first, @last)</dd>
        <dt>{{> nama}}</dt><dd>Sisipkan partial</dd>
        <dt>{{!-- … --}}</dt><dd>Komentar</dd>
      </dl>
      ${vars.length ? html`<h3 class="card-title mt">Variabel file ini</h3><dl class="cheat">${vars.map(([k, d]) => html`<dt>${k}</dt><dd>${d}</dd>`)}</dl>` : ''}
      <h3 class="card-title mt">Variabel global</h3>
      <dl class="cheat">${GLOBAL_VARS.map(([k, d]) => html`<dt>${k}</dt><dd>${d}</dd>`)}</dl>
      <h3 class="card-title mt">Filter</h3>
      <p class="small cheat-filters">${Object.keys(engine.filters).sort().map((f) => html`<code>${f}</code> `)}</p>
      <h3 class="card-title mt">Partial</h3>
      <p class="small">${entries.filter((e) => e.type === 'partial').map((e) => html`<code>{{> ${e.name}}}</code> `)}</p>
      <p class="small muted">Referensi lengkap: <code>docs/04-template-engine.md</code> &amp; <code>docs/05-membuat-tema.md</code></p>`);
  };

  const setDirty = (v) => {
    dirty = v;
    $('#file-title', el).textContent = `${current.type === 'layout' ? 'layout' : current.key}${dirty ? ' ●' : ''}`;
  };

  const validate = (src) => {
    if (current.type === 'style') return null;
    try {
      engine.compile(src);
    } catch (err) {
      return err.message;
    }
    const unknown = usedFilters(src).filter((f) => !engine.filters[f]);
    if (unknown.length) return `Filter tidak dikenal: ${unknown.join(', ')}`;
    return null;
  };

  const showError = (msg) => {
    const box = $('#te-error', el);
    box.hidden = !msg;
    box.textContent = msg ? `⚠ ${msg}` : '';
  };

  async function open(entry) {
    current = entry;
    history.replaceState(null, '', `#/appearance/editor?theme=${encodeURIComponent(themeId)}&file=${encodeURIComponent(entry.key)}`);
    drawFiles();
    drawHelp();
    code.value = 'Memuat…';
    code.disabled = true;
    try {
      original = await fetch(entry.url, { cache: 'no-cache' }).then((r) => (r.ok ? r.text() : Promise.reject(new Error(`${r.status}`))));
    } catch (err) {
      original = '';
      toast(`Gagal memuat ${entry.url}: ${err.message}`, 'error');
    }
    code.disabled = false;
    code.value = overrides[entry.key] ?? original;
    $('#file-meta', el).textContent = `${entry.url.replace('../', '')}${entry.theme !== themeId ? ` · diwarisi dari tema "${entry.theme}"` : ''}${overrides[entry.key] != null ? ' · berisi perubahan tersimpan' : ''}`;
    $('#revert-btn', el).hidden = overrides[entry.key] == null;
    showError(null);
    setDirty(false);
    updateCursor();
  }

  // --- Interaksi editor -----------------------------------------------------
  const updateCursor = () => {
    const before = code.value.slice(0, code.selectionStart);
    const line = before.split('\n').length;
    const col = before.length - before.lastIndexOf('\n');
    $('#cursor-pos', el).textContent = `Baris ${line}, kolom ${col}`;
  };
  code.addEventListener('input', () => { setDirty(code.value !== (overrides[current.key] ?? original)); showError(validate(code.value)); });
  code.addEventListener('keyup', updateCursor);
  code.addEventListener('click', updateCursor);
  code.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      code.setRangeText('  ', code.selectionStart, code.selectionEnd, 'end');
      code.dispatchEvent(new Event('input'));
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save(); }
  });

  $('#file-list', el).addEventListener('click', (e) => {
    const key = e.target.closest('[data-key]')?.dataset.key;
    if (!key || key === current.key) return;
    if (dirty && !confirmAction('Perubahan belum disimpan akan hilang. Lanjutkan?')) return;
    open(manifest.files[key]);
  });

  $('#theme-select', el).addEventListener('change', (e) => {
    if (dirty && !confirmAction('Perubahan belum disimpan akan hilang. Lanjutkan?')) { e.target.value = themeId; return; }
    location.hash = `#/appearance/editor?theme=${encodeURIComponent(e.target.value)}`;
  });

  // --- Simpan / kembalikan / pratinjau ---------------------------------------
  const save = () => busy($('#save-btn', el), async () => {
    const err = validate(code.value);
    if (err) { showError(err); return toast('Tidak disimpan: perbaiki kesalahan template dulu.', 'error'); }
    try {
      if (code.value === original) {
        // Isi sama dengan file asli → hapus override saja.
        if (overrides[current.key] != null) await store.deleteThemeFile(themeId, current.key);
        delete overrides[current.key];
      } else {
        await store.saveThemeFile(themeId, current.key, code.value);
        overrides[current.key] = code.value;
      }
      setDraftFile(themeId, current.key, code.value);
      toast('Tersimpan & langsung dipakai situs.', 'success');
      open(current);
    } catch (e) {
      toast('Gagal menyimpan: ' + failMessage(e), 'error', 8000);
    }
  });
  $('#save-btn', el).addEventListener('click', save);

  $('#revert-btn', el).addEventListener('click', () => {
    if (!confirmAction(`Hapus perubahan pada "${current.key}" dan kembali ke file asli tema?`)) return;
    busy($('#revert-btn', el), async () => {
      try {
        await store.deleteThemeFile(themeId, current.key);
        delete overrides[current.key];
        setDraftReset(themeId, current.key);
        toast('Dikembalikan ke file asli.', 'success');
        open(current);
      } catch (e) {
        toast('Gagal: ' + failMessage(e), 'error', 8000);
      }
    });
  });

  let frame = null;
  $('#preview-btn', el).addEventListener('click', async () => {
    const err = validate(code.value);
    showError(err);
    setDraftFile(themeId, current.key, code.value);
    const hash = await previewHash(current);
    if (!frame) {
      $('#preview-slot', el).innerHTML = String(previewPanel(themeId));
      frame = bindPreviewPanel($('#preview-slot', el));
    }
    frame.src = previewUrl(themeId, hash);
    $('#preview-slot', el).scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  window.addEventListener('hashchange', function cleanup() {
    window.removeEventListener('hashchange', cleanup);
    clearDraft();
  });

  await open(current);
}
