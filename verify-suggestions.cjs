// The play screen's Suggestions and the Cast… slot organizer (2026-10-11, the host's words: "compress all npc pop ups
// appear underneath a "speak" tab. that tab itself within a "suggestions" tab that will contain all actions as well.
// we want this to be heavily player driven so we want the player to type most responses. this will be excluded during
// battle as the buttons being available helps the player to remember what they are able to do." and "under the
// "cast" option, separate the spells and cantrips, and make an organizer for what level each spell will be cast
// under."). Out of battle (inBattle) the chips fold into Suggestions: Say, Speak (speakAction: people, offers, a
// companion to revive) and Actions; in battle the buttons stay. castMenu groups cantrips and spell levels with their
// slots; each levelled chip's casts are every way to cast it now, named in the sentence so dmCommand reads it exactly
// as typed (and the campaign server accepts a friend's heal at a higher slot).
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {rulesSource}=require('./rules-files.cjs');
const source=rulesSource({extra:['descriptions.js']});
const r=vm.runInNewContext(source+'\n;({readyHero,readyHeroes,makeCharacter,blankBuild,spellLimits,spellsForClass,automaticSpells,subclassOptions,newAdventure,freshStoryGame,hostileEncounterGame,hostileFoes,adventureStep,commitDmTurn,combatBasics,dmChoices,dmCommand,quickActions,spellActions,castMenu,upcastGain,inBattle,speakAction,startParty,joinParty,partyView,npcScene,actionDescription,knownSpells})',{AsyncStorage:{},console});
const plain=v=>JSON.parse(JSON.stringify(v));
const pick=key=>()=>(r.hostileFoes.findIndex(f=>f.key===key)+.5)/r.hostileFoes.length;
const person=name=>({name,species:'Human',gender:'man',role:'A resident.',motive:'Wants the road safe.',appearance:'A weathered face under a wool hood, with a scar.',personality:'Plain.',ties:{other:'friend',foe:'enemy',note:'They share the refuge.'}});
const story={id:'suggest-1',status:'active',title:'The Notch',premise:'A pass is closed.',opening:'Snow at the gate.',objective:'Open the pass.',resolution:'The pass is open.',secret:'The warden sold it.',foe:'Kestrel of the Notch',foeSpecies:'Human',foeAppearance:'A lean swordsman in a grey cloak with a hawk mask.',foeDamageType:'Slashing',region:'Veyr',terrain:'mountains',
 locations:{inn:{name:'Bellwether Refuge',description:'A refuge.',kind:'settlement'},bridge:{name:'Redknife Notch',description:'A cut.',kind:'mountain'},tower:{name:'Shrine',description:'A shrine.',kind:'shrine'}},npcs:{keeper:person('Tamsin Rook'),mara:person('Rusk Hale')}};
// A hero of any level through the developer options, with the wanted spells first.
const ready=key=>r.readyHeroes.find(h=>h.key===key).form;
const dev=(form,level,want)=>{const sub=Object.keys(r.subclassOptions[form.class]??{})[0]??'',auto=r.automaticSpells({...form,level,plannedSubclass:sub}),limits=r.spellLimits({class:form.class,level}),list=r.spellsForClass(form.class,level).filter(s=>!auto.includes(s.id));
 const take=(pool,n)=>[...new Set([...want.filter(id=>pool.some(s=>s.id===id)),...pool.map(s=>s.id)])].slice(0,n),prepared=take(list.filter(s=>s.level>0),limits.prepared);
 return r.makeCharacter({...r.blankBuild(),...form,level,devLevel:level,advancements:[],plannedSubclass:sub,spells:[...take(list.filter(s=>s.level===0),limits.cantrips),...prepared],spellbook:limits.book?[...new Set([...prepared,...list.filter(s=>s.level>0).map(s=>s.id)])].slice(0,limits.book):[],spellSelectionVersion:2});};

