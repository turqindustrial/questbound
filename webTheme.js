// Web-only finish: typefaces, metallic buttons, framed panels, atmosphere and motion, attached through dataSet hooks (data-qb).
// The colours are written as the Red theme; tint() turns each into a style variable that follows the chosen theme.
import {tint,themeVariables} from './theme';
import {themedText} from './themeRules';
import {serpentMarkup} from './serpent';
const svg=markup=>'url("data:image/svg+xml,'+encodeURIComponent(markup)+'")';
// Corner filigree for framed panels: a rounded bracket, an inner echo, two curls and a lozenge.
const flourishMarkup=transform=>(`<svg xmlns='http://www.w3.org/2000/svg' width='34' height='34' viewBox='0 0 34 34' fill='none' stroke='#c4344e' stroke-width='1.1' stroke-linecap='round'><g transform='${transform}'><path d='M1.5 20V7A5.5 5.5 0 0 1 7 1.5h13'/><path d='M6 14V9.2A3.2 3.2 0 0 1 9.2 6H14' stroke-opacity='.55'/><path d='M20 1.5c3 0 4.5 1.6 4.5 3.6' stroke-opacity='.8'/><path d='M1.5 20c0 3 1.6 4.5 3.6 4.5' stroke-opacity='.8'/><path d='M10.5 8.8 12.2 10.5 10.5 12.2 8.8 10.5Z' fill='#be96ff' stroke='none'/></g></svg>`);
const turns={tl:'',tr:'translate(34 0) scale(-1 1)',bl:'translate(0 34) scale(1 -1)',br:'translate(34 34) scale(-1 -1)'};
const corners={tl:'var(--qb-corner-tl)',tr:'var(--qb-corner-tr)',bl:'var(--qb-corner-bl)',br:'var(--qb-corner-br)'};
// Film grain: fractal noise baked into a small tile once; it only moves on the compositor.
const grain=svg(`<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .6 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`);
// A serpent biting its tail (an ouroboros) turns slowly around the launch emblem and the story seal: scales, a head with a
// violet eye, its jaws on the tail tip (serpent.js).
const serpent=serpentMarkup();
// A picture written as text cannot read a style variable, so these are written out afresh for each theme.
// Each theme's set is worked out once: theme.js repaints every extra whenever a colour is first used.
const pictures={};
themeVariables(theme=>pictures[theme]??={...Object.fromEntries(Object.entries(turns).map(([corner,turn])=>['--qb-corner-'+corner,svg(themedText(flourishMarkup(turn),theme))])),'--qb-serpent':svg(themedText(serpent,theme))});
const css=tint(`
:root{--qb-gold:#e04a5c;--qb-gold-mid:#b2223a;--qb-ink:#0a070b;--qb-ease:cubic-bezier(.2,.8,.2,1);}
html,body{background:#0a070b;color-scheme:dark;}
body{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:optimizeLegibility;-webkit-tap-highlight-color:transparent;}
::selection{background:rgba(176,140,245,.38);color:#fff;}
*{scrollbar-width:thin;scrollbar-color:#4a2c78 transparent;}
*::-webkit-scrollbar{width:9px;height:9px;}
*::-webkit-scrollbar-track{background:transparent;}
*::-webkit-scrollbar-thumb{background:linear-gradient(#6b3fb0,#3a1f66);border-radius:10px;border:2px solid rgba(17,12,18,.9);}
:focus-visible{outline:2px solid #b08cf5 !important;outline-offset:3px;}
[role=button]:not([data-qb]):not([aria-disabled=true]):hover,[role=tab]:not([data-qb]):hover{filter:brightness(1.18);}
textarea:focus,input:focus{outline:none !important;box-shadow:0 0 0 3px rgba(176,140,245,.2),0 0 20px rgba(176,140,245,.12);}
input::placeholder,textarea::placeholder{font-style:italic;}
[role=button],[role=radio],[role=link],[role=tab],[role=switch]{transition:transform .18s ease,box-shadow .25s ease,filter .2s ease,border-color .2s ease,background-color .2s ease,opacity .2s ease,color .2s ease;}
[role=button]:not([aria-disabled=true]):active{transform:scale(.97);}

/* The drifting backdrop is larger than the screen; clip (unlike hidden) can never be scrolled sideways by focus or full-screen changes. */
[data-qb=root],[data-qb=stage]{overflow:clip !important;}
/* Atmosphere: painted backdrop drifting slowly, light shafts, low fog, candle glow, vignette, rising embers and film grain. */
/* The painting starts at its true size and drifts in only a little (the host asked for it zoomed out, 2026-10-02). */
[data-qb=backdrop]{animation:qb-drift 70s ease-in-out infinite alternate;transform-origin:50% 40%;}
/* The valley painting: the horizon on wide screens; on an upright phone the tower, the bridge and the peak. */
[data-qb=backdrop]>div{background-position:50% 42% !important;}
[data-qb=backdrop][data-frame=tall]>div{background-position:62% 50% !important;}
@keyframes qb-drift{from{transform:scale(1) translate3d(0,0,0);}to{transform:scale(1.05) translate3d(-1%,-1.5%,0);}}
[data-qb=atmosphere]{background:
 radial-gradient(ellipse 80% 55% at 50% -8%,rgba(140,82,255,.20),transparent 60%),
 radial-gradient(ellipse 70% 50% at 50% 115%,rgba(72,35,115,.22),transparent 65%),
 linear-gradient(180deg,rgba(10,7,11,.45) 0%,rgba(10,7,11,.72) 45%,rgba(10,7,11,.94) 100%) !important;}
/* The menu sits in the valley's dark left third; a faint warm glow toward the break in the clouds. */
[data-qb=atmosphere-home]{background:
 linear-gradient(90deg,rgba(6,4,7,.9) 0%,rgba(6,4,7,.66) 28%,rgba(6,4,7,.08) 58%,rgba(6,4,7,.12) 100%),
 radial-gradient(ellipse 70% 60% at 78% 20%,rgba(236,164,84,.10),transparent 65%),
 linear-gradient(180deg,rgba(6,4,7,.12) 0%,rgba(6,4,7,0) 50%,rgba(6,4,7,.8) 100%) !important;}
/* The title screen shows its painting: a lighter frame than the menus and the game use. */
[data-qb=vignette][data-home=on]{box-shadow:inset 0 0 140px 20px rgba(0,0,0,.6);}
[data-qb=atmosphere-home-narrow]{background:
 linear-gradient(180deg,rgba(6,4,7,.5) 0%,rgba(6,4,7,.08) 30%,rgba(6,4,7,.62) 58%,rgba(6,4,7,.96) 100%) !important;}
[data-qb=atmosphere-game]{background:
 radial-gradient(ellipse 90% 60% at 50% -10%,rgba(140,82,255,.12),transparent 60%),
 linear-gradient(180deg,rgba(10,7,11,.25) 0%,rgba(10,7,11,.55) 60%,rgba(10,7,11,.82) 100%) !important;}
[data-qb=vignette]{box-shadow:inset 0 0 220px 70px rgba(0,0,0,.88);}
/* Every looping animation moves only transform or opacity, which the graphics card does on its own: nothing on a
   full-screen layer blends with what lies beneath it, and nothing that loops changes size, position, shadows or
   backgrounds (those make the browser repaint every frame). verify-performance.cjs holds the styles to this. */
[data-qb=rays]{background:
 linear-gradient(112deg,transparent 38%,rgba(206,150,255,.075) 44%,transparent 51%),
 linear-gradient(104deg,transparent 54%,rgba(206,150,255,.05) 59%,transparent 65%),
 linear-gradient(121deg,transparent 22%,rgba(206,150,255,.045) 27%,transparent 33%);
 animation:qb-rays 16s ease-in-out infinite alternate;}
@keyframes qb-rays{from{opacity:.55;transform:translate3d(-3%,0,0);}to{opacity:1;transform:translate3d(3%,0,0);}}
[data-qb=fog]{background:radial-gradient(ellipse 55% 22% at 18% 92%,rgba(195,181,190,.11),transparent 70%),radial-gradient(ellipse 45% 20% at 72% 96%,rgba(195,181,190,.09),transparent 70%),radial-gradient(ellipse 40% 16% at 45% 84%,rgba(195,181,190,.06),transparent 70%);
 animation:qb-fog 46s ease-in-out infinite alternate;}
@keyframes qb-fog{from{transform:translate3d(-6%,0,0) scale(1.05);}to{transform:translate3d(6%,-2%,0) scale(1.12);}}
/* Film grain: a still layer of faint light specks, blended normally (an overlay blend over the whole screen made the
   browser recompose everything beneath it each frame). */
[data-qb=grain]{background-image:${grain};background-size:220px 220px;opacity:.045;}
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

/* Title lettering: crimson foil, engraved, softly glowing. */
[data-qb=title]{background:linear-gradient(180deg,#ffe1e5 0%,#ff5a72 34%,#a3162c 62%,#e23a55 82%,#ff97a6 100%);-webkit-background-clip:text;background-clip:text;color:transparent !important;
 filter:drop-shadow(0 2px 0 rgba(20,4,7,.95)) drop-shadow(0 0 26px rgba(230,48,82,.4)) drop-shadow(0 0 60px rgba(140,82,255,.22));}
/* Decorative capitals join some letter pairs; words other than the logo keep their letters separate. */
[data-lig=off]{font-variant-ligatures:none;font-feature-settings:"liga" 0,"dlig" 0,"clig" 0,"calt" 0,"hlig" 0,"salt" 0;}
/* The glow is painted once; the lettering breathes by its opacity alone. */
[data-qb=title][data-glow=on]{animation:qb-glow 6s ease-in-out infinite;}
@keyframes qb-glow{0%,100%{opacity:.88;}50%{opacity:1;}}
/* The finale's sheen crosses the word a few times and rests. */
[data-qb=title][data-sheen=on]{background:linear-gradient(100deg,#a3162c 0%,#ff5a72 30%,#ffe9ec 45%,#ff5a72 60%,#a3162c 100%);background-size:250% 100%;-webkit-background-clip:text;background-clip:text;animation:qb-sheen 7s ease-in-out 3;}
@keyframes qb-sheen{0%,60%{background-position:100% 0;}100%{background-position:0 0;}}

/* Framed panels: layered bevel, double gold rule, filigree corners and a crowning lozenge. */
[data-qb=panel],[data-qb=glass]{position:relative;
 background:linear-gradient(180deg,rgba(37,28,38,.94) 0%,rgba(21,16,22,.95) 60%,rgba(16,12,17,.96) 100%) !important;
 box-shadow:0 0 0 1px rgba(0,0,0,.7),inset 0 0 0 5px rgba(16,12,17,.85),inset 0 0 0 6px rgba(178,34,58,.16),inset 0 1px 0 7px rgba(255,214,224,.02),inset 0 40px 80px -40px rgba(230,48,82,.06),0 28px 70px rgba(0,0,0,.55),0 0 80px rgba(140,82,255,.05);}
[data-qb=glass]{background:linear-gradient(180deg,rgba(29,22,30,.82),rgba(16,11,17,.86)) !important;-webkit-backdrop-filter:blur(10px) saturate(1.1);backdrop-filter:blur(10px) saturate(1.1);}
[data-qb=panel]::before,[data-qb=glass]::before{content:"";position:absolute;inset:3px;pointer-events:none;opacity:.9;
 background:${corners.tl} top left/34px 34px no-repeat,${corners.tr} top right/34px 34px no-repeat,${corners.bl} bottom left/34px 34px no-repeat,${corners.br} bottom right/34px 34px no-repeat;}
[data-qb=panel]::after,[data-qb=glass]::after{content:"";position:absolute;top:-5px;left:50%;width:9px;height:9px;margin-left:-5px;transform:rotate(45deg);background:linear-gradient(135deg,#eadaff,#7846dc);box-shadow:0 0 12px rgba(160,110,255,.7);pointer-events:none;}
[data-qb=plate]{background:linear-gradient(180deg,rgba(32,24,33,.9),rgba(17,12,18,.92)) !important;box-shadow:inset 0 1px 0 rgba(255,214,224,.06),inset 0 0 0 1px rgba(0,0,0,.25),0 10px 30px rgba(0,0,0,.45);}
[data-qb=plate-hot]{background:linear-gradient(180deg,rgba(46,18,15,.92),rgba(18,9,9,.94)) !important;box-shadow:inset 0 1px 0 rgba(255,190,170,.08),0 0 0 1px rgba(0,0,0,.4),0 10px 30px rgba(0,0,0,.5),0 0 40px rgba(200,65,47,.12);}
/* A framed page: the panel look with no crowning lozenge, for full-screen pages and modal sheets. */
[data-qb=sheet]{position:relative;background:linear-gradient(180deg,rgba(37,28,38,.97) 0%,rgba(20,14,21,.98) 100%) !important;
 box-shadow:0 0 0 1px rgba(0,0,0,.7),inset 0 0 0 5px rgba(16,12,17,.85),inset 0 0 0 6px rgba(178,34,58,.18),0 40px 100px rgba(0,0,0,.7),0 0 120px rgba(140,82,255,.07);
 animation:qb-pop .38s var(--qb-ease) both;}
[data-qb=sheet]::before{content:"";position:absolute;inset:3px;pointer-events:none;opacity:.9;
 background:${corners.tl} top left/34px 34px no-repeat,${corners.tr} top right/34px 34px no-repeat,${corners.bl} bottom left/34px 34px no-repeat,${corners.br} bottom right/34px 34px no-repeat;}
@keyframes qb-pop{from{opacity:0;transform:translate3d(0,18px,0) scale(.97);}to{opacity:1;transform:none;}}
[data-qb=scrim]{-webkit-backdrop-filter:blur(6px) saturate(.8);backdrop-filter:blur(6px) saturate(.8);animation:qb-fade .3s ease both;}

/* Buttons: forged stone with a red edge, and a deep crimson primary that catches the light. */
[data-qb=btn]{background:linear-gradient(180deg,#362a38 0%,#241b25 55%,#1b141c 100%) !important;box-shadow:inset 0 1px 0 rgba(255,255,255,.07),inset 0 -1px 0 rgba(0,0,0,.5),0 6px 18px rgba(0,0,0,.4);}
[data-qb=btn]:hover{border-color:rgba(190,150,255,.85) !important;box-shadow:inset 0 1px 0 rgba(255,255,255,.1),0 0 0 1px rgba(190,150,255,.15),0 0 26px rgba(224,74,92,.2),0 10px 24px rgba(0,0,0,.5);transform:translateY(-1px);}
[data-qb=btn-primary]{position:relative;overflow:hidden;background:linear-gradient(180deg,#c92f49 0%,#a51a33 40%,#7c1227 76%,#5e0d1e 100%) !important;
 box-shadow:inset 0 1px 0 rgba(255,190,200,.5),inset 0 -2px 0 rgba(40,4,12,.55),0 0 0 1px rgba(30,4,10,.9),0 10px 30px rgba(140,82,255,.26),0 0 50px rgba(200,40,70,.14);}
[data-qb=btn-primary]::after{content:"";position:absolute;top:0;bottom:0;left:0;width:40%;background:linear-gradient(100deg,transparent,rgba(255,210,220,.3),transparent);transform:translateX(-150%) skewX(-18deg);animation:qb-shine 5.5s ease-in-out infinite;pointer-events:none;}
@keyframes qb-shine{0%,70%{transform:translateX(-150%) skewX(-18deg);}100%{transform:translateX(330%) skewX(-18deg);}}
[data-qb=btn-primary]:hover{filter:brightness(1.14) saturate(1.05);transform:translateY(-1px);box-shadow:inset 0 1px 0 rgba(255,200,210,.6),inset 0 -2px 0 rgba(40,4,12,.55),0 0 0 1px rgba(30,4,10,.9),0 14px 38px rgba(140,82,255,.42),0 0 70px rgba(200,40,70,.24);}
[data-qb=btn-danger]{background:linear-gradient(180deg,#3a120c,#1e0806) !important;box-shadow:inset 0 0 0 1px rgba(255,110,70,.55),0 0 18px rgba(255,90,54,.25);}
[data-qb=btn-danger]:hover{filter:brightness(1.12);transform:translateY(-1px);}
[data-qb=chip]{background:linear-gradient(180deg,rgba(51,40,53,.9),rgba(28,21,29,.92)) !important;box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 4px 12px rgba(0,0,0,.35);}
[data-qb=chip]:hover{border-color:rgba(190,150,255,.8) !important;box-shadow:0 0 18px rgba(224,74,92,.18),0 4px 12px rgba(0,0,0,.4);}
[data-qb=chip-hot]{background:linear-gradient(180deg,rgba(92,30,22,.92),rgba(48,14,11,.94)) !important;box-shadow:inset 0 1px 0 rgba(255,200,180,.12),0 4px 12px rgba(0,0,0,.4),0 0 18px rgba(200,65,47,.18);}
[data-qb=chip-hot]:hover{border-color:rgba(255,150,120,.9) !important;box-shadow:0 0 22px rgba(240,106,79,.35),0 4px 12px rgba(0,0,0,.4);}
/* Round HUD buttons with a tooltip on hover (desktop). */
[data-qb=hud-btn]{position:relative;background:radial-gradient(circle at 50% 30%,rgba(68,54,70,.95),rgba(23,17,24,.95) 70%) !important;box-shadow:inset 0 1px 0 rgba(255,255,255,.08),inset 0 0 0 1px rgba(0,0,0,.4),0 4px 12px rgba(0,0,0,.45);}
[data-qb=hud-btn]:hover{border-color:rgba(190,150,255,.9) !important;box-shadow:0 0 0 1px rgba(190,150,255,.15),0 0 20px rgba(224,74,92,.25),0 4px 12px rgba(0,0,0,.45);color:#eadaff;}
/* A pulsing glow is a still shadow on its own layer whose opacity rises and falls (qb-pulse-glow). */
[data-qb=hud-btn-hot]{position:relative;background:radial-gradient(circle at 50% 30%,rgba(120,40,30,.95),rgba(50,14,11,.95) 70%) !important;box-shadow:0 0 10px rgba(200,65,47,.3),0 4px 12px rgba(0,0,0,.45);}
[data-qb=hud-btn-hot]::before{content:"";position:absolute;inset:-1px;border-radius:inherit;box-shadow:0 0 22px rgba(240,106,79,.55);pointer-events:none;animation:qb-pulse-glow 2.4s ease-in-out infinite;}
@keyframes qb-pulse-glow{0%,100%{opacity:0;}50%{opacity:1;}}
@media (hover:hover) and (pointer:fine){
 [data-tip]:hover::after{content:attr(data-tip);position:absolute;top:calc(100% + 8px);left:50%;transform:translateX(-50%);white-space:nowrap;padding:5px 9px;border-radius:4px;border:1px solid rgba(178,34,58,.45);background:rgba(14,10,14,.96);color:#e8dbd5;font:600 11px/1.2 Inter,system-ui,sans-serif;letter-spacing:.4px;box-shadow:0 8px 20px rgba(0,0,0,.5);pointer-events:none;z-index:50;animation:qb-fade .15s ease both;}
}

/* Title-screen menu: engraved words that light up, with a lozenge marker and a crimson underline. */
[data-qb=menu-item]{position:relative;cursor:pointer;}
[data-qb=menu-item]::before{content:"";position:absolute;left:-20px;top:50%;width:9px;height:9px;margin-top:-5px;transform:rotate(45deg) scale(.4);opacity:0;background:linear-gradient(135deg,#eadaff,#7846dc);box-shadow:0 0 12px rgba(160,110,255,.85);transition:opacity .25s ease,transform .3s var(--qb-ease);}
[data-qb=menu-item]::after{content:"";position:absolute;left:0;bottom:4px;height:1px;width:100%;transform:scaleX(0);transform-origin:left;background:linear-gradient(90deg,rgba(224,74,92,.9),transparent);transition:transform .35s var(--qb-ease);}
[data-qb=menu-item]:hover::before,[data-qb=menu-item]:focus-visible::before{opacity:1;transform:rotate(45deg) scale(1);}
[data-qb=menu-item]:hover::after,[data-qb=menu-item]:focus-visible::after{transform:scaleX(1);}
[data-qb=menu-item]:hover [data-qb=menu-label],[data-qb=menu-item]:focus-visible [data-qb=menu-label]{color:#f5e6e0 !important;text-shadow:0 0 18px rgba(230,48,82,.55),0 0 2px rgba(255,214,224,.4);}
/* The menu's words sit on a painting: a soft dark edge keeps them readable over its light. */
[data-qb=menu-label]{text-shadow:0 2px 10px rgba(0,0,0,.95),0 0 3px rgba(0,0,0,.9);}
[data-qb=menu-icon]{color:#e04a5c;transition:color .2s ease,filter .2s ease;}
[data-qb=menu-icon][data-primary=on]{color:#eadaff;}
[data-qb=menu-item]:hover [data-qb=menu-icon],[data-qb=menu-item]:focus-visible [data-qb=menu-icon]{color:#eadaff !important;filter:drop-shadow(0 0 8px rgba(230,48,82,.7));}
[data-qb=menu-item][data-center=on]::before{display:none;}
[data-qb=menu-item][data-center=on]::after{transform-origin:center;background:linear-gradient(90deg,transparent,rgba(224,74,92,.9),transparent);}
[data-qb=menu-item][aria-disabled=true]{opacity:.45;cursor:default;}
/* The save slot on the title screen. */
[data-qb=slot]{position:relative;background:linear-gradient(160deg,rgba(41,32,42,.86),rgba(16,12,17,.9)) !important;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);
 box-shadow:inset 0 1px 0 rgba(255,214,224,.07),inset 0 0 0 1px rgba(0,0,0,.4),0 24px 60px rgba(0,0,0,.55),0 0 60px rgba(140,82,255,.06);}
[data-qb=slot]::before{content:"";position:absolute;inset:3px;pointer-events:none;opacity:.75;background:${corners.tl} top left/34px 34px no-repeat,${corners.tr} top right/34px 34px no-repeat,${corners.bl} bottom left/34px 34px no-repeat,${corners.br} bottom right/34px 34px no-repeat;}
[data-qb=region-paper]{background:radial-gradient(ellipse 90% 70% at 50% 45%,rgba(64,82,70,.35),transparent 70%),repeating-linear-gradient(0deg,rgba(224,74,92,.035) 0 1px,transparent 1px 28px),repeating-linear-gradient(90deg,rgba(224,74,92,.035) 0 1px,transparent 1px 28px),linear-gradient(180deg,#1a2423,#111816) !important;}
[data-qb=node-here]{box-shadow:0 0 0 4px rgba(158,27,50,.18),0 0 18px rgba(230,48,82,.55);animation:qb-beacon 2.6s ease-in-out infinite;}
@keyframes qb-beacon{0%,100%{opacity:.78;transform:scale(1);}50%{opacity:1;transform:scale(1.08);}}
/* The drawn region map: the sheet pans inside its frame when zoomed, with a quiet scrollbar; the marker where
   the hero stands breathes. */
[data-qb=map-scroll]{overflow:hidden !important;scrollbar-width:thin;scrollbar-color:rgba(59,42,23,.55) rgba(59,42,23,.12);overscroll-behavior:contain;touch-action:pan-x pan-y;}
[data-qb=map-scroll][data-zoomed=true]{overflow:auto !important;cursor:grab;}
[data-qb=map-frame]{box-shadow:0 10px 30px rgba(0,0,0,.5),inset 0 0 0 1px rgba(240,110,128,.12);}
[data-qb=map-here]{box-shadow:0 0 0 3px rgba(143,44,28,.22),0 0 16px rgba(143,44,28,.55);animation:qb-beacon 2.6s ease-in-out infinite;}
[data-qb=map-tool]{background:rgba(237,222,182,.92) !important;box-shadow:0 2px 8px rgba(40,10,15,.35);}
[data-qb=map-tool]:hover{background:#f6ebcb !important;}
@media (prefers-reduced-motion: reduce){[data-qb=map-here]{animation:none;}}
[data-qb=pip-good]{box-shadow:0 0 8px rgba(111,208,160,.6);}
[data-qb=pip-bad]{box-shadow:0 0 8px rgba(240,106,79,.65);}
@media (prefers-reduced-motion: reduce){[data-qb=node-here]{animation:none;}}
[data-qb=slot-shade]{background:linear-gradient(90deg,rgba(16,12,17,.92) 0%,rgba(16,12,17,.72) 55%,rgba(16,12,17,.45) 100%),linear-gradient(0deg,rgba(16,12,17,.85),transparent 60%) !important;}
[data-qb=slot]:hover{border-color:rgba(190,150,255,.8) !important;box-shadow:0 0 0 1px rgba(190,150,255,.12),0 24px 60px rgba(0,0,0,.6),0 0 50px rgba(224,74,92,.14);transform:translateY(-2px);}
/* Class crests: a crimson medallion around a line emblem. */
[data-qb=crest]{background:radial-gradient(circle at 50% 35%,#352735 0%,#181218 55%,#0b0a07 100%) !important;box-shadow:0 0 0 1px rgba(0,0,0,.85),0 0 0 3px rgba(40,14,18,.95),0 0 0 4px rgba(196,52,78,.85),inset 0 2px 6px rgba(255,214,224,.12),inset 0 -6px 12px rgba(0,0,0,.6),0 8px 22px rgba(0,0,0,.55),0 0 26px rgba(140,82,255,.18);}
[data-qb=crest] svg{filter:drop-shadow(0 0 6px rgba(230,48,82,.45));}
[data-qb=badge]{background:linear-gradient(180deg,#d8364f,#8a1529) !important;box-shadow:0 0 0 1px rgba(39,7,12,.9),0 2px 6px rgba(0,0,0,.6);}

/* Choice cards (story openings, heroes, map places). */
[data-qb=card]{background:linear-gradient(160deg,rgba(40,30,42,.9),rgba(20,14,21,.94)) !important;box-shadow:inset 0 1px 0 rgba(255,214,224,.05),0 10px 26px rgba(0,0,0,.4);}
[data-qb=card]:hover{transform:translateY(-2px);border-color:rgba(190,150,255,.7) !important;box-shadow:0 0 0 1px rgba(190,150,255,.12),0 16px 36px rgba(0,0,0,.5),0 0 34px rgba(224,74,92,.12);}
[data-qb=card][data-selected=true]{background:linear-gradient(160deg,rgba(52,28,86,.94),rgba(22,14,26,.96)) !important;box-shadow:0 0 0 1px rgba(190,150,255,.55),0 0 40px rgba(140,82,255,.26),inset 0 0 40px rgba(140,82,255,.08);}
[data-qb=card][data-tone=hot]{background:linear-gradient(160deg,rgba(52,22,18,.9),rgba(16,10,11,.94)) !important;}
[data-qb=card][data-tone=hot]:hover{border-color:rgba(255,150,120,.8) !important;box-shadow:0 16px 36px rgba(0,0,0,.5),0 0 34px rgba(240,106,79,.18);}
[data-qb=card][data-tone=hot][data-selected=true]{background:linear-gradient(160deg,rgba(80,28,20,.94),rgba(26,12,11,.96)) !important;box-shadow:0 0 0 1px rgba(255,160,130,.5),0 0 40px rgba(240,106,79,.28),inset 0 0 40px rgba(240,106,79,.08);}
/* Segmented tabs with a gold underline. */
[data-qb=seg]{background:rgba(10,7,11,.55) !important;box-shadow:inset 0 1px 3px rgba(0,0,0,.6);}
[data-qb=seg-on]{background:linear-gradient(180deg,rgba(66,36,108,.96),rgba(36,19,62,.96)) !important;box-shadow:inset 0 1px 0 rgba(220,200,255,.18),0 0 16px rgba(140,82,255,.22);}

/* Bars, rules, inputs and the story feed. */
[data-qb=bar]{box-shadow:inset 0 2px 4px rgba(0,0,0,.6);}
[data-qb=bar-hp]{background:linear-gradient(180deg,#9fe0b0,#4f9b6a 55%,#2f6b45) !important;box-shadow:0 0 12px rgba(111,191,142,.45);transition:width .6s var(--qb-ease);}
[data-qb=bar-enemy]{background:linear-gradient(180deg,#ff9a7c,#d2442e 55%,#7d1f14) !important;box-shadow:0 0 14px rgba(240,106,79,.5);transition:width .6s var(--qb-ease);}
[data-qb=bar-low]{background:linear-gradient(180deg,#ff8a70,#d2442e 55%,#7d1f14) !important;box-shadow:0 0 6px rgba(240,106,79,.4);transition:width .6s var(--qb-ease);}
[data-qb=bar-low]::before{content:"";position:absolute;inset:0;background:rgba(255,150,120,.32);box-shadow:0 0 18px rgba(240,106,79,.9);pointer-events:none;animation:qb-pulse-glow 1.1s ease-in-out infinite;}
[data-qb=bar-temp]{background:linear-gradient(180deg,#b6fff2,#48b4a6) !important;}
[data-qb=bar-gold]{background:linear-gradient(180deg,#f44f65,#a12435) !important;box-shadow:0 0 12px rgba(230,48,82,.5);transition:width .5s var(--qb-ease);}
/* The ghost of lost HP lingers briefly behind the bar, then drains. */
[data-qb=bar-ghost]{background:rgba(255,214,224,.55) !important;transition:width .9s cubic-bezier(.6,0,.4,1) .35s;}
[data-qb=bar] [data-qb^=bar-]::after{content:"";position:absolute;left:0;right:0;top:0;height:45%;background:linear-gradient(180deg,rgba(255,255,255,.35),transparent);pointer-events:none;}
[data-qb=rule-left]{background:linear-gradient(90deg,transparent,rgba(224,74,92,.7)) !important;}
[data-qb=rule-right]{background:linear-gradient(90deg,rgba(224,74,92,.7),transparent) !important;}
[data-qb=input]{box-shadow:inset 0 2px 10px rgba(0,0,0,.55);}
[data-qb=input]:focus{border-color:rgba(190,150,255,.9) !important;box-shadow:inset 0 2px 10px rgba(0,0,0,.55),0 0 0 3px rgba(176,140,245,.16),0 0 24px rgba(140,82,255,.14);outline:none !important;}
[data-qb=feed-player]{background:linear-gradient(270deg,rgba(116,82,190,.3),rgba(40,26,62,.2)) !important;}
[data-qb=feed-roll]{background:linear-gradient(90deg,rgba(224,74,92,.1),rgba(30,23,31,.25)) !important;}
[data-qb=feed-effect]{background:linear-gradient(90deg,rgba(111,208,196,.1),rgba(30,23,31,.2)) !important;}
[data-qb=feed-dialogue]{background:linear-gradient(90deg,rgba(145,45,58,.14),rgba(30,23,31,.2)) !important;}
[data-qb=feed-hurt]{background:linear-gradient(90deg,rgba(200,65,47,.2),rgba(30,23,31,.2)) !important;}
[data-qb=feed-crit]{background:linear-gradient(90deg,rgba(192,120,255,.22),rgba(30,23,31,.2)) !important;box-shadow:0 0 24px rgba(230,48,82,.18);}
/* Dice results: a die face showing the natural roll, and a stamped verdict. */
[data-qb=die-face]{background:radial-gradient(circle at 35% 28%,#554357,#2c202e 60%,#161017) !important;box-shadow:inset 0 1px 0 rgba(255,255,255,.14),inset 0 -3px 6px rgba(0,0,0,.5),0 3px 8px rgba(0,0,0,.5);}
[data-qb=die-face][data-nat=max]{background:radial-gradient(circle at 35% 28%,#f6edff,#b08cf5 52%,#5b34a8) !important;box-shadow:0 0 18px rgba(160,110,255,.8),inset 0 -3px 6px rgba(40,16,90,.5);}
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
[data-qb=portrait]{box-shadow:0 0 0 1px rgba(0,0,0,.8),0 0 0 4px rgba(20,10,12,.9),0 0 0 5px rgba(178,34,58,.6),0 14px 40px rgba(0,0,0,.6),0 0 40px rgba(140,82,255,.15);}
[data-qb=portrait-hot]{box-shadow:0 0 0 1px rgba(0,0,0,.8),0 0 0 4px rgba(24,10,8,.9),0 0 0 5px rgba(220,90,70,.7),0 14px 40px rgba(0,0,0,.6),0 0 40px rgba(200,65,47,.25);}
[data-qb=plate-shade]{background:linear-gradient(180deg,rgba(10,7,11,0) 30%,rgba(10,7,11,.55) 60%,rgba(10,7,11,.94) 100%) !important;}
[data-qb=foe-shade]{background:linear-gradient(180deg,rgba(12,6,6,0) 30%,rgba(12,6,6,.55) 58%,rgba(12,6,6,.96) 100%) !important;}
[data-qb=avatar]{box-shadow:0 0 0 2px rgba(178,34,58,.7),0 4px 10px rgba(0,0,0,.5);}
[data-qb=banner]{background:linear-gradient(90deg,transparent,rgba(120,24,16,.55) 20%,rgba(120,24,16,.55) 80%,transparent) !important;}
[data-qb=die]{background:radial-gradient(circle at 35% 30%,#d23a54,#7c1227 55%,#32070f) !important;box-shadow:inset 0 2px 0 rgba(255,255,255,.15),inset 0 -6px 14px rgba(0,0,0,.5),0 18px 40px rgba(0,0,0,.6),0 0 40px rgba(224,74,92,.25) !important;}
[data-qb=tray]{background:radial-gradient(ellipse at 50% 40%,rgba(64,34,96,.5),rgba(15,10,16,.88) 70%) !important;box-shadow:inset 0 0 60px rgba(0,0,0,.8),inset 0 0 0 1px rgba(178,34,58,.25);}

/* Cinematic moments: a red pulse when you are hurt, a violet flare on a critical, a sweeping round banner, and the
   victory and defeat title cards. All purely visual and never block input for long. */
[data-qb=flash-hurt]{background:radial-gradient(ellipse at 50% 50%,transparent 45%,rgba(200,30,20,.55) 100%) !important;animation:qb-flash .7s ease-out both;}
[data-qb=flash-crit]{background:radial-gradient(ellipse at 50% 50%,rgba(206,150,255,.28),transparent 60%) !important;animation:qb-flash .8s ease-out both;}
[data-qb=flash-heal]{background:radial-gradient(ellipse at 50% 60%,transparent 40%,rgba(111,191,142,.35) 100%) !important;animation:qb-flash 1s ease-out both;}
@keyframes qb-flash{0%{opacity:0;}15%{opacity:1;}100%{opacity:0;}}
[data-qb=shake]{animation:qb-shake .42s cubic-bezier(.36,.07,.19,.97) both;}
@keyframes qb-shake{10%,90%{transform:translate3d(-1px,0,0);}20%,80%{transform:translate3d(3px,0,0);}30%,50%,70%{transform:translate3d(-5px,1px,0);}40%,60%{transform:translate3d(5px,-1px,0);}}
[data-qb=cine-band]{background:linear-gradient(90deg,transparent,rgba(8,6,6,.93) 16%,rgba(8,6,6,.93) 84%,transparent) !important;animation:qb-band 1.9s var(--qb-ease) both;}
[data-qb=cine-band][data-tone=gold]{background:linear-gradient(90deg,transparent,rgba(24,8,11,.9) 18%,rgba(24,8,11,.9) 82%,transparent) !important;}
@keyframes qb-band{0%{opacity:0;transform:scaleY(.2);}14%{opacity:1;transform:scaleY(1);}80%{opacity:1;transform:scaleY(1);}100%{opacity:0;transform:scaleY(.6);}}
[data-qb=cine-text]{animation:qb-cinetext 1.9s var(--qb-ease) both;}
@keyframes qb-cinetext{0%{opacity:0;letter-spacing:.6em;}18%{opacity:1;letter-spacing:.28em;}80%{opacity:1;letter-spacing:.24em;}100%{opacity:0;letter-spacing:.2em;}}
[data-qb=cine-rule]{animation:qb-cinerule 1.9s var(--qb-ease) both;}
@keyframes qb-cinerule{0%{transform:scaleX(0);}25%{transform:scaleX(1);}100%{transform:scaleX(1);}}
[data-qb=finale]{animation:qb-fade .6s ease both;-webkit-backdrop-filter:blur(5px) saturate(.7);backdrop-filter:blur(5px) saturate(.7);}
[data-qb=finale-card]{animation:qb-finale 1s var(--qb-ease) .1s both;}
@keyframes qb-finale{from{opacity:0;transform:translate3d(0,24px,0) scale(.94);}to{opacity:1;transform:none;}}
[data-qb=finale-burst]{background:radial-gradient(circle at 50% 50%,rgba(201,140,255,.35),rgba(140,82,255,.08) 35%,transparent 65%) !important;animation:qb-burst 2.4s ease-out both;}
[data-qb=finale-burst][data-tone=dark]{background:radial-gradient(circle at 50% 50%,rgba(120,20,14,.35),rgba(20,4,4,.2) 40%,transparent 70%) !important;}
@keyframes qb-burst{0%{opacity:0;transform:scale(.3);}30%{opacity:1;}100%{opacity:.6;transform:scale(1.4);}}
[data-qb=area]{background:radial-gradient(ellipse 80% 46% at 50% 50%,rgba(5,4,5,.95),rgba(5,4,5,.82) 45%,rgba(5,4,5,.5) 80%,rgba(5,4,5,.3)) !important;-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);animation:qb-area 3.7s ease both;}
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
/* Waiting for a painting: a soft light sweeps across the frame. */
[data-qb=art-wait]{position:relative;overflow:hidden;background:#1a121b !important;}
[data-qb=art-wait]::after{content:"";position:absolute;inset:0;background:linear-gradient(100deg,transparent 30%,rgba(255,240,245,.07) 50%,transparent 70%);pointer-events:none;animation:qb-sweep 1.8s linear infinite;}
@keyframes qb-sweep{from{transform:translateX(-100%);}to{transform:translateX(100%);}}
/* Low HP: a red ring pulses around the hero's portrait. */
[data-qb=low-ring]{border-radius:50%;box-shadow:0 0 0 2px rgba(240,106,79,.35),0 0 8px rgba(240,106,79,.3);}
[data-qb=low-ring]::after{content:"";position:absolute;inset:0;border-radius:50%;box-shadow:0 0 0 3px rgba(240,106,79,.9),0 0 20px rgba(240,106,79,.7);pointer-events:none;animation:qb-pulse-glow 1.1s ease-in-out infinite;}
/* Your move: the main action breathes gently while the game waits for you in a fight (a violet light inside it). */
[data-qb=btn-primary][data-pulse=on]{box-shadow:inset 0 1px 0 rgba(255,200,210,.5),0 0 0 1px rgba(30,4,10,.9),0 4px 22px rgba(140,82,255,.45);}
[data-qb=btn-primary][data-pulse=on]::before{content:"";position:absolute;inset:0;border-radius:inherit;box-shadow:inset 0 0 16px rgba(190,140,255,.8);pointer-events:none;animation:qb-pulse-glow 2.2s ease-in-out infinite;}
[data-qb=rays-spin]{background:repeating-conic-gradient(from 0deg,rgba(206,150,255,.12) 0deg 4deg,transparent 4deg 18deg) !important;-webkit-mask-image:radial-gradient(circle,#000 10%,transparent 65%);mask-image:radial-gradient(circle,#000 10%,transparent 65%);animation:qb-spin 40s linear infinite;}
@keyframes qb-spin{to{transform:rotate(360deg);}}

/* Launch sequence. */
[data-qb=launch-glow]{background:radial-gradient(ellipse 60% 45% at 50% 42%,rgba(140,82,255,.22),transparent 70%),radial-gradient(ellipse 120% 80% at 50% 110%,rgba(72,35,115,.18),transparent 70%),#0a070b !important;animation:qb-candle 5s ease-in-out infinite;}
@keyframes qb-candle{0%,100%{opacity:.85;}45%{opacity:1;}70%{opacity:.9;}}
[data-qb=launch-ring]{box-shadow:0 0 0 1px rgba(0,0,0,.8),0 0 40px rgba(230,48,82,.35),inset 0 0 30px rgba(230,48,82,.18);background:radial-gradient(circle at 50% 40%,rgba(48,26,78,.55),rgba(14,10,14,.9) 70%) !important;}
/* The serpent turns the way its head faces, chasing its tail. */
[data-qb=serpent]{background:var(--qb-serpent) center/contain no-repeat;animation:qb-spin 120s linear infinite reverse;opacity:.95;}
[data-qb=launch-prompt]{animation:qb-pulse 2.2s ease-in-out infinite;}
@keyframes qb-pulse{0%,100%{opacity:.45;}50%{opacity:1;}}
/* Game HUD and phone tab bar: dark glass, always on top of the scene. They are almost opaque, so they carry no blur
   of the moving scene behind them (it was redrawn every frame for a difference no one could see). */
[data-qb=hud],[data-qb=tabbar]{box-shadow:0 8px 30px rgba(0,0,0,.45);}
[data-qb=hud]{background:linear-gradient(180deg,rgba(22,17,23,.96),rgba(14,10,14,.92)) !important;}
[data-qb=hud]::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:1px;background:linear-gradient(90deg,transparent,rgba(224,74,92,.75) 20%,rgba(224,74,92,.75) 80%,transparent);pointer-events:none;}
[data-qb=tabbar]{background:linear-gradient(180deg,rgba(16,12,17,.9),rgba(10,7,11,.97)) !important;}
[data-qb=tabbar]::before{content:"";position:absolute;left:0;right:0;top:-1px;height:1px;background:linear-gradient(90deg,transparent,rgba(224,74,92,.6) 20%,rgba(224,74,92,.6) 80%,transparent);pointer-events:none;}
[data-qb=tab-on]{background:radial-gradient(ellipse 60% 90% at 50% 0%,rgba(230,48,82,.22),transparent 70%) !important;}
[data-qb=emblem]{box-shadow:0 0 16px rgba(230,48,82,.35),inset 0 0 10px rgba(230,48,82,.2);}
[data-qb=key]{box-shadow:inset 0 -1px 0 rgba(0,0,0,.6),0 1px 0 rgba(255,255,255,.06);}
@media (hover:none){[data-qb=key]{display:none !important;}}
[data-qb=typing] [data-qb=dot]{animation:qb-typing 1.2s ease-in-out infinite;}
[data-qb=typing] [data-qb=dot]:nth-child(2){animation-delay:.15s;}
[data-qb=typing] [data-qb=dot]:nth-child(3){animation-delay:.3s;}
@keyframes qb-typing{0%,60%,100%{opacity:.25;transform:translateY(0);}30%{opacity:1;transform:translateY(-3px);}}
[data-qb=shimmer]{position:relative;overflow:hidden;background:rgba(224,74,92,.3) !important;}
[data-qb=shimmer]::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent 0%,rgba(255,214,224,.85) 50%,transparent 100%);pointer-events:none;animation:qb-sweep 1.6s linear infinite;}
/* Touch devices keep the light shafts still: the look stays, the battery is spared. */
@media (hover:none){[data-qb=rays]{animation:none !important;}}
/* Light atmosphere (Settings, Display, or chosen automatically on a computer that struggled to keep up): the same
   look, still. No grain or light shafts, the fog, embers and painting stay where they are, and the frosted panels
   become plain dark glass (a blur of the moving scene behind them was redrawn every frame). */
html[data-effects=light] [data-qb=grain],html[data-effects=light] [data-qb=rays]{display:none !important;}
html[data-effects=light] [data-qb=fog],html[data-effects=light] [data-qb=embers]::before,html[data-effects=light] [data-qb=embers]::after,html[data-effects=light] [data-qb=backdrop],html[data-effects=light] [data-qb=btn-primary]::after,html[data-effects=light] [data-qb=launch-glow],html[data-effects=light] [data-qb=serpent]{animation:none !important;}
html[data-effects=light] [data-qb=glass],html[data-effects=light] [data-qb=hud],html[data-effects=light] [data-qb=tabbar],html[data-effects=light] [data-qb=scrim],html[data-effects=light] [data-qb=slot],html[data-effects=light] [data-qb=area],html[data-effects=light] [data-qb=finale]{-webkit-backdrop-filter:none !important;backdrop-filter:none !important;}
html[data-effects=light] [data-qb=glass]{background:linear-gradient(180deg,rgba(29,22,30,.95),rgba(16,11,17,.96)) !important;}
html[data-effects=light] [data-qb=hud]{background:linear-gradient(180deg,rgba(22,17,23,.97),rgba(14,10,14,.95)) !important;}
html[data-effects=light] [data-qb=slot]{background:linear-gradient(160deg,rgba(41,32,42,.95),rgba(16,12,17,.96)) !important;}
/* While a full-screen card covers the game (a tale being written, a scene loading, the agreement, a victory), the
   scene behind it holds still. */
html[data-covered=on] [data-qb=stage] *,html[data-covered=on] [data-qb=stage] *::before,html[data-covered=on] [data-qb=stage] *::after{animation-play-state:paused !important;}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none !important;transition:none !important;}}
`);
export function initializeWebTheme(){
 if(typeof document==='undefined'||document.getElementById('questbound-theme'))return;
 // The typefaces come from this host (public/fonts); the page template requests them, and this is the fallback when it did not.
 if(!document.getElementById('qb-fonts')){const fontsLink=document.createElement('link');fontsLink.id='qb-fonts';fontsLink.rel='stylesheet';fontsLink.href='/fonts/fonts-v2.css';document.head.appendChild(fontsLink);}
 const style=document.createElement('style');style.id='questbound-theme';style.textContent=css;document.head.appendChild(style);
 document.querySelector('meta[name="theme-color"]')?.setAttribute('content','#0a070b');
 document.title='Questbound';
}
