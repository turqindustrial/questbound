import {encounterFoe,foeStanding} from './adventureRules';
import {spellLibrary} from './spellOptions';
import {npcScene,npcLore} from './npcRules';
import {combatBasics} from './combatRules';
import {gearedHero} from './inventoryRules';
import {storyText} from './storyRules';
import {creatureNature} from "./spellDamageRules";

// Routine fight moves told by the game itself (the host, 2026-10-17: "Let the game narrate routine fight moves: a plain
// attack, Dodge or 'end my turn' currently asks the AI to describe it, even though the dice cards already show what
// happened. The game could write those itself and call the AI only for a fight's start, kills, critical hits and every
// few rounds." and "make sure 3 has plenty of dialogue options to pick from.").
// `routineFightTurn` decides whether a fight move needs the Dungeon Master; `fightTelling` writes the telling from the
// engine's results in the narrator's voice, with short spoken lines for those who fight. Lines describe, never count:
// the feed's cards carry the dice. `routineTelling` is the one call a device (DungeonMaster.js) and the campaign
// server (server-turn.cjs) make. Everything is seeded from the turn, so every device and the server agree.

// ---------- The line book ----------
// {foe}/{Foe}: the one being fought (with its article, or a person's name), {foes}/{Foes}: a band, {weapon}: the
// weapon's plain name, {spell}: the spell or item, {name}: a friend or another hero. A line opening with '!' is grittier
// and is left out when the player chose Restrained.
export const fightLineBook={
 chronicler:{
  swing:{
   blade:['You step in and cut low.','Your blade flashes out in a short, clean line.','You feint high and bring the edge down.','You close the gap and thrust.','You draw the {weapon} across in a quick arc.','You turn your wrist and slash.','You lunge, point first.','You test the guard, then commit to the cut.'],
   axe:['You heave the {weapon} up and bring it down.','You swing the axe in a wide, heavy arc.','You chop downward with your whole weight.','You hook the axe low, aiming for the legs.','You set your feet and hew.','The {weapon} rises and falls.','You drive the axe-head in at an angle.','You swing the axe from the shoulder.'],
   blunt:['You bring the {weapon} down hard.','You swing for the shoulder with all the weight you have.','You step through and swing in a short, brutal arc.','You drive the {weapon} forward like a ram.','You raise the {weapon} and let it fall.','You swing low and heavy.','You put your hips into a crushing swing.','You lash out with the {weapon}.'],
   spear:['You thrust the {weapon} forward from the hip.','You keep the point low and drive it in.','You feint with the shaft, then drive the point in.','You set your feet and lunge with the long reach of the {weapon}.','You spin the shaft and lead with the point.','You strike from just beyond reach.','You thrust high, aiming over the guard.','You drive the point forward with both hands.'],
   bow:['You draw, breathe, and loose.','You sight along the shaft and let it fly.','You take careful aim and release.','Your arrow leaves with a soft hiss.','You let fly between one heartbeat and the next.','You line up the shot and send it.','You draw the string back to your cheek and loose.','You hold your breath, and shoot.'],
   thrown:['You hurl the {weapon}.','You throw the {weapon} from the shoulder, smooth and quick.','You send the {weapon} spinning through the air.','You weigh the {weapon} in your hand, then throw.','You snap your arm forward and let the {weapon} go.','You throw hard and low.','The {weapon} leaves your hand in a flat, fast line.','You pick your moment and throw.'],
   unarmed:['You step in and drive a fist forward.','You lash out with an open hand.','You throw your shoulder into a short, sharp blow.','You duck low and strike up from the hip.','You snap a kick at the knee.','You close in, elbow first.','You strike with the heel of your palm.','You twist and drive your knee upward.'],
   magic:['The {weapon} hums faintly as you swing.','Old enchantment glimmers along the {weapon} as you strike.','You strike, and the {weapon} leaves a thin trail of light.','The {weapon} feels eager in your grip as you attack.','A faint glow runs along the {weapon} as it moves.','You swing, and the magic in the {weapon} wakes.','The {weapon} moves almost before you ask it to.','You bring the {weapon} in, its edge bright with old work.'],
  },
  offhand:['Your other hand follows with the {weapon}.','You turn the motion and strike with the {weapon} in your off hand.','The second blade comes in close behind the first.','You lead with one hand and finish with the other.','Your off hand darts in with the {weapon}.','You fold in a quick strike with the {weapon}.','Before the first blow is done, the next is on its way.','You twist and bring the {weapon} in low from the other side.'],
  land:{
   scratch:['It catches {foe} only a glancing blow.','It opens a shallow cut on {foe}.','{Foe} twists away, but not quite far enough.','The blow lands lightly; {foe} barely notices.','It nicks {foe} and no more.','It skims {foe}, enough to sting.'],
   solid:['It lands squarely, and {foe} gives ground.','The blow tells: {foe} staggers a step.','It strikes home, and {foe} lets out a sound of pain.','{Foe} takes it hard and steadies with effort.','It lands well; {foe} is slower to answer.','A clean strike. {Foe} feels it.'],
   heavy:['It lands with real weight, and {foe} reels.','{Foe} is driven back, badly hurt.','The force of it nearly takes {foe} off balance.','It is a heavy blow, and {foe} sways under it.','{Foe} reels, and for a moment the whole fight hangs on it.','A brutal strike; {foe} will not take many more like it.','!It bites deep, and {foe} bleeds freely.','!Something gives under the blow with a wet sound.'],
  },
  miss:['{Foe} slips aside, and the strike meets air.','It is turned at the last moment.','{Foe} is not there when the blow arrives.','The strike goes wide.','{Foe} blocks it.','It falls short by a hand\'s breadth.','{Foe} reads it early and steps clear.','Nothing. {Foe} has already moved.'],
  graze:['It does not land clean, but the edge still finds {foe}.','{Foe} turns it aside, though not without a mark.','A poor strike, yet it still leaves {foe} the worse for it.','Off line, but close enough to bite.','It catches only the edge of {foe}, and that is something.','Not the blow you wanted, but {foe} still feels it.'],
  again:{
   hit:['You follow through, and the next blow lands too.','Your next strike finds its mark.','You press on, and it tells.','Again, and again it lands.','The follow-up catches {foe} still recovering.','You strike once more, and true.'],
   miss:['Your follow-up goes wide.','The next blow is turned aside.','You press on, but {foe} is ready for it.','The next strike finds nothing.','Your next attempt is a hair too slow.','{Foe} sees the next blow coming.'],
  },
  spell:{
   hit:['You speak the words, and {spell} strikes {foe}.','Your {spell} finds {foe} and takes hold.','The air bends, and {spell} lands true.','{spell} answers your call and finds its mark.','You shape the spell with care; {spell} reaches {foe}.','Power gathers at your fingertips and goes where you send it.','{Foe} cannot escape your {spell}.','The spell leaves you in a breath and lands on {foe}.','Your {spell} hits home.','You cast {spell}, and {foe} feels it.','The words are barely out before {spell} strikes.','Magic flares, and {foe} recoils from it.'],
   miss:['Your {spell} flies, but {foe} is no longer there.','{Foe} shrugs off your {spell}.','The spell takes shape and slips past its mark.','{spell} goes astray.','{Foe} weathers the {spell} without harm.','The magic falters short of {foe}.','You cast {spell}; {foe} twists clear of it.','Your spell breaks against {foe} and fades.','{spell} leaves you, and lands on empty ground.','{Foe} resists the pull of the spell.','The working comes apart before it reaches {foe}.','Close, but {spell} finds no purchase.'],
  },
  dodge:['You give ground and keep your guard high.','You shift your weight and watch every move {foe} makes.','You stay light on your feet, ready to slip away.','You fall into a defensive stance.','You make yourself a hard thing to hit.','You weave, never still for a moment.','You keep your distance and your eyes open.','You crouch behind your guard and wait for the next blow.','You draw back half a step and read the fight.','You turn side-on and give {foe} as little to strike as you can.','You trade the chance to strike for the chance to see it coming.','You keep moving, patient and watchful.'],
  end:['You hold your place and wait.','You steady your breathing and let the moment pass.','You keep your ground and your guard.','You wait for {foe} to show you something.','You let {foe} come to you.','You reset your stance.','You take a breath while you can.','You keep your eyes on {foe} and do nothing rash.','You stay where you are, ready.','You let the moment go by, watching.','You hold, and the fight passes to {foe}.','You give nothing away and wait.'],
  draught:['You pull the stopper with your teeth and drink.','You down a healing draught, and warmth spreads through you.','The draught is bitter, but strength follows it.','You drink quickly, eyes never leaving {foe}.','You swallow the draught, and the worst of the pain eases.','Warmth floods your chest as the draught takes hold.','You drink, and your breathing steadies.','You empty the little bottle in one swallow.','The draught burns going down, then soothes.','You snatch a moment to drink, and feel the better for it.','A healing draught, gone in a gulp; your wounds knit a little.','You drink, and the trembling in your hands stills.'],
  wind:['You set your jaw and find a reserve you did not know you had.','You draw a deep breath, and strength returns to your limbs.','Old training takes over: you steady yourself and push on.','You shake off the pain by sheer will.','You breathe through it, and the worst passes.','You grit your teeth, and the fight comes back into you.','A fresh surge of strength steadies your stance.','You remember every hard lesson, and stand straighter for it.','Your body answers when you ask more of it.','You force the ache aside and lift your guard.','You gather yourself, and the world sharpens again.','Stubbornness, more than anything, keeps you standing.'],
  surge:['You push yourself beyond tired, and move again at once.','A burst of fierce energy carries you on.','You find a little more speed, and use it.','You refuse to slow down.','Something in you catches fire, and you press the attack.','You move before {foe} can recover.','You draw on everything you have.','Your training drives you forward without pause.','You do not wait for the moment to pass; you make another.','A rush of strength carries you into the next move.','You surge forward, faster than you have any right to be.','You spend your reserves all at once.'],
  knack:['You call on your training, and it answers.','You draw on what you have learned, quick and sure.','A practised move, made without thinking.','You use the moment as only you know how.','You lean on your craft.','The knack of long practice serves you here.','You make the most of a half-moment.','Your discipline holds, and you act on it.','You find the opening your training taught you to look for.','You do what you were trained to do.','Instinct and practice move together.','You turn your skill to the fight.'],
  saveUp:['Somewhere far off, you hold on.','Your heart stumbles, then beats again.','You cling to the edge of waking.','A thread of breath, still there.','The dark does not take you yet.','You hold on, though you could not say how.','Something stubborn in you refuses to let go.','Your breathing is shallow, but it does not stop.','You are still here.','A flicker of warmth, and you hold.','Not yet. You are not done yet.','The cold creeps closer, and you push it back.'],
  saveDown:['The dark draws a little closer.','Your breathing falters.','You slip further from the light.','The cold settles deeper into you.','Your heartbeat grows faint.','Something in you lets go a little.','The world grows quieter.','Your grip on waking loosens.','You drift, and it is harder to come back.','A long silence, and then a weaker breath.','The edges of everything blur.','You sink a little deeper.'],
  foeMove:{
   beast:['{Foe} springs at you, snarling.','{Foe} lunges, all teeth and fury.','{Foe} circles once, then rushes in.','{Foe} hurls itself at you.','{Foe} darts in low and fast.','With a savage sound, {foe} attacks.'],
   undead:['{Foe} lurches forward with dreadful patience.','{Foe} reaches for you with cold hands.','{Foe} comes on without a sound.','{Foe} strikes, heedless of its wounds.','{Foe} sways closer and swings.','{Foe} answers with a jerking, graceless strike.'],
   person:['{Foe} comes at you hard.','{Foe} feints, then strikes.','{Foe} steps in with a quick, mean cut.','{Foe} swings back, teeth bared.','{Foe} presses forward, looking for a gap.','{Foe} answers in kind.'],
   monster:['{Foe} strikes with terrible weight.','{Foe} lashes out.','{Foe} looms over you and attacks.','{Foe} roars and comes for you.','{Foe} heaves itself forward.','{Foe} answers with brute strength.'],
   band:['{Foes} press in from every side.','{Foes} close around you.','{Foes} come at you together.','{Foes} jostle for a chance at you.','{Foes} rush in, one after another.','{Foes} try to surround you.'],
  },
  foeHit:{
   scratch:['The blow catches you, though only lightly.','It stings, nothing worse.','You take a shallow cut and keep your feet.','It glances off you, leaving a small hurt.','You feel it, but only just.'],
   solid:['The blow lands, and you feel it.','It catches you hard enough to jar your teeth.','You take it on the shoulder and stagger.','Pain flares where it strikes.','It gets through your guard.'],
   heavy:['The blow lands with frightening force.','It hits you hard, and the world swims for a moment.','You are driven back, badly hurt.','It strikes deep, and you have to fight to stay upright.','That one hurts, more than you would like.','!Blood runs freely from where it struck.'],
  },
  foeMiss:['You turn it aside.','It whistles past you.','You slip out of its path.','Your guard holds.','It finds nothing but air.','You are already gone when it arrives.','It glances off harmlessly.','You step back, and it falls short.'],
  press:{
   hit:['Another gets a blow in while you are busy.','One more finds a way past your guard.','From the side, another strikes you.','You cannot watch them all; another lands a blow.','Another blow comes from behind.','The rest are not idle, and one of them connects.'],
   miss:['The others come close, but you keep them off.','Another tries, and fails.','You keep the rest at bay.','The others snap at you without effect.','You twist free of the rest.','The others cannot find a way in.'],
  },
  other:{
   hit:['{Foe} turns on {name} and lands a blow.','{name} takes a blow from {foe}.','{Foe} catches {name} with a hard strike.','{name} is struck, but keeps standing.','{Foe} gets past the guard of {name}.','{name} staggers under the attack.','{Foe} strikes {name}.','{name} grunts as the blow lands.','{Foe} wounds {name}.','{name} gives ground before {foe}, hurt.','{Foe} lands a blow on {name}.','{name} is hit and steadies with effort.'],
   miss:['{Foe} strikes at {name}, who turns it aside.','{name} slips clear of {foe}.','{Foe} misses {name} by a hair.','{name} is ready for {foe}.','The blow goes past {name}.','{name} keeps out of reach.','{name} blocks the attack.','{Foe} goes for {name} and finds nothing.','{name} steps back, and the blow falls short.','{name} parries {foe}.','The attack glances off {name}.','{name} weathers the attack untouched.'],
  },
  ally:{
   hit:['{name} strikes at {foe} and lands a blow.','{name} finds an opening and takes it.','{name} hits {foe} from the side.','{name} joins in, and the blow tells.','{name} lands a quick strike on {foe}.','With a shout, {name} hits {foe}.','{name} catches {foe} off guard.','{name} strikes true.','{name} drives in beside you and hits.','{name} makes {foe} pay for looking away.','The blow from {name} lands cleanly.','{name} is there at the right moment, and strikes.'],
   miss:['{name} swings at {foe}, but misses.','The strike from {name} goes wide.','{name} lunges and finds nothing.','{Foe} turns the blow from {name} aside.','{name} tries for an opening that is not there.','{name} strikes, a moment too late.','The attack from {name} is blocked.','{name} cannot get past the guard of {foe}.','{name} hangs back, looking for a chance.','{name} strikes and is turned away.','{Foe} sidesteps {name}.','{name} comes close, but not close enough.'],
  },
 },
 lamplighter:{
  swing:{
   blade:['You stab at it. Simple, honest work.','You cut. Old as the hills, and still popular.','You swing your {weapon} at the problem.','In goes the blade, by way of a short argument.','You thrust, because talking clearly was not going to work.','You slash. Somewhere, a blacksmith smiles.','You lead with the sharp end. Good instinct.','You aim the pointy bit and commit.'],
   axe:['You chop, like it owes you firewood.','Up goes the {weapon}. Down it comes. That is the whole plan.','You swing the axe with all the subtlety of a falling tree.','You hew at it, woodcutter fashion.','You bring the {weapon} down like a verdict.','You swing the axe. Axes are not known for nuance.','You put your back into it. Your back will complain later.','You take a swing that would split a door.'],
   blunt:['You hit it with the {weapon}. Elegant, no. Effective, often.','You swing the {weapon} like you are settling a debt.','You bring the heavy end down and let nature take its course.','You thump at it with conviction.','You introduce the {weapon} to the problem.','You swing. Something is about to have a bad day.','You batter away, which is a kind of conversation.','You put weight behind the {weapon} and let it travel.'],
   spear:['You poke it with the {weapon}. From a sensible distance.','You jab, the way a cautious person jabs.','You thrust the {weapon}, keeping the dangerous bit far from your face.','You lunge with the long stick. Reach is a fine thing.','You stab from out of arm\'s reach. Clever.','You drive the point forward and hope it finds something.','You lead with the spearhead. The rest of you follows reluctantly.','You prod hard, the way a spear prefers.'],
   bow:['You loose an arrow and watch where it goes.','You draw, aim, and let go. Simple.','Twang. Off it goes.','You put an arrow in the air with intent.','You shoot. Arrows are cheaper than bravery.','You take your shot from a pleasant distance.','You nock, draw, loose. The usual.','You fire, and the string slaps your wrist for the trouble.'],
   thrown:['You throw the {weapon}. You will want that back.','You hurl the {weapon} and hope.','Off goes the {weapon}, end over end.','You throw it hard. Letting go is the easy part.','You fling the {weapon} like a bad memory.','You send the {weapon} on its way.','You throw, and for a moment you are unarmed and optimistic.','You chuck the {weapon} with feeling.'],
   unarmed:['You punch it. Bold choice.','You swing a fist, the oldest weapon there is.','You lash out with an elbow, unbothered by dignity.','You kick. Manners can wait.','You throw a fist. Knuckles were made for this, apparently.','You hit it with your hand. It is very much a hand.','You strike with what you were born with.','You lead with a knee. Effective. Ungentlemanly.'],
   magic:['Your {weapon} glows a little. Showing off, frankly.','The {weapon} hums like it knows something you do not.','You swing the enchanted {weapon}. It does the work and wants the credit.','The {weapon} lights up with old magic, and you swing.','The {weapon} is keen to be useful, and you let it.','You strike with the {weapon}. Someone long ago paid a lot for that shine.','The magic in the {weapon} wakes up, grumpy.','You swing, and the {weapon} glimmers smugly.'],
  },
  offhand:['Your other hand gets involved. Rude not to.','The {weapon} in your off hand wants a go as well.','You follow with the spare blade. Always carry a spare.','Other hand, other opinion.','You add the {weapon}, for emphasis.','Your off hand chimes in with the {weapon}.','You jab with the other one while it is still thinking about the first.','Double the hands, double the trouble.'],
  land:{
   scratch:['It nicks {foe}. A paper cut, roughly.','It lands. Barely. {Foe} seems more insulted than hurt.','A scratch. {Foe} will live to complain about it.','It connects, in the loosest sense of the word.','{Foe} gets a shallow cut and a lesson.','It touches {foe}. Lightly. Politely, even.'],
   solid:['It lands properly. {Foe} has opinions about that.','That one counts. {Foe} winces.','A solid hit. {Foe} reconsiders the afternoon.','It thumps home. {Foe} is less cheerful now.','Good contact. {Foe} staggers.','It connects with a satisfying sort of noise.'],
   heavy:['That one lands hard. {Foe} sways like a drunk at closing time.','Ouch. Not for you. For {foe}.','{Foe} takes the full weight of it and does not enjoy the experience.','A heavy hit. {Foe} is starting to look like a poor investment.','It lands with a crunch you will remember fondly.','{Foe} reels. That will need more than a bandage.','!It goes in deep and comes out red.'],
  },
  miss:['You miss. It happens to the best of us, and also to you.','Air. You hit air. The air had it coming.','{Foe} moves. Rude, but effective.','Nothing. A fine swing at nothing.','{Foe} is somewhere else entirely. Typical.','It goes wide. Very wide. Impressively wide.','{Foe} blocks it, looking almost bored.','A miss. Nobody saw. Probably.'],
  graze:['Not a clean hit, but {foe} still gets a souvenir.','It sort of lands. Sort of counts.','You miss, mostly. The edge disagrees.','{Foe} dodges the worst of it and keeps the rest.','Sloppy, but it leaves a mark.','Not your finest work, but it still stings.'],
  again:{
   hit:['You do it again. It works again.','Another one. {Foe} did not learn from the first.','You follow up, because why stop now.','Another helping. Also lands.','Again. Repetition is the soul of craft.','You add another for good measure.'],
   miss:['The next one wanders off.','You try again. The world says no.','Your follow-up misses. Greed is like that.','{Foe} sees the encore coming.','The next swing is all enthusiasm, no aim.','Another try. Same air.'],
  },
  spell:{
   hit:['You say the words. {spell} does the rest, and {foe} regrets it.','{spell} hits {foe}. Books do pay off.','Your {spell} lands. Magic: still rude.','You wave your hands meaningfully, and {foe} suffers for it.','{spell} finds {foe}. {Foe} did not agree to this.','You cast {spell}. It works, which is always a nice surprise.','{Foe} gets a face full of {spell}.','The {spell} lands with a smug little crackle.','Spellwork, delivered. {Foe} signs for it.','You fling {spell} and it actually goes where you meant.','{spell} lands. Somewhere, a tutor nods.','Magic happens, mostly to {foe}.'],
   miss:['Your {spell} misses. All that study.','{Foe} shrugs off the {spell}, rudely.','{spell} fizzles somewhere unhelpful.','You cast {spell}. {Foe} declines it.','The spell goes off. Just not near {foe}.','{spell} misses by a wizard\'s beard.','{Foe} waits out your {spell} like a light drizzle.','Lots of light. No result.','The {spell} wanders off to bother the scenery.','{Foe} resists. Some creatures have no manners.','Your {spell} fails to impress {foe}.','Magic, performed. Effect, absent.'],
  },
  dodge:['You decide not to be where the pain is going.','You keep moving. Hard to hit a moving coward. Sorry. Tactician.','You weave about like someone who owes money.','You keep your guard up and your head down.','You stay out of reach. Cowardice and wisdom wear the same coat.','You crouch and wait, ready to duck.','You dance about. Not well, but often.','You make yourself scarce without leaving.','You give {foe} nothing to aim at but intentions.','You keep your feet moving and your opinions to yourself.','You hunker down behind your guard.','You choose not getting hit. A classic.'],
  end:['You wait. Bold strategy.','You hold still and see what {foe} does next.','You catch your breath. It was getting away.','You do nothing, carefully.','You stand there, menacingly.','You let {foe} make the next mistake.','You pause. The fight does not.','You hold your ground, which is mostly mud.','You keep your powder dry, as they say in places with powder.','You wait for an opening. Openings are shy.','You hold, and stare. Staring is free.','You do the brave thing and wait.'],
  draught:['You drink a healing draught. It tastes like regret and mint.','Down the hatch. The pain takes a step back.','You gulp the draught. Grimace optional, but likely.','You drink. The bottle was small. The relief is not.','You swig the draught mid-fight, which is very rude to {foe}.','The draught goes down sour and comes back as warmth.','You drink up. Medicine is just soup with ambition.','You knock back the draught like the last drink at the tavern.','You drink. Your wounds grumble and close a little.','The draught tastes awful. That is how you know it works.','You empty the bottle, and the hurting quiets down.','A quick swallow. You feel a little less like a pincushion.'],
  wind:['You refuse to be tired. Your body grudgingly agrees.','You dig deep. There is more down there than expected.','You breathe, swear quietly, and feel better.','Pure stubbornness patches you up a bit.','You shake it off. Not all of it. Enough.','You find a little more fight in the bottom of the barrel.','Your body files a complaint, then gets back to work.','You grit your teeth until the pain gets bored.','You decide you are fine. Remarkably, it helps.','A deep breath, a short curse, a steadier stance.','You pull yourself together. Most of the pieces were nearby.','Spite, it turns out, is a fine tonic.'],
  surge:['You go again. Sleep is for later.','You find another burst of effort. Your lungs can complain afterwards.','Extra effort, on the house.','You move again before anyone, including you, expected it.','You push hard, like the fight is late for supper.','Why do one thing when you can do another?','You spend energy you will miss tomorrow.','You surge forward. Restraint was never your style.','Another move, right now. {Foe} looks put out.','You hurry the fight along.','You skip the part where you rest.','More, faster. Subtle as a bell.'],
  knack:['You do the clever thing you practised.','Training, finally paying off.','You pull one of your tricks. It is a good one.','You lean on old habits. They hold.','A quick bit of craft, done before anyone notices.','You use your knack. Everyone has one. Yours is useful.','You do something practised and slightly smug.','Years of practice, spent in a heartbeat.','A neat move. You would bow if there were time.','You put your skills to work. They were idle anyway.','You do what you do. It works.','Practice makes adequate. Today, better.'],
  saveUp:['You are still breathing. Stubbornly.','Not gone yet. Write that down.','The dark knocks. You do not answer.','You hang on by a thread. A thread is plenty.','Somewhere in the dark, you refuse.','Your heart keeps working. Overtime, unpaid.','You cling on. The dark sighs and waits.','Still here. The gods must be busy.','You hold on, out of spite if nothing else.','Breath, then another. You are terrible at leaving.','The dark reaches for you and misses.','You stay. For now.'],
  saveDown:['The dark leans closer. Patient sort.','A breath goes missing.','You slip a little further. The ground is cold.','Your heart stumbles. Not ideal.','Things go quiet in a bad way.','You sink. Down is easy.','The light gets smaller.','Your grip loosens. On everything.','The cold gets comfortable.','Something in you shrugs and lets go a little.','Fainter now.','The dark takes a little more of you.'],
  foeMove:{
   beast:['{Foe} comes at you with every tooth it owns.','{Foe} lunges. Animals do not negotiate.','{Foe} springs, hungry and unreasonable.','{Foe} rushes in, all appetite.','{Foe} goes for you like you are dinner, which to it you are.','{Foe} snaps at you.'],
   undead:['{Foe} shambles in, in no hurry, having nowhere else to be.','{Foe} reaches for you. Its manners stayed in the grave.','{Foe} swings with all the grace of a dropped coffin.','{Foe} lurches at you, smelling of old cellars.','{Foe} comes on. The restless are persistent.','{Foe} attacks without a word. Nothing to say, really.'],
   person:['{Foe} swings back, offended.','{Foe} comes at you with bad intentions.','{Foe} tries to stick you.','{Foe} returns the favour.','{Foe} lunges with a sneer.','{Foe} has a go.'],
   monster:['{Foe} swings something large at you.','{Foe} lumbers forward and attacks, unimpressed.','{Foe} roars and lashes out. Loudly.','{Foe} tries to flatten you.','{Foe} heaves at you.','{Foe} attacks with the confidence of something big.'],
   band:['{Foes} pile in. Teamwork, of a sort.','{Foes} crowd you like gulls on a pie.','{Foes} come at you all at once. Rude.','{Foes} jostle for the privilege of hitting you.','{Foes} try to surround you. They are very nearly organised.','{Foes} rush you together.'],
  },
  foeHit:{
   scratch:['It catches you. A scratch. You have had worse from a cat.','It stings. Annoyingly.','A nick. Your dignity takes most of it.','It lands lightly. Barely worth the bandage.','You get a small cut and a large grudge.'],
   solid:['It lands. That will bruise.','Ow. That one counted.','It hits you square. Rude.','You take it on the chin, which was not the plan.','That one gets through. Your ribs complain.'],
   heavy:['It hits you hard. Very hard. Unreasonably hard.','That one rattles your teeth and your plans.','You are knocked back a pace and a few years.','A heavy hit. You will feel that one tomorrow, if there is one.','It lands like a dropped anvil.','!It opens you up. Messy.'],
  },
  foeMiss:['It misses. Shame. For it.','You duck. Your knees file a complaint.','It goes past you, close enough to smell.','Your guard holds. Good guard.','Air. It hits air.','You lean away and it whiffs.','It glances off, unconvincingly.','Nothing. It looks embarrassed.'],
  press:{
   hit:['Another one gets a cheap shot in.','Someone else joins the fun and hits you.','Another finds your back. Typical.','There is always one more. This one connects.','From the side, another helps itself.','Another gets in while you are busy.'],
   miss:['The others swing and miss. Teamwork, failing.','The rest flail at you uselessly.','The others try. Bless them.','The rest get in each other\'s way.','The others miss. Comforting.','You fend off the rest with irritation.'],
  },
  other:{
   hit:['{Foe} goes after {name} and lands one.','{Foe} hits {name}. {name} is not thrilled.','{name} takes a blow from {foe}. Ouch, by proxy.','{Foe} catches {name} a good one.','{name} gets hit. Better them than you, says a small voice.','{Foe} picks on {name}, successfully.','{name} soaks up a hit from {foe}.','{Foe} gives {name} something to remember.','{name} takes it on the arm and swears.','{Foe} lands a blow on {name}.','{name} staggers under the attack. Unpleasant.','{Foe} hurts {name}. Rude.'],
   miss:['{Foe} swings at {name} and misses.','{name} ducks the attack. Show-off.','{Foe} tries {name}. {name} declines.','{name} is not where {foe} thought.','{Foe} misses {name} by a whisker.','{name} turns the blow aside.','{Foe} aims for {name} and finds air.','{name} slips the attack.','{Foe} goes for {name}. No joy.','{name} blocks {foe} with a grunt.','{Foe} lunges at {name} and comes up empty.','{name} dances clear of {foe}.'],
  },
  ally:{
   hit:['{name} hits {foe}. Teamwork.','{name} lands a good one. You will hear about it later.','{name} gets a blow in, looking pleased.','{name} strikes {foe}, with feeling.','{name} clips {foe}. Every bit helps.','{name} joins in and connects.','{name} lands a hit while {foe} is busy with you.','{name} makes a useful contribution, sharp end first.','{name} whacks {foe}. Hard to argue with.','{name} hits {foe} and grins about it.','{name} finds a gap. {Foe} wishes otherwise.','{name} lands one. Take notes.'],
   miss:['{name} swings and misses. It happens.','{name} hits nothing, enthusiastically.','The blow from {name} goes wide.','{name} lunges at {foe}. {Foe} is unimpressed.','{name} misses, and pretends it was a feint.','{name} tries. Marks for effort.','The strike from {name} finds only air.','{Foe} brushes off the attack from {name}.','{name} swings at {foe}, wide of the mark.','{name} comes close. Not close enough.','The attack from {name} bounces off.','{name} misses, muttering.'],
  },
 },
 bard:{
  swing:{
   blade:['Your blade sings out in a bright arc!','With a dancer\'s grace you lunge, steel flashing!','Ah, the {weapon} gleams as you cut!','You step forward like a hero from the old songs, blade first!','Steel whispers, and you strike!','You turn, you thrust, a figure of pure daring!','Your {weapon} flickers out like quicksilver!','Brave and bright, you bring the edge to bear!'],
   axe:['Up rises the {weapon}, and down it comes like thunder!','You swing the axe as the woodcutters of legend did!','With a mighty heave, you bring the {weapon} sweeping in!','The axe climbs high, a promise of ruin!','You hew with the strength of an old oak\'s heart!','Your {weapon} cleaves the air with a great, glad roar!','Feet planted, heart roaring, you swing!','Ah, a swing fit for a ballad!'],
   blunt:['The {weapon} rises like a hammer at the forge!','You bring the {weapon} down with the weight of a mountain\'s grudge!','With a cry, you swing the {weapon}!','Like the iron tongue of a bell, the {weapon} swings!','You put your whole heart behind the {weapon}!','Down falls the {weapon}, heavy as fate!','Mighty and unhurried, the {weapon} comes crashing in!','You swing as a smith strikes iron, hard and true!'],
   spear:['Your {weapon} darts out like a heron\'s beak!','You lunge with the long grace of a lancer!','The point of the {weapon} leaps forward!','You thrust, the shaft singing through your hands!','From afar you strike, cunning and bold!','You drive the {weapon} forward with a dancer\'s reach!','Like lightning along a pole, you strike!','The spearpoint flashes out, bright as a star!'],
   bow:['You draw the string to your cheek and let it sing!','An arrow leaps from your bow like a startled bird!','Breath held, heart steady, you loose!','The bowstring hums its sweet, fierce note!','Your shot takes wing!','You loose, and the arrow flies to its purpose!','Like a hunter of the old forests, you let fly!','The arrow streaks away, fletching whispering!'],
   thrown:['You hurl the {weapon} with a hero\'s arm!','End over end, the {weapon} flies!','With a flourish, you send the {weapon} soaring!','You cast the {weapon} like a challenge thrown down!','Away flies the {weapon}, glinting in the light!','You throw with all the fire in your heart!','The {weapon} leaves your hand, a silver blur!','You let the {weapon} fly with a cry!'],
   unarmed:['Fists raised like a tavern champion, you strike!','You leap in, bare-handed and fearless!','A blow from the hand, swift as a hawk!','You spin and strike, a whirl of elbows and courage!','Your fist flies like the hammer of an old god!','You strike with nothing but your nerve and your knuckles!','A kick, a twist, a dancer\'s fury!','Bare hands, bold heart, and in you go!'],
   magic:['The {weapon} blazes with old enchantment as you strike!','Magic thrums along the {weapon}, and you swing!','Ah, the {weapon} remembers the heroes who bore it before you!','Light runs like water along the {weapon}!','The {weapon} sings a note older than kingdoms!','Enchantment flares, and the {weapon} leaps to its work!','Your {weapon} gleams like a captured star!','With a shimmer of magic, the {weapon} strikes!'],
  },
  offhand:['And now the other hand joins the dance!','Your second blade follows like an echo in a song!','A flourish with the {weapon} in your off hand!','Left and right, a duet of steel!','The {weapon} darts in from the other side, quick as a wren!','Not done yet! The off hand strikes!','Twin steel, twin purpose!','Your {weapon} follows, bright as a fresh verse!'],
  land:{
   scratch:['It kisses {foe} lightly, a mere taste of what is to come!','{Foe} is touched, only touched, by your steel!','A shallow mark on {foe}, the first line of a longer song!','It barely finds {foe}, but find it it does!','{Foe} flinches from the faintest of wounds!','A whisper of a cut, and {foe} knows you mean business!'],
   solid:['It strikes true, and {foe} reels!','A fine blow! {Foe} staggers back!','It lands, and {foe} cries out!','Home it goes, and {foe} gives ground!','{Foe} sways beneath a worthy blow!','A strike to make the minstrels proud!'],
   heavy:['A thunderous blow! {Foe} is sent reeling!','{Foe} takes the full fury of it and nearly crumples!','Oh, what a strike! {Foe} sways like a tree in a gale!','The blow lands like a falling tower!','{Foe} is battered back, and the whole field seems to gasp!','A mighty stroke, worthy of a song of its own!','!Red spills where the blow lands, and {foe} howls!'],
  },
  miss:['Alas! {Foe} slips away like smoke!','The blow cleaves only air, but what a sight it was!','{Foe} twists aside in the nick of time!','Not this time! {Foe} is quicksilver!','A gallant try, turned aside!','{Foe} parries, and the dance goes on!','So close! It whistles past {foe}!','The strike falls short, the moment lost!'],
  graze:['Not a true strike, yet still {foe} bears its mark!','It skims {foe}, and even that stings!','Turned aside, but not entirely!','A glancing touch, and {foe} winces!','Imperfect, but not without its sting!','Even your near misses leave their mark!'],
  again:{
   hit:['And again! The next blow sings home!','You strike once more, and it lands!','Another verse, another hit!','No pause! The follow-up finds {foe}!','Another stroke, as fine as the first!','Again your steel finds its mark!'],
   miss:['The next stroke goes astray!','Your follow-up is turned aside!','Again you strike, and again {foe} slips clear!','The encore finds only air!','{Foe} sees the blow coming and dances away!','Another try, gallant but fruitless!'],
  },
  spell:{
   hit:['The words ring out, and {spell} strikes {foe} full!','Oh, the magic! {spell} finds {foe}!','You weave the spell like a melody, and {spell} lands!','Light and power answer you! {Foe} reels under your {spell}!','{spell} blossoms against {foe}!','With a flourish of your hand, {spell} strikes true!','The air shimmers, and {spell} lands with glorious force!','{Foe} cannot escape the {spell}!','Your {spell} sings its bright note, and {foe} hears it!','Magic flares like a beacon on a hill!','You speak, and the world obeys: {spell} hits home!','{spell} streaks forth and finds its mark!'],
   miss:['Alas, your {spell} goes astray!','{Foe} resists the {spell} with a snarl!','The magic sparks and scatters, its mark untouched!','{spell} flies, but {foe} is already gone!','A grand casting, and yet {foe} endures it unharmed!','The spell slips past {foe} like a breeze!','{Foe} shrugs off your {spell}, defiant!','Not this time! The {spell} fades to nothing!','Your {spell} falls short of its mark!','The weave unravels before it reaches {foe}!','{Foe} stands firm against the {spell}!','The magic glimmers and is gone, its purpose unfulfilled!'],
  },
  dodge:['You dance back, light as a feather on the wind!','You weave and sway, impossible to pin down!','Guard high, eyes bright, you give {foe} nothing!','Like a fencer of old, you keep your distance!','You slip and spin, a will-o\'-the-wisp in the fray!','You take a watchful stance, every sense alive!','You make yourself a shadow, hard to strike!','You bend like a reed before the storm!','You circle, wary and graceful!','Every step a dance, every breath a guard!','You hold back, patient as a cat!','You turn aside, lithe and watchful!'],
  end:['You stand your ground, a statue of resolve!','You hold, and let {foe} come to you!','A breath, a pause, a gathering of courage!','You wait, poised like a drawn bowstring!','Steady now. You bide your time!','You keep your place, heart drumming!','You let the moment hang, like a held note!','You watch {foe}, waiting for the perfect moment!','You hold, proud and unbowed!','A pause in the song, before the next verse!','You stay your hand and watch!','You stand firm, unshaken!'],
  draught:['You raise the draught like a toast to your own survival, and drink!','The draught glows warm in your belly!','Sweet relief! The draught does its gentle work!','You drink deep, and life flows back into you!','A swallow of the healer\'s art, and you stand taller!','The little bottle gives up its magic, and your wounds ease!','You drink, and warmth blooms like spring!','Bitter on the tongue, but oh, how it soothes!','You quaff the draught with a flourish!','Healing courses through you like sunlight!','You down the draught, and the pain retreats!','A gulp, a sigh, and strength returns!'],
  wind:['From somewhere deep, a fresh flame kindles!','You breathe in courage, and breathe out pain!','Your spirit rallies like a banner raised high!','Strength returns to you like a tide coming home!','You will not yield! Fresh vigour floods your limbs!','Like an old soldier, you find one more breath!','Your heart sings, and your body answers!','You stand taller, renewed by sheer will!','Weariness falls away like a shed cloak!','You rally, bright-eyed and fierce!','Courage mends what the blows have broken!','A deep breath, and the fire returns!'],
  surge:['A burst of glorious energy carries you forward!','Like a storm breaking, you move again!','You surge onward, unstoppable!','Your heart pounds, and you press on with fresh fury!','With a cry, you find strength for more!','The song quickens, and so do you!','You move like the wind itself!','There is more in you yet, and you spend it gladly!','Swift as a falcon, you strike again into the fray!','You blaze forward like a comet!','The tempo rises, and you rise with it!','Fire in your veins, you push on!'],
  knack:['Ah, your training shines!','A practised flourish, worthy of applause!','You call on your craft, and it answers like an old friend!','With masterful ease, you seize the moment!','Your skill gleams like polished brass!','A trick learned long ago, used beautifully now!','You move with the confidence of long practice!','Your art serves you well!','A deft touch, a clever move!','Years of study bloom in a single moment!','You show {foe} what true skill looks like!','Grace and craft together!'],
  saveUp:['Even now, a spark of you holds on!','Your heart beats on, defiant as a drum!','The darkness reaches, and you refuse it!','Hold on, brave one! You hold!','A breath, faint but true!','Your spirit clings to the light!','The song is not over yet!','Somewhere in the dark, you stand your ground!','A flicker of life, stubborn and bright!','Not yet! Your story is not done!','You hold fast against the night!','The candle gutters, but does not go out!'],
  saveDown:['Oh, the dark draws closer!','Your breath falters, faint and thin!','The light dims around you!','Cold fingers close about your heart!','You slip, a little further from the song!','The night whispers your name!','Your strength ebbs like a tide!','Fainter, fainter, the drum of your heart!','The shadows lengthen around you!','You drift, and the world grows distant!','A cold wind blows through you!','The candle burns lower!'],
  foeMove:{
   beast:['{Foe} springs with a savage cry!','{Foe} lunges, wild and terrible!','With a snarl that shakes the air, {foe} attacks!','{Foe} leaps, all fury and fang!','{Foe} charges like the hunger of winter!','{Foe} rushes you with feral fury!'],
   undead:['{Foe} lurches forward, a nightmare given limbs!','{Foe} reaches for you with the cold of the grave!','Silent as a tomb, {foe} strikes!','{Foe} comes on, relentless as the dark!','{Foe} swings with the dreadful patience of the grave!','{Foe} looms, and strikes!'],
   person:['{Foe} answers with a furious blow!','{Foe} lunges, eyes blazing!','{Foe} strikes back with a snarl!','{Foe} comes at you, bold and vicious!','{Foe} presses the attack!','With a cry, {foe} swings at you!'],
   monster:['{Foe} roars and brings its fury down on you!','{Foe} strikes like a falling mountain!','{Foe} lashes out with monstrous strength!','{Foe} heaves its terrible bulk at you!','{Foe} bellows and attacks!','{Foe} looms like a storm and strikes!'],
   band:['{Foes} surge forward like a wave!','{Foes} close in from every side!','{Foes} howl and rush you together!','{Foes} swarm about you!','{Foes} press in, a chorus of blades!','{Foes} come on as one!'],
  },
  foeHit:{
   scratch:['It grazes you, a mere sting!','A small hurt, quickly forgotten!','It finds you, but only just!','A scratch! Nothing to slow a hero!','It catches you lightly, and you laugh it off!'],
   solid:['The blow finds you, and you cry out!','It strikes you hard, and you stagger!','Ah, that one lands, and the pain is sharp!','It catches you square!','You reel from the blow!'],
   heavy:['A terrible blow! You are driven back!','It strikes you like a hammer, and the world spins!','Oh, that one hurts! You stagger, breathless!','The blow lands with dreadful force!','You are sent reeling, battered and gasping!','!Blood flies, and you bite back a scream!'],
  },
  foeMiss:['But you are too quick!','You dance aside!','Your guard holds, firm as a castle wall!','It whistles past, harmless!','You twist away in the nick of time!','It finds only the air where you stood!','You turn the blow aside with a flourish!','Not today!'],
  press:{
   hit:['And another strikes you from the side!','One more slips through your guard!','Too many at once! Another blow lands!','From behind, another finds you!','Another joins in and lands a blow!','Their numbers tell, and another strikes you!'],
   miss:['But the others cannot reach you!','You hold off the rest with flashing steel!','The rest strike, and strike nothing!','You keep the others at bay!','The others falter before you!','You turn aside the rest!'],
  },
  other:{
   hit:['{Foe} turns on {name} and strikes!','{name} cries out as the blow lands!','{Foe} finds {name}, and {name} reels!','Alas, {name} is struck!','{name} takes a hard blow from {foe}!','{Foe} lands a blow on brave {name}!','{name} staggers under the attack!','{Foe} catches {name}!','{name} is hit, but stands firm!','{Foe} strikes {name} a cruel blow!','{name} bears the brunt of the fury!','A blow from {foe} sends {name} reeling!'],
   miss:['{Foe} lunges at {name}, but {name} dances clear!','{name} turns the blow aside!','{Foe} strikes at {name}, and finds only air!','{name} slips away from {foe}!','Brave {name} parries {foe}!','{Foe} misses {name}!','{name} ducks beneath the attack!','{name} stands firm and the blow glances away!','{Foe} goes for {name}, too slow!','{name} will not be caught so easily!','{name} sidesteps {foe} with a flourish!','The blow passes {name} by!'],
  },
  ally:{
   hit:['{name} leaps in and strikes {foe}!','Bravo, {name}! A fine blow!','The strike from {name} lands true!','{name} fights at your side and hits {foe}!','{name} catches {foe} with a mighty blow!','{name} strikes, bold as a lion!','{name} lands a blow worthy of a song!','{name} finds an opening and seizes it!','{name} hits {foe} with a cry!','Side by side! {name} strikes home!','A blow from {name} sends {foe} staggering!','{name} joins the fray and lands a blow!'],
   miss:['{name} swings, but {foe} slips away!','The blow from {name} goes astray!','{name} lunges gallantly, and misses!','{Foe} turns aside the strike from {name}!','{name} strikes at {foe}, in vain!','{name} tries, bold but too slow!','The attack from {name} finds only air!','{name} presses in, but cannot land a blow!','{name} comes close, so close!','{Foe} evades {name}!','The strike from {name} is parried!','{name} swings with heart, but misses!'],
  },
 },
};

