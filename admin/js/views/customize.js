// Admin › Tampilan › Kustomisasi: opsi tema (warna, huruf, tata letak, …) dengan pratinjau langsung.
// Kontrol dibuat otomatis dari skema "options" di theme.json.

import * as store from '../../../core/store.js';
import { resolveTheme, resolveOptions } from '../../../core/theme.js';
import { debounce } from '../../../core/utils.js';
import { html, $, $$, loading, toast, busy, confirmAction } from '../ui.js';
import { setDraftOptions, clearDraft, previewPanel, bindPreviewPanel } from '../preview.js';

function control(o, value) {
  const id = `opt-${o.id}`;
  switch (o.type) {
    case 'color':
      return html`<div class="field"><label for="${id}">${o.label}</label>
        <div class="color-row"><input type="color" id="${id}" name="${o.id}" value="${value}"><code data-out="${o.id}">${value}</code></div></div>`;
    case 'palette': {
      const known = (o.choices || []).some(([c]) => c.toLowerCase() === String(value).toLowerCase());
      return html`<div class="field"><label>${o.label}</label>
        <div class="palette" role="radiogroup" aria-label="${o.label}">
          ${(o.choices || []).map(([c, name]) => html`<button type="button" class="swatch ${String(value).toLowerCase() === c.toLowerCase() ? 'active' : ''}"
            style="--sw:${c}" data-swatch="${o.id}" data-color="${c}" title="${name} (${c})" aria-label="${name}"></button>`)}
          <label class="swatch swatch-custom ${known ? '' : 'active'}" title="Warna lain">
            <input type="color" id="${id}" name="${o.id}" value="${value}" aria-label="Warna lain">
          </label>
        </div>
        <small class="muted"><span data-out="${o.id}">${value}</span> · klik lingkaran terakhir untuk warna lain</small></div>`;
    }
    case 'select':
      return html`<div class="field"><label for="${id}">${o.label}</label>
        <select id="${id}" name="${o.id}">${(o.choices || []).map(([v, t]) => html`<option value="${v}" ${String(v) === String(value) ? 'selected' : ''}>${t}</option>`)}</select></div>`;
    case 'range':
      return html`<div class="field"><label for="${id}">${o.label} <small class="muted" data-out="${o.id}">${value}${o.unit || ''}</small></label>
        <input type="range" id="${id}" name="${o.id}" min="${o.min ?? 0}" max="${o.max ?? 100}" step="${o.step ?? 1}" value="${value}"></div>`;
    case 'number':
      return html`<div class="field"><label for="${id}">${o.label}</label>
        <input type="number" id="${id}" name="${o.id}" value="${value}" min="${o.min ?? ''}" max="${o.max ?? ''}" step="${o.step ?? 1}"></div>`;
    case 'checkbox':
      return html`<div class="field"><label class="check"><input type="checkbox" name="${o.id}" ${value ? 'checked' : ''}> ${o.label}</label></div>`;
    default:
      return html`<div class="field"><label for="${id}">${o.label}</label><input id="${id}" name="${o.id}" value="${value}"></div>`;
  }
}

