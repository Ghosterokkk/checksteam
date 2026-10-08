const SITE_ORIGIN = 'https://ghosterokkk.github.io';
const SITE_PATH = '/checksteam/';
const STEAM_OPENID = 'https://steamcommunity.com/openid/login';
const DEPARTMENTS = ['Staff', 'Без отдела'];
const PRIVILEGES = [
  'Administrator',
  'Senior Administrator',
  'Assistant Sudo Curator',
  'Sudo Curator',
  'Special Admin'
];
const PRIVILEGE_RANK = {
  'Administrator': 1,
  'Senior Administrator': 2,
  'Assistant Sudo Curator': 3,
  'Sudo Curator': 4,
  'Special Admin': 5
};
const OWNER_RANK = 6;
const SESSION_TTL = 60 * 60 * 24 * 7;
const TICKET_TTL = 60;
const LOG_RETENTION = 60 * 60 * 48;

const PRIVILEGE_COLORS = {
  'Administrator': '#ff1836',
  'Senior Administrator': '#3d7cff',
  'Assistant Sudo Curator': '#a855f7',
  'Sudo Curator': '#22d3ee',
  'Special Admin': '#9ca3af'
};

function corsHeaders(origin) {
  const allowed = origin === SITE_ORIGIN;
  return {
    'Access-Control-Allow-Origin': allowed ? SITE_ORIGIN : 'null',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function json(data, status = 200, origin = SITE_ORIGIN) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      ...corsHeaders(origin)
    }
  });
}

function html(data, status = 200) {
  return new Response(data, {
    status,
    headers: { 'Content-Type': 'text/html; charset=UTF-8' }
  });
}

function hex(bytes) {
  return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function randomToken(bytes = 32) {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  return hex(data);
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return hex(digest);
}

function rankOfPrivilege(privilege, steamId, env) {
  if (steamId && steamId === String(env.OWNER_STEAM_ID || '')) return OWNER_RANK;
  return PRIVILEGE_RANK[privilege] || 0;
}

function privilegeColor(privilege, isOwner) {
  if (isOwner) return '#ffffff';
  return privilege ? (PRIVILEGE_COLORS[privilege] || '#9ca3af') : '#666666';
}

function cleanUser(row, env) {
  const steamId = row.steam_id;
  const isOwner = steamId === String(env.OWNER_STEAM_ID || '');
  const privilege = row.privilege || null;
  return {
    steam_id: steamId,
    display_name: row.display_name || `SteamID ${steamId}`,
    avatar_url: row.avatar_url || '',
    department: row.department || 'Без отдела',
    privilege,
    effective_privilege: isOwner ? 'Владелец' : privilege,
    privilege_color: privilegeColor(privilege, isOwner),
    rank: rankOfPrivilege(privilege, steamId, env),
    is_owner: isOwner,
    can_manage: isOwner || rankOfPrivilege(privilege, steamId, env) > 0
  };
}

function actorRank(session, env) {
  return rankOfPrivilege(session.privilege, session.steam_id, env);
}

function canManageTarget(session, targetRow, newPrivilege, env) {
  const actor = actorRank(session, env);
  const targetId = targetRow?.steam_id || '';
  if (targetId && targetId === String(env.OWNER_STEAM_ID || '')) return false;
  if (actor === OWNER_RANK) return true;
  if (actor <= 0) return false;
  const currentTargetRank = rankOfPrivilege(targetRow?.privilege, targetId, env);
  const requestedRank = newPrivilege ? (PRIVILEGE_RANK[newPrivilege] || 0) : 0;
  return actor > currentTargetRank && actor > requestedRank;
}

function loginUrl(origin) {
  const returnTo = `${origin}/auth/steam/callback`;
  const p = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': returnTo,
    'openid.realm': `${origin}/`,
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select'
  });
  return `${STEAM_OPENID}?${p.toString()}`;
}

