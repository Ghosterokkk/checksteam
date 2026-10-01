/*
 * Production-ready Steam OpenID 2.0 bridge for a static GitHub Pages frontend.
 * Node 18+ / Express 4.
 *
 * Required environment variables:
 *   PUBLIC_ORIGIN=https://checksteam.ru
 *   SESSION_SECRET=<long-random-secret>
 *
 * Optional:
 *   PORT=3000
 *   STEAM_API_KEY=<Steam Web API key>   # only if profile data is wanted
 *
 * Frontend flow:
 *   /auth/steam -> Steam -> /auth/steam/callback -> redirect to PUBLIC_ORIGIN
 *   with a short-lived signed token in the URL fragment.
 */
const express = require('express');
const crypto = require('crypto');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const PUBLIC_ORIGIN = String(process.env.PUBLIC_ORIGIN || 'https://checksteam.ru').replace(/\/$/, '');
const SESSION_SECRET = process.env.SESSION_SECRET;
const STEAM_API_KEY = process.env.STEAM_API_KEY || '';
const STEAM_OPENID = 'https://steamcommunity.com/openid/login';

if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
  console.warn('[steam-auth] SESSION_SECRET is missing or shorter than 32 characters. Set a strong secret before production.');
}

function base64url(value) {
  return Buffer.from(value).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function sign(value) {
  return base64url(crypto.createHmac('sha256', SESSION_SECRET || 'invalid-secret').update(value).digest());
}
function safeEqual(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}
function createToken(steamId) {
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(JSON.stringify({ v: 1, sub: steamId, iat: now, exp: now + 7 * 24 * 60 * 60 }));
  return payload + '.' + sign(payload);
}
function verifyToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2 || !safeEqual(parts[1], sign(parts[0]))) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[0].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    if (!payload.sub || !/^\d+$/.test(payload.sub) || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch (_) { return null; }
}
function randomState() { return crypto.randomBytes(32).toString('hex'); }
function cookieOptions(maxAge) {
  return { httpOnly: true, secure: true, sameSite: 'lax', path: '/auth/steam', maxAge };
}
function buildSteamLoginUrl(returnTo) {
  const p = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': returnTo,
    'openid.realm': new URL(PUBLIC_ORIGIN).origin + '/',
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select'
  });
  return STEAM_OPENID + '?' + p.toString();
}
function queryParams(req) {
  const p = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (Array.isArray(value)) p.set(key, String(value[0]));
    else if (value !== undefined && value !== null) p.set(key, String(value));
  }
  return p;
}
function getBearer(req) {
  const header = String(req.headers.authorization || '');
  return /^Bearer\s+(.+)$/i.test(header) ? header.replace(/^Bearer\s+/i, '') : '';
}

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', PUBLIC_ORIGIN);
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/health', (_req, res) => res.json({ ok: true, service: 'steam-auth' }));

app.get('/auth/steam', (req, res) => {
  const state = randomState();
  const returnTo = new URL('/auth/steam/callback', PUBLIC_ORIGIN);
  returnTo.searchParams.set('state', state);
  res.cookie('steam_openid_state', state, cookieOptions(10 * 60 * 1000));
  res.redirect(buildSteamLoginUrl(returnTo.toString()));
});

app.get('/auth/steam/callback', async (req, res) => {
  try {
    const state = String(req.query.state || '');
    const cookieState = String(req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith('steam_openid_state='));
    const cookieValue = cookieState ? decodeURIComponent(cookieState.slice('steam_openid_state='.length)) : '';
    if (!state || !cookieValue || !safeEqual(state, cookieValue)) return res.status(400).send('Steam authorization state check failed.');

    const claimed = String(req.query['openid.claimed_id'] || '');
    const match = claimed.match(/^https?:\/\/steamcommunity\.com\/openid\/id\/(\d+)$/i);
    if (!match) return res.status(400).send('SteamID was not returned.');

    const params = queryParams(req);
    params.set('openid.mode', 'check_authentication');
    const verify = await fetch(STEAM_OPENID, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });
    const body = await verify.text();
    if (!verify.ok || !/is_valid\s*:\s*true/i.test(body)) return res.status(401).send('Steam authorization verification failed.');

    const steamId = match[1];
    const token = createToken(steamId);
    res.clearCookie('steam_openid_state', { path: '/auth/steam' });
    res.redirect(PUBLIC_ORIGIN + '/#steam_token=' + encodeURIComponent(token));
  } catch (err) {
    console.error('[steam-auth]', err);
    res.status(500).send('Steam authorization failed.');
  }
});

app.get('/api/me', async (req, res) => {
  const token = verifyToken(getBearer(req));
  if (!token) return res.status(401).json({ error: 'unauthorized' });

  const result = { steamid: token.sub };
  if (STEAM_API_KEY) {
    try {
      const url = new URL('https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/');
      url.searchParams.set('key', STEAM_API_KEY);
      url.searchParams.set('steamids', token.sub);
      const r = await fetch(url);
      if (r.ok) {
        const data = await r.json();
        const profile = data && data.response && data.response.players && data.response.players[0];
        if (profile) result.profile = {
          steamid: profile.steamid,
          personaname: profile.personaname,
          avatar: profile.avatarfull,
          profileurl: profile.profileurl
        };
      }
    } catch (err) {
      console.warn('[steam-auth] Steam profile lookup failed:', err.message);
    }
  }
  res.setHeader('Cache-Control', 'no-store');
  res.json(result);
});

app.listen(PORT, () => console.log(`[steam-auth] listening on ${PORT}`));
