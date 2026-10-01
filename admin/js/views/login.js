// Admin › Login (username/password). Bisa dipakai sebelum Firebase dikonfigurasi.

import { html, $, busy, readForm, toast } from '../ui.js';
import { DEFAULT_USERNAME, DEFAULT_PASSWORD, isLocalDefault, authMessage } from '../auth.js';

export function render({ el, app }) {
  const firstTime = !app.configured && isLocalDefault();

  el.innerHTML = String(html`
    <div class="auth-wrap">
      <form class="card auth-card" id="login-form" autocomplete="on">
        <div class="auth-logo">SB</div>
        <h2>Masuk ke Admin</h2>
        ${firstTime ? html`<div class="hint">Login pertama: username <b>${DEFAULT_USERNAME}</b>, password <b>${DEFAULT_PASSWORD}</b>.
          Segera ganti setelah masuk.</div>` : ''}
        <div class="field">
          <label for="username">Username</label>
          <input id="username" name="username" required autocomplete="username" autofocus
            value="${firstTime ? DEFAULT_USERNAME : ''}" autocapitalize="none" spellcheck="false">
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input id="password" name="password" type="password" required autocomplete="current-password">
        </div>
        <button class="btn btn-primary btn-block" type="submit">Masuk</button>
        <p class="muted small center">${app.configured
          ? 'Terhubung ke Firebase.'
          : 'Firebase belum diatur — setelah masuk, isi Setup Firebase.'}</p>
      </form>
    </div>`);

  const form = $('#login-form', el);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    busy(form.querySelector('[type=submit]'), async () => {
      const { username, password } = readForm(form);
      try {
        const mode = await app.login(username, password);
        if (mode === 'local' && app.configured) {
          toast('Firebase tidak dapat dihubungi — masuk mode lokal. Periksa Setup Firebase.', 'error', 6000);
        }
        app.router.navigate(app.isAdmin ? '/dashboard' : '/setup');
      } catch (err) {
        toast(authMessage(err), 'error', 5000);
      }
    });
  });
}
