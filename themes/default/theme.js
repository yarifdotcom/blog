// Script tema (opsional). Dipanggil sekali saat tema dimuat.
// Tempat untuk mendaftarkan filter kustom dan hook render.

export default function setup(theme) {
  // Filter kustom: {{ post.readingTime | readtime }} -> "3 menit baca"
  theme.engine.registerFilter('readtime', (min) => `${min} menit baca`);

  // Hook setelah render: tandai link menu yang aktif.
  theme.hooks.afterRender = (el) => {
    const hash = location.hash || '#/';
    el.querySelectorAll('.nav a').forEach((a) => {
      a.classList.toggle('active', a.getAttribute('href') === hash);
    });
  };
}
