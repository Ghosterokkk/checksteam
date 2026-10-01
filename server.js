const express = require('express');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const RETURN_URL = `${BASE_URL}/auth/steam/callback`;

app.use(express.static(path.join(__dirname, 'public')));

function qs(params) {
  return new URLSearchParams(params).toString();
}

app.get('/auth/steam', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  // Stateless demo: state is carried only for user feedback. In production, bind it to a server-side session.
  const url = 'https://steamcommunity.com/openid/login?' + qs({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': `${RETURN_URL}?state=${state}`,
    'openid.realm': BASE_URL,
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select'
  });
  res.redirect(url);
});

app.get('/auth/steam/callback', async (req, res) => {
  try {
    const params = { ...req.query };
    if (params['openid.mode'] !== 'id_res') {
      return res.status(400).send('Steam authentication was cancelled or failed.');
    }

    const claimed = String(params['openid.claimed_id'] || '');
    const match = claimed.match(/^https?:\/\/steamcommunity\.com\/openid\/id\/(\d+)$/i);
    if (!match) return res.status(400).send('Invalid Steam identity response.');

    const check = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (key.startsWith('openid.')) check.append(key, value);
    }
    check.set('openid.mode', 'check_authentication');

    const verify = await fetch('https://steamcommunity.com/openid/login', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: check.toString()
    });
    const body = await verify.text();
    if (!verify.ok || !/^is_valid:true\s*$/m.test(body)) {
      return res.status(401).send('Steam response could not be verified.');
    }

    const steamId = match[1];
    // Demo app: return the verified SteamID to the UI. Use a server-side session for production.
    res.redirect(`/?steamid=${encodeURIComponent(steamId)}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Authentication error.');
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`CheckSteam-style site: ${BASE_URL}`);
});
