# STEAM CHECKER

GitHub Pages site with Steam OpenID login and Cloudflare Worker + D1 authorization.

Site: https://ghosterokkk.github.io/checksteam/

The Worker is in `steam-auth-cloudflare/`.

The owner assigns each SteamID:
- Department: `Staff` or `Без отдела`
- Privilege: `Administrator`, `Senior Administrator`, `Assistant Sudo Curator`, `Sudo Curator`, `Special Admin`

Privilege colors are enforced by the site and Worker.
