// Admin › Dasbor

import * as store from '../../../core/store.js';
import { html, loading, statusBadge, fmtDate } from '../ui.js';

export async function render({ el }) {
  el.innerHTML = String(loading());
  const [posts, comments, categories, tags, settings] = await Promise.all([
    store.listPosts(), store.listComments(), store.listTerms('categories'), store.listTerms('tags'), store.getSettings(),
  ]);

  const count = (arr, status) => arr.filter((x) => x.status === status).length;
  const pending = comments.filter((c) => c.status === 'pending');

  el.innerHTML = String(html`
    <div class="welcome card">
      <div>
        <h2>${settings.title}</h2>
        <p class="muted">${settings.tagline || 'Selamat datang di panel admin.'}</p>
      </div>
      <a class="btn btn-primary" href="#/posts/new">＋ Tulis Post</a>
    </div>

    <div class="stats">
      <a class="stat" href="#/posts"><b>${count(posts, 'published')}</b><span>Post terbit</span></a>
      <a class="stat" href="#/posts?status=draft"><b>${count(posts, 'draft')}</b><span>Draf</span></a>
      <a class="stat" href="#/comments"><b>${pending.length}</b><span>Komentar menunggu</span></a>
      <a class="stat" href="#/categories"><b>${categories.length}</b><span>Kategori</span></a>
      <a class="stat" href="#/tags"><b>${tags.length}</b><span>Tag</span></a>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-head"><h2 class="card-title">Post terbaru</h2><a href="#/posts">Semua →</a></div>
        ${posts.length ? html`<ul class="list">
          ${posts.slice(0, 6).map((p) => html`<li>
            <a href="#/posts/edit/${p.id}">${p.title || '(tanpa judul)'}</a>
            <span>${statusBadge(p.status)} <small class="muted">${fmtDate(p.publishedAt || p.createdAt)}</small></span>
          </li>`)}
        </ul>` : html`<p class="muted">Belum ada post. <a href="#/posts/new">Tulis yang pertama</a>.</p>`}
      </div>
      <div class="card">
        <div class="card-head"><h2 class="card-title">Komentar menunggu moderasi</h2><a href="#/comments">Kelola →</a></div>
        ${pending.length ? html`<ul class="list">
          ${pending.slice(0, 6).map((c) => html`<li class="col">
            <span><b>${c.name}</b> <small class="muted">pada ${c.postTitle}</small></span>
            <small class="muted clamp">${c.content}</small>
          </li>`)}
        </ul>` : html`<p class="muted">Tidak ada komentar yang menunggu.</p>`}
      </div>
    </div>`);
}