export async function render({ el, query }) {
  el.innerHTML = String(loading());
  const settings = await store.getSettings();
  const themeId = query.theme || settings.theme || 'default';
  const manifest = await resolveTheme(themeId, '../themes/');
  const schema = manifest.options;
  const defaults = resolveOptions(schema, {});
  let values = resolveOptions(schema, settings.themeOptions?.[themeId]);
  let saved = JSON.stringify(values);

  const groups = {};
  for (const o of schema) (groups[o.group || 'Umum'] ||= []).push(o);

  el.innerHTML = String(html`
    <div class="customize">
      <form class="customize-controls card" id="opt-form" autocomplete="off">
        <div class="customize-head">
          <div><small class="muted">Mengkustomisasi</small><br><b>${manifest.name}</b>
            ${themeId === settings.theme ? html`<span class="badge badge-green">Aktif</span>` : html`<span class="badge badge-gray">Tidak aktif</span>`}</div>
          <a class="small" href="#/appearance/themes">Ganti tema</a>
        </div>
        ${schema.length ? Object.entries(groups).map(([g, opts]) => html`
          <details class="opt-group" open><summary>${g}</summary>${opts.map((o) => control(o, values[o.id]))}</details>`)
          : html`<p class="muted">Tema ini tidak mendefinisikan opsi kustomisasi.</p>`}
        <details class="opt-group"><summary>Identitas situs</summary>
          <p class="small muted">Logo, favicon, teks footer, dan CSS tambahan ada di
            <a href="#/settings/appearance">Identitas &amp; CSS</a>.</p>
        </details>
        <div class="customize-actions">
          <span class="small muted" id="dirty"></span>
          <button type="button" class="btn btn-sm btn-ghost" id="reset-btn">Bawaan</button>
          <button type="submit" class="btn btn-primary" id="save-btn">Simpan &amp; Terbitkan</button>
        </div>
      </form>
      ${previewPanel(themeId)}
    </div>`);

  const form = $('#opt-form', el);
  bindPreviewPanel(el);

  const readValues = () => {
    const out = {};
    for (const o of schema) {
      const input = form.elements[o.id];
      if (!input) continue;
      if (o.type === 'checkbox') out[o.id] = input.checked;
      else if (o.type === 'range' || o.type === 'number') out[o.id] = Number(input.value);
      else out[o.id] = input.value;
    }
    return out;
  };
  const writeValues = (v) => {
    for (const o of schema) {
      const input = form.elements[o.id];
      if (!input) continue;
      if (o.type === 'checkbox') input.checked = !!v[o.id];
      else input.value = v[o.id];
    }
    refreshOutputs();
  };
  const refreshOutputs = () => {
    for (const o of schema) {
      const out = $(`[data-out="${o.id}"]`, el);
      if (out) out.textContent = `${form.elements[o.id].value}${o.type === 'range' ? (o.unit || '') : ''}`;
    }
    $('#dirty', el).textContent = JSON.stringify(readValues()) !== saved ? '● Belum disimpan' : '';
  };

  // Swatch palet: set nilai input warna lalu tandai yang aktif.
  const syncSwatches = () => {
    for (const o of schema.filter((x) => x.type === 'palette')) {
      const v = String(form.elements[o.id].value).toLowerCase();
      let matched = false;
      $$(`[data-swatch="${o.id}"]`, el).forEach((b) => {
        const on = b.dataset.color.toLowerCase() === v;
        b.classList.toggle('active', on);
        matched ||= on;
      });
      form.elements[o.id].closest('.swatch-custom').classList.toggle('active', !matched);
    }
  };
  form.addEventListener('click', (e) => {
    const sw = e.target.closest('[data-swatch]');
    if (!sw) return;
    form.elements[sw.dataset.swatch].value = sw.dataset.color;
    form.dispatchEvent(new Event('input'));
  });

  const pushDraft = debounce(() => setDraftOptions(themeId, readValues()), 120);
  setDraftOptions(themeId, values); // mulai dari nilai tersimpan
  form.addEventListener('input', () => { refreshOutputs(); syncSwatches(); pushDraft(); });

  $('#reset-btn', el).addEventListener('click', () => {
    if (!confirmAction('Kembalikan semua opsi ke nilai bawaan tema? (Belum disimpan sampai Anda klik Simpan)')) return;
    writeValues(defaults);
    syncSwatches();
    pushDraft();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    busy($('#save-btn', el), async () => {
      try {
        values = readValues();
        await store.saveThemeOptions(themeId, values);
        saved = JSON.stringify(values);
        refreshOutputs();
        toast('Kustomisasi diterbitkan.', 'success');
      } catch (err) {
        toast('Gagal menyimpan: ' + err.message, 'error');
      }
    });
  });

  // Draf tidak dipakai lagi setelah meninggalkan halaman.
  window.addEventListener('hashchange', function cleanup() {
    window.removeEventListener('hashchange', cleanup);
    clearDraft();
  });
}
