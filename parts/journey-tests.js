// Supplemental journey checks. Exercise actual game transitions, with all writes
// confined to an isolated save and with audio/rendering replaced by no-op sinks.
function runJourneyTests() {
 const out=[],assert=(v,m)=>{if(!v)throw new Error(m||'assertion failed');},same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const test=(id,name,fn)=>{try{const detail=fn();out.push({id,name,pass:true,detail:detail||''});}catch(e){out.push({id,name,pass:false,error:e.message});}};
 const beforeMemory=JSON.stringify(store.memory),beforeSave=save,beforeState=JSON.stringify(S);
 const fixture=fn=>{
  const original={save,state:JSON.parse(JSON.stringify(S)),render,focusMain,begin,persist,clearWater,checkSound,stop:audioEngine.stop,valved:audioEngine.valved,endedAt:audioEngine.endedAt,focused:typeof document!=='undefined'?document.activeElement:null};
  try{
   render=()=>{};focusMain=()=>{};begin=()=>{};persist=()=>{};clearWater=()=>{};checkSound=()=>{};audioEngine.stop=()=>{};
   save=defaultSave();save.settings.soundChecked=true;
   setState({screen:'title',day:0,idx:0,phase:'count',sub:'ready',tool:'tie',joints:[],tries:0,assisted:false,bad:[],dead:[],picked:null,label:'',msg:{tone:'',text:''},valve:'',marks:null,hearing:false,results:[],retry:[],repeating:false,retryPos:0,free:false,freeSeed:null,scene:null,sceneSide:'a',sceneReturn:'work',sheet:'',lowOk:true,bpm:60,soundUnavailable:false,currentResult:null});
   return fn();
  }finally{
   save=original.save;for(const key of Object.keys(S))if(!(key in original.state))delete S[key];Object.assign(S,original.state);
   render=original.render;focusMain=original.focusMain;begin=original.begin;persist=original.persist;clearWater=original.clearWater;checkSound=original.checkSound;audioEngine.stop=original.stop;audioEngine.valved=original.valved;audioEngine.endedAt=original.endedAt;
   if(original.focused?.isConnected)original.focused.focus({preventScroll:true});
  }
 };
 function finishDiscovery(log){
  assert(!!S.scene,'No discovery is active');const id=S.scene.id,idx=S.idx,day=S.day;
  if(log)log.push(id);
  setSceneSide('b');assert(S.sceneSide==='b'&&seedNow().id===id+'b','Discovery comparison B did not open');
  setSceneSide('a');assert(S.sceneSide==='a'&&seedNow().id===id+'a','Discovery comparison A did not reopen');
  finishScene();assert(!S.scene&&S.idx===idx&&S.day===day,'Discovery consumed or changed the next request');
  assert(save.scenes.includes(id),'Discovery was not marked seen');
 }
 function solveCurrent(help=false,valve='–'){
  assert(!S.scene,'Finish discovery before solving request');const id=seedNow().id;
  if(S.phase==='count'){
   const job=truthNow(),seed=seedNow(),answer=countAnswer(job,seed.q);
   if(help){const wrong=countChoices(job,seed.q).find(k=>k!==answer);pick(wrong);confirmCount();assert(S.assisted&&S.phase==='count','Wrong count skipped its help step');}
   pick(answer);confirmCount();
  }else{
   assert(S.phase==='pipe','Unexpected request phase: '+S.phase);
   const truth=truthNow();
   if(help){inspectNow();assert(S.assisted,'Wrong pipe did not mark help');}
   for(let k=0;k<truth.joints.length;k++){setState({tool:truth.joints[k]});applyTool(k);}
   assert(same(mineNow().joints,truth.joints),'Tools did not construct target joints for '+id);
   inspectNow();assert(S.phase==='valve','Pipe inspection did not open valve for '+id);
   if(valve!=='–')setState({valve});toDeliver();
  }
  assert(S.phase==='deliver','Request did not reach delivery: '+id);
  return id;
 }
 function finishDay(helpIndices=[],valve='–'){
  let guard=0;const deliveries=[],retries=[],scenes=[];
  while(S.screen==='work'&&guard++<100){
   if(S.scene){finishDiscovery(scenes);continue;}
   const retry=S.repeating,idx=S.idx;
   const id=solveCurrent(!retry&&helpIndices.includes(idx),valve);deliveries.push(id);if(retry)retries.push(id);
   nextJob();
  }
  assert(guard<100&&S.screen==='close','Day did not terminate');return{deliveries,retries,scenes};
 }
 test('JY-01','49개 의뢰와 발견 장면 4개 완주',()=>fixture(()=>{
  const delivered=[],scenes=[];
  for(let d=0;d<DAYS.length;d++){
   startDay(d);assert(S.screen==='work'&&S.day===d,'Unlocked day did not start');
   const run=finishDay();delivered.push(...run.deliveries);scenes.push(...run.scenes);
   assert(run.retries.length===0,'First-pass run unexpectedly repeated requests');
   assert(save.days['d'+d].passed&&save.days['d'+d].best===DAYS[d].jobs.length,'Clean day was not passed');
   assert(S.results.length===DAYS[d].jobs.length&&S.results.every(r=>r.recipe==='full'),'First-pass results are incomplete');
  }
  assert(same(delivered,DAYS.flatMap(d=>d.jobs.map(s=>s.id))),'Actual delivery order differs from all 49 design seeds');
  assert(same(scenes,['S1','S2','S3','S4']),'Discovery sequence differs');
  assert(save.stats.jobs===49&&save.stats.clean===49,'First-pass statistics differ');
  assert(SAVE_CARD_KEYS.every(k=>save.cards[k].got),'Clean progression did not award all eight cards');
  assert(save.active===null,'Closed day left an active save');
  return '49/49 deliveries, S1–S4, seven passes, eight cards';
 }));
 test('JY-02','80% 통과 기준과 다음 작업일 잠금',()=>fixture(()=>{
  startDay(1);assert(S.screen==='title','Locked day opened before previous pass');
  startDay(0);const fail=finishDay([0,1]);assert(!save.days.d0.passed&&save.days.d0.best===4,'Four of six incorrectly passed');
  assert(fail.retries.length===2,'Two assisted requests did not repeat once each');
  startDay(1);assert(S.screen==='close'&&S.day===0,'Failed previous day unlocked next day');
  startDay(0);const pass=finishDay([0]);assert(save.days.d0.passed&&save.days.d0.best===5,'Five of six did not meet the threshold');
  assert(pass.retries.length===1,'One assisted request repeated incorrectly');
  startDay(1);assert(S.screen==='work'&&S.day===1,'Passing previous day did not unlock next day');
 }));
 test('JY-03','재의뢰 순서와 첫 결과 보존',()=>fixture(()=>{
  startDay(0);const run=finishDay([1,3]);
  assert(same(run.deliveries,['d0-01','d0-02','d0-03','d0-04','d0-05','d0-02','d0-04','d0-06']),'Assisted requests were not inserted before final in original order');
  assert(same(run.retries,['d0-02','d0-04']),'Retry queue was not consumed once');
  assert(S.results[1].recipe==='half'&&S.results[3].recipe==='half','Retry overwrote first-attempt records');
  assert(save.days.d0.best===4&&!save.days.d0.passed,'Retries inflated daily pass score');
  assert(save.stats.jobs===6&&save.stats.clean===4,'Retry deliveries inflated first-attempt statistics');
 }));
 test('JY-04','도움받은 카드의 재의뢰 획득',()=>fixture(()=>{
  save.days.d0.passed=true;save.scenes=['S1','S2','S3','S4'];startDay(1);
  const first=solveCurrent(true);assert(first==='d1-01'&&!save.cards.tie.got,'Half result incorrectly awarded a card');nextJob();
  let guard=0,gotOnRetry=false;
  while(S.screen==='work'&&guard++<30){
   if(S.scene){finishDiscovery();continue;}
   const id=seedNow().id,retry=S.repeating;if(retry&&id==='d1-01')assert(!save.cards.tie.got,'A helped original request awarded the tie card before retry');solveCurrent(!retry);
   if(retry&&id==='d1-01'){gotOnRetry=save.cards.tie.got;assert(S.results[0].recipe==='half','Card retry overwrote original half result');}
   nextJob();
  }
  assert(guard<30&&gotOnRetry,'Correct retry did not award its connection card');
 }));
 test('JY-05','기계 밸브와 매끈 카드 기록 구분',()=>fixture(()=>{
  save.days.d0.passed=true;save.scenes=['S1','S2','S3','S4'];startDay(1);solveCurrent(false,'기계');
  assert(save.cards.tie.got&&save.cards.tie.valve===0,'Machine valve earned a smooth card badge');
  startJob(0);solveCurrent(false,'매끈');assert(save.cards.tie.valve===3,'Manual smooth result did not upgrade card skill');
  startJob(0);solveCurrent(false,'기계');assert(save.cards.tie.valve===3,'Later machine play erased manual best');
 }));
 test('JY-06','음소거·소리 불가의 설계도 대체',()=>fixture(()=>{
  const soundJobs=[];
  for(let d=0;d<DAYS.length;d++)for(let i=0;i<DAYS[d].jobs.length;i++)if(DAYS[d].jobs[i].ask==='sound')soundJobs.push([d,i]);
  assert(soundJobs.length===3,'Sound-job seed count changed');
  for(const[d,i]of soundJobs){
   setState({screen:'work',day:d,idx:i,scene:null,free:false,soundUnavailable:false});save.settings.muted=false;
   const truth=makeJob(rawSeedNow());assert(seedNow().ask==='sound','Sound request disappeared while sound was available');
   save.settings.muted=true;assert(seedNow().ask==='score'&&seedNow().soundFallback,'Muted sound request did not become readable score');
   assert(same(makeJob(seedNow()),truth),'Muted fallback changed theory seed');
   save.settings.muted=false;setState({soundUnavailable:true});assert(seedNow().ask==='score'&&seedNow().soundFallback,'Unavailable audio did not reveal readable score');
   setState({soundUnavailable:false});assert(seedNow().ask==='sound','Recovered audio did not restore sound request');
  }
  return 'd3-02, d3-05, d5-06 retain identical notes and joints';
 }));
 test('JY-07','도면 카드 8장의 열기와 복귀',()=>fixture(()=>{
  for(const tag of SAVE_CARD_KEYS)save.cards[tag].got=true;
  for(const card of CARDS){openBookCard(card.tag);assert(S.scene?.id==='card'&&S.scene.title===card.title,'Book card did not open: '+card.tag);finishScene();assert(S.screen==='book'&&!S.scene,'Book card did not return to collection');assert(!save.scenes.includes('card')&&validateSave(save)!==null,'Book card corrupted scene storage');}
 }));
 test('JY-08','검사 전후 실제 기록 보존',()=>{
  assert(save===beforeSave&&JSON.stringify(S)===beforeState,'Journey fixture changed the live application state');
  assert(JSON.stringify(store.memory)===beforeMemory,'Journey fixture changed the real storage memory');
  return 'No persistent writes; original save and state restored';
 });
 return out;
}
