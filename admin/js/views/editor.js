// Admin › Tulis / Edit Post (editor Markdown dengan pratinjau)

import * as store from '../../../core/store.js';
import { markdown } from '../../../core/markdown.js';
import { slugify, formatDate, toDate } from '../../../core/utils.js';
import { html, raw, $, $$, loading, toast, busy, readForm, confirmAction } from '../ui.js';
import { createDateTimePicker } from '../datetime-picker.js';

const TOOLBAR = [
  ['bold', 'B', 'Tebal (Ctrl+B)'], ['italic', 'I', 'Miring (Ctrl+I)'], ['h2', 'H2', 'Judul 2'], ['h3', 'H3', 'Judul 3'],
  ['link', '🔗', 'Tautan'], ['image', '🖼', 'Gambar'], ['quote', '❝', 'Kutipan'], ['code', '</>', 'Kode'],
  ['ul', '•', 'Daftar'], ['ol', '1.', 'Daftar bernomor'], ['hr', '—', 'Garis'],
];

export async function render({ el, params, app }) {
  el.innerHTML = String(loading());
  const isNew = !params.id;
  const [post, categories, tags, settings] = await Promise.all([
    isNew ? null : store.getPost(params.id),
    store.listTerms('categories'),
    store.listTerms('tags'),
    store.getSettings(),
  ]);
  if (!isNew && !post) {
    el.innerHTML = '<div class="alert alert-error">Post tidak ditemukan.</div>';
    return;
  }

  // Post baru memakai nilai dari Pengaturan › Menulis.
  const defaultCat = categories.some((c) => c.id === settings.defaultCategoryId) ? [settings.defaultCategoryId] : [];
  const p = post || {
    title: '', slug: '', content: '', excerpt: '', status: settings.defaultPostStatus || 'draft', coverImage: '',
    categoryIds: defaultCat, tagIds: [], allowComments: settings.defaultAllowComments !== false,
    metaTitle: '', metaDescription: '', authorName: settings.author || '',
  };
  const tagNames = (p.tagIds || []).map((id) => tags.find((t) => t.id === id)?.name).filter(Boolean);
  const pubDate = toDate(p.publishedAt);

  el.innerHTML = String(html`
    <form class="editor" id="post-form" autocomplete="off">
      <div class="editor-main">
        <input name="title" class="title-input" placeholder="Judul post" value="${p.title}" required>
        <div class="slug-row">
          <span class="muted">Permalink:</span> <code>#/post/</code><input name="slug" value="${p.slug}" placeholder="otomatis-dari-judul" spellcheck="false">
        </div>

        <div class="card no-pad md">
          <div class="md-toolbar">
            ${TOOLBAR.map(([k, label, title]) => html`<button type="button" class="md-btn" data-md="${k}" title="${title}">${label}</button>`)}
            <div class="tabs md-tabs">
              <button type="button" class="tab active" data-mode="write">Tulis</button>
              <button type="button" class="tab" data-mode="preview">Pratinjau</button>
            </div>
          </div>
          <textarea name="content" class="md-input" rows="22" placeholder="Tulis konten dengan Markdown…">${p.content}</textarea>
          <div class="md-preview prose" hidden></div>
          <div class="md-foot muted small"><span id="wordcount"></span><span>Markdown didukung · Ctrl+S untuk menyimpan</span></div>
        </div>

        <div class="card">
          <label class="label" for="excerpt">Ringkasan (excerpt)</label>
          <textarea id="excerpt" name="excerpt" rows="3" placeholder="Kosongkan untuk dibuat otomatis dari konten.">${p.excerpt}</textarea>
        </div>

        <div class="card">
          <h3 class="card-title">SEO</h3>
          <div class="field">
            <label for="metaTitle">Meta title <small class="muted" data-count-for="metaTitle"></small></label>
            <input id="metaTitle" name="metaTitle" value="${p.metaTitle || ''}" maxlength="70" placeholder="Default: judul post">
          </div>
          <div class="field">
            <label for="metaDescription">Meta description <small class="muted" data-count-for="metaDescription"></small></label>
            <textarea id="metaDescription" name="metaDescription" rows="2" maxlength="160" placeholder="Default: ringkasan">${p.metaDescription || ''}</textarea>
          </div>
        </div>
      </div>

      <aside class="editor-side">
        <div class="card">
          <h3 class="card-title">Terbitkan</h3>
          <div class="field">
            <label for="status">Status</label>
            <select id="status" name="status">
              <option value="draft" ${p.status === 'draft' ? 'selected' : ''}>Draf</option>
              <option value="published" ${p.status === 'published' ? 'selected' : ''}>Terbit</option>
            </select>
          </div>
          <div class="field">
            <label>Tanggal terbit</label>
            <div class="dtp" id="published-picker" data-name="publishedAt" data-value="${pubDate ? formatDate(pubDate, 'YYYY-MM-DDTHH:mm') : ''}"></div>
            <small class="muted" id="schedule-hint">Kosong = waktu saat diterbitkan. Tanggal di masa depan = terjadwal.</small>
          </div>
          <div class="field">
            <label for="authorName">Penulis</label>
            <input id="authorName" name="authorName" value="${p.authorName || ''}">
          </div>
          <label class="check"><input type="checkbox" name="allowComments" ${p.allowComments !== false ? 'checked' : ''}> Izinkan komentar</label>
          <div class="actions">
            <button type="submit" class="btn btn-primary btn-block" id="save-btn">${isNew ? 'Simpan' : 'Perbarui'}</button>
          </div>
          ${!isNew ? html`<div class="actions between">
            ${p.status === 'published' ? html`<a href="../#/post/${p.slug}" target="_blank" class="small">Lihat post ↗</a>` : html`<span></span>`}
            <button type="button" class="btn btn-ghost btn-sm text-red" id="delete-btn">Hapus</button>
          </div>` : ''}
        </div>

        <div class="card">
          <h3 class="card-title">Kategori</h3>
          <div class="checklist" id="cat-list">
            ${categories.map((c) => html`<label class="check"><input type="checkbox" name="categoryIds" data-multi value="${c.id}" ${p.categoryIds?.includes(c.id) ? 'checked' : ''}> ${c.name}</label>`)}
            ${categories.length ? '' : raw('<p class="muted small">Belum ada kategori.</p>')}
          </div>
          <div class="inline-add">
            <input id="new-cat" placeholder="Kategori baru">
            <button type="button" class="btn btn-sm" id="add-cat">Tambah</button>
          </div>
        </div>

        <div class="card">
          <h3 class="card-title">Tag</h3>
          <input name="tags" id="tags-input" list="tag-suggest" value="${tagNames.join(', ')}" placeholder="pisahkan dengan koma">
          <datalist id="tag-suggest">${tags.map((t) => html`<option value="${t.name}">`)}</datalist>
          <div class="chips" id="tag-chips"></div>
          ${tags.length ? html`<details class="small"><summary class="muted">Pilih dari tag yang ada</summary>
            <div class="chips">${tags.map((t) => html`<button type="button" class="chip chip-btn" data-tag="${t.name}">${t.name}</button>`)}</div>
          </details>` : ''}
        </div>

        <div class="card">
          <h3 class="card-title">Gambar Sampul</h3>
          <input name="coverImage" id="cover" value="${p.coverImage || ''}" placeholder="https://…/gambar.jpg">
          <img id="cover-preview" class="cover-preview" alt="" ${p.coverImage ? '' : 'hidden'} src="${p.coverImage || ''}">
        </div>
      </aside>
    </form>`);

  const form = $('#post-form', el);

  // Tanggal terbit: picker kustom + keterangan terjadwal.
  const scheduleHint = $('#schedule-hint', el);
  const updateHint = (d) => {
    const future = d && d > new Date();
    scheduleHint.innerHTML = future
      ? String(html`<span class="badge badge-blue">Terjadwal</span> tampil di situs mulai ${formatDate(d, 'D MMMM YYYY, HH:mm')}`)
      : 'Kosong = waktu saat diterbitkan. Tanggal di masa depan = terjadwal.';
  };
  const picker = createDateTimePicker($('#published-picker', el), { onChange: updateHint });
  updateHint(picker.value);
  const title = form.elements.title;
  const slug = form.elements.slug;
  const content = form.elements.content;
  const preview = $('.md-preview', el);
  let slugTouched = !isNew || !!p.slug;

  // Slug otomatis dari judul sampai diubah manual.
  title.addEventListener('input', () => { if (!slugTouched) slug.value = slugify(title.value); });
  slug.addEventListener('input', () => { slugTouched = true; });
  slug.addEventListener('blur', () => { slug.value = slugify(slug.value || title.value); });

  // Hitung kata & karakter SEO.
  const updateCounts = () => {
    const words = content.value.trim().split(/\s+/).filter(Boolean).length;
    $('#wordcount', el).textContent = `${words} kata`;
    $$('[data-count-for]', el).forEach((s) => {
      const f = form.elements[s.dataset.countFor];
      s.textContent = `(${f.value.length}/${f.maxLength})`;
    });
  };
  form.addEventListener('input', updateCounts);
  updateCounts();

  // Tab tulis / pratinjau.
  $('.md-tabs', el).addEventListener('click', (e) => {
    const mode = e.target.closest('[data-mode]')?.dataset.mode;
    if (!mode) return;
    $$('.md-tabs .tab', el).forEach((t) => t.classList.toggle('active', t.dataset.mode === mode));
    const isPreview = mode === 'preview';
    if (isPreview) preview.innerHTML = markdown(content.value) || '<p class="muted">Belum ada konten.</p>';
    preview.hidden = !isPreview;
    content.hidden = isPreview;
    $$('.md-btn', el).forEach((b) => { b.disabled = isPreview; });
  });

  // Toolbar markdown.
  $('.md-toolbar', el).addEventListener('click', (e) => {
    const action = e.target.closest('[data-md]')?.dataset.md;
    if (action) applyMarkdown(content, action);
  });
  content.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    if (e.key === 'b') { e.preventDefault(); applyMarkdown(content, 'bold'); }
    if (e.key === 'i') { e.preventDefault(); applyMarkdown(content, 'italic'); }
  });

  // Tag chips.
  const tagsInput = $('#tags-input', el);
  const parseTags = () => tagsInput.value.split(',').map((s) => s.trim()).filter(Boolean);
  const drawChips = () => {
    $('#tag-chips', el).innerHTML = String(html`${parseTags().map((t) => html`<span class="chip">${t}<button type="button" data-remove-tag="${t}">×</button></span>`)}`);
  };
  tagsInput.addEventListener('input', drawChips);
  el.addEventListener('click', (e) => {
    const rm = e.target.closest('[data-remove-tag]')?.dataset.removeTag;
    const add = e.target.closest('[data-tag]')?.dataset.tag;
    if (rm) tagsInput.value = parseTags().filter((t) => t !== rm).join(', ');
    if (add && !parseTags().includes(add)) tagsInput.value = [...parseTags(), add].join(', ');
    if (rm || add) drawChips();
  });
  drawChips();

  // Cover preview.
  const cover = $('#cover', el);
  const coverPreview = $('#cover-preview', el);
  cover.addEventListener('change', () => {
    coverPreview.src = cover.value;
    coverPreview.hidden = !cover.value;
  });

  // Tambah kategori cepat.
  $('#add-cat', el).addEventListener('click', async (e) => {
    const input = $('#new-cat', el);
    const name = input.value.trim();
    if (!name) return;
    await busy(e.currentTarget, async () => {
      const id = await store.saveTerm('categories', null, { name });
      $('#cat-list', el).querySelector('p')?.remove();
      $('#cat-list', el).insertAdjacentHTML('beforeend',
        String(html`<label class="check"><input type="checkbox" name="categoryIds" data-multi value="${id}" checked> ${name}</label>`));
      input.value = '';
      toast(`Kategori "${name}" ditambahkan.`, 'success');
    });
  });

  // Simpan.
  const save = () => busy($('#save-btn', el), async () => {
    const data = readForm(form);
    if (!data.title.trim()) return toast('Judul wajib diisi.', 'error');

    let finalSlug = slugify(data.slug || data.title) || `post-${Date.now()}`;
    let n = 2;
    const base = finalSlug;
    while (await store.isSlugTaken(finalSlug, params.id)) finalSlug = `${base}-${n++}`;
    if (finalSlug !== base) toast(`Slug sudah dipakai, diganti menjadi "${finalSlug}".`, 'info');

    const payload = {
      title: data.title.trim(),
      slug: finalSlug,
      content: data.content,
      excerpt: data.excerpt.trim(),
      status: data.status,
      // Kosong → savePost mengisi "sekarang" saat status Terbit.
      publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
      authorName: data.authorName.trim(),
      allowComments: data.allowComments,
      categoryIds: data.categoryIds || [],
      tagIds: await store.ensureTags(parseTags(), tags),
      coverImage: data.coverImage.trim(),
      metaTitle: data.metaTitle.trim(),
      metaDescription: data.metaDescription.trim(),
    };
    try {
      const id = await store.savePost(params.id, payload);
      toast(isNew ? 'Post dibuat.' : 'Post diperbarui.', 'success');
      app.router.navigate(`/posts/edit/${id}`); // me-render ulang dengan data terbaru
    } catch (err) {
      toast('Gagal menyimpan: ' + err.message, 'error', 6000);
    }
  });

  form.addEventListener('submit', (e) => { e.preventDefault(); save(); });
  form.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save(); }
  });

  $('#delete-btn', el)?.addEventListener('click', async () => {
    if (!confirmAction(`Hapus post "${p.title}" beserta komentarnya?`)) return;
    await store.deletePost(params.id);
    toast('Post dihapus.', 'success');
    app.router.navigate('/posts');
  });
}

