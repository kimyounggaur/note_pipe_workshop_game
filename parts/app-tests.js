// 10 TESTS · exercise the real transition functions with isolated progress.
// Browser-only rendering checks stay NOT_RUN when no real DOM is present.
function runAppTests() {
 const results=[],expect=(v,m)=>{if(!v)throw new Error(m||'assertion failed');};
 const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const test=(id,name,fn)=>{try{const detail=fn();results.push({id,name,pass:true,detail:detail||''});}catch(e){results.push({id,name,pass:false,error:e.message});}};
 const notRun=(id,name,reason)=>results.push({id,name,pass:null,status:'NOT_RUN',error:reason});
 const original={save,S:JSON.parse(JSON.stringify(S)),render,focusMain,begin,persist,clearWater,stop:audioEngine.stop,checkSound};
 const fixture=fn=>{
  try{
   save=defaultSave();save.settings.soundChecked=true;save.scenes=['S1','S2','S3','S4'];
   render=()=>{};focusMain=()=>{};begin=()=>{};persist=()=>{};clearWater=()=>{};checkSound=()=>{};audioEngine.stop=()=>{};
   setState({screen:'work',day:0,idx:0,phase:'count',sub:'ready',tool:'tie',joints:[],tries:0,assisted:false,bad:[],dead:[],picked:null,label:'',msg:{tone:'',text:''},valve:'',marks:null,hearing:false,results:[],retry:[],repeating:false,retryPos:0,free:false,freeSeed:null,scene:null,sceneSide:'a',sceneReturn:'work',sheet:'',lowOk:true,bpm:60});
   return fn();
  } finally {
   save=original.save;Object.assign(S,original.S);render=original.render;focusMain=original.focusMain;begin=original.begin;persist=original.persist;clearWater=original.clearWater;audioEngine.stop=original.stop;checkSound=original.checkSound;
  }
 };
 test('JD-07','종료 직후 재시작 보호와 떼기',()=>fixture(()=>{
  const savedPlay=audioEngine.play,savedStart=audioEngine.valveStart,savedStop=audioEngine.valveStop;
  try{
   let starts=0,stops=0;
   audioEngine.play=()=>null;audioEngine.valveStart=()=>{starts++;return false;};audioEngine.valveStop=()=>{stops++;return false;};
   begin=original.begin;setState({day:1,phase:'valve',joints:truthNow().joints,sub:'result'});
   valveDown();expect(!running(),'Rejected restart left the application in countin/run without a playback');
   const before=S.sub;valveUp();expect(S.sub===before&&stops===1,'Release changed application phase');
   expect(starts<=1,'Single press started multiple valve actions');
  }finally{audioEngine.play=savedPlay;audioEngine.valveStart=savedStart;audioEngine.valveStop=savedStop;}
 }));
 test('JD-08','밸브 최고 솜씨 보존',()=>{
  expect(bestValve('매끈','기계')==='매끈');expect(bestValve('한 곳 샘','여러 곳 샘')==='한 곳 샘');
  expect(bestValve('기계','매끈')==='매끈');expect(bestValve('','기계')==='기계');
 });
 test('ST-01','허용하는 단계 전이',()=>fixture(()=>{
  startJob(0);confirmCount();expect(S.phase==='count','Empty answer advanced');
  pick(countAnswer(truthNow(),seedNow().q));confirmCount();expect(S.phase==='deliver','Correct count did not deliver');
  nextJob();expect(S.idx===1&&S.phase==='count','Next count did not start');
  setState({day:1,idx:0});startJob(0);setState({joints:truthNow().joints.slice()});inspectNow();expect(S.phase==='valve','Correct pipe did not open valve');
  setState({sub:'run'});toDeliver();expect(S.phase==='valve','Running valve delivered');
  setState({sub:'ready'});toDeliver();expect(S.phase==='deliver','Ready valve did not deliver');
  save.cards.plain.got=true;openBookCard('plain');finishScene();expect(S.screen==='book'&&!save.scenes.includes('card'),'Book card polluted discovery scene records');
 }));
 test('ST-02','상태 변경 통로',()=>{
  expect(/Object\.assign\(S,\s*patch\)/.test(setState.toString()),'setState no longer owns assignments');
  const handlers=[startDay,startJob,pick,confirmCount,applyTool,inspectNow,toDeliver,nextJob,closeDay,openScene,finishScene,setSceneSide,startFree,openBookCard,openScreen];
  expect(handlers.every(fn=>!(/S\.[A-Za-z_$][\w$]*\s*=(?!=)/.test(fn.toString()))),'A transition function assigns a state field directly');
 });
 test('ST-03','두 번째 오답 뒤 도움과 진행',()=>fixture(()=>{
  startJob(0);const ans=countAnswer(truthNow(),seedNow().q),wrong=countChoices(truthNow(),seedNow().q).filter(k=>k!==ans);
  pick(wrong[0]);confirmCount();expect(S.assisted&&S.tries===1&&S.dead.includes(wrong[0]),'First wrong answer was not removed');
  pick(wrong[1]);confirmCount();expect(S.tries===2&&S.picked===ans,'Second wrong answer did not select the correct answer');
  confirmCount();expect(S.phase==='deliver'&&S.results[0].recipe==='half','Assisted count was not recorded as half');
  setState({day:1,idx:0,results:[]});startJob(0);inspectNow();inspectNow();expect(equal(S.joints,truthNow().joints)&&S.tries===2,'Second inspection did not repair joints');
  inspectNow();toDeliver();expect(S.results[0].recipe==='half','Assisted pipe was not recorded as half');
 }));
 const browser=typeof HTMLElement!=='undefined'&&$('app') instanceof HTMLElement;
 if(browser)test('ST-04','재생 중 초점과 잠금',()=>fixture(()=>{
  render=original.render;focusMain=original.focusMain;
  setState({day:1,idx:0,phase:'valve',joints:makeJob(DAYS[1].jobs[0]).joints,sub:'run'});
  $('machine').focus();expect(document.activeElement===$('machine'),'Playback lock removed keyboard focus');
  expect($('machine').getAttribute('aria-disabled')==='true'&&!$('machine').disabled,'Machine playback lock is not aria-disabled');
  expect($('deliverBtn').getAttribute('aria-disabled')==='true'&&!$('deliverBtn').disabled,'Delivery playback lock is not aria-disabled');
  setState({sub:'ready'});toDeliver();expect(document.activeElement===$('next'),'Delivery did not move focus to next request');
 }));else notRun('ST-04','재생 중 초점과 잠금','Real browser DOM is required');
 test('ST-05','이어하기와 재시도 순서 복원',()=>fixture(()=>{
  save.days.d0.passed=true;
  save.active={day:'d1',index:2,retry:[0,2],results:[{recipe:1,valve:0},{recipe:2,valve:3},{recipe:1,valve:0},{recipe:2,valve:0},{recipe:2,valve:0},{recipe:2,valve:0}],repeating:true,retryPos:1};
  const restored=validateSave(save);expect(restored?.active?.repeating===true&&restored.active.retryPos===1,'Save validation dropped repeating/retryPos');
  save=restored;startDay(1,true);expect(S.repeating&&S.retryPos===1&&equal(S.retry,[0,2]),'Retry queue or cursor was not restored');
 }));
 test('ST-06','도움 받은 의뢰의 한 번 재등장',()=>fixture(()=>{
  const n=DAYS[0].jobs.length;setState({day:0,idx:n-2,phase:'deliver',results:Array.from({length:n-1},(_,i)=>({recipe:i===1?'half':'full',valve:'–'}))});
  nextJob();expect(S.repeating&&S.idx===1&&equal(S.retry,[1]),'Assisted request was not inserted before final');
  setState({assisted:false,phase:'count'});toDeliver();expect(S.results[1].recipe==='half','Retry result replaced the first-attempt score');
  nextJob();expect(!S.repeating&&S.idx===n-1,'Retry did not return to final request exactly once');
  setState({phase:'count',assisted:false});toDeliver();nextJob();expect(save.days.d0.best===5&&save.days.d0.passed,'Daily pass score included retry results or wrong threshold');
 }));
 if(browser)test('CT-01','그림과 엔진 출력 일치',()=>fixture(()=>{
  render=original.render;
  for(let d=0;d<DAYS.length;d++)for(let i=0;i<DAYS[d].jobs.length;i++){
   setState({screen:'work',day:d,idx:i,phase:'deliver',sub:'ready',joints:makeJob(DAYS[d].jobs[i]).joints});
   const job=truthNow(),curves=toCurves(job);
   expect(document.querySelectorAll('#pipes .bell').length===bells(job),'Bell count differs: '+job.id);
   expect(document.querySelectorAll('#score .curve').length===curves.all.length,'Curve count differs: '+job.id);
   expect($('readoutText').textContent.includes(soundLine(job)),'Sound readout differs: '+job.id);
   if(seedNow().ask==='count'){
    setState({phase:'count'});
    expect(equal(Array.from($('choices').children).map(b=>b.dataset.key),countChoices(job,seedNow().q)),'Count choices differ: '+job.id);
   }
  }
 }));else notRun('CT-01','그림과 엔진 출력 일치','Real browser SVG/DOM is required');
 test('CT-02','붙임줄 용어 잠금',()=>{
  const copy=CARDS.map(c=>c.text).join(' ')+briefText.toString()+causeText.toString()+countText.toString();
  expect(!copy.includes('같은 음이면 붙임줄'),'Forbidden shortcut phrase was introduced');
  expect(CARDS.find(c=>c.tag==='tie').text.includes('같은 높이의 이웃한 두 음'),'Tie definition lost adjacency qualification');
 });
 notRun('CT-03','320px 문구 두 줄 이내','All 295 text variants require separate browser viewport measurements');
 if(browser){try{original.render();}catch(_){/* Do not hide verification results if restoring a test screen. */}}
 return results;
}
