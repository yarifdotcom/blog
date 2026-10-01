# Dokumentasi SimpleBlog

Framework blog sederhana berbasis **HTML, CSS, JavaScript murni** (tanpa build step) dengan **Firebase** (Firestore + Authentication) sebagai database dan sistem login.

| Dokumen | Isi |
|---|---|
| [01-gambaran-umum.md](01-gambaran-umum.md) | Fitur, struktur folder, alur kerja |
| [02-instalasi-firebase.md](02-instalasi-firebase.md) | Setup proyek Firebase, admin pertama, deploy |
| [03-arsitektur.md](03-arsitektur.md) | Modul inti, model data Firestore, security rules |
| [04-template-engine.md](04-template-engine.md) | Referensi sintaks template & filter |
| [05-membuat-tema.md](05-membuat-tema.md) | Cara membuat/kustomisasi tema, data tiap view, hook |
| [06-panel-admin.md](06-panel-admin.md) | Fitur panel admin |
| [07-pengembangan-dan-testing.md](07-pengembangan-dan-testing.md) | Emulator, unit test, E2E test, batasan yang diketahui |
| [dev-log.md](dev-log.md) | Catatan proses pengembangan & keputusan desain |

## Mulai cepat

```bash
cd simpleblog
python3 -m http.server 8765        # atau: npx serve .
# Publik : http://localhost:8765/
# Admin  : http://localhost:8765/admin/
```

> Situs **harus** dibuka lewat HTTP server (bukan `file://`) karena memakai ES modules dan `fetch()` untuk memuat template tema.

Masuk admin dengan **`admin` / `123`**, lalu buka **Setup Firebase** dan ikuti [02-instalasi-firebase.md](02-instalasi-firebase.md).
