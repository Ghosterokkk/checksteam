from pathlib import Path

root=Path('/mnt/data/workfix')
CSS='''\n.audit-steam-wrap{position:relative;display:inline-block;white-space:nowrap}.audit-steam-id{color:#ddd;text-decoration:underline;text-decoration-color:#57202a;text-underline-offset:3px}.audit-steam-id:hover{color:#ff5267}.audit-steam-tip{display:none;position:absolute;z-index:50;left:0;top:calc(100% + 7px);min-width:190px;max-width:280px;padding:9px 11px;border:1px solid #4a2028;border-radius:7px;background:#10090b;color:#f0f0f0;box-shadow:0 10px 25px #000c;white-space:normal;overflow-wrap:anywhere;text-decoration:none}.audit-steam-wrap:hover .audit-steam-tip,.audit-steam-wrap:focus-within .audit-steam-tip{display:block}\n'''
HELPER='''
const auditNickCache=new Map(),auditNickPending=new Map();
function auditSteamCell(id){if(!id)return '—';const safe=esc(id);return `<span class="audit-steam-wrap"><a class="audit-steam-id" data-audit-steam="${safe}" href="https://steamcommunity.com/profiles/${encodeURIComponent(id)}" target="_blank" rel="noopener noreferrer">${safe}</a><a class="audit-steam-tip" data-audit-tip="${safe}" href="https://steamcommunity.com/profiles/${encodeURIComponent(id)}" target="_blank" rel="noopener noreferrer">Наведи для загрузки никнейма</a></span>`}
async function auditSteamNickname(id){if(auditNickCache.has(id))return auditNickCache.get(id);if(auditNickPending.has(id))return auditNickPending.get(id);const task=(async()=>{let name='';try{const scp=await Promise.race([api('/api/scp-nickname/'+encodeURIComponent(id)),new Promise((_,reject)=>setTimeout(()=>reject(new Error('SCP lookup timeout')),1800))]);if(scp&&!scp.unavailable&&scp.found&&typeof scp.nickname==='string'&&scp.nickname.trim()&&scp.nickname!=='Никнейма нету в базе данных SCP RP!')name=scp.nickname.trim()}catch(_){}if(!name){try{const p=await api('/api/steam-profile/'+encodeURIComponent(id));if(p&&typeof p.display_name==='string'&&p.display_name.trim()&&!/^SteamID\s+\d+$/.test(p.display_name.trim()))name=p.display_name.trim()}catch(_){}}const result=name||'Никнейм Steam недоступен';auditNickCache.set(id,result);return result})();auditNickPending.set(id,task);try{return await task}finally{auditNickPending.delete(id)}}
function wireAuditNicknames(scope=document){scope.querySelectorAll('[data-audit-steam]').forEach(link=>{if(link.dataset.auditBound)return;link.dataset.auditBound='1';const load=async()=>{if(link.dataset.auditLoaded)return;link.dataset.auditLoaded='1';const id=link.dataset.auditSteam,tip=link.parentElement?.querySelector('[data-audit-tip]');if(!tip)return;tip.textContent='Загрузка никнейма…';const name=await auditSteamNickname(id);if(tip.isConnected){tip.textContent=name;link.title=name+' — открыть Steam';}};link.addEventListener('mouseenter',load,{once:true});link.addEventListener('focus',load,{once:true})})}
'''

# setting-codes page
p=root/'setting-codes/index.html'; s=p.read_text()
# add CSS in first style block before first close
idx=s.find('</style>'); s=s[:idx]+CSS+s[idx:]
# helper after api definition
needle="async function api(path,opt={}){opt.headers=Object.assign({'Content-Type':'application/json','Authorization':'Bearer '+token()},opt.headers||{});const r=await fetch(API+path,opt);const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||('HTTP_'+r.status));return d}\n"
assert needle in s
s=s.replace(needle,needle+HELPER,1)
old="async function loadCodeLogs(){const box=document.getElementById('code-logs');try{const d=await api('/api/logs?section=codes');document.getElementById('code-logs-body').innerHTML=(d.logs||[]).map(l=>`<tr><td>${esc(new Date(Number(l.created_at)*1000).toLocaleString('ru-RU'))}</td><td>${esc(l.actor_steam_id)}</td><td>${esc(l.target_steam_id||l.field||'—')}</td><td>${esc(actionLabel(l.action))}</td><td>${esc(l.new_value||'—')}</td></tr>`).join('')||'<tr><td colspan=\"5\">Записей пока нет.</td></tr>';box.style.display='block'}catch(e){box.style.display='none'}}"
new="async function loadCodeLogs(){const box=document.getElementById('code-logs');try{const d=await api('/api/logs?section=codes');document.getElementById('code-logs-body').innerHTML=(d.logs||[]).map(l=>`<tr><td>${esc(new Date(Number(l.created_at)*1000).toLocaleString('ru-RU'))}</td><td>${auditSteamCell(l.actor_steam_id)}</td><td>${l.target_steam_id?auditSteamCell(l.target_steam_id):esc(l.field||'—')}</td><td>${esc(actionLabel(l.action))}</td><td>${esc(l.new_value||'—')}</td></tr>`).join('')||'<tr><td colspan=\"5\">Записей пока нет.</td></tr>';box.style.display='block';wireAuditNicknames(box)}catch(e){box.style.display='none'}}"
assert old in s
s=s.replace(old,new,1);p.write_text(s)

