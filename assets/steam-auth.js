/* Steam OpenID launcher. */
(function(){
function getBackend(){return(window.STEAM_AUTH_URL||"").trim()}
function login(event){if(event)event.preventDefault();const backend=getBackend();if(!backend){alert("Авторизация через Steam ещё не подключена: укажите URL Steam OpenID backend в assets/config.js.");if(event&&event.currentTarget)event.currentTarget.blur();return}window.location.assign(backend)}
document.querySelectorAll("[data-steam]").forEach(function(el){el.addEventListener("click",login);el.addEventListener("pointerleave",function(){this.blur()});el.addEventListener("mouseup",function(){this.blur()})})
})();
