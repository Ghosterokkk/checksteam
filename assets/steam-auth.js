/*
 * Steam OpenID launcher.
 * GitHub Pages is static, so the final OpenID verification must happen on a backend.
 * Set window.STEAM_AUTH_URL in assets/config.js to that backend's /auth/steam endpoint.
 */
(function () {
  function getBackend() {
    return (window.STEAM_AUTH_URL || '').trim();
  }
  function login(event) {
    if (event) event.preventDefault();
    const backend = getBackend();
    if (!backend) {
      alert('Авторизация через Steam ещё не подключена: укажите URL Steam OpenID backend в assets/config.js.');
      return;
    }
    window.location.assign(backend);
  }
  document.querySelectorAll('[data-steam]').forEach(function (el) {
    el.addEventListener('click', login);
  });
})();
