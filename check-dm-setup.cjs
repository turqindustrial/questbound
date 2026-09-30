const {generate}=require('./dm-server.cjs');

async function checkSetup({apiKey,model,fetchImpl=fetch}){
 if(typeof apiKey!=='string'||!apiKey.startsWith('sk-')||/[\s"'“”‘’*•…]/.test(apiKey))return {ok:false,kind:'format',message:'Enter the complete secret key without spaces, quotes, or masked characters. It is not the key name.'};
 if(typeof model!=='string'||!model.trim())return {ok:false,kind:'model',message:'Enter an API model ID.'};
 try{
  await generate({input:'Connection test only. Say: The Dungeon Master is ready.',context:{choices:[],engineResolved:['Connection test only. No game state or world change.']}},{apiKey,model,fetchImpl});
  return {ok:true,message:'OpenAI accepted the key and returned a live DM test reply.'};
 }catch(error){
  // Never print raw exceptions: provider messages can contain credential fragments.
  const message=String(error?.message??'');
  if(/HTTP 401/.test(message))return {ok:false,kind:'authentication',message:'OpenAI rejected this key (401). Re-enter your complete saved secret key. If it is unavailable or no longer active, a replacement is needed. The game has not changed.'};
  if(/HTTP 403/.test(message))return {ok:false,kind:'permission',message:'OpenAI denied this request (403). Check the key permissions and model access.'};
  if(/HTTP 429/.test(message))return {ok:false,kind:'limit',message:'OpenAI reported a usage or billing limit (429). This is not an invalid-key result.'};
  if(/HTTP 404/.test(message))return {ok:false,kind:'model',message:'OpenAI could not find the configured model or resource (404). Check the model ID and access.'};
  return {ok:false,kind:'connection',message:'The live DM check did not finish successfully. Check the connection and try again. No key details were logged.'};
 }
}
if(require.main===module)checkSetup({apiKey:process.env.OPENAI_API_KEY,model:process.env.OPENAI_MODEL}).then(result=>{console.log(result.message);process.exitCode=result.ok?0:1;});
module.exports={checkSetup};
