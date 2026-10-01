// Admin › Semua Pos (tab status, filter, cari, aksi cepat & aksi massal)

import * as store from '../../../core/store.js';
import { toDate } from '../../../core/utils.js';
import { html, $, $$, loading, statusBadge, fmtDate, toast, confirmAction } from '../ui.js';

const effectiveStatus = (p) =>
  (p.status === 'published' && toDate(p.publishedAt) > new Date() ? 'scheduled' : p.status);

const TABS = [['all', 'Semua'], ['published', 'Terbit'], ['scheduled', 'Terjadwal'], ['draft', 'Draf']];

export async function render({ el, query, app }) {
  el.innerHTML = String(loading());
  const [posts, categories, comments] = await Promise.all([
    store.listPosts(), store.listTerms('categories'), store.listComments(),
  ]);
  const catName = Object.fromEntries(categories.map((c) => [c.id, c.name]));
  const commentCount = {};
  comments.forEach((c) => { commentCount[c.postId] = (commentCount[c.postId] || 0) + 1; });
  const filter = { status: query.status || 'all', q: '', cat: query.category || '' };
  const selected = new Set();

  el.innerHTML = String(html`
    <div class="toolbar">
      <div class="tabs" id="status-tabs"></div>
      <a class="btn btn-primary" href="#/posts/new">＋ Tambah Baru</a>
    </div>
    <div class="toolbar">
      <div class="toolbar-right">
        <select id="bulk">
          <option value="">Aksi massal…</option>
          <option value="published">Terbitkan</option>
          <option value="draft">Jadikan draf</option>
          <option value="delete">Hapus permanen</option>
        </select>
        <button class="btn" id="bulk-apply">Terapkan</button>
      </div>
      <div class="toolbar-right">
        <select id="cat-filter">
          <option value="">Semua kategori</option>
          ${categories.map((c) => html`<option value="${c.id}" ${c.id === filter.cat ? 'selected' : ''}>${c.name}</option>`)}
        </select>
        <input type="search" id="search" placeholder="Cari pos…">
      </div>
    </div>
    <div class="card no-pad">
      <table class="table">
        <thead><tr>
          <th class="w-check"><input type="checkbox" id="check-all"></th>
          <th>Judul</th><th>Penulis</th><th>Kategori</th><th class="right">💬</th><th>Tanggal</th>
        </tr></thead>
        <tbody id="rows"></tbody>
      </table>
    </div>`);

  const visible = () => {
    const q = filter.q.toLowerCase();
    return posts.filter((p) =>
      (filter.status === 'all' || effectiveStatus(p) === filter.status)
      && (!filter.cat || p.categoryIds?.includes(filter.cat))
      && (!q || (p.title || '').toLowerCase().includes(q)));
  };

  const draw = () => {
    $('#status-tabs', el).innerHTML = String(html`${TABS.map(([k, label]) => html`
      <button class="tab ${k === filter.status ? 'active' : ''}" data-status="${k}">${label}
        <span class="muted">(${k === 'all' ? posts.length : posts.filter((p) => effectiveStatus(p) === k).length})</span></button>`)}`);
    const rows = visible();
    $('#check-all', el).checked = rows.length > 0 && rows.every((p) => selected.has(p.id));
    $('#rows', el).innerHTML = rows.length ? String(html`${rows.map((p) => {
      const st = effectiveStatus(p);
      return html`
      <tr>
        <td class="w-check"><input type="checkbox" data-select="${p.id}" ${selected.has(p.id) ? 'checked' : ''}></td>
        <td>
          <a class="row-title" href="#/posts/edit/${p.id}">${p.title || '(tanpa judul)'}</a>
          ${st !== 'published' ? html` — ${statusBadge(st)}` : ''}
          <div class="row-actions">
            <a href="#/posts/edit/${p.id}">Edit</a>
            ${p.status === 'published'
              ? html`<button data-act="draft" data-id="${p.id}">Jadikan draf</button>`
              : html`<button data-act="published" data-id="${p.id}">Terbitkan</button>`}
            ${p.status === 'published' ? html`<a href="../#/post/${p.slug}" target="_blank">Lihat</a>` : ''}
            <button class="text-red" data-act="delete" data-id="${p.id}">Hapus</button>
          </div>
        </td>
        <td class="small">${p.authorName || '—'}</td>
        <td class="small">${(p.categoryIds || []).map((id) => catName[id]).filter(Boolean).join(', ') || '—'}</td>
        <td class="right small">${commentCount[p.id] ? html`<a href="#/comments">${commentCount[p.id]}</a>` : '—'}</td>
        <td class="nowrap small">${st === 'published' ? 'Terbit' : st === 'scheduled' ? 'Terjadwal' : 'Diubah'}<br>
          <span class="muted">${fmtDate(st === 'draft' ? (p.updatedAt || p.createdAt) : p.publishedAt)}</span></td>
      </tr>`;
    })}`) : '<tr><td colspan="6" class="empty">Tidak ada pos.</td></tr>';
  };
  draw();

  async function apply(action, ids) {
    let done = 0;
    try {
      for (const id of ids) {
        const post = posts.find((p) => p.id === id);
        if (!post) continue;
        if (action === 'delete') {
          await store.deletePost(id);
          posts.splice(posts.indexOf(post), 1);
        } else {
          Object.assign(post, await store.setPostStatus(post, action), { status: action });
          if (action === 'published' && !toDate(post.publishedAt)) post.publishedAt = new Date();
        }
        selected.delete(id);
        done++;
      }
      const verb = { delete: 'dihapus', published: 'diterbitkan', draft: 'dijadikan draf' }[action];
      toast(`${done} pos ${verb}.`, 'success');
    } catch (err) {
      toast('Gagal: ' + err.message, 'error');
    }
    draw();
    if (action === 'delete') app.refreshPendingCount();
  }

  $('#status-tabs', el).addEventListener('click', (e) => {
    const t = e.target.closest('[data-status]');
    if (t) { filter.status = t.dataset.status; selected.clear(); draw(); }
  });
  $('#search', el).addEventListener('input', (e) => { filter.q = e.target.value; draw(); });
  $('#cat-filter', el).addEventListener('change', (e) => { filter.cat = e.target.value; draw(); });

  $('#rows', el).addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const post = posts.find((p) => p.id === btn.dataset.id);
    if (btn.dataset.act === 'delete' && !confirmAction(`Hapus pos "${post.title}" beserta komentarnya? Tidak bisa dibatalkan.`)) return;
    apply(btn.dataset.act, [btn.dataset.id]);
  });
  $('#rows', el).addEventListener('change', (e) => {
    const id = e.target.dataset.select;
    if (id) e.target.checked ? selected.add(id) : selected.delete(id);
  });
  $('#check-all', el).addEventListener('change', (e) => {
    visible().forEach((p) => (e.target.checked ? selected.add(p.id) : selected.delete(p.id)));
    $$('[data-select]', el).forEach((cb) => { cb.checked = e.target.checked; });
  });
  $('#bulk-apply', el).addEventListener('click', () => {
    const action = $('#bulk', el).value;
    if (!action) return toast('Pilih aksi terlebih dahulu.');
    if (!selected.size) return toast('Centang pos terlebih dahulu.');
    if (action === 'delete' && !confirmAction(`Hapus ${selected.size} pos beserta komentarnya?`)) return;
    apply(action, [...selected]);
  });
}
