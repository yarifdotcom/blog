// YarifBlog — tes end-to-end memakai Firebase Emulator + Chrome headless.
//
// Prasyarat:
//   1. npm install                       (memasang puppeteer-core & firebase-tools)
//   2. npm run emulators                 (terminal 1 — Firestore :8080, Auth :9099)
//   3. npm run serve                     (terminal 2 — http://localhost:8765)
//   4. npm run test:e2e                  (terminal 3)
// Env opsional: BASE_URL, CHROME_PATH. Screenshot disimpan di tests/screenshots/.
// PERINGATAN: tes ini MENGHAPUS semua data di emulator (bukan proyek produksi).

import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:8765';
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const SHOTS = new URL('./screenshots/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });
const EMU = 'http://127.0.0.1';
const PROJECT = 'demo-simpleblog';
const PASS = 'rahasia123', NEWPASS = 'BaruKuat2026';
const errors = [];
const log = (...a) => console.log('•', ...a);

// Reset data emulator. Admin TIDAK dibuat manual: harus dibuat otomatis dari login default.
await fetch(`${EMU}:8080/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
await fetch(`${EMU}:9099/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
await fetch(`${EMU}:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: 'other@test.dev', password: PASS, returnSecureToken: true }),
});

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1366, height: 900 });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
// 400 dari Auth emulator = percobaan login yang sengaja gagal (akun belum ada / password lama).
page.on('console', (m) => { if (m.type() === 'error' && !/status of 400/.test(m.text())) errors.push('console: ' + m.text()); });
page.on('dialog', (d) => d.type() === 'prompt' ? d.accept('https://example.com') : d.accept());
const text = (sel) => page.$eval(sel, (e) => e.innerText);
const waitText = (sel, t, timeout = 15000) => page.waitForFunction((s, t) => document.querySelector(s)?.innerText.includes(t), { timeout }, sel, t);
const shot = (n) => page.screenshot({ path: SHOTS + n + '.png', fullPage: true });

// 1. Login default admin/123 SEBELUM Firebase dikonfigurasi
await page.goto(BASE + '/admin/');
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('simpleblog.emulator', '127.0.0.1'); });
await page.goto(BASE + '/admin/index.html#/dashboard');
await page.waitForSelector('#login-form');
log('Tanpa config → halaman login, hint:', await text('.hint'));
await page.type('#password', '999');
await page.click('#login-form [type=submit]');
await waitText('#toasts', 'salah');
log('Password salah ditolak');
await page.$eval('#password', (e) => { e.value = ''; });
await page.type('#password', '123');
await page.click('#login-form [type=submit]');
await waitText('#page-title', 'Setup Firebase');
log('Login lokal admin/123 OK → Setup | menu:', (await page.$$eval('.menu a', (as) => as.filter((a) => a.offsetParent).map((a) => a.innerText.replace(/\s+/g, ' ').trim() + (getComputedStyle(a, '::after').content.includes('🔒') ? ' [terkunci]' : '')))).join(' | '));
log('Peringatan:', await text('#notice'));
await page.goto(BASE + '/admin/#/posts');
await waitText('#page-title', 'Setup Firebase');
log('Menu konten dikunci di mode lokal → kembali ke Setup');

// 2. Setup Firebase; akun admin dibuat & diklaim otomatis
await page.waitForSelector('#paste');
await page.type('#paste', 'const firebaseConfig = {\n apiKey: "fake-api-key",\n authDomain: "demo-simpleblog.firebaseapp.com",\n projectId: "demo-simpleblog",\n appId: "1:1:web:1"\n};');
await page.click('#parse-btn');
log('parsed projectId =', await page.$eval('#cfg-projectId', (e) => e.value), '| username =', await page.$eval('#username', (e) => e.value));
await page.type('#password', '123');
await page.click('#test-btn');
await waitText('#testlog', 'Selesai', 30000).catch(() => {});
log('Tes koneksi:\n' + await text('#testlog'));
await shot('01-setup');
await page.click('#save-btn');
await waitText('#page-title', 'Dasbor', 30000);
log('Simpan & Hubungkan → akun dibuat + diklaim → Dasbor | user:', await text('#userbox .email'));
log('Peringatan:', await text('#notice'));

// 3. Ganti password, logout, login ulang
await page.goto(BASE + '/admin/#/account');
await page.waitForSelector('#pw-form');
await page.type('#current', '123');
await page.type('#next', NEWPASS);
await page.type('#confirm', NEWPASS);
await page.click('#pw-btn');
await waitText('#toasts', 'berhasil diganti');
log('Password diganti | peringatan tersembunyi:', await page.$eval('#notice', (e) => e.hidden));
await page.waitForSelector('#logout-btn');
await page.click('#logout-btn');
await page.waitForSelector('#login-form');
await page.type('#username', 'admin');
await page.type('#password', '123');
await page.click('#login-form [type=submit]');
await waitText('#toasts', 'salah');
log('Login dengan 123 setelah diganti → ditolak');
await page.$eval('#password', (e) => { e.value = ''; });
await page.type('#password', NEWPASS);
await page.click('#login-form [type=submit]');
await waitText('#page-title', 'Dasbor', 20000);
log('Login dengan password baru → Dasbor');

// 4. Seed demo
await page.goto(BASE + '/admin/#/setup');
await page.waitForSelector('#seed-btn');
await page.click('#seed-btn');
await new Promise((r) => setTimeout(r, 4000));
await page.goto(BASE + '/admin/#/dashboard');
await page.waitForSelector('.stats');
log('Dasbor stats:', (await text('.stats')).replace(/\n/g, ' '));
await shot('02-dashboard');

// 3. Kategori & tag
await page.goto(BASE + '/admin/#/categories');
await page.waitForSelector('#term-form');
await page.type('#name', 'Resep Masakan');
await page.type('#description', 'Kumpulan resep.');
await page.click('#submit-btn');
await waitText('#rows', 'Resep Masakan');
log('Kategori ditambah:', (await text('#rows')).split('\n').filter(Boolean).length, 'baris');

// 4. Tulis post
await page.goto(BASE + '/admin/#/posts/new');
await page.waitForSelector('#post-form');
await page.type('input[name=title]', 'Nasi Goreng Spesial <test>');
await page.type('textarea[name=content]', '## Bahan\n\n- Nasi\n- Telur\n\nMasak dengan **api besar**.\n\n> Enak!');
await page.click('[data-md="image"]');
await page.$$eval('#cat-list input', (els) => els.forEach((e) => { if (e.parentElement.innerText.includes('Resep')) e.click(); }));
await page.type('#tags-input', 'kuliner, resep');
await page.select('#status', 'published');
// Datetime picker: pilih "Sekarang" lalu tutup
await page.click('.dtp-display');
await page.click('[data-act="now"]');
await page.click('[data-act="done"]');
log('Datetime picker:', await page.$eval('.dtp-display', (e) => e.innerText), '| nilai:', await page.$eval('input[name=publishedAt]', (e) => e.value));
await page.click('[data-mode="preview"]');
log('Preview:', (await text('.md-preview')).replace(/\n+/g, ' / '));
await shot('03-editor');
await page.click('#save-btn');
await page.waitForFunction(() => location.hash.startsWith('#/posts/edit/'), { timeout: 15000 });
await page.waitForSelector('#post-form');
log('Post tersimpan, slug =', await page.$eval('input[name=slug]', (e) => e.value));

await page.goto(BASE + '/admin/#/posts');
await page.waitForSelector('#rows tr');
log('Daftar post:', (await page.$$('#rows tr')).length, 'baris');
await shot('04-posts');

// 5. Menu ala WordPress & pengaturan per bagian
const visibleMenu = () => page.$$eval('.menu a', (as) => as.filter((x) => x.offsetParent).map((x) => x.innerText.replace(/\s+/g, ' ').trim()));
await page.goto(BASE + '/admin/#/settings');
await page.waitForSelector('#settings-form #title');
log('Menu (di Pengaturan):', (await visibleMenu()).join(' | '));
log('Tab pengaturan:', (await text('.tabs-line')).replace(/\n/g, ' '), '| judul:', await text('#page-title'));
const saveSettings = async () => {
  await page.click('#save-btn');
  await waitText('#toasts', 'Pengaturan disimpan');
  await page.evaluate(() => { document.getElementById('toasts').innerHTML = ''; });
};
await page.$eval('#title', (e) => { e.value = ''; });
await page.type('#title', 'Dapur Kode');
await saveSettings();
await page.goto(BASE + '/admin/#/settings/reading');
await page.waitForSelector('#postsPerPage');
await page.$eval('#postsPerPage', (e) => { e.value = '3'; });
await saveSettings();
await page.goto(BASE + '/admin/#/settings/writing');
await page.waitForSelector('#defaultCategoryId');
await page.$eval('#defaultCategoryId', (sel) => { sel.value = [...sel.options].find((o) => o.text === 'Resep Masakan').value; });
await saveSettings();
log('Pengaturan Umum/Membaca/Menulis tersimpan');
await page.goto(BASE + '/admin/#/posts/new');
await page.waitForSelector('#cat-list');
log('Post baru → kategori bawaan tercentang:', await page.$$eval('#cat-list input:checked', (cs) => cs.map((c) => c.parentElement.innerText.trim()).join(',')));

// Aksi massal di Semua Pos
await page.goto(BASE + '/admin/#/posts');
await page.waitForSelector('[data-select]');
const checkFirst = (n) => page.$$eval('[data-select]', (cs, n) => cs.slice(0, n).forEach((c) => c.click()), n);
await checkFirst(2);
await page.select('#bulk', 'draft');
await page.click('#bulk-apply');
await waitText('#toasts', 'dijadikan draf');
log('Aksi massal draf → tab:', (await text('#status-tabs')).replace(/\s+/g, ' '));
await checkFirst(2);
await page.select('#bulk', 'published');
await page.click('#bulk-apply');
await waitText('#toasts', 'diterbitkan');
log('Aksi massal terbit → tab:', (await text('#status-tabs')).replace(/\s+/g, ' '));

// Post dengan komentar dimatikan (untuk uji rules di akhir)
await page.evaluate(async () => {
  const st = await import('/core/store.js');
  await st.savePost(null, { title: 'Tanpa Komentar', slug: 'tanpa-komentar', content: 'x', status: 'published', allowComments: false, categoryIds: [], tagIds: [], publishedAt: new Date(Date.now() - 864e5) });
});

// 6. Publik
await page.goto(BASE + '/#/');
await page.waitForSelector('.card', { timeout: 20000 });
log('Publik title:', await page.title(), '| kartu:', (await page.$$('.post-card')).length, '| paginasi:', (await text('.pagination').catch(() => '-')).replace(/\n/g, ' '));
await shot('05-public-home');
await page.goto(BASE + '/#/post/nasi-goreng-spesial-test');
await page.waitForSelector('.post-title');
log('Post:', await text('.post-title'), '| tags:', (await text('.post-tags')).replace(/\n/g, ' '), '| meta desc:', await page.$eval('meta[name=description]', (e) => e.content));
await page.type('input[name=name]', 'Budi');
await page.type('textarea[name=content]', 'Mantap resepnya!\n<script>alert(1)</script>');
await page.click('.comment-form [type=submit]');
await waitText('[data-comment-status]', 'moderasi');
log('Komentar:', await text('[data-comment-status]'));
await shot('06-public-post');

// 7. Moderasi
await page.goto(BASE + '/admin/#/comments');
await page.waitForSelector('[data-act="approved"]');
await page.click('[data-act="approved"]');
await waitText('#toasts', 'komentar diperbarui');
log('tabs:', (await text('#tabs')).replace(/\n/g, ' '));
log('Komentar disetujui');
await page.goto(BASE + '/#/post/nasi-goreng-spesial-test');
await page.reload();
await page.waitForSelector('.comment');
log('Komentar tampil:', (await text('.comment')).replace(/\n/g, ' '));
log('XSS aman:', !(await page.$('.comment script')));

// 8. Arsip, pencarian, 404
for (const [hash, sel] of [['#/category/resep-masakan', '.page-header'], ['#/tag/kuliner', '.page-header'], ['#/search?q=firebase', '.page-header'], ['#/tidak-ada', '.not-found'], ['#/?page=2', '.pagination']]) {
  await page.goto(BASE + '/' + hash);
  await page.waitForSelector(sel);
  log(hash, '→', (await text(sel)).replace(/\n+/g, ' ').slice(0, 90));
}

// 9. Non-admin login → diarahkan ke setup
const p2 = await browser.createBrowserContext().then((c) => c.newPage());
p2.on('pageerror', (e) => errors.push('p2 pageerror: ' + e.message));
await p2.goto(BASE + '/admin/');
await p2.evaluate(() => {
  localStorage.setItem('simpleblog.emulator', '127.0.0.1');
  localStorage.setItem('simpleblog.firebaseConfig', JSON.stringify({ apiKey: 'fake-api-key', authDomain: 'demo-simpleblog.firebaseapp.com', projectId: 'demo-simpleblog' }));
});
await p2.goto(BASE + '/admin/index.html#/posts');
await p2.waitForSelector('#login-form');
log('Belum login → halaman login OK');
await p2.type('#username', 'other@test.dev');
await p2.type('#password', PASS);
await p2.click('#login-form [type=submit]');
await p2.waitForFunction(() => document.body.innerText.includes('Bukan Admin'), { timeout: 15000 });
log('Non-admin → panel "Bukan Admin" OK');

// Rules: non-admin tidak boleh menulis
const denied = await p2.evaluate(async () => {
  const fb = await import('/core/firebase.js');
  try { await fb.setDoc(fb.doc(fb.getDb(), 'settings', 'site'), { title: 'hacked' }); return 'ALLOWED (BUG)'; } catch (e) { return e.code; }
});
log('Non-admin tulis settings →', denied);
const claimAgain = await p2.evaluate(async () => {
  const st = await import('/core/store.js'); const fb = await import('/core/firebase.js');
  try { await st.claimFirstAdmin(fb.getAuthInstance().currentUser); return 'ALLOWED (BUG)'; } catch (e) { return e.code; }
});
log('Non-admin klaim ulang admin →', claimAgain);
const commentOnClosed = await p2.evaluate(async () => {
  const st = await import('/core/store.js');
  const post = (await st.listPublicPosts()).find((x) => x.slug === 'tanpa-komentar');
  try { await st.addComment({ postId: post.id, postTitle: post.title, name: 'X', content: 'y' }); return 'ALLOWED (BUG)'; } catch (e) { return e.code; }
});
log('Komentar ke post "komentar dimatikan" (bypass UI) →', commentOnClosed);

await browser.close();
console.log('\nError browser:', errors.length ? errors : 'tidak ada');
process.exit(errors.length ? 1 : 0);
