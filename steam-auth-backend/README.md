# Steam OpenID backend for STEAM CHECKER

This is the server part required for a static GitHub Pages site. It uses Steam's official OpenID 2.0 endpoint and never asks the user for a Steam password on STEAM CHECKER.

## Required environment variables

```text
PUBLIC_ORIGIN=https://checksteam.ru
SESSION_SECRET=<at least 32 random characters>
PORT=3000
```

Optional:

```text
STEAM_API_KEY=<Steam Web API key>
```

The API key is server-side only. Never put it into `assets/config.js`.

## Recommended deployment

Deploy this folder as a Node 18+ web service on Render, Railway, a VPS, or another HTTPS Node host. Give it a custom subdomain such as:

```text
auth.checksteam.ru
```

The public URL must support HTTPS.

After deployment, set `assets/config.js` in the GitHub Pages site to:

```js
window.STEAM_AUTH_URL = "https://auth.checksteam.ru";
window.STEAM_AUTH_API = "https://auth.checksteam.ru";
```

Then redeploy GitHub Pages.

## Flow

1. User clicks **Войти через Steam**.
2. Browser is redirected to Steam's official OpenID page.
3. Steam returns to `/auth/steam/callback`.
4. The backend verifies the OpenID response directly with Steam.
5. Backend creates a signed 7-day session token and sends it back in the URL fragment, so it is not sent to the server as a query parameter.
6. Frontend stores the token locally and calls `/api/me` to confirm the session.

The backend also exposes `GET /health` for a simple deployment check.
