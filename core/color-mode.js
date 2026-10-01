// YarifBlog — mode terang / gelap (dipakai admin & situs publik).
//
// - Mode diterapkan sebagai <html data-theme="light|dark"> (CSS memakai :root[data-theme="dark"]).
// - Bawaan mengikuti sistem (prefers-color-scheme); pilihan pengguna disimpan di localStorage
//   dan disinkronkan ke tab lain, admin ↔ situs, dan iframe pratinjau (event "storage").
// - Saklar: elemen apa pun dengan atribut [data-mode-toggle] otomatis diisi ikon matahari (terang)
//   & lampu (gelap). Gaya dasar disuntikkan paling awal di <head>; tema menimpanya lewat
//   CSS variable (--ms-track, --ms-knob, --ms-active) dengan selektor yang lebih spesifik.
//
// Supaya tidak ada kedipan warna, <head> juga memuat skrip inline kecil (lihat index.html).

export const STORAGE_KEY = 'simpleblog.colorMode';
const mql = window.matchMedia('(prefers-color-scheme: dark)');

const SUN = '<svg class="ms-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2" fill="currentColor"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/></g></svg>';
const LAMP = '<svg class="ms-lamp" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5a6.5 6.5 0 0 0-3.9 11.7c.6.5 1 1.2 1 2V17h5.8v-.8c0-.8.4-1.5 1-2A6.5 6.5 0 0 0 12 2.5z" fill="currentColor"/><path d="M9.5 19.2h5M10.3 21.5h3.4" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>';

const BASE_CSS = `
.mode-switch{--ms-track:rgba(128,128,128,.25);--ms-knob:#fff;--ms-active:#1f2328;position:relative;display:inline-flex;align-items:center;justify-content:space-between;flex:0 0 auto;box-sizing:border-box;width:58px;height:30px;min-width:0;margin:0;padding:0 8px;border:0;border-radius:999px;background:var(--ms-track);color:inherit;cursor:pointer;vertical-align:middle;font:inherit;line-height:1;text-transform:none;letter-spacing:normal;box-shadow:none;-webkit-tap-highlight-color:transparent}
.mode-switch:hover,.mode-switch:active{background:var(--ms-track);filter:brightness(1.06)}
.mode-switch svg{position:relative;z-index:1;display:block;flex:0 0 15px;width:15px;height:15px;opacity:.75;transition:color .25s,opacity .25s}
.mode-switch .ms-knob{position:absolute;top:3px;left:3px;width:24px;height:24px;border-radius:50%;background:var(--ms-knob);box-shadow:0 1px 3px rgba(0,0,0,.3);transition:transform .25s cubic-bezier(.4,.2,.2,1)}
.mode-switch[aria-checked="true"] .ms-knob{transform:translateX(28px)}
.mode-switch[aria-checked="false"] .ms-sun,.mode-switch[aria-checked="true"] .ms-lamp{color:var(--ms-active);opacity:1}
.mode-switch:focus-visible{outline:2px solid currentColor;outline-offset:2px}
.mode-switch--floating{position:fixed;right:16px;bottom:16px;z-index:60;--ms-track:#1f2328;color:#fff;box-shadow:0 2px 10px rgba(0,0,0,.25)}
@media (prefers-reduced-motion:reduce){.mode-switch .ms-knob,.mode-switch svg{transition:none}}`;

export function getPreference() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

/** Mode efektif: pilihan pengguna, atau mengikuti sistem. */
export function currentMode() {
  return getPreference() || (mql.matches ? 'dark' : 'light');
}

/** Isi & perbarui semua saklar [data-mode-toggle] di dalam root. */
export function hydrateSwitches(root = document) {
  const dark = currentMode() === 'dark';
  root.querySelectorAll('[data-mode-toggle]').forEach((btn) => {
    if (!btn.dataset.ready) {
      btn.innerHTML = `${SUN}${LAMP}<span class="ms-knob"></span>`;
      btn.classList.add('mode-switch');
      btn.setAttribute('role', 'switch');
      if (btn.tagName === 'BUTTON') btn.type = 'button';
      btn.dataset.ready = '1';
    }
    btn.setAttribute('aria-checked', String(dark));
    const label = dark ? 'Mode gelap aktif — klik untuk mode terang' : 'Mode terang aktif — klik untuk mode gelap';
    btn.setAttribute('aria-label', label);
    btn.title = label;
  });
}

export function applyMode() {
  const mode = currentMode();
  const html = document.documentElement;
  html.dataset.theme = mode;
  html.style.colorScheme = mode;
  hydrateSwitches();
  window.dispatchEvent(new CustomEvent('colormodechange', { detail: { mode } }));
}

export function setMode(mode) {
  try { localStorage.setItem(STORAGE_KEY, mode); } catch { /* mode tetap berlaku di halaman ini */ }
  applyMode();
}

export function toggleMode() {
  setMode(currentMode() === 'dark' ? 'light' : 'dark');
}

let started = false;
export function initColorMode() {
  if (started) return;
  started = true;
  if (!document.getElementById('mode-switch-base')) {
    const style = document.createElement('style');
    style.id = 'mode-switch-base';
    style.textContent = BASE_CSS;
    document.head.prepend(style); // paling awal → mudah ditimpa CSS tema/admin
  }
  applyMode();
  mql.addEventListener('change', () => { if (!getPreference()) applyMode(); });
  window.addEventListener('storage', (e) => { if (e.key === STORAGE_KEY) applyMode(); });
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-mode-toggle]')) toggleMode();
  });
}

/** Tambahkan saklar mengambang bila halaman belum punya saklar (mis. tema tanpa saklar). */
export function ensureFloatingSwitch(root = document) {
  if (root.querySelector('[data-mode-toggle]') || document.querySelector('.mode-switch--floating')) return;
  const btn = document.createElement('button');
  btn.className = 'mode-switch mode-switch--floating';
  btn.dataset.modeToggle = '';
  document.body.appendChild(btn);
  hydrateSwitches(document);
}
