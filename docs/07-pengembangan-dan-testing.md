# 07 · Pengembangan & Testing

## Server lokal

```bash
python3 -m http.server 8765
```

`package.json` hanya untuk tooling development — situs sendiri tidak butuh `npm install`.

```bash
npm install            # firebase-tools + puppeteer-core (dev saja)
npm run serve          # server statis :8765
npm test               # unit test template engine, markdown, utils
npm run emulators      # Firebase Emulator (Firestore :8080, Auth :9099)
npm run test:e2e       # tes end-to-end (butuh emulator + serve berjalan)
```

## Firebase Emulator (tanpa menyentuh proyek asli)

1. `npm run emulators` (butuh Java 11+). UI emulator: <http://127.0.0.1:4000>. Rules dari `firestore.rules` ikut dimuat, jadi rules ikut teruji.
2. Di console browser pada `http://localhost:8765/admin/`:
   ```js
   localStorage.setItem('simpleblog.emulator', '127.0.0.1');
   ```
3. Di halaman Setup isi config dummy:
   `apiKey: fake-api-key`, `authDomain: demo-simpleblog.firebaseapp.com`, `projectId: demo-simpleblog`.
4. Login `admin`/`123` → Simpan & Hubungkan; akun dibuat otomatis di Auth emulator.

Status "emulator" tampil sebagai badge di halaman Setup. Hapus key `simpleblog.emulator` untuk kembali ke produksi.

## Unit test

`tests/template.test.mjs` — berjalan di Node tanpa dependensi (modul `core/` yang murni tidak menyentuh DOM).

## Tes end-to-end

`tests/e2e.mjs` mengotomasi Chrome headless terhadap emulator dan memverifikasi alur lengkap:

1. Tanpa config: login `admin`/`123` (password salah ditolak), menu konten terkunci
2. Setup: tempel config → tes koneksi → Simpan & Hubungkan → akun dibuat & diklaim otomatis
3. Ganti password → banner hilang → logout → `123` ditolak → password baru diterima
4. Isi data demo, cek statistik dasbor
5. Tambah kategori, tulis post (toolbar, kategori, tag baru, pratinjau, terbit)
6. Menu ala WordPress, pengaturan per bagian (Umum/Membaca/Menulis), kategori bawaan di editor, aksi massal pos; pengaturan terlihat di publik (judul, paginasi)
7. Publik: beranda, detail post, meta description, kirim komentar (dengan `<script>`)
8. Admin menyetujui komentar → tampil di publik dan **ter-escape** (aman XSS)
9. Arsip kategori/tag, pencarian, 404, halaman 2
10. Akun non-admin: diarahkan ke panel "Bukan Admin"; menulis settings, klaim ulang admin, dan komentar ke post yang komentarnya dimatikan **ditolak rules**

`tests/e2e-appearance.mjs` menguji modul Tampilan: halaman Tema, palet & opsi Kustomisasi dengan pratinjau langsung, Editor Template (validasi, pratinjau, simpan, kembalikan), dan child theme `minimal`. `tests/e2e-color-mode.mjs` menguji saklar mode terang/gelap: admin & situs, sinkron antar-tab dan ke iframe pratinjau, persisten setelah reload (mengalahkan setelan sistem), saklar mengambang untuk tema tanpa saklar, dan tampilan ponsel. `npm run test:e2e` menjalankan ketiganya.

> Catatan puppeteer: interaksi dengan beberapa tab sekaligus perlu `page.bringToFront()` — tab latar belakang di-*throttle* browser sehingga klik bisa menggantung.

Screenshot disimpan di `tests/screenshots/`. Tes ini **menghapus seluruh data emulator** di awal.

## Batasan yang diketahui

| Batasan | Dampak | Opsi ke depan |
|---|---|---|
| Routing hash (`#/post/slug`) | Crawler yang tidak menjalankan JS tidak melihat konten; meta tag di-set via JS | Pre-render / static export, atau Cloud Functions untuk SSR |
| Semua post terbit dimuat sekali di awal | Ideal untuk ≤ beberapa ratus post | Paginasi Firestore (`limit` + `startAfter`) + index komposit |
| Pencarian sisi klien, substring sederhana | Tidak ada ranking/fuzzy | Algolia/Typesense, atau index kata kunci |
| Belum ada upload gambar | Pakai URL eksternal | Firebase Storage (paket Blaze) / Cloudinary |
| Komentar satu tingkat | Field `parentId` sudah disiapkan | Balasan bertingkat |
| Emulator memakai HTTP/1.1 | Chrome membatasi 6 koneksi per host; banyak tab situs terbuka bersamaan dapat membuat write menggantung **hanya di emulator** (produksi memakai HTTP/2) | Tutup tab lain saat development |

## Konvensi kode

- ES module murni, tanpa framework, tanpa build.
- Modul `core/` bebas dari kode admin; `utils.js`, `template.js`, `markdown.js` bebas DOM agar bisa dites di Node.
- Admin memakai tagged template `html\`\`` (auto-escape); nilai HTML tepercaya dibungkus `raw()`.
- Teks antarmuka dalam Bahasa Indonesia.