async function verifySteam(requestUrl) {
  const u = new URL(requestUrl);
  const params = new URLSearchParams(u.search);
  params.set('openid.mode', 'check_authentication');

  const response = await fetch(STEAM_OPENID, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });

  const text = await response.text();
  if (!text.includes('is_valid:true')) throw new Error('Steam OpenID verification failed');

  const claimedId = params.get('openid.claimed_id') || '';
  const match = claimedId.match(/\/id\/(\d+)$/);
  if (!match) throw new Error('SteamID missing');
  return match[1];
}

async function upsertUser(env, steamId) {
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(`
    INSERT INTO users (steam_id, display_name, avatar_url, department, privilege, created_at, updated_at)
    VALUES (?, ?, '', 'Без отдела', NULL, ?, ?)
    ON CONFLICT(steam_id) DO UPDATE SET updated_at = excluded.updated_at
  `).bind(steamId, `SteamID ${steamId}`, now, now).run();
  return env.DB.prepare('SELECT * FROM users WHERE steam_id = ?').bind(steamId).first();
}

async function requireSession(request, env) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) throw new Error('UNAUTHORIZED');
  const token = auth.slice(7).trim();
  if (!token) throw new Error('UNAUTHORIZED');

  const hash = await sha256(token);
  const row = await env.DB.prepare(`
    SELECT s.steam_id, s.expires_at,
           u.display_name, u.avatar_url, u.department, u.privilege
    FROM sessions s
    JOIN users u ON u.steam_id = s.steam_id
    WHERE s.token_hash = ?
  `).bind(hash).first();

  if (!row || Number(row.expires_at) <= Math.floor(Date.now() / 1000)) throw new Error('UNAUTHORIZED');
  return row;
}

async function createTicket(env, steamId) {
  const ticket = await randomToken(32);
  const ticketHash = await sha256(ticket);
  const expires = Math.floor(Date.now() / 1000) + TICKET_TTL;
  await env.DB.prepare(`
    INSERT INTO login_tickets (ticket_hash, steam_id, expires_at, used_at)
    VALUES (?, ?, ?, NULL)
  `).bind(ticketHash, steamId, expires).run();
  return ticket;
}

async function exchangeTicket(env, ticket) {
  const hash = await sha256(ticket);
  const now = Math.floor(Date.now() / 1000);
  const ticketRow = await env.DB.prepare(`
    SELECT ticket_hash, steam_id, expires_at, used_at
    FROM login_tickets WHERE ticket_hash = ?
  `).bind(hash).first();

  if (!ticketRow || ticketRow.used_at || Number(ticketRow.expires_at) <= now) throw new Error('INVALID_TICKET');

  const changed = await env.DB.prepare(`
    UPDATE login_tickets SET used_at = ?
    WHERE ticket_hash = ? AND used_at IS NULL AND expires_at > ?
  `).bind(now, hash, now).run();
  if (!changed.meta.changes) throw new Error('INVALID_TICKET');

  const sessionToken = await randomToken(32);
  const sessionHash = await sha256(sessionToken);
  const expires = now + SESSION_TTL;
  await env.DB.prepare(`
    INSERT INTO sessions (token_hash, steam_id, expires_at, created_at)
    VALUES (?, ?, ?, ?)
  `).bind(sessionHash, ticketRow.steam_id, expires, now).run();

  const row = await env.DB.prepare('SELECT * FROM users WHERE steam_id = ?').bind(ticketRow.steam_id).first();
  return { token: sessionToken, user: cleanUser(row, env) };
}

async function cleanup(env) {
  const now = Math.floor(Date.now() / 1000);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM login_tickets WHERE expires_at < ?').bind(now),
    env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now),
    env.DB.prepare('DELETE FROM audit_logs WHERE created_at < ?').bind(now - LOG_RETENTION)
  ]);
}

