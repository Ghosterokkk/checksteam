// Заполните адрес своего backend, например:
// window.STEAM_AUTH_URL = "https://your-backend.example.com/auth/steam";
window.STEAM_AUTH_URL = "";

const toast = document.getElementById('toast');

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}

function steamLogin() {
  /*
    Для реального входа замените URL на ваш backend callback.
    Backend должен сформировать Steam OpenID URL и вернуть пользователя на сайт.
    Пароль Steam никогда не должен вводиться в этой странице.
  */
  const backend = window.STEAM_AUTH_URL || '';
  if (backend) {
    location.href = backend;
  } else {
    showToast('Укажите STEAM_AUTH_URL на вашем backend для включения Steam OpenID.');
  }
}

document.querySelectorAll('#steamLoginTop,#steamLoginHero').forEach(el => {
  el.addEventListener('click', e => { e.preventDefault(); steamLogin(); });
});

document.querySelectorAll('[data-action]').forEach(btn => {
  btn.addEventListener('click', () => showToast('Функция подключается к backend.'));
});
