# 06 · Panel Admin

Alamat: `/admin/` (diberi `noindex`). Semua halaman memakai routing hash, mis. `/admin/#/posts`.

Struktur menu mengikuti WordPress:

| Menu | Submenu | Route | Fungsi |
|---|---|---|---|
| Dasbor | | `#/dashboard` | Statistik, pos terbaru, komentar menunggu |
| **Pos** | Semua Pos | `#/posts` | Tab status, filter kategori, cari, aksi cepat & aksi massal |
| | Tambah Baru | `#/posts/new` | Editor pos |
| | Kategori | `#/categories` | Kelola kategori (jumlah pos → tautan ke daftar pos terfilter) |
| | Tag | `#/tags` | Kelola tag |
| **Komentar** | | `#/comments` | Moderasi (badge = jumlah menunggu) |
| **Tampilan** | Tema | `#/appearance/themes` | Daftar tema, aktifkan, pratinjau |
| | Kustomisasi | `#/appearance/customize` | Palet warna, huruf, tata letak, opsi tema — pratinjau langsung |
| | Editor Template | `#/appearance/editor` | Edit layout/template/partial/CSS tema (override) |
| | Identitas & CSS | `#/settings/appearance` | Logo, favicon, teks footer, CSS tambahan |
| **Pengaturan** | Umum | `#/settings/general` | Judul, slogan, URL, bahasa, format tanggal |
| | Menulis | `#/settings/writing` | Kategori, status, penulis & izin komentar bawaan untuk pos baru |
| | Membaca | `#/settings/reading` | Pos per halaman, panjang ringkasan, kategori di menu, larang pengindeksan |
| | Diskusi | `#/settings/discussion` | Aktifkan komentar, moderasi, tutup otomatis setelah N hari, urutan komentar |
| | SEO | `#/settings/seo` | Meta description, keywords, gambar Open Graph |
| Sistem | Setup Firebase | `#/setup` | Koneksi & instalasi |
| | Akun Saya | `#/account` | Info akun & ganti password |

Selama login masih **mode lokal** (Firebase belum terhubung / bukan admin), menu konten tetap tampil tetapi **terkunci (🔒)**; mengkliknya mengarah ke Setup Firebase dengan pemberitahuan.

## Semua Pos

- Tab: Semua / Terbit / Terjadwal / Draf (dengan jumlah).
- Kolom: judul (+ status bila bukan terbit), penulis, kategori, jumlah komentar, tanggal.
- **Aksi cepat** saat kursor di atas baris: Edit · Terbitkan/Jadikan draf · Lihat · Hapus.
- **Aksi massal:** centang beberapa pos → Terbitkan / Jadikan draf / Hapus permanen.
- Filter kategori bisa dibuka langsung: `#/posts?category=<id>`; draf: `#/posts?status=draft`.

## Mode terang / gelap

Saklar dengan ikon ☀️ (terang) dan 💡 lampu (gelap) ada di bilah atas admin (juga di halaman login) dan di header situs.
- Bawaan mengikuti setelan sistem; setelah diklik, pilihan disimpan di browser.
- Pilihan **sinkron** antara admin, situs, tab lain, dan iframe pratinjau Kustomisasi.
- Diterapkan sebelum halaman tampil, jadi tidak ada kedipan warna.

## Login

