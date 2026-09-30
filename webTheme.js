// Web-only finish: typefaces, metallic buttons, gilded frames, atmosphere and motion, attached through dataSet hooks (data-qb).
const corner='linear-gradient(var(--qb-gold),var(--qb-gold))';
const css=`
:root{--qb-gold:#e8c77b;--qb-gold-mid:#c9a45c;--qb-ink:#06080c;}
html,body{background:#06080c;color-scheme:dark;}
body{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:optimizeLegibility;}
::selection{background:rgba(232,199,123,.32);color:#fff;}
*{scrollbar-width:thin;scrollbar-color:#5c4826 #0a0d14;}
*::-webkit-scrollbar{width:10px;height:10px;}
*::-webkit-scrollbar-track{background:#0a0d14;}
*::-webkit-scrollbar-thumb{background:linear-gradient(#77602f,#3b2f1d);border-radius:10px;border:2px solid #0a0d14;}
:focus-visible{outline:2px solid #e8c77b !important;outline-offset:3px;}
[role=button]:not([data-qb]):not([aria-disabled=true]):hover,[role=tab]:not([data-qb]):hover{filter:brightness(1.18);}
textarea:focus,input:focus{outline:none !important;box-shadow:0 0 0 3px rgba(232,199,123,.16),0 0 20px rgba(232,199,123,.1);}
input::placeholder,textarea::placeholder{font-style:italic;}
[role=button],[role=radio],[role=link],[role=tab]{transition:transform .18s ease,box-shadow .25s ease,filter .2s ease,border-color .2s ease,background-color .2s ease,opacity .2s ease;}

/* The drifting backdrop is larger than the screen; clip (unlike hidden) can never be scrolled sideways by focus or full-screen changes. */
[data-qb=root],[data-qb=stage]{overflow:clip !important;}
/* Atmosphere: painted backdrop drifting slowly, candle glow, vignette and rising embers. */
[data-qb=backdrop]{animation:qb-drift 70s ease-in-out infinite alternate;transform-origin:50% 40%;}
@keyframes qb-drift{from{transform:scale(1.06) translate3d(0,0,0);}to{transform:scale(1.16) translate3d(-2%,-3%,0);}}
[data-qb=atmosphere]{background:
 radial-gradient(ellipse 80% 55% at 50% -8%,rgba(236,164,84,.20),transparent 60%),
 radial-gradient(ellipse 70% 50% at 50% 115%,rgba(35,85,115,.22),transparent 65%),
 linear-gradient(180deg,rgba(6,8,12,.45) 0%,rgba(6,8,12,.72) 45%,rgba(6,8,12,.94) 100%) !important;}
[data-qb=atmosphere-game]{background:
 radial-gradient(ellipse 90% 60% at 50% -10%,rgba(236,164,84,.12),transparent 60%),
 linear-gradient(180deg,rgba(6,8,12,.25) 0%,rgba(6,8,12,.55) 60%,rgba(6,8,12,.82) 100%) !important;}
[data-qb=vignette]{box-shadow:inset 0 0 220px 70px rgba(0,0,0,.88);}
[data-qb=embers]{overflow:hidden;}
[data-qb=embers]::before,[data-qb=embers]::after{content:"";position:absolute;left:0;right:0;top:0;height:200%;background-repeat:repeat;pointer-events:none;
 background-image:radial-gradient(2px 2px at 12% 18%,rgba(255,196,120,.95),transparent 60%),radial-gradient(1.6px 1.6px at 34% 72%,rgba(255,170,90,.85),transparent 60%),radial-gradient(2.4px 2.4px at 58% 40%,rgba(255,210,150,.9),transparent 60%),radial-gradient(1.4px 1.4px at 81% 83%,rgba(255,160,80,.8),transparent 60%),radial-gradient(1.8px 1.8px at 92% 12%,rgba(255,200,130,.85),transparent 60%),radial-gradient(1.2px 1.2px at 46% 94%,rgba(255,180,100,.75),transparent 60%);
 background-size:100% 50%;animation:qb-rise 26s linear infinite;opacity:.55;filter:blur(.3px);}
[data-qb=embers]::after{background-size:70% 45%;animation-duration:38s;opacity:.35;transform:translateX(12%);}
@keyframes qb-rise{from{transform:translate3d(0,0,0);}to{transform:translate3d(-3%,-50%,0);}}

/* Title lettering: gilded, engraved, softly glowing. */
[data-qb=title]{background:linear-gradient(180deg,#fff8e2 0%,#f5dc9c 38%,#c89642 62%,#f3d68f 82%,#fff0c4 100%);-webkit-background-clip:text;background-clip:text;color:transparent !important;
 filter:drop-shadow(0 2px 0 rgba(20,12,4,.9)) drop-shadow(0 0 28px rgba(236,170,84,.35));}
[data-qb=title][data-glow=on]{animation:qb-breathe 6s ease-in-out infinite;}
@keyframes qb-breathe{0%,100%{filter:drop-shadow(0 2px 0 rgba(20,12,4,.9)) drop-shadow(0 0 22px rgba(236,170,84,.28));}50%{filter:drop-shadow(0 2px 0 rgba(20,12,4,.9)) drop-shadow(0 0 38px rgba(236,170,84,.5));}}

/* Framed panels with a double gold rule and corner filigree. */
[data-qb=panel],[data-qb=glass]{position:relative;
 background:linear-gradient(180deg,rgba(24,29,42,.94) 0%,rgba(13,16,25,.95) 60%,rgba(10,12,19,.96) 100%) !important;
 box-shadow:0 0 0 1px rgba(0,0,0,.7),inset 0 0 0 5px rgba(10,12,19,.85),inset 0 0 0 6px rgba(201,164,92,.16),inset 0 1px 0 7px rgba(255,236,190,.02),0 28px 70px rgba(0,0,0,.55),0 0 80px rgba(236,164,84,.05);}
[data-qb=glass]{background:linear-gradient(180deg,rgba(18,23,34,.82),rgba(9,12,19,.86)) !important;-webkit-backdrop-filter:blur(10px) saturate(1.1);backdrop-filter:blur(10px) saturate(1.1);}
[data-qb=panel]::before,[data-qb=glass]::before{content:"";position:absolute;inset:7px;pointer-events:none;opacity:.85;
 background:${corner} top left/22px 1px no-repeat,${corner} top left/1px 22px no-repeat,${corner} top right/22px 1px no-repeat,${corner} top right/1px 22px no-repeat,${corner} bottom left/22px 1px no-repeat,${corner} bottom left/1px 22px no-repeat,${corner} bottom right/22px 1px no-repeat,${corner} bottom right/1px 22px no-repeat;}
[data-qb=panel]::after,[data-qb=glass]::after{content:"";position:absolute;top:-5px;left:50%;width:9px;height:9px;margin-left:-5px;transform:rotate(45deg);background:linear-gradient(135deg,#fff1c7,#b98a3e);box-shadow:0 0 12px rgba(236,170,84,.6);pointer-events:none;}
[data-qb=plate]{background:linear-gradient(180deg,rgba(20,25,37,.9),rgba(10,13,20,.92)) !important;box-shadow:inset 0 1px 0 rgba(255,236,190,.06),0 10px 30px rgba(0,0,0,.45);}

/* Buttons: forged stone with a gold edge, and a gilded primary that catches the light. */
[data-qb=btn]{background:linear-gradient(180deg,#252c3d 0%,#171c29 55%,#11151f 100%) !important;box-shadow:inset 0 1px 0 rgba(255,255,255,.07),inset 0 -1px 0 rgba(0,0,0,.5),0 6px 18px rgba(0,0,0,.4);}
[data-qb=btn]:hover{border-color:rgba(236,204,132,.85) !important;box-shadow:inset 0 1px 0 rgba(255,255,255,.1),0 0 0 1px rgba(236,204,132,.15),0 0 26px rgba(232,199,123,.2),0 10px 24px rgba(0,0,0,.5);transform:translateY(-1px);}
[data-qb=btn-primary]{position:relative;overflow:hidden;background:linear-gradient(180deg,#fbe5ab 0%,#e7c070 38%,#c4903f 72%,#a87832 100%) !important;
 box-shadow:inset 0 1px 0 rgba(255,255,255,.75),inset 0 -2px 0 rgba(90,55,15,.5),0 0 0 1px rgba(50,32,8,.9),0 10px 30px rgba(236,164,84,.28),0 0 50px rgba(236,164,84,.12);}
[data-qb=btn-primary]::after{content:"";position:absolute;top:0;bottom:0;left:-60%;width:40%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.55),transparent);transform:skewX(-18deg);animation:qb-shine 5.5s ease-in-out infinite;pointer-events:none;}
@keyframes qb-shine{0%,70%{left:-60%;}100%{left:130%;}}
[data-qb=btn-primary]:hover{filter:brightness(1.08) saturate(1.05);transform:translateY(-1px);box-shadow:inset 0 1px 0 rgba(255,255,255,.8),inset 0 -2px 0 rgba(90,55,15,.5),0 0 0 1px rgba(50,32,8,.9),0 14px 38px rgba(236,164,84,.42),0 0 70px rgba(236,164,84,.22);}
[data-qb=btn-danger]{background:linear-gradient(180deg,#7a2a20,#4a1712) !important;box-shadow:inset 0 1px 0 rgba(255,200,180,.2),0 8px 22px rgba(120,20,10,.35);}
[data-qb=chip]{background:linear-gradient(180deg,rgba(35,42,58,.9),rgba(18,22,32,.92)) !important;box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 4px 12px rgba(0,0,0,.35);}
[data-qb=chip]:hover{border-color:rgba(236,204,132,.8) !important;box-shadow:0 0 18px rgba(232,199,123,.18),0 4px 12px rgba(0,0,0,.4);}

/* Choice cards (story openings). */
[data-qb=card]{background:linear-gradient(160deg,rgba(26,32,46,.9),rgba(12,15,23,.94)) !important;box-shadow:inset 0 1px 0 rgba(255,236,190,.05),0 10px 26px rgba(0,0,0,.4);}
[data-qb=card]:hover{transform:translateY(-2px);border-color:rgba(236,204,132,.7) !important;box-shadow:0 0 0 1px rgba(236,204,132,.12),0 16px 36px rgba(0,0,0,.5),0 0 34px rgba(232,199,123,.12);}
[data-qb=card][data-selected=true]{background:linear-gradient(160deg,rgba(58,46,26,.92),rgba(22,19,16,.95)) !important;box-shadow:0 0 0 1px rgba(255,226,160,.5),0 0 40px rgba(236,170,84,.28),inset 0 0 40px rgba(236,170,84,.08);}

/* Bars, rules, inputs and the story feed. */
[data-qb=bar]{box-shadow:inset 0 2px 4px rgba(0,0,0,.6);}
[data-qb=bar-hp]{background:linear-gradient(180deg,#9fe0b0,#4f9b6a 55%,#2f6b45) !important;box-shadow:0 0 12px rgba(111,191,142,.45);transition:width .6s cubic-bezier(.2,.8,.2,1);}
[data-qb=bar-enemy]{background:linear-gradient(180deg,#ff9a7c,#d2442e 55%,#7d1f14) !important;box-shadow:0 0 14px rgba(240,106,79,.5);transition:width .6s cubic-bezier(.2,.8,.2,1);}
[data-qb=bar-low]{background:linear-gradient(180deg,#ff8a70,#d2442e 55%,#7d1f14) !important;animation:qb-danger 1.1s ease-in-out infinite;transition:width .6s cubic-bezier(.2,.8,.2,1);}
@keyframes qb-danger{0%,100%{box-shadow:0 0 6px rgba(240,106,79,.4);}50%{box-shadow:0 0 18px rgba(240,106,79,.9);}}
[data-qb=bar-temp]{background:linear-gradient(180deg,#b6fff2,#48b4a6) !important;}
[data-qb=rule-left]{background:linear-gradient(90deg,transparent,rgba(232,199,123,.7)) !important;}
[data-qb=rule-right]{background:linear-gradient(90deg,rgba(232,199,123,.7),transparent) !important;}
[data-qb=input]{box-shadow:inset 0 2px 10px rgba(0,0,0,.55);}
[data-qb=input]:focus{border-color:rgba(236,204,132,.9) !important;box-shadow:inset 0 2px 10px rgba(0,0,0,.55),0 0 0 3px rgba(232,199,123,.14),0 0 24px rgba(232,199,123,.12);outline:none !important;}
[data-qb=feed-player]{background:linear-gradient(90deg,rgba(60,78,120,.28),rgba(20,28,44,.2)) !important;}
[data-qb=feed-roll]{background:linear-gradient(90deg,rgba(232,199,123,.13),rgba(20,24,34,.25)) !important;}
[data-qb=feed-effect]{background:linear-gradient(90deg,rgba(111,208,196,.12),rgba(20,24,34,.2)) !important;}
[data-qb=feed-dialogue]{background:linear-gradient(90deg,rgba(180,130,70,.14),rgba(20,24,34,.2)) !important;}
[data-qb=portrait]{box-shadow:0 0 0 1px rgba(0,0,0,.8),0 0 0 4px rgba(20,16,10,.9),0 0 0 5px rgba(201,164,92,.6),0 14px 40px rgba(0,0,0,.6),0 0 40px rgba(236,164,84,.15);}
[data-qb=avatar]{box-shadow:0 0 0 2px rgba(201,164,92,.7),0 4px 10px rgba(0,0,0,.5);}
[data-qb=banner]{background:linear-gradient(90deg,transparent,rgba(120,24,16,.55) 20%,rgba(120,24,16,.55) 80%,transparent) !important;}
[data-qb=die]{background:radial-gradient(circle at 35% 30%,#3d6f80,#1c3c48 55%,#0f222b) !important;box-shadow:inset 0 2px 0 rgba(255,255,255,.15),inset 0 -6px 14px rgba(0,0,0,.5),0 18px 40px rgba(0,0,0,.6),0 0 40px rgba(232,199,123,.25) !important;}
[data-qb=tray]{background:radial-gradient(ellipse at 50% 40%,rgba(40,70,60,.5),rgba(8,14,18,.85) 70%) !important;box-shadow:inset 0 0 60px rgba(0,0,0,.8),inset 0 0 0 1px rgba(201,164,92,.25);}

/* Launch sequence. */
[data-qb=launch-glow]{background:radial-gradient(ellipse 60% 45% at 50% 42%,rgba(236,164,84,.22),transparent 70%),radial-gradient(ellipse 120% 80% at 50% 110%,rgba(35,85,115,.18),transparent 70%),#06080c !important;animation:qb-candle 5s ease-in-out infinite;}
@keyframes qb-candle{0%,100%{opacity:.85;}45%{opacity:1;}70%{opacity:.9;}}
[data-qb=launch-ring]{box-shadow:0 0 0 1px rgba(0,0,0,.8),0 0 40px rgba(236,170,84,.35),inset 0 0 30px rgba(236,170,84,.18);background:radial-gradient(circle at 50% 40%,rgba(58,46,26,.55),rgba(8,10,16,.9) 70%) !important;}
[data-qb=launch-prompt]{animation:qb-pulse 2.2s ease-in-out infinite;}
@keyframes qb-pulse{0%,100%{opacity:.45;letter-spacing:4px;}50%{opacity:1;letter-spacing:5px;}}
/* Game HUD and phone tab bar: frosted, always on top of the scene. */
[data-qb=hud],[data-qb=tabbar]{-webkit-backdrop-filter:blur(12px) saturate(1.2);backdrop-filter:blur(12px) saturate(1.2);box-shadow:0 8px 30px rgba(0,0,0,.45);}
[data-qb=hud]{background:linear-gradient(180deg,rgba(14,17,26,.92),rgba(8,10,16,.86)) !important;}
[data-qb=emblem]{box-shadow:0 0 16px rgba(236,170,84,.35),inset 0 0 10px rgba(236,170,84,.2);}
/* A sideways-scrolling row fades at its right edge, so more actions read as "swipe for more". */
[data-qb=actions-scroll]{-webkit-mask-image:linear-gradient(90deg,#000 86%,transparent);mask-image:linear-gradient(90deg,#000 86%,transparent);}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none !important;transition:none !important;}}
`;
export function initializeWebTheme(){
 if(typeof document==='undefined'||document.getElementById('questbound-theme'))return;
 for(const href of ['https://fonts.googleapis.com','https://fonts.gstatic.com']){const l=document.createElement('link');l.rel='preconnect';l.href=href;if(href.includes('gstatic'))l.crossOrigin='anonymous';document.head.appendChild(l);}
 const fontsLink=document.createElement('link');fontsLink.rel='stylesheet';
 fontsLink.href='https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@700;900&family=Cinzel:wght@400;500;600;700;800&family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Inter:wght@400;500;600;700&display=swap';
 document.head.appendChild(fontsLink);
 const style=document.createElement('style');style.id='questbound-theme';style.textContent=css;document.head.appendChild(style);
 document.querySelector('meta[name="theme-color"]')?.setAttribute('content','#06080c');
 document.title='Questbound';
}
