// SimpleBlog Admin — datetime picker ringan (tanpa library).
// Menggantikan <input type="datetime-local"> yang formatnya mengikuti locale browser dan
// menganggap nilai tidak valid bila jam belum diisi.
//
// Pemakaian:
//   <div class="dtp" data-name="publishedAt" data-value="2026-10-01T09:30"></div>
//   createDateTimePicker(el, { onChange })
// Nilai disimpan di <input type="hidden" name="..."> dengan format "YYYY-MM-DDTHH:mm" (waktu lokal),
// atau string kosong.

import { formatDate } from '../../core/utils.js';
import { html } from './ui.js';

const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const pad = (n) => String(n).padStart(2, '0');
const toValue = (d) => (d ? formatDate(d, 'YYYY-MM-DDTHH:mm') : '');

function parseValue(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(v || '');
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : null;
}

const sameDay = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export function createDateTimePicker(root, { onChange } = {}) {
  let value = parseValue(root.dataset.value);
  let view = new Date((value || new Date()).getFullYear(), (value || new Date()).getMonth(), 1);

  root.innerHTML = String(html`
    <input type="hidden" name="${root.dataset.name}">
    <div class="dtp-field">
      <button type="button" class="dtp-display" aria-haspopup="dialog"></button>
      <button type="button" class="dtp-clear" title="Kosongkan" aria-label="Kosongkan">×</button>
    </div>
    <div class="dtp-pop" role="dialog" aria-label="Pilih tanggal & jam" hidden>
      <div class="dtp-head">
        <button type="button" class="dtp-nav" data-nav="-1" aria-label="Bulan sebelumnya">‹</button>
        <strong class="dtp-title"></strong>
        <button type="button" class="dtp-nav" data-nav="1" aria-label="Bulan berikutnya">›</button>
      </div>
      <div class="dtp-grid dtp-days">${DAYS.map((d) => html`<span>${d}</span>`)}</div>
      <div class="dtp-grid dtp-dates"></div>
      <div class="dtp-time">
        <span>Jam</span>
        <select class="dtp-hour" aria-label="Jam">${Array.from({ length: 24 }, (_, h) => html`<option value="${h}">${pad(h)}</option>`)}</select>
        <b>:</b>
        <select class="dtp-minute" aria-label="Menit">${Array.from({ length: 60 }, (_, m) => html`<option value="${m}">${pad(m)}</option>`)}</select>
      </div>
      <div class="dtp-foot">
        <button type="button" class="btn btn-sm btn-ghost" data-act="now">Sekarang</button>
        <button type="button" class="btn btn-sm btn-ghost" data-act="clear">Kosongkan</button>
        <button type="button" class="btn btn-sm btn-primary" data-act="done">Selesai</button>
      </div>
    </div>`);

  const $ = (s) => root.querySelector(s);
  const hidden = $('input[type=hidden]');
  const display = $('.dtp-display');
  const pop = $('.dtp-pop');
  const hour = $('.dtp-hour');
  const minute = $('.dtp-minute');

  function sync(fire = true) {
    hidden.value = toValue(value);
    display.textContent = value ? formatDate(value, 'D MMM YYYY · HH:mm') : 'Saat diterbitkan (sekarang)';
    display.classList.toggle('is-empty', !value);
    $('.dtp-clear').hidden = !value;
    if (fire) onChange?.(value);
  }

  function drawCalendar() {
    $('.dtp-title').textContent = formatDate(view, 'MMMM YYYY');
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    const today = new Date();
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const cls = [
        d.getMonth() !== view.getMonth() ? 'out' : '',
        sameDay(d, today) ? 'today' : '',
        sameDay(d, value) ? 'selected' : '',
      ].filter(Boolean).join(' ');
      cells.push(html`<button type="button" class="${cls}" data-date="${d.getFullYear()}-${d.getMonth()}-${d.getDate()}">${d.getDate()}</button>`);
    }
    $('.dtp-dates').innerHTML = String(html`${cells}`);
    const ref = value || today;
    hour.value = ref.getHours();
    minute.value = ref.getMinutes();
  }

  const open = () => {
    view = new Date((value || new Date()).getFullYear(), (value || new Date()).getMonth(), 1);
    drawCalendar();
    pop.hidden = false;
    display.setAttribute('aria-expanded', 'true');
  };
  const close = () => {
    pop.hidden = true;
    display.setAttribute('aria-expanded', 'false');
  };

  display.addEventListener('click', () => (pop.hidden ? open() : close()));
  $('.dtp-clear').addEventListener('click', () => { value = null; sync(); close(); });

  pop.addEventListener('click', (e) => {
    const nav = e.target.closest('[data-nav]');
    if (nav) {
      view = new Date(view.getFullYear(), view.getMonth() + Number(nav.dataset.nav), 1);
      drawCalendar();
      return;
    }
    const day = e.target.closest('[data-date]');
    if (day) {
      const [y, m, d] = day.dataset.date.split('-').map(Number);
      value = new Date(y, m, d, Number(hour.value), Number(minute.value));
      if (m !== view.getMonth()) view = new Date(y, m, 1);
      drawCalendar();
      sync();
      return;
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'now') { value = new Date(); value.setSeconds(0, 0); view = new Date(value.getFullYear(), value.getMonth(), 1); drawCalendar(); sync(); }
    if (act === 'clear') { value = null; drawCalendar(); sync(); close(); }
    if (act === 'done') close();
  });

  // Ubah jam/menit: bila tanggal belum dipilih, pakai hari ini.
  const onTime = () => {
    const base = value || new Date();
    value = new Date(base.getFullYear(), base.getMonth(), base.getDate(), Number(hour.value), Number(minute.value));
    drawCalendar();
    sync();
  };
  hour.addEventListener('change', onTime);
  minute.addEventListener('change', onTime);

  // Tutup saat klik di luar atau tekan Escape.
  const onOutside = (e) => {
    if (!root.isConnected) { document.removeEventListener('mousedown', onOutside); return; }
    if (!pop.hidden && !root.contains(e.target)) close();
  };
  document.addEventListener('mousedown', onOutside);
  root.addEventListener('keydown', (e) => { if (e.key === 'Escape') { close(); display.focus(); } });

  sync(false);
  return {
    get value() { return value; },
    set value(d) { value = d; sync(false); },
  };
}
