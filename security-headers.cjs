// Response headers that keep the game's pages safe in a browser, shared by the desktop server and both gateways.
// A page may run only the game's own scripts (the one inline loading-card script is allowed by its hash, worked out
// from the file being served), talk only to the services it needs, and never be shown inside another site. Styles
// may be inline because React Native Web writes them that way; images may be data: or blob: URLs because the paintings
// arrive as data and the tale card is drawn on a canvas.
const crypto=require('node:crypto'),fs=require('node:fs');
const inlineScriptHashes=html=>[...String(html).matchAll(/<script(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>"'sha256-"+crypto.createHash('sha256').update(m[1],'utf8').digest('base64')+"'");
function pagePolicy(html,{connect=["'self'"]}={}){
 return ["default-src 'self'",["script-src","'self'",...inlineScriptHashes(html)].join(' '),"style-src 'self' 'unsafe-inline'","img-src 'self' data: blob:","font-src 'self' data:",["connect-src",...connect].join(' '),"media-src 'self' data: blob:","worker-src 'none'","object-src 'none'","base-uri 'none'","form-action 'self'","frame-ancestors 'none'","manifest-src 'self'"].join('; ');
}
// Headers for every response: no sniffing, no framing, no referrer, no powerful browser features the game never uses,
// and (on https and on this PC, the only places browsers honour it) a window no other site can reach into.
const baseHeaders={'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer','Permissions-Policy':'camera=(), microphone=(), geolocation=(), payment=(), usb=()','Cross-Origin-Resource-Policy':'same-origin'};
function setBaseHeaders(res,{trustworthy=true}={}){for(const [name,value] of Object.entries(baseHeaders))res.setHeader(name,value);if(trustworthy)res.setHeader('Cross-Origin-Opener-Policy','same-origin');}
// The policy for an HTML file, worked out once per version of the file (its time and size).
function filePolicies({connect}={}){
 const known=new Map();
 return async(file,stat)=>{
  const key=file+':'+stat.mtimeMs+':'+stat.size;let policy=known.get(key);
  if(!policy){policy=pagePolicy(await fs.promises.readFile(file,'utf8'),{connect});known.set(key,policy);if(known.size>20)known.delete(known.keys().next().value);}
  return policy;
 };
}
// Loopback services answer only to their own loopback names, so a web page whose address is made to point at this PC
// (DNS rebinding) is turned away even before its origin is checked.
const loopbackHost=req=>{const port=req.socket.localPort;return ['127.0.0.1:'+port,'localhost:'+port,'[::1]:'+port].includes(String(req.headers.host??'').toLowerCase());};
module.exports={pagePolicy,inlineScriptHashes,baseHeaders,setBaseHeaders,filePolicies,loopbackHost};
