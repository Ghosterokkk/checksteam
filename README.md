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
