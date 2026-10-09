// Single source for the in-game and generated legal pages. Reviewed against the implemented data flows.
export const legalUpdated='9 October 2026';
export const privacyPolicy={
 "id": "privacy",
 "title": "Privacy policy",
 "sections": [
  {
   "heading": "Who this is about",
   "paragraphs": [
    "Questbound is an early-access browser game operated by the person or business hosting the copy you use. The host supplies your game link and handles your data and support requests. The software is developed under the name turqindustrial. The host may also be the developer. Contact the host through the in-game Feedback form or the dedicated game mailbox from which you receive verification emails."
   ]
  },
  {
   "heading": "What stays on your device",
   "paragraphs": [
    "Your browser stores your characters, adventures, roster, settings, recovery code, account display information, campaign membership and acceptance of the current terms. Saves are separated by account; guest progress is kept separately and may be imported deliberately. Local saves are not encrypted against someone with access to your device. Clearing site data removes local copies.",
    "Account sign-in uses an HttpOnly cookie that game scripts cannot read. Remote game access also uses a pairing cookie. These are necessary service cookies, not advertising cookies. Old browser-readable account tokens are removed on startup."
   ]
  },
  {
   "heading": "What is sent to the host's computer and kept there",
   "paragraphs": [
    "- Accounts: a hash of your email address, a salted hash of your password, hashes of session tokens, verification status, terms acceptance and security timestamps. Your email address is used temporarily to send a requested verification message; it is not written in account records. Verification codes are stored only as hashes and expire after 10 minutes. No account saves or campaigns are accessible before verification.",
    "- Account and recovery saves, including your hero and adventure. Current saves are readable by the host. Up to 20 encrypted historical versions per saved account, campaign or recovery code are also kept locally for recovery. These backups are on the host's machine, not an independent off-site backup.",
    "- Shared campaigns: membership, host/player roles, player names, characters, story, game state and recent turn identifiers. Other members can see the shared story and party details. The server validates and commits shared actions and rolls dice.",
    "- Feedback: your note, rating, optional name, your hero's name, class, level and spells, where you are in the game, your last two turns (what you wrote, the Dungeon Master's words and the dice and rulings), any errors the game showed you, the game's version, and a short description of your device and how the game ran on it (such as \"Android phone\", the screen size, how long the game took to load, and your sound and display settings). You can leave out your turns and the errors by turning off \"Include what happened\" before you send. A note is kept with a pseudonymous label for your browser or account (see Service records), so the host can match it to the game's own record of what went wrong. Feedback is kept by the host and, when configured, forwarded with these details to the dedicated game mailbox.",
    "- Service records: mechanical security events and timestamps, pseudonymous account/campaign identifiers, response status, request counts and AI usage totals (never the words themselves in usage logs). The services count requests, wrong pairing codes and wrong passwords. Daily usage counters survive restarts; shorter request windows are held in memory. Security logs rotate when they reach 1 MB."
   ]
  },
  {
   "heading": "What goes to other companies",
   "paragraphs": [
    "- OpenAI. The Dungeon Master is an AI model run by OpenAI. To write the next part of your story, the host's computer sends OpenAI what you type into the game, your hero (name, description, backstory, scores and gear), the story so far and the state of the game, and asks for story text. It also asks OpenAI to paint portraits of heroes and of the people you meet from their descriptions, and pictures of places. With each request from a phone or the tester link it sends that browser's label (see Service records), so that if anyone misuses the game, OpenAI can tell that player apart from the host and from everyone else. OpenAI processes this under its API terms; at the time of writing OpenAI says it does not use API data to train its models and keeps it for up to 30 days to watch for abuse. Check OpenAI's current policies. Do not type anything into the game that you would not want processed this way: it is a game, not a place for personal, financial or health information.",
    "- Cloudflare. The internet (tester) link runs through Cloudflare's tunnel service, so your traffic passes through Cloudflare, which sees your network address as any website host would. Unencrypted remote play is disabled; use the HTTPS game link.",
    "- Your browser's voices. If you turn on the narrator voice (Settings → Sound), your browser reads the Dungeon Master's words aloud. Some voices, marked online or natural, are spoken by the browser maker's servers (Microsoft for Edge, Google for Chrome, Apple for Safari), which then receive that text. The setting is off unless you turn it on.",
    "- Google/Gmail. Verification emails contain your address and a one-use code. Feedback forwarded to the game mailbox contains the feedback and context listed above. Google processes this mail under its own policies; messages may remain in the game mailbox until the host deletes them. Transactional verification is not consent to marketing.",
    "The game includes no advertising or tracking scripts. The services above receive only the data needed for their described functions."
   ]
  },
  {
   "heading": "Why",
   "paragraphs": [
    "The host processes this data to run the game you asked to play (to carry your adventure from one turn to the next, to let you sign in on another device, to let several people share a table), to keep the services safe from abuse (counting wrong codes and passwords) and to improve the game (your feedback notes). Where European or UK data-protection law applies, the legal bases are the performance of a contract with you (the game itself), the host's legitimate interests (security and improvement) and, for optional features such as accounts and feedback, your consent, which you give by using them and may withdraw by deleting your account or asking the host."
   ]
  },
  {
   "heading": "How long",
   "paragraphs": [
    "- Current saves remain until you or the host delete them. Recovery-code storage accepts up to 200 saves; when full, new saves are refused instead of deleting an existing save.",
    "- Account sessions expire after 7 days, or after 12 hours without a server request. Sign out all devices revokes all account sessions immediately.",
    "- Account deletion removes that account's current save, password, sessions and its account backup versions. Campaigns owned by that account are removed. Shared campaign content and recovery-code copies are separate: ask the host to remove those, including relevant historical copies.",
    "- Backup history keeps up to 20 versions per save or campaign. The host must protect and periodically copy the backup key and data to a separate secure location if independent recovery is needed.",
    "- Daily request counters are replaced when a new UTC day begins. Security logs retain the current and previous rotated file; feedback and Gmail messages remain until the host deletes them.",
    "- Invitation and pairing lifetimes depend on the host's sharing settings. Campaign invites expire after 7 days and can be replaced by the campaign host."
   ]
  },
  {
   "heading": "Your choices and rights",
   "paragraphs": [
    "- Delete your account under Settings → Your account → Manage account: this removes the account and its saved adventure from the host's computer.",
    "- Turn off the recovery-code copy under Settings → Recovery code.",
    "- Clear your browser's site data to remove everything the game keeps on your device.",
    "- Ask the host to delete your saved adventures, your feedback or anything else about you, to tell you what they hold, or to correct it: use the Feedback form in the game or contact the host directly. Where the law gives you rights of access, rectification, erasure, restriction, portability (Settings → Move your hero gives you your save as a code) and objection, the host will honour them, and you may complain to your data-protection authority."
   ]
  },
  {
   "heading": "Children",
   "paragraphs": [
    "Questbound tells stories with violence and, at the player's choice, graphic violence. It is for players aged 16 and over. The host does not knowingly keep accounts or data for anyone younger; if you believe a child has used the game, tell the host and the data will be deleted."
   ]
  },
  {
   "heading": "Security",
   "paragraphs": [
    "Passwords use salted scrypt hashes. Remote play requires HTTPS. Account cookies are HttpOnly and SameSite=Strict, and Secure over HTTPS. Campaign permissions are checked on the server. These safeguards reduce risk but do not guarantee that every vulnerability, outage or data loss is prevented. Do not share passwords or invite codes, and protect the devices you use. Local account folders separate ordinary gameplay; they do not prevent another person controlling your browser or computer from reading its local storage."
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
    "- Use an email address you control and complete verification. Protect your password, sessions and invites. Report suspected unauthorized access promptly.",
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
    "- Respect the people you play with at a shared table."
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
    "Material changes are dated and presented for renewed acceptance. Unless a lawful agreement says otherwise, mandatory law and consumer protections applicable to you remain in force. No compulsory arbitration clause, exclusive court venue or governing jurisdiction is chosen in this version. If a provision is unenforceable, the remaining provisions apply to the extent permitted by law. Contact the host through Feedback or the game's verification/support mailbox to raise an issue."
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
    "What you type, your hero and the state of your game are sent to the host's computer and from there to OpenAI, which writes the Dungeon Master's replies and paints the pictures. Type nothing you would not want processed that way: no personal, financial or health details, yours or anyone else's."
   ]
  },
  {
   "heading": "Saves in this browser",
   "paragraphs": [
    "Your browser stores your characters, adventures, roster, settings, recovery code, account display information, campaign membership and acceptance of the current terms. Saves are separated by account; guest progress is kept separately and may be imported deliberately. Local saves are not encrypted against someone with access to your device. Clearing site data removes local copies.",
    "Account sign-in uses an HttpOnly cookie that game scripts cannot read. Remote game access also uses a pairing cookie. These are necessary service cookies, not advertising cookies. Old browser-readable account tokens are removed on startup."
   ]
  },
  {
   "heading": "Copies on the host's computer",
   "paragraphs": [
    "Verified accounts, recovery codes and shared campaigns keep saves on the host's computer, with up to 20 encrypted historical copies. Read the privacy policy for retention, access and deletion details."
   ]
  },
  {
   "heading": "Feedback and service records",
   "paragraphs": [
    "Feedback reaches the host and may be emailed to the dedicated game mailbox. A note carries your hero and spells, where you are, your last two turns and any errors the game showed you (you can leave those out) and how the game ran on your device. Verification mail proves you control your address. Security events and persistent daily usage counts help prevent misuse; no marketing email is authorized by this agreement."
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
    "You can withdraw at any time by clearing this browser's site data, deleting your account under Settings → Your account and asking the host to remove any copies. Your agreement is recorded in this browser only (the date and the version of these texts), and you will be asked again when they change."
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
    "The title paintings, the portraits of heroes and people, and the pictures of places are generated with OpenAI's image models at the host's request. The icons, interface and music are Questbound's own."
   ]
  }
 ]
};
export const legalDocuments=[privacyPolicy,termsOfUse,permissionsAgreement,licences];