// Spoken lines and sounds for those who fight (the narrator never changes what people say, so these are the same in
// every voice). People who fight speak; beasts, the restless dead and monsters make their sounds.
export const fightBarks={
 taunt:['Is that all you have?','You will tire before I do.','Come on, then!','I have cut better than you.','Stand still and this ends quicker.','You should have stayed on the road.','Nobody is coming to help you.','Too slow!','I will have your boots when you are down.','You fight like a farmhand.','Keep swinging. I am in no hurry.','Give it up and I might let you crawl away.','Bold. Stupid, but bold.','I will remember your face.'],
 hurt:['Argh! You will pay for that!','That... that hurt.','A fluke, that!','You will regret that.','Stay back!','Not so fast...','Ngh. Is that it?','You will bleed for that.','Get away from me!','That is going to scar.','Hold... hold on...','Curse you!','That stung, you dog.'],
 band:['Surround them!','Together, now!','Go for the legs!','Do not let them get away!','Get behind them!','Watch the blade!','Now! While they are busy!','Keep pressing!','Close in, close in!','Take them down!','Flank them!','Do not give them room!'],
 beast:['A low growl rumbles from deep in its chest.','It snorts and paws at the ground.','Its breath comes in short, furious bursts.','It bares its teeth and hisses.','A wild sound tears out of it.','It circles, hackles raised.','It shakes itself and glares at you.','It snaps at the air in fury.','Its eyes never leave you.','It lets out a savage cry.','It crouches low, muscles bunched.','It huffs, steam rising from its breath.'],
 undead:['A dry rattle sounds from its throat.','Its jaw works without a sound.','A chill seems to pour from it.','It moves with a creak of old bones.','Something like a sigh escapes it.','Its empty gaze settles on you.','Dust sifts from it as it moves.','It makes no sound at all, which is worse.','A faint, cold light flickers where its eyes should be.','It sways, patient as the grave.','A low moan drifts out of it.','Its fingers twitch, reaching.'],
 monster:['A roar shakes the air.','It bellows its fury.','The ground seems to tremble under it.','It snarls something that is not a word.','A rank smell drifts off it.','Its breathing is a deep, wet rumble.','It shakes off the fight like rain.','It howls.','It gnashes its teeth.','It lets out a grinding, furious sound.','Its eyes burn with hate.','It stamps and snorts.'],
 cheer:['Good hit!','That is it, keep at them!','Nicely done!','Again, just like that!','They are tiring, keep going!','Ha! Did you see that?','Right behind you!','You have got them!','Beautiful!','Do not let up!','That one landed!','Keep it up, I am with you!'],
 wince:['Ah! I am fine, I am fine.','That will bruise.','Ow. Right. Fine.','I can still fight!','Watch it, that one is quick!','Just a scratch!','I am still standing!','That hurt more than it looked.','Do not worry about me!','Ugh. I will live.','I have had worse.','Keep going, I am all right!'],
 warn:['Careful!','Look out!','On your left!','Watch yourself!','Behind you!','Keep your guard up!','It is coming again!','Do not let it close!','Steady!','Mind the next one!','Stay with me!','Watch its feet!'],
 tags:['{Foe} snarls','{Foe} spits','{Foe} shouts','{Foe} growls','{Foe} sneers','{Foe} barks'],
};

