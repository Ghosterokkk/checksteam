# STEAM CHECKER — Steam + D1 + hierarchy + audit logs

Сайт: https://ghosterokkk.github.io/checksteam/
Worker: https://checksteam.zelencovtimur876.workers.dev

## Что реализовано

- Steam OpenID без ввода Steam-пароля на сайте.
- D1-пользователи и сессии.
- Иерархия: Владелец → Special Admin → Sudo Curator → Assistant Sudo Curator → Senior Administrator → Administrator.
- Каждый уровень может выдавать/снимать только роли и отделы пользователей строго ниже своего уровня.
- Владелец может управлять всеми пользователями, кроме самого себя.
- Владелец видит журнал выдачи/снятия ролей и изменения отделов.
- Журнал хранится 48 часов; ежедневный Cron запускает очистку записей старше 48 часов.
- Кнопка скачивания GMod Scan ведёт на GitHub Release asset `GModScan.exe`.

## D1

В существующей базе `checksteam-users` выполнить `steam-auth-cloudflare/schema.sql` один раз. В ней добавляется таблица `audit_logs`.

Binding Worker должен называться `DB` и указывать на `checksteam-users`.

## Secret владельца

Cloudflare Worker → Settings → Variables and Secrets → Secret:

OWNER_STEAM_ID = 765611990496192512

## Cron

Cloudflare Worker → Settings → Triggers → Cron Triggers → Add Cron Trigger:

0 0 * * *

Cron Cloudflare работает в UTC. Сам Worker удаляет только логи старше 48 часов.

## GMod Scan — private GitHub release, without R2 or a bank card

The download Worker now retrieves `GModScan.exe` from a **separate private GitHub repository**. Do not make the repository public and do not put a direct public release URL on the website. The site’s download button only receives a short-lived, one-use URL after the 12-digit code is redeemed.

### 1. Create a private repository and upload the executable
1. On GitHub create a new repository, for example `gmodscan-private`.
2. Set visibility to **Private**. Do not change the visibility of the `checksteam` website repository.
3. Create a GitHub Release in that private repository with tag `GModScan`.
4. Upload the asset with the exact filename `GModScan.exe` and publish the release.

### 2. Create a read-only GitHub token
1. GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token.
2. Repository access: **Only select repositories** → choose `gmodscan-private`.
3. Repository permissions: **Contents: Read-only**. Do not grant write/admin permissions.
4. Copy the token once and add it to Cloudflare as a **Secret** named `GITHUB_TOKEN`. Never put the token in frontend files, `assets/config.js`, or GitHub Pages.

### 3. Set Worker variables
In Cloudflare → Workers & Pages → `checksteam-steam-auth` → Settings → Variables and Secrets, add:

- Secret `GITHUB_TOKEN` — the token from the previous step.
- Variable `GITHUB_REPO_OWNER` — your GitHub username or organization.
- Variable `GITHUB_REPO_NAME` — the private repository name, for example `gmodscan-private`.
- Variable `GITHUB_RELEASE_TAG` — `GModScan` (must match the release tag).

Save and deploy the Worker. The existing D1 binding `DB` must remain configured. No R2 binding or payment card is needed.

### 4. Test safely
1. Open `/download/` on the website and redeem a newly generated 12-digit code.
2. Click the download link. The Worker retrieves the private release asset and streams it as `GModScan.exe`.
3. The generated download URL expires after 5 minutes and can be used only once. The code itself is also one-use.
4. If a download fails after the code was redeemed, create a new code and check the Worker settings and deployment logs.

The website no longer contains a direct public GitHub download URL. Keep the release repository private so the executable cannot be downloaded around the code system.
## UI / profiles update
- Top-right authorized user now shows Steam nickname, Steam avatar and colored privilege.
- Profile page shows SteamID64 and UNIONTEAMS player information when the public player page is reachable.
- `/checker/` no longer contains file scanner tabs; it is a management dashboard for users with management privileges.
- Management user cards show Steam avatar, Steam nickname, privilege, department and SteamID64.
- `Удалить` now permanently removes the user row from D1 instead of resetting its role/department. Audit entries remain for the 48-hour log retention period.
- Steam profile data is refreshed from Steam when missing.
- Audit logs are retained for 48 hours via `LOG_RETENTION = 60 * 60 * 48`.

