# CheckSteam — GitHub Pages READY

## Upload
Upload the **contents** of this folder into the root of your GitHub repository.

The repository root must contain:
- index.html
- checker.html
- agreement.html
- method.html
- gmod-scan.html
- assets/

Then:
GitHub → Settings → Pages → Deploy from a branch → `main` → `/ (root)`.

After deployment:
`https://YOUR-LOGIN.github.io/REPOSITORY/`

## Pages
- `/` — main Steam Checker landing page
- `/checker.html` — authenticated checker interface mockup
- `/agreement.html` — agreement
- `/method.html` — methodology
- `/gmod-scan.html` — full GMod Scan download page with screenshots and feature cards

The following requested sections are intentionally absent:
- Сканер файлов
- Вручную
- Извлечь из текста
- Пути Steam

## Steam
`assets/config.js` contains the backend URL placeholder for Steam OpenID. GitHub Pages itself is static; real authentication requires a server-side callback.
