// YarifBlog — Template Engine
// Sintaks mirip Handlebars/Twig:
//   {{ expr }}               output (di-escape)
//   {{{ expr }}}             output mentah (tanpa escape)
//   {{ expr | filter:arg }}  filter berantai
//   {{#if cond}}..{{else if cond}}..{{else}}..{{/if}}
//   {{#unless cond}}..{{/unless}}
//   {{#each list}}..{{else}}..{{/each}}   (this, @index, @number, @first, @last, @key)
//   {{#each list as item}}..{{/each}}
//   {{#with obj}}..{{/with}}
//   {{> partial}}  /  {{> partial expr}}
//   {{!-- komentar --}}
// Kondisi mendukung: == != === !== > < >= <=  and/&&  or/||  not/!  dan tanda kurung.

import { escapeHtml, formatDate, truncate, stripHtml, slugify, timeAgo } from './utils.js';
import { markdown } from './markdown.js';

/** Penanda string yang sudah aman (tidak akan di-escape lagi). */
export class SafeString {
  constructor(value) { this.value = String(value ?? ''); }
  toString() { return this.value; }
}
export const safe = (v) => (v instanceof SafeString ? v : new SafeString(v));

const unwrap = (v) => (v instanceof SafeString ? v.value : v);

// ---------------------------------------------------------------------------
// Filter bawaan
// ---------------------------------------------------------------------------
export const defaultFilters = {
  upper: (v) => String(unwrap(v) ?? '').toUpperCase(),
  lower: (v) => String(unwrap(v) ?? '').toLowerCase(),
  capitalize: (v) => { const s = String(unwrap(v) ?? ''); return s.charAt(0).toUpperCase() + s.slice(1); },
  trim: (v) => String(unwrap(v) ?? '').trim(),
  default: (v, d = '') => (v == null || v === '' || (Array.isArray(v) && !v.length) ? d : v),
  truncate: (v, n = 100, suffix = '…') => truncate(unwrap(v), Number(n), suffix),
  date: (v, fmt = 'D MMMM YYYY', locale = 'id') => formatDate(v, fmt, locale),
  timeago: (v, locale = 'id') => timeAgo(v, locale),
  markdown: (v) => safe(markdown(unwrap(v))),
  safe: (v) => safe(unwrap(v)),
  raw: (v) => safe(unwrap(v)),
  escape: (v) => escapeHtml(unwrap(v)),
  json: (v, indent) => JSON.stringify(v, null, indent ? Number(indent) : undefined),
  striptags: (v) => stripHtml(unwrap(v)),
  excerpt: (v, n = 160) => truncate(stripHtml(unwrap(v)), Number(n)),
  length: (v) => (v == null ? 0 : (v.length ?? Object.keys(v).length)),
  join: (v, sep = ', ') => (Array.isArray(v) ? v.join(sep) : v),
  first: (v) => (Array.isArray(v) ? v[0] : v),
  last: (v) => (Array.isArray(v) ? v[v.length - 1] : v),
  limit: (v, n) => (Array.isArray(v) ? v.slice(0, Number(n)) : v),
  reverse: (v) => (Array.isArray(v) ? [...v].reverse() : String(v ?? '').split('').reverse().join('')),
  map: (v, key) => (Array.isArray(v) ? v.map((x) => x?.[key]) : v),
  slug: (v) => slugify(unwrap(v)),
  urlencode: (v) => encodeURIComponent(unwrap(v) ?? ''),
  nl2br: (v) => safe(escapeHtml(unwrap(v)).replace(/\n/g, '<br>')),
  initials: (v) => String(unwrap(v) ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join(''),
  plural: (n, one, many) => (Number(n) === 1 ? one : many),
  number: (v, locale = 'id-ID') => Number(v || 0).toLocaleString(locale),
};

// ---------------------------------------------------------------------------
// Tokenizer template
// ---------------------------------------------------------------------------
const TAG_RE = /\{\{!--[\s\S]*?--\}\}|\{\{\{([\s\S]+?)\}\}\}|\{\{([\s\S]+?)\}\}/g;

function tokenize(src) {
  const tokens = [];
  let last = 0;
  let m;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(src))) {
    if (m.index > last) tokens.push({ type: 'text', value: src.slice(last, m.index) });
    last = TAG_RE.lastIndex;
    if (m[1] === undefined && m[2] === undefined) continue; // komentar {{!-- --}}
    if (m[1] !== undefined) { tokens.push({ type: 'var', expr: m[1].trim(), raw: true }); continue; }

    const body = m[2].trim();
    let mm;
    if (body.startsWith('!')) continue; // komentar {{! ... }}
    if ((mm = body.match(/^#(\w+)\s*([\s\S]*)$/))) tokens.push({ type: 'open', name: mm[1], expr: mm[2].trim() });
    else if (body.startsWith('/')) tokens.push({ type: 'close', name: body.slice(1).trim() });
    else if (body === 'else') tokens.push({ type: 'else' });
    else if ((mm = body.match(/^else\s+if\s+([\s\S]+)$/))) tokens.push({ type: 'elseif', expr: mm[1].trim() });
    else if ((mm = body.match(/^>\s*([\w./-]+)\s*([\s\S]*)$/))) tokens.push({ type: 'partial', name: mm[1], expr: mm[2].trim() });
    else tokens.push({ type: 'var', expr: body, raw: false });
  }
  if (last < src.length) tokens.push({ type: 'text', value: src.slice(last) });
  return tokens;
}

// ---------------------------------------------------------------------------
// Parser -> AST
// ---------------------------------------------------------------------------
function parse(tokens) {
  const root = { type: 'root', children: [] };
  const stack = [{ node: root, name: null, target: root.children }];

  for (const t of tokens) {
    const top = stack[stack.length - 1];
    switch (t.type) {
      case 'text':
      case 'var':
      case 'partial':
        top.target.push(t);
        break;
      case 'open': {
        let node;
        let target;
        if (t.name === 'if' || t.name === 'unless') {
          node = { type: 'if', negate: t.name === 'unless', branches: [{ expr: t.expr, children: [] }], elseChildren: null };
          target = node.branches[0].children;
        } else if (t.name === 'each') {
          const am = t.expr.match(/^([\s\S]+?)\s+as\s+(\w+)(?:\s*,\s*(\w+))?$/);
          node = { type: 'each', expr: am ? am[1] : t.expr, alias: am?.[2], indexAlias: am?.[3], children: [], elseChildren: null };
          target = node.children;
        } else if (t.name === 'with') {
          node = { type: 'with', expr: t.expr, children: [], elseChildren: null };
          target = node.children;
        } else {
          throw new Error(`Template: blok tidak dikenal {{#${t.name}}}`);
        }
        top.target.push(node);
        stack.push({ node, name: t.name, target });
        break;
      }
      case 'elseif':
        if (top.node.type !== 'if' || top.node.elseChildren) throw new Error('Template: {{else if}} di luar {{#if}}');
        top.node.branches.push({ expr: t.expr, children: [] });
        top.target = top.node.branches[top.node.branches.length - 1].children;
        break;
      case 'else':
        if (stack.length === 1) throw new Error('Template: {{else}} di luar blok');
        top.node.elseChildren = [];
        top.target = top.node.elseChildren;
        break;
      case 'close':
        if (top.name !== t.name) throw new Error(`Template: {{/${t.name}}} tidak cocok dengan {{#${top.name ?? '?'}}}`);
        stack.pop();
        break;
      default:
        break;
    }
  }
  if (stack.length > 1) throw new Error(`Template: blok {{#${stack[stack.length - 1].name}}} belum ditutup`);
  return root;
}

// ---------------------------------------------------------------------------
// Ekspresi: path, literal, operator perbandingan & logika, filter
// ---------------------------------------------------------------------------
const EXPR_TOKEN_RE = /\s*(?:("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(-?\d+(?:\.\d+)?)(?![\w.])|(===|!==|==|!=|>=|<=|&&|\|\||[()<>!])|([@\w$][\w$.@-]*))/y;

function lexExpr(src) {
  const out = [];
  EXPR_TOKEN_RE.lastIndex = 0;
  let pos = 0;
  while (pos < src.length) {
    if (!src.slice(pos).trim()) break;
    EXPR_TOKEN_RE.lastIndex = pos;
    const m = EXPR_TOKEN_RE.exec(src);
    if (!m) throw new Error(`Template: ekspresi tidak valid "${src}"`);
    pos = EXPR_TOKEN_RE.lastIndex;
    if (m[1] !== undefined) out.push({ t: 'lit', v: m[1].slice(1, -1).replace(/\\(.)/g, '$1') });
    else if (m[2] !== undefined) out.push({ t: 'lit', v: Number(m[2]) });
    else if (m[3] !== undefined) out.push({ t: 'op', v: m[3] });
    else {
      const w = m[4];
      if (w === 'and') out.push({ t: 'op', v: '&&' });
      else if (w === 'or') out.push({ t: 'op', v: '||' });
      else if (w === 'not') out.push({ t: 'op', v: '!' });
      else if (w === 'true' || w === 'false') out.push({ t: 'lit', v: w === 'true' });
      else if (w === 'null' || w === 'undefined') out.push({ t: 'lit', v: null });
      else out.push({ t: 'path', v: w });
    }
  }
  return out;
}

/** Ubah ekspresi menjadi AST kecil (recursive descent). */
function parseExpr(src) {
  const toks = lexExpr(src);
  let i = 0;
  const peek = () => toks[i];
  const isOp = (v) => peek()?.t === 'op' && peek().v === v;

  function primary() {
    const tok = toks[i++];
    if (!tok) throw new Error(`Template: ekspresi tidak lengkap "${src}"`);
    if (tok.t === 'op' && tok.v === '(') {
      const e = or();
      if (!isOp(')')) throw new Error(`Template: kurung tidak seimbang "${src}"`);
      i++;
      return e;
    }
    if (tok.t === 'lit') return { k: 'lit', v: tok.v };
    if (tok.t === 'path') return { k: 'path', v: tok.v };
    throw new Error(`Template: token tak terduga "${tok.v}" pada "${src}"`);
  }
  function unary() {
    if (isOp('!')) { i++; return { k: 'not', e: unary() }; }
    return primary();
  }
  function cmp() {
    let left = unary();
    while (peek()?.t === 'op' && ['==', '!=', '===', '!==', '>', '<', '>=', '<='].includes(peek().v)) {
      const op = toks[i++].v;
      left = { k: 'cmp', op, l: left, r: unary() };
    }
    return left;
  }
  function and() {
    let left = cmp();
    while (isOp('&&')) { i++; left = { k: 'and', l: left, r: cmp() }; }
    return left;
  }
  function or() {
    let left = and();
    while (isOp('||')) { i++; left = { k: 'or', l: left, r: and() }; }
    return left;
  }
  const ast = or();
  if (i < toks.length) throw new Error(`Template: sisa token tak terduga pada "${src}"`);
  return ast;
}

/** Pisahkan string pada pemisah tunggal di luar tanda kutip (mengabaikan "||"). */
function splitOutside(src, sep) {
  const parts = [];
  let buf = '';
  let quote = null;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      buf += c;
      if (c === '\\') { buf += src[++i] ?? ''; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") { quote = c; buf += c; continue; }
    if (c === sep && !(sep === '|' && (src[i + 1] === '|' || src[i - 1] === '|'))) {
      parts.push(buf);
      buf = '';
      continue;
    }
    buf += c;
  }
  parts.push(buf);
  return parts.map((p) => p.trim());
}

/** Kompilasi "expr | f1:a | f2:b,c" sekali, lalu cache. */
function compileExpression(src) {
  const [head, ...filterParts] = splitOutside(src, '|');
  const base = parseExpr(head);
  const filters = filterParts.map((fp) => {
    const idx = fp.indexOf(':');
    const name = (idx === -1 ? fp : fp.slice(0, idx)).trim();
    const args = idx === -1 ? [] : splitOutside(fp.slice(idx + 1), ',').map(parseExpr);
    return { name, args };
  });
  return { base, filters };
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------
export class TemplateEngine {
  constructor() {
    this.filters = { ...defaultFilters };
    this.partials = {};
    this._exprCache = new Map();
  }

  /** Daftarkan filter: engine.registerFilter('shout', v => v + '!') */
  registerFilter(name, fn) { this.filters[name] = fn; return this; }

  /** Daftarkan partial dari string template. */
  registerPartial(name, source) { this.partials[name] = parse(tokenize(source)); return this; }

  /** Kompilasi template menjadi fungsi (data) => string. */
  compile(source) {
    const ast = parse(tokenize(source));
    return (data = {}) => this._renderNodes(ast.children, [{ data, meta: {} }], data);
  }

  render(source, data) { return this.compile(source)(data); }

  // --- internal -----------------------------------------------------------
  _lookup(path, stack, root) {
    const segs = path.split('.');
    const first = segs[0];
    let value;
    if (first === 'this') value = stack[stack.length - 1].data;
    else if (first === '@root') value = root;
    else if (first.startsWith('@')) {
      const key = first.slice(1);
      for (let i = stack.length - 1; i >= 0; i--) {
        if (key in stack[i].meta) { value = stack[i].meta[key]; break; }
      }
    } else {
      let found = false;
      for (let i = stack.length - 1; i >= 0; i--) {
        const d = stack[i].data;
        if (d != null && typeof d === 'object' && first in d) { value = d[first]; found = true; break; }
      }
      if (!found) return undefined;
    }
    for (let i = 1; i < segs.length; i++) {
      if (value == null) return undefined;
      value = value[segs[i]];
    }
    return value;
  }

  _evalAst(node, stack, root) {
    switch (node.k) {
      case 'lit': return node.v;
      case 'path': return this._lookup(node.v, stack, root);
      case 'not': return !truthy(this._evalAst(node.e, stack, root));
      case 'and': { const l = this._evalAst(node.l, stack, root); return truthy(l) ? this._evalAst(node.r, stack, root) : l; }
      case 'or': { const l = this._evalAst(node.l, stack, root); return truthy(l) ? l : this._evalAst(node.r, stack, root); }
      case 'cmp': {
        const l = unwrap(this._evalAst(node.l, stack, root));
        const r = unwrap(this._evalAst(node.r, stack, root));
        switch (node.op) {
          // eslint-disable-next-line eqeqeq
          case '==': return l == r;
          // eslint-disable-next-line eqeqeq
          case '!=': return l != r;
          case '===': return l === r;
          case '!==': return l !== r;
          case '>': return l > r;
          case '<': return l < r;
          case '>=': return l >= r;
          case '<=': return l <= r;
          default: return false;
        }
      }
      default: return undefined;
    }
  }

  _eval(src, stack, root) {
    if (!src) return undefined;
    let compiled = this._exprCache.get(src);
    if (!compiled) { compiled = compileExpression(src); this._exprCache.set(src, compiled); }
    let value = this._evalAst(compiled.base, stack, root);
    for (const f of compiled.filters) {
      const fn = this.filters[f.name];
      if (!fn) throw new Error(`Template: filter "${f.name}" tidak ditemukan`);
      value = fn(value, ...f.args.map((a) => this._evalAst(a, stack, root)));
    }
    return value;
  }

  _renderNodes(nodes, stack, root) {
    let out = '';
    for (const node of nodes) out += this._renderNode(node, stack, root);
    return out;
  }

  _renderNode(node, stack, root) {
    switch (node.type) {
      case 'text':
        return node.value;
      case 'var': {
        const v = this._eval(node.expr, stack, root);
        if (v == null || v === false) return '';
        if (v instanceof SafeString || node.raw) return String(unwrap(v));
        return escapeHtml(v);
      }
      case 'if': {
        for (let b = 0; b < node.branches.length; b++) {
          let cond = truthy(this._eval(node.branches[b].expr, stack, root));
          if (b === 0 && node.negate) cond = !cond;
          if (cond) return this._renderNodes(node.branches[b].children, stack, root);
        }
        return node.elseChildren ? this._renderNodes(node.elseChildren, stack, root) : '';
      }
      case 'each': {
        const list = this._eval(node.expr, stack, root);
        const entries = Array.isArray(list)
          ? list.map((v, i) => [i, v])
          : list && typeof list === 'object' ? Object.entries(list) : [];
        if (!entries.length) return node.elseChildren ? this._renderNodes(node.elseChildren, stack, root) : '';
        let out = '';
        entries.forEach(([key, item], i) => {
          const meta = { index: i, number: i + 1, key, first: i === 0, last: i === entries.length - 1 };
          let data = item;
          if (node.alias) {
            data = { [node.alias]: item };
            if (node.indexAlias) data[node.indexAlias] = key;
          }
          out += this._renderNodes(node.children, [...stack, { data, meta }], root);
        });
        return out;
      }
      case 'with': {
        const v = this._eval(node.expr, stack, root);
        if (!truthy(v)) return node.elseChildren ? this._renderNodes(node.elseChildren, stack, root) : '';
        return this._renderNodes(node.children, [...stack, { data: v, meta: {} }], root);
      }
      case 'partial': {
        const p = this.partials[node.name];
        if (!p) return `<!-- partial "${escapeHtml(node.name)}" tidak ditemukan -->`;
        const s = node.expr ? [...stack, { data: this._eval(node.expr, stack, root), meta: {} }] : stack;
        return this._renderNodes(p.children, s, root);
      }
      default:
        return '';
    }
  }
}

function truthy(v) {
  if (Array.isArray(v)) return v.length > 0;
  if (v instanceof SafeString) return v.value.length > 0;
  return !!v;
}