// ---- Battle or not ----
{const kara=r.readyHero('fighter'),calm=r.freshStoryGame(kara,story,r.newAdventure(kara)),fight=r.hostileEncounterGame(kara,r.newAdventure(kara),pick('bandit'));
 assert.ok(!r.inBattle(calm)&&!r.inBattle({...calm,stage:'victory'})&&!r.inBattle({...calm,stage:'wild'}),'exploring is not battle');
 assert.ok(r.inBattle(fight)&&r.inBattle({...calm,stage:'dying'})&&r.inBattle({...calm,npcCombat:{active:true}})&&r.inBattle({...calm,turnOrder:{order:[],at:0,round:1}}),'a fight, dying, a brawl and a party turn order are battle');
 for(const k of ['join:mara','give-potion:mara','give-potion:party:B'])assert.ok(r.speakAction(k),k+' is about people');
 for(const k of ['travel-bridge','loot','short-rest','cast','attack-menu','level-up','dodge'])assert.ok(!r.speakAction(k),k+' is an action');
 // An offer to come along is one of the Speak chips; everything else stays an action.
 const here=r.npcScene(calm).filter(n=>n.present).map(n=>n.id),offered={...calm,joinOffers:{[here[0]]:{reason:'Wants to see the pass open.',terms:'A share.'}}};
 const quick=r.quickActions(kara,offered,{current:5,temp:0});
 assert.deepEqual(plain(quick.filter(a=>r.speakAction(a.key)).map(a=>a.key)),['join:'+here[0]],'the offer goes under Speak');
 assert.ok(quick.some(a=>a.key.startsWith('travel-'))&&quick.filter(a=>!r.speakAction(a.key)).every(a=>!/^join:/.test(a.key)),'travel and the rest stay in Actions');}

// ---- The Cast… picker: cantrips, then each level with its slots ----
const wiz=dev(ready('wizard'),5,['fire-bolt','ray-of-frost','shock','missile','burning-hands','detect-magic','scorching-ray','misty-step','fireball','hold-person']);
const calm={...r.freshStoryGame(wiz,story,r.newAdventure(wiz)),spellSlotsUsed:[1,0,0,0,0,0,0,0,0]};
{const menu=r.castMenu(wiz,calm),heads=menu.filter(a=>a.heading).map(a=>a.heading);
 assert.equal(heads[0],'Cantrips');assert.ok(heads.includes('Level 1 · 3 of 4 slots')&&heads.includes('Level 2 · 3 of 3 slots')&&heads.includes('Level 3 · 2 of 2 slots'),'each level says its slots left: '+heads);
 const levels=Object.fromEntries(r.knownSpells(wiz).map(s=>[s.id,s.level]));let at=-1;
 for(const a of menu){if(a.heading){at=a.heading==='Cantrips'?0:Number(a.heading.match(/^Level (\d)/)?.[1]??at);continue;}assert.equal(levels[a.spell],at,a.label+' sits under its own level');assert.ok(!/^(Level \d|Cantrip)/.test(a.detail??''),'the chip does not say its level again');}
 assert.equal(menu.filter(a=>!a.heading).length,r.spellActions(wiz,calm).length,'every spell chip is in the picker once');}
// The slot organizer: every way to cast, the lowest first (as a typed cast chooses), what a higher slot gains, slots left.
{const chips=r.spellActions(wiz,calm),of=id=>chips.find(c=>c.spell===id);
 const burn=of('burning-hands');assert.deepEqual(plain(burn.casts.map(c=>c.slot)),[1,2,3]);assert.ok(burn.casts[0].primary&&!burn.casts[1].primary,'the lowest is the default');
 assert.deepEqual(plain(burn.casts.map(c=>c.detail)),['3d6 fire · 3 left','4d6 fire · 3 left','5d6 fire · 2 left']);
 assert.deepEqual(plain(of('missile').casts.map(c=>c.detail.split(' · ')[0])),['3 darts','4 darts','5 darts']);
 assert.deepEqual(plain(of('hold-person').casts.map(c=>c.detail.split(' · ')[0])),['1 target','2 targets']);
 assert.deepEqual(plain(of('scorching-ray').casts.map(c=>c.detail.split(' · ')[0])),['3 rays','4 rays']);
 // A High Elf knows Detect Magic as a species spell from level 3: that free casting comes before the ritual.
 const sense=of('detect-magic'),free=/High Elf/.test(wiz.species)||wiz.lineage==='High Elf'?['species']:[];assert.deepEqual(plain(sense.casts.map(c=>c.slot)),[...free,'ritual',1,2,3],'a free casting, then a ritual, first out of a fight');assert.equal(sense.casts.find(c=>c.slot==='ritual').question,'I cast Detect Magic on me as a ritual.');
 assert.equal(of('fireball').casts.length,1,'one way only: the chip casts at once');
 assert.ok(chips.every(c=>!c.casts||c.casts.every(w=>w.slot==='ritual'||w.slot==='species'||w.slot==='arcanum'||w.slot>=r.knownSpells(wiz).find(s=>s.id===c.spell).level)),'never below the spell\'s level');
 // A prefilled sentence names the slot before the target; read back exactly.
 assert.equal(of('hold-person').casts[1].prefill,'I cast Hold Person at 3rd level on ');
 for(const c of chips)for(const w of c.casts??[]){
  const said=w.question??w.prefill+(/on $/.test(w.prefill)?'':'toward ')+'Tamsin Rook',cmd=r.dmCommand(wiz,calm,said);
  assert.ok(cmd?.action,said+': '+cmd?.error);assert.equal(cmd.action.request.slot,w.slot,said+' casts at the way chosen');
  assert.ok(!/generic/i.test(r.actionDescription(w,wiz,calm))&&r.actionDescription(w,wiz,calm).length>20,'the guide explains '+w.key);}}