## UI/security update
- UnionTeams data is no longer fetched or rendered by the checker.
- Role cards are clickable in the management UI and preselect the role in the grant form.
- Role colors use neon styles; Owner uses a dark-red animated shimmer.
- User rows are responsive and constrain SteamID64 to prevent overflow.
- The local GIF background remains enabled but was optimized from about 205 KB to about 21 KB.
- Worker enforces role hierarchy server-side, protects the owner, validates departments/roles/SteamID64, rejects non-site Origin requests when supplied, escapes displayed user data, and sends security headers.
- Audit logs retain 48 hours via the existing cleanup job.

- `/setting-users/` — canonical page for user settings/management. `/checker/` redirects there for compatibility.

## Управление проверками и одноразовые коды

- В отделах добавлен `Recruit` с неоновым жёлтым цветом по умолчанию.
- Сотрудники отделов `Staff` и `Recruit` (а также владелец) могут создавать одноразовые 12-значные коды на странице `setting-users/#checks`.
- Коды можно отменить создателю, владельцу или привилегиям Assistant Sudo Curator и выше.
- Special Admin и Sudo Curator могут просматривать журнал действий; Assistant Sudo Curator может отменять коды, но не просматривать общий журнал.
- Таблица `check_codes` создаётся Worker автоматически; определение таблицы также добавлено в `steam-auth-cloudflare/schema.sql`.

**Защищённое скачивание без R2 и карты:** Worker получает `GModScan.exe` из GitHub Release отдельного приватного репозитория. Порядок настройки описан в `steam-auth-cloudflare/README.md`. Создайте отдельный private repo (не меняйте видимость репозитория сайта), выпустите релиз с тегом `GModScan` и asset `GModScan.exe`, затем добавьте в Worker секрет `GITHUB_TOKEN` и переменные `GITHUB_REPO_OWNER`, `GITHUB_REPO_NAME`, `GITHUB_RELEASE_TAG`. Токену достаточно доступа Contents: Read-only только к этому приватному репозиторию. R2 binding не нужен.

**Важно:** старый публичный release-файл `GModScan.exe` в репозитории сайта нужно удалить, иначе его всё ещё можно скачать в обход кодов. Новый приватный release не должен быть публичным. Одноразовая ссылка выдаётся после погашения кода, действует 5 минут и используется один раз.


### Управление кодами проверок (v19)

- Отдельная страница: `/checksteam/setting-codes/`. Доступ к ней проверяется через Steam-сессию и серверные права.
- Создание кодов осталось доступно владельцу и отделам `Staff` / `Recruit`.
- Удаление разрешено только для неиспользованных кодов; использованные коды сервер отклоняет и удалить их нельзя.
- Записи кодов и журнал действий старше 48 часов удаляются при очистке Worker. Для регулярной очистки оставьте Cron Trigger `0 0 * * *` (UTC) в настройках Worker.

## Account access rule (v23)

Only Steam IDs already present in D1 `users` with an assigned privilege may sign in. A Steam account that is not registered, or whose privilege was removed, is redirected to the home page with the message `У вас нет аккаунта на сайте.` Department membership (including `Recruit`) does not by itself create an account or grant login. A user with a valid privilege and department `Staff` or `Recruit` can use the check-code page.

The Worker validates the current database privilege on every authenticated API request. If the privilege is removed, the existing session is revoked on its next request and the frontend periodically revalidates sessions. To apply this access-control change, deploy `steam-auth-cloudflare/worker.js` to Cloudflare as well as publishing the updated static files to GitHub Pages.


## Permission fix (v24)

- `Administrator` and `Senior Administrator` no longer see or access user management endpoints. User management requires `Assistant Sudo Curator` or higher (or Owner).
- Role and department settings API is Owner-only for both reading and writing.
- Check-code access remains available to assigned-privilege users in `Staff` or `Recruit`; department alone does not grant a site account.
- Users without an assigned privilege are rejected during Steam OpenID callback and on every API request; old sessions are revoked. The home page displays `У вас нет аккаунта на сайте.` after that rejection.


## v26: Быстрый показ профиля и экран загрузки
- Кэш профиля показывается сразу при переходе между страницами (только визуально).
- Серверная проверка `/api/me` остаётся обязательной и может отменить сессию.
- На главной экран загрузки остаётся поверх страницы до завершения проверки сессии, а не исчезает только из-за наличия токена.
- На страницах управления экран загрузки скрывается после события проверки авторизации.


## Session duration update (v27)
- Successful Steam login creates a session valid for 48 hours.
- Navigating between pages or temporary API/network errors no longer clears the browser's saved session.
- Clicking `Выйти` explicitly invalidates the server session and clears local/session storage.
- Removing a user's privilege or deleting their account still revokes access immediately when the server next validates the session.
- To apply this, publish the updated site files and deploy `steam-auth-cloudflare/worker.js` to the existing Worker.

