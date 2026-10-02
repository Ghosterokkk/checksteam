# STEAM CHECKER — Cloudflare Worker

Worker for Steam OpenID + D1 users/privileges for the GitHub Pages site:
https://ghosterokkk.github.io/checksteam/

## Cloudflare bindings

Create a D1 database and add it to this Worker with the binding name `DB`.

Create a Worker secret named `OWNER_STEAM_ID` and set it to the owner's 64-bit SteamID.

Run `schema.sql` once in the D1 database.

## Deploy

The Cloudflare Git integration uses:

- Root directory: `/steam-auth-cloudflare`
- Deploy command: `npx wrangler deploy`

The Worker URL is used by `assets/config.js`.

## Routes

- `/auth/steam`
- `/auth/steam/callback`
- `/auth/exchange`
- `/api/me`
- `/api/logout`
- `/api/users`
- `/api/users/:steamid`
