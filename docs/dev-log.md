# Dev Log

Catatan proses pengembangan, keputusan desain, dan temuan saat pengujian. Tambahkan entri baru di atas.

---

## 2026-10-01 — v1.4.0: saklar mode terang / gelap

- **Modul baru** `core/color-mode.js` dipakai situs & admin: mode sebagai `<html data-theme>`, bawaan mengikuti sistem, pilihan disimpan (`simpleblog.colorMode`) dan disinkronkan lewat event `storage` ke tab lain, admin ↔ situs, dan iframe pratinjau.
- **Saklar** berikon ☀️ matahari (terang) & 💡 lampu (gelap) dengan bulatan yang bergeser ke mode aktif: di bilah atas admin (termasuk login) dan di header tema default. Tema tanpa saklar otomatis mendapat saklar mengambang.
- **Tanpa kedipan**: skrip inline kecil di `<head>` (`index.html`, `admin/index.html`) menerapkan mode sebelum render.
- CSS mode gelap diubah dari `@media (prefers-color-scheme: dark)` menjadi `:root[data-theme="dark"]` (admin, tema default, Minimal).
- **Temuan:** gaya dasar saklar semula memakai `:where()` (spesifisitas 0) sehingga kalah oleh aturan umum `button { padding… }` milik tema — ikon tersusun vertikal. Diganti selektor kelas biasa; tema menyesuaikan warna lewat `--ms-track`, `--ms-knob`, `--ms-active`.
- Diuji: `tests/e2e-color-mode.mjs` (baru) + seluruh E2E lain lulus, 0 error browser; tampilan diperiksa di desktop & ponsel, terang & gelap.

---

## 2026-10-01 — v1.3.1: Editor Template saat rules belum diperbarui

- **Laporan:** `#/appearance/editor` gagal total dengan *"Missing or insufficient permissions"* di proyek yang masih memakai rules lama (belum ada izin koleksi `themeFiles`).
- **Perbaikan:** editor tetap terbuka (file tema bisa dilihat & dipratinjau), menampilkan peringatan berisi langkah deploy rules, dan pesan gagal simpan menjelaskan penyebabnya. Situs publik sudah aman sejak awal (override tema yang gagal dibaca diabaikan).
- Diuji dengan emulator yang memakai rules lama.

---

## 2026-10-01 — v1.3.0: modul Tampilan & tema default bergaya Blogger

### Modul Tampilan (admin)
- **Tema** — daftar tema, aktifkan, pratinjau, info child theme.
- **Kustomisasi** — kontrol dibuat dari skema `options` di `theme.json`; pratinjau langsung lewat iframe `?preview=1` yang menerima draf via event `storage` (localStorage) tanpa reload; ukuran Desktop/Tablet/Ponsel.
- **Editor Template** — edit layout/template/partial/CSS sebagai **override** di Firestore (`themeFiles`); validasi sintaks & filter tak dikenal sebelum simpan; pratinjau draf; kembalikan ke asli; contekan variabel.
- Pemuat tema (`core/theme.js`) mendukung **child theme** (`extends`), override, opsi → CSS variable, font web non-blocking, dan fallback ke file asli bila override rusak.

### Tema default v2 (gaya Blogger "Contempo")
Pita header berwarna dengan judul besar, kartu putih yang menumpuk di atas pita, label kategori, "Baca selengkapnya", widget sidebar berbentuk kartu (Tentang, Postingan terbaru dengan thumbnail, Label, Tag), footer biru gelap, Roboto + Lora. **Palet**: `#bc382e` (default), `#4583aa`, `#388d80`, `#577783`, `#e67400`, `#1d2b34` + warna lain. Warna turunan dihitung dengan `color-mix()`. Contoh child theme `minimal` (header polos, satu kolom, judul serif).

### Temuan & perbaikan
- **CSS kustom tertimpa tema** — `<style id="custom-css">` ada di `<head>` statis sedangkan CSS tema ditambahkan belakangan. Sekarang dipindah ke akhir `<head>` setiap tema dimuat.
- **Kilasan halaman tanpa gaya** — render tidak menunggu stylesheet; ditambah `@import` Google Fonts di CSS menahan seluruh stylesheet. Sekarang render menunggu CSS (maks. 3 dtk) dan font dimuat terpisah (`fonts` di `theme.json`).
- **CSS induk hilang di child theme** — kunci stylesheet `style:style.css` bentrok antara induk & anak sehingga CSS induk tidak dimuat. Kunci stylesheet kini memuat nama tema (`style:default/style.css`) agar bertumpuk.
- Batas 6 koneksi HTTP/1.1 emulator kembali terlihat saat admin + iframe pratinjau + tab publik terbuka bersamaan (tidak terjadi di produksi/HTTP/2); tes membuka tab publik hanya sesaat.