## Обновление панели пользователей (октябрь 2026)
- В `setting-users/index.html` добавлены подписи и тёмное оформление фильтров; экран загрузки больше не блокирует страницу бесконечно, а запросы к Worker ограничены тайм-аутом.
- В `steam-auth-cloudflare/worker.js` добавлен серверный поиск никнейма по SteamID64 на `https://admin.unionteams.ru/scp/`. Для изменения API обязательно опубликуйте обновлённый Worker, не только GitHub Pages.
- Если SCP-панель требует авторизацию либо изменила структуру таблицы, Worker не сможет получить никнейм без официального API/доступа. В таком случае нужно предоставить формат API или способ авторизации; обходить авторизацию не следует.


## Исправления API SCP RP и аватаров (обновление)
- Никнейм SCP RP теперь ищется через `https://admin.unionteams.ru/api/v2/admins/list/6`, поле `server.real_name`; сопоставление выполняется по SteamID64 и SteamID32.
- В журнале аудита подсказка получает никнейм через тот же endpoint Worker.
- Отсутствующие аватары Steam подгружаются лениво; успешный URL сохраняется в D1.
- Предпросмотр при выдаче роли показывает никнейм SCP RP и аватар Steam.

Для работы изменений необходимо опубликовать `steam-auth-cloudflare/worker.js` в Cloudflare Worker и обновить GitHub Pages.

## Версия 1.6 — исправление списка пользователей и цветных фильтров
- Исправлен порог доступа GET `/api/users`: он соответствует уровню Senior Administrator, который уже допускается страницей управления пользователями. Операции добавления/изменения/удаления сохраняют более строгие проверки.
- Выпадающие фильтры привилегий и отделов строятся по настройкам ролей/отделов и показывают их цвета.
- Для применения обновления необходимо опубликовать страницу `setting-users/index.html` на GitHub Pages и обновить `steam-auth-cloudflare/worker.js` в Cloudflare Worker.

## Версия 1.7 — SteamID32, аватары и аудит кодов
- В форме управления пользователями SteamID32 (числовой AccountID или формат STEAM_0:Y:Z) автоматически преобразуется в SteamID64 перед предпросмотром и сохранением.
- Cloudflare Worker нормализует входящие SteamID в маршрутах профиля, SCP RP и сохранения пользователя; загрузка Steam-профиля дополнена резервным разбором публичной страницы Steam для получения аватара.
- В фильтрах привилегий и отделов цвет опции и выбранного значения больше не перезаписывается стилями выделения.
- В журнале `setting-codes` код проверки и `download-page` показываются как обычные значения без поиска никнейма и перехода в Steam. Ссылки на Steam создаются только для настоящих 17-значных SteamID64.
- Кнопки панели создания кода выровнены по центру по вертикали и горизонтали.
\n\n### Версия 1.9 — исправление ввода SteamID32\n- Исправлена обработка групп SteamID `STEAM_X:Y:Z`: AccountID вычисляется как `Z * 2 + Y` с корректным порядком групп регулярного выражения.\n- Предпросмотр теперь сравнивает нормализованный SteamID, поэтому не отбрасывает ответ для исходного SteamID32.\n- Worker уже использует правильную формулу; обновление Worker для этого исправления не требуется.\n

### Версия 2.1 — строгая проверка SteamID
- Поле выдачи принимает только SteamID32 в формате STEAM_0:Y:Z либо SteamID64 из 17 цифр.
- Удалён приём произвольного числового AccountID и иных форматов.
- SteamID32 разбирается по сегментам; SteamID64 рассчитывается как 76561197960265728 + (Z × 2 + Y).

## Модуль обучения Intern / Recruit

Добавлены страницы `/intern/`, `/intern/gaid/`, `/setting-intern/` и `/setting-gaid/`.
Для отправки уведомлений о прохождении курса добавьте в Cloudflare Worker секрет `DISCORD_INTERN_WEBHOOK` со значением URL Discord webhook. Секрет хранить только в настройках Worker, не в GitHub Pages.

Новые таблицы `intern_training` и `intern_training_events` создаются Worker автоматически. Также SQL для них добавлен в `steam-auth-cloudflare/schema.sql`.

