const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const backend=new Map(),storage={getItem:k=>backend.get(k)??null,setItem:(k,v)=>backend.set(k,String(v)),removeItem:k=>backend.delete(k)};
const document={addEventListener(){},hidden:false,getElementById(){return null},querySelector(){return null}};
const window={localStorage:storage,addEventListener(){}};
const ctx=vm.createContext({console,document,window,performance,requestAnimationFrame:()=>0,cancelAnimationFrame(){},innerWidth:390,innerHeight:844,location:{hash:''}});
for(const part of ['engine','curriculum','storage','audio','view','app','app-tests']){
 let text=fs.readFileSync(path.join(root,'parts',part+'.js'),'utf8');
 if(part==='app')text=text.replace(/\nboot\(\);\s*$/,'\n');
 vm.runInContext(text,ctx,{filename:part+'.js'});
}
const results=vm.runInContext('runAppTests()',ctx);
for(const t of results)console.log(`${t.pass===null?'NOT_RUN':t.pass?'PASS':'FAIL'} ${t.id} ${t.name}${t.error?' — '+t.error:''}`);
console.log(JSON.stringify({passed:results.filter(x=>x.pass).length,total:results.length,notRun:results.filter(x=>x.pass===null).length,failed:results.filter(x=>x.pass===false)},null,2));
process.exitCode=results.some(x=>x.pass===false)?1:0;
