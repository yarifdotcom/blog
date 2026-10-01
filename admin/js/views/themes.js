// Admin › Tampilan › Tema: daftar tema terpasang, aktifkan, pratinjau.

import * as store from '../../../core/store.js';
import { resolveTheme, resolveOptions } from '../../../core/theme.js';
import { html, $, loading, toast, busy } from '../ui.js';

async function loadThemes() {
  const res = await fetch('../themes/index.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error('themes/index.json tidak ditemukan');
  const list = await res.json();
  return Promise.all(list.map(async (t) => {
    try {
      return { ...t, manifest: await resolveTheme(t.id, '../themes/') };
    } catch (err) {
      return { ...t, error: err.message };
    }
  }));
}

export async function render({ el, app }) {
  el.innerHTML = String(loading());
  const [settings, themes] = await Promise.all([store.getSettings(), loadThemes()]);
  const active = settings.theme || 'default';
  themes.sort((a, b) => (b.id === active) - (a.id === active));

  const thumb = (t) => {
    if (t.manifest?.screenshot) return html`<img src="${t.manifest.screenshot}" alt="">`;
    // Tanpa screenshot: sketsa sederhana berwarna aksen tema.
    const o = resolveOptions(t.manifest?.options, settings.themeOptions?.[t.id]);
    const side = o.sidebar && o.sidebar !== 'none';
    return html`<div class="theme-sketch ${o.sidebar === 'left' ? 'left' : ''} ${o.headerStyle === 'plain' ? 'plain' : 'band'}" style="--c:${o.accent || '#2563eb'}">
      <i class="bar"></i><div class="body"><div class="main"><i></i><i></i><i></i></div>${side ? html`<div class="side"><i></i><i></i></div>` : ''}</div></div>`;
  };

  el.innerHTML = String(html`
    <p class="muted">Tema mengatur tampilan situs publik. Tema baru ditambahkan sebagai folder di <code>themes/</code>
      lalu didaftarkan di <code>themes/index.json</code> — lihat <code>docs/05-membuat-tema.md</code>.</p>
    <div class="theme-grid">
      ${themes.map((t) => html`
        <div class="theme-card ${t.id === active ? 'is-active' : ''}">
          <div class="theme-thumb">${thumb(t)}</div>
          <div class="theme-info">
            <div class="theme-title">
              <b>${t.manifest?.name || t.name || t.id}</b>
              ${t.id === active ? html`<span class="badge badge-green">Aktif</span>` : ''}
              ${t.manifest?.version ? html`<small class="muted">v${t.manifest.version}</small>` : ''}
            </div>
            <p class="muted small">${t.error ? html`<span class="text-red">${t.error}</span>` : (t.manifest?.description || t.description || '')}</p>
            ${t.manifest?.extends ? html`<p class="small">Turunan dari <code>${t.manifest.extends}</code></p>` : ''}
            <p class="small muted">${t.manifest ? `${Object.keys(t.manifest.files).length} file · ${t.manifest.options.length} opsi kustomisasi` : ''}</p>
            <div class="actions">
              ${t.id === active
                ? html`<a class="btn btn-sm btn-primary" href="#/appearance/customize">Kustomisasi</a>
                       <a class="btn btn-sm" href="#/appearance/editor">Edit template</a>`
                : html`<button class="btn btn-sm btn-primary" data-activate="${t.id}" ${t.error ? 'disabled' : ''}>Aktifkan</button>
                       <a class="btn btn-sm" href="../?theme=${t.id}" target="_blank">Pratinjau ↗</a>`}
            </div>
          </div>
        </div>`)}
    </div>`);

  // Listener di grid (bukan el) supaya tidak menumpuk saat render ulang.
  $('.theme-grid', el).addEventListener('click', (e) => {
    const btn = e.target.closest('[data-activate]');
    if (!btn) return;
    busy(btn, async () => {
      try {
        await store.saveSettings({ theme: btn.dataset.activate });
        toast(`Tema "${btn.dataset.activate}" diaktifkan.`, 'success');
        render({ el, app });
      } catch (err) {
        toast('Gagal: ' + err.message, 'error');
      }
    });
  });
}
