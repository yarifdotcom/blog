// Admin › Kategori & Tag (satu view generik untuk kedua taksonomi)

import * as store from '../../../core/store.js';
import { slugify } from '../../../core/utils.js';
import { html, $, loading, toast, busy, readForm, confirmAction } from '../ui.js';

const LABELS = {
  categories: { one: 'Kategori', publicPath: 'category' },
  tags: { one: 'Tag', publicPath: 'tag' },
};

export async function render({ el, type }) {
  const L = LABELS[type];
  el.innerHTML = String(loading());
  const [terms, posts] = await Promise.all([store.listTerms(type), store.listPosts()]);
  const field = store.TAXONOMY_FIELD[type];
  const countOf = (id) => posts.filter((p) => p[field]?.includes(id)).length;
  let editing = null;

  el.innerHTML = String(html`
    <div class="grid-side">
      <form class="card" id="term-form" autocomplete="off">
        <h2 class="card-title" id="form-title">Tambah ${L.one}</h2>
        <div class="field">
          <label for="name">Nama</label>
          <input id="name" name="name" required>
        </div>
        <div class="field">
          <label for="slug">Slug</label>
          <input id="slug" name="slug" placeholder="otomatis" spellcheck="false">
        </div>
        <div class="field">
          <label for="description">Deskripsi</label>
          <textarea id="description" name="description" rows="3"></textarea>
        </div>
        <div class="actions">
          <button class="btn btn-primary" type="submit" id="submit-btn">Tambah</button>
          <button class="btn btn-ghost" type="button" id="cancel-btn" hidden>Batal</button>
        </div>
      </form>
      <div class="card no-pad">
        <table class="table">
          <thead><tr><th>Nama</th><th>Slug</th><th class="right">Post</th><th></th></tr></thead>
          <tbody id="rows"></tbody>
        </table>
      </div>
    </div>`);

  const form = $('#term-form', el);
  const draw = () => {
    $('#rows', el).innerHTML = terms.length ? String(html`${terms.map((t) => html`
      <tr>
        <td><b>${t.name}</b>${t.description ? html`<div class="muted small clamp">${t.description}</div>` : ''}</td>
        <td><code>${t.slug}</code></td>
        <td class="right">${type === 'categories' && countOf(t.id) ? html`<a href="#/posts?category=${t.id}">${countOf(t.id)}</a>` : countOf(t.id)}</td>
        <td class="nowrap right">
          <a class="btn btn-sm btn-ghost" href="../#/${L.publicPath}/${t.slug}" target="_blank">Lihat</a>
          <button class="btn btn-sm" data-edit="${t.id}">Edit</button>
          <button class="btn btn-sm btn-ghost text-red" data-delete="${t.id}">Hapus</button>
        </td>
      </tr>`)}`) : `<tr><td colspan="4" class="empty">Belum ada ${L.one.toLowerCase()}.</td></tr>`;
  };
  draw();

  const setEditing = (term) => {
    editing = term;
    form.reset();
    if (term) {
      form.elements.name.value = term.name;
      form.elements.slug.value = term.slug;
      form.elements.description.value = term.description || '';
    }
    $('#form-title', el).textContent = term ? `Edit ${L.one}` : `Tambah ${L.one}`;
    $('#submit-btn', el).textContent = term ? 'Simpan' : 'Tambah';
    $('#cancel-btn', el).hidden = !term;
    form.elements.name.focus();
  };

  $('#cancel-btn', el).addEventListener('click', () => setEditing(null));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    busy($('#submit-btn', el), async () => {
      const data = readForm(form);
      const slug = slugify(data.slug || data.name);
      if (terms.some((t) => t.slug === slug && t.id !== editing?.id)) {
        return toast(`Slug "${slug}" sudah dipakai.`, 'error');
      }
      try {
        const id = await store.saveTerm(type, editing?.id, data);
        const saved = { id, name: data.name.trim(), slug, description: data.description.trim() };
        if (editing) terms[terms.indexOf(editing)] = saved;
        else terms.push(saved);
        terms.sort((a, b) => a.name.localeCompare(b.name));
        toast(`${L.one} disimpan.`, 'success');
        setEditing(null);
        draw();
      } catch (err) {
        toast('Gagal menyimpan: ' + err.message, 'error');
      }
    });
  });

  $('#rows', el).addEventListener('click', async (e) => {
    const editId = e.target.closest('[data-edit]')?.dataset.edit;
    const delId = e.target.closest('[data-delete]')?.dataset.delete;
    if (editId) setEditing(terms.find((t) => t.id === editId));
    if (delId) {
      const term = terms.find((t) => t.id === delId);
      const used = countOf(delId);
      const msg = `Hapus ${L.one.toLowerCase()} "${term.name}"?` + (used ? ` Akan dilepas dari ${used} post.` : '');
      if (!confirmAction(msg)) return;
      try {
        await store.deleteTerm(type, delId);
        terms.splice(terms.indexOf(term), 1);
        posts.forEach((p) => { if (p[field]) p[field] = p[field].filter((x) => x !== delId); });
        if (editing?.id === delId) setEditing(null);
        draw();
        toast(`${L.one} dihapus.`, 'success');
      } catch (err) {
        toast('Gagal menghapus: ' + err.message, 'error');
      }
    }
  });
}
