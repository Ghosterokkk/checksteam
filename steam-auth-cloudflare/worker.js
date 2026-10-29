const SITE_ORIGIN = 'https://ghosterokkk.github.io';
const SITE_PATH = '/checksteam/';
const STEAM_OPENID = 'https://steamcommunity.com/openid/login';
const DEPARTMENTS = ['Staff', 'Recruit', 'Без отдела'];
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
const DEFAULT_OWNER_STEAM_ID = '76561199496192512';
// Sessions last exactly 48 hours from successful Steam login unless the user logs out or access is revoked.
const SESSION_TTL = 60 * 60 * 24 * 2;
const TICKET_TTL = 60;
const LOG_RETENTION = 60 * 60 * 48;

const PRIVILEGE_COLORS = {
  'Administrator': '#ff1836',
  'Senior Administrator': '#3d7cff',
  'Assistant Sudo Curator': '#a855f7',
  'Sudo Curator': '#22d3ee',
  'Special Admin': '#9ca3af'
};

const ROLE_SETTINGS_DEFAULTS = [
  { role_key:'Administrator', rank:1, display_name:'Administrator', color:'#ff1836', gradient_enabled:0, gradient_color:'#ff7a8a', role_id:'role-1' },
  { role_key:'Senior Administrator', rank:2, display_name:'Senior Administrator', color:'#3d7cff', gradient_enabled:0, gradient_color:'#8db5ff', role_id:'role-2' },
  { role_key:'Assistant Sudo Curator', rank:3, display_name:'Assistant Sudo Curator', color:'#a855f7', gradient_enabled:0, gradient_color:'#e2a8ff', role_id:'role-3' },
  { role_key:'Sudo Curator', rank:4, display_name:'Sudo Curator', color:'#22d3ee', gradient_enabled:0, gradient_color:'#8bfff6', role_id:'role-4' },
  { role_key:'Special Admin', rank:5, display_name:'Special Admin', color:'#9ca3af', gradient_enabled:0, gradient_color:'#ffffff', role_id:'role-5' }
];
const ROLE_KEY_SET = new Set(ROLE_SETTINGS_DEFAULTS.map(x=>x.role_key));
const DEPARTMENT_SETTINGS_DEFAULTS = [
  { department_key:'Staff', display_name:'Staff', color:'#ff1836', department_id:'dept-staff' },
  { department_key:'Recruit', display_name:'Recruit', color:'#faff00', department_id:'dept-recruit' },
  { department_key:'Без отдела', display_name:'Без отдела', color:'#777777', department_id:'dept-none' }
];
const DEPARTMENT_KEY_SET = new Set(DEPARTMENT_SETTINGS_DEFAULTS.map(x=>x.department_key));

