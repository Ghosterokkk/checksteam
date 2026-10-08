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

## GMod Scan

Создать GitHub Release с тегом:

GModScan

и загрузить asset с точным именем:

GModScan.exe

После публикации кнопка на странице `/download/` скачивает этот файл.

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
