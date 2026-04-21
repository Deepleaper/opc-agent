const{StudioServer}=require('./dist/studio/server');
const s=new StudioServer({port:4000,agentDir:process.cwd(),workDir:process.cwd()});
s.start().then(()=>console.log('UP')).catch(e=>console.error(e));