async function ensureRoleSettings(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS role_settings (
    role_key TEXT PRIMARY KEY,
    rank INTEGER NOT NULL,
    display_name TEXT NOT NULL,
    color TEXT NOT NULL,
    role_id TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    gradient_enabled INTEGER NOT NULL DEFAULT 0,
    gradient_color TEXT NOT NULL DEFAULT '#ffffff'
  )`).run();
  try { await env.DB.prepare("ALTER TABLE role_settings ADD COLUMN gradient_enabled INTEGER NOT NULL DEFAULT 0").run(); } catch (e) {}
  try { await env.DB.prepare("ALTER TABLE role_settings ADD COLUMN gradient_color TEXT NOT NULL DEFAULT '#ffffff'").run(); } catch (e) {}
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS department_settings (
    department_key TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    color TEXT NOT NULL,
    department_id TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS check_codes (
    code TEXT PRIMARY KEY, creator_steam_id TEXT NOT NULL, creator_department TEXT NOT NULL, created_at INTEGER NOT NULL,
    used_at INTEGER, used_by TEXT NOT NULL DEFAULT '', cancelled_at INTEGER, cancelled_by TEXT NOT NULL DEFAULT '',
    deleted_at INTEGER, deleted_by TEXT NOT NULL DEFAULT ''
  )`).run();
  try { await env.DB.prepare("ALTER TABLE check_codes ADD COLUMN deleted_at INTEGER").run(); } catch (e) {}
  try { await env.DB.prepare("ALTER TABLE check_codes ADD COLUMN deleted_by TEXT NOT NULL DEFAULT ''").run(); } catch (e) {}
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS check_download_tokens (token_hash TEXT PRIMARY KEY, code TEXT NOT NULL, expires_at INTEGER NOT NULL, used_at INTEGER)`).run();
  const now=Math.floor(Date.now()/1000);
  for (const r of ROLE_SETTINGS_DEFAULTS) {
    await env.DB.prepare(`INSERT OR IGNORE INTO role_settings (role_key,rank,display_name,color,role_id,updated_at) VALUES (?,?,?,?,?,?)`)
      .bind(r.role_key,r.rank,r.display_name,r.color,r.role_id,now).run();
    await env.DB.prepare(`UPDATE role_settings SET gradient_enabled=COALESCE(gradient_enabled,?), gradient_color=COALESCE(NULLIF(gradient_color,''),?) WHERE role_key=?`).bind(r.gradient_enabled||0,r.gradient_color||'#ffffff',r.role_key).run();
  }
  for (const d of DEPARTMENT_SETTINGS_DEFAULTS) {
    await env.DB.prepare(`INSERT OR IGNORE INTO department_settings (department_key,display_name,color,department_id,updated_at) VALUES (?,?,?,?,?)`)
      .bind(d.department_key,d.display_name,d.color,d.department_id,now).run();
  }
}

async function getRoleSettings(env) {
  await ensureRoleSettings(env);
  const rows=await env.DB.prepare('SELECT role_key,rank,display_name,color,role_id,updated_at,gradient_enabled,gradient_color FROM role_settings ORDER BY rank DESC').all();
  const out={};
  for (const r of rows.results) out[r.role_key]={rank:Number(r.rank),name:r.display_name,color:r.color,role_id:r.role_id,gradient_enabled:Number(r.gradient_enabled||0)===1,gradient_color:r.gradient_color||'#ffffff',updated_at:Number(r.updated_at)};
  return out;
}

async function getDepartmentSettings(env) {
  await ensureRoleSettings(env);
  const rows=await env.DB.prepare('SELECT department_key,display_name,color,department_id,updated_at FROM department_settings ORDER BY department_key').all();
  const out={};
  for (const d of rows.results) out[d.department_key]={name:d.display_name,color:d.color,department_id:d.department_id,updated_at:Number(d.updated_at)};
  return out;
}

function validHexColor(value){ return /^#[0-9a-fA-F]{6}$/.test(String(value||'')); }
function validRoleId(value){ return /^[A-Za-z0-9_-]{1,64}$/.test(String(value||'')); }
function validDepartmentId(value){ return /^[A-Za-z0-9_-]{1,64}$/.test(String(value||'')); }

function corsHeaders(origin) {
  const allowed = origin === SITE_ORIGIN;
  return {
    'Access-Control-Allow-Origin': allowed ? SITE_ORIGIN : 'null',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function securityHeaders() { return { 'X-Content-Type-Options':'nosniff', 'X-Frame-Options':'DENY', 'Referrer-Policy':'strict-origin-when-cross-origin', 'Permissions-Policy':'camera=(), microphone=(), geolocation=()' }; }

function json(data, status = 200, origin = SITE_ORIGIN) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      ...securityHeaders(),
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

function ownerSteamId(env) {
  return String(env.OWNER_STEAM_ID || DEFAULT_OWNER_STEAM_ID);
}

function rankOfPrivilege(privilege, steamId, env) {
  if (steamId && steamId === ownerSteamId(env)) return OWNER_RANK;
  return PRIVILEGE_RANK[privilege] || 0;
}

function privilegeColor(privilege, isOwner) {
  if (isOwner) return '#ffffff';
  return privilege ? (PRIVILEGE_COLORS[privilege] || '#9ca3af') : '#666666';
}

function decodeEntities(value) {
  return String(value || '')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function htmlText(html) {
  return decodeEntities(String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>(?=.)/gi, '\n')
    .replace(/<\/(?:div|p|li|tr|td|th|h[1-6]|section|article|span|label|dt|dd|strong)>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
    .replace(/[\t\r ]+/g, ' ')
    .replace(/\n +/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function labeledValue(text, labels) {
  const source = String(text || '');
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re1 = new RegExp('(?:^|\\n|\\s)' + escaped + '\\s*[:\\-]\\s*([^\\n|•]{1,120})', 'i');
    const m1 = source.match(re1);
    if (m1 && m1[1]) return m1[1].trim();
    const re2 = new RegExp('(?:^|\\n)\\s*' + escaped + '\\s*(?:\\n|$)\\s*([^\\n|•]{1,120})', 'i');
    const m2 = source.match(re2);
    if (m2 && m2[1] && m2[1].trim() !== label) return m2[1].trim();
  }
  return '';
}

function normalizeUnionText(value) {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\t\r ]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function unionScpBlock(text) {
  const lines = normalizeUnionText(text).split('\n').map(x => x.trim()).filter(Boolean);
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    if (/\bSCP\b/i.test(lines[i])) hits.push(i);
  }
  if (!hits.length) return '';
  const exact = hits.find(i => /^SCP(?:[- _].*)?$/i.test(lines[i]));
  const best = exact === undefined ? hits[0] : exact;
  return lines.slice(Math.max(0, best - 2), Math.min(lines.length, best + 20)).join('\n');
}

function jsonField(source, keys) {
  for (const key of keys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('["\\\']' + escaped + '["\\\']\\s*:\\s*["\\\']([^"\\\']{1,160})', 'i');
    const m = source.match(re);
    if (m && m[1]) return decodeEntities(m[1]).trim();
  }
  return '';
}

const SCP_NOT_FOUND = 'Никнейма нету в базе данных SCP RP!';
const SCP_CACHE_TTL = 10 * 60 * 1000;
const scpNicknameCache = new Map();
let scpDirectoryCache = { expiresAt: 0, bySteam64: new Map(), available: false };
let scpDirectoryPromise = null;

function steam64FromSteamId32(value) {
  const m = String(value || '').trim().match(/^STEAM_[01]:([01]):(\d+)$/i);
  if (!m) return '';
  try { return String(76561197960265728n + BigInt(m[2]) * 2n + BigInt(m[1])); } catch (_) { return ''; }
}

async function loadSCPDirectory() {
  if (scpDirectoryCache.expiresAt > Date.now()) return scpDirectoryCache;
  if (scpDirectoryPromise) return scpDirectoryPromise;
  scpDirectoryPromise = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    try {
      // The API response contains steam.steam64_id, steam.steamid and server.real_name.
      const response = await fetch('https://admin.unionteams.ru/api/v2/admins/list/6', {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; SteamChecker/1.1)',
          'Referer': 'https://admin.unionteams.ru/scp/',
          'Origin': 'https://admin.unionteams.ru'
        },
        signal: controller.signal
      });
      if (!response.ok) throw new Error('SCP API HTTP ' + response.status);
      const payload = await response.json();
      let records = Array.isArray(payload) ? payload : (Array.isArray(payload?.data) ? payload.data : (Array.isArray(payload?.items) ? payload.items : null));
      if (!records) throw new Error('Unexpected SCP API response');
      const bySteam64 = new Map();
      for (const record of records) {
        const steam = record?.steam || {};
        const server = record?.server || {};
        const steam64 = String(steam.steam64_id || steam64FromSteamId32(steam.steamid) || '').trim();
        const name = String(server.real_name || '').trim();
        if (steam64 && name) bySteam64.set(steam64, name);
      }
      scpDirectoryCache = { expiresAt: Date.now() + 5 * 60 * 1000, bySteam64, available: true };
      return scpDirectoryCache;
    } finally {
      clearTimeout(timer);
      scpDirectoryPromise = null;
    }
  })();
  try { return await scpDirectoryPromise; }
  catch (_) {
    scpDirectoryCache = { expiresAt: Date.now() + 20 * 1000, bySteam64: new Map(), available: false };
    return scpDirectoryCache;
  }
}

async function fetchSCPNickname(steamId) {
  const steamId64 = String(steamId || '').trim().replace(/\D/g, '');
  if (!steamId64) return null;
  const cached = scpNicknameCache.get(steamId64);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const directory = await loadSCPDirectory();
  // If the API is unavailable, return null so a temporary outage never overwrites a known name.
  if (!directory.available) return null;
  const name = directory.bySteam64.get(steamId64) || SCP_NOT_FOUND;
  scpNicknameCache.set(steamId64, { value: name, expiresAt: Date.now() + SCP_CACHE_TTL });
  return name;
}

async function fetchSteamProfile(steamId) {
  const urls = [
    `https://steamcommunity.com/profiles/${steamId}?xml=1`,
    `https://steamcommunity.com/profiles/${steamId}/`
  ];
  for (const url of urls) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5500);
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SteamChecker/1.1)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        signal: controller.signal
      });
      if (!response.ok) continue;
      const source = await response.text();
      const nameMatch = source.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/i)
        || source.match(/<steamID>(.*?)<\/steamID>/i)
        || source.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i);
      const avatarMatch = source.match(/<avatarFull><!\[CDATA\[(.*?)\]\]><\/avatarFull>/i)
        || source.match(/<avatarFull>(.*?)<\/avatarFull>/i)
        || source.match(/<avatarMedium><!\[CDATA\[(.*?)\]\]><\/avatarMedium>/i)
        || source.match(/<avatarMedium>(.*?)<\/avatarMedium>/i)
        || source.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i)
        || source.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
      const display_name = nameMatch?.[1] ? decodeEntities(nameMatch[1].replace(/<[^>]*>/g, '').trim()) : '';
      const avatar_url = avatarMatch?.[1] ? decodeEntities(avatarMatch[1].trim()) : '';
      if (display_name || avatar_url) return { display_name, avatar_url };
    } catch (_) {
      // Try the regular profile page if the XML endpoint is unavailable.
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}
async function refreshSteamProfile(env, row) {
  if (!row) return row;
  const profile = (!row.avatar_url || !row.display_name || row.display_name === `SteamID ${row.steam_id}`) ? await fetchSteamProfile(row.steam_id) : null;
  const scpNickname = await fetchSCPNickname(row.steam_id);
  const displayName = scpNickname === null ? (row.display_name || SCP_NOT_FOUND) : scpNickname;
  const avatar = profile?.avatar_url || row.avatar_url || '';
  if (displayName !== row.display_name || avatar !== (row.avatar_url || '')) {
    await env.DB.prepare('UPDATE users SET display_name=?, avatar_url=?, updated_at=? WHERE steam_id=?')
      .bind(displayName, avatar, Math.floor(Date.now()/1000), row.steam_id).run();
  }
  return { ...row, display_name: displayName, avatar_url: avatar };
}

