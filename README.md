# Steam Checker — multi-page GitHub Pages version

Структура сделана по предоставленной записи экрана:
- `index.html` — главная до входа;
- `checker.html` — рабочая страница после входа;
- `agreement.html` — пользовательское соглашение;
- `method.html` — методичка;
- `gmod-scan.html` — отдельная страница GMod Scan.

Из рабочего интерфейса удалены:
- Сканер файлов
- Вручную
- Извлечь из текста
- Пути Steam

Для реального Steam-входа укажите URL вашего backend в `assets/config.js`. GitHub Pages сам не выполняет серверную проверку Steam OpenID.
