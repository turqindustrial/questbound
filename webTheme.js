// Web-only finish: typefaces, metallic buttons, gilded frames, atmosphere and motion, attached through dataSet hooks (data-qb).
const svg=markup=>'url("data:image/svg+xml,'+encodeURIComponent(markup)+'")';
// Corner filigree for framed panels: a rounded bracket, an inner echo, two curls and a gilded lozenge.
const flourish=transform=>svg(`<svg xmlns='http://www.w3.org/2000/svg' width='34' height='34' viewBox='0 0 34 34' fill='none' stroke='#d9b56e' stroke-width='1.1' stroke-linecap='round'><g transform='${transform}'><path d='M1.5 20V7A5.5 5.5 0 0 1 7 1.5h13'/><path d='M6 14V9.2A3.2 3.2 0 0 1 9.2 6H14' stroke-opacity='.55'/><path d='M20 1.5c3 0 4.5 1.6 4.5 3.6' stroke-opacity='.8'/><path d='M1.5 20c0 3 1.6 4.5 3.6 4.5' stroke-opacity='.8'/><path d='M10.5 8.8 12.2 10.5 10.5 12.2 8.8 10.5Z' fill='#f0d08a' stroke='none'/></g></svg>`);
const corners={tl:flourish(''),tr:flourish('translate(34 0) scale(-1 1)'),bl:flourish('translate(0 34) scale(1 -1)'),br:flourish('translate(34 34) scale(-1 -1)')};
// Film grain: fractal noise baked into a small tile once; it only moves on the compositor.
const grain=svg(`<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .6 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`);
// A bezel of ticks and lozenges that turns slowly around the launch emblem.
const bezel=svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200' fill='none' stroke='#d9b56e'><circle cx='100' cy='100' r='96' stroke-opacity='.35' stroke-width='.8'/><circle cx='100' cy='100' r='88' stroke-opacity='.2' stroke-width='.6'/>${Array.from({length:48},(_,i)=>{const a=i*7.5*Math.PI/180,long=i%4===0,r1=long?86:90,r2=95,x1=100+r1*Math.sin(a),y1=100-r1*Math.cos(a),x2=100+r2*Math.sin(a),y2=100-r2*Math.cos(a);return `<path d='M${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}' stroke-opacity='${long?.9:.45}' stroke-width='${long?1.2:.7}'/>`;}).join('')}${[0,90,180,270].map(d=>`<path transform='rotate(${d} 100 100)' d='M100 0.5 103.5 4 100 7.5 96.5 4Z' fill='#f0d08a' stroke='none'/>`).join('')}</svg>`);
const css=`
:root{--qb-gold:#e8c77b;--qb-gold-mid:#c9a45c;--qb-ink:#06080c;--qb-ease:cubic-bezier(.2,.8,.2,1);}
html,body{background:#06080c;color-scheme:dark;}
body{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:optimizeLegibility;-webkit-tap-highlight-color:transparent;}
::selection{background:rgba(232,199,123,.32);color:#fff;}
*{scrollbar-width:thin;scrollbar-color:#5c4826 transparent;}
*::-webkit-scrollbar{width:9px;height:9px;}
*::-webkit-scrollbar-track{background:transparent;}
*::-webkit-scrollbar-thumb{background:linear-gradient(#77602f,#3b2f1d);border-radius:10px;border:2px solid rgba(10,13,20,.9);}
:focus-visible{outline:2px solid #e8c77b !important;outline-offset:3px;}
[role=button]:not([data-qb]):not([aria-disabled=true]):hover,[role=tab]:not([data-qb]):hover{filter:brightness(1.18);}
textarea:focus,input:focus{outline:none !important;box-shadow:0 0 0 3px rgba(232,199,123,.16),0 0 20px rgba(232,199,123,.1);}
input::placeholder,textarea::placeholder{font-style:italic;}
[role=button],[role=radio],[role=link],[role=tab],[role=switch]{transition:transform .18s ease,box-shadow .25s ease,filter .2s ease,border-color .2s ease,background-color .2s ease,opacity .2s ease,color .2s ease;}
[role=button]:not([aria-disabled=true]):active{transform:scale(.97);}

/* The drifting backdrop is larger than the screen; clip (unlike hidden) can never be scrolled sideways by focus or full-screen changes. */
[data-qb=root],[data-qb=stage]{overflow:clip !important;}
/* Atmosphere: painted backdrop drifting slowly, light shafts, low fog, candle glow, vignette, rising embers and film grain. */
[data-qb=backdrop]{animation:qb-drift 70s ease-in-out infinite alternate;transform-origin:50% 40%;}
@keyframes qb-drift{from{transform:scale(1.06) translate3d(0,0,0);}to{transform:scale(1.16) translate3d(-2%,-3%,0);}}
[data-qb=atmosphere]{background:
 radial-gradient(ellipse 80% 55% at 50% -8%,rgba(236,164,84,.20),transparent 60%),
 radial-gradient(ellipse 70% 50% at 50% 115%,rgba(35,85,115,.22),transparent 65%),
 linear-gradient(180deg,rgba(6,8,12,.45) 0%,rgba(6,8,12,.72) 45%,rgba(6,8,12,.94) 100%) !important;}
[data-qb=atmosphere-home]{background:
 linear-gradient(90deg,rgba(5,7,11,.94) 0%,rgba(5,7,11,.78) 30%,rgba(5,7,11,.25) 62%,rgba(5,7,11,.45) 100%),
 radial-gradient(ellipse 70% 60% at 78% 20%,rgba(236,164,84,.16),transparent 65%),
 linear-gradient(180deg,rgba(6,8,12,.2) 0%,rgba(6,8,12,.1) 55%,rgba(6,8,12,.92) 100%) !important;}
[data-qb=atmosphere-home-narrow]{background:
 linear-gradient(180deg,rgba(5,7,11,.55) 0%,rgba(5,7,11,.2) 30%,rgba(5,7,11,.72) 58%,rgba(5,7,11,.97) 100%),
 radial-gradient(ellipse 90% 45% at 50% 18%,rgba(236,164,84,.16),transparent 70%) !important;}
[data-qb=atmosphere-game]{background:
 radial-gradient(ellipse 90% 60% at 50% -10%,rgba(236,164,84,.12),transparent 60%),
 linear-gradient(180deg,rgba(6,8,12,.25) 0%,rgba(6,8,12,.55) 60%,rgba(6,8,12,.82) 100%) !important;}
[data-qb=vignette]{box-shadow:inset 0 0 220px 70px rgba(0,0,0,.88);}
[data-qb=rays]{mix-blend-mode:screen;background:
 linear-gradient(112deg,transparent 38%,rgba(255,214,150,.075) 44%,transparent 51%),
 linear-gradient(104deg,transparent 54%,rgba(255,214,150,.05) 59%,transparent 65%),
 linear-gradient(121deg,transparent 22%,rgba(255,214,150,.045) 27%,transparent 33%);
 animation:qb-rays 16s ease-in-out infinite alternate;}
@keyframes qb-rays{from{opacity:.55;transform:translate3d(-3%,0,0);}to{opacity:1;transform:translate3d(3%,0,0);}}
[data-qb=fog]{background:radial-gradient(ellipse 55% 22% at 18% 92%,rgba(170,188,205,.11),transparent 70%),radial-gradient(ellipse 45% 20% at 72% 96%,rgba(170,188,205,.09),transparent 70%),radial-gradient(ellipse 40% 16% at 45% 84%,rgba(170,188,205,.06),transparent 70%);
 animation:qb-fog 46s ease-in-out infinite alternate;}
@keyframes qb-fog{from{transform:translate3d(-6%,0,0) scale(1.05);}to{transform:translate3d(6%,-2%,0) scale(1.12);}}
[data-qb=grain]{inset:-50% !important;width:200% !important;height:200% !important;background-image:${grain};background-size:220px 220px;opacity:.07;mix-blend-mode:overlay;animation:qb-grain 1.2s steps(6) infinite;}
@keyframes qb-grain{0%{transform:translate3d(0,0,0);}20%{transform:translate3d(-3%,2%,0);}40%{transform:translate3d(2%,-3%,0);}60%{transform:translate3d(-2%,-1%,0);}80%{transform:translate3d(3%,3%,0);}100%{transform:translate3d(0,0,0);}}
[data-qb=embers]{overflow:hidden;}
[data-qb=embers]::before,[data-qb=embers]::after{content:"";position:absolute;left:0;right:0;top:0;height:200%;background-repeat:repeat;pointer-events:none;
 background-image:radial-gradient(2px 2px at 12% 18%,rgba(255,196,120,.95),transparent 60%),radial-gradient(1.6px 1.6px at 34% 72%,rgba(255,170,90,.85),transparent 60%),radial-gradient(2.4px 2.4px at 58% 40%,rgba(255,210,150,.9),transparent 60%),radial-gradient(1.4px 1.4px at 81% 83%,rgba(255,160,80,.8),transparent 60%),radial-gradient(1.8px 1.8px at 92% 12%,rgba(255,200,130,.85),transparent 60%),radial-gradient(1.2px 1.2px at 46% 94%,rgba(255,180,100,.75),transparent 60%);
 background-size:100% 50%;animation:qb-rise 26s linear infinite;opacity:.55;filter:blur(.3px);}
[data-qb=embers]::after{background-size:70% 45%;animation-duration:38s;opacity:.35;transform:translateX(12%);}
@keyframes qb-rise{from{transform:translate3d(0,0,0);}to{transform:translate3d(-3%,-50%,0);}}

/* Screens arrive with a short rise and fade, like a page turning in. */
[data-qb=enter]{animation:qb-enter .5s var(--qb-ease) both;}
[data-qb=enter-slow]{animation:qb-enter .9s var(--qb-ease) both;}
@keyframes qb-enter{from{opacity:0;transform:translate3d(0,14px,0);}to{opacity:1;transform:none;}}
[data-qb=fade]{animation:qb-fade .6s ease both;}
@keyframes qb-fade{from{opacity:0;}to{opacity:1;}}

/* Title lettering: gilded, engraved, softly glowing. */
[data-qb=title]{background:linear-gradient(180deg,#fff8e2 0%,#f5dc9c 38%,#c89642 62%,#f3d68f 82%,#fff0c4 100%);-webkit-background-clip:text;background-clip:text;color:transparent !important;
 filter:drop-shadow(0 2px 0 rgba(20,12,4,.9)) drop-shadow(0 0 28px rgba(236,170,84,.35));}
/* Decorative capitals join some letter pairs; words other than the logo keep their letters separate. */
[data-lig=off]{font-variant-ligatures:none;font-feature-settings:"liga" 0,"dlig" 0,"clig" 0,"calt" 0,"hlig" 0,"salt" 0;}
[data-qb=title][data-glow=on]{animation:qb-breathe 6s ease-in-out infinite;}
@keyframes qb-breathe{0%,100%{filter:drop-shadow(0 2px 0 rgba(20,12,4,.9)) drop-shadow(0 0 22px rgba(236,170,84,.28));}50%{filter:drop-shadow(0 2px 0 rgba(20,12,4,.9)) drop-shadow(0 0 38px rgba(236,170,84,.5));}}
[data-qb=title][data-sheen=on]{background:linear-gradient(100deg,#c89642 0%,#f5dc9c 30%,#fff8e2 45%,#f5dc9c 60%,#c89642 100%);background-size:250% 100%;-webkit-background-clip:text;background-clip:text;animation:qb-sheen 7s ease-in-out infinite;}
@keyframes qb-sheen{0%,60%{background-position:100% 0;}100%{background-position:0 0;}}

/* Framed panels: layered bevel, double gold rule, filigree corners and a crowning lozenge. */
[data-qb=panel],[data-qb=glass]{position:relative;
 background:linear-gradient(180deg,rgba(24,29,42,.94) 0%,rgba(13,16,25,.95) 60%,rgba(10,12,19,.96) 100%) !important;
 box-shadow:0 0 0 1px rgba(0,0,0,.7),inset 0 0 0 5px rgba(10,12,19,.85),inset 0 0 0 6px rgba(201,164,92,.16),inset 0 1px 0 7px rgba(255,236,190,.02),inset 0 40px 80px -40px rgba(236,170,84,.06),0 28px 70px rgba(0,0,0,.55),0 0 80px rgba(236,164,84,.05);}
[data-qb=glass]{background:linear-gradient(180deg,rgba(18,23,34,.82),rgba(9,12,19,.86)) !important;-webkit-backdrop-filter:blur(10px) saturate(1.1);backdrop-filter:blur(10px) saturate(1.1);}
[data-qb=panel]::before,[data-qb=glass]::before{content:"";position:absolute;inset:3px;pointer-events:none;opacity:.9;
 background:${corners.tl} top left/34px 34px no-repeat,${corners.tr} top right/34px 34px no-repeat,${corners.bl} bottom left/34px 34px no-repeat,${corners.br} bottom right/34px 34px no-repeat;}
[data-qb=panel]::after,[data-qb=glass]::after{content:"";position:absolute;top:-5px;left:50%;width:9px;height:9px;margin-left:-5px;transform:rotate(45deg);background:linear-gradient(135deg,#fff1c7,#b98a3e);box-shadow:0 0 12px rgba(236,170,84,.6);pointer-events:none;}
[data-qb=plate]{background:linear-gradient(180deg,rgba(20,25,37,.9),rgba(10,13,20,.92)) !important;box-shadow:inset 0 1px 0 rgba(255,236,190,.06),inset 0 0 0 1px rgba(0,0,0,.25),0 10px 30px rgba(0,0,0,.45);}
[data-qb=plate-hot]{background:linear-gradient(180deg,rgba(46,18,15,.92),rgba(18,9,9,.94)) !important;box-shadow:inset 0 1px 0 rgba(255,190,170,.08),0 0 0 1px rgba(0,0,0,.4),0 10px 30px rgba(0,0,0,.5),0 0 40px rgba(200,65,47,.12);}
/* A framed page: the panel look with no crowning lozenge, for full-screen pages and modal sheets. */
[data-qb=sheet]{position:relative;background:linear-gradient(180deg,rgba(24,29,42,.97) 0%,rgba(12,15,23,.98) 100%) !important;
 box-shadow:0 0 0 1px rgba(0,0,0,.7),inset 0 0 0 5px rgba(10,12,19,.85),inset 0 0 0 6px rgba(201,164,92,.18),0 40px 100px rgba(0,0,0,.7),0 0 120px rgba(236,164,84,.07);
 animation:qb-pop .38s var(--qb-ease) both;}
[data-qb=sheet]::before{content:"";position:absolute;inset:3px;pointer-events:none;opacity:.9;
 background:${corners.tl} top left/34px 34px no-repeat,${corners.tr} top right/34px 34px no-repeat,${corners.bl} bottom left/34px 34px no-repeat,${corners.br} bottom right/34px 34px no-repeat;}
@keyframes qb-pop{from{opacity:0;transform:translate3d(0,18px,0) scale(.97);}to{opacity:1;transform:none;}}
[data-qb=scrim]{-webkit-backdrop-filter:blur(6px) saturate(.8);backdrop-filter:blur(6px) saturate(.8);animation:qb-fade .3s ease both;}

/* Buttons: forged stone with a gold edge, and a gilded primary that catches the light. */
[data-qb=btn]{background:linear-gradient(180deg,#252c3d 0%,#171c29 55%,#11151f 100%) !important;box-shadow:inset 0 1px 0 rgba(255,255,255,.07),inset 0 -1px 0 rgba(0,0,0,.5),0 6px 18px rgba(0,0,0,.4);}
[data-qb=btn]:hover{border-color:rgba(236,204,132,.85) !important;box-shadow:inset 0 1px 0 rgba(255,255,255,.1),0 0 0 1px rgba(236,204,132,.15),0 0 26px rgba(232,199,123,.2),0 10px 24px rgba(0,0,0,.5);transform:translateY(-1px);}
[data-qb=btn-primary]{position:relative;overflow:hidden;background:linear-gradient(180deg,#fbe5ab 0%,#e7c070 38%,#c4903f 72%,#a87832 100%) !important;
 box-shadow:inset 0 1px 0 rgba(255,255,255,.75),inset 0 -2px 0 rgba(90,55,15,.5),0 0 0 1px rgba(50,32,8,.9),0 10px 30px rgba(236,164,84,.28),0 0 50px rgba(236,164,84,.12);}
[data-qb=btn-primary]::after{content:"";position:absolute;top:0;bottom:0;left:-60%;width:40%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.55),transparent);transform:skewX(-18deg);animation:qb-shine 5.5s ease-in-out infinite;pointer-events:none;}
@keyframes qb-shine{0%,70%{left:-60%;}100%{left:130%;}}
[data-qb=btn-primary]:hover{filter:brightness(1.08) saturate(1.05);transform:translateY(-1px);box-shadow:inset 0 1px 0 rgba(255,255,255,.8),inset 0 -2px 0 rgba(90,55,15,.5),0 0 0 1px rgba(50,32,8,.9),0 14px 38px rgba(236,164,84,.42),0 0 70px rgba(236,164,84,.22);}
[data-qb=btn-danger]{background:linear-gradient(180deg,#7a2a20,#4a1712) !important;box-shadow:inset 0 1px 0 rgba(255,200,180,.2),0 8px 22px rgba(120,20,10,.35);}
[data-qb=btn-danger]:hover{filter:brightness(1.12);transform:translateY(-1px);}
[data-qb=chip]{background:linear-gradient(180deg,rgba(35,42,58,.9),rgba(18,22,32,.92)) !important;box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 4px 12px rgba(0,0,0,.35);}
[data-qb=chip]:hover{border-color:rgba(236,204,132,.8) !important;box-shadow:0 0 18px rgba(232,199,123,.18),0 4px 12px rgba(0,0,0,.4);}
[data-qb=chip-hot]{background:linear-gradient(180deg,rgba(92,30,22,.92),rgba(48,14,11,.94)) !important;box-shadow:inset 0 1px 0 rgba(255,200,180,.12),0 4px 12px rgba(0,0,0,.4),0 0 18px rgba(200,65,47,.18);}
[data-qb=chip-hot]:hover{border-color:rgba(255,150,120,.9) !important;box-shadow:0 0 22px rgba(240,106,79,.35),0 4px 12px rgba(0,0,0,.4);}
/* Round HUD buttons with a tooltip on hover (desktop). */
[data-qb=hud-btn]{position:relative;background:radial-gradient(circle at 50% 30%,rgba(48,56,76,.95),rgba(14,18,27,.95) 70%) !important;box-shadow:inset 0 1px 0 rgba(255,255,255,.08),inset 0 0 0 1px rgba(0,0,0,.4),0 4px 12px rgba(0,0,0,.45);}
[data-qb=hud-btn]:hover{border-color:rgba(236,204,132,.9) !important;box-shadow:0 0 0 1px rgba(236,204,132,.15),0 0 20px rgba(232,199,123,.25),0 4px 12px rgba(0,0,0,.45);color:#fff1c7;}
[data-qb=hud-btn-hot]{position:relative;background:radial-gradient(circle at 50% 30%,rgba(120,40,30,.95),rgba(50,14,11,.95) 70%) !important;box-shadow:0 0 16px rgba(200,65,47,.35),0 4px 12px rgba(0,0,0,.45);animation:qb-hot 2.4s ease-in-out infinite;}
@keyframes qb-hot{0%,100%{box-shadow:0 0 10px rgba(200,65,47,.3),0 4px 12px rgba(0,0,0,.45);}50%{box-shadow:0 0 22px rgba(240,106,79,.55),0 4px 12px rgba(0,0,0,.45);}}
@media (hover:hover) and (pointer:fine){
 [data-tip]:hover::after{content:attr(data-tip);position:absolute;top:calc(100% + 8px);left:50%;transform:translateX(-50%);white-space:nowrap;padding:5px 9px;border-radius:4px;border:1px solid rgba(201,164,92,.45);background:rgba(8,10,16,.96);color:#f1e6cc;font:600 11px/1.2 Inter,system-ui,sans-serif;letter-spacing:.4px;box-shadow:0 8px 20px rgba(0,0,0,.5);pointer-events:none;z-index:50;animation:qb-fade .15s ease both;}
}

/* Title-screen menu: engraved words that light up, with a lozenge marker and a gilded underline. */
[data-qb=menu-item]{position:relative;cursor:pointer;}
[data-qb=menu-item]::before{content:"";position:absolute;left:-20px;top:50%;width:9px;height:9px;margin-top:-5px;transform:rotate(45deg) scale(.4);opacity:0;background:linear-gradient(135deg,#fff1c7,#b98a3e);box-shadow:0 0 12px rgba(236,170,84,.8);transition:opacity .25s ease,transform .3s var(--qb-ease);}
[data-qb=menu-item]::after{content:"";position:absolute;left:0;bottom:4px;height:1px;width:100%;transform:scaleX(0);transform-origin:left;background:linear-gradient(90deg,rgba(232,199,123,.9),transparent);transition:transform .35s var(--qb-ease);}
[data-qb=menu-item]:hover::before,[data-qb=menu-item]:focus-visible::before{opacity:1;transform:rotate(45deg) scale(1);}
[data-qb=menu-item]:hover::after,[data-qb=menu-item]:focus-visible::after{transform:scaleX(1);}
[data-qb=menu-item]:hover [data-qb=menu-label],[data-qb=menu-item]:focus-visible [data-qb=menu-label]{color:#fff4d6 !important;text-shadow:0 0 18px rgba(236,170,84,.55),0 0 2px rgba(255,236,190,.4);}
[data-qb=menu-icon]{color:#e8c77b;transition:color .2s ease,filter .2s ease;}
[data-qb=menu-icon][data-primary=on]{color:#fff1c7;}
[data-qb=menu-item]:hover [data-qb=menu-icon],[data-qb=menu-item]:focus-visible [data-qb=menu-icon]{color:#fff1c7 !important;filter:drop-shadow(0 0 8px rgba(236,170,84,.7));}
[data-qb=menu-item][data-center=on]::before{display:none;}
[data-qb=menu-item][data-center=on]::after{transform-origin:center;background:linear-gradient(90deg,transparent,rgba(232,199,123,.9),transparent);}
[data-qb=menu-item][aria-disabled=true]{opacity:.45;cursor:default;}
/* The save slot on the title screen. */
[data-qb=slot]{position:relative;background:linear-gradient(160deg,rgba(28,33,46,.86),rgba(10,12,19,.9)) !important;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);
 box-shadow:inset 0 1px 0 rgba(255,236,190,.07),inset 0 0 0 1px rgba(0,0,0,.4),0 24px 60px rgba(0,0,0,.55),0 0 60px rgba(236,164,84,.06);}
[data-qb=slot]::before{content:"";position:absolute;inset:3px;pointer-events:none;opacity:.75;background:${corners.tl} top left/34px 34px no-repeat,${corners.tr} top right/34px 34px no-repeat,${corners.bl} bottom left/34px 34px no-repeat,${corners.br} bottom right/34px 34px no-repeat;}
[data-qb=region-paper]{background:radial-gradient(ellipse 90% 70% at 50% 45%,rgba(64,82,70,.35),transparent 70%),repeating-linear-gradient(0deg,rgba(232,199,123,.035) 0 1px,transparent 1px 28px),repeating-linear-gradient(90deg,rgba(232,199,123,.035) 0 1px,transparent 1px 28px),linear-gradient(180deg,#1a2423,#111816) !important;}
[data-qb=node-here]{box-shadow:0 0 0 4px rgba(217,174,95,.18),0 0 18px rgba(236,170,84,.55);animation:qb-breathe 2.6s ease-in-out infinite;}
/* The drawn region map: the sheet pans inside its frame when zoomed, with a quiet scrollbar; the marker where
   the hero stands breathes. */
[data-qb=map-scroll]{overflow:hidden !important;scrollbar-width:thin;scrollbar-color:rgba(59,42,23,.55) rgba(59,42,23,.12);overscroll-behavior:contain;touch-action:pan-x pan-y;}
[data-qb=map-scroll][data-zoomed=true]{overflow:auto !important;cursor:grab;}
[data-qb=map-frame]{box-shadow:0 10px 30px rgba(0,0,0,.5),inset 0 0 0 1px rgba(255,240,196,.12);}
[data-qb=map-here]{box-shadow:0 0 0 3px rgba(143,44,28,.22),0 0 16px rgba(143,44,28,.55);animation:qb-breathe 2.6s ease-in-out infinite;}
[data-qb=map-tool]{background:rgba(237,222,182,.92) !important;box-shadow:0 2px 8px rgba(40,25,10,.35);}
[data-qb=map-tool]:hover{background:#f6ebcb !important;}
@media (prefers-reduced-motion: reduce){[data-qb=map-here]{animation:none;}}
[data-qb=pip-good]{box-shadow:0 0 8px rgba(111,208,160,.6);}
[data-qb=pip-bad]{box-shadow:0 0 8px rgba(240,106,79,.65);}
@media (prefers-reduced-motion: reduce){[data-qb=node-here]{animation:none;}}
[data-qb=slot-shade]{background:linear-gradient(90deg,rgba(10,12,19,.92) 0%,rgba(10,12,19,.72) 55%,rgba(10,12,19,.45) 100%),linear-gradient(0deg,rgba(10,12,19,.85),transparent 60%) !important;}
[data-qb=slot]:hover{border-color:rgba(236,204,132,.8) !important;box-shadow:0 0 0 1px rgba(236,204,132,.12),0 24px 60px rgba(0,0,0,.6),0 0 50px rgba(232,199,123,.14);transform:translateY(-2px);}
/* Class crests: a gilded medallion around a line emblem. */
[data-qb=crest]{background:radial-gradient(circle at 50% 35%,#3a3222 0%,#1a1710 55%,#0b0a07 100%) !important;box-shadow:0 0 0 1px rgba(0,0,0,.85),0 0 0 3px rgba(40,30,14,.95),0 0 0 4px rgba(217,181,110,.85),inset 0 2px 6px rgba(255,236,190,.12),inset 0 -6px 12px rgba(0,0,0,.6),0 8px 22px rgba(0,0,0,.55),0 0 26px rgba(236,164,84,.18);}
[data-qb=crest] svg{filter:drop-shadow(0 0 6px rgba(236,170,84,.45));}
[data-qb=badge]{background:linear-gradient(180deg,#fbe5ab,#c4903f) !important;box-shadow:0 0 0 1px rgba(40,26,6,.9),0 2px 6px rgba(0,0,0,.6);}

/* Choice cards (story openings, heroes, map places). */
[data-qb=card]{background:linear-gradient(160deg,rgba(26,32,46,.9),rgba(12,15,23,.94)) !important;box-shadow:inset 0 1px 0 rgba(255,236,190,.05),0 10px 26px rgba(0,0,0,.4);}
[data-qb=card]:hover{transform:translateY(-2px);border-color:rgba(236,204,132,.7) !important;box-shadow:0 0 0 1px rgba(236,204,132,.12),0 16px 36px rgba(0,0,0,.5),0 0 34px rgba(232,199,123,.12);}
[data-qb=card][data-selected=true]{background:linear-gradient(160deg,rgba(58,46,26,.92),rgba(22,19,16,.95)) !important;box-shadow:0 0 0 1px rgba(255,226,160,.5),0 0 40px rgba(236,170,84,.28),inset 0 0 40px rgba(236,170,84,.08);}
[data-qb=card][data-tone=hot]{background:linear-gradient(160deg,rgba(52,22,18,.9),rgba(16,10,11,.94)) !important;}
[data-qb=card][data-tone=hot]:hover{border-color:rgba(255,150,120,.8) !important;box-shadow:0 16px 36px rgba(0,0,0,.5),0 0 34px rgba(240,106,79,.18);}
[data-qb=card][data-tone=hot][data-selected=true]{background:linear-gradient(160deg,rgba(80,28,20,.94),rgba(26,12,11,.96)) !important;box-shadow:0 0 0 1px rgba(255,160,130,.5),0 0 40px rgba(240,106,79,.28),inset 0 0 40px rgba(240,106,79,.08);}
/* Segmented tabs with a gold underline. */
[data-qb=seg]{background:rgba(6,8,12,.55) !important;box-shadow:inset 0 1px 3px rgba(0,0,0,.6);}
[data-qb=seg-on]{background:linear-gradient(180deg,rgba(70,56,30,.95),rgba(38,30,17,.95)) !important;box-shadow:inset 0 1px 0 rgba(255,236,190,.15),0 0 16px rgba(236,170,84,.18);}

/* Bars, rules, inputs and the story feed. */
[data-qb=bar]{box-shadow:inset 0 2px 4px rgba(0,0,0,.6);}
[data-qb=bar-hp]{background:linear-gradient(180deg,#9fe0b0,#4f9b6a 55%,#2f6b45) !important;box-shadow:0 0 12px rgba(111,191,142,.45);transition:width .6s var(--qb-ease);}
[data-qb=bar-enemy]{background:linear-gradient(180deg,#ff9a7c,#d2442e 55%,#7d1f14) !important;box-shadow:0 0 14px rgba(240,106,79,.5);transition:width .6s var(--qb-ease);}
[data-qb=bar-low]{background:linear-gradient(180deg,#ff8a70,#d2442e 55%,#7d1f14) !important;animation:qb-danger 1.1s ease-in-out infinite;transition:width .6s var(--qb-ease);}
@keyframes qb-danger{0%,100%{box-shadow:0 0 6px rgba(240,106,79,.4);}50%{box-shadow:0 0 18px rgba(240,106,79,.9);}}
[data-qb=bar-temp]{background:linear-gradient(180deg,#b6fff2,#48b4a6) !important;}
[data-qb=bar-gold]{background:linear-gradient(180deg,#fbe5ab,#c4903f) !important;box-shadow:0 0 12px rgba(236,170,84,.5);transition:width .5s var(--qb-ease);}
/* The ghost of lost HP lingers briefly behind the bar, then drains. */
[data-qb=bar-ghost]{background:rgba(255,236,190,.55) !important;transition:width .9s cubic-bezier(.6,0,.4,1) .35s;}
[data-qb=bar] [data-qb^=bar-]::after{content:"";position:absolute;left:0;right:0;top:0;height:45%;background:linear-gradient(180deg,rgba(255,255,255,.35),transparent);pointer-events:none;}
[data-qb=rule-left]{background:linear-gradient(90deg,transparent,rgba(232,199,123,.7)) !important;}
[data-qb=rule-right]{background:linear-gradient(90deg,rgba(232,199,123,.7),transparent) !important;}
[data-qb=input]{box-shadow:inset 0 2px 10px rgba(0,0,0,.55);}
[data-qb=input]:focus{border-color:rgba(236,204,132,.9) !important;box-shadow:inset 0 2px 10px rgba(0,0,0,.55),0 0 0 3px rgba(232,199,123,.14),0 0 24px rgba(232,199,123,.12);outline:none !important;}
[data-qb=feed-player]{background:linear-gradient(270deg,rgba(60,78,120,.3),rgba(20,28,44,.18)) !important;}
[data-qb=feed-roll]{background:linear-gradient(90deg,rgba(232,199,123,.1),rgba(20,24,34,.25)) !important;}
[data-qb=feed-effect]{background:linear-gradient(90deg,rgba(111,208,196,.1),rgba(20,24,34,.2)) !important;}
[data-qb=feed-dialogue]{background:linear-gradient(90deg,rgba(180,130,70,.14),rgba(20,24,34,.2)) !important;}
[data-qb=feed-hurt]{background:linear-gradient(90deg,rgba(200,65,47,.2),rgba(20,24,34,.2)) !important;}
[data-qb=feed-crit]{background:linear-gradient(90deg,rgba(255,210,120,.22),rgba(20,24,34,.2)) !important;box-shadow:0 0 24px rgba(236,170,84,.18);}
/* Dice results: a die face showing the natural roll, and a stamped verdict. */
[data-qb=die-face]{background:radial-gradient(circle at 35% 28%,#3a4660,#1b2233 60%,#0d111a) !important;box-shadow:inset 0 1px 0 rgba(255,255,255,.14),inset 0 -3px 6px rgba(0,0,0,.5),0 3px 8px rgba(0,0,0,.5);}
[data-qb=die-face][data-nat=max]{background:radial-gradient(circle at 35% 28%,#fff1c7,#d9ae5f 55%,#8a6a35) !important;box-shadow:0 0 16px rgba(236,170,84,.7),inset 0 -3px 6px rgba(90,55,15,.5);}
[data-qb=die-face][data-nat=one]{background:radial-gradient(circle at 35% 28%,#8c3a2e,#4a1712 60%,#240a08) !important;box-shadow:0 0 14px rgba(200,65,47,.55);}
/* A rolled die tumbles in from the left, bounces once and settles; when its number lands it pops and flashes. */
[data-qb=die-face][data-roll=on]{animation:qb-tumble .56s cubic-bezier(.25,.1,.4,1) both;}
[data-qb=die-face][data-roll=landed]{animation:qb-land .38s cubic-bezier(.3,1.7,.5,1) both;}
@keyframes qb-tumble{0%{transform:translate3d(-30px,-16px,0) rotate(-320deg) scale(.5);opacity:0;}18%{opacity:1;}52%{transform:translate3d(-6px,4px,0) rotate(-70deg) scale(1.06);}74%{transform:translate3d(-1px,-6px,0) rotate(-16deg) scale(1);}100%{transform:translate3d(0,0,0) rotate(0) scale(1);opacity:1;}}
@keyframes qb-land{0%{transform:scale(1.32);filter:brightness(1.9);}60%{transform:scale(.96);filter:brightness(1.15);}100%{transform:none;filter:none;}}
[data-qb=verdict]{animation:qb-stamp .45s cubic-bezier(.3,1.6,.5,1) .6s both;}
@keyframes qb-stamp{from{transform:scale(1.8);opacity:0;}to{transform:none;opacity:1;}}
[data-qb=num-pop]{animation:qb-numpop .5s cubic-bezier(.3,1.6,.5,1) both;}
@keyframes qb-numpop{from{transform:scale(.4) translateY(6px);opacity:0;}to{transform:none;opacity:1;}}
[data-qb=portrait]{box-shadow:0 0 0 1px rgba(0,0,0,.8),0 0 0 4px rgba(20,16,10,.9),0 0 0 5px rgba(201,164,92,.6),0 14px 40px rgba(0,0,0,.6),0 0 40px rgba(236,164,84,.15);}
[data-qb=portrait-hot]{box-shadow:0 0 0 1px rgba(0,0,0,.8),0 0 0 4px rgba(24,10,8,.9),0 0 0 5px rgba(220,90,70,.7),0 14px 40px rgba(0,0,0,.6),0 0 40px rgba(200,65,47,.25);}
[data-qb=plate-shade]{background:linear-gradient(180deg,rgba(6,8,12,0) 30%,rgba(6,8,12,.55) 60%,rgba(6,8,12,.94) 100%) !important;}
[data-qb=foe-shade]{background:linear-gradient(180deg,rgba(12,6,6,0) 30%,rgba(12,6,6,.55) 58%,rgba(12,6,6,.96) 100%) !important;}
[data-qb=avatar]{box-shadow:0 0 0 2px rgba(201,164,92,.7),0 4px 10px rgba(0,0,0,.5);}
[data-qb=banner]{background:linear-gradient(90deg,transparent,rgba(120,24,16,.55) 20%,rgba(120,24,16,.55) 80%,transparent) !important;}
[data-qb=die]{background:radial-gradient(circle at 35% 30%,#3d6f80,#1c3c48 55%,#0f222b) !important;box-shadow:inset 0 2px 0 rgba(255,255,255,.15),inset 0 -6px 14px rgba(0,0,0,.5),0 18px 40px rgba(0,0,0,.6),0 0 40px rgba(232,199,123,.25) !important;}
[data-qb=tray]{background:radial-gradient(ellipse at 50% 40%,rgba(40,70,60,.5),rgba(8,14,18,.85) 70%) !important;box-shadow:inset 0 0 60px rgba(0,0,0,.8),inset 0 0 0 1px rgba(201,164,92,.25);}

/* Cinematic moments: a red pulse when you are hurt, a gold flare on a critical, a sweeping round banner, and the
   victory and defeat title cards. All purely visual and never block input for long. */
[data-qb=flash-hurt]{background:radial-gradient(ellipse at 50% 50%,transparent 45%,rgba(200,30,20,.55) 100%) !important;animation:qb-flash .7s ease-out both;}
[data-qb=flash-crit]{background:radial-gradient(ellipse at 50% 50%,rgba(255,220,150,.28),transparent 60%) !important;animation:qb-flash .8s ease-out both;}
[data-qb=flash-heal]{background:radial-gradient(ellipse at 50% 60%,transparent 40%,rgba(111,191,142,.35) 100%) !important;animation:qb-flash 1s ease-out both;}
@keyframes qb-flash{0%{opacity:0;}15%{opacity:1;}100%{opacity:0;}}
[data-qb=shake]{animation:qb-shake .42s cubic-bezier(.36,.07,.19,.97) both;}
@keyframes qb-shake{10%,90%{transform:translate3d(-1px,0,0);}20%,80%{transform:translate3d(3px,0,0);}30%,50%,70%{transform:translate3d(-5px,1px,0);}40%,60%{transform:translate3d(5px,-1px,0);}}
[data-qb=cine-band]{background:linear-gradient(90deg,transparent,rgba(8,6,6,.93) 16%,rgba(8,6,6,.93) 84%,transparent) !important;animation:qb-band 1.9s var(--qb-ease) both;}
[data-qb=cine-band][data-tone=gold]{background:linear-gradient(90deg,transparent,rgba(24,18,8,.9) 18%,rgba(24,18,8,.9) 82%,transparent) !important;}
@keyframes qb-band{0%{opacity:0;transform:scaleY(.2);}14%{opacity:1;transform:scaleY(1);}80%{opacity:1;transform:scaleY(1);}100%{opacity:0;transform:scaleY(.6);}}
[data-qb=cine-text]{animation:qb-cinetext 1.9s var(--qb-ease) both;}
@keyframes qb-cinetext{0%{opacity:0;letter-spacing:.6em;}18%{opacity:1;letter-spacing:.28em;}80%{opacity:1;letter-spacing:.24em;}100%{opacity:0;letter-spacing:.2em;}}
[data-qb=cine-rule]{animation:qb-cinerule 1.9s var(--qb-ease) both;}
@keyframes qb-cinerule{0%{transform:scaleX(0);}25%{transform:scaleX(1);}100%{transform:scaleX(1);}}
[data-qb=finale]{animation:qb-fade .6s ease both;-webkit-backdrop-filter:blur(5px) saturate(.7);backdrop-filter:blur(5px) saturate(.7);}
[data-qb=finale-card]{animation:qb-finale 1s var(--qb-ease) .1s both;}
@keyframes qb-finale{from{opacity:0;transform:translate3d(0,24px,0) scale(.94);}to{opacity:1;transform:none;}}
[data-qb=finale-burst]{background:radial-gradient(circle at 50% 50%,rgba(255,214,140,.35),rgba(236,164,84,.08) 35%,transparent 65%) !important;animation:qb-burst 2.4s ease-out both;}
[data-qb=finale-burst][data-tone=dark]{background:radial-gradient(circle at 50% 50%,rgba(120,20,14,.35),rgba(20,4,4,.2) 40%,transparent 70%) !important;}
@keyframes qb-burst{0%{opacity:0;transform:scale(.3);}30%{opacity:1;}100%{opacity:.6;transform:scale(1.4);}}
[data-qb=area]{background:radial-gradient(ellipse 80% 46% at 50% 50%,rgba(3,4,6,.95),rgba(3,4,6,.82) 45%,rgba(3,4,6,.5) 80%,rgba(3,4,6,.3)) !important;-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);animation:qb-area 3.7s ease both;}
@keyframes qb-area{0%{opacity:0;transform:scale(1.03);}18%{opacity:1;transform:none;}78%{opacity:1;}100%{opacity:0;transform:scale(.99);}}
/* Entering the game rises out of black; paintings fade in as they finish. */
[data-qb=unveil]{background:#030405 !important;animation:qb-unveil 1.1s ease .1s both;}
@keyframes qb-unveil{from{opacity:1;}to{opacity:0;}}
[data-qb=art-img]{animation:qb-fade .9s ease both;}
[data-qb=burst-text]{animation:qb-bursttext 1s cubic-bezier(.2,.8,.2,1) both;}
@keyframes qb-bursttext{0%{opacity:0;transform:scale(1.7);}18%{opacity:1;transform:scale(1);}70%{opacity:1;}100%{opacity:0;transform:scale(.97) translate3d(0,-8px,0);}}
/* A struck portrait flinches: a short shake with a red flare (two identical keyframes so each hit restarts it). */
[data-hit=a]{animation:qb-hit-a .6s ease-out both;}
[data-hit=b]{animation:qb-hit-b .6s ease-out both;}
@keyframes qb-hit-a{0%{transform:none;filter:none;}12%{transform:translate3d(-4px,0,0) scale(1.03);filter:brightness(1.5) sepia(.9) hue-rotate(-45deg) saturate(3.5);}30%{transform:translate3d(4px,0,0);}50%{transform:translate3d(-2px,0,0);filter:brightness(1.15) sepia(.4) hue-rotate(-45deg) saturate(2);}100%{transform:none;filter:none;}}
@keyframes qb-hit-b{0%{transform:none;filter:none;}12%{transform:translate3d(-4px,0,0) scale(1.03);filter:brightness(1.5) sepia(.9) hue-rotate(-45deg) saturate(3.5);}30%{transform:translate3d(4px,0,0);}50%{transform:translate3d(-2px,0,0);filter:brightness(1.15) sepia(.4) hue-rotate(-45deg) saturate(2);}100%{transform:none;filter:none;}}
[data-qb=floater]{animation:qb-float 1.35s cubic-bezier(.2,.8,.2,1) both;}
@keyframes qb-float{0%{opacity:0;transform:translate3d(0,6px,0) scale(.7);}15%{opacity:1;transform:translate3d(0,0,0) scale(1.15);}30%{transform:scale(1);}100%{opacity:0;transform:translate3d(0,-30px,0);}}
[data-qb=art-wait]{background:linear-gradient(100deg,#0f141e 30%,#1d2536 50%,#0f141e 70%) !important;background-size:220% 100% !important;animation:qb-shimmer 1.8s linear infinite;}
/* Low HP: a red ring pulses around the hero's portrait. */
[data-qb=low-ring]{border-radius:50%;animation:qb-lowring 1.1s ease-in-out infinite;}
@keyframes qb-lowring{0%,100%{box-shadow:0 0 0 2px rgba(240,106,79,.35),0 0 8px rgba(240,106,79,.3);}50%{box-shadow:0 0 0 3px rgba(240,106,79,.9),0 0 20px rgba(240,106,79,.7);}}
/* Your move: the main action breathes gently while the game waits for you in a fight. */
[data-qb=btn-primary][data-pulse=on]{animation:qb-yourmove 2.2s ease-in-out infinite;}
@keyframes qb-yourmove{0%,100%{box-shadow:inset 0 1px 0 rgba(255,255,255,.75),0 0 0 1px rgba(50,32,8,.9),0 6px 18px rgba(236,164,84,.25);}50%{box-shadow:inset 0 1px 0 rgba(255,255,255,.75),0 0 0 1px rgba(50,32,8,.9),0 0 26px rgba(236,164,84,.7);}}
[data-qb=rays-spin]{background:repeating-conic-gradient(from 0deg,rgba(255,214,150,.12) 0deg 4deg,transparent 4deg 18deg) !important;-webkit-mask-image:radial-gradient(circle,#000 10%,transparent 65%);mask-image:radial-gradient(circle,#000 10%,transparent 65%);animation:qb-spin 40s linear infinite;}
@keyframes qb-spin{to{transform:rotate(360deg);}}

/* Launch sequence. */
[data-qb=launch-glow]{background:radial-gradient(ellipse 60% 45% at 50% 42%,rgba(236,164,84,.22),transparent 70%),radial-gradient(ellipse 120% 80% at 50% 110%,rgba(35,85,115,.18),transparent 70%),#06080c !important;animation:qb-candle 5s ease-in-out infinite;}
@keyframes qb-candle{0%,100%{opacity:.85;}45%{opacity:1;}70%{opacity:.9;}}
[data-qb=launch-ring]{box-shadow:0 0 0 1px rgba(0,0,0,.8),0 0 40px rgba(236,170,84,.35),inset 0 0 30px rgba(236,170,84,.18);background:radial-gradient(circle at 50% 40%,rgba(58,46,26,.55),rgba(8,10,16,.9) 70%) !important;}
[data-qb=bezel]{background:${bezel} center/contain no-repeat;animation:qb-spin 90s linear infinite;opacity:.85;}
[data-qb=bezel][data-dir=back]{animation-direction:reverse;animation-duration:140s;opacity:.4;transform:scale(1.12);}
[data-qb=launch-prompt]{animation:qb-pulse 2.2s ease-in-out infinite;}
@keyframes qb-pulse{0%,100%{opacity:.45;letter-spacing:4px;}50%{opacity:1;letter-spacing:5px;}}
/* Game HUD and phone tab bar: frosted, always on top of the scene. */
[data-qb=hud],[data-qb=tabbar]{-webkit-backdrop-filter:blur(12px) saturate(1.2);backdrop-filter:blur(12px) saturate(1.2);box-shadow:0 8px 30px rgba(0,0,0,.45);}
[data-qb=hud]{background:linear-gradient(180deg,rgba(14,17,26,.94),rgba(8,10,16,.86)) !important;}
[data-qb=hud]::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:1px;background:linear-gradient(90deg,transparent,rgba(232,199,123,.75) 20%,rgba(232,199,123,.75) 80%,transparent);pointer-events:none;}
[data-qb=tabbar]{background:linear-gradient(180deg,rgba(10,12,19,.9),rgba(6,8,12,.97)) !important;}
[data-qb=tabbar]::before{content:"";position:absolute;left:0;right:0;top:-1px;height:1px;background:linear-gradient(90deg,transparent,rgba(232,199,123,.6) 20%,rgba(232,199,123,.6) 80%,transparent);pointer-events:none;}
[data-qb=tab-on]{background:radial-gradient(ellipse 60% 90% at 50% 0%,rgba(236,170,84,.22),transparent 70%) !important;}
[data-qb=emblem]{box-shadow:0 0 16px rgba(236,170,84,.35),inset 0 0 10px rgba(236,170,84,.2);}
/* A sideways-scrolling row fades at its right edge, so more actions read as "swipe for more". */
[data-qb=actions-scroll]{-webkit-mask-image:linear-gradient(90deg,#000 86%,transparent);mask-image:linear-gradient(90deg,#000 86%,transparent);}
[data-qb=key]{box-shadow:inset 0 -1px 0 rgba(0,0,0,.6),0 1px 0 rgba(255,255,255,.06);}
@media (hover:none){[data-qb=key]{display:none !important;}}
[data-qb=typing] [data-qb=dot]{animation:qb-typing 1.2s ease-in-out infinite;}
[data-qb=typing] [data-qb=dot]:nth-child(2){animation-delay:.15s;}
[data-qb=typing] [data-qb=dot]:nth-child(3){animation-delay:.3s;}
@keyframes qb-typing{0%,60%,100%{opacity:.25;transform:translateY(0);}30%{opacity:1;transform:translateY(-3px);}}
[data-qb=shimmer]{background:linear-gradient(90deg,rgba(232,199,123,.15) 0%,rgba(255,236,190,.85) 50%,rgba(232,199,123,.15) 100%) !important;background-size:200% 100% !important;animation:qb-shimmer 1.6s linear infinite;}
@keyframes qb-shimmer{from{background-position:100% 0;}to{background-position:-100% 0;}}
/* Touch devices keep the grain and light shafts still: the look stays, the battery is spared. */
@media (hover:none){[data-qb=grain],[data-qb=rays]{animation:none !important;}}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none !important;transition:none !important;}}
`;
export function initializeWebTheme(){
 if(typeof document==='undefined'||document.getElementById('questbound-theme'))return;
 for(const href of ['https://fonts.googleapis.com','https://fonts.gstatic.com']){const l=document.createElement('link');l.rel='preconnect';l.href=href;if(href.includes('gstatic'))l.crossOrigin='anonymous';document.head.appendChild(l);}
 // The page template already requests the typefaces; add them here only when it did not (for example the dev server).
 const early=document.getElementById('qb-fonts');
 if(early)early.media='all';
 else{const fontsLink=document.createElement('link');fontsLink.rel='stylesheet';
 fontsLink.href='https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@700;900&family=Cinzel:wght@400;500;600;700;800&family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Inter:wght@400;500;600;700&display=swap';
 document.head.appendChild(fontsLink);}
 const style=document.createElement('style');style.id='questbound-theme';style.textContent=css;document.head.appendChild(style);
 document.querySelector('meta[name="theme-color"]')?.setAttribute('content','#06080c');
 document.title='Questbound';
}
