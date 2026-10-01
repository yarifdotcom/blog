# SimpleBlog

Framework blog sederhana: **HTML + CSS + JavaScript murni** (tanpa build) dengan **Firebase** (Firestore + Auth).

- **Publik:** tema default bergaya Blogger (palet 6 warna), beranda, post, kategori, tag, pencarian, komentar, meta tag SEO.
- **Tema:** template engine sendiri, child theme, opsi kustomisasi dengan pratinjau langsung, editor template dari admin.
- **Admin (`/admin/`):** setup & tes koneksi Firebase, editor post Markdown, kategori, tag, moderasi komentar, pengaturan situs.

```bash
python3 -m http.server 8765
# publik: http://localhost:8765/    admin: http://localhost:8765/admin/
```

Login admin pertama: **`admin` / `123`** (bisa dipakai sebelum Firebase diatur). Segera ganti di **Akun Saya**.

Dokumentasi lengkap: [docs/](docs/README.md)