Доступ к материалам курса выдаётся через защищённый endpoint Worker только авторизованным аккаунтам с привилегией `Intern`; в статическом HTML материалы не публикуются. Управление интернами и таблицей прохождения доступно аккаунтам отдела Recruit и владельцу. Таблица курсов показывает записи за последние 8 дней.

После обновления GitHub Pages обязательно опубликуйте новый `steam-auth-cloudflare/worker.js` в Cloudflare Worker и добавьте секрет `DISCORD_INTERN_WEBHOOK`.


## Intern / Recruit (обновление интерфейса)
- Страницы Интернов используют общий фон, загрузчик, шапку с белой иконкой выпускной шапочки и зелёную тему.
- Управление Интернами содержит список, статусы прохождения и отдельный журнал событий.
- `/setting-gaid/` — редактор содержимого курса; данные сохраняются в D1.
- Редактор доступен владельцу, Special Admin и Assistant Sudo Curator отдела Recruit.
- Управление Интернами доступно Recruit и владельцу; проверка также выполняется Worker.
- В обычном журнале пользователей скрыты назначения/снятия Intern.
- При назначении уже существующего сотрудника выводится объяснение вместо технического кода.
- После обновления необходимо развернуть новый Worker; таблица `intern_course_settings` создаётся автоматически.

## Intern course editor (2.4)
- `setting-gaid/` now provides a block editor for headings, text, lists, tables, images (URL or compressed upload), callouts and dividers.
- Course blocks are stored as versioned JSON in the existing `intern_course_settings.content` D1 column; legacy plain-text courses remain readable.
- `intern/gaid/` renders the same published blocks and only enables acknowledgement after the page has been scrolled to the end.
- The course API now creates/checks its own table on demand and returns diagnostic details for server-side failures.
- Copyable intern training URL is available from the editor.
- Deploy `steam-auth-cloudflare/worker.js` and publish the GitHub Pages files. Keep the existing D1 database and bindings.


## Обновление 2.5 — редактор обучения Intern
- Форматированный текст: жирный, курсив, подчёркивание, зачёркивание, цвет, заголовки, выравнивание, списки и ссылки.
- Изображения: настройка ширины до 100% и выравнивание.
- Пустой курс с нулём блоков сохраняется без восстановления удалённого текста.
- Добавлен журнал изменений конструктора: автор, дата по МСК и краткое описание состава изменений.
- Страница Intern выводит сохранённое HTML-форматирование с очисткой опасных тегов и атрибутов.


## Версия 2.7 — редактор обучения и аудит
- Исправлено сохранение выделения текста при использовании выпадающих списков размера и типа текста.
- Кнопки форматирования показывают активное состояние (жирный, курсив, подчёркивание, зачёркивание и выравнивание).
- Увеличены элементы конструктора; инструменты списка доступны в блоке списка, а не в обычном тексте.
- Таблицы и списки редактируются непосредственно в блоке; для таблиц добавлены кнопки добавления строк и столбцов.
- Пустой курс теперь сохраняется как пустой документ, без автоматического восстановления старого стартового текста.
- Журнал изменений курса автоматически очищается старше 5 дней и показывает добавление, удаление и редактирование блоков.
- Для изменений Worker требуется повторный Deploy; привязку D1 и секреты сохранять.


## Исправление обучения Intern (2.8)
- Разделены состояния загрузки курса и просмотра материалов.
- Если весь материал помещается в окно браузера, он считается просмотренным; для длинного курса требуется дойти до конца.
- После успешной загрузки отображается понятный статус, а после подтверждения сохраняется результат API.


## Версия 2.9 — сохранение курса и Discord-уведомление

- Сохранение курса выполняется через UPSERT в D1 и сразу проверяется повторным чтением записи.
- Редактор повторно загружает сохранённый документ и сравнивает его с опубликованным, чтобы не показывать ложный статус успеха.
- При прохождении обучения Discord webhook получает никнейм проходящего и проводившего обучение из SCP RP, SteamID32 в формате `STEAM_0:Y:Z` и дату по Москве.
- Для уведомления используется Secret Worker `DISCORD_INTERN_WEBHOOK`. Если он не задан, прохождение всё равно сохраняется, но сообщение в Discord не отправляется.


## Версия 4.1 — исправление прогресса завершённого обучения
- Если обучение уже отмечено пройденным, API теперь возвращает прогресс 100%, даже если запись была создана старой версией и в ней осталось 0%.
- При повторном запросе подтверждения старые завершённые записи автоматически приводятся к 100% в D1.
- В таблице управления Интернами завершённое обучение отображается как 100% независимо от устаревшего значения в базе.
