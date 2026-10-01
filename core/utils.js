// SimpleBlog — utilitas umum (tanpa dependensi DOM, aman dipakai di Node untuk testing)

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export function slugify(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Konversi Firestore Timestamp / Date / number / string menjadi Date (atau null). */
export function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const MONTHS = {
  id: ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};
const DAYS = {
  id: ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};

/**
 * Format tanggal dengan token: YYYY, MMMM, MMM, MM, M, DD, D, dddd, HH, mm.
 * Contoh: formatDate(date, 'D MMMM YYYY') -> "1 Oktober 2026"
 */
export function formatDate(value, fmt = 'D MMMM YYYY', locale = 'id') {
  const d = toDate(value);
  if (!d) return '';
  const months = MONTHS[locale] || MONTHS.id;
  const days = DAYS[locale] || DAYS.id;
  const pad = (n) => String(n).padStart(2, '0');
  const map = {
    YYYY: d.getFullYear(),
    MMMM: months[d.getMonth()],
    MMM: months[d.getMonth()].slice(0, 3),
    MM: pad(d.getMonth() + 1),
    M: d.getMonth() + 1,
    dddd: days[d.getDay()],
    DD: pad(d.getDate()),
    D: d.getDate(),
    HH: pad(d.getHours()),
    mm: pad(d.getMinutes()),
  };
  return String(fmt).replace(/YYYY|MMMM|MMM|MM|M|dddd|DD|D|HH|mm/g, (t) => map[t]);
}

export function timeAgo(value, locale = 'id') {
  const d = toDate(value);
  if (!d) return '';
  const sec = Math.round((Date.now() - d.getTime()) / 1000);
  const units = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  for (const [unit, s] of units) {
    if (Math.abs(sec) >= s) return rtf.format(-Math.round(sec / s), unit);
  }
  return rtf.format(-sec, 'second');
}

export function stripHtml(html) {
  return String(html ?? '')
    .replace(/<\/?(p|div|h[1-6]|li|ul|ol|blockquote|pre|br|hr|tr|td|th|figure|section)\b[^>]*>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function truncate(text, length = 100, suffix = '…') {
  const s = String(text ?? '');
  if (s.length <= length) return s;
  return s.slice(0, length).replace(/\s+\S*$/, '') + suffix;
}

export function readingTime(text, wpm = 200) {
  const words = stripHtml(text).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / wpm));
}

export function debounce(fn, ms = 250) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/** Bungkus promise dengan timeout supaya koneksi yang menggantung tidak menunggu selamanya. */
export function withTimeout(promise, ms, message = 'Waktu habis') {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms); }),
  ]).finally(() => clearTimeout(timer));
}
