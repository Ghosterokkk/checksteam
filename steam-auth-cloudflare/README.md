# STEAM CHECKER — Cloudflare Worker

Worker for Steam OpenID + D1 users/privileges for the GitHub Pages site:
https://ghosterokkk.github.io/checksteam/

## Cloudflare bindings

Create a D1 database and add it to this Worker with the binding name `DB`.

Create a Worker secret named `OWNER_STEAM_ID` and set it to the owner's 64-bit SteamID. The current owner SteamID is `76561199496192512`. If the secret is missing, the Worker also uses this value as a fallback.

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


## Private GMod Scan downloads (no R2 required)

The Worker serves `GModScan.exe` from a GitHub Release in a separate **private** repository after redeeming a one-time 12-digit code. Configure these Worker variables:

- Secret `GITHUB_TOKEN`: fine-grained GitHub token limited to the private executable repository, with Contents: Read-only.
- Variable `GITHUB_REPO_OWNER`: GitHub username or organization.
- Variable `GITHUB_REPO_NAME`: private repository name.
- Variable `GITHUB_RELEASE_TAG`: release tag (usually `GModScan`).

The private release must contain an asset named exactly `GModScan.exe`. Do not expose the asset through a public repository/release. `GMODSCAN_BUCKET` is no longer used by the download route. The short-lived download URL expires in 5 minutes and is one-use.