// In a fight: no ritual, the chosen slot reaches the rules, and every way resolves through the engine and the DM commit.
{const fight={...r.hostileEncounterGame(wiz,r.newAdventure(wiz),pick('bandit')),enemyHP:300},chips=r.spellActions(wiz,fight);let n=0;
 assert.ok(chips.every(c=>!(c.casts??[]).some(w=>w.slot==='ritual')),'no ritual in a fight');
 for(const c of chips)for(const w of c.casts??[]){if(!w.question)continue;const cmd=r.dmCommand(wiz,fight,w.question);assert.equal(cmd?.action?.request?.slot,w.slot,w.question);
  const s=r.adventureStep(fight,null,wiz,cmd.action,()=>.5);assert.equal(s.error,undefined,w.question+': '+s.error);
  if(typeof w.slot==='number'&&!s.waiting)assert.equal(s.game.spellSlotsUsed?.[w.slot-1],1,w.question+' spends that slot');
  const c2=r.commitDmTurn(wiz,fight,null,cmd.action,{question:w.question,narration:'It is done.'},()=>.5);assert.equal(c2.error,undefined,w.question+' commits: '+c2.error);n++;}
 assert.ok(n>=8,'the fight offers ways to cast: '+n);
 // A slot already spent this turn leaves no slot to choose.
 const spent={...fight,slotSpentThisTurn:true};assert.ok(r.spellActions(wiz,spent).every(c=>!(c.casts??[]).some(w=>typeof w.slot==='number')),'one slot a turn');}
// A Warlock's pact slots: one level, said once, and the chip says it casts there.
{const lock=dev({...ready('wizard'),name:'Vesper Ash',class:'Warlock',spells:[],spellbook:[]},5,['eldritch-blast','minor-illusion','hex','hold-person','misty-step','fly']),g=r.freshStoryGame(lock,story,r.newAdventure(lock));
 const menu=r.castMenu(lock,g),heads=menu.filter(a=>a.heading).map(a=>a.heading);
 assert.ok(heads.includes('Pact slots · level 3 · 2 of 2')&&heads.includes('Level 1')&&!heads.some(h=>/^Level \d · /.test(h)),'pact slots are named once: '+heads);
 const hex=menu.find(a=>a.spell==='hex');assert.equal(hex.casts.length,1);assert.equal(hex.casts[0].slot,3);assert.match(hex.detail,/at level 3/);}
// A free casting from the hero's people comes first and is labelled so.
{const drow=dev({...ready('wizard'),species:'Dark Elf',lineage:'Drow'},5,['fire-bolt','missile']),g=r.freshStoryGame(drow,story,r.newAdventure(drow));
 const fire=r.spellActions(drow,g).find(c=>c.spell==='faerie-fire');assert.ok(fire,'a Drow knows Faerie Fire');
 assert.equal(fire.casts[0].slot,'species');assert.equal(fire.casts[0].label,'Free');assert.ok(fire.casts.slice(1).every(w=>typeof w.slot==='number'));
 assert.equal(r.dmCommand(drow,g,fire.casts[0].prefill+'Tamsin Rook').action.request.slot,'species');}
