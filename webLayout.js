export function initializeWebLayout(){
 if(typeof document==='undefined')return;
 document.querySelector('meta[name="viewport"]')?.setAttribute('content','width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content');
 const style=document.createElement('style');style.id='questbound-mobile-layout';
 style.textContent='html,body{margin:0;width:100%;height:100%;}#root{height:var(--questbound-height,100dvh);min-height:0;box-sizing:border-box;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right);}input,textarea{font-size:16px;}';
 document.head.appendChild(style);
 const resize=()=>{if(window.visualViewport&&window.visualViewport.scale!==1)return;document.documentElement.style.setProperty('--questbound-height',(window.visualViewport?.height??window.innerHeight)+'px');};
 window.visualViewport?.addEventListener('resize',resize);window.addEventListener('resize',resize);resize();
}
