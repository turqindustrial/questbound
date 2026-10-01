const {generate}=require('./dm-server.cjs');

async function checkSetup({apiKey,model,storyModel=null,fetchImpl=fetch}){
 if(typeof apiKey!=='string'||!apiKey.startsWith('sk-')||/[\s"'“”‘’*•…]/.test(apiKey))return {ok:false,kind:'format',message:'Enter the complete secret key without spaces, quotes, or masked characters. It is not the key name.'};
 if(typeof model!=='string'||!model.trim())return {ok:false,kind:'model',message:'Enter an API model ID.'};
 try{
  await generate({input:'Connection test only. Say: The Dungeon Master is ready.',context:{choices:[],engineResolved:['Connection test only. No game state or world change.']}},{apiKey,model,fetchImpl});
 }catch(error){
  // Never print raw exceptions: provider messages can contain credential fragments.
  const message=String(error?.message??'');
  if(/HTTP 401/.test(message))return {ok:false,kind:'authentication',message:'OpenAI rejected this key (401). Re-enter your complete saved secret key. If it is unavailable or no longer active, a replacement is needed. The game has not changed.'};
  if(/HTTP 403/.test(message))return {ok:false,kind:'permission',message:'OpenAI denied this request (403). Check the key permissions and model access.'};
  if(/HTTP 429/.test(message))return {ok:false,kind:'limit',message:'OpenAI reported a usage or billing limit (429). This is not an invalid-key result.'};
  if(/HTTP 404/.test(message))return {ok:false,kind:'model',message:'OpenAI could not find the configured model or resource (404). Check the model ID and access.'};
  return {ok:false,kind:'connection',message:'The live DM check did not finish successfully. Check the connection and try again. No key details were logged.'};
 }
 // A separate story-writer model only has to exist for this key: looking it up costs no tokens.
 if(typeof storyModel==='string'&&storyModel.trim()&&storyModel.trim()!==model.trim()){
  let response;
  try{response=await fetchImpl('https://api.openai.com/v1/models/'+encodeURIComponent(storyModel.trim()),{headers:{Authorization:'Bearer '+apiKey},signal:AbortSignal.timeout(15000)});}
  catch{return {ok:false,kind:'connection',message:'The story writer model could not be checked. Check the connection and try again.'};}
  if(response.status===404)return {ok:false,kind:'story-model',message:'OpenAI could not find the story writer model "'+storyModel.trim()+'" (404). Check its model ID, or press Enter at that prompt to use the play model for stories too.'};
  if(!response.ok)return {ok:false,kind:'story-model',message:'OpenAI did not allow the story writer model "'+storyModel.trim()+'" (HTTP '+response.status+'). Check the key permissions and model access.'};
  return {ok:true,message:'OpenAI accepted the key, returned a live DM test reply, and lists the story writer model.'};
 }
 return {ok:true,message:'OpenAI accepted the key and returned a live DM test reply.'};
}
if(require.main===module)checkSetup({apiKey:process.env.OPENAI_API_KEY,model:process.env.OPENAI_MODEL,storyModel:process.env.OPENAI_STORY_MODEL||null}).then(result=>{console.log(result.message);process.exitCode=result.ok?0:1;});
module.exports={checkSetup};