### Rules
Koleksi baru `themeFiles` (baca publik, tulis admin). **Perlu deploy ulang `firestore.rules`.**

### Verifikasi
`tests/e2e-appearance.mjs` (baru) & `tests/e2e.mjs` lulus, 0 error browser: palet → pratinjau langsung → publik belum berubah → simpan → publik berubah; validasi editor (blok tak tertutup, filter tak dikenal); override tampil di publik lalu dikembalikan; child theme memuat CSS induk + anak. Mode terang/gelap & ponsel 390px diperiksa visual, tanpa scroll horizontal.

---

## 2026-10-01 — v1.2.1: datetime picker tanggal terbit

- **Masalah:** `<input type="datetime-local">` di editor sering *invalid* — browser menolak nilai bila tanggal diisi tapi jam masih `--:--`, dan formatnya mengikuti locale browser (mm/dd/yyyy). Form jadi tidak bisa disimpan.
- **Solusi:** `admin/js/datetime-picker.js` — picker tanpa library: kalender bulanan (Bahasa Indonesia, mulai Minggu), pilihan jam & menit, tombol Sekarang / Kosongkan / Selesai, tutup dengan Escape atau klik di luar. Nilai di `<input type="hidden">` tetap berformat `YYYY-MM-DDTHH:mm` (waktu lokal), jadi kode simpan tidak berubah.
- Mengosongkan tanggal pada post yang sudah ada kini berarti "waktu saat diterbitkan" (sebelumnya tanggal lama dipertahankan diam-diam).
- Keterangan dinamis: badge **Terjadwal** + waktu tayang bila tanggal di masa depan.
- Diuji: pilih tanggal bulan depan + jam → tersimpan sebagai terjadwal → terisi kembali saat edit; Kosongkan, Sekarang, Escape, klik di luar; E2E penuh lulus.

---

## 2026-10-01 — v1.2.0: menu & pengaturan ala WordPress

### Diubah / ditambah
- **Menu bergrup** seperti WordPress: Dasbor · Pos (Semua Pos, Tambah Baru, Kategori, Tag) · Komentar · Tampilan · Pengaturan (Umum, Menulis, Membaca, Diskusi, SEO) · Sistem. Submenu terbuka untuk grup aktif.
- Mode lokal: menu konten tidak lagi disembunyikan, tetapi ditampilkan **terkunci 🔒** — sebelumnya pengguna bisa mengira menu belum ada.
- **Pengaturan dipecah per bagian** (`#/settings/:section`), masing-masing disimpan terpisah. Field baru: kategori/status/izin komentar bawaan, panjang ringkasan, larang pengindeksan (meta robots), tutup komentar setelah N hari, urutan komentar.
- **Semua Pos:** aksi cepat per baris (Edit/Terbitkan/Jadikan draf/Lihat/Hapus), aksi massal, kolom penulis & jumlah komentar, filter via URL (`?category=`, `?status=`).
- Kategori: jumlah pos menjadi tautan ke daftar pos terfilter.

### Rules
`validPublicComment()` kini juga memeriksa post **terbit**, `allowComments`, dan `closeCommentsAfterDays` — sebelumnya hanya ditegakkan di UI sehingga bisa dilewati lewat SDK. **Perlu deploy ulang `firestore.rules`.**

### Verifikasi
E2E lulus: menu terkunci di mode lokal, submenu & tab pengaturan, simpan Umum/Membaca/Menulis, kategori bawaan di editor, aksi massal draf ↔ terbit, komentar ke post yang komentarnya dimatikan ditolak rules (`permission-denied`), seluruh alur sebelumnya, 0 error browser.

---

## 2026-10-01 — v1.1.0: login default admin / 123

### Permintaan
Admin default `admin` / `123` yang bisa dipakai **walaupun Firebase belum diatur**, supaya admin bisa masuk dan mengisi Setup Firebase dari panel.

### Kendala & solusi
- Firebase Auth hanya menerima **email** dan password **≥ 6 karakter**. Solusi di `admin/js/auth.js`: username tanpa `@` → `username@simpleblog.local`; password < 6 karakter diberi akhiran tetap (deterministik) sebelum dikirim ke Firebase.
- Sebelum Firebase ada, tidak ada server untuk memverifikasi login → **login lokal**: hash SHA-256 di `localStorage` (default `admin`/`123` bila belum pernah diganti). Hanya membuka Setup & Akun; tidak memberi akses data.
- Setelah Firebase diatur, **Simpan & Hubungkan** / Masuk: jika situs belum terinstal, akun dibuat otomatis (`createUserWithEmailAndPassword`) lalu `claimFirstAdmin` — menggantikan tombol klaim manual (tombol tetap ada sebagai cadangan).
- Fallback: bila Firebase tak terjangkau (config salah/jaringan), login lokal dipakai agar admin tetap bisa memperbaiki config. Bila password Firebase *salah*, tidak ada fallback.

