// The one switch for accounts. While it is false (the beta), nobody has to sign in: a browser without a session is
// given an anonymous guest identity and plays with it, and creating an account in Settings stays an offer. At release,
// set it to true: play then needs a signed-in, email-verified account again. The account service reads this same line
// from this file (account-server.cjs), and QUESTBOUND_REQUIRE_ACCOUNTS=1 turns the requirement on for a hosted game.
export const accountsRequired=false;
export {tidyEmail,emailProblem,passwordProblem,accountState,bootstrapAccount,accountsNeeded,guestIdentity,registerAccount,signIn,verifyEmail,signOut,signOutEverywhere,noteSnapshot,saveToAccount,loadFromAccount,releaseHold,changePassword,deleteAccount} from './accountClient';