/** Sisipkan sintaks Markdown pada posisi seleksi textarea. */
function applyMarkdown(ta, action) {
  const { selectionStart: s, selectionEnd: e, value } = ta;
  const sel = value.slice(s, e);
  const wrap = (before, after = before, placeholder = 'teks') => {
    const text = sel || placeholder;
    ta.setRangeText(before + text + after, s, e, 'end');
    if (!sel) ta.setSelectionRange(s + before.length, s + before.length + text.length);
  };
  const prefix = (pre) => {
    const lineStart = value.lastIndexOf('\n', s - 1) + 1;
    const block = value.slice(lineStart, e) || 'teks';
    const lines = block.split('\n').map((l, i) => (typeof pre === 'function' ? pre(i) : pre) + l);
    ta.setRangeText(lines.join('\n'), lineStart, e, 'end');
  };

  switch (action) {
    case 'bold': wrap('**'); break;
    case 'italic': wrap('*'); break;
    case 'h2': prefix('## '); break;
    case 'h3': prefix('### '); break;
    case 'quote': prefix('> '); break;
    case 'ul': prefix('- '); break;
    case 'ol': prefix((i) => `${i + 1}. `); break;
    case 'code': sel.includes('\n') ? wrap('```\n', '\n```', 'kode') : wrap('`', '`', 'kode'); break;
    case 'hr': ta.setRangeText('\n\n---\n\n', s, e, 'end'); break;
    case 'link': {
      const url = window.prompt('URL tautan:', 'https://');
      if (url) wrap('[', `](${url})`, 'teks tautan');
      break;
    }
    case 'image': {
      const url = window.prompt('URL gambar:', 'https://');
      if (url) wrap('![', `](${url})`, 'deskripsi gambar');
      break;
    }
    default: break;
  }
  ta.focus();
  ta.dispatchEvent(new Event('input', { bubbles: true }));
}
