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
