# 03 · Arsitektur

## Prinsip

- **Tanpa build step.** Semua file adalah ES module yang langsung dijalankan browser. Firebase SDK v10 (modular) dimuat dari CDN `gstatic.com`.
- **Satu lapisan data.** Semua akses Firestore lewat `core/store.js`; publik dan admin memakai fungsi yang sama.
- **Tampilan publik = tema.** `public.js` hanya menyiapkan data; HTML sepenuhnya ditentukan template tema.
- **Keamanan di rules, bukan di klien.** Kode klien bisa dimodifikasi siapa saja; `firestore.rules` yang menentukan siapa boleh membaca/menulis apa.

## Modul inti (`core/`)

| Modul | Tanggung jawab |
|---|---|
| `firebase.js` | Membaca config (localStorage → file), `initFirebase()` (bisa re-init), parse config yang ditempel, mode emulator, re-export fungsi SDK |
| `store.js` | CRUD settings, posts, categories, tags, comments; klaim admin; data demo |
| `template.js` | Template engine (tokenizer → AST → render), filter, partial, `SafeString` |
| `theme.js` | `resolveTheme()` (manifest + rantai `extends`), memuat file/override/opsi/CSS/font/script; `render(view, data)` |
| `markdown.js` | Markdown → HTML. `allowHtml: false` untuk input publik |
| `router.js` | Router berbasis hash dengan parameter (`/post/:slug`), query, dan guard |
| `utils.js` | escape, slug, format tanggal, waktu relatif, dll. (bebas DOM, bisa dites di Node) |
| `color-mode.js` | Mode terang/gelap: `<html data-theme>`, saklar `[data-mode-toggle]`, sinkron via localStorage (`simpleblog.colorMode`) |

Khusus admin: `admin/js/auth.js` — login lokal (hash SHA-256 di localStorage), pemetaan username → email, padding password pendek, login Firebase + pembuatan akun otomatis, ganti password.

## Alur halaman publik

```
index.html
  └─ assets/js/public.js
       1. loadConfig()            → kosong? tampilkan pesan "belum dikonfigurasi"
       2. initFirebase()
       3. getSettings()           → settings/site (+ DEFAULT_SETTINGS)
       4. listPublicPosts(), listTerms('categories'|'tags')
          → post didekorasi: url, date, dateFormatted, html, excerpt,
            readingTime, categories[], tags[], category
       5. new Theme(settings.theme).load()
       6. Router: setiap hash berubah → view → theme.render(view, data)
       7. Event delegation: form pencarian & komentar
```

Semua post terbit dimuat **sekali** saat halaman dibuka, lalu paginasi, arsip, dan pencarian dilakukan di klien. Cocok untuk blog kecil–menengah (ratusan post). Lihat batasan di [07](07-pengembangan-dan-testing.md#batasan-yang-diketahui).

## Alur panel admin

```
admin/index.html
  └─ admin/js/main.js
       connect(): initFirebase + onAuthStateChanged → app.user, app.admin, app.isAdmin
       app.login(username, password)   (admin/js/auth.js)
         Firebase aktif   → signIn; belum terinstal → buat akun + claimFirstAdmin
         gagal koneksi    → fallback login lokal
         Firebase belum ada → login lokal (default admin/123)
       guard router:
         belum login (Firebase/lokal)      → /login
         /setup, /account                  → selalu boleh setelah login
         belum ada config / bukan admin    → /setup
       setiap view: render({ el, params, query, app })
```

Setiap navigasi membuat elemen kontainer baru; view lama yang masih memuat data menulis ke elemen yang sudah terlepas sehingga tidak bentrok.

## Model data Firestore

### `settings/site`
```js
{
  // Umum
  title, tagline, siteUrl, language, dateFormat,
  // Menulis
  author, defaultCategoryId, defaultPostStatus, defaultAllowComments,
  // Membaca
  postsPerPage, excerptLength, showCategoriesInNav, discourageSearch,
  // Diskusi
  commentsEnabled, commentModeration, closeCommentsAfterDays, commentsOrder /* 'asc'|'desc' */,
  // SEO
  description, keywords, ogImage,
  // Tampilan
  theme, logoUrl, faviconUrl, footerText, customCss,
  updatedAt
}
```
Nilai bawaan ada di `DEFAULT_SETTINGS` (`core/store.js`).

### `posts/{id}`
```js
{
  title, slug, content /* markdown */, excerpt, coverImage,
  status: 'draft' | 'published',
  publishedAt /* Timestamp; masa depan = terjadwal */,
  categoryIds: string[], tagIds: string[],
  authorName, allowComments, metaTitle, metaDescription,
  createdAt, updatedAt
}
```

### `categories/{id}` dan `tags/{id}`
```js
{ name, slug, description, createdAt, updatedAt }
```

### `comments/{id}`
```js
{
  postId, postTitle, name, website /* hanya http(s) */, content,
  parentId, status: 'pending' | 'approved' | 'spam', createdAt
}
```
Email komentator sengaja **tidak** disimpan karena komentar yang disetujui dapat dibaca publik (Firestore tidak punya izin per-field).

### `themeFiles/{tema~kunci}`
```js
{ theme, key /* 'layout' | 'template:home' | 'partial:post-card' | 'style:default/style.css' */, content, updatedAt }
```
Override file tema dari Editor Template. Dibaca publik (dibutuhkan untuk merender), ditulis admin (maks. ±500 KB per file).

Opsi Kustomisasi tersimpan di `settings/site.themeOptions.<tema>`.

### `admins/{uid}` dan `meta/install`
- `admins/{uid}` — keberadaan dokumen = hak admin. Field: `email`, `role`, `createdAt`, `defaultPassword` (true bila masih `123` → banner peringatan).
- `meta/install` — penanda bahwa admin pertama sudah diklaim.

## Security rules (ringkasan)

| Koleksi | Baca | Tulis |
|---|---|---|
| settings, categories, tags, themeFiles | semua | admin |
| posts | `status == 'published'` atau admin | admin |
| comments | `status == 'approved'` atau admin | buat: publik (tervalidasi); ubah/hapus: admin |
| admins/{uid} | pemilik atau admin | admin; atau klaim pertama |
| meta/install | semua | sekali saja (klaim pertama) |

Validasi komentar publik di rules: field terbatas (`hasOnly`), panjang nama ≤ 80, isi ≤ 5000, website kosong atau `http(s)://`, `createdAt == request.time`, post harus **terbit** dan **mengizinkan komentar**, belum melewati **batas hari** (`closeCommentsAfterDays`), komentar aktif di situs, dan status `approved` hanya boleh bila moderasi dimatikan.

**Klaim admin pertama** memakai batch yang menulis `admins/{uid}` dan `meta/install` sekaligus; rules memeriksa `!exists(meta/install)` dan `existsAfter(...)` sehingga hanya bisa terjadi satu kali.

> Karena rules menolak query yang *mungkin* mengembalikan dokumen terlarang, query publik **wajib** menyertakan `where('status', '==', 'published')` (post) atau `where('status', '==', 'approved')` (komentar). Ini sudah ditangani `store.js`.

## Keamanan konten

- Template engine meng-escape output secara default (`{{ }}`); HTML mentah hanya lewat `{{{ }}}` atau nilai `SafeString`.
- Konten post (dari admin, tepercaya) di-render Markdown dengan HTML diizinkan.
- Komentar publik selalu di-escape (`nl2br` meng-escape lebih dulu); URL `javascript:` diblok di parser Markdown, dan URL website komentar dibatasi `http(s)` di klien, admin, dan rules.
