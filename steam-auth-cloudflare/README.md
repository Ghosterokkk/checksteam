# Steam OpenID on Cloudflare Workers

This replaces the old Render backend. GitHub Pages remains the frontend; this Worker handles the server-side Steam OpenID verification.

1. Install Wrangler and log in to Cloudflare.
2. Deploy `worker.js` as a Worker.
3. In `assets/config.js`, set `window.STEAM_AUTH_URL` to `https://YOUR-WORKER.workers.dev/auth/steam`.
4. If you use a custom auth domain, put that URL there instead.

The user is redirected to Steam's official OpenID page. The site never asks for or receives a Steam password.
