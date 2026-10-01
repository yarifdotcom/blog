// Admin › Moderasi Komentar

import * as store from '../../../core/store.js';
import { html, $, $$, loading, statusBadge, fmtDate, toast, confirmAction } from '../ui.js';

const TABS = [['pending', 'Menunggu'], ['approved', 'Disetujui'], ['spam', 'Spam'], ['all', 'Semua']];

export async function render({ el, query, app }) {
  el.innerHTML = String(loading());
  const [comments, posts] = await Promise.all([store.listComments(), store.listPosts()]);
  const postSlug = Object.fromEntries(posts.map((p) => [p.id, p.slug]));
  let tab = query.status || 'pending';
  const selected = new Set();

  el.innerHTML = String(html`
    <div class="toolbar">
      <div class="tabs" id="tabs"></div>
      <div class="toolbar-right">
        <select id="bulk">
          <option value="">Aksi massal…</option>
          <option value="approved">Setujui</option>
          <option value="pending">Jadikan menunggu</option>
          <option value="spam">Tandai spam</option>
          <option value="delete">Hapus</option>
        </select>
        <button class="btn" id="bulk-apply">Terapkan</button>
      </div>
    </div>
    <div class="card no-pad">
      <table class="table">
        <thead><tr><th class="w-check"><input type="checkbox" id="check-all"></th><th>Penulis</th><th>Komentar</th><th>Pada post</th><th>Status</th><th></th></tr></thead>
        <tbody id="rows"></tbody>
      </table>
    </div>`);

  const visible = () => comments.filter((c) => tab === 'all' || c.status === tab);

  const draw = () => {
    $('#tabs', el).innerHTML = String(html`${TABS.map(([k, label]) => html`
      <button class="tab ${k === tab ? 'active' : ''}" data-tab="${k}">${label}
        <span class="muted">(${k === 'all' ? comments.length : comments.filter((c) => c.status === k).length})</span></button>`)}`);
    const rows = visible();
    $('#check-all', el).checked = rows.length > 0 && rows.every((c) => selected.has(c.id));
    $('#rows', el).innerHTML = rows.length ? String(html`${rows.map((c) => html`
      <tr>
        <td class="w-check"><input type="checkbox" data-select="${c.id}" ${selected.has(c.id) ? 'checked' : ''}></td>
        <td class="nowrap"><b>${c.name}</b>
          ${/^https?:\/\//i.test(c.website || '') ? html`<div class="small"><a href="${c.website}" target="_blank" rel="noopener nofollow">${c.website.replace(/^https?:\/\//, '')}</a></div>` : ''}
          <div class="muted small">${fmtDate(c.createdAt)}</div></td>
        <td class="comment-text">${c.content}</td>
        <td>${postSlug[c.postId] ? html`<a href="../#/post/${postSlug[c.postId]}" target="_blank">${c.postTitle}</a>` : html`<span class="muted">${c.postTitle} (dihapus)</span>`}</td>
        <td>${statusBadge(c.status)}</td>
        <td class="nowrap right">
          ${c.status !== 'approved' ? html`<button class="btn btn-sm" data-act="approved" data-id="${c.id}">Setujui</button>` : html`<button class="btn btn-sm" data-act="pending" data-id="${c.id}">Batalkan</button>`}
          ${c.status !== 'spam' ? html`<button class="btn btn-sm btn-ghost" data-act="spam" data-id="${c.id}">Spam</button>` : ''}
          <button class="btn btn-sm btn-ghost text-red" data-act="delete" data-id="${c.id}">Hapus</button>
        </td>
      </tr>`)}`) : '<tr><td colspan="6" class="empty">Tidak ada komentar.</td></tr>';
  };
  draw();

  async function apply(action, ids) {
    try {
      for (const id of ids) {
        if (action === 'delete') {
          await store.deleteComment(id);
          comments.splice(comments.findIndex((c) => c.id === id), 1);
        } else {
          await store.setCommentStatus(id, action);
          comments.find((c) => c.id === id).status = action;
        }
        selected.delete(id);
      }
      toast(`${ids.length} komentar diperbarui.`, 'success');
    } catch (err) {
      toast('Gagal: ' + err.message, 'error');
    }
    draw();
    app.refreshPendingCount();
  }

  $('#tabs', el).addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab]')?.dataset.tab;
    if (t) { tab = t; selected.clear(); draw(); }
  });

  $('#rows', el).addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (btn) {
      if (btn.dataset.act === 'delete' && !confirmAction('Hapus komentar ini?')) return;
      apply(btn.dataset.act, [btn.dataset.id]);
    }
  });
  $('#rows', el).addEventListener('change', (e) => {
    const id = e.target.dataset.select;
    if (id) e.target.checked ? selected.add(id) : selected.delete(id);
  });
  $('#check-all', el).addEventListener('change', (e) => {
    visible().forEach((c) => (e.target.checked ? selected.add(c.id) : selected.delete(c.id)));
    $$('[data-select]', el).forEach((cb) => { cb.checked = e.target.checked; });
  });
  $('#bulk-apply', el).addEventListener('click', () => {
    const action = $('#bulk', el).value;
    if (!action) return toast('Pilih aksi terlebih dahulu.');
    if (!selected.size) return toast('Pilih komentar terlebih dahulu.');
    if (action === 'delete' && !confirmAction(`Hapus ${selected.size} komentar?`)) return;
    apply(action, [...selected]);
  });
}
