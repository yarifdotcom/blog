# 02 · Instalasi & Setup Firebase

## 1. Siapkan proyek Firebase

1. Buka <https://console.firebase.google.com> → **Add project**.
2. **Project settings › Your apps › Web (`</>`)** → daftarkan app. Salin objek `firebaseConfig`.
3. **Build › Firestore Database › Create database** → mode *production*, pilih region terdekat (mis. `asia-southeast2` Jakarta).
4. **Build › Authentication › Get started › Sign-in method** → aktifkan **Email/Password**.
   (User admin **tidak perlu** dibuat manual — dibuat otomatis dari panel admin.)

## 2. Pasang Security Rules

Salin isi [`firestore.rules`](../firestore.rules) ke **Firestore › Rules** lalu *Publish*. Atau via CLI:

```bash
npm i -g firebase-tools
firebase login
firebase use --add            # pilih proyek
firebase deploy --only firestore:rules
```

> Tanpa rules ini, tes koneksi akan gagal dengan `permission-denied`, dan klaim admin pertama tidak bisa dilakukan.

## 3. Hubungkan dari panel admin

1. Jalankan server lokal: `python3 -m http.server 8765`, buka `http://localhost:8765/admin/`.
2. Masuk dengan akun default **username `admin`, password `123`**. Karena Firebase belum diatur, ini *login lokal* (hanya di browser ini) dan yang terbuka hanya menu **Setup Firebase** dan **Akun Saya**.
3. Tempel potongan `firebaseConfig` ke kotak teks → **Isi otomatis** (atau isi field manual). Wajib: `apiKey`, `authDomain`, `projectId`.
4. Isi **Username** (default `admin`) dan **Password** (default `123`).
5. Klik **Tes Koneksi**. Hasilnya bertahap:
   - Validasi config
   - Inisialisasi SDK
   - Membaca Firestore (`settings/site`)
   - Status instalasi (`meta/install`)
   - Login akun (jika belum ada & situs belum diinstal: "akan dibuat otomatis")
   - Cek hak admin (`admins/{uid}`)

   Tes memakai instance Firebase terpisah, jadi tidak mengubah sesi yang sedang aktif.
6. Klik **Simpan & Hubungkan** → config disimpan di `localStorage` browser ini, lalu:
   - jika situs **belum punya admin**, akun dibuat otomatis di Firebase Authentication dan langsung diklaim sebagai *owner* (hanya bisa **sekali** per proyek, dijaga rules lewat `meta/install`);
   - jika sudah ada, login biasa.
7. **Segera ganti password** di **Akun Saya**. Selama masih `123`, banner peringatan tampil di semua halaman admin.
8. (Opsional) **Isi Data Demo** untuk mencoba tampilan publik.

### Tentang username & password

Firebase Auth hanya menerima email dan password ≥ 6 karakter, jadi panel memetakan:
- username tanpa `@` → email internal: `admin` → `admin@simpleblog.local` (email asli juga boleh dipakai);
- password < 6 karakter → diberi akhiran tetap sebelum dikirim ke Firebase (`123` tetap bisa dipakai).

Dua lapis login:

| Kondisi | Cara login | Akses |
|---|---|---|
| Firebase belum diatur | Lokal (hash password di `localStorage`), default `admin`/`123` | Setup Firebase, Akun |
| Firebase diatur | Firebase Authentication | Semua menu (jika admin) |
| Firebase diatur tapi tidak bisa dihubungi | Fallback ke login lokal | Setup Firebase, Akun (untuk memperbaiki config) |

> Login lokal hanya gerbang panel di satu browser; ia **tidak** memberi akses ke data. Data dijaga Firebase Auth + `firestore.rules`. Bila password Firebase salah, login ditolak — fallback lokal hanya dipakai saat Firebase tak terjangkau.

> ⚠ Pada situs yang sudah di-deploy tetapi belum diinstal, siapa pun yang lebih dulu login dengan `admin`/`123` akan menjadi owner. Lakukan instalasi segera setelah deploy (atau sebelum deploy, dari lokal).

### Menambah admin lain

Buat user di Authentication (email asli, password ≥ 6), lalu tambahkan dokumen `admins/<UID user>` di Firestore Console (isi field bebas, mis. `email`). UID terlihat di halaman Setup setelah user tersebut login.

### Pesan error umum

| Pesan | Penyebab |
|---|---|
| `permission-denied` | Rules belum di-deploy / akun bukan admin |
| Waktu habis membaca Firestore | `projectId` salah atau Firestore belum dibuat |
| `auth/operation-not-allowed` | Email/Password belum diaktifkan |
| `auth/invalid-credential` | Email/password salah |
| `auth/configuration-not-found` | Authentication belum diaktifkan |

## 4. Konfigurasi untuk pengunjung publik

Config di `localStorage` hanya berlaku di browser admin. Untuk pengunjung:

1. Di halaman Setup klik **Unduh firebase-config.js**.
2. Timpa file `config/firebase-config.js` dengan file tersebut.

> `apiKey` Firebase **bukan rahasia** — memang dirancang untuk ada di kode klien. Keamanan data sepenuhnya diatur oleh `firestore.rules`.

Urutan prioritas config: `localStorage` (browser admin) → `config/firebase-config.js`.

## 5. Deploy

Situs ini statis, bisa di-host di mana saja (Firebase Hosting, Netlify, GitHub Pages, cPanel, dll.) karena routing memakai hash (`#/...`) sehingga tidak butuh rewrite server.

Dengan Firebase Hosting (sudah dikonfigurasi di `firebase.json`):

```bash
firebase deploy --only hosting,firestore:rules
```

Checklist sebelum deploy:
- [ ] `config/firebase-config.js` sudah berisi config proyek
- [ ] `firestore.rules` sudah di-deploy
- [ ] Admin pertama sudah diklaim
- [ ] (Disarankan) Tambahkan domain hosting di **Authentication › Settings › Authorized domains**
