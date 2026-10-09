import AsyncStorage from '@react-native-async-storage/async-storage';
// Namespaces prevent accidental cross-account save adoption on a shared browser.
// This is local separation, not encryption against someone who controls the device.
let profile='guest';
const listeners=new Set();
export const currentProfile=()=>profile;
export const profileKey=(key,id=profile)=>'questbound.profile.'+id+'.'+key;
export const subscribeProfile=fn=>{listeners.add(fn);return()=>listeners.delete(fn);};
export function selectProfile(id){const next=/^[a-f0-9]{64}$/.test(id??'')?id:'guest';if(next===profile)return;profile=next;listeners.forEach(fn=>fn(next));}
function scope(id=profile){return {
 async getItem(key){const saved=await AsyncStorage.getItem(profileKey(key,id));if(saved!==null||id!=='guest')return saved;const legacy=await AsyncStorage.getItem(key);if(legacy!==null)await AsyncStorage.setItem(profileKey(key,id),legacy);return legacy;},
 setItem:(key,value)=>AsyncStorage.setItem(profileKey(key,id),value),
 removeItem:key=>AsyncStorage.removeItem(profileKey(key,id)),
 };}
export default {scope,getItem:key=>scope().getItem(key),setItem:(key,v)=>scope().setItem(key,v),removeItem:key=>scope().removeItem(key)};
