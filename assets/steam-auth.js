/* Steam OpenID launcher. GitHub Pages itself cannot verify the OpenID response; use a serverless Worker URL in config.js. */
(function(){
  function getBackend(){ return (window.STEAM_AUTH_URL||'').trim(); }
  function login(event){
    if(event) event.preventDefault();
    const backend=getBackend();
    if(!backend){
      alert('Steam OpenID не настроен: укажи URL Cloudflare Worker в assets/config.js.');
      if(event&&event.currentTarget) event.currentTarget.blur();
      return;
    }
    window.location.assign(backend);
  }
  document.querySelectorAll('[data-steam]').forEach(function(el){
    el.addEventListener('click',login);
    el.addEventListener('mouseleave',function(){ this.blur(); });
    el.addEventListener('pointerup',function(){ const self=this; setTimeout(function(){ self.blur(); },0); });
  });
})();
