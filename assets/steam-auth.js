(function(){
  const API = (window.STEAM_API_BASE || '').replace(/\/$/, '');
  const SITE = window.STEAM_SITE_URL || '/checksteam/';
  const SESSION_KEY = 'checksteam_session_v1';
  const PROFILE_KEY = 'checksteam_profile_v1';

  const COLORS = {
    'Administrator': '#ff1836',
    'Senior Administrator': '#3d7cff',
    'Assistant Sudo Curator': '#a855f7',
    'Sudo Curator': '#22d3ee',
    'Special Admin': '#9ca3af'
  };

  function getToken(){ return sessionStorage.getItem(SESSION_KEY) || ''; }
  function setAuth(token, profile){
    sessionStorage.setItem(SESSION_KEY, token);
    sessionStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  }
  function clearAuth(){
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(PROFILE_KEY);
  }
  function getCached(){
    try { return JSON.parse(sessionStorage.getItem(PROFILE_KEY) || 'null'); } catch(e){ return null; }
  }

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

  function privilegeStyle(profile){
    return COLORS[profile && profile.privilege] || '#666';
  }

  function renderUser(profile){
    document.querySelectorAll('[data-auth-login]').forEach(function(el){ el.style.display='none'; });
    document.querySelectorAll('[data-auth-user]').forEach(function(el){ el.style.display='flex'; });

    const name = profile.display_name || ('SteamID ' + profile.steam_id);
    document.querySelectorAll('[data-user-name]').forEach(function(el){ el.textContent=name; });
    document.querySelectorAll('[data-user-steamid]').forEach(function(el){ el.textContent=profile.steam_id; });
    document.querySelectorAll('[data-user-department]').forEach(function(el){ el.textContent=profile.department || 'Без отдела'; });
    document.querySelectorAll('[data-user-privilege]').forEach(function(el){
      el.textContent=profile.privilege || 'Привилегия не назначена';
      el.style.color=privilegeStyle(profile);
    });
    document.querySelectorAll('[data-owner-link]').forEach(function(el){ el.style.display=profile.is_owner?'inline-flex':'none'; });
    document.querySelectorAll('[data-user-avatar]').forEach(function(el){
      if(profile.avatar_url){ el.src=profile.avatar_url; el.style.display='block'; }
      else el.style.display='none';
    });
  }

  function renderGuest(){
    document.querySelectorAll('[data-auth-login]').forEach(function(el){ el.style.display='inline-flex'; });
    document.querySelectorAll('[data-auth-user]').forEach(function(el){ el.style.display='none'; });
  }

  async function loadMe(){
    if(!getToken()) return null;
    try {
      const profile = await api('/api/me', {method:'GET'});
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

  document.addEventListener('DOMContentLoaded', async function(){
    bind();
    await exchangeTicket();
    const profile = await loadMe();
    if(!profile && !getToken()) renderGuest();
  });
})();