function cleanUser(row, env) {
  const steamId = row.steam_id;
  const isOwner = steamId === ownerSteamId(env);
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
    can_manage: isOwner || rankOfPrivilege(privilege, steamId, env) >= PRIVILEGE_RANK['Senior Administrator'],
    can_manage_role_settings: isOwner || privilege === 'Special Admin',
    can_manage_checks: isOwner || rankOfPrivilege(privilege, steamId, env) >= PRIVILEGE_RANK['Senior Administrator'] || (rankOfPrivilege(privilege, steamId, env) > 0 && ['Staff','Recruit'].includes(row.department || 'Без отдела'))
  };
}

function decorateUser(user, roles, departments) {
  const roleKey = user.privilege;
  const depKey = user.department || 'Без отдела';
  const role = roleKey ? roles?.[roleKey] : null;
  const dep = departments?.[depKey] || null;
  if (role) { user.privilege_name = role.name; user.privilege_color = role.color; user.privilege_id = role.role_id; }
  if (dep) { user.department_name = dep.name; user.department_color = dep.color; user.department_id = dep.department_id; }
  return user;
}

async function canConfigureRoleSettings(session, env) {
  if (session.steam_id === ownerSteamId(env)) return true;
  const row = await env.DB.prepare('SELECT privilege FROM users WHERE steam_id=?').bind(session.steam_id).first();
  return row?.privilege === 'Special Admin';
}

function actorRank(session, env) {
  return rankOfPrivilege(session.privilege, session.steam_id, env);
}

