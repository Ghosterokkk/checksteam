# Steam Checker — GitHub Pages

Это статическая реконструкция интерфейса Steam Checker в стиле текущего `checksteam.ru`.

Удалены из интерфейса:
- Сканер файлов
- Вручную
- Извлечь из текста
- Пути Steam

## Публикация
1. Создайте GitHub repository.
2. Загрузите `index.html`, `terms.html` и папку `assets`.
3. Settings → Pages → Deploy from a branch → `main` → `/ (root)`.
4. Откройте выданный GitHub Pages URL.

## Steam OpenID
GitHub Pages не выполняет серверную проверку OpenID. Для реального входа нужен небольшой backend.
В `assets/app.js` функция `steamLogin()` ожидает URL вашего backend. Backend должен использовать официальный Steam OpenID и вернуть на сайт только подтверждённый SteamID.

Не размещайте форму логина/пароля Steam на этой странице.