// ---------- What counts as a routine move ----------
const flSteps=action=>action&&typeof action==='object'&&action.type==='turn'&&Array.isArray(action.steps)?action.steps:[action];
// The kind of move an engine action is, when it is one the game can tell itself (null for anything else).
function flMoveOf(action){
 if(typeof action==='string'){
  if(/^(?:attack|throw):/.test(action))return 'attack';
  if(/^offhand:/.test(action))return 'offhand';
  if(action==='dodge'||action==='npc-dodge')return 'dodge';
  if(action==='end-turn'||action==='npc-wait')return 'end';
  if(action==='potion'||/^drink:/.test(action))return 'draught';
  if(action==='class:wind')return 'wind';
  if(action==='class:surge')return 'surge';
  if(/^class:[\w-]+$/.test(action))return 'knack';
  if(action==='death-save')return 'save';
  if(/^(?:again|item):/.test(action))return 'spell';
  return null;
 }
 if(!action||typeof action!=='object')return null;
 if((action.type==='encounter-attack'||action.type==='npc-attack')&&!action.unarmed)return 'attack';
 if(action.type==='spell'||action.type==='use-item')return 'spell';
 return null;
}
const flInFight=g=>!!g&&(g.stage==='combat'||g.stage==='dying'||!!g.npcCombat?.active);
// The player's words are a plain move (a chip's sentence, or a short typed command), not speech, a trick or a question.
export function plainFightWords(words){
 const w=String(words??'').trim();
 if(!w||w.length>90||/["“”«»?;()]/.test(w))return false;
 const body=w.replace(/[.!]+$/,'');
 if(/[.!]/.test(body)||body.split(/\s+/).length>14)return false;
 if(/\b(?:and|then|while|but|so|because|before|after|unless|if|until|shout\w*|say\w*|yell\w*|tell\w*|ask\w*|call\w*|beg\w*|plead\w*|threat\w*|taunt\w*|feint\w*|trick\w*|distract\w*|aim\w*|pretend\w*|hide|hiding|climb\w*|jump\w*|leap\w*|push\w*|pull\w*|grab\w*|disarm\w*|trip\w*|knock|spare\w*|surrender\w*|yield\w*|talk\w*|speak\w*|offer\w*|laugh\w*|scream\w*|sing\w*|pray\w*|head|eyes?|throat|legs?|knees?|neck|heart|face|groin)\b/i.test(body))return false;
 return /^(?:I\s+)?(?:attack|strike|hit|swing|slash|stab|cut|shoot|fire|loose|throw|hurl|punch|use|take|dodge|end|drink|quaff|fight|cast|wait|hold|done|pass|keep|brace|parry|defend|guard)\b/i.test(body);
}
// Which round of the fight a turn belongs to, for the Dungeon Master's turn every few rounds (each death save counts).
export function fightRoundKey(g){
 if(g?.stage==='dying')return 'save:'+((g.dying?.successes??0)+(g.dying?.failures??0));
 return 'r:'+(g?.turnOrder?.round??g?.npcCombat?.round??g?.round??0);
}
// The Dungeon Master tells at least one turn in every this-many rounds of a long fight.
export const fightCadence=3;
function flEnemies(hero,g){
 const list=[];if(!g)return list;
 if(g.npcCombat?.active){
  const scene=npcScene(g);
  for(const o of g.npcCombat.order??[])if(o.side==='enemy'){const n=scene.find(x=>x.id===o.id);if(n)list.push({key:o.id,hp:n.hp??0,max:n.maximumHP??n.hp??1,standing:(n.hp??0)>0?1:0});}
 }else if(g.stage==='combat'){
  let foe=null;try{foe=encounterFoe(hero,g);}catch{}
  const hp=g.enemyHP??0;list.push({key:'foe',hp,max:foe?.maximum??hp,standing:foe?foeStanding(foe,hp):(hp>0?1:0)});
  (g.foeAllies??[]).forEach((a,i)=>list.push({key:'ally:'+i,hp:a?.hp??0,max:a?.maximum??a?.hp??1,standing:(a?.hp??0)>0?1:0}));
 }
 return list;
}
// The die that counts on a d20 line: the higher with advantage, the lower with disadvantage.
function flKept(dice,mode){const d=String(dice).split(/,\s*/).map(Number).filter(Number.isFinite);if(!d.length)return null;return mode==='advantage'?Math.max(...d):mode==='disadvantage'?Math.min(...d):d[0];}
// Whether this fight move needs the Dungeon Master, and why. Pure: the same on every device and the campaign server.
export function routineFightTurn(before,after,action,words,{hero,health,afterHealth,events=[],waiting=false}={}){
 const no=why=>({routine:false,why});
 if(waiting||after?.pendingSpell)return no('a spell needs a ruling');
 if(!flInFight(before))return no('not in a fight');
 const steps=flSteps(action);if(!steps.length||steps.some(s=>!flMoveOf(s)))return no('not a plain move');
 if(!plainFightWords(words))return no('the player\'s own words');
 if(!flInFight(after)||after.stage!==before.stage)return no('the fight turns');
 if(before.openingAttackAvailable)return no('the fight begins');
 const lines=(events??[]).map(t=>String(t??''));
 if(lines.some(t=>/initiative|^Turn order|^Round 1 begins|^Opening attack/i.test(t)))return no('the fight begins');
 if(lines.some(t=>/Critical hit/i.test(t)))return no('a critical hit');
 for(const t of lines){
  const m=t.match(/^You (?:use|throw) [^:]+: d20 \[([\d, ]+)\] \((normal|advantage|disadvantage)/)??t.match(/^[A-Z][^:]*: d20 \[([\d, ]+)\] \((normal|advantage|disadvantage)[^)]*\)[^.]*vs AC /);
  if(m&&flKept(m[1],m[2])===1)return no('a natural 1');
  if(/^Death saving throw: d20 \[(1|20)\]/.test(t))return no('a natural 1 or 20');
 }
 if(lines.some(t=>/^(?:Shield Wall|Undead Fortitude|Dirty Trick)\b|Charge \d|Savage Blow/.test(t))||(after.heroCondition&&after.heroCondition!==before.heroCondition))return no('a foe\'s trick');
 if(lines.some(t=>/\b(?:is slain|is dead|falls dead|fall dead|knocked out|unconscious|is down|goes down|dies)\b/i.test(t)))return no('someone falls');
 // Someone down, dead or out: an enemy, a companion, another hero, or the hero.
 if((afterHealth?.current??1)<=0&&(health?.current??1)>0)return no('the hero falls');
 const sceneBefore=npcScene(before),sceneAfter=npcScene(after);
 for(const n of sceneAfter){const was=sceneBefore.find(x=>x.id===n.id);if(was&&(was.hp??0)>0&&(n.hp??0)<=0)return no('someone falls');}
 if(Object.keys(after.npcFate??{}).some(id=>(before.npcFate??{})[id]!==after.npcFate[id]))return no('someone falls');
 for(const [id,m] of Object.entries(after.party?.members??{}))if(before.party?.members?.[id]&&before.party.members[id].status!==m.status)return no('someone falls');
 const was=flEnemies(hero,before),now=flEnemies(hero,after);
 if(now.length>was.length)return no('someone joins the fight');
 for(const e of was){const n=now.find(x=>x.key===e.key);if(!n)continue;if((e.hp>0&&n.hp<=0)||n.standing<e.standing)return no('a kill');if(e.hp>e.max/2&&n.hp<=e.max/2)return no('a foe badly hurt');}
 if((after.foeScale?.f??1)>(before.foeScale?.f??1)+0.001||(after.turnOrder?.order?.length??0)>(before.turnOrder?.order?.length??0)||(after.npcCombat?.order?.length??0)>(before.npcCombat?.order?.length??0))return no('someone joins the fight');
 // The story keeps breathing: at most fightCadence-1 rounds in a row are told by the game.
 const rounds=new Set();for(const t of [...(before.playback??[])].reverse()){if(t.told!=='game')break;rounds.add(String(t.fightRound??''));}
 const key=fightRoundKey(before);if(!rounds.has(key)&&rounds.size>=fightCadence-1)return no('the Dungeon Master\'s turn to tell it');
 return {routine:true,why:'routine'};
}

// ---------- Writing the telling ----------
function flRng(seed){let h=2166136261>>>0;for(let i=0;i<seed.length;i++){h^=seed.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}let a=h||1;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
const flCap=s=>s?s[0].toUpperCase()+s.slice(1):s;
const flFill=(text,v)=>text.replace(/\{(foe|Foe|foes|Foes|weapon|spell|name)\}/g,(m,k)=>v[k]??(k==='Foe'||k==='Foes'?'Your foe':k==='name'?'your friend':k==='spell'?'your spell':k==='weapon'?'weapon':'your foe'));
// A creature's kind is a common noun ("the goblin raider"); a person or the tale's own foe keeps their name.
const flCommon=name=>{const n=String(name??'').trim();if(!n)return 'your foe';return 'the '+n.replace(/^(?:the|a|an)\s+/i,'').toLowerCase();};
const flProper=name=>{const n=String(name??'').trim();if(!n)return 'your foe';return /^the\s/i.test(n)?'the '+n.slice(4):n;};
const flBeasts=/\b(wolf|wolves|boars?|spiders?|bears?|beast|rats?|snakes?|serpent|hounds?|bats?|cat|lion|panther|crocodile|eagle|hawk|shark|insect|swarm|ape|elk|stag|horse|toad|frog|crab|scorpion|lizard|badger|worm|beetle|centipede|vulture|raven|crow|owl|mastiff|dog|jackal|hyena|tiger|leopard|goat|ram|bull|ox|mammoth|deer|weasel|wasp|hornet|leech|eel|octopus|squid)\b/i;
function flCreatureKind(text,nature){if(nature?.undead)return 'undead';if(nature?.humanoid)return 'person';return flBeasts.test(text)?'beast':'monster';}
// Who is being fought, as the lines name them: the main foe, a creature at its side, and people in a brawl.
function flFoes(hero,g){
 const out=new Map();if(!g)return out;
 if(g.npcCombat?.active){for(const n of npcScene(g)){const name=npcLore(g,n.id)?.name??n.name??n.id;out.set(name,{key:n.id,label:name,kind:'person',speaks:true,max:n.maximumHP??n.hp??1});}return out;}
 let foe=null;try{foe=encounterFoe(hero,g);}catch{}
 const name=foe?.name??g.wildFight?.name??g.story?.foe??'foe',text=g.wildFight?[g.wildFight.template,g.wildFight.name].join(' '):g.story?[g.story.foeSpecies,g.story.foe].join(' '):String(name);
 let nature={};try{nature=creatureNature(g,'foe');}catch{}
 const common=!!(g.wildFight||g.dungeon?.active||g.story?.introId==='hostile'||!g.story);
 const label=common?flCommon(name):flProper(name),kind=flCreatureKind(text,nature),group=foe?.group;
 const entry={key:'foe',label,kind,speaks:kind==='person',band:group?(group.plural?'the '+String(group.plural).toLowerCase():label):null,max:group?.memberHP??foe?.maximum??1,group:!!group};
 out.set(String(name),entry);if(group)for(let i=1;i<=group.size;i++)out.set(name+' '+i,entry);
 (g.foeAllies??[]).forEach((a,i)=>{let n={};try{n=creatureNature(g,'ally:'+i);}catch{}const k=flCreatureKind(String(a?.template??a?.name??''),n);out.set(String(a?.name),{key:'ally:'+i,label:flCommon(a?.name),kind:k,speaks:k==='person',max:a?.maximum??1});});
 return out;
}
function flWeaponKind(name,thrown){
 const n=String(name).toLowerCase();
 if(/unarmed|fist|martial arts/.test(n))return 'unarmed';
 if(thrown||/\bsling\b|\bdart/.test(n))return 'thrown';
 if(/\bbow\b|longbow|shortbow|crossbow/.test(n))return 'bow';
 if(/\+\d|\bof\b/.test(n))return 'magic';
 if(/spear|trident|pike|lance|glaive|halberd|javelin/.test(n))return 'spear';
 if(/axe/.test(n))return 'axe';
 if(/mace|club|hammer|maul|flail|staff|morningstar/.test(n))return 'blunt';
 return 'blade';
}
const flSize=(dealt,max,[a,b])=>!(dealt>0)||!(max>0)?'solid':dealt/max<a?'scratch':dealt/max<b?'solid':'heavy';
// The engine's lines read back into who did what to whom.
function flRead(lines,friends){
 const out=[];
 for(let i=0;i<lines.length;i++){
  const t=lines[i],next=lines[i+1]??'',soon=lines.slice(i+1,i+3);let m;
  if((m=t.match(/^You (use|throw) (.+?)(?: (?:against|on|at) (.+?))?: d20 \[([\d, ]+)\] \((\w+)/))){
   const outcome=(t.match(/AC \d+\. (Critical hit|Hit|Miss)/)??[])[1]??'Miss',dealt=Number((t.match(/Hit; (\d+) \w+ damage/)??next.match(/^(\d+) \w+ damage/)??[])[1]??0);
   out.push({kind:'hero',weapon:m[2].replace(/\s*\([^)]*\)/g,'').trim(),thrown:m[1]==='throw',offhand:/other hand/.test(m[2]),target:m[3]??null,hit:outcome!=='Miss',graze:outcome==='Miss'&&soon.some(l=>/^Graze:/.test(l)),dealt});
  }
  else if(/^Death saving throw:/.test(t))out.push({kind:'save',ok:/\bSuccess\b/.test(t)});
  else if((m=t.match(/^(.+?) attacks (.+?): d20 \[[\d, ]+\]/))){
   const hit=/\. (?:Critical hit|Hit)\b/.test(t),actor=m[1],target=m[2];
   if(target==='you')out.push({kind:'foe',actor,hit,dealt:Number((t.match(/Hit; (\d+) \w+ damage/)??next.match(/(\d+) damage recorded/)??[])[1]??0)});
   else if(friends.includes(actor))out.push({kind:'ally',name:actor,target,hit});
   else out.push({kind:'other',actor,name:target.replace(/^the /,''),hit});
  }
  else if((m=t.match(/^(.+?): d20 \[[\d, ]+\] \(\w+[^)]*\).*vs your AC \d+\. (Critical hit|Hit|Miss)/)))out.push({kind:'foe',actor:m[1],hit:m[2]!=='Miss',dealt:Number((next.match(/(\d+) damage recorded/)??[])[1]??0)});
  else if((m=t.match(/^(.+?) \w+ the .+? \(.+?\): \w+ save d20/))&&friends.includes(m[1]))out.push({kind:'ally',name:m[1],hit:/Failure/.test(t)});
 }
 return out;
}
function flSpellOf(step,game){
 if(step&&typeof step==='object'&&step.type==='spell')return spellLibrary.find(s=>s.id===step.request?.id)?.name??'your spell';
 if(typeof step==='string'&&step.startsWith('again:')&&game?.concentration?.id)return spellLibrary.find(s=>s.id===game.concentration.id)?.name??'your spell';
 return 'the wand';
}
// The telling of a routine fight move: what the hero did, how friends and foes answered, and a spoken line or two.
// Seeded by the turn, so every device and the campaign server write the same words; lines used in the last turns are
// passed over while others are left.
export function fightTelling({hero,before,after,health,afterHealth,action,events=[],narrator='chronicler',brutality='gritty'}){
 const voice=fightLineBook[narrator]??fightLineBook.chronicler,keep=s=>brutality!=='restrained'||!s.startsWith('!');
 const turnId=(before.playback?.at(-1)?.id??0)+1,seed=[before.story?.id??'',turnId,JSON.stringify(action)??'',narrator,(events??[]).join('\n')].join('|');
 const recent=(before.playback??[]).map(t=>(t.events??[]).map(e=>e.text).join('\n')),used=new Set();
 const pick=(slot,pool,vars={})=>{
  const rng=flRng(seed+'#'+slot),list=(pool??[]).filter(keep).map(s=>({s:flFill(s.replace(/^!/,''),vars),r:rng()})).sort((a,b)=>a.r-b.r);
  let best=null,seen=Infinity;
  for(const c of list){if(used.has(c.s))continue;let at=-1;for(let k=recent.length-1;k>=0;k--)if(recent[k].includes(c.s)){at=k;break;}if(at<seen){best=c;seen=at;}if(at===-1)break;}
  if(!best)return '';used.add(best.s);return best.s;
 };
 const chance=flRng(seed+'#voices');
 const lines=(events??[]).map(t=>storyText(after,String(t??''))),foes=flFoes(hero,before);
 for(const [k,v] of flFoes(hero,after))if(!foes.has(k))foes.set(k,v);
 const scene=npcScene(after),sceneBefore=npcScene(before);
 const friendsHere=scene.filter(n=>n.present&&(n.hp??0)>0&&(after.followers?.[n.id]?.status==='following'||(after.npcCombat?.order??[]).some(o=>o.id===n.id&&o.side==='ally')));
 const friendName=n=>npcLore(after,n.id)?.name??n.name??n.id;
 const read=flRead(lines,[...scene,...sceneBefore].map(friendName));
 const main=[...foes.values()].find(f=>f.key==='foe')??[...foes.values()][0]??{label:'your foe',kind:'monster'};
 const vars=f=>({foe:f.label,Foe:flCap(f.label),foes:f.band??f.label,Foes:flCap(f.band??f.label)});
 const targetOf=name=>{if(!name)return main;const plain=String(name).replace(/^the /i,'').toLowerCase();for(const [k,v] of foes)if(k.toLowerCase()===plain)return v;return main;};
 const parts=[],dialogue=[];let heroHit=false,struckFoe=null;
 const mine=read.filter(r=>r.kind==='hero');let at=0;
 for(const step of flSteps(action)){
  const move=flMoveOf(step);
  if(move==='attack'||move==='offhand'){
   const blows=mine.slice(at).filter(r=>move==='offhand'?r.offhand:!r.offhand);if(!blows.length)continue;at=mine.indexOf(blows.at(-1))+1;
   const first=blows[0],t=targetOf(first.target),wk=flWeaponKind(first.weapon,first.thrown),v={...vars(t),weapon:first.weapon.replace(/\s*\+\d+/,'').toLowerCase()};
   parts.push(pick('open',move==='offhand'?voice.offhand:voice.swing[wk],v));
   parts.push(first.hit?pick('land',voice.land[flSize(first.dealt,t.max,[0.25,0.5])],v):first.graze?pick('graze',voice.graze,v):pick('miss',voice.miss,v));
   if(blows[1])parts.push(pick('again',blows[1].hit||blows[1].graze?voice.again.hit:voice.again.miss,vars(targetOf(blows[1].target))));
   if(blows.some(r=>r.hit||r.graze)){heroHit=true;struckFoe=t;}
  }
  else if(move==='spell'){
   const harmed=flEnemies(hero,before).reduce((sum,e)=>{const n=flEnemies(hero,after).find(x=>x.key===e.key);return sum+Math.max(0,e.hp-(n?.hp??e.hp));},0);
   const spell=flSpellOf(step,before),hit=harmed>0||lines.some(l=>l.startsWith(spell+':')&&/\bHit\b|: failure/.test(l));
   parts.push(pick('spell',hit?voice.spell.hit:voice.spell.miss,{...vars(main),spell}));if(hit){heroHit=true;struckFoe=main;}
  }
  else if(move==='save'){const s=read.find(r=>r.kind==='save');parts.push(pick('save',s?.ok?voice.saveUp:voice.saveDown,vars(main)));}
  else parts.push(pick(move,voice[move],vars(main)));
 }
 const ally=read.find(r=>r.kind==='ally');
 if(ally)parts.push(pick('ally',ally.hit?voice.ally.hit:voice.ally.miss,{...vars(targetOf(ally.target)),name:ally.name}));
 const onMe=read.filter(r=>r.kind==='foe');let heroMax=0;try{heroMax=hero?combatBasics(gearedHero(hero,before)).hp:0;}catch{}
 let hurtBad=false;
 if(onMe.length){
  const f=targetOf(onMe[0].actor.replace(/ \d+$/,'')),kind=f.band&&onMe.length>1?'band':f.kind;
  parts.push(pick('foe',voice.foeMove[kind]??voice.foeMove.monster,vars(f)));
  const size=flSize(onMe[0].dealt,heroMax,[0.15,0.35]);if(onMe[0].hit&&size==='heavy')hurtBad=true;
  parts.push(onMe[0].hit?pick('struck',voice.foeHit[size],vars(f)):pick('spared',voice.foeMiss,vars(f)));
  if(onMe.length>1)parts.push(pick('press',onMe.slice(1).some(r=>r.hit)?voice.press.hit:voice.press.miss,vars(f)));
 }
 const other=read.find(r=>r.kind==='other');
 if(other){const f=targetOf(other.actor.replace(/ \d+$/,''));parts.push(pick('other',other.hit?voice.other.hit:voice.other.miss,{...vars(f),name:other.name}));}
 // Voices: someone fighting speaks (or a creature makes its sound), and a friend may call out.
 const enemyPeople=after.npcCombat?.active?scene.filter(n=>n.present&&(n.hp??0)>0&&(after.npcCombat.order??[]).some(o=>o.id===n.id&&o.side==='enemy')):[];
 if(chance()<0.55){
  if(enemyPeople.length){
   const hurt=enemyPeople.find(n=>(sceneBefore.find(x=>x.id===n.id)?.hp??0)>(n.hp??0)),who=hurt??enemyPeople[Math.floor(chance()*enemyPeople.length)];
   const text=pick('bark',hurt?fightBarks.hurt:fightBarks.taunt);if(text)dialogue.push({speakerId:who.id,text});
  }else if(!after.npcCombat?.active&&after.stage==='combat'){
   const f=struckFoe??main;let standing=1;try{standing=foeStanding(encounterFoe(hero,after),after.enemyHP??0);}catch{}
   if(f.speaks){const pool=f.group&&standing>1?fightBarks.band:heroHit&&f===struckFoe?fightBarks.hurt:fightBarks.taunt,text=pick('bark',pool);if(text)parts.push(pick('tag',fightBarks.tags,vars(f))+', “'+text+'”');}
   else{const text=pick('sound',fightBarks[f.kind]??fightBarks.monster);if(text)parts.push(text);}
  }
 }
 if(friendsHere.length&&dialogue.length<2){
  const hit=friendsHere.find(n=>(sceneBefore.find(x=>x.id===n.id)?.hp??0)>(n.hp??0)),roll=chance();
  const who=hit??friendsHere[Math.floor(chance()*friendsHere.length)];
  const pool=hit?(roll<0.7?fightBarks.wince:null):hurtBad?(roll<0.6?fightBarks.warn:null):heroHit?(roll<0.4?fightBarks.cheer:null):(roll<0.2?fightBarks.warn:null);
  if(pool){const text=pick('friend',pool);if(text)dialogue.push({speakerId:who.id,text});}
 }
 const narration=parts.filter(Boolean).join(' ').slice(0,1700)||pick('end',voice.end,vars(main));
 return {narration,dialogue};
}
// The one call a device and the campaign server make after previewing a fight move: the game's own telling when the
// move is routine (no request to the Dungeon Master), else null.
export function routineTelling({hero,before,preview,health,action,words,preferences={}}){
 if(!preview||preview.error)return null;
 const verdict=routineFightTurn(before,preview.game,action,words,{hero,health,afterHealth:preview.health,events:preview.events,waiting:!!preview.waiting});
 if(!verdict.routine)return null;
 return {...fightTelling({hero,before,after:preview.game,health,afterHealth:preview.health,action,events:preview.events,narrator:preferences?.narrator,brutality:preferences?.brutality}),told:'game',fightRound:fightRoundKey(before)};
}
// How many different tellings each case has, per narrator, for the checks (Restrained, the smallest set).
export function fightLineCases(){
 const out=[],n=list=>(list??[]).filter(s=>!s.startsWith('!')).length;
 for(const [voiceId,v] of Object.entries(fightLineBook)){
  const add=(c,count)=>out.push({narrator:voiceId,case:c,count});
  for(const [wk,swing] of Object.entries(v.swing)){for(const size of ['scratch','solid','heavy'])add('hit '+wk+' '+size,n(swing)*n(v.land[size]));add('miss '+wk,n(swing)*n(v.miss));add('graze '+wk,n(swing)*n(v.graze));add('follow-up '+wk,n(swing)*n(v.land.solid)*Math.min(n(v.again.hit),n(v.again.miss)));}
  for(const size of ['scratch','solid','heavy'])add('off hand '+size,n(v.offhand)*n(v.land[size]));add('off hand miss',n(v.offhand)*n(v.miss));
  for(const [kind,moves] of Object.entries(v.foeMove)){for(const size of ['scratch','solid','heavy'])add('foe hits '+kind+' '+size,n(moves)*n(v.foeHit[size]));add('foe misses '+kind,n(moves)*n(v.foeMiss));add('band presses '+kind,n(moves)*n(v.foeHit.solid)*Math.min(n(v.press.hit),n(v.press.miss)));}
  for(const c of ['dodge','end','draught','wind','surge','knack','saveUp','saveDown'])add(c,n(v[c]));
  for(const c of ['hit','miss']){add('spell '+c,n(v.spell[c]));add('another hero '+c,n(v.other[c]));add('companion '+c,n(v.ally[c]));}
 }
 return out;
}
