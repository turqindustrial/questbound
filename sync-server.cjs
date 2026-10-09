const {createSyncServer}=require('./account-server.cjs');
if(require.main===module){const port=Number(process.env.QUESTBOUND_SYNC_PORT??8086),{server}=createSyncServer();server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'The table is already running on port '+port+'.':'The table could not start.');process.exitCode=1;});server.listen(port,'127.0.0.1',()=>console.log('Questbound accounts and campaigns ready on localhost:'+port+'.'));}
module.exports={createSyncServer};
