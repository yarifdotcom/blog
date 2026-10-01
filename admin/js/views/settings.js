// Admin › Pengaturan (ala WordPress): Umum, Menulis, Membaca, Diskusi, SEO, Tampilan.
// Route: #/settings/:section — setiap bagian disimpan terpisah (merge) ke settings/site.

import * as store from '../../../core/store.js';
import { html, raw, $, loading, toast, busy, readForm } from '../ui.js';

export const SECTIONS = [
  ['general', 'Umum'],
  ['writing', 'Menulis'],
  ['reading', 'Membaca'],
  ['discussion', 'Diskusi'],
  ['seo', 'SEO'],
  ['appearance', 'Identitas & CSS'],
];

async function loadThemes() {
  try {
    const res = await fetch('../themes/index.json', { cache: 'no-cache' });
    return res.ok ? await res.json() : [];
  } catch {
    return [];
  }
}

export async function render({ el, params }) {
  const section = SECTIONS.some(([k]) => k === params.section) ? params.section : 'general';
  el.innerHTML = String(loading());
  const [s, themes, categories] = await Promise.all([store.getSettings(), loadThemes(), store.listTerms('categories')]);
  if (!themes.some((t) => t.id === s.theme)) themes.push({ id: s.theme, name: s.theme });

  // --- helper field -------------------------------------------------------
  const help = (t) => (t ? html`<small class="muted">${t}</small>` : '');
  const input = (name, label, a = {}) => html`
    <div class="field">
      <label for="${name}">${label}</label>
      <input id="${name}" name="${name}" value="${s[name] ?? ''}" type="${a.type || 'text'}"
        placeholder="${a.placeholder || ''}" ${a.min !== undefined ? raw(`min="${a.min}"`) : ''} ${a.max ? raw(`max="${a.max}"`) : ''}>
      ${help(a.help)}
    </div>`;
  const textarea = (name, label, a = {}) => html`
    <div class="field">
      <label for="${name}">${label}</label>
      <textarea id="${name}" name="${name}" rows="${a.rows || 3}" placeholder="${a.placeholder || ''}"
        class="${a.mono ? 'mono' : ''}">${s[name] ?? ''}</textarea>
      ${help(a.help)}
    </div>`;
  const check = (name, label, h) => html`
    <div class="field"><label class="check"><input type="checkbox" name="${name}" ${s[name] ? 'checked' : ''}> ${label}</label>${help(h)}</div>`;
  const select = (name, label, options, h) => html`
    <div class="field">
      <label for="${name}">${label}</label>
      <select id="${name}" name="${name}">
        ${options.map(([v, t]) => html`<option value="${v}" ${String(s[name]) === String(v) ? 'selected' : ''}>${t}</option>`)}
      </select>
      ${help(h)}
    </div>`;

  // --- isi tiap bagian ----------------------------------------------------
  const bodies = {
    general: () => html`
      <h2 class="card-title">Pengaturan Umum</h2>
      ${input('title', 'Judul situs')}
      ${input('tagline', 'Slogan (tagline)', { placeholder: 'Kalimat singkat yang menjelaskan situs ini' })}
      ${input('siteUrl', 'Alamat situs (URL)', { type: 'url', placeholder: 'https://blogku.web.app', help: 'Dipakai untuk tautan absolut & meta tag.' })}
      <div class="field-row">
        ${select('language', 'Bahasa situs', [['id', 'Bahasa Indonesia'], ['en', 'English']])}
        ${input('dateFormat', 'Format tanggal', { help: 'Token: D DD M MM MMM MMMM YYYY dddd HH mm' })}
      </div>
      <p class="muted small">Contoh: <code>D MMMM YYYY</code> → 1 Oktober 2026 · <code>DD/MM/YYYY</code> → 01/10/2026 · <code>dddd, D MMM YYYY</code> → Kamis, 1 Okt 2026</p>`,

    writing: () => html`
      <h2 class="card-title">Pengaturan Menulis</h2>
      <p class="muted">Nilai awal untuk post baru di editor.</p>
      ${select('defaultCategoryId', 'Kategori bawaan', [['', '— Tanpa kategori —'], ...categories.map((c) => [c.id, c.name])])}
      ${select('defaultPostStatus', 'Status bawaan', [['draft', 'Draf'], ['published', 'Terbit']])}
      ${input('author', 'Nama penulis bawaan')}
      ${check('defaultAllowComments', 'Izinkan komentar pada post baru')}`,

    reading: () => html`
      <h2 class="card-title">Pengaturan Membaca</h2>
      <div class="field-row">
        ${input('postsPerPage', 'Jumlah post per halaman', { type: 'number', min: 1, max: 50 })}
        ${input('excerptLength', 'Panjang ringkasan otomatis (karakter)', { type: 'number', min: 50, max: 1000 })}
      </div>
      ${check('showCategoriesInNav', 'Tampilkan kategori di menu navigasi situs')}
      ${check('discourageSearch', 'Minta mesin pencari tidak mengindeks situs ini',
        'Menambahkan meta robots "noindex, nofollow". Keputusan akhir tetap di mesin pencari.')}`,

    discussion: () => html`
      <h2 class="card-title">Pengaturan Diskusi</h2>
      ${check('commentsEnabled', 'Izinkan pengunjung berkomentar', 'Mematikan ini menutup komentar di seluruh situs.')}
      ${check('commentModeration', 'Komentar harus disetujui admin sebelum tampil', 'Disarankan tetap aktif untuk mencegah spam.')}
      <div class="field-row">
        ${input('closeCommentsAfterDays', 'Tutup komentar otomatis setelah (hari)', { type: 'number', min: 0, help: '0 = tidak pernah ditutup.' })}
        ${select('commentsOrder', 'Urutan komentar', [['asc', 'Terlama di atas'], ['desc', 'Terbaru di atas']])}
      </div>`,

    seo: () => html`
      <h2 class="card-title">SEO &amp; Media Sosial</h2>
      ${textarea('description', 'Meta description default', { help: 'Juga tampil di widget "Tentang". Ideal 120–160 karakter.' })}
      ${textarea('keywords', 'Meta keywords', { rows: 2, placeholder: 'blog, teknologi, tutorial' })}
      ${input('ogImage', 'Gambar Open Graph default', { type: 'url', help: 'Tampil saat tautan dibagikan ke media sosial (disarankan 1200×630).' })}`,

    appearance: () => html`
      <h2 class="card-title">Identitas &amp; CSS</h2>
      <p class="muted small">Tema aktif: <b>${themes.find((t) => t.id === s.theme)?.name || s.theme}</b> —
        ganti di <a href="#/appearance/themes">Tampilan › Tema</a>, atur warna &amp; tata letak di
        <a href="#/appearance/customize">Kustomisasi</a>.</p>
      ${input('logoUrl', 'URL logo', { type: 'url' })}
      ${input('faviconUrl', 'URL favicon (ikon situs)', { type: 'url' })}
      ${input('footerText', 'Teks footer', { placeholder: '© 2026 Blogku' })}
      ${textarea('customCss', 'CSS tambahan', { rows: 8, mono: true, placeholder: ':root { --accent: #e11d48; }', help: 'Disisipkan setelah stylesheet tema.' })}`,
  };

  el.innerHTML = String(html`
    <div class="tabs tabs-line">
      ${SECTIONS.map(([k, label]) => html`<a class="tab ${k === section ? 'active' : ''}" href="#/settings/${k}">${label}</a>`)}
    </div>
    <form id="settings-form" class="card settings-card" autocomplete="off">
      ${bodies[section]()}
      <div class="actions"><button type="submit" class="btn btn-primary" id="save-btn">Simpan Perubahan</button></div>
    </form>`);

  const form = $('#settings-form', el);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    busy($('#save-btn', el), async () => {
      const data = readForm(form);
      const int = (v, d, min, max) => Math.min(max, Math.max(min, Math.floor(Number(v)) || d));
      if ('postsPerPage' in data) data.postsPerPage = int(data.postsPerPage, 6, 1, 50);
      if ('excerptLength' in data) data.excerptLength = int(data.excerptLength, 180, 50, 1000);
      if ('closeCommentsAfterDays' in data) data.closeCommentsAfterDays = int(data.closeCommentsAfterDays, 0, 0, 3650);
      if ('dateFormat' in data) data.dateFormat = data.dateFormat.trim() || 'D MMMM YYYY';
      if ('title' in data && !data.title.trim()) return toast('Judul situs wajib diisi.', 'error');
      try {
        await store.saveSettings(data);
        if (data.title) document.getElementById('brand-title').textContent = data.title;
        toast('Pengaturan disimpan.', 'success');
      } catch (err) {
        toast('Gagal menyimpan: ' + err.message, 'error');
      }
    });
  });
}
