// YarifBlog Admin — draf pratinjau tema.
// Draf disimpan di localStorage; iframe situs (?preview=1) menerima event "storage"
// dan merender ulang tanpa memuat ulang halaman. Draf tidak pernah memengaruhi pengunjung.
//
// Bentuk: { theme, options: {}, files: { [key]: isi }, reset: [key, ...] }

import { html } from './ui.js';

const KEY = 'simpleblog.preview';

export function readDraft(theme) {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { /* abaikan */ }
  return d && d.theme === theme ? d : { theme, options: {}, files: {}, reset: [] };
}

function write(d) {
  localStorage.setItem(KEY, JSON.stringify({ ...d, at: Date.now() }));
}

export function setDraftOptions(theme, options) {
  write({ ...readDraft(theme), options });
}

export function setDraftFile(theme, key, content) {
  const d = readDraft(theme);
  d.files = { ...d.files, [key]: content };
  d.reset = (d.reset || []).filter((k) => k !== key);
  write(d);
}

/** Pratinjau file asli (abaikan override tersimpan untuk key ini). */
export function setDraftReset(theme, key) {
  const d = readDraft(theme);
  delete d.files[key];
  d.reset = [...new Set([...(d.reset || []), key])];
  write(d);
}

export function clearDraft() {
  localStorage.removeItem(KEY);
}

export const previewUrl = (theme, hash = '#/') => `../?theme=${encodeURIComponent(theme)}&preview=1${hash}`;

/** Panel pratinjau dengan pilihan ukuran perangkat. */
export function previewPanel(theme) {
  return html`
    <div class="preview-panel">
      <div class="preview-bar">
        <div class="tabs" data-devices>
          <button type="button" class="tab active" data-device="desktop" title="Desktop">🖥</button>
          <button type="button" class="tab" data-device="tablet" title="Tablet">▭</button>
          <button type="button" class="tab" data-device="mobile" title="Ponsel">▯</button>
        </div>
        <span class="muted small">Pratinjau langsung — belum terlihat pengunjung</span>
        <button type="button" class="btn btn-sm btn-ghost" data-reload title="Muat ulang">⟳</button>
      </div>
      <div class="preview-stage"><iframe class="preview-frame" data-device="desktop" src="${previewUrl(theme)}" title="Pratinjau situs"></iframe></div>
    </div>`;
}

export function bindPreviewPanel(root) {
  const frame = root.querySelector('.preview-frame');
  root.querySelector('[data-devices]')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-device]');
    if (!b) return;
    root.querySelectorAll('[data-devices] .tab').forEach((t) => t.classList.toggle('active', t === b));
    frame.dataset.device = b.dataset.device;
  });
  root.querySelector('[data-reload]')?.addEventListener('click', () => frame.contentWindow?.location.reload());
  return frame;
}
