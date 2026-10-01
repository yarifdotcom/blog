// SimpleBlog — inisialisasi Firebase (SDK modular dari CDN, tanpa build step).
// Konfigurasi dibaca dari (urutan prioritas):
//   1. localStorage  (diisi lewat Admin › Setup Firebase, hanya berlaku di browser tsb)
//   2. config/firebase-config.js  (dipakai pengunjung publik — wajib diisi saat deploy)

import { initializeApp, deleteApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore, connectFirestoreEmulator, terminate } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getAuth, connectAuthEmulator } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import fileConfig from '../config/firebase-config.js';

export {
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, writeBatch, serverTimestamp, Timestamp, arrayRemove,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
export {
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged,
  updatePassword, reauthenticateWithCredential, EmailAuthProvider,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
export { initializeApp, deleteApp, getFirestore, getAuth };

const LS_KEY = 'simpleblog.firebaseConfig';
// Mode development: localStorage.setItem('simpleblog.emulator', '127.0.0.1') untuk memakai
// Firebase Emulator Suite (Firestore :8080, Auth :9099). Hapus key untuk kembali ke produksi.
const EMULATOR_KEY = 'simpleblog.emulator';
export const CONFIG_FIELDS = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId', 'measurementId'];

let app = null;
let db = null;
let auth = null;

// Saat halaman masuk back-forward cache, tutup koneksi Firestore agar tidak menahan
// koneksi terbuka; saat dipulihkan (tombol Back), muat ulang supaya data & koneksi segar.
window.addEventListener('pagehide', (e) => { if (e.persisted && db) terminate(db); });
window.addEventListener('pageshow', (e) => { if (e.persisted) location.reload(); });

export function isConfigValid(c) {
  return !!(c && c.apiKey && c.projectId && c.authDomain);
}

export function getLocalConfig() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch { return null; }
}
export function saveLocalConfig(config) {
  localStorage.setItem(LS_KEY, JSON.stringify(cleanConfig(config)));
}
export function clearLocalConfig() {
  localStorage.removeItem(LS_KEY);
}
export function getFileConfig() {
  return fileConfig || null;
}

/** Konfigurasi aktif + sumbernya ('local' | 'file' | null). */
export function loadConfig() {
  const local = getLocalConfig();
  if (isConfigValid(local)) return { config: local, source: 'local' };
  if (isConfigValid(fileConfig)) return { config: fileConfig, source: 'file' };
  return { config: null, source: null };
}

export function cleanConfig(c = {}) {
  const out = {};
  for (const k of CONFIG_FIELDS) if (c[k]) out[k] = String(c[k]).trim();
  return out;
}

/**
 * Parse config yang ditempel dari Firebase Console. Menerima JSON maupun
 * potongan JS seperti: const firebaseConfig = { apiKey: "...", ... };
 */
export function parseConfigText(text) {
  const out = {};
  const re = /["']?(\w+)["']?\s*:\s*["']([^"']*)["']/g;
  let m;
  while ((m = re.exec(text))) if (CONFIG_FIELDS.includes(m[1])) out[m[1]] = m[2];
  return out;
}

/** Inisialisasi (atau re-inisialisasi) Firebase dengan config tertentu. */
export async function initFirebase(config = loadConfig().config) {
  if (!isConfigValid(config)) throw new Error('Konfigurasi Firebase belum diisi.');
  if (app) await deleteApp(app);
  app = initializeApp(cleanConfig(config));
  db = getFirestore(app);
  auth = getAuth(app);
  connectEmulators(db, auth);
  return { app, db, auth };
}

export function getEmulatorHost() {
  try { return localStorage.getItem(EMULATOR_KEY) || ''; } catch { return ''; }
}

/** Sambungkan instance ke emulator lokal bila mode emulator aktif. */
export function connectEmulators(firestore, authInstance) {
  const host = getEmulatorHost();
  if (!host) return;
  connectFirestoreEmulator(firestore, host, 8080);
  connectAuthEmulator(authInstance, `http://${host}:9099`, { disableWarnings: true });
}

export const getDb = () => {
  if (!db) throw new Error('Firebase belum diinisialisasi.');
  return db;
};
export const getAuthInstance = () => auth;
export const isReady = () => !!db;

/** Isi file config/firebase-config.js untuk diunduh & di-deploy. */
export function buildConfigFile(config) {
  return `// SimpleBlog — konfigurasi Firebase untuk pengunjung publik.
// File ini dibuat dari Admin › Setup Firebase. Nilai di sini memang publik
// (keamanan data diatur oleh firestore.rules, bukan oleh kerahasiaan apiKey).
export default ${JSON.stringify(cleanConfig(config), null, 2)};
`;
}
