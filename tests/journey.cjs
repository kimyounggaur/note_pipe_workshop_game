const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),records=new Map();let writes=0;
const storage={getItem:k=>records.get(k)??null,setItem:(k,v)=>{writes++;records.set(k,String(v));},removeItem:k=>records.delete(k)};
const document={addEventListener(){},hidden:false,getElementById(){return null},querySelector(){return null}};
const window={localStorage:storage,addEventListener(){}};
const ctx=vm.createContext({console,document,window,performance,requestAnimationFrame:()=>0,cancelAnimationFrame(){},innerWidth:390,innerHeight:844,location:{hash:''}});
for(const part of ['engine','curriculum','storage','audio','view','app','journey-tests']){
 let source=fs.readFileSync(path.join(root,'parts',part+'.js'),'utf8');
 if(part==='app')source=source.replace(/\nboot\(\);\s*$/,'\n');
 vm.runInContext(source,ctx,{filename:part+'.js'});
}
const originalWrites=writes,results=vm.runInContext('runJourneyTests()',ctx);
for(const r of results)console.log(`${r.pass?'PASS':'FAIL'} ${r.id} ${r.name}${r.error?' — '+r.error:''}${r.detail?' — '+r.detail:''}`);
if(writes!==originalWrites){console.error('Journey tests wrote to live localStorage');process.exitCode=1;}
console.log(JSON.stringify({suite:'journey',passed:results.filter(r=>r.pass).length,total:results.length,persistentWrites:writes-originalWrites},null,2));
if(results.some(r=>!r.pass))process.exitCode=1;