function canManageTarget(session, targetRow, newPrivilege, env) {
  const actor = actorRank(session, env);
  const targetId = targetRow?.steam_id || '';
  if (targetId && targetId === ownerSteamId(env)) return false;
  // Special Admin cannot modify another Special Admin; owner remains the only exception.
  if (session.steam_id !== ownerSteamId(env) && session.privilege === 'Special Admin' && targetRow?.privilege === 'Special Admin') return false;
  if (actor === OWNER_RANK || session.privilege === 'Special Admin') return true;
  if (actor <= 0) return false;
  // Curators and Senior Administrators are restricted to their own assigned department.
  const actorDepartment = session.department || 'Без отдела';
  const targetDepartment = targetRow?.department || 'Без отдела';
  if (!['Staff','Recruit'].includes(actorDepartment) || targetDepartment !== actorDepartment) return false;
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
  const profile = await fetchSteamProfile(steamId);
  const displayName = profile?.display_name || `SteamID ${steamId}`;
  const avatarUrl = profile?.avatar_url || '';
  await env.DB.prepare(`
    INSERT INTO users (steam_id, display_name, avatar_url, department, privilege, created_at, updated_at)
    VALUES (?, ?, ?, 'Без отдела', NULL, ?, ?)
    ON CONFLICT(steam_id) DO UPDATE SET display_name=excluded.display_name, avatar_url=excluded.avatar_url, updated_at=excluded.updated_at
  `).bind(steamId, displayName, avatarUrl, now, now).run();
  return env.DB.prepare('SELECT * FROM users WHERE steam_id = ?').bind(steamId).first();
}

async function requireSession(request, env) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) throw new Error('UNAUTHORIZED');
  const token = auth.slice(7).trim();
  if (!token) throw new Error('UNAUTHORIZED');

  const hash = await sha256(token);
  const row = await env.DB.prepare(`
    SELECT s.token_hash, s.steam_id, s.expires_at,
           u.steam_id AS account_steam_id, u.display_name, u.avatar_url, u.department, u.privilege
    FROM sessions s
    LEFT JOIN users u ON u.steam_id = s.steam_id
    WHERE s.token_hash = ?
  `).bind(hash).first();

  if (!row || Number(row.expires_at) <= Math.floor(Date.now() / 1000)) throw new Error('UNAUTHORIZED');
  // A session is valid only while the account has an assigned privilege.
  // This revokes all existing sessions immediately after a role is removed.
  if (!row.account_steam_id || rankOfPrivilege(row.privilege, row.steam_id, env) <= 0) {
    await env.DB.prepare('DELETE FROM sessions WHERE steam_id = ?').bind(row.steam_id).run();
    await env.DB.prepare('DELETE FROM login_tickets WHERE steam_id = ?').bind(row.steam_id).run();
    throw new Error('NO_ACCOUNT');
  }
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
  const account = await env.DB.prepare('SELECT steam_id, privilege FROM users WHERE steam_id = ?').bind(ticketRow.steam_id).first();
  if (!account || rankOfPrivilege(account.privilege, account.steam_id, env) <= 0) {
    await env.DB.prepare('DELETE FROM sessions WHERE steam_id = ?').bind(ticketRow.steam_id).run();
    await env.DB.prepare('DELETE FROM login_tickets WHERE steam_id = ?').bind(ticketRow.steam_id).run();
    throw new Error('NO_ACCOUNT');
  }

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
  await ensureRoleSettings(env);
  const now = Math.floor(Date.now() / 1000);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM login_tickets WHERE expires_at < ?').bind(now),
    env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now),
    env.DB.prepare('DELETE FROM audit_logs WHERE created_at < ?').bind(now - LOG_RETENTION),
    env.DB.prepare('DELETE FROM check_codes WHERE created_at < ?').bind(now - LOG_RETENTION),
    env.DB.prepare('DELETE FROM check_download_tokens WHERE expires_at < ? OR (used_at IS NOT NULL AND used_at < ?)').bind(now, now - LOG_RETENTION)
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

async function fetchPrivateGitHubAsset(env) {
  const token=String(env.GITHUB_TOKEN||'').trim();
  const owner=String(env.GITHUB_REPO_OWNER||'').trim();
  const repo=String(env.GITHUB_REPO_NAME||'').trim();
  const tag=String(env.GITHUB_RELEASE_TAG||'GModScan').trim();
  if(!token || !owner || !repo || !tag) {
    return {ok:false,status:503,message:'Private GitHub download is not configured. Set GITHUB_TOKEN, GITHUB_REPO_OWNER, GITHUB_REPO_NAME and GITHUB_RELEASE_TAG in Worker settings.'};
  }
  const apiHeaders={
    'Authorization':`Bearer ${token}`,
    'Accept':'application/vnd.github+json',
    'X-GitHub-Api-Version':'2022-11-28',
    'User-Agent':'STEAM-CHECKER-private-download'
  };
  let releaseResponse;
  try {
    releaseResponse=await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases/tags/${encodeURIComponent(tag)}`,{headers:apiHeaders});
  } catch(e) {
    return {ok:false,status:502,message:'Could not connect to GitHub to retrieve the private release.'};
  }
  if(!releaseResponse.ok) {
    return {ok:false,status:releaseResponse.status===404?404:502,message:'Private GitHub release was not found or the token lacks read access. Check repository, tag and token permissions.'};
  }
  const release=await releaseResponse.json().catch(()=>null);
  const asset=Array.isArray(release?.assets)?release.assets.find(x=>x?.name==='GModScan.exe'):null;
  if(!asset?.id) return {ok:false,status:404,message:'The private release does not contain an asset named exactly GModScan.exe.'};
  let fileResponse;
  try {
    fileResponse=await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases/assets/${asset.id}`,{
      headers:{...apiHeaders,'Accept':'application/octet-stream'},
      redirect:'follow'
    });
  } catch(e) {
    return {ok:false,status:502,message:'Could not download the private release asset from GitHub.'};
  }
  if(!fileResponse.ok || !fileResponse.body) {
    return {ok:false,status:502,message:'GitHub did not return the executable. Check the release asset and token permissions.'};
  }
  const contentType=(fileResponse.headers.get('Content-Type')||'').toLowerCase();
  if(contentType.includes('application/json') || contentType.includes('text/html')) {
    return {ok:false,status:502,message:'GitHub returned an API error instead of the executable. Check the token permissions.'};
  }
  return {ok:true,response:fileResponse};
}

