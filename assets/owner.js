(function(){
  const API = window.STEAM_API_BASE.replace(/\/$/, '');
  const state = {users:[], me:null};
  const privilegeColors = {
    'Administrator':'#ff1836',
    'Senior Administrator':'#3d7cff',
    'Assistant Sudo Curator':'#a855f7',
    'Sudo Curator':'#22d3ee',
    'Special Admin':'#9ca3af',
    'Владелец':'#ffffff'
  };
  const rank = {'Administrator':1,'Senior Administrator':2,'Assistant Sudo Curator':3,'Sudo Curator':4,'Special Admin':5,'Владелец':6};

  function token(){return localStorage.getItem('checksteam_session_v1')||sessionStorage.getItem('checksteam_session_v1')||'';}
  async function api(path, options){
    const opts=Object.assign({headers:{}},options||{});
    opts.headers=Object.assign({'Content-Type':'application/json','Authorization':'Bearer '+token()},opts.headers);
    const r=await fetch(API+path,opts);
    const data=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(data.error||('HTTP_'+r.status));
    return data;
  }
  function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function rankName(u){return u.is_owner?'Владелец':(u.privilege||'Без привилегии');}
  function configurePrivilegeOptions(){
    const select=document.getElementById('privilege');
    const current=select.value;
    const myRank=state.me?.rank||0;
    select.innerHTML='<option value="">Привилегия не назначена</option>' +
      ['Administrator','Senior Administrator','Assistant Sudo Curator','Sudo Curator','Special Admin']
        .filter(r=>myRank>rank[r])
        .map(r=>'<option value="'+r+'">'+r+'</option>').join('');
    if(current && myRank>rank[current]) select.value=current;
  }
  function renderHierarchy(){
    const myRank=state.me?.rank||0;
    const roles=['Special Admin','Sudo Curator','Assistant Sudo Curator','Senior Administrator','Administrator'];
    const box=document.getElementById('hierarchy');
    box.innerHTML=roles.map(r=>`<div class="hier-row"><span class="hier-rank">${rank[r]}</span><b style="color:${privilegeColors[r]}">${r}</b><span class="hier-arrow">→</span><span>${myRank>rank[r]?'можно выдавать/снимать':'нет доступа'}</span></div>`).join('');
  }
  function render(){
    const wrap=document.getElementById('users-body'); wrap.innerHTML='';
    state.users.forEach(function(u){
      const row=document.createElement('div'); row.className='user-row';
      const color=privilegeColors[u.effective_privilege||u.privilege]||'#666';
      const avatar=u.avatar_url||'';
      const role=u.effective_privilege||u.privilege||'Привилегия не назначена';
      const actions=u.can_edit
        ? `<button class="action-btn edit-user" data-id="${esc(u.steam_id)}">Изменить</button><button class="action-btn delete-btn reset-user" data-id="${esc(u.steam_id)}">Удалить</button>`
        : '<span class="no-rights">Нет прав</span>';
      row.innerHTML=`
        <div class="user-main"><img class="user-avatar" src="${esc(avatar)}" alt=""><div class="user-name"><b>${esc(u.display_name)}</b><small>${esc(u.unionteams?.callsign||'Steam профиль')}${u.unionteams?.role ? ' · SCP: '+esc(u.unionteams.role) : ''}${u.unionteams?.hours ? ' · '+esc(u.unionteams.hours)+' ч.' : ''}</small></div></div>
        <div class="user-role"><span>Привилегия</span><b style="color:${color}">${esc(role)}</b></div>
        <div class="user-dept"><span>Отдел</span><b>${esc(u.department||'Без отдела')}</b></div>
        <div class="steam64"><span>SteamID64</span><b>${esc(u.steam_id)}</b><div class="user-actions">${actions}</div></div>`;
      wrap.appendChild(row);
    });
    wrap.querySelectorAll('.edit-user').forEach(b=>b.onclick=()=>editUser(b.dataset.id));
    wrap.querySelectorAll('.reset-user').forEach(b=>b.onclick=()=>deleteUser(b.dataset.id));
  }
  function fill(u){
    document.getElementById('steam_id').value=u.steam_id;
    document.getElementById('department').value=u.department||'Без отдела';
    const select=document.getElementById('privilege');
    select.value=u.privilege||'';
  }
  function editUser(id){const u=state.users.find(x=>x.steam_id===id); if(u){fill(u); window.scrollTo({top:0,behavior:'smooth'});}}
  async function deleteUser(id){
    const u=state.users.find(x=>x.steam_id===id);
    const name=u?.display_name || id;
    if(!confirm('Удалить пользователя '+name+' и полностью удалить его запись SteamID64 из базы?')) return;
    try{await api('/api/users/'+encodeURIComponent(id),{method:'DELETE'}); await loadUsers(); setStatus('Пользователь удалён'); if(state.me?.is_owner) await loadLogs();}
    catch(e){setStatus(errorText(e.message),true);}
  }
  function errorText(code){
    const m={TARGET_OUT_OF_HIERARCHY:'Нельзя изменить пользователя выше или на вашем уровне.',OWNER_PROTECTED:'Владельца изменить нельзя.',FORBIDDEN:'Недостаточно прав.',INVALID_STEAM_ID:'Неверный SteamID.',USER_NOT_FOUND:'Пользователь не найден.'};
    return m[code]||code;
  }
  async function loadUsers(){const data=await api('/api/users',{method:'GET'}); state.users=data.users||[]; render();}
  async function save(e){
    e.preventDefault();
    const steamId=document.getElementById('steam_id').value.trim();
    const department=document.getElementById('department').value;
    const privilege=document.getElementById('privilege').value||null;
    try{
      const result=await api('/api/users',{method:'POST',body:JSON.stringify({steam_id:steamId,department,privilege})});
      fill(result.user); await loadUsers(); setStatus('Сохранено');
      if(state.me?.is_owner) await loadLogs();
    }catch(e){setStatus(errorText(e.message),true);}
  }
  function setStatus(text,error){const el=document.getElementById('status'); el.textContent=text; el.style.color=error?'#ff1836':'#777';}
  function formatDate(ts){return new Date(Number(ts)*1000).toLocaleString('ru-RU');}
  function actionText(log){
    if(log.action==='GRANT_ROLE') return 'Выдал роль';
    if(log.action==='REMOVE_ROLE') return 'Снял роль';
    if(log.action==='DEPARTMENT') return 'Изменил отдел';
    return log.action;
  }
  async function loadLogs(){
    const wrap=document.getElementById('logs-wrap');
    if(!state.me?.is_owner){wrap.style.display='none';return;}
    try{
      const data=await api('/api/logs',{method:'GET'});
      const tbody=document.getElementById('logs-body'); tbody.innerHTML='';
      (data.logs||[]).forEach(l=>{
        const tr=document.createElement('tr');
        const oldValue=l.old_value||'—', newValue=l.new_value||'—';
        tr.innerHTML='<td>'+esc(formatDate(l.created_at))+'</td><td>'+esc(l.actor_steam_id)+'</td><td>'+esc(l.target_steam_id)+'</td><td>'+esc(actionText(l))+'</td><td>'+esc(oldValue)+'</td><td>'+esc(newValue)+'</td>';
        tbody.appendChild(tr);
      });
      wrap.style.display='block';
    }catch(e){setStatus(errorText(e.message),true);}
  }
  document.addEventListener('DOMContentLoaded',async function(){
    if(!token()){window.location.href=window.STEAM_SITE_URL;return;}
    try{
      const me=await window.CheckSteamAuth.api('/api/me',{method:'GET'});
      if(!me.can_manage){document.getElementById('owner-denied').style.display='block';return;}
      state.me=me;
      document.getElementById('owner-app').style.display='block';
      document.getElementById('owner-name').textContent=me.effective_privilege||me.privilege||'Без привилегии';
      document.getElementById('owner-steam').textContent=me.steam_id;
      document.getElementById('user-form').addEventListener('submit',save);
      configurePrivilegeOptions();
      renderHierarchy();
      await loadUsers();
      await loadLogs();
    }catch(e){window.location.href=window.STEAM_SITE_URL;}
  });
})();
