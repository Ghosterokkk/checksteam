(function(){
  const API = window.STEAM_API_BASE.replace(/\/$/, '');
  const state = {users:[]};
  const privilegeColors = {
    'Administrator':'#ff1836',
    'Senior Administrator':'#3d7cff',
    'Assistant Sudo Curator':'#a855f7',
    'Sudo Curator':'#22d3ee',
    'Special Admin':'#9ca3af'
  };

  function token(){return sessionStorage.getItem('checksteam_session_v1')||'';}
  async function api(path, options){
    const opts=Object.assign({headers:{}},options||{});
    opts.headers=Object.assign({'Content-Type':'application/json','Authorization':'Bearer '+token()},opts.headers);
    const r=await fetch(API+path,opts);
    const data=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(data.error||('HTTP_'+r.status));
    return data;
  }
  function esc(s){return String(s||'').replace(/[&<>"]/g,function(c){return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c];});}
  function render(){
    const tbody=document.getElementById('users-body');
    tbody.innerHTML='';
    state.users.forEach(function(u){
      const tr=document.createElement('tr');
      const color=privilegeColors[u.privilege]||'#666';
      tr.innerHTML='<td><b>'+esc(u.display_name)+'</b><small>'+esc(u.steam_id)+'</small></td>'+
        '<td>'+esc(u.department)+'</td>'+
        '<td><span class="role-color" style="color:'+color+'">'+esc(u.privilege||'Привилегия не назначена')+'</span></td>'+
        '<td><button class="edit-user" data-id="'+esc(u.steam_id)+'">Изменить</button> <button class="reset-user" data-id="'+esc(u.steam_id)+'">Сбросить</button></td>';
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll('.edit-user').forEach(b=>b.onclick=()=>editUser(b.dataset.id));
    tbody.querySelectorAll('.reset-user').forEach(b=>b.onclick=()=>resetUser(b.dataset.id));
  }
  function fill(u){
    document.getElementById('steam_id').value=u.steam_id;
    document.getElementById('department').value=u.department||'Без отдела';
    document.getElementById('privilege').value=u.privilege||'';
  }
  function editUser(id){
    const u=state.users.find(x=>x.steam_id===id); if(u) fill(u);
    window.scrollTo({top:0,behavior:'smooth'});
  }
  async function resetUser(id){
    if(!confirm('Сбросить отдел и привилегию для SteamID '+id+'?')) return;
    await api('/api/users/'+encodeURIComponent(id),{method:'DELETE'});
    await loadUsers();
  }
  async function loadUsers(){
    const data=await api('/api/users',{method:'GET'});
    state.users=data.users||[];
    render();
  }
  async function save(e){
    e.preventDefault();
    const steamId=document.getElementById('steam_id').value.trim();
    const department=document.getElementById('department').value;
    const privilege=document.getElementById('privilege').value||null;
    const result=await api('/api/users',{method:'POST',body:JSON.stringify({steam_id:steamId,department,privilege})});
    fill(result.user);
    await loadUsers();
    document.getElementById('status').textContent='Сохранено';
  }
  document.addEventListener('DOMContentLoaded',async function(){
    if(!token()){ window.location.href=window.STEAM_SITE_URL; return; }
    try{
      const me=await window.CheckSteamAuth.api('/api/me',{method:'GET'});
      if(!me.is_owner){ document.getElementById('owner-denied').style.display='block'; document.getElementById('owner-app').style.display='none'; return; }
      document.getElementById('owner-app').style.display='block';
      document.getElementById('owner-name').textContent=me.display_name;
      document.getElementById('user-form').addEventListener('submit',save);
      await loadUsers();
    }catch(e){window.location.href=window.STEAM_SITE_URL;}
  });
})();
