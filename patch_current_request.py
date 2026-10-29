from pathlib import Path
import re, zipfile
root=Path('/mnt/data/workfix')
worker=root/'steam-auth-cloudflare/worker.js'
s=worker.read_text()
# Do not do outbound Steam/SCP fetches for every row on every list request; this was causing slow loading.
s=s.replace("      let row = await env.DB.prepare('SELECT * FROM users WHERE steam_id = ?').bind(session.steam_id).first();\n      row = await refreshSteamProfile(env, row);\n      const user = cleanUser(row, env);", "      const row = await env.DB.prepare('SELECT * FROM users WHERE steam_id = ?').bind(session.steam_id).first();\n      const user = cleanUser(row, env);")
s=s.replace("      const users = await Promise.all(rows.results.map(async row => {\n        row = await refreshSteamProfile(env, row);\n        const user = decorateUser(cleanUser(row, env), roles, departments);", "      const users = rows.results.map(row => {\n        const user = decorateUser(cleanUser(row, env), roles, departments);")
s=s.replace("        return user;\n      }));\n      users.sort", "        return user;\n      });\n      users.sort")
# Add authenticated endpoint to query SCP nickname only when requested, keeping normal page load fast.
needle="    if (url.pathname.startsWith('/api/steam-profile/') && request.method === 'GET') {"
route="""    if (url.pathname.startsWith('/api/scp-nickname/') && request.method === 'GET') {
      const steamId = url.pathname.split('/').pop().replace(/\\D/g, '');
      if (!/^\\d{17}$/.test(steamId)) return json({ error: 'INVALID_STEAM_ID' }, 400, origin);
      const nickname = await fetchSCPNickname(steamId);
      // null means the SCP panel could not be read (e.g. login wall/network error); do not mislabel it as no record.
      return json({ steam_id: steamId, nickname, found: nickname !== null && nickname !== SCP_NOT_FOUND, unavailable: nickname === null }, 200, origin);
    }

"""
if route not in s:
    s=s.replace(needle,route+needle)
# Keep existing records' names intact when SCP panel is temporarily unavailable; already handled in refreshSteamProfile.
worker.write_text(s)

# Make the home/profile display use the SCP nickname asynchronously, without blocking authentication or first paint.
auth=root/'assets/steam-auth.js'; a=auth.read_text()
needle="    document.querySelectorAll('[data-user-name]').forEach(function(el){ el.textContent=name; });"
replacement=needle+"\n    // Update the visible name from SCP RP after the cached profile has rendered; never block initial page load.\n    if(profile && profile.steam_id && getToken()){\n      api('/api/scp-nickname/' + encodeURIComponent(profile.steam_id), {method:'GET'}).then(function(result){\n        if(result && result.nickname){\n          document.querySelectorAll('[data-user-name]').forEach(function(el){ el.textContent=result.nickname; });\n          const cached=getCached(); if(cached && cached.steam_id===profile.steam_id){cached.display_name=result.nickname; localStorage.setItem(PROFILE_KEY,JSON.stringify(cached));sessionStorage.setItem(PROFILE_KEY,JSON.stringify(cached));}\n        }\n      }).catch(function(){});\n    }"
if "Update the visible name from SCP RP" not in a:
    a=a.replace(needle,replacement)
auth.write_text(a)

# Improve the filter options for dynamic departments and privilege list, and tooltip fallback for Steam nicknames in logs.
page=root/'setting-users/index.html'; h=page.read_text()
# Avoid browser select popup color issues already mostly handled; ensure menus are dark and readable across browsers.
css='''\n<style id="filter-menu-contrast-fix">\n.filter-select{isolation:isolate}.filter-menu{background:#090909!important;color:#f2f2f2!important;backdrop-filter:blur(10px)}.filter-option{color:#e5e5e5!important;background:#111!important}.filter-option.selected{color:#fff!important;background:linear-gradient(90deg,#40101b,#19090d)!important;border-color:#9a263c!important}.filter-option:hover{color:#fff!important;background:#261016!important}.filter-trigger{color:#f4f4f4!important}.filter-trigger:focus-visible{outline:2px solid #ed2945;outline-offset:2px}\n.log-nickname{pointer-events:none}\n</style>\n'''
if 'id="filter-menu-contrast-fix"' not in h:
    h=h.replace('</head>',css+'</head>',1)
# Tooltip uses SCP nickname when available; if the record is the SCP-missing marker, fetch Steam profile name on hover.
old="function logSteamLink(id){if(!id)return '—';const u=users.find(x=>x.steam_id===id);const nick=u?.display_name||'Никнейм не найден в списке пользователей';return `<a class=\"log-steam-link\" href=\"https://steamcommunity.com/profiles/${encodeURIComponent(id)}\" target=\"_blank\" rel=\"noopener noreferrer\" title=\"${esc(nick)} — открыть Steam\">${esc(id)}<span class=\"log-nickname\">${esc(nick)}</span></a>`;}"
new="""function logSteamLink(id){if(!id)return '—';const u=users.find(x=>x.steam_id===id);const marker='Никнейма нету в базе данных SCP RP!';const nick=u?.display_name||'Никнейм не найден';const fallback=nick===marker||/^SteamID \\d+$/.test(nick);return `<a class=\"log-steam-link\" data-log-steam-id=\"${esc(id)}\" href=\"https://steamcommunity.com/profiles/${encodeURIComponent(id)}\" target=\"_blank\" rel=\"noopener noreferrer\" title=\"${esc(nick)} — открыть Steam\">${esc(id)}<span class=\"log-nickname\">${esc(fallback?'Загрузка никнейма Steam…':nick)}</span></a>`;}"""
if old in h:
    h=h.replace(old,new)
# After rendering logs, request Steam name for missing-SCP records and update hover card; link itself always opens Steam.
old2="box.style.display='block';}catch(e){box.style.display='none';}}"
new2="""box.style.display='block';t.querySelectorAll('[data-log-steam-id]').forEach(link=>{const id=link.dataset.logSteamId;const u=users.find(x=>x.steam_id===id);if(!u||u.display_name==='Никнейма нету в базе данных SCP RP!'||/^SteamID \\d+$/.test(u.display_name||'')){api('/api/steam-profile/'+encodeURIComponent(id)).then(p=>{const tip=link.querySelector('.log-nickname');if(tip&&p?.display_name){tip.textContent=p.display_name;link.title=p.display_name+' — открыть Steam';}}).catch(()=>{const tip=link.querySelector('.log-nickname');if(tip)tip.textContent='Никнейм Steam недоступен';});}});}catch(e){box.style.display='none';}}"""
if old2 in h:
    h=h.replace(old2,new2)
# Ensure search can match either SCP nickname or Steam ID (already true); update helper text for no match.
page.write_text(h)

# Package full project.
out=Path('/mnt/data/Версия 1.1_SCP_никнеймы_быстрая_загрузка.zip')
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
    for f in root.rglob('*'):
        if f.is_file() and f.name != 'patch_current_request.py' and '__pycache__' not in f.parts:
            z.write(f,f.relative_to(root).as_posix())
print(out)