async function writeAudit(env, actorId, targetId, action, field, oldValue, newValue) {
  await env.DB.prepare(`
    INSERT INTO audit_logs (actor_steam_id, target_steam_id, action, field, old_value, new_value, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    actorId,
    targetId,
    action,
    field,
    oldValue == null ? '' : String(oldValue),
    newValue == null ? '' : String(newValue),
    Math.floor(Date.now() / 1000)
  ).run();
}

async function api(request, env) {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin') || '';

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });

  try {
    const session = await requireSession(request, env);

    if (url.pathname === '/api/me' && request.method === 'GET') {
      const row = await env.DB.prepare('SELECT * FROM users WHERE steam_id = ?').bind(session.steam_id).first();
      return json(cleanUser(row, env), 200, origin);
    }

    if (url.pathname === '/api/logout' && request.method === 'POST') {
      const token = (request.headers.get('Authorization') || '').slice(7).trim();
      await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run();
      return json({ ok: true }, 200, origin);
    }

    if (url.pathname === '/api/users' && request.method === 'GET') {
      if (actorRank(session, env) <= 0) return json({ error: 'FORBIDDEN' }, 403, origin);
      const rows = await env.DB.prepare('SELECT * FROM users ORDER BY updated_at DESC').all();
      const actor = actorRank(session, env);
      return json({
        users: rows.results.map(row => ({
          ...cleanUser(row, env),
          can_edit: actor === OWNER_RANK
            ? row.steam_id !== String(env.OWNER_STEAM_ID || '')
            : canManageTarget(session, row, row.privilege, env)
        }))
      }, 200, origin);
    }

    if (url.pathname === '/api/users' && request.method === 'POST') {
      if (actorRank(session, env) <= 0) return json({ error: 'FORBIDDEN' }, 403, origin);

      const body = await request.json();
      const steamId = String(body.steam_id || '').replace(/\D/g, '');
      const department = String(body.department || '');
      const privilege = body.privilege === null || body.privilege === '' ? null : String(body.privilege);

      if (!/^\d{17}$/.test(steamId)) return json({ error: 'INVALID_STEAM_ID' }, 400, origin);
      if (!DEPARTMENTS.includes(department)) return json({ error: 'INVALID_DEPARTMENT' }, 400, origin);
      if (privilege !== null && !PRIVILEGES.includes(privilege)) return json({ error: 'INVALID_PRIVILEGE' }, 400, origin);
      if (steamId === String(env.OWNER_STEAM_ID || '')) return json({ error: 'OWNER_PROTECTED' }, 403, origin);

      const old = await env.DB.prepare('SELECT * FROM users WHERE steam_id = ?').bind(steamId).first();
      const target = old || { steam_id: steamId, department: 'Без отдела', privilege: null, display_name: `SteamID ${steamId}`, avatar_url: '' };
      if (!canManageTarget(session, target, privilege, env)) return json({ error: 'TARGET_OUT_OF_HIERARCHY' }, 403, origin);

      const now = Math.floor(Date.now() / 1000);
      await env.DB.prepare(`
        INSERT INTO users (steam_id, display_name, avatar_url, department, privilege, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(steam_id) DO UPDATE SET department=excluded.department, privilege=excluded.privilege, updated_at=excluded.updated_at
      `).bind(
        steamId,
        target.display_name || `SteamID ${steamId}`,
        target.avatar_url || '',
        department,
        privilege,
        old?.created_at || now,
        now
      ).run();

      if ((target.department || 'Без отдела') !== department) {
        await writeAudit(env, session.steam_id, steamId, 'DEPARTMENT', 'department', target.department || 'Без отдела', department);
      }
      if ((target.privilege || null) !== privilege) {
        await writeAudit(env, session.steam_id, steamId, privilege ? 'GRANT_ROLE' : 'REMOVE_ROLE', 'privilege', target.privilege || '', privilege || '');
      }

      const row = await env.DB.prepare('SELECT * FROM users WHERE steam_id = ?').bind(steamId).first();
      return json({ user: cleanUser(row, env) }, 200, origin);
    }

    if (url.pathname.startsWith('/api/users/') && request.method === 'DELETE') {
      if (actorRank(session, env) <= 0) return json({ error: 'FORBIDDEN' }, 403, origin);
      const steamId = url.pathname.split('/').pop().replace(/\D/g, '');
      if (!/^\d{17}$/.test(steamId)) return json({ error: 'INVALID_STEAM_ID' }, 400, origin);
      if (steamId === String(env.OWNER_STEAM_ID || '')) return json({ error: 'OWNER_PROTECTED' }, 403, origin);

      const old = await env.DB.prepare('SELECT * FROM users WHERE steam_id = ?').bind(steamId).first();
      if (!old) return json({ error: 'USER_NOT_FOUND' }, 404, origin);
      if (!canManageTarget(session, old, null, env)) return json({ error: 'TARGET_OUT_OF_HIERARCHY' }, 403, origin);

      const now = Math.floor(Date.now() / 1000);
      await env.DB.prepare(`UPDATE users SET department='Без отдела', privilege=NULL, updated_at=? WHERE steam_id=?`).bind(now, steamId).run();
      if ((old.department || 'Без отдела') !== 'Без отдела') await writeAudit(env, session.steam_id, steamId, 'DEPARTMENT', 'department', old.department || 'Без отдела', 'Без отдела');
      if (old.privilege) await writeAudit(env, session.steam_id, steamId, 'REMOVE_ROLE', 'privilege', old.privilege, '');
      return json({ ok: true }, 200, origin);
    }

    if (url.pathname === '/api/logs' && request.method === 'GET') {
      if (session.steam_id !== String(env.OWNER_STEAM_ID || '')) return json({ error: 'FORBIDDEN' }, 403, origin);
      const rows = await env.DB.prepare(`
        SELECT id, actor_steam_id, target_steam_id, action, field, old_value, new_value, created_at
        FROM audit_logs ORDER BY id DESC LIMIT 500
      `).all();
      return json({ logs: rows.results }, 200, origin);
    }

    return json({ error: 'NOT_FOUND' }, 404, origin);
  } catch (error) {
    if (String(error.message) === 'UNAUTHORIZED') return json({ error: 'UNAUTHORIZED' }, 401, origin);
    return json({ error: 'SERVER_ERROR' }, 500, origin);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (!env.DB) return new Response('D1 binding DB is missing', { status: 500 });

    if (url.pathname.startsWith('/api/')) return api(request, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request.headers.get('Origin') || '') });
    }

    if (url.pathname === '/auth/steam') return Response.redirect(loginUrl(url.origin), 302);

    if (url.pathname === '/auth/steam/callback') {
      try {
        const steamId = await verifySteam(request.url);
        await upsertUser(env, steamId);
        const ticket = await createTicket(env, steamId);
        await cleanup(env);
        return Response.redirect(`${SITE_ORIGIN}${SITE_PATH}#steam_ticket=${encodeURIComponent(ticket)}`, 302);
      } catch (error) {
        return html(`<!doctype html><meta charset="utf-8"><title>Steam authorization error</title><body style="margin:0;background:#020202;color:#ddd;font:16px Arial,sans-serif;display:grid;place-items:center;min-height:100vh"><main style="padding:30px;border:1px solid #222;border-radius:10px;background:#090909;text-align:center"><h2>Ошибка авторизации Steam</h2><p>${String(error.message || 'Unknown error').replace(/[<>]/g, '')}</p><p><a style="color:#ff1836" href="${SITE_ORIGIN}${SITE_PATH}">Вернуться на сайт</a></p></main></body>`, 401);
      }
    }

    if (url.pathname === '/auth/exchange' && request.method === 'POST') {
      const origin = request.headers.get('Origin') || '';
      try {
        const body = await request.json();
        const ticket = String(body.ticket || '');
        if (!/^[a-f0-9]{64}$/i.test(ticket)) return json({ error: 'INVALID_TICKET' }, 400, origin);
        const result = await exchangeTicket(env, ticket);
        return json(result, 200, origin);
      } catch (error) {
        return json({ error: String(error.message) === 'INVALID_TICKET' ? 'INVALID_TICKET' : 'SERVER_ERROR' }, 401, origin);
      }
    }

    return new Response('Not found', { status: 404 });
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(cleanup(env));
  }
};