- Default pertama: **username `admin`, password `123`** — bisa dipakai sebelum Firebase dikonfigurasi.
- Saat login lokal (Firebase belum diatur/terjangkau), hanya menu **Setup Firebase** dan **Akun Saya** yang tampil; menu konten aktif setelah login Firebase sebagai admin.
- Selama password masih default, banner peringatan tampil di atas setiap halaman.
- **Akun Saya › Ganti Password**: mengganti password Firebase (dengan re-autentikasi) sekaligus password login lokal browser ini.
- Detail pemetaan username → email Firebase: lihat [02](02-instalasi-firebase.md#tentang-username--password).

## Editor post

- **Judul → slug otomatis** sampai slug diubah manual. Slug yang bentrok otomatis diberi akhiran `-2`, `-3`, …
- **Toolbar Markdown:** tebal, miring, H2, H3, tautan, gambar, kutipan, kode, daftar, daftar bernomor, garis. Pintasan `Ctrl+B`, `Ctrl+I`, `Ctrl+S` (simpan).
- **Tab Pratinjau** merender Markdown persis seperti di situs.
- **Status** Draf/Terbit + **tanggal terbit** lewat *datetime picker* (kalender + jam/menit, tombol Sekarang/Kosongkan): kosong = waktu saat diterbitkan; tanggal di masa depan = *terjadwal* (ditandai badge "Terjadwal", tidak tampil di publik sampai waktunya).
- **Kategori:** centang, atau tambah kategori baru langsung dari editor.
- **Tag:** ketik dipisah koma; tag baru dibuat otomatis saat disimpan. Klik chip untuk menghapus.
- **Gambar sampul:** URL gambar + pratinjau.
- **SEO:** meta title (≤70) & meta description (≤160) dengan penghitung karakter.
- **Izinkan komentar** per post.

> Upload gambar belum disediakan (menghindari ketergantungan ke Firebase Storage yang kini butuh paket Blaze). Gunakan URL gambar dari layanan lain.

## Komentar

- Tab: Menunggu / Disetujui / Spam / Semua, dengan jumlah.
- Aksi per baris: Setujui / Batalkan / Spam / Hapus.
- Aksi massal: centang beberapa → pilih aksi → Terapkan.
- Badge merah di menu menunjukkan jumlah komentar menunggu.

## Pengaturan

| Bagian | Field | Efek |
|---|---|---|
| Umum | Judul, slogan, URL situs, bahasa, format tanggal | Header, `<title>`, meta, tanggal di seluruh situs |
| Menulis | Kategori bawaan, status bawaan, penulis bawaan, izinkan komentar | Nilai awal di editor pos baru |
| Membaca | Pos per halaman, panjang ringkasan otomatis, kategori di menu, larang pengindeksan | Paginasi, excerpt, navigasi, meta `robots: noindex, nofollow` |
| Diskusi | Komentar aktif, wajib moderasi, tutup setelah N hari, urutan | Form komentar publik (+ ditegakkan di `firestore.rules`) |
| SEO | Meta description, keywords, OG image | Meta tag default halaman publik |
| Identitas & CSS | Logo, favicon, teks footer, CSS tambahan | Tampilan situs (tema & warna ada di menu **Tampilan**) |

Setiap bagian disimpan terpisah (merge), jadi menyimpan satu bagian tidak mengubah bagian lain.

Meta tag di halaman publik: pos memakai `metaTitle`/`metaDescription`/cover/tag-nya sendiri; halaman lain memakai nilai default dari pengaturan.

## Tampilan

### Tema
Kartu setiap tema dari `themes/index.json`: nama, versi, deskripsi, induk (*child theme*), jumlah file & opsi. Tombol **Aktifkan** dan **Pratinjau** (membuka situs dengan `?theme=`).

### Kustomisasi
Panel kiri berisi kontrol yang dibuat otomatis dari `options` di `theme.json`; panel kanan menampilkan situs dalam iframe yang **berubah seketika** saat kontrol digeser (ukuran Desktop/Tablet/Ponsel). Perubahan hanya draf sampai **Simpan & Terbitkan**. **Bawaan** mengembalikan nilai default tema.

Tema default menyediakan **palet 6 warna** (merah bata, biru, hijau toska, abu kebiruan, oranye, biru gelap) + warna lain, gaya header, huruf, posisi sidebar, lebar halaman, sudut kartu, dan tampilan daftar pos.

### Editor Template
- Kiri: daftar file (Layout, Template, Partial, Stylesheet) dengan penanda **diubah** (ada override) dan **induk** (diwarisi).
- Tengah: editor kode (Tab = 2 spasi, Ctrl+S), validasi langsung, tombol **Pratinjau**, **Simpan**, **Kembalikan ke asli**.
- Kanan: contekan sintaks, variabel file yang sedang dibuka, variabel global, daftar filter & partial.

Override disimpan di Firestore dan langsung dipakai situs; file di folder `themes/` tidak berubah.

## Setup Firebase

Lihat [02-instalasi-firebase.md](02-instalasi-firebase.md). Ringkasnya: masuk `admin`/`123` → isi config → **Tes Koneksi** → **Simpan & Hubungkan** (akun dibuat & diklaim otomatis) → ganti password → **Unduh firebase-config.js**.
