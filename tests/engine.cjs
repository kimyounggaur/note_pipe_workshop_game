const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const ctx=vm.createContext({console});
vm.runInContext(fs.readFileSync(path.join(root,'parts/engine.js'),'utf8'),ctx);
const curriculum=path.join(root,'parts/curriculum.js');
if(fs.existsSync(curriculum))vm.runInContext(fs.readFileSync(curriculum,'utf8'),ctx);
else {
 const appendix=fs.readFileSync(path.join(root,fs.existsSync(path.join(root,'docs/design/음표파이프공방_설계서_5_부록B.md'))?'docs/design/음표파이프공방_설계서_5_부록B.md':'upload/음표파이프공방_설계서_5_부록B.md'),'utf8');
 const source=appendix.match(/```js\n([\s\S]*?)\n```/)[1].replace('export const DAYS','const DAYS');
 vm.runInContext(source,ctx);
}
const results=vm.runInContext('runEngineTests(DAYS)',ctx);
for(const test of results)console.log(`${test.pass?'PASS':'FAIL'} ${test.id}${test.error?': '+test.error:''}${test.detail?' — '+test.detail:''}`);
console.log(JSON.stringify({suite:'engine',passed:results.filter(x=>x.pass).length,total:results.length,failed:results.filter(x=>!x.pass)},null,2));
process.exitCode=results.every(x=>x.pass)?0:1;

// Verify every locked B.3 output directly against the unchanged uploaded source.
const appendix=fs.readFileSync(path.join(root,fs.existsSync(path.join(root,'docs/design/음표파이프공방_설계서_5_부록B.md'))?'docs/design/음표파이프공방_설계서_5_부록B.md':'upload/음표파이프공방_설계서_5_부록B.md'),'utf8');
const locked=appendix.split('곡선과 밸브의 표다.')[1].split('### B.4')[0].split('\n').filter(l=>/^\| d\d-\d\d \|/.test(l)).map(l=>l.split('|').slice(1,-1).map(x=>x.trim()));
ctx.__locked=locked;
const golden=vm.runInContext(`__locked.map(row=>{
 const seed=DAYS.flatMap(d=>d.jobs).find(s=>s.id===row[0]),job=makeJob(seed),C=toCurves(job);
 const span=list=>list.length?list.map(([a,b])=>(a+1)+'–'+(b+1)).join(', '):'–';
 const actual=[job.id,String(bells(job)),String(streams(job).length),span(C.ties),span(C.slurs),beatsKo(longest(job).dur),sounds(job).map(s=>String(num(s.len))).join(', '),pressPlan(job).map(([a,b])=>str(a)+'~'+str(b)).join(', '),String(pressPlan(job).length)];
 return {id:job.id,pass:JSON.stringify(actual)===JSON.stringify(row),actual,expected:row};
})`,ctx);
console.log(`Locked appendix B.3: ${golden.filter(x=>x.pass).length}/${golden.length}`);
for(const failure of golden.filter(x=>!x.pass))console.error(JSON.stringify(failure));
if(golden.length!==49||golden.some(x=>!x.pass))process.exitCode=1;