### Keamanan
- `123` mudah ditebak → banner peringatan di semua halaman admin selama `admins/{uid}.defaultPassword == true` (Firebase) atau password lokal belum diganti; menu **Akun Saya** untuk menggantinya (Firebase + lokal sekaligus, dengan re-autentikasi).
- Risiko yang tersisa (didokumentasikan di [02](02-instalasi-firebase.md)): situs yang sudah di-deploy tapi belum diinstal bisa diklaim siapa saja dengan `admin`/`123`.

### Verifikasi
E2E diperbarui & lulus: login lokal, menu terkunci, akun Firebase dibuat & diklaim otomatis, ganti password, password lama ditolak, password baru diterima, plus seluruh alur sebelumnya. Error 400 dari Auth emulator pada percobaan login yang sengaja gagal dikecualikan dari pemeriksaan error.

---

## 2026-10-01 — v1.0.0: kerangka awal

### Dibangun
- Modul inti: `firebase`, `store`, `template`, `theme`, `markdown`, `router`, `utils`.
- Tampilan publik + tema `default` (layout, 5 template, 5 partial, CSS responsif + mode gelap, `theme.js`).
- Panel admin: Setup Firebase, Login, Dasbor, Post, Editor, Kategori, Tag, Komentar, Pengaturan.
- `firestore.rules`, `firebase.json` (hosting + emulator), unit test, E2E test.

### Keputusan desain
- **Template engine sendiri** (bukan Handlebars dari CDN) agar tanpa dependensi, bisa mendukung ekspresi perbandingan/logika langsung di `{{#if}}`, dan bisa dites di Node.
- **Routing hash** agar bisa di-host di hosting statis apa pun tanpa konfigurasi rewrite.
- **Config Firebase dua sumber:** localStorage (admin bisa setup dari UI tanpa edit file) + `config/firebase-config.js` (untuk pengunjung). Tombol unduh menjembatani keduanya.
- **Hak admin via dokumen `admins/{uid}`**, bukan sekadar "sudah login", karena siapa pun dapat mendaftar akun lewat SDK klien jika Email/Password aktif.
- **Klaim admin pertama** via batch `admins/{uid}` + `meta/install` dengan `existsAfter()` di rules → bootstrap tanpa perlu membuka Console, dan hanya bisa sekali.
- **Email komentator tidak disimpan** karena dokumen komentar yang disetujui dibaca publik (tidak ada izin per-field di Firestore).
- **Memuat semua post terbit sekali** di publik → tanpa index komposit, paginasi/arsip/pencarian instan. Trade-off dicatat di [07](07-pengembangan-dan-testing.md#batasan-yang-diketahui).
- **Konten post Markdown** (bukan WYSIWYG) agar ringan dan portabel; HTML mentah tetap diizinkan untuk admin.

### Temuan & perbaikan saat pengujian
- **XSS via website komentar:** `href="javascript:..."` mungkin lolos karena escape HTML tidak memfilter skema URL. Diperbaiki berlapis: sanitasi di `store.addComment`, saat render publik, saat render admin, dan regex `^https?://` di rules.
- **Toast menutupi tombol Simpan:** notifikasi di pojok kanan bawah menghalangi klik tombol "Simpan Pengaturan" (sticky di kanan bawah). Toast dipindah ke kanan atas + `pointer-events: none`.
- **Write Firestore menggantung di emulator:** halaman yang disimpan back-forward cache Chrome tetap memegang channel Listen/Write; dengan emulator (HTTP/1.1, maks. 6 koneksi per host) koneksi habis. Solusi di `core/firebase.js`: `terminate(db)` saat `pagehide` (persisted) dan reload saat `pageshow` (persisted) — sekaligus mencegah data basi saat pengguna menekan tombol Back.
- **Excerpt otomatis "api besar ."**: `stripHtml` mengganti semua tag dengan spasi. Sekarang hanya tag blok yang diganti spasi; tag inline dihapus.

### Hasil verifikasi
- Unit test: 11 grup lulus.
- E2E (emulator + Chrome headless): seluruh alur lulus, 0 error console; rules menolak penulisan & klaim ulang oleh non-admin (`permission-denied`).
- Tampilan mobile 390px: tanpa scroll horizontal, menu burger berfungsi.

### Ide berikutnya
- Halaman statis (About, Kontak) sebagai tipe post `page`
- Upload gambar (Storage/Cloudinary)
- Balasan komentar bertingkat (`parentId` sudah ada)
- Manajemen admin dari UI
- Ekspor/impor data (JSON)
- RSS feed & sitemap (butuh build/Cloud Function)