# role-settings page
p=root/'checker/role-settings/index.html'; s=p.read_text()
idx=s.find('</style>'); s=s[:idx]+CSS+s[idx:]
needle="const api=(path,opt)=>window.CheckSteamAuth.api(path,opt);\n"
assert needle in s
s=s.replace(needle,needle+HELPER,1)
old="async function loadRoleLogs(){try{const d=await api('/api/logs?section=roles');document.getElementById('role-logs-body').innerHTML=(d.logs||[]).map(l=>`<tr><td>${esc(new Date(Number(l.created_at)*1000).toLocaleString('ru-RU'))}</td><td>${esc(l.actor_steam_id)}</td><td>${esc(l.action==='ROLE_CONFIG'?'Роли':'Отделы')}</td><td>${esc(l.field||'—')}</td><td>${esc(l.old_value||'—')}</td><td>${esc(l.new_value||'—')}</td></tr>`).join('')||'<tr><td colspan=\"6\">Записей пока нет.</td></tr>'}catch(e){document.getElementById('role-logs').style.display='none'}}"
new="async function loadRoleLogs(){try{const d=await api('/api/logs?section=roles');const box=document.getElementById('role-logs');document.getElementById('role-logs-body').innerHTML=(d.logs||[]).map(l=>`<tr><td>${esc(new Date(Number(l.created_at)*1000).toLocaleString('ru-RU'))}</td><td>${auditSteamCell(l.actor_steam_id)}</td><td>${esc(l.action==='ROLE_CONFIG'?'Роли':'Отделы')}</td><td>${esc(l.field||'—')}</td><td>${esc(l.old_value||'—')}</td><td>${esc(l.new_value||'—')}</td></tr>`).join('')||'<tr><td colspan=\"6\">Записей пока нет.</td></tr>';wireAuditNicknames(box)}catch(e){document.getElementById('role-logs').style.display='none'}}"
assert old in s
s=s.replace(old,new,1);p.write_text(s)

# setting-users page: replace existing logSteamLink and loadLogs with same fallback behaviour
p=root/'setting-users/index.html'; s=p.read_text()
# CSS already has own styles, append fallback hover styling in a style block
idx=s.find('</style>'); s=s[:idx]+CSS+s[idx:]
# api exists above functions, add helpers before logSteamLink
needle='function logSteamLink(id){'
assert needle in s
s=s.replace(needle,HELPER+needle,1)
old_start=s.index('function logSteamLink(id){')
old_end=s.index('\n\nasync function loadSettings()',old_start)
new_block='''function logSteamLink(id){if(!id)return '—';const u=users.find(x=>x.steam_id===id);const marker='Никнейма нету в базе данных SCP RP!';const nick=u?.display_name||'Загрузка никнейма…';const fallback=nick===marker||/^SteamID \\d+$/.test(nick)||nick==='Никнейм не найден';return `<span class="log-steam-wrap audit-steam-wrap"><a class="log-steam-link audit-steam-id" data-audit-steam="${esc(id)}" data-log-steam-id="${esc(id)}" href="https://steamcommunity.com/profiles/${encodeURIComponent(id)}" target="_blank" rel="noopener noreferrer" title="${esc(nick)} — открыть Steam">${esc(id)}</a><a class="log-nickname audit-steam-tip" data-audit-tip="${esc(id)}" href="https://steamcommunity.com/profiles/${encodeURIComponent(id)}" target="_blank" rel="noopener noreferrer">${esc(fallback?'Наведи для загрузки никнейма':nick)}</a></span>`;}
async function loadLogs(){const box=document.getElementById('logs');try{const d=await api('/api/logs?section=users');const t=document.getElementById('logs-body');t.innerHTML=(d.logs||[]).map(l=>`<tr><td>${esc(new Date(Number(l.created_at)*1000).toLocaleString('ru-RU'))}</td><td>${logSteamLink(l.actor_steam_id)}</td><td>${logSteamLink(l.target_steam_id)}</td><td>${esc(l.action==='GRANT_ROLE'?'Выдал роль':l.action==='REMOVE_ROLE'?'Удалил роль':l.action==='DEPARTMENT'?'Изменил отдел':l.action==='ROLE_CONFIG'?'Изменил настройки роли':l.action==='DEPARTMENT_CONFIG'?'Изменил настройки отдела':l.action==='CHECK_CODE_CREATED'?'Создал код проверки':l.action==='CHECK_CODE_USED'?'Код проверки использован':l.action==='CHECK_CODE_CANCELLED'?'Отменил код проверки':l.action)}</td><td>${esc(l.old_value||'—')}</td><td>${esc(l.new_value||'—')}</td></tr>`).join('');box.style.display='block';wireAuditNicknames(box)}catch(e){box.style.display='none'}}'''
s=s[:old_start]+new_block+s[old_end:]
p.write_text(s)
print('patched audit fallback in 3 pages')
