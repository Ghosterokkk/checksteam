
const BACKEND = window.STEAM_AUTH_URL || "";
function login(e){
  e && e.preventDefault();
  if(BACKEND) location.href=BACKEND;
  else alert("Подключите Steam OpenID backend в assets/config.js");
}
document.querySelectorAll("[data-steam]").forEach(x=>x.addEventListener("click",login));
