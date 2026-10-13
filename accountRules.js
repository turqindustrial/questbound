// The one switch for accounts. While it is false (the beta), nobody has to sign in: a browser without a session is
// given an anonymous guest identity and plays with it, and creating an account in Settings stays an offer. At release,
// set it to true: play then needs a signed-in, email-verified account again. The account service reads this same line
// from this file (account-server.cjs), and QUESTBOUND_REQUIRE_ACCOUNTS=1 turns the requirement on for a hosted game.
export const accountsRequired=false;
// Whether anything about accounts is offered: the switch, or the host's service requiring accounts. While it is not
// (the beta), players never see an account: no sign-up, sign-in or recovery code in Settings, no prompt on the title,
// and saves stay in this browser (cloudRules.js uploads nothing). The silent guest identity stays: the shared table and
// the per-player AI allowances need it, and players never see it.
import {accountsNeeded as hostNeedsAccounts} from './accountClient';
export const accountsOffered=()=>accountsRequired||hostNeedsAccounts();
export {tidyEmail,emailProblem,passwordProblem,accountState,bootstrapAccount,accountsNeeded,guestIdentity,registerAccount,signIn,verifyEmail,signOut,signOutEverywhere,noteSnapshot,saveToAccount,loadFromAccount,releaseHold,changePassword,deleteAccount} from './accountClient';
