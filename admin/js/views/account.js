// Admin › Akun Saya: info akun & ganti password (Firebase + lokal).

import * as store from '../../../core/store.js';
import { html, $, busy, readForm, toast } from '../ui.js';
import {
  checkLocal, setLocalPassword, localUsername, displayName,
  changeFirebasePassword, authMessage,
} from '../auth.js';

export function render({ el, app }) {
  const username = app.user ? displayName(app.user.email) : app.localSession;

  el.innerHTML = String(html`
    <div class="grid-2">
      <div class="card">
        <h2 class="card-title">Akun</h2>
        <dl class="kv">
          <dt>Username</dt><dd>${username}</dd>
          <dt>Mode login</dt><dd>${app.user ? 'Firebase Authentication' : 'Lokal (browser ini)'}</dd>
          ${app.user ? html`<dt>Email Firebase</dt><dd><code>${app.user.email}</code></dd>
            <dt>UID</dt><dd><code>${app.user.uid}</code></dd>
            <dt>Peran</dt><dd>${app.admin?.role || (app.isAdmin ? 'admin' : 'bukan admin')}</dd>` : ''}
        </dl>
        <p class="muted small">${app.user
          ? 'Password diubah di Firebase dan juga untuk login lokal browser ini.'
          : 'Login lokal hanya berlaku di browser ini, dipakai sebelum Firebase diatur. Setelah Firebase terhubung, login memakai akun Firebase.'}</p>
      </div>

      <form class="card" id="pw-form" autocomplete="off">
        <h2 class="card-title">Ganti Password</h2>
        <div class="field">
          <label for="current">Password saat ini</label>
          <input id="current" name="current" type="password" required autocomplete="current-password">
        </div>
        <div class="field">
          <label for="next">Password baru</label>
          <input id="next" name="next" type="password" required minlength="3" autocomplete="new-password">
          <small class="muted">Disarankan minimal 8 karakter, campuran huruf &amp; angka.</small>
        </div>
        <div class="field">
          <label for="confirm">Ulangi password baru</label>
          <input id="confirm" name="confirm" type="password" required autocomplete="new-password">
        </div>
        <div class="actions"><button class="btn btn-primary" type="submit" id="pw-btn">Simpan Password</button></div>
      </form>
    </div>`);

  const form = $('#pw-form', el);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    busy($('#pw-btn', el), async () => {
      const { current, next, confirm } = readForm(form);
      if (next !== confirm) return toast('Konfirmasi password tidak sama.', 'error');
      if (next === current) return toast('Password baru harus berbeda dari yang lama.', 'error');
      if (next.length < 3) return toast('Password minimal 3 karakter.', 'error');

      try {
        if (app.user) {
          await changeFirebasePassword(app.user, current, next);
          if (app.admin?.defaultPassword) await store.updateAdmin(app.user.uid, { defaultPassword: false });
          await setLocalPassword(next, displayName(app.user.email));
        } else {
          if (!(await checkLocal(localUsername(), current))) return toast('Password saat ini salah.', 'error');
          await setLocalPassword(next);
        }
        form.reset();
        await app.refreshAdmin();
        toast('Password berhasil diganti.', 'success');
      } catch (err) {
        toast('Gagal mengganti password: ' + authMessage(err), 'error', 6000);
      }
    });
  });
}
