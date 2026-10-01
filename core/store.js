// SimpleBlog — lapisan data Firestore. Semua akses database lewat modul ini.
//
// Koleksi:
//   settings/site          pengaturan situs
//   posts/{id}             tulisan
//   categories/{id}        kategori
//   tags/{id}              tag
//   comments/{id}          komentar
//   admins/{uid}           daftar admin (Firebase Auth UID)
//   meta/install           penanda instalasi (admin pertama sudah diklaim)

import {
  getDb, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, writeBatch, serverTimestamp, Timestamp, arrayRemove,
} from './firebase.js';
import { slugify, toDate } from './utils.js';

export const DEFAULT_SETTINGS = {
  // Umum
  title: 'SimpleBlog',
  tagline: 'Blog sederhana berbasis Firebase',
  siteUrl: '',
  language: 'id',
  dateFormat: 'D MMMM YYYY',
  // Menulis
  author: '',
  defaultCategoryId: '',
  defaultPostStatus: 'draft',
  defaultAllowComments: true,
  // Membaca
  postsPerPage: 6,
  excerptLength: 180,
  showCategoriesInNav: true,
  discourageSearch: false,
  // Diskusi
  commentsEnabled: true,
  commentModeration: true,
  closeCommentsAfterDays: 0,
  commentsOrder: 'asc',
  // SEO
  description: '',
  keywords: '',
  ogImage: '',
  // Tampilan
  theme: 'default',
  logoUrl: '',
  faviconUrl: '',
  footerText: '',
  customCss: '',
  themeOptions: {},   // { [tema]: { [idOpsi]: nilai } } — Tampilan › Kustomisasi
};

const col = (name) => collection(getDb(), name);
const ref = (name, id) => doc(getDb(), name, id);
const withId = (snap) => ({ id: snap.id, ...snap.data() });

export function sortByDate(items, field = 'publishedAt') {
  return items.sort((a, b) =>
    (toDate(b[field] || b.createdAt)?.getTime() || 0) - (toDate(a[field] || a.createdAt)?.getTime() || 0));
}

// --- Settings ---------------------------------------------------------------
export async function getSettings() {
  const snap = await getDoc(ref('settings', 'site'));
  return { ...DEFAULT_SETTINGS, ...(snap.exists() ? snap.data() : {}) };
}

