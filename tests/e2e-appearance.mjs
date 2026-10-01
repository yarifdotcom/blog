// YarifBlog — tes E2E modul Tampilan (Tema, Kustomisasi + palet, Editor Template, child theme).
// Prasyarat sama dengan tests/e2e.mjs: `npm run emulators` dan `npm run serve` berjalan.
// PERINGATAN: menghapus semua data emulator. Screenshot → tests/screenshots/.

import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:8765', EMU = 'http://127.0.0.1', P = 'demo-simpleblog';
const SHOTS = new URL('./screenshots/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });
await fetch(`${EMU}:8080/emulator/v1/projects/${P}/databases/(default)/documents`, { method: 'DELETE' });
await fetch(`${EMU}:9099/emulator/v1/projects/${P}/accounts`, { method: 'DELETE' });
const errors = [];
const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--disable-features=BackForwardCache'] });
const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 });
p.on('pageerror', (e) => errors.push('pageerror ' + e.message));
p.on('dialog', (d) => d.accept());
p.on('console', (m) => { if (m.type() === 'error' && !/status of 400|tidak valid, memakai/.test(m.text())) errors.push(m.text()); });
const log = (...a) => console.log('•', ...a);
const text = (s) => p.$eval(s, (e) => e.innerText);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitText = (sel, t, timeout = 15000) => p.waitForFunction((s, t) => document.querySelector(s)?.innerText.includes(t), { timeout }, sel, t);
const clearToasts = () => p.evaluate(() => { document.getElementById('toasts').innerHTML = ''; });
const frameEval = async (fn) => (await (await p.$('.preview-frame')).contentFrame()).evaluate(fn);
// Halaman publik dibuka sesaat lalu ditutup (emulator HTTP/1.1 membatasi koneksi).
const withPublic = async (fn, shot) => {
  const pub = await b.newPage(); await pub.setViewport({ width: 1280, height: 860 });
  pub.on('pageerror', (e) => errors.push('pub ' + e.message));
  await pub.goto(BASE + '/'); await pub.waitForSelector('.card', { timeout: 20000 });
  if (shot) await pub.screenshot({ path: shot });
  const r = await pub.evaluate(fn); await pub.close(); return r;
};

await p.goto(BASE + '/admin/');
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('simpleblog.emulator', '127.0.0.1'); localStorage.setItem('simpleblog.firebaseConfig', JSON.stringify({ apiKey: 'fake-api-key', authDomain: 'demo-simpleblog.firebaseapp.com', projectId: 'demo-simpleblog' })); });
await p.goto(BASE + '/admin/index.html#/login'); await p.waitForSelector('#login-form');
await p.type('#username', 'admin'); await p.type('#password', '123'); await p.click('#login-form [type=submit]');
await p.waitForFunction(() => document.querySelector('#page-title').innerText === 'Dasbor', { timeout: 30000 });
await p.evaluate(async () => { const st = await import('/core/store.js'); await st.seedDemo(); await st.saveSettings({ description: 'Catatan tentang teknologi & kehidupan.', customCss: '.site-footer{outline:3px solid lime}' }); });
log('Login & data demo OK');

log('Publik (Default baru):', JSON.stringify(await withPublic(() => ({
  masthead: document.querySelector('.masthead').className,
  bandColor: getComputedStyle(document.querySelector('.masthead')).backgroundColor,
  heroTitle: document.querySelector('.masthead-hero h1')?.innerText,
  cards: document.querySelectorAll('.post-card').length,
  sidebar: !!document.querySelector('.sidebar'),
  font: getComputedStyle(document.body).fontFamily.split(',')[0],
  customCssLast: document.head.lastElementChild.id,
}), SHOTS + 'ap-public-default.png')));

// 1. Tema
await p.goto(BASE + '/admin/#/appearance/themes'); await p.waitForSelector('.theme-card');
log('Menu Tampilan:', (await text('.menu-group.open .submenu')).replace(/\n/g, ' | '));
await p.screenshot({ path: SHOTS + 'ap-themes.png' });

// 2. Kustomisasi + palet + pratinjau langsung
await p.goto(BASE + '/admin/#/appearance/customize'); await p.waitForSelector('#opt-form');
await p.waitForFunction(() => document.querySelector('.preview-frame')?.contentDocument?.querySelector('.card'), { timeout: 20000 });
log('Grup opsi:', (await p.$$eval('.opt-group summary', (s) => s.map((x) => x.innerText))).join(', '));
log('Swatch:', (await p.$$eval('[data-swatch]', (s) => s.map((x) => x.dataset.color + (x.classList.contains('active') ? '*' : '')))).join(' '));
await p.click('[data-color="#388d80"]');
await p.waitForFunction(() => getComputedStyle(document.querySelector('.preview-frame').contentDocument.documentElement).getPropertyValue('--accent').trim() === '#388d80', { timeout: 10000 });
log('Pratinjau langsung: accent =', await frameEval(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()),
  '| swatch aktif =', await p.$eval('.swatch.active', (e) => e.dataset.color), '| status:', await text('#dirty'));
