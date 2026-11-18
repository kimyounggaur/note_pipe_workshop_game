const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const context = vm.createContext({window:{}});
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../parts/storage.js'),'utf8')+'\nthis.API={WorkshopStorage,defaultSave,validateSave,SAVE_KEY,SAVE_BACKUP_KEY};',context);
const {WorkshopStorage,defaultSave,validateSave,SAVE_KEY,SAVE_BACKUP_KEY}=context.API;
const plain = v => JSON.parse(JSON.stringify(v));
function mock() {const data=new Map();return {data,getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};}
let passed=0;
function test(name,fn){fn();passed++;console.log('PASS '+name);}
test('SV-01 SaveV1 round trip and deep defaults',()=>{
 const backend=mock(), storage=new WorkshopStorage(backend), save=defaultSave();
 save.settings.volume=.35;save.settings.holdOffsetMs=-85;save.days.d2={passed:true,stamp:1,runs:3,best:7};
 save.active={day:'d2',index:4,retry:[1],results:[{recipe:2,valve:3},{recipe:1,valve:4}]};
 assert.equal(storage.save(save),true);assert.deepEqual(plain(new WorkshopStorage(backend).load()),plain(save));
 const partial=validateSave({version:1,settings:{slow:true},days:{d0:{passed:true}}});
 assert.equal(partial.settings.slow,true);assert.equal(partial.settings.muted,false);assert.equal(partial.days.d0.stamp,0);
 assert.equal(validateSave({version:1,active:{day:'d2',index:99,retry:[],results:[]}}),null);
 const repeating={day:'d2',index:2,retry:[0,2],retryPos:1,repeating:true,phase:'deliver',results:[{recipe:1,valve:0},{recipe:2,valve:3},{recipe:1,valve:1}]};
 save.active=repeating;storage.save(save);
 assert.deepEqual(plain(new WorkshopStorage(backend).load().active),repeating);
 assert.equal(validateSave({version:1,active:{...repeating,retryPos:2}}),null);
 assert.equal(validateSave({version:1,active:{...repeating,index:1}}),null);
 assert.equal(validateSave({version:1,active:{...repeating,phase:'scene'}}),null);
 assert.equal(validateSave({version:1,settings:{volume:Infinity}}),null);
 assert.equal(validateSave({version:1,days:{d0:{best:7}}}),null);
});
test('SV-02 Corruption and future version preserve exact raw text',()=>{
 for(const raw of ['{broken',JSON.stringify({version:2,payload:'future'}),JSON.stringify({version:1,settings:{slow:'yes'}})]){
  const backend=mock();backend.setItem(SAVE_KEY,raw);const storage=new WorkshopStorage(backend);
  assert.deepEqual(plain(storage.load()),plain(defaultSave()));assert.equal(backend.getItem(SAVE_BACKUP_KEY),raw);assert.equal(storage.backupRaw,raw);
 }
});
test('SV-03 Blocked and exhausted storage retain in-memory progress',()=>{
 const blocked={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')},removeItem(){}};
 const storage=new WorkshopStorage(blocked);assert.equal(storage.persistent,false);
 const save=defaultSave();save.stats.jobs=8;assert.equal(storage.save(save),false);assert.equal(storage.load().stats.jobs,8);
 const backend=mock(), quota=new WorkshopStorage(backend);backend.setItem=()=>{throw Error('quota')};
 save.stats.jobs=9;assert.equal(quota.save(save),false);assert.equal(quota.persistent,false);assert.equal(quota.load().stats.jobs,9);
});
test('SV-04 Hyphenated card keys survive round trip',()=>{
 const backend=mock(), storage=new WorkshopStorage(backend),save=defaultSave();
 save.cards['tie-bar']={got:true,valve:3};save.cards['tie-in-slur']={got:true,valve:2};
 storage.save(save);const restored=new WorkshopStorage(backend).load();assert.equal(restored.cards['tie-bar'].got,true);assert.equal(restored.cards['tie-in-slur'].valve,2);
 assert.equal('lowOk' in restored,false);
});
console.log(`${passed}/${passed} storage checks passed`);
