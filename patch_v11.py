from pathlib import Path
root=Path('/mnt/data/workv10')

# Main page: use the same proven animated remote background as terms/download,
# with the local animated GIF as a fallback.
p=root/'index.html'
s=p.read_text()
s=s.replace("<img alt=\"\" aria-hidden=\"true\" id=\"bg\" onerror='this.onerror=null;this.src=(location.hostname.endsWith(\"github.io\")?\"/checksteam/\":\"/\")+\"assets/GHfire1_animated.gif\";' src=\"assets/GHfire1.gif\"/>",
            "<img alt=\"\" aria-hidden=\"true\" id=\"bg\" onerror='this.onerror=null;this.src=(location.hostname.endsWith(\"github.io\")?\"/checksteam/\":\"/\")+\"assets/GHfire1_animated.gif\";' src=\"https://i.imgur.com/Y334pmB.gif\"/>")
p.write_text(s)

# Settings-users: make the background animated exactly like the working terms/download pages,
# tighten the STEAM/CHECKER logo spacing, and keep a loading state while auth/data is resolving.
p=root/'setting-users/index.html'
s=p.read_text()
s=s.replace('.cs-logo{display:flex;align-items:center;gap:6px;', '.cs-logo{display:flex;align-items:center;gap:3px;')
s=s.replace('font-size:20px;font-weight:800;letter-spacing:2px', 'font-size:20px;font-weight:800;letter-spacing:1.7px', 1)
s=s.replace('<img class="site-bg" src="../assets/GHfire1.gif" alt="" aria-hidden="true">',
            '<img class="site-bg" src="https://i.imgur.com/Y334pmB.gif" onerror="this.onerror=null;this.src=\'../assets/GHfire1_animated.gif\';" alt="" aria-hidden="true">')
# Make SteamID64 field intentionally compact.
s=s.replace('.form-grid{grid-template-columns:250px minmax(150px,180px) minmax(180px,210px) minmax(170px,1fr);gap:10px}',
            '.form-grid{grid-template-columns:210px minmax(150px,180px) minmax(180px,210px) minmax(170px,1fr);gap:10px}')
# Avoid an endlessly stuck loader if a network request never returns.
needle="document.addEventListener('DOMContentLoaded',async()=>{"
insert="""let loadingFallback=setTimeout(()=>{const el=document.getElementById('loading-screen');if(el&&!el.classList.contains('hidden')){const box=el.querySelector('.loading-box');if(box)box.innerHTML='<div class=\"loading-spinner\"></div><b>Загрузка страницы</b><span>Подождите пожалуйста!</span>'; }},12000);\n"""
s=s.replace(needle, insert+needle)
s=s.replace("function hideLoading(){document.getElementById('loading-screen')?.classList.add('hidden')}", "function hideLoading(){clearTimeout(loadingFallback);document.getElementById('loading-screen')?.classList.add('hidden')}")
p.write_text(s)

# Role settings: same animated background and same tight logo spacing; remove nbsp gap.
p=root/'checker/role-settings/index.html'
s=p.read_text()
s=s.replace('.cs-logo{display:flex;align-items:center;gap:10px;', '.cs-logo{display:flex;align-items:center;gap:3px;')
s=s.replace('font-size:20px;font-weight:800;letter-spacing:2px', 'font-size:20px;font-weight:800;letter-spacing:1.7px', 1)
s=s.replace('<img class="site-bg" src="../../assets/GHfire1.gif" alt="" aria-hidden="true">',
            '<img class="site-bg" src="https://i.imgur.com/Y334pmB.gif" onerror="this.onerror=null;this.src=\'../../assets/GHfire1_animated.gif\';" alt="" aria-hidden="true">')
s=s.replace('<span style="color:#eee">STEAM</span>&nbsp;<span>CHECKER</span>', '<span style="color:#eee">STEAM</span><span>CHECKER</span>')
# Add same loader to role settings so it never looks like a blank page while auth/API is loading.
loader_css='''.loading-screen{position:fixed;inset:0;z-index:9999;background:#000;display:flex;align-items:center;justify-content:center;opacity:1;visibility:visible;transition:opacity .22s ease,visibility .22s ease}.loading-screen.hidden{opacity:0;visibility:hidden;pointer-events:none}.loading-box{text-align:center;color:#777;font-size:12px;letter-spacing:.4px}.loading-spinner{width:28px;height:28px;margin:0 auto 14px;border:2px solid #252525;border-top-color:#ed102d;border-radius:50%;animation:loadingSpin .8s linear infinite}.loading-box b{display:block;color:#aaa;font-size:13px;margin-bottom:5px}.loading-box span{color:#555;font-size:10px}@keyframes loadingSpin{to{transform:rotate(360deg)}}\n'''
s=s.replace('</style>\n</head>', loader_css+'</style>\n</head>', 1)
s=s.replace('<body><img class="site-bg"', '<body><div class="loading-screen" id="loading-screen"><div class="loading-box"><div class="loading-spinner"></div><b>Загрузка страницы</b><span>Подождите пожалуйста!</span></div></div><img class="site-bg"')
s=s.replace("document.addEventListener('DOMContentLoaded',async()=>{", "function hideLoading(){document.getElementById('loading-screen')?.classList.add('hidden')}\nlet loadingFallback=setTimeout(()=>{},12000);\ndocument.addEventListener('DOMContentLoaded',async()=>{")
s=s.replace("document.getElementById('save').onclick=save}catch(e){", "document.getElementById('save').onclick=save}catch(e){")
# Hide loader on both successful and denied/error paths.
s=s.replace("document.getElementById('denied').style.display='block';return}", "document.getElementById('denied').style.display='block';hideLoading();return}")
s=s.replace("document.getElementById('denied').style.display='block'} });", "document.getElementById('denied').style.display='block'} finally { hideLoading(); }});")
# The previous exact tail is slightly different; ensure a robust hide call before closure.
s=s.replace("document.getElementById('save').onclick=save}catch(e){document.getElementById('denied').textContent='Не удалось загрузить настройки: '+e.message;document.getElementById('denied').style.display='block'}});",
            "document.getElementById('save').onclick=save}catch(e){document.getElementById('denied').textContent='Не удалось загрузить настройки: '+e.message;document.getElementById('denied').style.display='block'}finally{clearTimeout(loadingFallback);hideLoading()}});")
p.write_text(s)

# Old /checker/ URL remains a clean compatibility redirect to the renamed page.
p=root/'checker/index.html'
p.write_text('''<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=../setting-users/"><script>location.replace('../setting-users/')</script><title>Переход…</title></head><body></body></html>''')

# Any remaining app pages that used the static local GIF get the working remote animation
# with local animated fallback. Do not touch terms/download because they already work this way.
for rel in ['agreement.html','terms.html','terms/index.html','index/index.html','gmod-scan.html','owner.html']:
    p=root/rel
    if not p.exists(): continue
    s=p.read_text()
    # Inline img background sources
    s=s.replace('src="https://i.imgur.com/Y334pmB.gif" onerror=', 'src="https://i.imgur.com/Y334pmB.gif" onerror=')
    s=s.replace("src=\"assets/GHfire1.gif\"", "src=\"https://i.imgur.com/Y334pmB.gif\"")
    # For static background CSS on gmod/agreement/terms, prefer the remote GIF only where an actual CSS URL exists.
    s=s.replace('url("assets/GHfire1.gif")', 'url("https://i.imgur.com/Y334pmB.gif")')
    s=s.replace('url("../assets/GHfire1.gif")', 'url("https://i.imgur.com/Y334pmB.gif")')
    p.write_text(s)
