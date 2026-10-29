from pathlib import Path
import zipfile
root=Path('/mnt/data/workfix')
p=root/'steam-auth-cloudflare/worker.js'
s=p.read_text(encoding='utf-8')
s=s.replace("async function fetchSCPNickname(steamId) {\n  // The SCP table is queried server-side to avoid browser CORS restrictions.", "async function fetchSCPNickname(steamId) {\n  // SCP panel rows use SteamID32; accept SteamID64 from the website and convert it.\n  const steamId64 = String(steamId || '').replace(/\\D/g, '');\n  const steamId32 = /^7656119\\d{10}$/.test(steamId64) ? String(BigInt(steamId64) - 76561197960265728n) : steamId64;\n  const lookupIds = [...new Set([steamId32, steamId64].filter(Boolean))];\n  // The SCP table is queried server-side to avoid browser CORS restrictions.")
s=s.replace("      if (!row.includes(steamId)) continue;", "      if (!lookupIds.some(id => row.includes(id))) continue;")
s=s.replace("        const index = cells.findIndex(cell => cell.includes(steamId));", "        const index = cells.findIndex(cell => lookupIds.some(id => cell === id || cell.includes(id)));")
# The JSON fallback previously only searched SteamID64; use SteamID32-first lookup and accept both IDs.
start=s.find('    const escapedId = steamId.replace(', s.find('async function fetchSCPNickname'))
end=s.find('    if (around && around[1]) return decodeEntities(around[1]).trim();', start)
if start!=-1 and end!=-1:
    end += len('    if (around && around[1]) return decodeEntities(around[1]).trim();')
    repl=r'''    let around = null;
    for (const lookupId of lookupIds) {
      const escapedId = lookupId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      around = new RegExp('(?:"(?:steamid|steam_id|steamid32|steamid64|user_id|id)"\\s*:\\s*"?' + escapedId + '"?)[\\s\\S]{0,500}?"(?:nickname|nick|name|player_name)"\\s*:\\s*"([^"]{1,120})"', 'i').exec(body)
        || new RegExp('"(?:nickname|nick|name|player_name)"\\s*:\\s*"([^"]{1,120})"[\\s\\S]{0,500}?(?:"(?:steamid|steam_id|steamid32|steamid64|user_id|id)"\\s*:\\s*"?' + escapedId + '"?)', 'i').exec(body);
      if (around) break;
    }
    if (around && around[1]) return decodeEntities(around[1]).trim();'''
    s=s[:start]+repl+s[end:]
p.write_text(s,encoding='utf-8')

