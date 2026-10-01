# Steam OpenID backend

GitHub Pages cannot securely verify Steam OpenID assertions by itself. This small Node 18+ example starts the official Steam OpenID flow and verifies the callback server-side.

1. Deploy this folder on an HTTPS server.
2. Set `PUBLIC_ORIGIN` to the public origin of the auth server if it differs from `https://checksteam.ru`.
3. In the GitHub Pages site, edit `assets/config.js`:
   `window.STEAM_AUTH_URL = "https://YOUR-AUTH-DOMAIN/auth/steam";`
4. Run `npm install && npm start`.

Do not collect or ask users for Steam passwords. Authentication happens on Steam's official OpenID page.
