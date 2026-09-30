export function healthAmount(text) {
  if (!/^\d+$/.test(text.trim())) return null;
  const value = Number(text);
  return Number.isSafeInteger(value) && value > 0 && value <= 9999 ? value : null;
}
export function updateHealth(state, maximum, kind, amount) {
  if (!Number.isInteger(maximum) || maximum < 1 || !Number.isInteger(amount) || amount < 1 || amount > 9999) throw new Error('Invalid hit-point amount');
  const before = {current:state?.current ?? maximum,temp:state?.temp ?? 0};
  let current = before.current, temp = before.temp, message;
  if (kind === 'damage') {
    const absorbed = Math.min(temp,amount);
    temp -= absorbed;
    current = Math.max(0,current-(amount-absorbed));
    message = `${amount} damage recorded: ${absorbed} absorbed by temporary HP, ${before.current-current} HP lost.`;
  } else if (kind === 'heal') {
    current = Math.min(maximum,current+amount);
    message = `Restored ${current-before.current} HP.`;
  } else if (kind === 'temporary') {
    temp = amount;
    message = `Temporary HP set to ${amount}; the previous amount was replaced.`;
  } else throw new Error('Unknown health action');
  return {current,temp,previous:before,message};
}