p=root/'setting-users/index.html'
s=p.read_text(encoding='utf-8')
s=s.replace('<div class="filter-control"><label for="filter-privilege">Привилегия</label><select id="filter-privilege"><option value="">Все привилегии</option><option>Владелец</option><option>Special Admin</option><option>Sudo Curator</option><option>Assistant Sudo Curator</option><option>Senior Administrator</option><option>Administrator</option><option value="none">Без привилегии</option></select></div>', '<div class="filter-control"><label>Привилегия</label><input type="hidden" id="filter-privilege" value=""><div class="filter-select" id="filter-privilege-select"><button type="button" class="filter-trigger">Все привилегии</button><div class="filter-menu"></div></div></div>')
s=s.replace('<div class="filter-control"><label for="filter-department">Отдел</label><select id="filter-department"><option value="">Все отделы</option><option>Staff</option><option>Recruit</option><option>Без отдела</option></select></div>', '<div class="filter-control"><label>Отдел</label><input type="hidden" id="filter-department" value=""><div class="filter-select" id="filter-department-select"><button type="button" class="filter-trigger">Все отделы</button><div class="filter-menu"></div></div></div>')
s=s.replace('<div class="filter-control"><label for="filter-editable">Доступ к редактированию</label><select id="filter-editable"><option value="">Все пользователи</option><option value="yes">Можно редактировать</option><option value="no">Нет доступа</option></select></div>', '<div class="filter-control"><label>Доступ к редактированию</label><input type="hidden" id="filter-editable" value=""><div class="filter-select" id="filter-editable-select"><button type="button" class="filter-trigger">Все пользователи</button><div class="filter-menu"></div></div></div>')
css='''<style id="filter-polish-and-fast-load">
.user-filters{grid-template-columns:minmax(190px,1.4fr) repeat(3,minmax(150px,1fr)) auto;gap:11px;align-items:end}.filter-control{gap:7px}.filter-control label{font-size:10px;color:#aaa;letter-spacing:.35px}.user-filters input[type=search]{color:#f5f5f5;background:#090909;border:1px solid #333}.filter-select{position:relative;width:100%;min-width:0}.filter-trigger{position:relative;width:100%;height:44px;padding:0 34px 0 13px;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border:1px solid #303030;border-radius:8px;color:#eee;background:linear-gradient(180deg,#151515,#080808);font:inherit;font-size:12px;cursor:pointer;transition:border-color .15s,box-shadow .15s}.filter-trigger:after{content:"";position:absolute;right:13px;top:17px;width:7px;height:7px;border-right:1.5px solid #ed2945;border-bottom:1.5px solid #ed2945;transform:rotate(45deg)}.filter-select.open .filter-trigger,.filter-trigger:hover{border-color:#ed2945;box-shadow:0 0 0 3px #e9002218}.filter-menu{display:none;position:absolute;z-index:100;top:calc(100% + 6px);left:0;right:0;padding:5px;background:#0b0b0b;border:1px solid #3a2024;border-radius:9px;box-shadow:0 16px 36px #000c;max-height:260px;overflow:auto}.filter-select.open .filter-menu{display:grid;gap:3px}.filter-option{width:100%;min-height:35px;padding:8px 10px;border:1px solid transparent;border-radius:6px;background:#101010;color:#c9c9c9;text-align:left;font:inherit;font-size:11px;cursor:pointer}.filter-option:hover{background:#1b080c;border-color:#6b1b2a;color:#fff}.filter-option.selected{background:linear-gradient(90deg,#321018,#17090c);border-color:#812238;color:#fff}.user-filters #clear-user-filters{align-self:end;height:44px;border-radius:8px;padding:0 13px}.loading-screen{transition:opacity .16s ease,visibility .16s ease}.loading-box b{color:#ddd}.loading-box span{color:#777}@media(max-width:900px){.user-filters{grid-template-columns:1fr 1fr}.user-filters>input[type=search]{grid-column:span 2}}@media(max-width:650px){.user-filters{grid-template-columns:1fr}.user-filters>input[type=search]{grid-column:auto}}
</style>'''
s=s.replace('</head>',css+'\n</head>',1)
needle='function filteredUsers(){'
helper='''function initFilterSelect(id, options){
 const root=document.getElementById(id+'-select');if(!root)return;const trigger=root.querySelector('.filter-trigger'),menu=root.querySelector('.filter-menu'),hidden=document.getElementById(id);
 menu.innerHTML=options.map(([value,label])=>`<button type="button" class="filter-option${value===''?' selected':''}" data-value="${esc(value)}">${esc(label)}</button>`).join('');
 trigger.addEventListener('click',()=>{document.querySelectorAll('.filter-select.open').forEach(el=>{if(el!==root)el.classList.remove('open')});root.classList.toggle('open')});
 menu.querySelectorAll('.filter-option').forEach(btn=>btn.addEventListener('click',()=>{hidden.value=btn.dataset.value;trigger.textContent=btn.textContent;menu.querySelectorAll('.filter-option').forEach(x=>x.classList.toggle('selected',x===btn));root.classList.remove('open');renderUsers()}));
}
function initUserFilters(){initFilterSelect('filter-privilege',[['','Все привилегии'],['Владелец','Владелец'],['Special Admin','Special Admin'],['Sudo Curator','Sudo Curator'],['Assistant Sudo Curator','Assistant Sudo Curator'],['Senior Administrator','Senior Administrator'],['Administrator','Administrator'],['none','Без привилегии']]);initFilterSelect('filter-department',[['','Все отделы'],['Staff','Staff'],['Recruit','Recruit'],['Без отдела','Без отдела']]);initFilterSelect('filter-editable',[['','Все пользователи'],['yes','Можно редактировать'],['no','Нет доступа']]);}
document.addEventListener('click',e=>{if(!e.target.closest('.filter-select'))document.querySelectorAll('.filter-select.open').forEach(el=>el.classList.remove('open'))});
'''
s=s.replace(needle,helper+needle,1)
old="['user-search','filter-privilege','filter-department','filter-editable'].forEach(id=>document.getElementById(id)?.addEventListener('input',renderUsers));\n  document.getElementById('clear-user-filters')?.addEventListener('click',()=>{['user-search','filter-privilege','filter-department','filter-editable'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});renderUsers();});"
new="initUserFilters();\n  document.getElementById('user-search')?.addEventListener('input',renderUsers);\n  document.getElementById('clear-user-filters')?.addEventListener('click',()=>{['user-search','filter-privilege','filter-department','filter-editable'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});document.querySelectorAll('.filter-select').forEach(root=>{root.classList.remove('open');const trigger=root.querySelector('.filter-trigger'),first=root.querySelector('.filter-option');if(first){trigger.textContent=first.textContent;root.querySelectorAll('.filter-option').forEach(x=>x.classList.toggle('selected',x===first));}});renderUsers();});"
s=s.replace(old,new)
s=s.replace('},5000);','},2200);',1)
s=s.replace('Никнейм берётся из базы SCP RP по SteamID64; аватар — из Steam.','Никнейм ищется в базе SCP RP по SteamID32; аватар — из Steam.')
p.write_text(s,encoding='utf-8')
out=Path('/mnt/data/Версия 1.1_фильтры_SCP_никнеймы_исправленная.zip')
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
 for f in root.rglob('*'):
  if f.is_file() and f.name!='patch_request.py' and '__pycache__' not in f.parts:z.write(f,f.relative_to(root))
print(out, out.stat().st_size)
