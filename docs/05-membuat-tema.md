# 05 · Membuat & Mengkustomisasi Tema

## Langkah cepat

```bash
cp -r themes/default themes/majalah
```

1. Ubah `themes/majalah/theme.json` (nama, dsb.).
2. Daftarkan di `themes/index.json`:
   ```json
   [
     { "id": "default", "name": "Default" },
     { "id": "majalah", "name": "Majalah", "description": "Tata letak grid" }
   ]
   ```
3. Pratinjau tanpa mengubah pengaturan: `http://localhost:8765/?theme=majalah`
4. Aktifkan di **Admin › Tampilan › Tema** (atau pratinjau dulu dengan tombol *Pratinjau*).

> Cara tercepat membuat variasi: buat **child theme** dengan `"extends": "default"` dan hanya file yang ingin diubah (lihat di bawah).

## Manifest `theme.json`

```json
{
  "name": "Majalah",
  "version": "1.0.0",
  "description": "Tata letak grid",
  "extends": "default",
  "layout": "layout.html",
  "styles": ["style.css"],
  "fonts": ["https://fonts.googleapis.com/css2?family=Inter&display=swap"],
  "script": "theme.js",
  "templates": { "home": "templates/home.html" },
  "partials": { "post-card": "partials/post-card.html" },
  "options": [ { "id": "accent", "default": "#388d80" } ]
}
```

| Kunci | Keterangan |
|---|---|
| `templates` | View: `home`, `post`, `archive`, `search`, `404` (view yang tidak ada jatuh ke `404`). |
| `layout` | Pembungkus semua view; konten view tersedia sebagai `{{{ content }}}`. |
| `partials` | Nama → file, dipakai dengan `{{> nama}}`. |
| `styles` | CSS yang disisipkan ke `<head>`; render menunggu CSS siap (maks. 3 dtk). |
| `fonts` | URL stylesheet font web (Google Fonts, dll.). Dimuat terpisah agar tidak memblokir CSS tema. |
| `script` | ES module untuk filter & hook kustom. |
| `extends` | Nama tema induk (*child theme*), lihat di bawah. |
| `parentStyles` | `false` = jangan muat stylesheet induk (default: dimuat). |
| `options` | Skema opsi untuk **Tampilan › Kustomisasi**. |
| `screenshot` | (opsional) gambar pratinjau di halaman **Tampilan › Tema**. |

## Child theme (`extends`)

Seperti child theme WordPress: tema anak **mewarisi semua file** induk, dan hanya file yang ditulis ulang yang menimpa.

- **Template, partial, layout** dengan nama sama → milik anak dipakai.
- **Stylesheet** → bertumpuk: CSS induk dimuat dulu, lalu CSS anak (kecuali `"parentStyles": false`).
- **Script** → induk lalu anak.
- **Opsi** → digabung per `id`; anak cukup menulis properti yang ingin diubah (mis. hanya `default`).

Contoh nyata: `themes/minimal/` — hanya berisi `theme.json`, `style.css`, dan `templates/home.html`; sisanya diwarisi dari `default`.

## Opsi kustomisasi (`options`)

Setiap opsi otomatis menjadi kontrol di **Admin › Tampilan › Kustomisasi** (dengan pratinjau langsung), dan nilainya tersedia di template sebagai `options.<id>`.

```json
{ "id": "accent", "label": "Palet warna", "type": "palette", "default": "#bc382e", "css": "--accent", "group": "Warna",
  "choices": [["#bc382e", "Merah bata"], ["#4583aa", "Biru"]] }
```

| Properti | Keterangan |
|---|---|
| `id`, `label`, `default` | Wajib (anak boleh hanya menulis `id` + properti yang diubah). |
| `type` | `palette` (swatch + warna lain), `color`, `select`, `range`, `number`, `checkbox`, `text`. |
| `choices` | Untuk `select`/`palette`: `[[nilai, label], …]`. |
| `min`, `max`, `step`, `unit` | Untuk `range`/`number`; `unit` ditambahkan saat jadi CSS (mis. `"px"`). |
| `css` | Nama CSS variable yang diisi nilai opsi, mis. `"--accent"` → `:root { --accent: #bc382e; }`. |
| `group` | Judul grup di panel Kustomisasi. |

Di template: `<main class="layout-sidebar-{{ options.sidebar }}">`, `{{#if options.showHero}}…{{/if}}`.
Di CSS: `background: var(--accent);`.

### Tema default: palet & opsi

| Opsi | Nilai |
|---|---|
| Palet warna | `#bc382e` merah bata (default) · `#4583aa` biru · `#388d80` hijau toska · `#577783` abu kebiruan · `#e67400` oranye · `#1d2b34` biru gelap · atau warna lain |
| Gaya header | Pita berwarna (Blogger) / Polos putih |
| Huruf isi & judul | Roboto · Lora (serif) · Huruf sistem · Georgia |
| Ukuran huruf, lebar halaman, sudut kartu | slider |
| Posisi sidebar | Kanan · Kiri · Tanpa sidebar |
| Daftar pos | Daftar · Grid 2 kolom |
| Tampilkan judul besar, waktu baca, tulisan terkait | on/off |

Warna turunan dihitung otomatis dari `--accent` dengan `color-mix()` (`--accent-text`, `--accent-soft`, `--accent-dark`), sehingga satu warna palet sudah cukup — termasuk penyesuaian kontras di mode gelap.

## Mengedit tema dari admin (override)

**Admin › Tampilan › Editor Template** menampilkan semua file tema aktif (termasuk yang diwarisi). Isi yang disimpan menjadi **override** di Firestore (`themeFiles`), bukan mengubah file di disk:

