/* Minimal Steam OpenID backend example for Node 18+.
 * Install: npm i express
 * Run behind HTTPS in production.
 * Set the site's assets/config.js to https://YOUR-DOMAIN/auth/steam
 */
const express = require('express');
const crypto = require('crypto');
const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_ORIGIN = process.env.PUBLIC_ORIGIN || 'https://checksteam.ru';

function buildSteamLoginUrl(returnTo) {
  const p = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': returnTo,
    'openid.realm': new URL(returnTo).origin + '/',
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select'
  });
  return 'https://steamcommunity.com/openid/login?' + p.toString();
}

app.get('/auth/steam', (req, res) => {
  const returnTo = `${PUBLIC_ORIGIN}/auth/steam/callback`;
  res.redirect(buildSteamLoginUrl(returnTo));
});

app.get('/auth/steam/callback', async (req, res) => {
  const params = new URLSearchParams(req.query);
  params.set('openid.mode', 'check_authentication');
  const verify = await fetch('https://steamcommunity.com/openid/login', {
    method: 'POST',
    headers: {'content-type':'application/x-www-form-urlencoded'},
    body: params.toString()
  });
  const body = await verify.text();
  if (!body.includes('is_valid:true')) return res.status(401).send('Steam authorization verification failed.');
  const claimed = req.query['openid.claimed_id'];
  const match = String(claimed || '').match(/\/id\/(\d+)$/);
  if (!match) return res.status(400).send('SteamID was not returned.');
  const steamId = match[1];
  // Replace this response with your own session/JWT creation.
  res.send(`<h1>Steam authorization successful</h1><p>SteamID: ${steamId}</p>`);
});

app.listen(PORT, () => console.log(`Steam auth backend listening on ${PORT}`));
