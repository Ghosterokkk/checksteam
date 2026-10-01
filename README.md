# STEAM CHECKER — GitHub Pages final

Финальная версия собрана по референсам:
- `https://checksteam.ru/index`
- `https://checksteam.ru/download`
- `https://checksteam.ru/terms`

Страницы:
- `/` и `/index/` — главная
- `/download/` — GMod Scan
- `/terms/` — соглашение
- `/method/` — методичка
- `/checker/` — рабочая страница Steam Checker

Загрузка:
1. Распакуйте архив.
2. Загрузите ВСЁ содержимое в корень GitHub repository.
3. Settings → Pages → Deploy from branch → `main` → `/ (root)`.
4. Обновите страницу через Ctrl+F5.

Удалены из интерфейса:
- Сканер файлов
- Вручную
- Извлечь из текста
- Пути Steam

Steam OpenID:
`assets/config.js` содержит адрес backend. GitHub Pages является статическим хостингом, поэтому серверная проверка Steam OpenID требует отдельного backend.


## Final layout fix
- Centered page widths to match the supplied 1280x720 reference captures.
- Restored the supplied animated fire background at `assets/GHfire1.gif`.
- Fixed nested-page relative paths and added a favicon to avoid the browser resource 404.