// A friend's heal at a higher slot carries its own action, which the campaign server accepts from the casts it offers.
{const cleric=dev(ready('cleric'),3,['sacred-flame','guidance','cure','healing-word']),kara=r.readyHero('fighter');
 let snap=r.startParty({version:1,character:JSON.stringify(cleric),game:r.newAdventure(cleric),health:{current:r.combatBasics(cleric).hp,temp:0},chosen:true},'A','Sam');
 snap=r.joinParty(snap,'B',{character:JSON.stringify(kara),game:null,health:null,name:'PB'}).snapshot;
 const table=plain(r.partyView(snap,'A'));table.game.party.members.B={...table.game.party.members.B,health:{current:3,temp:0}};
 const v=r.partyView(table,'A'),chip=r.spellActions(cleric,v.game).find(c=>c.key==='spell:cure:party:B');
 assert.ok(chip&&chip.casts.length===2,'Cure Wounds on Kara at level 1 or 2');
 const up=chip.casts[1];assert.equal(up.question,'I cast Cure Wounds on '+kara.name+' using a 2nd-level slot.');assert.equal(up.action.request.partyTarget,'B');assert.equal(up.action.request.slot,2);
 const offered=r.spellActions(cleric,v.game).flatMap(c=>[c,...(c.casts??[])]);assert.ok(offered.some(c=>JSON.stringify(c.action)===JSON.stringify(up.action)),'offered as the server lists it');
 const s=r.adventureStep(v.game,v.health,cleric,up.action,()=>.5);assert.equal(s.error,undefined,s.error);assert.ok(s.game.party.members.B.health.current>3,'Kara is healed');
 assert.ok(fs.readFileSync('server-turn.cjs','utf8').includes('...r.spellActions(ruled,game).flatMap(c=>[c,...(c.casts??[])])'),'the campaign server accepts a chosen slot');}

// ---- The screen (DungeonMaster.js) ----
{const dm=['DungeonMaster.js','DmSuggestions.js'].map(f=>fs.readFileSync(f,'utf8')).join(' '),guide=fs.readFileSync('ActionGuide.js','utf8');
 assert.ok(dm.includes("const panelKey='questbound.suggestions.v1'")&&dm.includes('return {open:v?.open===true,')&&dm.includes('const [panel,setPanel]=useState(loadPanel)'),'Suggestions starts closed and is remembered per device');
 assert.ok(dm.includes('const battle=inBattle(game)||!!turnsNow;')&&dm.includes('const actionBar=battle?battleBar:calmBar;'),'buttons in battle, Suggestions otherwise');
 assert.ok(/dataSet=\{\{qb:panel\.open\?'seg-on':'chip',keepfocus:'true',suggest:'toggle'\}\}/.test(dm)&&/keepfocus:'true',suggest:id\}\}/.test(dm),'the switch and the sub-tabs keep the keyboard up');
 assert.ok(dm.includes('{!typing&&actionBar}'),'they step aside while typing on a phone');
 assert.ok(dm.includes("const ideaLines=direct||dead||dying||!!turnWait||!!waiting?[]:"),'no lines to say out of character, dying, dead or on another\'s turn');
 assert.ok(dm.includes(":!panel.open?[]:shownTab==='say'?"),'number keys press only what is in view (nothing while Suggestions is closed)');
 assert.ok(dm.includes("onPress={()=>{if(on)return;playSound('click');savePanel({...panel,tab:id});}}")&&!/setPanel\(\{[^}]*tab:/.test(dm),'a sub-tab changes only when the player picks it');
 assert.ok(dm.includes("if(a.casts?.length>1){setCastSpell(a.key);return;}")&&dm.includes("key:'cast-back'"),'a spell with a choice opens the organizer');
 assert.ok(guide.includes("a.key!=='cast-back'")&&guide.includes("a.casts?.length>1?'Choose'"),'the guide skips Back and says Choose');}
console.log('Suggestions and slots: out of battle Say, Speak (people, offers, revivals) and Actions fold into one switch, remembered per device; in battle the buttons stay. Cast… groups cantrips and each spell level with its slots (a Warlock\'s pact slots once), and the slot organizer offers every way to cast (lowest first, ritual and free castings, what a higher slot gains), each read back by dmCommand at the slot chosen, resolved through the engine and the DM commit, and accepted at a shared table.');
