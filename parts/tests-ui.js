// QA uses a fresh iframe save and never writes learner progress.
function testResultsMarkup(){const list=window.__tests||[],passed=list.filter(x=>x.pass).length;return `${screenNav('공방 자가검사','settings')}<p class="intro">${passed}/${list.length} 통과 · ${list.filter(x=>x.pass===false).length} 실패 · ${list.filter(x=>x.pass===null).length} 미실행</p><p class="small">소리는 모의 AudioContext로 예약·취소를 검증해요. 실제 휴대폰 청취와 강사 검수는 별도예요.</p><table class="test-table"><thead><tr><th>번호</th><th>결과</th><th>확인</th></tr></thead><tbody>${list.map(t=>`<tr><td>${t.id}</td><td class="${t.pass?'pass':'fail'}">${t.pass?'PASS':t.pass===null?'NOT_RUN':'FAIL'}</td><td>${screenEscape(t.error||t.detail||t.name||'')}</td></tr>`).join('')}</tbody></table><h2 class="section-title">전체 진행 검사</h2><p>${(window.__journeyTests||[]).filter(t=>t.pass).length}/8 통과 · 의뢰 49개, 발견 장면 4개, 작업일 7개, 도면 8장</p><h2 class="section-title">화면 크기별 검사</h2><div id="layoutResult">검사 중…</div><p class="small">실기기 청취, 터치 지연, VoiceOver·TalkBack 및 강사 검수: NOT_RUN</p>`;}
function runTestsScreen(){
 audioEngine.stop();
 window.__tests=[...runEngineTests(DAYS),...runStorageTests(),...runAudioTests(),...runAppTests()];window.__journeyTests=runJourneyTests();
 setState({screen:'tests'});$('app').hidden=true;$('screen').hidden=false;$('screenContent').innerHTML=testResultsMarkup();
 runLayoutSuite();
}
function runLayoutFrame(){
 audioEngine.stop();save=defaultSave();save.settings.soundChecked=true;save.scenes=SCENES.map(s=>s.id);for(const d of DAYS)save.days[d.id].passed=true;persist=()=>{};audioEngine.play=()=>null;focusMain=()=>{};
 let scenes=0,failures=[],maxLines=0,align=0,curves=0;
 const measure=(el)=>{const css=getComputedStyle(el),line=parseFloat(css.lineHeight);return Math.ceil((el.scrollHeight-.5)/line);};
 const checkText=(id,text)=>{const el=$(id);el.textContent=text;const lines=measure(el);maxLines=Math.max(maxLines,lines);if(lines>2)failures.push({type:'text',id,text,lines});};
 const originalRender=render;
 for(let d=0;d<DAYS.length;d++)for(let i=0;i<DAYS[d].jobs.length;i++){
  const seed={...DAYS[d].jobs[i],tools:DAYS[d].tools},job=makeJob(seed);
  for(const phase of seed.ask==='count'?['count','deliver']:['pipe','valve','deliver']){
   setState({screen:'work',day:d,idx:i,phase,free:false,scene:null,sub:'ready',joints:job.joints,results:[],currentResult:null,lowOk:true,msg:{tone:'',text:''},bad:[],marks:null,picked:null,dead:[]});scenes++;
   const app=$('app').getBoundingClientRect(),stage=$('stage').getBoundingClientRect(),pipe=$('pipesWrap').getBoundingClientRect();
   if(document.documentElement.scrollWidth>innerWidth||document.body.scrollHeight>innerHeight||pipe.bottom>stage.bottom+.5||pipe.top<stage.top-.5)failures.push({type:'overflow',id:seed.id,phase,appH:app.height,bodyH:document.body.scrollHeight,pipeBottom:pipe.bottom,stageBottom:stage.bottom});
   const bell=document.querySelector('#pipes .bell .b'),head=document.querySelector('#score .head');if(bell&&head){const diff=Math.abs(+bell.getAttribute('cx')-+head.getAttribute('cx'));align=Math.max(align,diff);}
   const cs=[...document.querySelectorAll('#score .curve')].map(n=>getComputedStyle(n).stroke+'|'+getComputedStyle(n).strokeWidth);if(new Set(cs).size>1)failures.push({type:'curves',id:seed.id});curves+=cs.length;
   for(const button of $('app').querySelectorAll('button')){const rect=button.getBoundingClientRect();if(rect.width&&rect.height&&(rect.height<43.5||button.classList.contains('joint')&&rect.width<35.5))failures.push({type:'touchTarget',id:button.id||button.className,w:rect.width,h:rect.height});}
   checkText('briefText',briefText(seed,job));checkText('readoutText',$('readoutText').textContent);
  }
  if(seed.ask!=='count'){
   setState({day:d,idx:i,phase:'pipe',joints:job.joints});
   for(const k of job.joints.keys())for(const got of ['gap','slur','tie'])if(got!==job.joints[k]&&(got!=='tie'||canTie(job,k))){const wrong=inspect({...job,joints:job.joints.map((v,n)=>n===k?got:v)},job.joints);if(wrong.length)checkText('readoutText',causeText(firstCause(wrong),seed,job));}
   checkText('readoutText','정답대로 고쳐 두었어요. 물을 틀어 보고 검수를 눌러요.');
  }else{setState({day:d,idx:i,phase:'count',joints:job.joints});for(const choice of countChoices(job,seed.q))if(choice!==countAnswer(job,seed.q))checkText('readoutText',countText(job,seed.q,choice));}
 }
 const result={viewport:`${innerWidth}x${innerHeight}`,scenes,failures:failures.slice(0,30),totalFailures:failures.length,maxLines,alignmentPx:align,curves};
 parent.postMessage({type:'joint-layout-result',result},location.origin);
}
function runLayoutSuite(){
 const sizes=[[320,545],[320,568],[360,600],[360,640],[390,664],[390,844],[430,932],[800,600]],results=[];
 let frame=null;const makeFrame=()=>{if(frame)frame.remove();frame=document.createElement('iframe');frame.title='독립 화면 검사';frame.style.cssText='position:fixed;left:-12000px;top:0;border:0;visibility:hidden';document.body.append(frame);};
 const next=()=>{if(!sizes.length){frame.remove();window.removeEventListener('message',onMessage);window.__layoutTests=results;const failed=results.flatMap(r=>r.failures);const ct=window.__tests.find(x=>x.id==='CT-03');if(ct){ct.pass=!failed.some(f=>f.type==='text');ct.status=ct.pass?'PASS':'FAIL';ct.error=ct.pass?'':JSON.stringify(failed.filter(f=>f.type==='text').slice(0,3));ct.detail=`${results.reduce((s,r)=>s+r.scenes,0)}장면 및 원인 문구 · 최대 ${Math.max(...results.map(r=>r.maxLines))}줄`;}if(S.screen==='tests'){$('screenContent').innerHTML=testResultsMarkup();$('layoutResult').textContent=results.map(r=>`${r.viewport}: ${r.scenes}장면 · ${r.totalFailures}건 문제 · 정렬 차 ${r.alignmentPx}px`).join(' / ');}return;}const [w,h]=sizes.shift();makeFrame();frame.width=w;frame.height=h;frame.src=location.pathname+'#layout-only';};
 const onMessage=e=>{if(e.source===frame.contentWindow&&e.data?.type==='joint-layout-result'){results.push(e.data.result);next();}};
 window.addEventListener('message',onMessage);next();
}
