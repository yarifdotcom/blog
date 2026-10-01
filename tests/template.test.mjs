// Jalankan: node tests/template.test.mjs
import assert from 'node:assert/strict';
import { TemplateEngine, safe } from '../core/template.js';
import { markdown } from '../core/markdown.js';
import { stripHtml, slugify, formatDate } from '../core/utils.js';

const e = new TemplateEngine();
const r = (t, d) => e.render(t, d);
let n = 0;
const test = (name, fn) => { fn(); n++; };

test('escape & raw', () => {
  assert.equal(r('{{ a }}|{{{ a }}}', { a: '<b>' }), '&lt;b&gt;|<b>');
  assert.equal(r('{{ a }}', { a: safe('<i>') }), '<i>');
});
test('path & missing', () => assert.equal(r('{{ a.b.c }}-{{ x.y }}', { a: { b: { c: 1 } } }), '1-'));
test('if/else if/else', () => {
  const t = '{{#if n > 5}}big{{else if n == 3}}three{{else}}small{{/if}}';
  assert.equal(r(t, { n: 9 }), 'big'); assert.equal(r(t, { n: 3 }), 'three'); assert.equal(r(t, { n: 1 }), 'small');
});
test('logic', () => {
  assert.equal(r('{{#if a and not b}}y{{/if}}', { a: 1, b: 0 }), 'y');
  assert.equal(r('{{#if (a || b) && c == "x"}}y{{else}}n{{/if}}', { a: 0, b: 1, c: 'x' }), 'y');
  assert.equal(r('{{#unless list}}empty{{/unless}}', { list: [] }), 'empty');
});
test('each', () => {
  assert.equal(r('{{#each xs}}{{@index}}:{{ this }}{{#unless @last}},{{/unless}}{{/each}}', { xs: ['a', 'b'] }), '0:a,1:b');
  assert.equal(r('{{#each ps}}{{ name }}@{{ site }}{{/each}}', { ps: [{ name: 'p' }], site: 'S' }), 'p@S');
  assert.equal(r('{{#each ps as p}}{{ p.name }}{{/each}}', { ps: [{ name: 'q' }] }), 'q');
  assert.equal(r('{{#each xs}}x{{else}}none{{/each}}', { xs: [] }), 'none');
  assert.equal(r('{{#each o}}{{@key}}={{this}};{{/each}}', { o: { a: 1, b: 2 } }), 'a=1;b=2;');
});
test('filters', () => {
  assert.equal(r('{{ t | upper | truncate:5,"..." }}', { t: 'hello world' }), 'HELLO...');
  assert.equal(r('{{ d | date:"D MMMM YYYY" }}', { d: new Date(2026, 9, 1) }), '1 Oktober 2026');
  assert.equal(r('{{ x | default:"-" }}', {}), '-');
  assert.equal(r('{{ s | nl2br }}', { s: 'a\n<b>' }), 'a<br>&lt;b&gt;');
  assert.equal(r('{{ md | markdown }}', { md: '**b**' }), '<p><strong>b</strong></p>');
  assert.equal(r('{{ a || "fb" }}', {}), 'fb');
});
test('partials & with', () => {
  e.registerPartial('card', '[{{ title }}]');
  assert.equal(r('{{#each ps}}{{> card}}{{/each}}', { ps: [{ title: 'A' }, { title: 'B' }] }), '[A][B]');
  assert.equal(r('{{> card post}}', { post: { title: 'C' } }), '[C]');
  assert.equal(r('{{#with u}}{{ name }}{{/with}}', { u: { name: 'N' } }), 'N');
});
test('comments', () => assert.equal(r('a{{!-- {{ x }} --}}b{{! hi }}c', {}), 'abc'));
test('errors', () => {
  assert.throws(() => r('{{#if a}}', {}), /belum ditutup/);
  assert.throws(() => r('{{#if a}}{{/each}}', {}), /tidak cocok/);
});
test('markdown', () => {
  const h = markdown('# Judul\n\nPara *i* dan `c<`.\n\n- a\n- b\n\n> kutip\n\n```js\nx<1\n```\n\n[l](javascript:alert(1))');
  assert.match(h, /<h1 id="judul">Judul<\/h1>/);
  assert.match(h, /<em>i<\/em>/);
  assert.match(h, /<ul><li>a<\/li><li>b<\/li><\/ul>/);
  assert.match(h, /<blockquote><p>kutip<\/p><\/blockquote>/);
  assert.match(h, /<pre><code class="language-js">x&lt;1<\/code><\/pre>/);
  assert.match(h, /href="#"/);
  assert.equal(markdown('<script>x</script>', { allowHtml: false }), '<p>&lt;script&gt;x&lt;/script&gt;</p>');
});
test('utils', () => {
  assert.equal(stripHtml('<p>Masak <strong>api</strong>.</p><ul><li>a</li></ul>'), 'Masak api. a');
  assert.equal(slugify('Halo Dunia! Ça va?'), 'halo-dunia-ca-va');
  assert.equal(formatDate(new Date(2026, 0, 5, 9, 7), 'YYYY-MM-DDTHH:mm'), '2026-01-05T09:07');
});
console.log(`OK — ${n} grup tes lulus`);
