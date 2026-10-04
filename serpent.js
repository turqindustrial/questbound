// A serpent biting its tail (an ouroboros) turns slowly around the launch emblem and the story seal: scales, a head
// with a violet eye, its jaws on the tail tip. Questbound's own drawing. Pure: it returns SVG markup written in the Red
// theme's colours, which webTheme.js repaints for the chosen theme (themedText). serpentMarkup({detail:false}) is the
// plain silhouette the boot card in public/index.html uses as a mask (written there by `node verify-theme.cjs --write`).
export function serpentMarkup({detail=true}={}){
 // The ring's centre line (radius R) runs clockwise from the neck to the tail tip, which lies between the open jaws.
 const R=82,NECK=14,TAIL=354,d=Math.PI/180,f=n=>n.toFixed(1);
 const at=(a,r)=>f(100+r*Math.sin(a*d))+' '+f(100-r*Math.cos(a*d));
 // A slow swell along the body, gone near the head and tail, so the ring reads as a living thing, not a hoop.
 const wave=a=>.9*Math.sin((a-NECK)*d*3)*Math.min(1,(a-NECK)/40)*Math.min(1,(TAIL-a)/60);
 // Half the body's width: a slim neck, a full belly, then a long taper to the tail tip.
 const half=a=>{const t=(a-NECK)/(TAIL-NECK);return t<.08?5.6+2.2*t/.08:t<.55?7.8:Math.max(.7,7.8*Math.pow(1-(t-.55)/.45,.9));};
 const steps=[...Array(121)].map((_,i)=>NECK+(TAIL-NECK)*i/120),mid=a=>R+wave(a);
 const body='M'+steps.map(a=>at(a,mid(a)+half(a))).join('L')+'L'+steps.slice().reverse().map(a=>at(a,mid(a)-half(a))).join('L')+'Z';
 // The head lies along the ring ahead of the neck (x forward, y outward from the ring's centre); its jaws open on the tail.
 const head=(x,y)=>at(NECK-x/R/d,R+y);
 const skull='M'+[[-2,5.8],[3,8.6],[10,9.8],[18,8.6],[25,5.6],[31,2.2],[18,.4],[30,-2.4],[25,-5.4],[17,-8],[9,-9],[3,-7.6],[-2,-5.8]].map(([x,y])=>head(x,y)).join('L')+'Z';
 // Scales: two staggered rows of small arcs along the back and the flank.
 let scales='';if(detail)for(let a=NECK+4,k=0;a<TAIL-14;a+=4,k++){const h=half(a),c=mid(a),s=Math.min(1,h/7.8);if(h<2)continue;
  for(const [row,shift] of [[.42,0],[-.42,2]]){const o=a+(k%2?shift:2-shift),r=c+h*row,w=h*.38;scales+='M'+at(o,r+w)+'Q'+at(o+2.4*s,r)+' '+at(o,r-w);}}
 const ridge='M'+steps.filter(a=>a<TAIL-24).map(a=>at(a,mid(a)+half(a)*.5)).join('L'),belly='M'+steps.filter(a=>a<TAIL-30).map(a=>at(a,mid(a)-half(a)*.62)).join('L');
 const [ex,ey]=head(12.5,4.4).split(' ');
 return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><path d='${body}' fill='#a51a33' stroke='#e04a5c' stroke-width='.8' stroke-opacity='.85'/>`+
  (detail?`<path d='${belly}' fill='none' stroke='#5e0d1e' stroke-width='2.2' stroke-opacity='.55'/><path d='${ridge}' fill='none' stroke='#ff6078' stroke-width='1.1' stroke-opacity='.5'/><path d='${scales}' fill='none' stroke='#5e0d1e' stroke-width='.65' stroke-opacity='.85'/>`:'')+
  `<path d='${skull}' fill='#b2223a' stroke='#e04a5c' stroke-width='.9'/>`+
  (detail?`<path d='M${head(8,7)}Q${head(12.5,8.2)} ${head(17,6.8)}' fill='none' stroke='#5e0d1e' stroke-width='.9'/><path d='M${head(4,-3)}L${head(22,-1.6)}' fill='none' stroke='#5e0d1e' stroke-width='.6' stroke-opacity='.7'/>`:'')+
  `<circle cx='${ex}' cy='${ey}' r='1.9' fill='#be96ff'/><path d='M${head(12.5,5.8)}L${head(12.5,3)}' stroke='#0a070b' stroke-width='.6'/></svg>`;
}
