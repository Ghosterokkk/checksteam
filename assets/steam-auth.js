/* Steam OpenID frontend: receives a signed session token from the backend. */
(function(){
  "use strict";

  var LOGIN_URL = (window.STEAM_AUTH_URL || "").trim().replace(/\/$/, "");
  var API_URL = (window.STEAM_AUTH_API || LOGIN_URL).trim().replace(/\/$/, "");
  var TOKEN_KEY = "steam_checker_auth";

  function buttons(){ return document.querySelectorAll("[data-steam]"); }
  function getToken(){ try{return localStorage.getItem(TOKEN_KEY)||"";}catch(e){return "";} }
  function setToken(v){ try{ if(v)localStorage.setItem(TOKEN_KEY,v); else localStorage.removeItem(TOKEN_KEY); }catch(e){} }

  function setButtonState(loggedIn, profile){
    buttons().forEach(function(el){
      if(loggedIn){
        el.setAttribute("data-steam-logged","1");
        var text = el.querySelector(".steam-label");
        if(text) text.textContent = profile && profile.personaname ? profile.personaname : "Вы вошли через Steam";
        else el.setAttribute("aria-label","Вы вошли через Steam");
      }else{
        el.removeAttribute("data-steam-logged");
        var text2 = el.querySelector(".steam-label");
        if(text2) text2.textContent = "Войти через Steam";
        el.setAttribute("aria-label","Войти через Steam");
      }
    });
  }

  function cleanAuthFragment(){
    if(!location.hash) return;
    var params = new URLSearchParams(location.hash.slice(1));
    var token = params.get("steam_token");
    if(!token) return;
    setToken(token);
    history.replaceState(null, document.title, location.pathname + location.search);
  }

  async function loadMe(){
    var token=getToken();
    if(!token || !API_URL){setButtonState(false);return;}
    try{
      var r=await fetch(API_URL+"/api/me",{headers:{Authorization:"Bearer "+token},cache:"no-store"});
      if(!r.ok) throw new Error("unauthorized");
      var data=await r.json();
      setButtonState(true,data.profile||data);
    }catch(e){
      setToken("");
      setButtonState(false);
    }
  }

  function login(event){
    if(event) event.preventDefault();
    if(!LOGIN_URL){
      alert("Steam OpenID backend ещё не подключён. Укажите URL backend в assets/config.js.");
      if(event&&event.currentTarget) event.currentTarget.blur();
      return;
    }
    window.location.assign(LOGIN_URL+"/auth/steam");
  }

  document.addEventListener("click",function(event){
    var el=event.target.closest("[data-steam]");
    if(!el) return;
    if(el.getAttribute("data-steam-logged")==="1") return;
    login(event);
  });

  cleanAuthFragment();
  loadMe();
})();