await p.select('select[name=sidebar]', 'left');
await p.$eval('select[name=fontHeading]', (e) => { e.value = e.options[1].value; e.dispatchEvent(new Event('input', { bubbles: true })); });
await p.waitForFunction(() => document.querySelector('.preview-frame').contentDocument.querySelector('.layout-sidebar-left'), { timeout: 10000 });
log('Pratinjau: kelas =', await frameEval(() => document.querySelector('.site-main').className), '| font judul =', await frameEval(() => getComputedStyle(document.querySelector('.card-title')).fontFamily.split(',')[0]));
log('Publik BELUM berubah (draf):', await withPublic(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()));
await p.screenshot({ path: SHOTS + 'ap-customize.png' });
await p.click('#save-btn'); await waitText('#toasts', 'diterbitkan'); await clearToasts();
log('Publik setelah Simpan:', JSON.stringify(await withPublic(() => ({ accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(), main: document.querySelector('.site-main').className }), SHOTS + 'ap-public-teal.png')));
// palet lain untuk screenshot
for (const c of ['#e67400', '#1d2b34']) {
  await p.click(`[data-color="${c}"]`); await sleep(600);
  await p.screenshot({ path: `${SHOTS}ap-palette-${c.slice(1)}.png` });
}

// 3. Editor template
await p.goto(BASE + '/admin/#/appearance/editor'); await p.waitForSelector('.te-file');
await p.click('[data-key="partial:post-card"]'); await p.waitForFunction(() => !document.querySelector('#code').disabled && document.querySelector('#code').value.includes('card'));
const setCode = (v) => p.$eval('#code', (e, v) => { e.value = v; e.dispatchEvent(new Event('input')); }, v);
const orig = await p.$eval('#code', (e) => e.value);
await setCode(orig + '\n{{#if title}}<b>rusak');
log('Sintaks rusak →', await text('#te-error'));
await p.click('#save-btn'); await waitText('#toasts', 'Tidak disimpan'); await clearToasts();
await setCode(orig + '\n{{ title | huruf_besar }}');
log('Filter tak dikenal →', await text('#te-error'));
await setCode(orig.replace('<div class="card-body">', '<div class="card-body"><span class="halo">HALO {{ title | upper }}</span>'));
await p.click('#preview-btn');
await p.waitForFunction(() => document.querySelector('.preview-frame')?.contentDocument?.querySelector('.halo'), { timeout: 20000 });
log('Pratinjau berisi .halo:', await frameEval(() => document.querySelector('.halo').innerText));
await p.screenshot({ path: SHOTS + 'ap-editor.png' });
await p.click('#save-btn'); await waitText('#toasts', 'Tersimpan'); await clearToasts();
log('Daftar file menandai:', await p.$eval('[data-key="partial:post-card"]', (e) => e.innerText.replace(/\s+/g, ' ')));
log('Publik setelah simpan .halo:', await withPublic(() => document.querySelector('.halo')?.innerText));
await p.click('#revert-btn'); await waitText('#toasts', 'Dikembalikan'); await clearToasts();
log('Setelah kembalikan, publik .halo:', await withPublic(() => !!document.querySelector('.halo')));

// 4. Child theme Minimal
await p.goto(BASE + '/admin/#/appearance/themes'); await p.waitForSelector('[data-activate="minimal"]');
await p.click('[data-activate="minimal"]'); await waitText('#toasts', 'diaktifkan');
log('Publik (Minimal):', JSON.stringify(await withPublic(() => ({
  masthead: document.querySelector('.masthead').className, sidebar: !!document.querySelector('.sidebar'),
  heading: document.querySelector('.list-heading')?.innerText, headingFont: getComputedStyle(document.querySelector('.card-title')).fontFamily.split(',')[0],
}), SHOTS + 'ap-public-minimal.png')));
await p.evaluate(async () => { const st = await import('/core/store.js'); await st.saveSettings({ theme: 'default' }); });

await b.close();
console.log('\nError browser:', errors.length ? errors : 'tidak ada');
process.exit(errors.length ? 1 : 0);
