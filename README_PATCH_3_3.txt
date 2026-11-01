STEAM CHECKER 3.3 — исправление прав Senior Administrator и CORS

Изменения в steam-auth-cloudflare/worker.js:
1. CORS теперь разрешает Cache-Control, Pragma и X-Requested-With, чтобы браузер не блокировал запросы конструктора обучения.
2. Senior Administrator может выполнять выдачу/изменение ролей через POST /api/users. Серверная проверка canManageTarget по-прежнему запрещает выдавать равную или более высокую роль и изменять чужой отдел.
3. Доступ Senior Administrator к /api/steam-profile согласован с доступом к управлению пользователями.

Установка:
- Обновить GitHub Pages файлами архива.
- Обязательно развернуть новый steam-auth-cloudflare/worker.js через Cloudflare Workers → Deploy.
- Не удалять D1 binding DB и существующие secrets.
