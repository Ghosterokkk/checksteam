STEAM CHECKER 3.8 — ИСПРАВЛЕНИЕ ЗАВИСАЮЩЕЙ ЗАГРУЗКИ INTERN

Что изменено:
1. GET-запросы больше не отправляют лишний Content-Type: application/json — это уменьшает количество CORS preflight-запросов.
2. Все API-запросы через CheckSteamAuth.api получают тайм-аут 15 секунд.
3. При зависании Worker интерфейс больше не остаётся бесконечно на «Загрузка…»: пользователь получает понятное сообщение о тайм-ауте и необходимости проверить Worker/D1.
4. CORS allow-headers дополнен Accept.

Установка:
1. Обновить файлы сайта из папки steamchecker_v17 в GitHub Pages.
2. Обновить Cloudflare Worker кодом из steamchecker_v17/steam-auth-cloudflare/worker.js и нажать Deploy.
3. Не удалять существующие D1 bindings, secrets и variables.
4. Открыть /intern/ и /intern/gaid/ с Ctrl+Shift+R.

Важно:
Это устраняет лишний preflight и бесконечное ожидание в браузере. Если после обновления появится сообщение о тайм-ауте, значит сам Worker/D1 не отвечает; тогда нужен статус Worker в Cloudflare Dashboard и проверка D1 binding DB. В этой среде нет доступа к живому Cloudflare Worker и DNS, поэтому боевой API после публикации проверить невозможно.
