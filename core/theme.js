// YarifBlog — pemuat tema.
//
// Membaca themes/<nama>/theme.json lalu memuat layout, template, partial, stylesheet,
// dan (opsional) script tema. Fitur:
//   - Child theme: "extends": "default" mewarisi semua file induk; file yang ditulis ulang menimpa.
//   - Override: isi file dari Firestore (Admin › Tampilan › Editor Template) menimpa file asli.
//   - Opsi tema: skema "options" di theme.json → nilai dari Admin › Tampilan › Kustomisasi.
//
// Setiap file punya "kunci" logis yang dipakai override & editor:
//   layout | template:<view> | partial:<nama> | style:<tema>/<file.css>
// Template, partial & layout milik child theme MENIMPA milik induk (nama sama);
// stylesheet selalu BERTUMPUK (induk dulu, lalu anak) karena kuncinya memuat nama tema.

import { TemplateEngine, safe } from './template.js';

async function fetchText(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Gagal memuat ${url} (${res.status})`);
  return res.text();
}

const MAX_DEPTH = 5;

/**
 * Baca manifest beserta rantai "extends" dan kembalikan bentuk yang sudah digabung:
 * { id, name, version, author, description, extends, chain, files: {key: entry}, options: [], scripts: [] }
 * entry = { key, type, name, file, url, theme }
 */
export async function resolveTheme(name, base = './themes/', depth = 0) {
  if (depth > MAX_DEPTH) throw new Error('Rantai "extends" tema terlalu dalam / melingkar');
  const root = `${base}${name}/`;
  const m = JSON.parse(await fetchText(root + 'theme.json'));
  const parent = m.extends ? await resolveTheme(m.extends, base, depth + 1) : null;

  const own = {};
  const add = (type, n, file) => {
    const key = type === 'layout' ? 'layout' : type === 'style' ? `style:${name}/${n}` : `${type}:${n}`;
    own[key] = { key, type, name: n, file, url: root + file, theme: name };
  };
  if (m.layout) add('layout', 'layout', m.layout);
  Object.entries(m.templates || {}).forEach(([n, f]) => add('template', n, f));
  Object.entries(m.partials || {}).forEach(([n, f]) => add('partial', n, f));
  (m.styles || []).forEach((f) => add('style', f, f));

  let files = own;
  if (parent) {
    const inherited = { ...parent.files };
    // "parentStyles": false → stylesheet induk tidak dipakai.
    if (m.parentStyles === false) Object.keys(inherited).filter((k) => k.startsWith('style:')).forEach((k) => delete inherited[k]);
    files = { ...inherited, ...own };
  }

  // Opsi: milik anak menimpa opsi induk dengan id yang sama.
  const options = [...(parent?.options || [])];
  for (const o of m.options || []) {
    const i = options.findIndex((x) => x.id === o.id);
    if (i >= 0) options[i] = { ...options[i], ...o }; else options.push(o);
  }

  return {
    id: name,
    name: m.name || name,
    version: m.version || '',
    author: m.author || '',
    description: m.description || '',
    screenshot: m.screenshot ? root + m.screenshot : null,
    extends: m.extends || null,
    chain: [name, ...(parent?.chain || [])],
    files,
    options,
    scripts: [...(parent?.scripts || []), ...(m.script ? [root + m.script] : [])],
    fonts: [...new Set([...(parent?.fonts || []), ...(m.fonts || [])])],
  };
}

/** Nilai opsi efektif: default dari skema + nilai tersimpan. */
export function resolveOptions(schema = [], values = {}) {
  const out = {};
  for (const o of schema) out[o.id] = values[o.id] ?? o.default ?? '';
  return out;
}

/** CSS variable dari opsi yang punya properti "css" (mis. "--accent"). */
export function optionsToCss(schema = [], values = {}) {
  const lines = schema
    .filter((o) => o.css && values[o.id] !== '' && values[o.id] != null)
    .map((o) => `  ${o.css}: ${values[o.id]}${o.unit || ''};`);
  return lines.length ? `:root {\n${lines.join('\n')}\n}` : '';
}

export class Theme {
  /**
   * @param {string} name
   * @param {{ base?: string, overrides?: Record<string,string>, options?: object }} opts
   *   overrides: { [key]: isi file } dari Firestore / draf pratinjau
   *   options:   nilai opsi tersimpan (belum digabung default)
   */
  constructor(name = 'default', { base = './themes/', overrides = {}, options = {} } = {}) {
    this.name = name;
    this.base = base;
    this.overrides = overrides;
    this.optionValues = options;
    this.engine = new TemplateEngine();
    this.templates = {};
    this.layout = null;
    this.manifest = null;
    this.options = {};
    this.errors = [];   // error kompilasi override (jatuh ke file asli)
    // Hook opsional yang bisa diisi script tema:
    //   extendData(view, data) -> data   menambah/mengubah data sebelum render
    //   afterRender(el, view, data)      dipanggil setelah HTML dipasang ke DOM
    this.hooks = {};
  }

  /** Kompilasi override; bila sintaksnya rusak, catat error & pakai file asli. */
  async _source(entry, compile) {
    const override = this.overrides[entry.key];
    if (override != null) {
      try {
        return compile(override);
      } catch (err) {
        this.errors.push({ key: entry.key, message: err.message });
        console.error(`[tema] override "${entry.key}" tidak valid, memakai file asli:`, err.message);
      }
    }
    return compile(await fetchText(entry.url));
  }

  async load() {
    const manifest = await resolveTheme(this.name, this.base);
    this.manifest = manifest;
    this.options = resolveOptions(manifest.options, this.optionValues);

    // Script tema (induk dulu) dimuat sebelum kompilasi agar filter kustom tersedia.
    for (const src of manifest.scripts) {
      const mod = await import(new URL(src, location.href).href);
      if (typeof mod.default === 'function') await mod.default(this);
    }

    const entries = Object.values(manifest.files);
    await Promise.all(entries.filter((e) => e.type === 'partial').map((e) =>
      this._source(e, (src) => { this.engine.registerPartial(e.name, src); })));
    await Promise.all(entries.filter((e) => e.type === 'template').map(async (e) => {
      this.templates[e.name] = await this._source(e, (src) => this.engine.compile(src));
    }));
    const layout = manifest.files.layout;
    if (layout) this.layout = await this._source(layout, (src) => this.engine.compile(src));

    // Stylesheet: file asli via <link>, override via <style>. Render menunggu CSS siap
    // (maks. 3 dtk) agar tidak ada kilasan halaman tanpa gaya.
    document.querySelectorAll('[data-theme-style]').forEach((n) => n.remove());
    const pending = [];
    for (const href of manifest.fonts) {
      // Font web (mis. Google Fonts) tidak ditunggu — teks memakai font cadangan dulu.
      const link = Object.assign(document.createElement('link'), { rel: 'stylesheet', href });
      link.dataset.themeStyle = 'font';
      document.head.appendChild(link);
    }
    for (const e of entries.filter((x) => x.type === 'style')) {
      let node;
      if (this.overrides[e.key] != null) {
        node = document.createElement('style');
        node.textContent = this.overrides[e.key];
      } else {
        node = document.createElement('link');
        node.rel = 'stylesheet';
        node.href = e.url;
        pending.push(new Promise((resolve) => { node.onload = resolve; node.onerror = resolve; }));
      }
      node.dataset.themeStyle = e.key;
      document.head.appendChild(node);
    }
    await Promise.race([Promise.all(pending), new Promise((r) => setTimeout(r, 3000))]);
    const vars = document.createElement('style');
    vars.dataset.themeStyle = 'options';
    vars.textContent = optionsToCss(manifest.options, this.options);
    document.head.appendChild(vars);
    return this;
  }

  has(view) { return !!this.templates[view]; }

  /** Render view di dalam layout. Data view tersedia juga di layout. */
  render(view, data) {
    const tpl = this.templates[view] || this.templates['404'];
    if (!tpl) throw new Error(`Template "${view}" tidak ada di tema "${this.name}"`);
    data = { ...data, options: this.options, themeName: this.name };
    if (this.hooks.extendData) data = this.hooks.extendData(view, data) || data;
    const content = tpl(data);
    return this.layout ? this.layout({ ...data, content: safe(content) }) : content;
  }
}
