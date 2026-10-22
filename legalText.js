// Single source for the in-game and generated legal pages. Reviewed against the implemented data flows.
export const legalUpdated='13 October 2026';
export const privacyPolicy={
 "id": "privacy",
 "title": "Privacy policy",
 "sections": [
  {
   "heading": "Who this is about",
   "paragraphs": [
    "Questbound is an early-access browser game operated by the person or business hosting the copy you use. The host supplies your game link and handles your data and support requests. The software is developed under the name turqindustrial. The host may also be the developer. Contact the host through the in-game Feedback form."
   ]
  },
  {
   "heading": "What stays on your device",
   "paragraphs": [
    "During the beta there are no accounts and nothing to sign in to. Your browser stores your characters, adventures, roster, settings, shared-table membership, the players you muted at each shared table and acceptance of the current terms, and your saves stay there: they are not copied to the host's computer. Local saves are not encrypted against someone with access to your device. Clearing site data removes them; Settings → Move your hero gives you your save as a code to keep a copy or carry a hero to another device.",
    "So that the services can tell browsers apart, the game gives yours an anonymous guest identity: a random identifier held in an HttpOnly cookie, which game scripts cannot read. It is not a login, it names nobody and you never see it. Remote game access also uses a pairing cookie. These are necessary service cookies, not advertising cookies. Old browser-readable account tokens are removed on startup."
   ]
  },
  {
   "heading": "What is sent to the host's computer and kept there",
   "paragraphs": [
    "- Your guest identity: the random identifier, a hash of its session token and when it was created and last used. No name, email address, password or saved adventure is kept with it. It lets your browser use the Dungeon Master, send feedback and take a seat at a shared table, and keeps your place at that table.",
    "- Shared tables, only when you use Play Together: membership, host and player roles, the names you give at the table, characters, story, game state and recent turn identifiers. Other members can see the shared story and party details. The server validates and commits shared actions and rolls dice. Up to 20 encrypted earlier versions of each shared table are kept on the host's machine for recovery; they are not an independent off-site backup.",
    "- Feedback: your note, rating, optional name, your hero's name, species, class, subclass, level, hit points, spells and class resources, where you are in the game (the story's title and chapter, the place, the stage and any fight, your experience points), your last two turns (what you wrote, the Dungeon Master's words and the dice and rulings), the latest six lines of the story log, any errors the game showed you, the game's version, and a short description of your device and how the game ran on it (such as \"Android phone\", the screen size, how long the game took to load, and your sound and display settings). Turning off \"Include what happened\" before you send leaves out your hit points, spells, resources and experience, the state of the game, your turns, the story lines and the errors; your name, your hero's name, species, class and level, the story's title, where you are, your device and the game's version are still sent. A note is kept with a pseudonymous label for your browser (see Service records), so the host can match it to the game's own record of what went wrong. Feedback is kept by the host and, when the host has connected the game's own mailbox, forwarded there with these details.",
    "- Play counts, unless you turn them off under Settings → Help improve Questbound: when you stop playing (the game is hidden or closed), a few numbers about that session: how long you played, how many turns you took, how many failed and how (refused by the rules, the Dungeon Master unreachable, another error, the shared table, a save, or a fault the Dungeon Master admitted), where you stopped (one word from a fixed list, such as the title, the hero builder, a fight or your hero's death), the tale opening you chose and whether Easy start was on (for one of the host's written tales: which tale, the chapter you reached, whether you finished it and which of its endings you found, how many story moments were told and the longest quiet stretch, all as numbers), how many tales you waited for and for how long, whether the device is a phone, tablet or desktop, and the game's version. They carry a random counting identifier your browser makes for this alone, so the host can count how many devices come back; the host keeps only a cut of its hash, and it is not your guest identity, is sent with nothing else and cannot be matched to your feedback, your turns or a shared table. Never what you type, names, your hero or your story. Turning the counts off forgets the identifier.",
    "- Session ratings, when you answer \"How was that session?\": your answer (Great, Good, Okay or Rough), when it was asked (after a chapter, the tale, a long rest or your hero's death, or when you left play for the title), that session's minutes played, turns and failed turns, whether the device is a phone, tablet or desktop and the game's version, and any chips you choose and line you add. A rating carries no name, hero, story or turns and no label for your browser. Settings → Help improve Questbound stops the question.",
    "- Service records: mechanical security events and timestamps, pseudonymous guest and shared-table identifiers, response status, request counts and AI usage totals (never the words themselves in usage logs). The services count requests and wrong pairing codes. Daily usage counters survive restarts; shorter request windows are held in memory. Security logs rotate when they reach 1 MB.",
    "- The content check: when OpenAI's moderation service (see below) holds back something you typed, the security log notes when, the categories (for example hate or harassment) and a pseudonymous label for your browser, never the words. Several held back within an hour pause your use of the Dungeon Master for twenty minutes.",
    "- Reports, only when one player reports another at a shared table: the reason chosen, any words the reporter adds, both players' table names and seats, a pseudonymous label for each browser, the table's title and the last few lines (at most five) the reported player typed at that table. Reports are kept with the feedback notes and, when the game's mailbox is connected, mailed to the host.",
    "- Bans: the host of a shared table can remove a player and keep them out of it; the table then keeps a keyed hash of that browser's identity, the name it used there and when. The host of the game can close the whole game to a browser; the ban list keeps a hash of its identity, its pseudonymous label, when and the host's note.",
    "Nothing else is kept: during the beta the host holds no accounts, email addresses, passwords, recovery codes or copies of your own saves. Accounts may be offered at full release; this policy will then change and you will be asked to agree again before anything more is kept."
   ]
  },
  {
   "heading": "What goes to other companies",
   "paragraphs": [
    "- OpenAI. The Dungeon Master is an AI model run by OpenAI. To write the next part of your story, the host's computer sends OpenAI what you type into the game, your hero (name, description, backstory, scores and gear), the story so far and the state of the game, and asks for story text. Most pictures in the game come from the host's own library of ready-made paintings (the places you reach, the people and creatures you meet, and your hero's face), and showing them sends nothing to OpenAI. OpenAI is asked to paint a picture from a description only when that library has nothing that fits, or when you choose Paint my own for your hero, which sends your hero's description for that one painting. With each request from a phone, the tester link or a shared table it sends a pseudonymous label for your browser: a cut of its random guest identifier, never anything that names you. The label is sent so that if anyone misuses the game, OpenAI can tell that player apart from the host and from everyone else. OpenAI processes this under its API terms; at the time of writing OpenAI says it does not use API data to train its models and keeps it for up to 30 days to watch for abuse. Check OpenAI's current policies. Do not type anything into the game that you would not want processed this way: it is a game, not a place for personal, financial or health information. Before your words reach the Dungeon Master, the host's computer also sends what you type (and any name you give at a shared table) to OpenAI's moderation service, which scores it for categories such as hate, harassment, sexual content and self-harm; messages that cross the game's limits are held back and not sent on. Fights and peril in the story are never held back.",
    "- Cloudflare. The internet (tester) link runs through Cloudflare's tunnel service, so your traffic passes through Cloudflare, which sees your network address as any website host would. Unencrypted remote play is disabled; use the HTTPS game link.",
    "- Your browser's voices. If you turn on the narrator voice (Settings → Sound), your browser reads the Dungeon Master's words aloud. Some voices, marked online or natural, are spoken by the browser maker's servers (Microsoft for Edge, Google for Chrome, Apple for Safari), which then receive that text. The setting is off unless you turn it on.",
    "- Google/Gmail. When the host has connected the game's own mailbox, feedback (and a session rating's line, if you add one) is forwarded to it with the details listed above, and Google processes that mail under its own policies; messages remain in the mailbox until the host deletes them. The game sends no email to players.",
    "The game includes no advertising or tracking scripts. The services above receive only the data needed for their described functions."
   ]
  },
  {
   "heading": "Why",
   "paragraphs": [
    "The host processes this data to run the game you asked to play (to carry your adventure from one turn to the next and to let several people share a table), to keep the services safe from abuse (counting requests and wrong codes) and to improve the game (your feedback notes, session ratings and the anonymous play counts). Where European or UK data-protection law applies, the legal bases are the performance of a contract with you (the game itself), the host's legitimate interests (security and improvement) and, for optional features such as shared tables and feedback, your consent, which you give by using them and may withdraw by leaving the table or asking the host."
   ]
  },
  {
   "heading": "How long",
   "paragraphs": [
    "- Your saves stay in your browser until you delete them or clear its site data.",
    "- A guest identity lasts 90 days from the last time it is used and is renewed while you play. A guest not seen for 60 days is removed, with the shared tables it hosts. Clearing this browser's site data loses the guest identity and its place at any shared table.",
    "- Shared tables remain until the guest identity that hosts them is removed or the host deletes them. Their encrypted history keeps up to 20 versions. The host must protect and periodically copy the backup key and data to a separate secure location if independent recovery is needed.",
    "- Reports remain with the feedback notes until the host deletes them; a ban lasts until the host lifts it. Mutes stay in your browser until you unmute or clear its site data.",
    "- Play counts are kept for 180 days and then deleted. Session ratings are kept with the feedback notes.",
    "- Daily request counters are replaced when a new UTC day begins. Security logs retain the current and previous rotated file; feedback and mailbox messages remain until the host deletes them.",
    "- Invitation and pairing lifetimes depend on the host's sharing settings. Campaign invites expire after 7 days and can be replaced by the campaign host."
   ]
  },
  {
   "heading": "Your choices and rights",
   "paragraphs": [
    "- Clear your browser's site data to remove everything the game keeps on your device.",
    "- Turn off the play counts, the session question or both under Settings → Help improve Questbound (per browser).",
    "- Leave a shared table under Play Together; its host, or the host of the game, can remove the table itself.",
    "- Ask the host to delete your feedback, a shared table or anything else about you, to tell you what they hold, or to correct it: use the Feedback form in the game or contact the host directly. Where the law gives you rights of access, rectification, erasure, restriction, portability (Settings → Move your hero gives you your save as a code) and objection, the host will honour them, and you may complain to your data-protection authority."
   ]
  },
  {
   "heading": "Children",
   "paragraphs": [
    "Questbound tells stories with violence and, at the player's choice, graphic violence. It is for players aged 16 and over. The host does not knowingly keep data for anyone younger; if you believe a child has used the game, tell the host and the data will be deleted."
   ]
  },
  {
   "heading": "Security",
   "paragraphs": [
    "Remote play requires HTTPS. The guest cookie is HttpOnly and SameSite=Strict, and Secure over HTTPS. Shared-table permissions are checked on the server. These safeguards reduce risk but do not guarantee that every vulnerability, outage or data loss is prevented. Do not share invite codes, and protect the devices you use: anyone who can use your browser or computer can read the saves kept in it."
   ]
  },
  {
   "heading": "Changes and contact",
   "paragraphs": [
    "This policy may change as the game changes; the date at the top says when. The current version is always in the game under Settings → About → Privacy policy. Questions and requests go to the host: the person who gave you your link or code, or the Feedback form in the game."
   ]
  }
 ]
};
export const termsOfUse={
 "id": "terms",
 "title": "Terms of use",
 "sections": [
  {
   "heading": "What this is",
   "paragraphs": [
    "Questbound is an early-access game in testing, shared privately by its host with invited players. By playing you accept these terms and the privacy policy. If you do not accept them, do not play. Before your first game in each browser the game asks you to agree (the permissions agreement, a short summary of what it will do), and asks again when these texts change."
   ]
  },
  {
   "heading": "Who may play",
   "paragraphs": [
    "- You must be 16 or older. If you have not reached the age of legal majority where you live, your parent or guardian must authorize your use where applicable law requires it.",
    "- No account is needed during the beta: your browser plays under an anonymous guest identity and your saves stay in it. Accounts may be offered at full release, under terms you will be asked to accept first. Keep invite codes private and report suspected misuse promptly.",
    "- The host may suspend access for misuse, safety concerns or operational needs, subject to applicable law. Early-access features and saves may change or become unavailable. This does not remove any statutory rights."
   ]
  },
  {
   "heading": "The Dungeon Master is an AI",
   "paragraphs": [
    "The stories, people, places and rulings in the game are generated by an AI model as you play. They can be inaccurate, inconsistent, unexpected or upsetting, and they are fiction: nothing the Dungeon Master says is advice of any kind. The Brutality setting under Settings → Story decides how graphic violence is told; the game is lethal at every setting. If something goes wrong in play, tap DM beside the message box and tell the Dungeon Master, or send feedback."
   ]
  },
  {
   "heading": "Fair play",
   "paragraphs": [
    "- Do not try to break into, overload, probe or disrupt the game's services, or to reach other players' data.",
    "- Do not automate requests or script play. The host pays for every word the AI writes: play, do not flood. The services hold each browser and each network address to a fair number of requests, and past that number they answer \"try again later\".",
    "- Do not use the game to produce unlawful content or content that harasses, threatens or defames real people, and do not type other people's personal information into it.",
    "- Respect the people you play with at a shared table. Other players can mute you on their own devices or report you to the host. The host of a table can remove you from it and keep you out, and the host of the game can close the whole game to your browser.",
    "- What you type is checked by OpenAI's moderation service before the Dungeon Master sees it. Hateful or harassing words, threats against people, sexual content, anything sexual involving minors and instructions for self-harm are held back; doing it again and again pauses your Dungeon Master for a while. If what you type suggests you may be at risk, the game points you to people who can help."
   ]
  },
  {
   "heading": "Your content and the game's",
   "paragraphs": [
    "You retain rights you have in material you submit. You grant the host a limited, non-exclusive permission to process, store and display it to operate the game, generate responses, keep permitted backups and show shared content to your campaign members. Submit only material you have the right to use. AI-generated material may be similar to others' material and may not qualify for exclusive ownership; its use is also subject to applicable law and provider terms.",
    "Questbound code, original text, artwork, icons, sound and design remain subject to their applicable copyrights and licences. System Reference Document and open-source material retain their own licence terms, which these terms do not restrict. See Licences and credits."
   ]
  },
  {
   "heading": "No warranty",
   "paragraphs": [
    "To the fullest extent permitted by applicable law, Questbound is provided 'as is' and 'as available', without warranties of uninterrupted operation, accuracy, fitness for a particular purpose, merchantability or non-infringement. AI narration, images and rules may be incorrect, non-unique, offensive or unavailable. No representation is made that the game implements every tabletop rule or prevents every security incident.",
    "To the fullest extent permitted by applicable law, the host and developer exclude liability for indirect, incidental, special or consequential losses, including lost profits, lost opportunities or loss of data arising from use of the game. Keep independent copies of important saves. This exclusion applies only where and to the extent it is legally enforceable.",
    "Nothing in these terms excludes or limits liability for fraud, intentional misconduct, death or personal injury caused by negligence where such liability cannot be excluded, or any other liability or consumer remedy that cannot lawfully be excluded or limited. These terms do not prevent you from exercising mandatory rights, reporting unlawful conduct or seeking lawful remedies."
   ]
  },
  {
   "heading": "Changes and law",
   "paragraphs": [
    "Material changes are dated and presented for renewed acceptance. Unless a lawful agreement says otherwise, mandatory law and consumer protections applicable to you remain in force. No compulsory arbitration clause, exclusive court venue or governing jurisdiction is chosen in this version. If a provision is unenforceable, the remaining provisions apply to the extent permitted by law. Contact the host through Feedback to raise an issue."
   ]
  },
  {
   "heading": "Third-party services and costs",
   "paragraphs": [
    "The game depends on AI, email, internet and hosting providers. Their services may be delayed, changed or unavailable. No uptime or permanent availability is promised. The host pays provider charges under the host's provider agreement; this playtest does not itself charge players. Any future paid offer requires clearly disclosed pricing and separate acceptance before payment."
   ]
  },
  {
   "heading": "Health, safety and conduct",
   "paragraphs": [
    "Fantasy actions are fiction, not instructions for real-world conduct or professional advice. Stop playing if visual effects or content cause discomfort; flashes, shake and narration can be disabled. Do not harass players, infringe others' rights, upload personal information without authority, impersonate others or attempt unauthorized access. This does not prohibit lawful security reporting or rights protected by law."
   ]
  }
 ]
};
export const permissionsAgreement={
 "id": "permissions",
 "title": "Permissions agreement",
 "sections": [
  {
   "heading": "Your words go to an AI",
   "paragraphs": [
    "What you type, your hero and the state of your game are sent to the host's computer and from there to OpenAI, which writes the Dungeon Master's replies and paints missing pictures. OpenAI's moderation service checks what you type first, and the game holds back hateful, harassing or sexual messages. Type nothing you would not want processed that way: no personal, financial or health details, yours or anyone else's."
   ]
  },
  {
   "heading": "Saves in this browser",
   "paragraphs": [
    "Your characters, adventures, roster and settings are saved in this browser only: during the beta there are no accounts and no copies of your saves on the host's computer. Clearing site data removes them; Settings → Move your hero gives you your save as a code to keep or carry to another device. Local saves are not encrypted against someone with access to your device.",
    "The game gives this browser an anonymous guest identity (a random identifier in an HttpOnly cookie that game scripts cannot read; not a login) so the services can tell browsers apart. Remote game access also uses a pairing cookie. These are necessary service cookies, not advertising cookies."
   ]
  },
  {
   "heading": "Copies on the host's computer",
   "paragraphs": [
    "The host's computer keeps only your anonymous guest identity (for 90 days from its last use), any shared table you play at through Play Together (with up to 20 encrypted earlier versions), your feedback notes and session ratings, anonymous play counts (for 180 days) and service records. Read the privacy policy for retention, access and deletion details."
   ]
  },
  {
   "heading": "Feedback and service records",
   "paragraphs": [
    "Feedback and session ratings reach the host (and the game's mailbox, once connected). A note carries your hero, where you are, your last two turns and errors (you can leave those out) and how the game ran. Anonymous play counts (how long you play, turns and failed turns, where you stop; never your words) are sent unless you turn them off in Settings. Security events and daily usage counts help prevent misuse."
   ]
  },
  {
   "heading": "Sound and full screen",
   "paragraphs": [
    "The game plays music and sound effects once you tap to begin, and goes full screen only when you ask it to. Both can be turned off at any time from the buttons at the top of the screen. If you turn on the narrator voice, your browser reads the story aloud; some browser voices send the text to the browser maker to be spoken."
   ]
  },
  {
   "heading": "Age and conduct",
   "paragraphs": [
    "You confirm that you are 16 or older. The Dungeon Master is an AI and the game is lethal: its stories can be violent, unexpected or upsetting. You accept the terms of use, including fair play: no flooding the services, no scripting play, no reaching for other players' data."
   ]
  },
  {
   "heading": "Changing your mind",
   "paragraphs": [
    "You can withdraw at any time by clearing this browser's site data, leaving any shared table and asking the host to remove any copies. Your agreement is recorded in this browser only (the date and the version of these texts), and you will be asked again when they change."
   ]
  }
 ]
};
export const licences={
 "id": "licences",
 "title": "Licences and credits",
 "sections": [
  {
   "heading": "Rules",
   "paragraphs": [
    "This work includes material from the System Reference Document 5.2 (\"SRD 5.2\") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.",
    "This work includes material taken from the System Reference Document 5.1 (\"SRD 5.1\") by Wizards of the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode.",
    "Questbound is an independent production, compatible with fifth edition. It is not affiliated with, endorsed by or sponsored by Wizards of the Coast. The rules text in the game comes from the two System Reference Documents. A few options beyond them (the Artificer class and its five specialities, three further subclasses for every other class, marked Questbound, and the Goblin species) are described in Questbound's own words, with no text taken from any other book. The heroes, places and stories in the game are Questbound's own or written for you as you play."
   ]
  },
  {
   "heading": "Software",
   "paragraphs": [
    "Questbound, copyright 2026 turqindustrial, all rights reserved. Built with React, React Native, React Native Web and Expo (MIT licences) and other open-source libraries under permissive licences."
   ]
  },
  {
   "heading": "Typefaces",
   "paragraphs": [
    "Cinzel, Cinzel Decorative, EB Garamond and Inter, under the SIL Open Font License 1.1, served from the host's own computer (the licence texts are at /fonts/ beside the font files)."
   ]
  },
  {
   "heading": "Pictures and sound",
   "paragraphs": [
    "The title paintings, the game's libraries of ready-made pictures (places, people, creatures and heroes' faces) and any picture painted during play are generated with OpenAI's image models at the host's request. The icons, interface and music are Questbound's own."
   ]
  }
 ]
};
export const legalDocuments=[privacyPolicy,termsOfUse,permissionsAgreement,licences];
