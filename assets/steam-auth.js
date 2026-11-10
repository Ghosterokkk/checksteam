(function(){
  if(!document.getElementById('checksteam-role-gradient-style')){const st=document.createElement('style');st.id='checksteam-role-gradient-style';st.textContent='@keyframes checkSteamRoleGradient{to{background-position:220% center}}';document.head.appendChild(st);}
  const API = (window.STEAM_API_BASE || '').replace(/\/$/, '');
  const SITE = window.STEAM_SITE_URL || '/checksteam/';
  const SESSION_KEY = 'checksteam_session_v1';
  const PROFILE_KEY = 'checksteam_profile_v1';
  const AUTH_CLASS = 'auth-logged-in';
  let profileRequest = null;
  let lastProfileValidation = 0;
  const PROFILE_REVALIDATE_COOLDOWN_MS = 15000;

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
    'Special Admin': '#9ca3af',
    'Intern': '#22c55e'
  };

  function getToken(){ return localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY) || ''; }
  function setAuth(token, profile){
    localStorage.setItem(SESSION_KEY, token);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    sessionStorage.setItem(SESSION_KEY, token);
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
    const opts = Object.assign({}, options || {});
    const method = String(opts.method || 'GET').toUpperCase();
    const headers = Object.assign({}, opts.headers || {});
    // GET requests do not need Content-Type. Avoid an unnecessary CORS preflight.
    if (method !== 'GET' && !Object.keys(headers).some(k => k.toLowerCase() === 'content-type')) headers['Content-Type'] = 'application/json';
    const token = getToken();
    if(token) headers.Authorization = 'Bearer ' + token;
    opts.headers = headers;
    opts.method = method;
    opts.cache = opts.cache || 'no-store';
    if (method === 'GET') { const sep = path.includes('?') ? '&' : '?'; path += sep + '_ts=' + Date.now(); }

    // Never leave the Intern pages in an endless loading state if the Worker stops responding.
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeout = controller ? setTimeout(() => controller.abort(), 15000) : null;
    if (controller && !opts.signal) opts.signal = controller.signal;
    try {
      const response = await fetch(API + path, opts);
      const data = await response.json().catch(function(){ return {}; });
      if(!response.ok) throw new Error(data.detail ? (String(data.error || 'API_ERROR') + ': ' + String(data.detail)) : (data.error || ('HTTP_' + response.status)));
      return data;
    } catch (error) {
      if (error && error.name === 'AbortError') throw new Error('Сервер не ответил за 15 секунд. Проверьте Cloudflare Worker и его подключение к базе D1, затем обновите страницу.');
      throw error instanceof Error ? error : new Error('Не удалось связаться с сервером: ' + String(error));
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  // Only definitive authentication failures should clear a saved login. Temporary network,
  // API, or server errors must not sign the user out when navigating back to the main page.
  function isInvalidSessionError(error){
    const message = String(error && error.message || '');
    return message === 'UNAUTHORIZED' || message === 'NO_ACCOUNT' || message === 'HTTP_401';
  }


  function roleClass(name){
    return ({'Administrator':'role-admin','Senior Administrator':'role-senior','Assistant Sudo Curator':'role-assistant','Sudo Curator':'role-sudo','Special Admin':'role-special','Intern':'role-intern','Владелец':'role-owner'})[name] || '';
  }
  function roleLabel(profile, key){
    if(key === 'Владелец') return 'Владелец';
    return profile?.role_settings?.[key]?.name || key || 'Привилегия не назначена';
  }
  function privilegeStyle(profile){
    const key=profile?.effective_privilege || profile?.privilege || '';
    if(profile && (profile.is_owner || key==='Владелец')) return {color:'#ff1836',gradient:false};
    const role=profile?.role_settings?.[key];
    return {color:role?.color || COLORS[profile && profile.privilege] || '#666',gradient:!!role?.gradient_enabled,gradientColor:role?.gradient_color || role?.color || '#666'};
  }
  function applyPrivilegeStyle(el, visual){
    const c=visual?.color || '#666';
    el.style.animation='';
    el.style.background='';
    el.style.backgroundSize='';
    el.style.webkitBackgroundClip='';
    el.style.backgroundClip='';
    el.style.color=c;
    el.style.textShadow='0 0 7px '+c+',0 0 18px '+c;
    if(visual?.gradient){
      const c2=visual.gradientColor || c;
      el.style.background='linear-gradient(90deg,'+c+','+c2+','+c+')';
      el.style.backgroundSize='220% auto';
      el.style.webkitBackgroundClip='text';
      el.style.backgroundClip='text';
      el.style.color='transparent';
      el.style.animation='checkSteamRoleGradient 2.8s linear infinite';
    }
  }

  function renderUser(profile){
    markLoggedIn();
    document.querySelectorAll('[data-auth-login]').forEach(function(el){ el.style.display='none'; el.hidden=true; el.setAttribute('aria-hidden','true'); });
    document.querySelectorAll('[data-auth-user]').forEach(function(el){ el.style.display='flex'; });

    const name = profile.display_name || ('SteamID ' + profile.steam_id);
    document.querySelectorAll('[data-user-name]').forEach(function(el){ el.textContent=name; });
    // Update the visible name from SCP RP after the cached profile has rendered; never block initial page load.
    if(profile && profile.steam_id && getToken()){
      api('/api/scp-nickname/' + encodeURIComponent(profile.steam_id), {method:'GET'}).then(function(result){
        if(result && result.nickname){
          document.querySelectorAll('[data-user-name]').forEach(function(el){ el.textContent=result.nickname; });
          const cached=getCached(); if(cached && cached.steam_id===profile.steam_id){cached.display_name=result.nickname; localStorage.setItem(PROFILE_KEY,JSON.stringify(cached));sessionStorage.setItem(PROFILE_KEY,JSON.stringify(cached));}
        }
      }).catch(function(){});
    }
    document.querySelectorAll('[data-user-steamid]').forEach(function(el){ el.textContent=profile.steam_id; });
    document.querySelectorAll('[data-user-department]').forEach(function(el){
      const depKey=profile.department || 'Без отдела';
      const dep=profile.department_settings?.[depKey];
      el.textContent=dep?.name || depKey;
      el.style.color=dep?.color || '#777';
      el.style.fontWeight='800';
      el.style.textShadow='0 0 7px '+(dep?.color || '#777')+',0 0 18px '+(dep?.color || '#777');
    });
    document.querySelectorAll('[data-user-privilege]').forEach(function(el){
      const roleKey=profile.effective_privilege || profile.privilege || ''; const role=roleLabel(profile,roleKey); el.textContent=role; el.classList.remove('role-admin','role-senior','role-assistant','role-sudo','role-special','role-owner'); const rc=roleClass(roleKey); const hasCustom=!!profile.role_settings?.[roleKey]; if(rc && (!hasCustom || roleKey==='Владелец')) el.classList.add(rc); applyPrivilegeStyle(el,privilegeStyle(profile)); if(roleKey==='Владелец'){ el.style.color='#ff1836'; el.style.background=''; el.style.backgroundClip=''; el.style.webkitBackgroundClip=''; el.style.animation=''; el.style.textShadow='0 0 7px #ff1836,0 0 18px rgba(255,24,54,.5)'; }
    });
    document.querySelectorAll('[data-owner-link]').forEach(function(el){ el.style.display=profile.can_manage?'inline-flex':'none'; });
    const isOwner=!!profile.is_owner || profile.privilege==='Владелец';
    const canManageInterns=isOwner || (profile.department==='Recruit' && profile.privilege!=='Intern');
    const canManageCourse=isOwner || profile.privilege==='Special Admin' || (profile.department==='Recruit' && profile.privilege==='Assistant Sudo Curator');
    document.querySelectorAll('[data-intern-management-link]').forEach(function(el){el.style.display=canManageInterns?'inline-flex':'none';});
    document.querySelectorAll('[data-course-management-link]').forEach(function(el){el.style.display=canManageCourse?'inline-flex':'none';});
    document.querySelectorAll('[data-role-settings-link]').forEach(function(el){ el.style.display=profile.is_owner?'inline-flex':'none'; });
    document.querySelectorAll('[data-user-avatar]').forEach(function(el){
      el.alt='';
      el.onerror=function(){ this.onerror=null; this.removeAttribute('src'); this.style.visibility='hidden'; this.setAttribute('aria-hidden','true'); };
      if(profile.avatar_url){ el.style.display='block'; el.style.visibility='visible'; if(el.src!==profile.avatar_url) el.src=profile.avatar_url; }
      else { el.removeAttribute('src'); el.style.visibility='hidden'; el.setAttribute('aria-hidden','true'); }
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
    const params = new URLSearchParams(window.location.search);
    if(params.get('auth_error') === 'no_account'){
      const hero = document.getElementById('guest-hero');
      const message = hero && hero.querySelector('p');
      if(message) message.textContent = 'У вас нет аккаунта на сайте.';
      document.querySelectorAll('[data-auth-login]').forEach(function(el){ el.style.display='none'; el.hidden=true; el.setAttribute('aria-hidden','true'); });
    }
  }

  async function loadMe(options){
    if(!getToken()) return null;
    options = options || {};
    if(profileRequest) return profileRequest;
    const now = Date.now();
    // Focus/visibility events can fire together. Reuse the cached profile briefly instead of
    // hammering /api/me and making every navigation feel like a fresh login.
    if(!options.force && lastProfileValidation && now - lastProfileValidation < PROFILE_REVALIDATE_COOLDOWN_MS){
      const cached = getCached();
      if(cached && cached.steam_id) return cached;
    }
    lastProfileValidation = now;
    profileRequest = (async function(){
      try {
        const profile = await api('/api/me', {method:'GET'});
        localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
        sessionStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
        renderUser(profile);
        window.dispatchEvent(new CustomEvent('checksteam-auth-ready', {detail: profile}));
        return profile;
      } catch(e){
        if(isInvalidSessionError(e)){
          clearAuth();
          renderGuest();
          window.dispatchEvent(new CustomEvent('checksteam-auth-ready', {detail: null}));
          if(e && e.message === 'NO_ACCOUNT') window.location.replace(SITE + '?auth_error=no_account');
        } else {
          // Temporary network/API failures must not sign the user out.
          const cached = getCached();
          if(cached && cached.steam_id) renderUser(cached);
          window.dispatchEvent(new CustomEvent('checksteam-auth-ready', {detail: cached || null}));
        }
        return null;
      } finally {
        profileRequest = null;
      }
    })();
    return profileRequest;
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
      clearAuth();
      renderGuest();
      if(e && e.message === 'NO_ACCOUNT'){
        window.location.replace(SITE + '?auth_error=no_account');
        return;
      }
      alert('Не удалось завершить вход через Steam. Авторизуйся ещё раз.');
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

  window.CheckSteamAuth = {api, getToken, getCachedProfile:getCached, loadMe, renderUser, renderGuest, logout, COLORS};

  (function(){
    // Render cached profile immediately to avoid blank avatar/name/SteamID when navigating
    // between pages. This is display-only; server authorization is still decided by /api/me.
    const cached = getCached();
    if (getToken() && cached && cached.steam_id) {
      renderUser(cached);
    } else {
      markLoggedOut();
    }
  })();

  function revalidateExistingSession(){
    if(!getToken()) return;
    loadMe();
  }

  document.addEventListener('visibilitychange', function(){ if(document.visibilityState === 'visible') revalidateExistingSession(); });
  window.addEventListener('focus', revalidateExistingSession);
  // Background session refresh is deliberately less frequent; focus/visibility refreshes are throttled.
  window.setInterval(function(){ if(document.visibilityState === 'visible') revalidateExistingSession(); }, 60000);

  document.addEventListener('DOMContentLoaded', async function(){
    syncAuthVisibility();
    bind();
    await exchangeTicket();
    const profile = await loadMe();
    if(!profile && !getToken()) renderGuest();
  });
})();
