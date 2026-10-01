// YarifBlog Admin — autentikasi.
//
// Dua lapis:
//  1. Login LOKAL (per browser) — berlaku sebelum Firebase dikonfigurasi, agar admin
//     bisa masuk dan mengisi Setup Firebase. Default: admin / 123.
//     Catatan: ini hanya gerbang panel di browser, bukan pengaman data.
//  2. Login FIREBASE — pengaman sebenarnya. Username tanpa "@" dipetakan ke email
//     internal (admin -> admin@simpleblog.local) dan password pendek diberi akhiran
//     tetap, karena Firebase Auth mewajibkan email & password minimal 6 karakter.
//     Jika situs belum punya admin, akun dibuat otomatis lalu diklaim sebagai owner.

import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  updatePassword, reauthenticateWithCredential, EmailAuthProvider,
} from '../../core/firebase.js';

export const DEFAULT_USERNAME = 'admin';
export const DEFAULT_PASSWORD = '123';
const LOCAL_DOMAIN = 'simpleblog.local';
const PAD = '#simpleblog';
const LS_CRED = 'simpleblog.localAdmin';
const SS_SESSION = 'simpleblog.localSession';

/** Error Firebase yang berarti "akun/password salah" (bukan masalah koneksi/config). */
export const CREDENTIAL_ERRORS = [
  'auth/invalid-credential', 'auth/user-not-found', 'auth/wrong-password',
  'auth/invalid-login-credentials', 'auth/invalid-email',
];

export const toEmail = (username) => {
  const u = String(username || '').trim().toLowerCase();
  return u.includes('@') ? u : `${u}@${LOCAL_DOMAIN}`;
};

/** Nama tampilan: admin@simpleblog.local -> admin */
export const displayName = (email = '') =>
  (email.endsWith(`@${LOCAL_DOMAIN}`) ? email.slice(0, -LOCAL_DOMAIN.length - 1) : email);

/** Password yang dikirim ke Firebase (deterministik; password ≥ 6 karakter tidak diubah). */
export const toAuthPassword = (password) => (String(password).length >= 6 ? String(password) : `${password}${PAD}`);

// ---------------------------------------------------------------------------
// Login lokal
// ---------------------------------------------------------------------------
async function hash(text) {
  const data = new TextEncoder().encode(`simpleblog:${text}`);
  if (globalThis.crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback (konteks non-HTTPS selain localhost): FNV-1a 32-bit.
  let h = 0x811c9dc5;
  for (const b of data) { h ^= b; h = Math.imul(h, 0x01000193) >>> 0; }
  return `fnv-${h.toString(16)}`;
}

function readLocalCred() {
  try { return JSON.parse(localStorage.getItem(LS_CRED) || 'null'); } catch { return null; }
}

export async function checkLocal(username, password) {
  const cred = readLocalCred();
  if (!cred) return username === DEFAULT_USERNAME && password === DEFAULT_PASSWORD;
  return username === cred.username && (await hash(password)) === cred.hash;
}

export async function setLocalPassword(password, username = readLocalCred()?.username || DEFAULT_USERNAME) {
  localStorage.setItem(LS_CRED, JSON.stringify({ username, hash: await hash(password) }));
}

export const isLocalDefault = () => !readLocalCred();
export const localUsername = () => readLocalCred()?.username || DEFAULT_USERNAME;

// Sesi lokal disimpan di localStorage agar tetap login di tab lain sampai "Keluar".
export function startLocalSession(username) { localStorage.setItem(SS_SESSION, username); }
export function getLocalSession() { try { return localStorage.getItem(SS_SESSION); } catch { return null; } }
export function clearLocalSession() { localStorage.removeItem(SS_SESSION); }

// ---------------------------------------------------------------------------
// Login Firebase
// ---------------------------------------------------------------------------
/**
 * Login ke Firebase. Jika akun belum ada dan situs belum diinstal (belum ada admin),
 * akun dibuat otomatis. Kembalikan { user, created }.
 */
export async function signInFirebase(auth, username, password, { canBootstrap = false } = {}) {
  const email = toEmail(username);
  const pw = toAuthPassword(password);
  try {
    const cred = await signInWithEmailAndPassword(auth, email, pw);
    return { user: cred.user, created: false };
  } catch (err) {
    if (!canBootstrap || !CREDENTIAL_ERRORS.includes(err.code)) throw err;
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pw);
      return { user: cred.user, created: true };
    } catch (createErr) {
      // Akun sudah ada → berarti password memang salah.
      throw createErr.code === 'auth/email-already-in-use' ? err : createErr;
    }
  }
}

/** Ganti password Firebase (butuh password lama untuk re-autentikasi). */
export async function changeFirebasePassword(user, currentPassword, newPassword) {
  const credential = EmailAuthProvider.credential(user.email, toAuthPassword(currentPassword));
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, toAuthPassword(newPassword));
}

export const AUTH_MESSAGES = {
  'auth/invalid-credential': 'Username atau password salah.',
  'auth/invalid-login-credentials': 'Username atau password salah.',
  'auth/wrong-password': 'Username atau password salah.',
  'auth/user-not-found': 'Username atau password salah.',
  'auth/invalid-email': 'Format username/email tidak valid.',
  'auth/too-many-requests': 'Terlalu banyak percobaan. Coba lagi nanti.',
  'auth/operation-not-allowed': 'Login Email/Password belum diaktifkan di Firebase Console › Authentication.',
  'auth/admin-restricted-operation': 'Pendaftaran akun dinonaktifkan di Firebase. Buat user secara manual di Console › Authentication.',
  'auth/configuration-not-found': 'Authentication belum diaktifkan di proyek Firebase ini.',
  'auth/network-request-failed': 'Gagal terhubung ke server Firebase.',
  'auth/requires-recent-login': 'Sesi terlalu lama, silakan keluar lalu masuk kembali.',
};
export const authMessage = (err) => AUTH_MESSAGES[err?.code] || err?.message || String(err);
