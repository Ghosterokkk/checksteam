(function () {
  const params = new URLSearchParams(location.search);
  const steamId = params.get('steamid');
  const status = document.getElementById('auth-status');
  const target = document.getElementById('steam-target');

  if (steamId) {
    status.hidden = false;
    status.innerHTML = `STEAM ID подтверждён: <code>${steamId}</code>`;
    target.value = steamId;
    history.replaceState({}, '', '/');
  }

  document.getElementById('start-check').addEventListener('click', function () {
    const result = document.getElementById('check-result');
    const value = target.value.trim();
    result.hidden = false;
    result.innerHTML = value
      ? `<div class="result-row"><span>Цель</span><b>${escapeHtml(value)}</b></div><div class="result-row"><span>Статус</span><b class="ok">ГОТОВО К ПРОВЕРКЕ</b></div>`
      : `<div class="result-row"><span>Статус</span><b>НУЖЕН STEAM ID ИЛИ ПРОФИЛЬ</b></div>`;
  });

  document.getElementById('scan-btn').addEventListener('click', function () {
    const value = document.getElementById('profile-url').value.trim();
    const out = document.getElementById('scan-output');
    out.hidden = false;
    out.textContent = value ? `Очередь сканирования создана: ${value}` : 'Введите публичную ссылку профиля.';
  });

  function escapeHtml(value) {
    return value.replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\'':'&#39;','"':'&quot;'}[c]));
  }
})();
