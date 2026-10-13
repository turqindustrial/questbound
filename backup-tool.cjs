// Export for review; never overwrites a live save. Stop the services before a host performs restoration.
const fs=require('node:fs'),path=require('node:path'),{createOperations}=require('./operations.cjs'),{validSnapshot}=require('./campaigns.cjs');
const ops=createOperations(),[command,id,version]=process.argv.slice(2);
try{
 if(command==='verify')console.log(JSON.stringify(ops.backup.verify()));
 else if(command==='list')console.log(ops.backup.list(id).join('\n'));
 else if(command==='export'){
  const data=ops.backup.read(id,version),snapshot=data.snapshot;
  if(!validSnapshot(snapshot))throw Error('Backup failed adventure validation.');
  const out=path.resolve(process.env.QUESTBOUND_DATA||__dirname,'.questbound-restored-'+id+'.json');fs.writeFileSync(out,JSON.stringify(data,null,2),{flag:'wx',mode:0o600});console.log('Validated backup exported for review. Existing saves were not changed.');
 }else console.log('Usage: node backup-tool.cjs verify | list <backup-id> | export <backup-id> <version>');
}catch{console.error('Backup operation failed. No active save was changed.');process.exitCode=1;}
