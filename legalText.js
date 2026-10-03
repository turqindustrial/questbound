// Questbound's privacy policy, terms of use and licence notices, written once here. The game shows them under
// Settings → About (Legal.js) and from the title screen; `node verify-legal.cjs --write` writes the same words to
// public/privacy.html and public/terms.html (which the phone gateway serves before pairing, so the pairing page can
// link to them) and to PRIVACY.md and TERMS.md in the repository. Every statement here describes what the code does:
// change the code, change the words, and run the check.
// A paragraph that begins with "- " is a bullet. The host is whoever runs the launcher and shares a link or code.
export const legalUpdated='3 October 2026';
export const privacyPolicy={id:'privacy',title:'Privacy policy',sections:[
 {heading:'Who this is about',paragraphs:[
  'Questbound is a game you play in a web browser. The copy you are playing is run by one person, the host: the person who gave you your link or code. The host\'s own computer runs the game\'s services and keeps your saved adventures. Questbound\'s software is written by turqindustrial, who does not run your copy and receives none of your data. For everything in this policy, the host is the person responsible for your data (under European and UK law, the "controller").',
 ]},
 {heading:'What stays on your device',paragraphs:[
  'The game keeps these in your browser\'s storage, on your device only, until you clear your browser\'s site data: your hero and adventure (your current save and the heroes set aside under Heroes), your settings (theme, sound, display, brutality), a recovery code the game makes for you, the sign-in token for your account if you have one (never your password), small flags such as whether you have seen the How to play card and when you accepted the permissions agreement, and the name and id you use at a shared table.',
  'On the phone and tester links the game also sets one cookie that marks your browser as paired. It holds a random token and nothing about you, and the game cannot work without it.',
 ]},
 {heading:'What is sent to the host\'s computer and kept there',paragraphs:[
  '- Your adventure, as a saved copy: under your recovery code (stored only as a hash of the code) and, if you have an account, under your account. The latest save replaces the one before. It is kept until you or the host delete it. You can turn the recovery-code copy off under Settings → Recovery code.',
  '- Your account, if you make one: a hash of your email address, a salted hash of your password, hashes of your sign-in tokens and when you last saved. The email address itself and your password are never written down, and the host cannot read or recover them. Nothing is ever sent to your email address; it is only a name to sign in with.',
  '- Feedback you send from the game: your note, the star rating, the name you use at the shared table if any, your hero\'s name, where you are in the game and a short description of your device (such as "Android phone"). The host reads these notes to improve the game.',
  '- Play together: the shared adventure, the names players choose and when each was last seen.',
  '- Service records: how many words the AI used for each request (never the words themselves) and, for a request from a phone or the tester link, a label for the browser that asked (a scrambled form of its pairing, never your name), so that players can be kept within the host\'s daily allowance for the AI; a note of any reply the game refused (which fields were wrong, never story text) and whether the Dungeon Master had to be asked twice. To stop guessing and flooding, the services also count requests, wrong pairing codes and wrong passwords by paired browser and by network address for up to an hour, in memory only.',
  '- The pairing or invite code you enter is checked and not stored; your browser\'s paired state is kept as a hash.',
 ]},
 {heading:'What goes to other companies',paragraphs:[
  '- OpenAI. The Dungeon Master is an AI model run by OpenAI. To write the next part of your story, the host\'s computer sends OpenAI what you type into the game, your hero (name, description, backstory, scores and gear), the story so far and the state of the game, and asks for story text. It also asks OpenAI to paint portraits of heroes and of the people you meet from their descriptions, and pictures of places. With each request from a phone or the tester link it sends that browser\'s label (see Service records), so that if anyone misuses the game, OpenAI can tell that player apart from the host and from everyone else. OpenAI processes this under its API terms; at the time of writing OpenAI says it does not use API data to train its models and keeps it for up to 30 days to watch for abuse. Check OpenAI\'s current policies. Do not type anything into the game that you would not want processed this way: it is a game, not a place for personal, financial or health information.',
  '- Cloudflare. The internet (tester) link runs through Cloudflare\'s tunnel service, so your traffic passes through Cloudflare, which sees your network address as any website host would. The home Wi-Fi link does not use Cloudflare.',
  '- Your browser\'s voices. If you turn on the narrator voice (Settings → Sound), your browser reads the Dungeon Master\'s words aloud. Some voices, marked online or natural, are spoken by the browser maker\'s servers (Microsoft for Edge, Google for Chrome, Apple for Safari), which then receive that text. The setting is off unless you turn it on.',
  'No one else. There are no advertisements, no analytics and no tracking scripts, and the host does not sell or share your data.',
 ]},
 {heading:'Why',paragraphs:[
  'The host processes this data to run the game you asked to play (to carry your adventure from one turn to the next, to let you sign in on another device, to let several people share a table), to keep the services safe from abuse (counting wrong codes and passwords) and to improve the game (your feedback notes). Where European or UK data-protection law applies, the legal bases are the performance of a contract with you (the game itself), the host\'s legitimate interests (security and improvement) and, for optional features such as accounts and feedback, your consent, which you give by using them and may withdraw by deleting your account or asking the host.',
 ]},
 {heading:'How long',paragraphs:[
  '- Saves: until you delete them or the host does. The host\'s copies under recovery codes are pruned to the 200 most recent.',
  '- Accounts: until you delete your account in Settings or ask the host to. A sign-in expires after 180 days.',
  '- Feedback notes: until the host deletes them.',
  '- Service records: rotated when they grow large; the host may delete them at any time.',
  '- Pairing: a code lasts a week; your browser stays paired for up to a week on home Wi-Fi, or for the length of an invite.',
 ]},
 {heading:'Your choices and rights',paragraphs:[
  '- Delete your account under Settings → Your account → Manage account: this removes the account and its saved adventure from the host\'s computer.',
  '- Turn off the recovery-code copy under Settings → Recovery code.',
  '- Clear your browser\'s site data to remove everything the game keeps on your device.',
  '- Ask the host to delete your saved adventures, your feedback or anything else about you, to tell you what they hold, or to correct it: use the Feedback form in the game or contact the host directly. Where the law gives you rights of access, rectification, erasure, restriction, portability (Settings → Move your hero gives you your save as a code) and objection, the host will honour them, and you may complain to your data-protection authority.',
 ]},
 {heading:'Children',paragraphs:[
  'Questbound tells stories with violence and, at the player\'s choice, graphic violence. It is for players aged 16 and over. The host does not knowingly keep accounts or data for anyone younger; if you believe a child has used the game, tell the host and the data will be deleted.',
 ]},
 {heading:'Security',paragraphs:[
  'Passwords are stored only as salted hashes; the host\'s computer never holds a readable copy. The internet link is encrypted (https); the home Wi-Fi link is plain http, so use it only on a network you trust, and use a password you do not use anywhere else. Every page of the game may run only the game\'s own code and cannot be shown inside another website, and the services on the host\'s computer answer only to the game. The host\'s computer is an ordinary PC: keep that in mind when deciding what to type.',
 ]},
 {heading:'Changes and contact',paragraphs:[
  'This policy may change as the game changes; the date at the top says when. The current version is always in the game under Settings → About → Privacy policy. Questions and requests go to the host: the person who gave you your link or code, or the Feedback form in the game.',
 ]},
]};
export const termsOfUse={id:'terms',title:'Terms of use',sections:[
 {heading:'What this is',paragraphs:[
  'Questbound is an early-access game in testing, shared privately by its host with invited players. By playing you accept these terms and the privacy policy. If you do not accept them, do not play. Before your first game in each browser the game asks you to agree (the permissions agreement, a short summary of what it will do), and asks again when these texts change.',
 ]},
 {heading:'Who may play',paragraphs:[
  '- You must be 16 or older.',
  '- Your link, pairing code or invite code is for you. Do not publish it or pass it on without the host\'s say-so.',
  '- The host may end anyone\'s access at any time, and may change, pause, reset or stop the game. It is a test: saves can be lost, and features can change or disappear.',
 ]},
 {heading:'The Dungeon Master is an AI',paragraphs:[
  'The stories, people, places and rulings in the game are generated by an AI model as you play. They can be inaccurate, inconsistent, unexpected or upsetting, and they are fiction: nothing the Dungeon Master says is advice of any kind. The Brutality setting under Settings → Story decides how graphic violence is told; the game is lethal at every setting. If something goes wrong in play, tap DM beside the message box and tell the Dungeon Master, or send feedback.',
 ]},
 {heading:'Fair play',paragraphs:[
  '- Do not try to break into, overload, probe or disrupt the game\'s services, or to reach other players\' data.',
  '- Do not automate requests or script play. The host pays for every word the AI writes: play, do not flood. The services hold each browser and each network address to a fair number of requests, and past that number they answer "try again later".',
  '- Do not use the game to produce unlawful content or content that harasses, threatens or defames real people, and do not type other people\'s personal information into it.',
  '- Respect the people you play with at a shared table.',
 ]},
 {heading:'Your content and the game\'s',paragraphs:[
  'What you type is yours. You allow the host to store it, send it to the AI provider and show it as part of the game, including to the other players at a shared table. The stories the AI writes for you are yours to keep and share as far as the AI provider\'s terms allow.',
  'Questbound itself (its code, text, artwork, icons, sound and design) is copyright of turqindustrial, all rights reserved; it is shared with you to play, not to copy, modify, redistribute or sell. Its rules text includes material from the System Reference Documents under the Creative Commons Attribution 4.0 licence (see Licences).',
 ]},
 {heading:'No warranty',paragraphs:[
  'The game is provided as it is, in early access, without warranty of any kind. To the fullest extent the law allows, neither the host nor the developer is liable for lost saves, lost data, lost time or any other loss arising from playing. Nothing here limits any liability that the law does not allow to be limited.',
 ]},
 {heading:'Changes and law',paragraphs:[
  'These terms may change as the game changes; the date at the top says when, and the current version is always in the game under Settings → About → Terms of use. The law of the country where the host lives applies, unless the law of your own country says otherwise and cannot be set aside. Questions go to the host or through the Feedback form in the game.',
 ]},
]};
// What the player agrees to before the first game in a browser (Agreement.js shows these seven points with one tap to
// agree; the record is the date and the version, kept in that browser only, and the question returns when the texts change).
export const permissionsAgreement={id:'permissions',title:'Permissions agreement',sections:[
 {heading:'Your words go to an AI',paragraphs:[
  'What you type, your hero and the state of your game are sent to the host\'s computer and from there to OpenAI, which writes the Dungeon Master\'s replies and paints the pictures. Type nothing you would not want processed that way: no personal, financial or health details, yours or anyone else\'s.',
 ]},
 {heading:'Saves in this browser',paragraphs:[
  'Your hero, adventure, settings and a few small flags are kept in this browser\'s storage until you clear its site data. On a phone or tester link one cookie marks this browser as paired; it holds a random token and nothing about you.',
 ]},
 {heading:'Copies on the host\'s computer',paragraphs:[
  'When you use a recovery code, an account or the shared table, a copy of your adventure is kept on the host\'s computer under a hash of the code or of your email address. The host can delete it, and so can you (Settings → Recovery code, Settings → Your account).',
 ]},
 {heading:'Feedback and service records',paragraphs:[
  'Notes you send from the game reach the host with your hero\'s name, where you are in the game and a short description of your device. The services count requests, wrong codes and wrong passwords by browser and network address for up to an hour, in memory only, and record how many words the AI used (never the words themselves).',
 ]},
 {heading:'Sound and full screen',paragraphs:[
  'The game plays music and sound effects once you tap to begin, and goes full screen only when you ask it to. Both can be turned off at any time from the buttons at the top of the screen. If you turn on the narrator voice, your browser reads the story aloud; some browser voices send the text to the browser maker to be spoken.',
 ]},
 {heading:'Age and conduct',paragraphs:[
  'You confirm that you are 16 or older. The Dungeon Master is an AI and the game is lethal: its stories can be violent, unexpected or upsetting. You accept the terms of use, including fair play: no flooding the services, no scripting play, no reaching for other players\' data.',
 ]},
 {heading:'Changing your mind',paragraphs:[
  'You can withdraw at any time by clearing this browser\'s site data, deleting your account under Settings → Your account and asking the host to remove any copies. Your agreement is recorded in this browser only (the date and the version of these texts), and you will be asked again when they change.',
 ]},
]};
export const licences={id:'licences',title:'Licences and credits',sections:[
 {heading:'Rules',paragraphs:[
  'This work includes material from the System Reference Document 5.2 ("SRD 5.2") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.',
  'This work includes material taken from the System Reference Document 5.1 ("SRD 5.1") by Wizards of the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode.',
  'Questbound is an independent production, compatible with fifth edition. It is not affiliated with, endorsed by or sponsored by Wizards of the Coast. The rules text in the game comes from the two System Reference Documents. A few options beyond them (the Artificer class, its four specialities and the Goblin species) are described in Questbound\'s own words, with no text taken from any other book. The heroes, places and stories in the game are Questbound\'s own or written for you as you play.',
 ]},
 {heading:'Software',paragraphs:[
  'Questbound, copyright 2026 turqindustrial, all rights reserved. Built with React, React Native, React Native Web and Expo (MIT licences) and other open-source libraries under permissive licences.',
 ]},
 {heading:'Typefaces',paragraphs:[
  'Cinzel, Cinzel Decorative, EB Garamond and Inter, under the SIL Open Font License 1.1, served from the host\'s own computer (the licence texts are at /fonts/ beside the font files).',
 ]},
 {heading:'Pictures and sound',paragraphs:[
  'The title paintings, the portraits of heroes and people, and the pictures of places are generated with OpenAI\'s image models at the host\'s request. The icons, interface and music are Questbound\'s own.',
 ]},
]};
export const legalDocuments=[privacyPolicy,termsOfUse,permissionsAgreement,licences];