async function api(request, env) {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin') || '';
  if (origin && origin !== SITE_ORIGIN) return json({ error: 'FORBIDDEN_ORIGIN' }, 403, origin);

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });

  try {
    // Public redemption: atomically consume a 12-digit one-time download code.
    if (url.pathname === '/api/check-codes/redeem' && request.method === 'POST') {
      const body = await request.json().catch(()=>({}));
      const code = String(body.code || '').replace(/\D/g, '');
      if (!/^\d{12}$/.test(code)) return json({ error:'INVALID_CODE' },400,origin);
      const now = Math.floor(Date.now()/1000);
      const changed = await env.DB.prepare(`UPDATE check_codes SET used_at=?, used_by='download-page' WHERE code=? AND used_at IS NULL AND cancelled_at IS NULL AND deleted_at IS NULL`).bind(now,code).run();
      if (!changed.meta.changes) return json({ error:'CODE_INVALID_USED_OR_CANCELLED' },400,origin);
      const downloadToken = await randomToken(32), tokenHash = await sha256(downloadToken);
      await env.DB.prepare('INSERT INTO check_download_tokens (token_hash,code,expires_at,used_at) VALUES (?,?,?,NULL)').bind(tokenHash,code,now+300).run();
      await writeAudit(env,'download-page',code,'CHECK_CODE_USED','code','Не использован','Использован '+new Date(now*1000).toISOString());
      return json({ ok:true, download_url:`${url.origin}/api/check-codes/download?token=${encodeURIComponent(downloadToken)}` },200,origin);
    }
    if (url.pathname === '/api/check-codes/download' && request.method === 'GET') {
      const token=String(url.searchParams.get('token')||'');
      if(!token) return new Response('Invalid download token',{status:400,headers:{'Cache-Control':'no-store'}});
      const hash=await sha256(token), now=Math.floor(Date.now()/1000);
      const changed=await env.DB.prepare('UPDATE check_download_tokens SET used_at=? WHERE token_hash=? AND used_at IS NULL AND expires_at>?').bind(now,hash,now).run();
      if(!changed.meta.changes) return new Response('Download token expired or already used',{status:410,headers:{'Cache-Control':'no-store'}});
      // Fetch the asset from a PRIVATE GitHub repository. No public release URL is exposed.
      const assetResponse=await fetchPrivateGitHubAsset(env);
      if(!assetResponse.ok) {
        return new Response(assetResponse.message || 'Private download asset is not available. Check Worker GitHub settings.', {
          status:assetResponse.status || 502,
          headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}
        });
      }
      const headers=new Headers();
      headers.set('Content-Type','application/octet-stream');
      headers.set('Content-Disposition','attachment; filename="GModScan.exe"');
      headers.set('Cache-Control','no-store, private');
      headers.set('X-Content-Type-Options','nosniff');
      const upstreamLength=assetResponse.response.headers.get('Content-Length');
      if(upstreamLength) headers.set('Content-Length',upstreamLength);
      return new Response(assetResponse.response.body,{status:200,headers});
    }
    const session = await requireSession(request, env);

    if (url.pathname === '/api/me' && request.method === 'GET') {
      let row = await env.DB.prepare('SELECT * FROM users WHERE steam_id = ?').bind(session.steam_id).first();
      row = await refreshSteamProfile(env, row);
      const user = cleanUser(row, env);
      user.role_settings = await getRoleSettings(env);
      user.department_settings = await getDepartmentSettings(env);
      decorateUser(user, user.role_settings, user.department_settings);
      return json(user, 200, origin);
    }

    if (url.pathname === '/api/logout' && request.method === 'POST') {
      const token = (request.headers.get('Authorization') || '').slice(7).trim();
      await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run();
      return json({ ok: true }, 200, origin);
    }

    if (url.pathname.startsWith('/api/steam-profile/') && request.method === 'GET') {
      if (actorRank(session, env) < PRIVILEGE_RANK['Assistant Sudo Curator']) return json({ error: 'FORBIDDEN' }, 403, origin);
      const steamId = url.pathname.split('/').pop().replace(/\D/g, '');
      if (!/^\d{17}$/.test(steamId)) return json({ error: 'INVALID_STEAM_ID' }, 400, origin);
      const [profile, scpNickname] = await Promise.all([fetchSteamProfile(steamId), fetchSCPNickname(steamId)]);
      if (profile?.avatar_url) {
        const existing = await env.DB.prepare('SELECT steam_id FROM users WHERE steam_id=?').bind(steamId).first();
        if (existing) {
          if (scpNickname !== null) await env.DB.prepare('UPDATE users SET avatar_url=?, display_name=?, updated_at=? WHERE steam_id=?').bind(profile.avatar_url, scpNickname, Math.floor(Date.now()/1000), steamId).run();
          else await env.DB.prepare('UPDATE users SET avatar_url=?, updated_at=? WHERE steam_id=?').bind(profile.avatar_url, Math.floor(Date.now()/1000), steamId).run();
        }
      }
      return json({
        steam_id: steamId,
        display_name: scpNickname === null ? SCP_NOT_FOUND : scpNickname,
        avatar_url: profile?.avatar_url || '',
        url: `https://steamcommunity.com/profiles/${steamId}`
      }, 200, origin);
    }


    if (url.pathname === '/api/role-settings' && request.method === 'GET') {
      if (!(await canConfigureRoleSettings(session, env))) return json({ error: 'FORBIDDEN' }, 403, origin);
      return json({ roles: await getRoleSettings(env), departments: await getDepartmentSettings(env) }, 200, origin);
    }

    if (url.pathname === '/api/role-settings' && request.method === 'PUT') {
      if (!(await canConfigureRoleSettings(session, env))) return json({ error: 'FORBIDDEN' }, 403, origin);
      const body = await request.json().catch(()=>null);
      const hasRoles = Array.isArray(body?.roles);
      const hasDepartments = Array.isArray(body?.departments);
      const roles = hasRoles ? body.roles : [];
      const departments = hasDepartments ? body.departments : [];
      if (!hasRoles && !hasDepartments) return json({ error: 'INVALID_ROLE_SETTINGS' }, 400, origin);
      if (hasRoles && roles.length !== ROLE_SETTINGS_DEFAULTS.length) return json({ error: 'INVALID_ROLE_SETTINGS' }, 400, origin);
      if (hasDepartments && departments.length !== DEPARTMENT_SETTINGS_DEFAULTS.length) return json({ error: 'INVALID_DEPARTMENT_SETTINGS' }, 400, origin);
      await ensureRoleSettings(env);
      const currentRoles = await getRoleSettings(env);
      const currentDepartments = await getDepartmentSettings(env);
      const now=Math.floor(Date.now()/1000);
      for (const item of (hasRoles ? roles : [])) {
        const key=String(item?.role_key||'');
        const display=String(item?.display_name||'').trim();
        const color=String(item?.color||'').trim();
        const roleId=String(item?.role_id||'').trim();
        const gradientEnabled=item?.gradient_enabled===true || item?.gradient_enabled===1 || item?.gradient_enabled==='1';
        const gradientColor=String(item?.gradient_color||color).trim();
        if (!ROLE_KEY_SET.has(key) || !display || display.length>48 || !validHexColor(color) || !validHexColor(gradientColor) || !validRoleId(roleId)) return json({ error: 'INVALID_ROLE_SETTINGS' }, 400, origin);
        const before=currentRoles[key] || {};
        await env.DB.prepare('UPDATE role_settings SET display_name=?, color=?, role_id=?, gradient_enabled=?, gradient_color=?, updated_at=? WHERE role_key=?')
          .bind(display,color,roleId,gradientEnabled?1:0,gradientColor,now,key).run();
        if (before.name!==display || before.color!==color || before.role_id!==roleId || !!before.gradient_enabled!==gradientEnabled || (before.gradient_color||'')!==gradientColor) {
          await writeAudit(env, session.steam_id, ownerSteamId(env), 'ROLE_CONFIG', key,
            JSON.stringify({name:before.name||'',color:before.color||'',role_id:before.role_id||'',gradient_enabled:!!before.gradient_enabled,gradient_color:before.gradient_color||''}),
            JSON.stringify({name:display,color,role_id:roleId,gradient_enabled:gradientEnabled,gradient_color:gradientColor}));
        }
      }
      for (const item of (hasDepartments ? departments : [])) {
        const key=String(item?.department_key||'');
        const display=String(item?.display_name||'').trim();
        const color=String(item?.color||'').trim();
        const departmentId=String(item?.department_id||'').trim();
        if (!DEPARTMENT_KEY_SET.has(key) || !display || display.length>48 || !validHexColor(color) || !validDepartmentId(departmentId)) return json({ error: 'INVALID_DEPARTMENT_SETTINGS' }, 400, origin);
        const before=currentDepartments[key] || {};
        await env.DB.prepare('UPDATE department_settings SET display_name=?, color=?, department_id=?, updated_at=? WHERE department_key=?')
          .bind(display,color,departmentId,now,key).run();
        if (before.name!==display || before.color!==color || before.department_id!==departmentId) {
          await writeAudit(env, session.steam_id, ownerSteamId(env), 'DEPARTMENT_CONFIG', key,
            JSON.stringify({name:before.name||'',color:before.color||'',department_id:before.department_id||''}),
            JSON.stringify({name:display,color,department_id:departmentId}));
        }
      }
      return json({ ok:true, roles:await getRoleSettings(env), departments:await getDepartmentSettings(env) },200,origin);
    }

    if (url.pathname === '/api/scp-directory' && request.method === 'GET') {
      if (actorRank(session, env) < PRIVILEGE_RANK['Assistant Sudo Curator']) return json({ error: 'FORBIDDEN' }, 403, origin);
      const directory = await loadSCPDirectory();
      if (!directory.available) return json({ error: 'SCP_DIRECTORY_UNAVAILABLE' }, 503, origin);
      const users = Array.from(directory.bySteam64.entries(), ([steam_id, display_name]) => ({ steam_id, display_name }));
      return json({ users }, 200, origin);
    }

    if (url.pathname === '/api/users' && request.method === 'GET') {
      if (actorRank(session, env) < PRIVILEGE_RANK['Assistant Sudo Curator']) return json({ error: 'FORBIDDEN' }, 403, origin);
      const rows = await env.DB.prepare('SELECT * FROM users').all();
      const actor = actorRank(session, env);
      const roles = await getRoleSettings(env);
      const departments = await getDepartmentSettings(env);
      // Load the SCP directory once per request. Do not call Steam XML for every
      // user here: that created many concurrent external requests and caused the
      // management page to time out. The SCP API already provides Steam64 and
      // real_name in one response.
      const scpDirectory = await loadSCPDirectory();
      const users = await Promise.all(rows.results.map(async originalRow => {
        const row = { ...originalRow };
        if (scpDirectory.available) {
          const scpName = scpDirectory.bySteam64.get(String(row.steam_id)) || SCP_NOT_FOUND;
          row.display_name = scpName;
        }
        const user = decorateUser(cleanUser(row, env), roles, departments);
        user.can_edit = actor === OWNER_RANK
          ? row.steam_id !== ownerSteamId(env)
          : canManageTarget(session, row, row.privilege, env);
        return user;
      }));
      users.sort((a,b) => (Number(b.rank)||0)-(Number(a.rank)||0) || String(a.department||'').localeCompare(String(b.department||'')) || String(a.display_name||'').localeCompare(String(b.display_name||'')));
      return json({ users, roles, departments }, 200, origin);
    }

    if (url.pathname === '/api/users' && request.method === 'POST') {
      if (actorRank(session, env) < PRIVILEGE_RANK['Assistant Sudo Curator']) return json({ error: 'FORBIDDEN' }, 403, origin);

      const body = await request.json();
      const steamId = String(body.steam_id || '').replace(/\D/g, '');
      const department = String(body.department || '');
      const privilege = body.privilege === null || body.privilege === '' ? null : String(body.privilege);

      if (!/^\d{17}$/.test(steamId)) return json({ error: 'INVALID_STEAM_ID' }, 400, origin);
      if (!DEPARTMENT_KEY_SET.has(department)) return json({ error: 'INVALID_DEPARTMENT' }, 400, origin);
      if (privilege !== null && !PRIVILEGES.includes(privilege)) return json({ error: 'INVALID_PRIVILEGE' }, 400, origin);
      if (steamId === ownerSteamId(env)) return json({ error: 'OWNER_PROTECTED' }, 403, origin);

      let old = await env.DB.prepare('SELECT * FROM users WHERE steam_id = ?').bind(steamId).first();
      if (old) old = await refreshSteamProfile(env, old);
      const [steamProfile, scpNickname] = await Promise.all([fetchSteamProfile(steamId), fetchSCPNickname(steamId)]);
      const target = old || { steam_id: steamId, department, privilege: null, display_name: scpNickname === null ? SCP_NOT_FOUND : scpNickname, avatar_url: steamProfile?.avatar_url || '' };
      if (scpNickname !== null) target.display_name = scpNickname;
      else if (!old && !target.display_name) target.display_name = SCP_NOT_FOUND;
      if (steamProfile?.avatar_url) target.avatar_url = steamProfile.avatar_url;
      if (!canManageTarget(session, target, privilege, env)) return json({ error: 'TARGET_OUT_OF_HIERARCHY_OR_DEPARTMENT' }, 403, origin);
      if (session.steam_id !== ownerSteamId(env) && session.privilege !== 'Special Admin' && department !== (session.department || 'Без отдела')) {
        return json({ error: 'CANNOT_ASSIGN_OTHER_DEPARTMENT' }, 403, origin);
      }

      const now = Math.floor(Date.now() / 1000);
      await env.DB.prepare(`
        INSERT INTO users (steam_id, display_name, avatar_url, department, privilege, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(steam_id) DO UPDATE SET display_name=excluded.display_name, avatar_url=COALESCE(NULLIF(excluded.avatar_url,''), users.avatar_url), department=excluded.department, privilege=excluded.privilege, updated_at=excluded.updated_at
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
        if (!privilege) await env.DB.prepare('DELETE FROM login_tickets WHERE steam_id = ?').bind(steamId).run();
      }

      const row = await env.DB.prepare('SELECT * FROM users WHERE steam_id = ?').bind(steamId).first();
      const roles = await getRoleSettings(env), departments = await getDepartmentSettings(env);
      return json({ user: decorateUser(cleanUser(row, env), roles, departments) }, 200, origin);
    }

    if (url.pathname.startsWith('/api/users/') && request.method === 'DELETE') {
      if (actorRank(session, env) < PRIVILEGE_RANK['Assistant Sudo Curator']) return json({ error: 'FORBIDDEN' }, 403, origin);
      const steamId = url.pathname.split('/').pop().replace(/\D/g, '');
      if (!/^\d{17}$/.test(steamId)) return json({ error: 'INVALID_STEAM_ID' }, 400, origin);
      if (steamId === ownerSteamId(env)) return json({ error: 'OWNER_PROTECTED' }, 403, origin);

      const old = await env.DB.prepare('SELECT * FROM users WHERE steam_id = ?').bind(steamId).first();
      if (!old) return json({ error: 'USER_NOT_FOUND' }, 404, origin);
      if (!canManageTarget(session, old, null, env)) return json({ error: 'TARGET_OUT_OF_HIERARCHY' }, 403, origin);

      if ((old.department || 'Без отдела') !== 'Без отдела') await writeAudit(env, session.steam_id, steamId, 'DEPARTMENT', 'department', old.department || 'Без отдела', 'Удалён');
      if (old.privilege) await writeAudit(env, session.steam_id, steamId, 'REMOVE_ROLE', 'privilege', old.privilege, 'Удалён');
      await env.DB.prepare('DELETE FROM users WHERE steam_id=?').bind(steamId).run();
      return json({ ok: true, deleted_steam_id: steamId }, 200, origin);
    }

    if (url.pathname === '/api/check-codes' && request.method === 'GET') {
      await cleanup(env);
      const owner = session.steam_id === ownerSteamId(env);
      const rank = actorRank(session,env);
      const canView = owner || rank >= PRIVILEGE_RANK['Senior Administrator'] || ['Staff','Recruit'].includes(session.department);
      if (!canView) return json({error:'FORBIDDEN'},403,origin);
      await ensureRoleSettings(env);
      const query = owner || rank>=PRIVILEGE_RANK['Senior Administrator']
        ? await env.DB.prepare('SELECT code,creator_steam_id,creator_department,created_at,used_at,used_by,cancelled_at,cancelled_by,deleted_at,deleted_by FROM check_codes ORDER BY created_at DESC LIMIT 500').all()
        : await env.DB.prepare('SELECT code,creator_steam_id,creator_department,created_at,used_at,used_by,cancelled_at,cancelled_by,deleted_at,deleted_by FROM check_codes WHERE creator_steam_id=? ORDER BY created_at DESC LIMIT 500').bind(session.steam_id).all();
      return json({codes:query.results,can_create:owner || rank>=PRIVILEGE_RANK['Senior Administrator'] || ['Staff','Recruit'].includes(session.department),can_cancel:owner || rank>=PRIVILEGE_RANK['Senior Administrator'],can_view_logs:owner || rank>=PRIVILEGE_RANK['Sudo Curator']},200,origin);
    }

    if (url.pathname === '/api/check-codes' && request.method === 'POST') {
      const owner = session.steam_id === ownerSteamId(env);
      if (!owner && actorRank(session,env)<PRIVILEGE_RANK['Senior Administrator'] && !['Staff','Recruit'].includes(session.department)) return json({error:'DEPARTMENT_REQUIRED'},403,origin);
      await ensureRoleSettings(env);
      let code='';
      for(let i=0;i<8;i++) {
        const bytes=new Uint32Array(3); crypto.getRandomValues(bytes);
        code=Array.from(bytes).map(v=>String(v%10000).padStart(4,'0')).join('');
        try { await env.DB.prepare('INSERT INTO check_codes (code,creator_steam_id,creator_department,created_at) VALUES (?,?,?,?)').bind(code,session.steam_id,owner?'Owner':session.department,Math.floor(Date.now()/1000)).run(); break; }
        catch(e) { code=''; }
      }
      if(!code) return json({error:'CODE_GENERATION_FAILED'},500,origin);
      await writeAudit(env,session.steam_id,code,'CHECK_CODE_CREATED','code','',code);
      return json({ok:true,code},200,origin);
    }

    if (url.pathname.startsWith('/api/check-codes/') && request.method === 'DELETE') {
      const code=url.pathname.split('/').pop().replace(/\D/g,'');
      if(!/^\d{12}$/.test(code)) return json({error:'INVALID_CODE'},400,origin);
      const owner=session.steam_id===ownerSteamId(env), rank=actorRank(session,env);
      const row=await env.DB.prepare('SELECT * FROM check_codes WHERE code=?').bind(code).first();
      if(!row) return json({error:'CODE_NOT_FOUND'},404,origin);
      if(row.used_at) return json({error:'CODE_ALREADY_USED'},409,origin);
      if(row.deleted_at) return json({error:'CODE_ALREADY_DELETED'},409,origin);
      if(!owner && session.steam_id!==row.creator_steam_id && rank<PRIVILEGE_RANK['Senior Administrator']) return json({error:'FORBIDDEN'},403,origin);
      const deletedAt=Math.floor(Date.now()/1000);
      await env.DB.prepare('UPDATE check_codes SET deleted_at=?, deleted_by=? WHERE code=? AND used_at IS NULL AND deleted_at IS NULL').bind(deletedAt,session.steam_id,code).run();
      await writeAudit(env,session.steam_id,code,'CHECK_CODE_DELETED','code','Не использован','Удалён пользователем SteamID64 '+session.steam_id);
      return json({ok:true},200,origin);
    }

    if (url.pathname === '/api/logs' && request.method === 'GET') {
      if (session.steam_id !== ownerSteamId(env) && actorRank(session,env) < PRIVILEGE_RANK['Sudo Curator']) return json({ error: 'FORBIDDEN' }, 403, origin);
      await cleanup(env);
      const section = url.searchParams.get('section') || 'all';
      const filters = {
        roles: "action IN ('ROLE_CONFIG','DEPARTMENT_CONFIG')",
        users: "action IN ('GRANT_ROLE','REMOVE_ROLE','DEPARTMENT')",
        codes: "action IN ('CHECK_CODE_CREATED','CHECK_CODE_USED','CHECK_CODE_CANCELLED','CHECK_CODE_DELETED')"
      };
      if (section !== 'all' && !filters[section]) return json({ error: 'INVALID_LOG_SECTION' }, 400, origin);
      const sql = `SELECT id, actor_steam_id, target_steam_id, action, field, old_value, new_value, created_at FROM audit_logs ${section === 'all' ? '' : 'WHERE ' + filters[section]} ORDER BY id DESC LIMIT 500`;
      const rows = await env.DB.prepare(sql).all();
      return json({ logs: rows.results }, 200, origin);
    }

    return json({ error: 'NOT_FOUND' }, 404, origin);
  } catch (error) {
    if (String(error.message) === 'NO_ACCOUNT') return json({ error: 'NO_ACCOUNT' }, 403, origin);
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
        const account = await env.DB.prepare('SELECT * FROM users WHERE steam_id = ?').bind(steamId).first();
        if (!account || rankOfPrivilege(account.privilege, steamId, env) <= 0) {
          await env.DB.prepare('DELETE FROM sessions WHERE steam_id = ?').bind(steamId).run();
          await env.DB.prepare('DELETE FROM login_tickets WHERE steam_id = ?').bind(steamId).run();
          return Response.redirect(`${SITE_ORIGIN}${SITE_PATH}?auth_error=no_account`, 302);
        }
        await refreshSteamProfile(env, account);
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
        return json({ error: ['INVALID_TICKET','NO_ACCOUNT'].includes(String(error.message)) ? String(error.message) : 'SERVER_ERROR' }, String(error.message) === 'NO_ACCOUNT' ? 403 : 401, origin);
      }
    }

    return new Response('Not found', { status: 404 });
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(cleanup(env));
  }
};
