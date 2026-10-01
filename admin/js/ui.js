// SimpleBlog Admin — helper UI kecil.

import { escapeHtml, formatDate } from '../../core/utils.js';

export class Raw {
  constructor(v) { this.v = String(v ?? ''); }
  toString() { return this.v; }
}
export const raw = (v) => new Raw(v);

function fmt(v) {
  if (v == null || v === false) return '';
  if (v instanceof Raw) return v.v;
  if (Array.isArray(v)) return v.map(fmt).join('');
  return escapeHtml(v);
}

/** Tagged template: nilai interpolasi otomatis di-escape kecuali dibungkus raw(). */
export function html(strings, ...values) {
  return raw(strings.reduce((acc, s, i) => acc + s + (i < values.length ? fmt(values[i]) : ''), ''));
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function toast(message, type = 'info', ms = 3500) {
  const box = document.getElementById('toasts');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = message;
  box.appendChild(t);
  setTimeout(() => { t.classList.add('hide'); setTimeout(() => t.remove(), 300); }, ms);
}

export function confirmAction(message) {
  return window.confirm(message);
}

/** Ambil nilai form menjadi objek. Checkbox -> boolean, number -> Number. */
export function readForm(form) {
  const out = {};
  for (const elx of form.elements) {
    if (!elx.name || elx.disabled) continue;
    if (elx.type === 'checkbox') {
      if (elx.dataset.multi !== undefined) {
        out[elx.name] = out[elx.name] || [];
        if (elx.checked) out[elx.name].push(elx.value);
      } else out[elx.name] = elx.checked;
    } else if (elx.type === 'number') out[elx.name] = elx.value === '' ? null : Number(elx.value);
    else if (elx.type === 'radio') { if (elx.checked) out[elx.name] = elx.value; }
    else out[elx.name] = elx.value;
  }
  return out;
}

/** Jalankan aksi async dengan tombol dalam status loading. */
export async function busy(button, fn) {
  const label = button?.innerHTML;
  if (button) { button.disabled = true; button.innerHTML = '<span class="spin"></span> Memproses…'; }
  try {
    return await fn();
  } finally {
    if (button) { button.disabled = false; button.innerHTML = label; }
  }
}

export function statusBadge(status) {
  const map = {
    published: ['Terbit', 'green'], draft: ['Draf', 'gray'], scheduled: ['Terjadwal', 'blue'],
    approved: ['Disetujui', 'green'], pending: ['Menunggu', 'amber'], spam: ['Spam', 'red'],
  };
  const [label, color] = map[status] || [status, 'gray'];
  return html`<span class="badge badge-${color}">${label}</span>`;
}

export const fmtDate = (v) => formatDate(v, 'D MMM YYYY, HH:mm');

export function loading(text = 'Memuat…') {
  return html`<div class="loading"><span class="spin"></span> ${text}</div>`;
}

export function errorBox(err) {
  return html`<div class="alert alert-error"><strong>Terjadi kesalahan:</strong> ${err?.message || err}</div>`;
}
