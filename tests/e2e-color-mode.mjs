// SimpleBlog — tes E2E saklar mode terang/gelap (admin, situs, sinkron antar-tab, iframe pratinjau,
// persistensi, saklar mengambang, ponsel). Prasyarat: `npm run emulators` & `npm run serve`.
// PERINGATAN: menghapus semua data emulator. Screenshot → tests/screenshots/.

import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:8765';
const SHOTS = new URL('./screenshots/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });
await fetch('http://127.0.0.1:8080/emulator/v1/projects/demo-simpleblog/databases/(default)/documents', { method: 'DELETE' });
await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-simpleblog/accounts', { method: 'DELETE' });
const errors = [];
const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--disable-features=BackForwardCache'], protocolTimeout: 30000 });
const page = async (w = 1280, h = 800) => {
  const p = await b.newPage(); await p.setViewport({ width: w, height: h });
  await p.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/status of 400/.test(m.text())) errors.push(m.text()); });
  return p;
};
const log = (...a) => console.log('•', ...a);
const state = (p) => p.evaluate(() => ({
  theme: document.documentElement.dataset.theme,
  bg: getComputedStyle(document.body).backgroundColor,
  switch: document.querySelector('[data-mode-toggle]')?.getAttribute('aria-checked'),
}));
const a = await page(1440, 860);
await a.goto(BASE + '/admin/');
await a.evaluate(() => { localStorage.clear(); localStorage.setItem('simpleblog.emulator', '127.0.0.1'); localStorage.setItem('simpleblog.firebaseConfig', JSON.stringify({ apiKey: 'fake-api-key', authDomain: 'demo-simpleblog.firebaseapp.com', projectId: 'demo-simpleblog' })); });
await a.goto(BASE + '/admin/index.html#/login'); await a.waitForSelector('#login-form');
log('Admin awal (sistem terang):', JSON.stringify(await state(a)));
await a.screenshot({ path: SHOTS + 'mode-login-light.png' });
await a.type('#username', 'admin'); await a.type('#password', '123'); await a.click('#login-form [type=submit]');
await a.waitForFunction(() => document.querySelector('#page-title').innerText === 'Dasbor', { timeout: 30000 });
await a.evaluate(async () => { const st = await import('/core/store.js'); await st.seedDemo(); });

// Tab publik terbuka bersamaan → harus ikut berubah (event storage)
const pub = await page();
await pub.goto(BASE + '/'); await pub.waitForSelector('.post-card');
log('Publik awal:', JSON.stringify(await state(pub)), '| saklar di header:', await pub.$eval('.masthead [data-mode-toggle]', (e) => e.className));
await pub.screenshot({ path: SHOTS + 'mode-public-light.png' });

await a.bringToFront(); await a.click('.topbar [data-mode-toggle]');
await a.waitForFunction(() => document.documentElement.dataset.theme === 'dark', { polling: 100, timeout: 5000 });
log('Admin setelah klik:', JSON.stringify(await state(a)), '| title:', await a.$eval('.topbar [data-mode-toggle]', (e) => e.title));
await pub.waitForFunction(() => document.documentElement.dataset.theme === 'dark', { timeout: 5000, polling: 100 });
log('Publik ikut gelap (sinkron antar-tab):', JSON.stringify(await state(pub)));
await a.screenshot({ path: SHOTS + 'mode-admin-dark.png' });
await pub.screenshot({ path: SHOTS + 'mode-public-dark.png' });

// Klik di situs → admin ikut terang
await pub.bringToFront(); await pub.click('.masthead [data-mode-toggle]');
await a.waitForFunction(() => document.documentElement.dataset.theme === 'light', { timeout: 5000, polling: 100 });
log('Klik di situs → admin ikut:', (await state(a)).theme, '| situs:', (await state(pub)).theme);
await pub.close();

// Persisten setelah reload & mengalahkan setelan sistem
await a.bringToFront(); await a.click('.topbar [data-mode-toggle]');
await a.bringToFront(); await a.reload(); await a.waitForSelector('.stats');
log('Setelah reload (sistem tetap terang):', (await state(a)).theme);

// Iframe pratinjau Kustomisasi ikut
await a.bringToFront(); await a.goto(BASE + '/admin/#/appearance/customize');
await a.waitForFunction(() => document.querySelector('.preview-frame')?.contentDocument?.querySelector('.post-card'), { timeout: 20000 });
const fr = await (await a.$('.preview-frame')).contentFrame();
log('Iframe pratinjau:', await fr.evaluate(() => document.documentElement.dataset.theme));
await a.bringToFront(); await a.click('.topbar [data-mode-toggle]');
await fr.waitForFunction(() => document.documentElement.dataset.theme === 'light', { timeout: 5000, polling: 100 });
log('Iframe ikut setelah klik di admin:', await fr.evaluate(() => document.documentElement.dataset.theme));

// Tema tanpa saklar → saklar mengambang (layout override via draf pratinjau)
await a.evaluate(() => localStorage.setItem('simpleblog.preview', JSON.stringify({ theme: 'default', options: {}, files: { layout: '<main class="content">{{{ content }}}</main>' }, reset: [] })));
const pv = await page();
await pv.goto(BASE + '/?theme=default&preview=1'); await pv.waitForSelector('.post-card');
log('Tema tanpa saklar → mengambang:', await pv.$eval('[data-mode-toggle]', (e) => e.className));
await pv.bringToFront(); await pv.click('.mode-switch--floating');
log('Saklar mengambang berfungsi:', (await state(pv)).theme);
await pv.close();
await a.evaluate(() => localStorage.removeItem('simpleblog.preview'));

// Ponsel
const m = await page(390, 760); await m.bringToFront();
await m.goto(BASE + '/'); await m.waitForSelector('.post-card');
await m.screenshot({ path: SHOTS + 'mode-mobile.png' });
log('Ponsel: overflow-x =', await m.evaluate(() => document.documentElement.scrollWidth > innerWidth));
await b.close();
console.log('\nError browser:', errors.length ? errors : 'tidak ada');
process.exit(errors.length ? 1 : 0);
