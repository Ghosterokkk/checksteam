// Cloudflare Worker — Steam OpenID login, no Render required.
// Routes: /auth/steam and /auth/steam/callback
// Deploy with: wrangler deploy
const SITE_ORIGIN = 'https://checksteam.ru';
const STEAM_OPENID = 'https://steamcommunity.com/openid/login';

function loginUrl(origin) {
  const returnTo = origin + '/auth/steam/callback';
  const p = new URLSearchParams({
    'openid.ns':'http://specs.openid.net/auth/2.0',
    'openid.mode':'checkid_setup',
    'openid.return_to':returnTo,
    'openid.realm':origin+'/',
    'openid.identity':'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id':'http://specs.openid.net/auth/2.0/identifier_select'
  });
  return STEAM_OPENID+'?'+p.toString();
}

async function verify(requestUrl) {
  const u=new URL(requestUrl);
  const params=new URLSearchParams(u.search);
  params.set('openid.mode','check_authentication');
  const r=await fetch(STEAM_OPENID,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:params.toString()});
  const t=await r.text();
  if(!t.includes('is_valid:true')) throw new Error('Steam OpenID verification failed');
  const claimed=params.get('openid.claimed_id')||'';
  const m=claimed.match(/\/id\/(\d+)$/);
  if(!m) throw new Error('SteamID missing');
  return m[1];
}

function page(steamId){
  const safe=steamId.replace(/[^0-9]/g,'');
  return `<!doctype html><meta charset="utf-8"><title>Steam authorization</title><style>body{margin:0;background:#020202;color:#ddd;font:16px Arial,sans-serif;display:grid;place-items:center;min-height:100vh}main{padding:28px 34px;border:1px solid #1b1b1b;border-radius:10px;background:#090909;text-align:center}a{color:#ff1836}</style><main><h2>Вход через Steam выполнен</h2><p>SteamID: ${safe}</p><p><a href="${SITE_ORIGIN}/index">Вернуться на сайт</a></p></main>`;
}

export default {async fetch(request){
  const u=new URL(request.url);
  if(u.pathname==='/auth/steam') return Response.redirect(loginUrl(u.origin),302);
  if(u.pathname==='/auth/steam/callback'){
    try { const id=await verify(request.url); return new Response(page(id),{headers:{'content-type':'text/html;charset=UTF-8'}}); }
    catch(e){ return new Response('Steam authorization failed.',{status:401}); }
  }
  return new Response('Not found',{status:404});
}};
