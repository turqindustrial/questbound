import {packOf} from './inventoryRules';
import {questState} from './storyRules';
import {deedById} from './deedRules';
// The tale card: what a player shares about their hero, worked out from the save alone (hero, story log, deeds, pack,
// places and people). taleSummary gives the pieces; taleText the plain words that go with the picture or to the
// clipboard; wrapWords breaks a line to a width for the painted card (taleCard.js draws it).
const shorten=(text,max)=>{const t=String(text??'').replace(/\s+/g,' ').trim();return t.length>max?t.slice(0,max-1).trimEnd()+'…':t;};
export function taleSummary(game,hero,{lines=6}={}){
 const log=Array.isArray(game?.storyLog)?game.storyLog:[],quest=game?questState(game):null,story=game?.story??null;
 const recent=log.filter(e=>e.kind!=='story').slice(-lines).map(e=>shorten(e.text,110));
 const deeds=(game?.deeds??[]).map(d=>deedById(d.id)).filter(Boolean).map(d=>({id:d.id,title:d.title,icon:d.icon,line:d.line}));
 const fights=log.filter(e=>e.kind==='fight').length,won=log.filter(e=>e.kind==='victory').length;
 const people=log.filter(e=>e.kind==='person'&&/^Met /.test(e.text)).length+2*Number(!!story);
 const places=new Set(game?.map?.visited??[]).size;
 const gold=game&&hero?packOf(game,hero).gold:0;
 const chapter=quest?.current&&story?.status!=='complete'?'Chapter '+quest.number+' of '+quest.chapters:story?.status==='complete'?'The tale is told':null;
 const name=hero?.name??'A hero',heroLine=hero?['Level '+(hero.level??1),hero.species??hero.race,hero.class].filter(Boolean).join(' · '):'';
 const title=story?.title??'The Lantern at the Crossroads',dead=game?.stage==='dead';
 return {name,heroLine,title,chapter,dead,cause:dead?shorten(game.death?.cause??'',100):null,lines:recent,deeds,stats:{places,people,fights,won,gold}};
}
export function taleText(summary,{origin=null}={}){
 const s=summary,parts=[];
 parts.push(s.name+(s.heroLine?', '+s.heroLine.toLowerCase().replace(/^level/,'level'):'')+' — “'+s.title+'”'+(s.chapter?' ('+s.chapter.toLowerCase()+')':'')+'.');
 if(s.dead)parts.push('Here lies '+s.name+(s.cause?': '+s.cause:'')+'.');
 if(s.lines.length)parts.push('The story so far:\n'+s.lines.map(l=>'• '+l).join('\n'));
 if(s.deeds.length)parts.push('Deeds: '+s.deeds.map(d=>d.title).join(', ')+'.');
 parts.push(s.stats.places+' places, '+s.stats.people+' people met, '+s.stats.won+' of '+s.stats.fights+' fights won, '+s.stats.gold+' gold.');
 parts.push('Played in Questbound, a tabletop adventure with an AI Dungeon Master.'+(origin?' '+origin:''));
 return parts.join('\n\n');
}
// Breaks words into lines no wider than `max`, measured by `width(text)` (a canvas's measureText, or a letter count).
export function wrapWords(text,max,width=t=>t.length){
 const words=String(text??'').split(/\s+/).filter(Boolean),out=[];let line='';
 for(const word of words){
  const trial=line?line+' '+word:word;
  if(width(trial)<=max||!line)line=trial;else{out.push(line);line=word;}
 }
 if(line)out.push(line);
 return out;
}
