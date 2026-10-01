# 01 · Gambaran Umum

## Fitur

**Sisi publik**
- Beranda dengan daftar post + paginasi
- Halaman post: konten Markdown, cover, kategori, tag, waktu baca, post sebelumnya/berikutnya, tulisan terkait
- Arsip per kategori & per tag, pencarian (judul, ringkasan, isi, tag)
- Komentar dengan moderasi, honeypot anti-bot
- Meta tag dinamis (title, description, keywords, Open Graph)
- Responsif & mode gelap otomatis (tema default)
- Sistem tema dengan template engine sendiri

**Panel admin** (`/admin/`)
- Setup Firebase: input config, akun admin, **tes koneksi** bertahap, klaim admin pertama, unduh `firebase-config.js`, data demo
- Dasbor statistik
- Post: daftar + filter (status/kategori/cari), editor Markdown dengan toolbar & pratinjau, slug otomatis, jadwal terbit, SEO per post, gambar sampul
- Kategori & tag: tambah/edit/hapus (otomatis dilepas dari post saat dihapus)
- Komentar: tab status, setujui/spam/hapus, aksi massal
- Pengaturan situs: judul, tagline, deskripsi, meta keywords, OG image, logo, favicon, tema, jumlah post per halaman, format tanggal, footer, CSS kustom, opsi komentar

## Struktur folder

```
simpleblog/
├── index.html                  # Shell halaman publik
├── assets/js/public.js         # Aplikasi publik (router + render tema)
├── admin/
│   ├── index.html              # Shell panel admin
│   ├── admin.css
│   └── js/
│       ├── main.js             # Koneksi, auth, routing admin
│       ├── ui.js               # Helper UI (html``, toast, form)
│       └── views/              # setup, login, dashboard, posts, editor,
│                               # taxonomy, comments, settings
├── core/                       # Modul inti (dipakai publik & admin)
│   ├── firebase.js             # Init Firebase, config, emulator
│   ├── store.js                # Semua akses Firestore
│   ├── template.js             # Template engine
│   ├── theme.js                # Pemuat tema
│   ├── markdown.js             # Parser Markdown
│   ├── router.js               # Router hash
│   └── utils.js
├── themes/
│   ├── index.json              # Daftar tema untuk dropdown admin
│   └── default/                # Tema bawaan
│       ├── theme.json          # Manifest tema
│       ├── layout.html
│       ├── templates/          # home, post, archive, search, 404
│       ├── partials/           # post-card, post-meta, pagination, sidebar, comments
│       ├── style.css
│       └── theme.js            # Filter & hook kustom (opsional)
├── config/firebase-config.js   # Config Firebase untuk pengunjung publik
├── firestore.rules             # Security rules
├── firebase.json               # Hosting + emulator
├── tests/                      # Unit test & E2E test
└── docs/
```

## Alur kerja singkat

1. Admin membuka `/admin/`, mengisi config Firebase → tersimpan di `localStorage` browser admin.
2. Admin login, klaim admin pertama, lalu menulis konten.
3. Admin mengunduh `firebase-config.js` dan menaruhnya di `config/` sebelum deploy, supaya **pengunjung** (yang tidak punya localStorage admin) bisa membaca data.
4. Pengunjung membuka `/` → `public.js` membaca pengaturan + post dari Firestore → merender lewat tema aktif.

## URL publik

| URL | Halaman |
|---|---|
| `#/` , `#/?page=2` | Beranda |
| `#/post/<slug>` | Detail post |
| `#/category/<slug>` | Arsip kategori |
| `#/tag/<slug>` | Arsip tag |
| `#/search?q=kata` | Pencarian |
| `?theme=<nama>` | Pratinjau tema lain tanpa mengubah pengaturan |