- Sintaks template divalidasi sebelum disimpan (blok tidak tertutup, filter tak dikenal).
- **Pratinjau** menampilkan draf di iframe tanpa memengaruhi pengunjung.
- **Kembalikan ke asli** menghapus override.
- Jika override rusak tetap sampai ke situs, pemuat tema otomatis memakai file asli.

Kunci file: `layout`, `template:<view>`, `partial:<nama>`, `style:<tema>/<file.css>`.

> Untuk perubahan besar/permanen, edit file di folder `themes/` (dan kelola dengan git); override dari admin cocok untuk penyesuaian cepat.

## Data yang tersedia di template

### Global (semua view + layout)

| Variabel | Isi |
|---|---|
| `options` | Nilai opsi Kustomisasi tema aktif (`options.sidebar`, `options.accent`, …) |
| `themeName` | Nama tema aktif |
| `site` | Semua pengaturan situs (`site.title`, `site.tagline`, `site.description`, `site.logoUrl`, `site.footerText`, `site.commentsEnabled`, … — daftar lengkap di [03](03-arsitektur.md#settingssite)) |
| `categories` | Semua kategori: `{ id, name, slug, description, url, count }` |
| `navCategories` | Kategori untuk menu (kosong bila dimatikan di pengaturan) |
| `tags` | Tag yang punya post: `{ id, name, slug, url, count }` |
| `recentPosts` | 5 post terbaru |
| `year` | Tahun sekarang |
| `query` | Kata kunci pencarian saat ini (untuk `value` input cari) |
| `route` | `{ path, query, params }` |
| `view` | Nama view: `home`, `post`, `archive`, `search`, `404` |
| `content` | (hanya layout) HTML hasil render view |

### Objek post

```
id, title, slug, url, content (markdown), html (SafeString), excerpt,
coverImage, date (Date), dateFormatted, readingTime (menit),
authorName, allowComments, metaTitle, metaDescription,
categories[], category (kategori pertama), tags[], categoryIds[], tagIds[]
```

### Per view

| View | Data tambahan |
|---|---|
| `home` | `posts[]`, `pagination`, `isHome` |
| `post` | `post`, `comments[]` (`name, website, content, date, dateFormatted`), `commentsOpen`, `relatedPosts[]`, `prevPost`, `nextPost`, `savedName` |
| `archive` | `archive: { type: 'category'\|'tag', label, term, title, description }`, `posts[]`, `pagination` |
| `search` | `searchQuery`, `total`, `posts[]`, `pagination` |
| `404` | — |

`pagination`:
```
{ page, totalPages, total, hasPrev, hasNext, prevUrl, nextUrl,
  pages: [{ number, url, current }] }
```

## Kontrak HTML interaktif

Aplikasi publik memasang event lewat atribut `data-*`, jadi markup tema bebas asalkan atribut ini ada:

| Elemen | Atribut | Field |
|---|---|---|
| Form pencarian | `<form data-search-form>` | `<input name="q">` |
| Form komentar | `<form data-comment-form data-post-id="{{ post.id }}">` | `name`, `website` (opsional), `content`, `hp` (honeypot, sembunyikan dengan CSS) |
| Pesan status komentar | `<span data-comment-status>` | Diisi teks; atribut `data-type="success\|error"` di-set otomatis |
| Anchor komentar | `id="comments"` | Tujuan scroll setelah komentar terbit |

## Script tema (`theme.js`)

```js
export default function setup(theme) {
  // Filter kustom
  theme.engine.registerFilter('readtime', (min) => `${min} menit baca`);

  // Tambah/ubah data sebelum render
  theme.hooks.extendData = (view, data) => {
    if (view === 'home') data.featured = data.posts[0];
    return data;
  };

  // Setelah HTML dipasang ke DOM (mis. syntax highlight, analytics, menu aktif)
  theme.hooks.afterRender = (el, view, data) => {
    el.querySelectorAll('pre code').forEach((b) => window.hljs?.highlightElement(b));
  };
}
```

Script dijalankan **sebelum** template dikompilasi, jadi filter kustom langsung bisa dipakai.

## Mode terang / gelap

Mode diatur oleh `core/color-mode.js` (dipakai situs & admin) dan diterapkan sebagai atribut di `<html>`:

```css
:root { --bg: #eef0f2; --text: #212121; }              /* terang (bawaan) */
:root[data-theme="dark"] { --bg: #121619; --text: #e6e8ea; } /* gelap */
```

> Jangan pakai `@media (prefers-color-scheme: dark)` di tema — mode bisa dipilih pengguna lewat saklar, bukan hanya mengikuti sistem.

**Saklar** — taruh elemen dengan atribut `data-mode-toggle` di layout; isinya (ikon matahari ☀️ & lampu 💡 + bulatan) diisi otomatis:

```html
<button class="mode-switch" data-mode-toggle aria-label="Ganti mode terang/gelap"></button>
```

Warna saklar diatur lewat CSS variable dengan selektor yang lebih spesifik dari `.mode-switch`:

```css
.masthead .mode-switch { --ms-track: rgba(255,255,255,.2); --ms-knob: #fff; --ms-active: var(--accent); color: #fff; }
```

Tema yang tidak punya saklar otomatis mendapat **saklar mengambang** di pojok kanan bawah.

## Tips

- Ekspos pilihan desain sebagai `options` di `theme.json` agar admin bisa mengubahnya lewat Kustomisasi tanpa menyentuh kode.
- **CSS tambahan** (Tampilan › Identitas & CSS) selalu dimuat paling akhir sehingga bisa menimpa tema.
- Untuk library eksternal (font, highlight.js), tambahkan `<link>`/`<script>` di `index.html`, atau muat dinamis dari `theme.js`.
- Error template tampil di layar — buka console browser untuk detail.
