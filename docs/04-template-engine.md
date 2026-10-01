# 04 · Template Engine

Engine ada di `core/template.js`, sintaksnya mirip Handlebars/Twig. Template dikompilasi sekali menjadi fungsi, lalu dipanggil dengan data.

```js
import { TemplateEngine } from './core/template.js';
const engine = new TemplateEngine();
const tpl = engine.compile('<h1>{{ title | upper }}</h1>');
tpl({ title: 'halo' });  // "<h1>HALO</h1>"
```

## Output

| Sintaks | Hasil |
|---|---|
| `{{ post.title }}` | Nilai di-escape HTML |
| `{{{ post.html }}}` | Nilai mentah (tanpa escape) |
| `{{ a \|\| "default" }}` | Ekspresi logika |
| `{{!-- komentar --}}`, `{{! komentar }}` | Tidak dirender |

Nilai `null`, `undefined`, dan `false` dirender sebagai string kosong. Nilai bertipe `SafeString` (mis. hasil filter `markdown`, `nl2br`, atau `post.html`) tidak di-escape walau memakai `{{ }}`.

## Kondisi

```handlebars
{{#if post.coverImage}} ... {{/if}}

{{#if pagination.page == 1 and site.tagline}}
  ...
{{else if total > 10}}
  ...
{{else}}
  ...
{{/if}}

{{#unless comments}}Belum ada komentar{{/unless}}
```

Operator: `==  !=  ===  !==  >  <  >=  <=`, `and`/`&&`, `or`/`||`, `not`/`!`, tanda kurung `( )`.
Literal: `"string"`, `'string'`, angka, `true`, `false`, `null`.
Array kosong dianggap *false*.

## Perulangan

```handlebars
{{#each posts}}
  {{@number}}. <a href="{{ url }}">{{ title }}</a>   {{!-- properti item langsung --}}
  {{#if @first}}(terbaru){{/if}}
{{else}}
  Tidak ada post.
{{/each}}

{{#each posts as p}}
  {{ p.title }} — {{ site.title }}   {{!-- variabel luar tetap terlihat --}}
{{/each}}

{{#each object}}{{ @key }} = {{ this }}{{/each}}
```

Variabel khusus: `this`, `@index` (0-based), `@number` (1-based), `@first`, `@last`, `@key`, `@root`.

## Konteks

```handlebars
{{#with post.category}}<a href="{{ url }}">{{ name }}</a>{{/with}}
```

Pencarian nama variabel berjalan dari konteks terdalam ke luar, jadi di dalam `{{#each}}` Anda tetap bisa mengakses `site`, `categories`, dll.

## Partial

```handlebars
{{> post-card}}          {{!-- memakai konteks saat ini --}}
{{> post-meta post}}     {{!-- konteks = post --}}
```

Partial didaftarkan di `theme.json` (lihat [05](05-membuat-tema.md)) atau manual: `engine.registerPartial('nama', '<p>{{ x }}</p>')`.

## Filter

Sintaks: `{{ nilai | filter | filter:arg1,arg2 }}`. Argumen bisa literal atau variabel.

| Filter | Contoh | Keterangan |
|---|---|---|
| `upper`, `lower`, `capitalize`, `trim` | `{{ name \| upper }}` | |
| `default` | `{{ x \| default:"-" }}` | Bila kosong/null |
| `truncate` | `{{ text \| truncate:100,"..." }}` | Potong di batas kata |
| `excerpt` | `{{ html \| excerpt:160 }}` | Hapus tag + potong |
| `striptags` | | Hapus tag HTML |
| `date` | `{{ date \| date:"D MMMM YYYY" }}` | Token: `YYYY MMMM MMM MM M DD D dddd HH mm`; arg ke-2 locale (`id`/`en`) |
| `timeago` | `{{ c.date \| timeago }}` | "2 jam yang lalu" |
| `markdown` | `{{ text \| markdown }}` | Hasil aman (SafeString) |
| `nl2br` | `{{ comment \| nl2br }}` | Escape + `\n` → `<br>` |
| `safe` / `raw` | `{{ html \| safe }}` | Tandai aman |
| `escape` | | Escape eksplisit |
| `json` | `{{ data \| json:2 }}` | |
| `length` | `{{ comments \| length }}` | |
| `join` | `{{ names \| join:", " }}` | |
| `first`, `last`, `reverse` | | |
| `limit` | `{{#each posts \| limit:3}}` | |
| `map` | `{{ tags \| map:"name" \| join:", " }}` | Ambil satu properti |
| `slug`, `urlencode` | | |
| `initials` | `{{ "Budi Santoso" \| initials }}` → `BS` | |
| `plural` | `{{ n \| plural:"item","items" }}` | |
| `number` | `{{ 12500 \| number }}` → `12.500` | |

### Filter kustom

```js
engine.registerFilter('rupiah', (v) => 'Rp ' + Number(v).toLocaleString('id-ID'));
// {{ harga | rupiah }}
```

Di tema, daftarkan lewat `theme.js` (lihat [05](05-membuat-tema.md#script-tema-themejs)).

## Error

Kesalahan sintaks dilaporkan dengan pesan jelas, mis.:
- `Template: blok {{#if}} belum ditutup`
- `Template: {{/each}} tidak cocok dengan {{#if}}`
- `Template: filter "xyz" tidak ditemukan`

Di halaman publik, error template ditampilkan di layar (dan di console) agar mudah diperbaiki saat mengembangkan tema.

## Tes

```bash
node tests/template.test.mjs
```
