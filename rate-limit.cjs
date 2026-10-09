// Bounded sliding windows. New identities cannot grow memory without limit or
// evict another visitor's active restriction. Old windows expire even if that
// visitor never sends another request.
function createLimiter(max,span,{now=Date.now,maxKeys=2048}={}){
 const hits=new Map();
 const limit=key=>{
  if(!max)return 0;
  const t=now();let recent=hits.get(key);
  if(!recent){
   if(hits.size>=maxKeys){for(const [k,v] of hits)if(!v.length||v.at(-1)<=t-span)hits.delete(k);}
   if(hits.size>=maxKeys)return Math.max(1,Math.ceil(span/1000));
   recent=[];hits.set(key,recent);
  }
  while(recent.length&&recent[0]<=t-span)recent.shift();
  if(recent.length>=max)return Math.max(1,Math.ceil((recent[0]+span-t)/1000));
  recent.push(t);return 0;
 };
 return limit;
}
module.exports={createLimiter};
