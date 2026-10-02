# Steam Checker

Static GitHub Pages frontend with the supplied background, transparent site logo, Steam OpenID button, agreement/download navigation, and GMod Scan page.

Steam login is prepared for Cloudflare Workers instead of Render. Deploy `steam-auth-cloudflare/worker.js`, then put its `/auth/steam` URL into `assets/config.js`.
