// YarifBlog — router berbasis hash (#/path?query). Tidak butuh rewrite server.

export class Router {
  constructor() {
    this.routes = [];
    this.fallback = null;
    this.before = null;
  }

  /** router.on('/post/:slug', ({ params, query }) => ...) */
  on(pattern, handler) {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/\/:(\w+)/g, (_, k) => { keys.push(k); return '/([^/]+)'; }) + '/?$');
    this.routes.push({ pattern, re, keys, handler });
    return this;
  }

  otherwise(handler) { this.fallback = handler; return this; }

  /** Guard: dipanggil sebelum handler; kembalikan string path untuk redirect. */
  guard(fn) { this.before = fn; return this; }

  current() {
    const raw = location.hash.slice(1) || '/';
    const [path, qs = ''] = raw.split('?');
    return { path: path || '/', query: Object.fromEntries(new URLSearchParams(qs)) };
  }

  async resolve() {
    const { path, query } = this.current();
    for (const r of this.routes) {
      const m = path.match(r.re);
      if (!m) continue;
      const params = {};
      r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      const ctx = { path, query, params, pattern: r.pattern };
      if (this.before) {
        const redirect = await this.before(ctx);
        if (redirect && redirect !== path) { this.navigate(redirect); return; }
      }
      return r.handler(ctx);
    }
    return this.fallback?.({ path, query, params: {} });
  }

  start() {
    window.addEventListener('hashchange', () => this.resolve());
    return this.resolve();
  }

  navigate(path) {
    if (location.hash.slice(1) === path) this.resolve();
    else location.hash = path;
  }
}