export async function saveSettings(data) {
  await setDoc(ref('settings', 'site'), { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

// --- Posts ------------------------------------------------------------------
/** status: 'published' | 'draft' | undefined (semua — hanya admin). */
export async function listPosts({ status } = {}) {
  const q = status ? query(col('posts'), where('status', '==', status)) : col('posts');
  const snap = await getDocs(q);
  return sortByDate(snap.docs.map(withId));
}

/** Post yang tampil ke publik: published & tanggal terbit sudah lewat. */
export async function listPublicPosts() {
  const now = Date.now();
  return (await listPosts({ status: 'published' }))
    .filter((p) => (toDate(p.publishedAt)?.getTime() || 0) <= now);
}

export async function getPost(id) {
  const snap = await getDoc(ref('posts', id));
  return snap.exists() ? withId(snap) : null;
}

export async function isSlugTaken(slug, exceptId) {
  const snap = await getDocs(query(col('posts'), where('slug', '==', slug)));
  return snap.docs.some((d) => d.id !== exceptId);
}

export async function savePost(id, data) {
  const payload = { ...data, slug: slugify(data.slug || data.title), updatedAt: serverTimestamp() };
  if (payload.status === 'published' && !payload.publishedAt) payload.publishedAt = Timestamp.now();
  if (payload.publishedAt instanceof Date) payload.publishedAt = Timestamp.fromDate(payload.publishedAt);
  if (id) {
    await updateDoc(ref('posts', id), payload);
    return id;
  }
  payload.createdAt = serverTimestamp();
  const created = await addDoc(col('posts'), payload);
  return created.id;
}

/** Hapus post beserta komentarnya. */
/** Ubah status satu post (terbit / draf) tanpa menyentuh field lain. */
export async function setPostStatus(post, status) {
  const data = { status, updatedAt: serverTimestamp() };
  if (status === 'published' && !post.publishedAt) data.publishedAt = Timestamp.now();
  await updateDoc(ref('posts', post.id), data);
  return data;
}

export async function deletePost(id) {
  const comments = await getDocs(query(col('comments'), where('postId', '==', id)));
  const batch = writeBatch(getDb());
  comments.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(ref('posts', id));
  await batch.commit();
}

// --- Taxonomy (categories / tags) --------------------------------------------
export const TAXONOMY_FIELD = { categories: 'categoryIds', tags: 'tagIds' };

export async function listTerms(type) {
  const snap = await getDocs(col(type));
  return snap.docs.map(withId).sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveTerm(type, id, data) {
  const payload = {
    name: data.name.trim(),
    slug: slugify(data.slug || data.name),
    description: data.description?.trim() || '',
    updatedAt: serverTimestamp(),
  };
  if (id) { await updateDoc(ref(type, id), payload); return id; }
  payload.createdAt = serverTimestamp();
  return (await addDoc(col(type), payload)).id;
}

/** Hapus term dan lepaskan dari semua post yang memakainya. */
export async function deleteTerm(type, id) {
  const field = TAXONOMY_FIELD[type];
  const posts = await getDocs(query(col('posts'), where(field, 'array-contains', id)));
  const batch = writeBatch(getDb());
  posts.docs.forEach((d) => batch.update(d.ref, { [field]: arrayRemove(id) }));
  batch.delete(ref(type, id));
  await batch.commit();
}

/** Ubah daftar nama tag menjadi daftar ID, membuat tag baru bila belum ada. */
export async function ensureTags(names, existing) {
  const tags = existing || await listTerms('tags');
  const ids = [];
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    const slug = slugify(name);
    let tag = tags.find((t) => t.slug === slug);
    if (!tag) {
      tag = { id: await saveTerm('tags', null, { name }), name, slug };
      tags.push(tag);
    }
    if (!ids.includes(tag.id)) ids.push(tag.id);
  }
  return ids;
}

// --- Comments ---------------------------------------------------------------
export async function listComments({ status, postId } = {}) {
  const filters = [];
  if (status) filters.push(where('status', '==', status));
  if (postId) filters.push(where('postId', '==', postId));
  const snap = await getDocs(filters.length ? query(col('comments'), ...filters) : col('comments'));
  return sortByDate(snap.docs.map(withId), 'createdAt');
}

/** Komentar publik yang sudah disetujui untuk satu post (diurutkan lama → baru). */
export async function listApprovedComments(postId) {
  return (await listComments({ status: 'approved', postId })).reverse();
}

export async function addComment({ postId, postTitle, name, website = '', content, parentId = '' }, { moderation = true } = {}) {
  const data = {
    postId,
    postTitle,
    name: name.trim().slice(0, 80),
    website: /^https?:\/\/.+/i.test(website.trim()) ? website.trim().slice(0, 200) : '',
    content: content.trim().slice(0, 5000),
    parentId,
    status: moderation ? 'pending' : 'approved',
    createdAt: serverTimestamp(),
  };
  return (await addDoc(col('comments'), data)).id;
}

export async function setCommentStatus(id, status) {
  await updateDoc(ref('comments', id), { status });
}

export async function deleteComment(id) {
  await deleteDoc(ref('comments', id));
}

// --- Tema: override file template & opsi kustomisasi ------------------------
// themeFiles/{tema~kunci} = { theme, key, content, updatedAt }
const themeFileId = (theme, key) => `${theme}~${key}`.replace(/[^\w.~-]/g, '_');

/** Semua override file untuk satu tema: { [key]: content } */
export async function listThemeFiles(theme) {
  const snap = await getDocs(query(col('themeFiles'), where('theme', '==', theme)));
  return Object.fromEntries(snap.docs.map((d) => [d.data().key, d.data().content]));
}

export async function saveThemeFile(theme, key, content) {
  await setDoc(ref('themeFiles', themeFileId(theme, key)), { theme, key, content, updatedAt: serverTimestamp() });
}

export async function deleteThemeFile(theme, key) {
  await deleteDoc(ref('themeFiles', themeFileId(theme, key)));
}

/** Simpan nilai Kustomisasi untuk satu tema (settings/site.themeOptions.<tema>). */
export async function saveThemeOptions(theme, values) {
  await setDoc(ref('settings', 'site'), { themeOptions: { [theme]: values }, updatedAt: serverTimestamp() }, { merge: true });
}

// --- Admin & instalasi ------------------------------------------------------
export async function isAdmin(uid) {
  if (!uid) return false;
  try {
    return (await getDoc(ref('admins', uid))).exists();
  } catch {
    return false;
  }
}

/** Data dokumen admins/{uid} atau null bila bukan admin. */
export async function getAdmin(uid) {
  if (!uid) return null;
  try {
    const snap = await getDoc(ref('admins', uid));
    return snap.exists() ? snap.data() : null;
  } catch {
    return null;
  }
}

export async function updateAdmin(uid, data) {
  await updateDoc(ref('admins', uid), data);
}

export async function isInstalled() {
  return (await getDoc(ref('meta', 'install'))).exists();
}

/** Klaim admin pertama (hanya berhasil jika meta/install belum ada — dijaga rules). */
export async function claimFirstAdmin(user, extra = {}) {
  const batch = writeBatch(getDb());
  batch.set(ref('admins', user.uid), { email: user.email, role: 'owner', createdAt: serverTimestamp(), ...extra });
  batch.set(ref('meta', 'install'), { by: user.uid, at: serverTimestamp(), version: 1 });
  await batch.commit();
}

/** Isi data contoh: kategori, tag, beberapa post, dan pengaturan default. */
export async function seedDemo() {
  const settingsSnap = await getDoc(ref('settings', 'site'));
  if (!settingsSnap.exists()) await saveSettings(DEFAULT_SETTINGS);

  const catTech = await saveTerm('categories', null, { name: 'Teknologi', description: 'Seputar teknologi dan pemrograman.' });
  const catLife = await saveTerm('categories', null, { name: 'Catatan', description: 'Catatan harian dan opini.' });
  const tagIds = await ensureTags(['firebase', 'javascript', 'tutorial']);

  const now = Date.now();
  const posts = [
    {
      title: 'Selamat Datang di SimpleBlog',
      excerpt: 'Blog ini dibangun dengan HTML, CSS, JavaScript murni dan Firebase.',
      content: '## Halo!\n\nIni adalah **post pertama** di SimpleBlog. Ubah atau hapus post ini dari panel admin.\n\n- Tulis post dengan Markdown\n- Kelola kategori & tag\n- Moderasi komentar\n\n> Tema bisa dikustomisasi lewat folder `themes/`.',
      categoryIds: [catLife], tagIds: [tagIds[2]],
    },
    {
      title: 'Membuat Tema Sendiri',
      excerpt: 'Cara menyalin tema default dan mengubah template-nya.',
      content: '## Langkah\n\n1. Salin `themes/default` menjadi `themes/namaku`\n2. Ubah `theme.json`\n3. Pilih tema di **Admin › Pengaturan**\n\n```html\n{{#each posts}}\n  {{> post-card}}\n{{/each}}\n```',
      categoryIds: [catTech], tagIds: [tagIds[1], tagIds[2]],
    },
    {
      title: 'Kenapa Firebase?',
      excerpt: 'Database realtime tanpa server sendiri, cocok untuk blog statis.',
      content: 'Firebase Firestore memungkinkan situs statis memiliki database tanpa backend sendiri. Keamanan diatur oleh **Security Rules**.',
      categoryIds: [catTech], tagIds: [tagIds[0]],
    },
  ];
  for (const [i, p] of posts.entries()) {
    await savePost(null, {
      ...p,
      slug: slugify(p.title),
      status: 'published',
      coverImage: '',
      allowComments: true,
      metaTitle: '',
      metaDescription: '',
      authorName: 'Admin',
      publishedAt: new Date(now - i * 86400000),
    });
  }
}
