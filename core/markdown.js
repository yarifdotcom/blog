// SimpleBlog — parser Markdown ringan.
// Mendukung: heading, paragraf, bold/italic/strike, inline code, code block (```),
// link, gambar, blockquote, list (ul/ol), garis horizontal, dan HTML mentah (jika allowHtml).

import { escapeHtml, slugify } from './utils.js';

const BLOCK_TAGS = /^<\/?(div|p|figure|figcaption|iframe|table|thead|tbody|tr|td|th|section|article|aside|ul|ol|li|video|audio|blockquote|h[1-6]|pre|hr|details|summary|img|picture|script|style)\b/i;

function safeUrl(url) {
  const u = String(url).trim();
  if (/^(javascript|vbscript):/i.test(u)) return '#';
  if (/^data:/i.test(u) && !/^data:image\//i.test(u)) return '#';
  return u.replace(/"/g, '&quot;');
}

function inline(text) {
  const codes = [];
  let s = text.replace(/`([^`]+)`/g, (_, c) => {
    codes.push(c);
    return `\u0000${codes.length - 1}\u0000`;
  });
  s = s
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, src) => `<img src="${safeUrl(src)}" alt="${alt}" loading="lazy">`)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
      const url = safeUrl(href);
      const ext = /^https?:\/\//i.test(url) ? ' target="_blank" rel="noopener"' : '';
      return `<a href="${url}"${ext}>${label}</a>`;
    })
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/(^|\W)_(?!\s)(.+?)_(?=\W|$)/g, '$1<em>$2</em>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    .replace(/ {2,}\n/g, '<br>\n');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[i]}</code>`);
}

const LIST_RE = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const HR_RE = /^ {0,3}([-*_])( *\1){2,} *$/;

function parseBlocks(text, codeEscape) {
  const lines = text.split('\n');
  const out = [];
  let i = 0;

  const startsBlock = (line) =>
    /^```/.test(line) || /^#{1,6}\s/.test(line) || /^(>|&gt;)/.test(line) || LIST_RE.test(line) || HR_RE.test(line);

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i++; continue; }

    // Code block berpagar
    if (/^```/.test(line)) {
      const lang = line.slice(3).trim();
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      const code = codeEscape ? escapeHtml(buf.join('\n')) : buf.join('\n');
      const cls = lang ? ` class="language-${escapeHtml(lang)}"` : '';
      out.push(`<pre><code${cls}>${code}</code></pre>`);
      continue;
    }

    // Heading
    let m = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (m) {
      const level = m[1].length;
      const id = slugify(m[2].replace(/<[^>]*>/g, ''));
      out.push(`<h${level} id="${id}">${inline(m[2])}</h${level}>`);
      i++;
      continue;
    }

    if (HR_RE.test(line)) { out.push('<hr>'); i++; continue; }

    // Blockquote (">" atau "&gt;" bila input sudah di-escape)
    if (/^(>|&gt;)/.test(line)) {
      const buf = [];
      while (i < lines.length && /^(>|&gt;)/.test(lines[i])) {
        buf.push(lines[i].replace(/^(>|&gt;)\s?/, ''));
        i++;
      }
      out.push(`<blockquote>${parseBlocks(buf.join('\n'), codeEscape)}</blockquote>`);
      continue;
    }

    // List
    m = line.match(LIST_RE);
    if (m) {
      const ordered = /\d/.test(m[2]);
      const items = [];
      while (i < lines.length) {
        const lm = lines[i].match(LIST_RE);
        if (lm) {
          items.push(lm[3]);
        } else if (lines[i].trim() && /^\s{2,}/.test(lines[i]) && items.length) {
          items[items.length - 1] += ' ' + lines[i].trim();
        } else break;
        i++;
      }
      const tag = ordered ? 'ol' : 'ul';
      out.push(`<${tag}>${items.map((it) => `<li>${inline(it)}</li>`).join('')}</${tag}>`);
      continue;
    }

    // Blok HTML mentah (hanya jika input tidak di-escape)
    if (codeEscape && BLOCK_TAGS.test(line.trim())) {
      const buf = [];
      while (i < lines.length && lines[i].trim()) buf.push(lines[i++]);
      out.push(buf.join('\n'));
      continue;
    }

    // Paragraf
    const buf = [];
    while (i < lines.length && lines[i].trim() && !(buf.length && startsBlock(lines[i]))) {
      buf.push(lines[i++]);
    }
    out.push(`<p>${inline(buf.join('\n'))}</p>`);
  }
  return out.join('\n');
}

/**
 * Render Markdown ke HTML.
 * @param {string} src
 * @param {{allowHtml?: boolean}} options allowHtml=true untuk konten admin (tepercaya),
 *        false untuk konten dari publik (semua HTML di-escape).
 */
export function markdown(src, { allowHtml = true } = {}) {
  let text = String(src ?? '').replace(/\r\n?/g, '\n');
  if (!allowHtml) text = escapeHtml(text);
  return parseBlocks(text, allowHtml);
}
