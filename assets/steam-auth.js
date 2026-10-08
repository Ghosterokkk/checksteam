(function(){
  const API = (window.STEAM_API_BASE || '').replace(/\/$/, '');
  const SITE = window.STEAM_SITE_URL || '/checksteam/';
  const SESSION_KEY = 'checksteam_session_v1';
  const PROFILE_KEY = 'checksteam_profile_v1';
  const AUTH_CLASS = 'auth-logged-in';

  function syncAuthVisibility(){
    const loggedIn = !!getToken();
    document.documentElement.classList.toggle(AUTH_CLASS, loggedIn);
    document.querySelectorAll('[data-auth-login]').forEach(function(el){
      el.style.display = loggedIn ? 'none' : 'inline-flex';
      el.hidden = loggedIn;
      if(loggedIn) el.setAttribute('aria-hidden','true'); else el.removeAttribute('aria-hidden');
    });
    document.querySelectorAll('[data-auth-user]').forEach(function(el){ el.style.display = loggedIn ? (el.tagName==='BUTTON' ? 'inline-flex' : 'flex') : 'none'; });
  }

  const COLORS = {
    'Administrator': '#ff1836',
    'Senior Administrator': '#3d7cff',
    'Assistant Sudo Curator': '#a855f7',
    'Sudo Curator': '#22d3ee',
    'Special Admin': '#9ca3af'
  };

  function getToken(){ return localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY) || ''; }
  function setAuth(token, profile){
    localStorage.setItem(SESSION_KEY, token);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    sessionStorage.setItem(SESSION_KEY, token);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      sessionStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    document.documentElement.classList.add(AUTH_CLASS);
  }
  function clearAuth(){
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(PROFILE_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(PROFILE_KEY);
    document.documentElement.classList.remove(AUTH_CLASS);
  }
  function getCached(){
    try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || sessionStorage.getItem(PROFILE_KEY) || 'null'); } catch(e){ return null; }
  }
  function markLoggedIn(){ document.documentElement.classList.add(AUTH_CLASS); syncAuthVisibility(); }
  function markLoggedOut(){ document.documentElement.classList.remove(AUTH_CLASS); syncAuthVisibility(); }

  async function api(path, options){
    const opts = Object.assign({headers:{}}, options || {});
    opts.headers = Object.assign({'Content-Type':'application/json'}, opts.headers);
    const token = getToken();
    if(token) opts.headers.Authorization = 'Bearer ' + token;
    const response = await fetch(API + path, opts);
    const data = await response.json().catch(function(){ return {}; });
    if(!response.ok) throw new Error(data.error || ('HTTP_' + response.status));
    return data;
  }


  function roleClass(name){
    return ({'Administrator':'role-admin','Senior Administrator':'role-senior','Assistant Sudo Curator':'role-assistant','Sudo Curator':'role-sudo','Special Admin':'role-special','Владелец':'role-owner'})[name] || '';
  }

  function privilegeStyle(profile){
    return (profile && profile.is_owner) ? '#ffffff' : (COLORS[profile && profile.privilege] || '#666');
  }

  function renderUser(profile){
    markLoggedIn();
    document.querySelectorAll('[data-auth-login]').forEach(function(el){ el.style.display='none'; el.hidden=true; el.setAttribute('aria-hidden','true'); });
    document.querySelectorAll('[data-auth-user]').forEach(function(el){ el.style.display='flex'; });

    const name = profile.display_name || ('SteamID ' + profile.steam_id);
    document.querySelectorAll('[data-user-name]').forEach(function(el){ el.textContent=name; });
    document.querySelectorAll('[data-user-steamid]').forEach(function(el){ el.textContent=profile.steam_id; });
    document.querySelectorAll('[data-user-department]').forEach(function(el){ el.textContent=profile.department || 'Без отдела'; });
    document.querySelectorAll('[data-user-privilege]').forEach(function(el){
      const role=profile.effective_privilege || profile.privilege || 'Привилегия не назначена'; el.textContent=role; el.classList.remove('role-admin','role-senior','role-assistant','role-sudo','role-special','role-owner'); const rc=roleClass(role); if(rc) el.classList.add(rc); else el.style.color=privilegeStyle(profile);
    });
    document.querySelectorAll('[data-owner-link]').forEach(function(el){ el.style.display=profile.can_manage?'inline-flex':'none'; });
    document.querySelectorAll('[data-user-avatar]').forEach(function(el){
      if(profile.avatar_url){ el.src=profile.avatar_url; el.style.display='block'; }
      else el.style.display='none';
    });
    const union = profile.unionteams || {};
    document.querySelectorAll('[data-union-role]').forEach(function(el){ el.textContent = union.role || '—'; });
    document.querySelectorAll('[data-union-scp]').forEach(function(el){ el.textContent = union.scp || '—'; });
    document.querySelectorAll('[data-union-hours]').forEach(function(el){ el.textContent = union.hours ? (union.hours + ' ч.') : '—'; });
    document.querySelectorAll('[data-union-note]').forEach(function(el){ el.textContent = union.server === 'SCP' ? 'Данные получены из раздела SCP UnionTeams.' : ''; });
    document.querySelectorAll('[data-union-department]').forEach(function(el){ el.textContent = union.department || profile.department || 'Без отдела'; });
    document.querySelectorAll('[data-union-status]').forEach(function(el){ el.textContent = union.status || '—'; });
    document.querySelectorAll('[data-union-callsign]').forEach(function(el){ el.textContent = union.callsign || '—'; });
    document.querySelectorAll('[data-union-link]').forEach(function(el){ el.href = union.url || ('https://unionteams.ru/player/' + profile.steam_id); });
  }

  function renderGuest(){
    markLoggedOut();
    document.querySelectorAll('[data-auth-login]').forEach(function(el){ el.style.display='inline-flex'; el.hidden=false; el.removeAttribute('aria-hidden'); });
    document.querySelectorAll('[data-auth-user]').forEach(function(el){ el.style.display='none'; });
  }

  async function loadMe(){
    if(!getToken()) return null;
    try {
      const profile = await api('/api/me', {method:'GET'});
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      sessionStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      renderUser(profile);
      window.dispatchEvent(new CustomEvent('checksteam-auth-ready', {detail: profile}));
      return profile;
    } catch(e){
      clearAuth();
      renderGuest();
      window.dispatchEvent(new CustomEvent('checksteam-auth-ready', {detail: null}));
      return null;
    }
  }

  async function exchangeTicket(){
    const hash = window.location.hash || '';
    if(!hash.startsWith('#steam_ticket=')) return;
    const ticket = decodeURIComponent(hash.slice('#steam_ticket='.length));
    history.replaceState(null, '', window.location.pathname + window.location.search);
    try {
      const result = await api('/auth/exchange', {
        method:'POST',
        body: JSON.stringify({ticket:ticket})
      });
      setAuth(result.token, result.user);
      renderUser(result.user);
      window.dispatchEvent(new CustomEvent('checksteam-auth-ready', {detail: result.user}));
    } catch(e){
      alert('Не удалось завершить вход через Steam. Авторизуйся ещё раз.');
      clearAuth();
      renderGuest();
    }
  }

  async function login(event){
    if(event) event.preventDefault();
    const url = (window.STEAM_AUTH_URL || '').trim();
    if(!url){ alert('Steam OpenID не настроен.'); return; }
    window.location.assign(url);
  }

  async function logout(event){
    if(event) event.preventDefault();
    try { if(getToken()) await api('/api/logout', {method:'POST'}); } catch(e){}
    clearAuth();
    renderGuest();
    window.location.href = SITE;
  }

  function bind(){
    document.querySelectorAll('[data-steam]').forEach(function(el){
      el.addEventListener('click', login);
      el.addEventListener('mouseleave', function(){ this.blur(); });
      el.addEventListener('pointerup', function(){ const self=this; setTimeout(function(){self.blur();},0); });
    });
    document.querySelectorAll('[data-logout]').forEach(function(el){ el.addEventListener('click', logout); });
  }

  window.CheckSteamAuth = {api, getToken, loadMe, renderUser, renderGuest, logout, COLORS};

  (function(){
    const token = getToken();
    if(token) {
      markLoggedIn();
      const cached = getCached();
      if(cached) {
        document.addEventListener('DOMContentLoaded', function(){ renderUser(cached); });
      }
    } else {
      markLoggedOut();
    }
  })();

  document.addEventListener('DOMContentLoaded', async function(){
    syncAuthVisibility();
    bind();
    await exchangeTicket();
    const profile = await loadMe();
    if(!profile && !getToken()) renderGuest();
  });
})();
