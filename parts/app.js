// 4 STATE · explicit transitions, 8 STORAGE, 9 SCREENS, 11 BOOT
const $ = id => document.getElementById(id);
const store = new WorkshopStorage();
let save = store.load();
const S = {screen:'title',day:0,idx:0,phase:'count',sub:'ready',tool:'tie',joints:[],tries:0,assisted:false,bad:[],dead:[],picked:null,label:'',msg:{tone:'',text:''},valve:'',marks:null,hearing:false,results:[],retry:[],repeating:false,retryPos:0,free:false,freeSeed:null,scene:null,sceneSide:'a',sceneReturn:'work',sheet:'',lowOk:false,bpm:60};
function setState(patch){Object.assign(S,patch);render();}
const dayNow=()=>DAYS[S.day];
const seedsNow=()=>dayNow().jobs.map(s=>({...s,tools:dayNow().tools}));
const rawSeedNow=()=>S.scene?{...S.scene[S.sceneSide],id:S.scene.id+S.sceneSide,ask:'score',tools:''}:S.free?{...S.freeSeed,ask:'score',tools:'gst'}:seedsNow()[S.idx];
const seedNow=()=>{const seed=rawSeedNow();return seed.ask==='sound'&&(save.settings.muted||S.soundUnavailable)?{...seed,ask:'score',soundFallback:true}:seed;};
const truthNow=()=>makeJob(seedNow());
const mineNow=()=>({...truthNow(),joints:S.joints});
const shownJob=()=>S.scene?truthNow():(S.phase==='pipe'||S.phase==='valve')?mineNow():truthNow();
const running=()=>['run','listen','countin'].includes(S.sub);
const bestValve=(a,b)=>(RANK[b]||0)>(RANK[a]||0)?b:a;
const valveNumber=v=>({'–':0,'기계':4,'여러 곳 샘':1,'한 곳 샘':2,'매끈':3}[v]||0);
const valveName=n=>['–','여러 곳 샘','한 곳 샘','매끈','기계'][n]||'–';
function persist(){store.save(save);}
function saveActive(){if(S.free||S.scene)return;save.active={day:dayNow().id,index:S.idx,retry:S.retry.slice(),phase:S.phase,results:S.results.filter(Boolean).map(r=>({recipe:r.recipe==='full'?2:1,valve:valveNumber(r.valve)})),repeating:S.repeating,retryPos:S.retryPos};persist();}
function idle(){audioEngine.stop();setState({sub:'ready',hearing:false,label:''});clearWater();}
function openScreen(screen){audioEngine.stop();setState({screen,free:false,scene:null,sub:'ready',sheet:''});$('screenContent')?.focus({preventScroll:true});}
function resumeWork(){if(save.active){const d=DAYS.findIndex(d=>d.id===save.active.day);startDay(Math.max(0,d),true);}else openScreen('map');}
function startDay(day,resume=false){
 if(day<0||day>=DAYS.length||(day>0&&!save.days['d'+(day-1)].passed))return;
 audioEngine.stop();audioEngine.resetDay?.();
 const active=resume&&save.active?.day===DAYS[day].id?save.active:null;
 setState({screen:'work',day,idx:active?.index||0,newCards:[],results:active?active.results.map(r=>({recipe:r.recipe===2?'full':'half',valve:valveName(r.valve)})):[],retry:active?.retry||[],repeating:!!active?.repeating,retryPos:active?.retryPos||0,free:false,scene:null});
 startJob(S.idx);
 if(active?.phase==='deliver')setState({phase:'deliver',valve:valveName(active.results[S.idx]?.valve),assisted:active.results[S.idx]?.recipe===1});
 if(day===0&&!save.settings.soundChecked)checkSound();
}
function startJob(i,skipScene=false){
 audioEngine.stop();
 const seed=seedsNow()[i],job=makeJob(seed),tools=seed.tools||'';
 setState({idx:i,scene:null,phase:seed.ask==='count'?'count':'pipe',sub:'ready',joints:seed.ask==='repair'?parseJoints(seed.given,job.notes.length):Array(job.notes.length-1).fill('gap'),tries:0,assisted:false,bad:[],dead:[],picked:null,label:'',valve:'',tutorialStep:0,machineShown:false,currentResult:null,marks:null,hearing:false,tool:tools.includes(TOOL_CODE[S.tool])?S.tool:JOINT[tools.at(-1)]||'tie',msg:{tone:'',text:''}});
 saveActive();
 const scene=SCENES.find(x=>x.before===seed.id&&!save.scenes.includes(x.id));
 if(scene&&!skipScene)openScene(scene.id,'work');else focusMain();
}
function pick(key){if(S.phase==='count'&&!S.dead.includes(key))setState({picked:key,msg:{tone:'',text:''}});}
function confirmCount(){
 if(S.phase!=='count')return;
 const seed=seedNow(),job=truthNow(),ans=countAnswer(job,seed.q);
 if(S.picked===null){setState({msg:{tone:'warn',text:'보기에서 하나를 먼저 골라 주세요.'}});return;}
 if(S.picked===ans){toDeliver();return;}
 if(S.tries===0)setState({tries:1,assisted:true,dead:S.dead.concat(S.picked),picked:null,msg:{tone:'bad',text:countText(job,seed.q,S.picked)}});
 else setState({tries:2,assisted:true,dead:countChoices(job,seed.q).filter(c=>c!==ans),picked:ans,msg:{tone:'warn',text:`답은 ${countLabel(seed.q,ans)}이에요. 확정을 눌러요.`}});
}
function applyTool(k){
 if(S.phase!=='pipe'||S.scene)return;
 const hearing=S.hearing;
 if(!hearing)audioEngine.stop();
 const r=withJoint(mineNow(),k,S.tool);
 if(!r.ok){setState({sub:hearing?S.sub:'ready',msg:{tone:'bad',text:'높이가 달라서 붙일 수 없어요. 붙임줄은 같은 높이끼리만 돼요.'}});const b=document.querySelector(`.joint[data-k="${k}"]`);b?.classList.add('shake');return;}
 setState({sub:hearing?S.sub:'ready',joints:r.job.joints,bad:S.bad.filter(x=>x!==k),msg:{tone:'',text:''}});
 if(S.free&&ambiguous(mineNow()).length)setState({msg:{tone:'warn',text:'이 곡선은 악보에서 붙임줄로 읽혀요.'}});
}
function inspectNow(){
 if(S.phase!=='pipe'||S.scene)return;
 idle();
 if(S.free){setState({phase:'valve',msg:{tone:'',text:'내 물길에 맞춰 밸브를 눌러 봐요.'}});focusMain();return;}
 const wrong=inspect(mineNow(),truthNow().joints);
 if(!wrong.length){setState({phase:'valve',sub:'ready',bad:[],msg:{tone:'good',text:'설계도와 같아요. 이제 밸브를 눌러 손으로 물을 틀어요.'}});focusMain();if(seedNow().id==='d1-01'&&!save.settings.tutorialSeen&&!S.machineShown){setState({machineShown:true});begin('machine');}return;}
 if(S.tries===0)setState({tries:1,assisted:true,bad:wrong.map(x=>x.k),msg:{tone:'bad',text:causeText(firstCause(wrong),seedNow(),truthNow())}});
 else setState({tries:2,assisted:true,joints:truthNow().joints.slice(),bad:[],msg:{tone:'warn',text:'정답대로 고쳐 두었어요. 물을 틀어 보고 검수를 눌러요.'}});
}
function toDeliver(){
 if(S.phase==='valve'&&running())return;
 audioEngine.stop();
 if(S.free){setState({phase:'pipe',sub:'ready',marks:null,msg:{tone:'',text:''}});return;}
 const result={recipe:S.assisted?'half':'full',valve:S.valve||'–'},results=S.results.slice();
 if(!S.repeating)results[S.idx]=result;
 const newCards=(S.newCards||[]).slice();if(result.recipe==='full')for(const tag of tagsOf(truthNow())){if(!save.cards[tag]?.got&&!newCards.includes(tag))newCards.push(tag);save.cards[tag]??={got:false,valve:0};save.cards[tag]={got:true,valve:Math.max(save.cards[tag].valve||0,result.valve==='기계'?0:Math.min(3,valveNumber(result.valve)))};}
 if(!S.repeating){save.stats.jobs++;if(result.recipe==='full')save.stats.clean++;if(S.valve){save.stats.valves++;if(S.valve==='매끈')save.stats.smooth++;}}
 setState({phase:'deliver',sub:'ready',bad:[],marks:null,label:'',results,newCards,currentResult:result,msg:{tone:'',text:''}});
 if(seedNow().id==='d3-01')save.settings.tutorialSeen=true;saveActive();begin('listen');focusMain();
}
function nextJob(){
 if(S.phase!=='deliver')return;
 audioEngine.stop();
 const last=dayNow().jobs.length-1;
 let idx=S.idx+1;
 if(S.repeating){const pos=S.retryPos+1;if(pos<S.retry.length){setState({retryPos:pos});idx=S.retry[pos];}else{setState({repeating:false,retryPos:0});idx=last;}}
 else if(S.idx===last){closeDay();return;}
 else if(idx===last){const retry=S.results.map((r,i)=>r?.recipe==='half'&&i<last?i:-1).filter(i=>i>=0);if(retry.length){setState({retry,repeating:true,retryPos:0});idx=retry[0];}}
 const scene=SCENES.find(x=>x.after===seedNow().id&&!save.scenes.includes(x.id));
 startJob(idx);
 if(scene)openScene(scene.id,'work');
}
function closeDay(){
 const full=S.results.filter(r=>r?.recipe==='full').length,passed=full>=Math.ceil(dayNow().jobs.length*.8),old=save.days[dayNow().id];
 const manual=dayNow().jobs.map((s,i)=>s.ask!=='count'?S.results[i]:null).filter(Boolean),smooth=manual.length>0&&manual.every(r=>r.valve==='매끈');
 save.days[dayNow().id]={passed:old.passed||passed,stamp:Math.max(old.stamp,passed?(smooth?2:1):0),runs:old.runs+1,best:Math.max(old.best,full)};save.active=null;persist();setState({screen:'close',sub:'ready'});
}
function openScene(id,returnTo='work'){
 const scene=SCENES.find(s=>s.id===id);if(!scene)return;
 audioEngine.stop();setState({screen:'work',scene,sceneSide:'a',sceneReturn:returnTo,phase:'scene',sub:'ready',msg:{tone:'',text:scene.text}});
}
function finishScene(){const id=S.scene.id,ret=S.sceneReturn;if(SCENES.some(x=>x.id===id)&&!save.scenes.includes(id)){save.scenes.push(id);persist();}if(ret==='work'){setState({scene:null});startJob(S.idx,true);}else openScreen(ret);}
function setSceneSide(side){audioEngine.stop();setState({sceneSide:side,sub:'ready'});}
function startFree(seedId){
 const seed=DAYS.flatMap((d,i)=>(i===0||save.days['d'+(i-1)].passed)?d.jobs:[]).find(s=>s.id===seedId);if(!seed)return;
 audioEngine.stop();const job=makeJob(seed);setState({screen:'work',free:true,freeSeed:seed,scene:null,phase:'pipe',sub:'ready',joints:job.joints.slice(),tool:'slur',bad:[],marks:null,msg:{tone:'',text:''},valve:'',bpm:60});focusMain();
}
function openBookCard(tag){
 const c=CARDS.find(c=>c.tag===tag);if(!c||!save.cards[tag]?.got)return;
 const seed=DAYS.flatMap(d=>d.jobs).find(s=>s.id===c.first);
 setState({screen:'work',scene:{id:'card',title:c.title,text:c.title,a:seed,b:seed,card:c},sceneSide:'a',sceneReturn:'book',phase:'scene',sub:'ready',msg:{tone:'',text:c.text}});
}
function updateSetting(key,value){
 save.settings[key]=value;persist();audioEngine.setVolume(save.settings.muted?0:save.settings.volume);applyMotion();if(S.screen==='settings')renderScreen();
}
function resetProgress(confirmed=false){if(!confirmed){showModal('<h2>기록을 초기화할까요?</h2><p>작업일·도면 카드·설정이 처음으로 돌아가요.</p><button onclick="resetProgress(true)">기록 초기화</button><button onclick="closeModal()">돌아가기</button>');return;}save=store.reset();closeModal();openScreen('title');}
function replayTutorial(){save.settings.tutorialSeen=false;save.settings.soundChecked=false;persist();startDay(0);}
function checkSound(){audioEngine.initialize();audioEngine.play(makeJob({notes:'C4/4',meter:'1/4',joints:''}),{kind:'hear',bpm:60});showModal('<div class="eyebrow">공방의 소리를 확인해요</div><h2>관 소리가 들리나요?</h2><p>방울은 소리가 시작되는 자리를 알려 줘요.</p><button onclick="soundChecked(true)">들려요</button><button onclick="soundChecked(false)">안 들려요 · 소리 없이</button>');}
function soundChecked(heard){audioEngine.stop();save.settings.soundChecked=true;save.settings.muted=!heard;persist();audioEngine.setVolume(heard?save.settings.volume:0);closeModal();}
function showModal(html){$('overlayContent').innerHTML=html;$('overlay').hidden=false;$('app').inert=true;$('screen').inert=true;$('overlayContent').querySelector('button,input')?.focus();}
function closeModal(){$('overlay').hidden=true;$('app').inert=false;$('screen').inert=false;focusMain();}
function applyMotion(){document.body.classList.toggle('reduced',save.settings.motion==='reduced'||save.settings.motion==='system'&&matchMedia('(prefers-reduced-motion:reduce)').matches);}
let scoreKey='',pipesKey='',choiceKey='',lastScreen='';
function render(){
 document.body.classList.toggle('short',innerHeight<620);document.body.classList.toggle('low',innerHeight<545&&S.lowOk);const work=S.screen==='work';$('app').hidden=!work;$('screen').hidden=work;
 if(!work){if(S.screen==='tests'){$('screenContent').innerHTML=testResultsMarkup();if(window.__layoutTests)$('layoutResult').textContent=window.__layoutTests.map(r=>`${r.viewport}: ${r.scenes}장면 · ${r.totalFailures}건 문제`).join(' / ');}else renderScreen();lastScreen=S.screen;return;}
 const seed=seedNow(),truth=truthNow(),count=S.phase==='count',pipe=S.phase==='pipe',valve=S.phase==='valve',deliver=S.phase==='deliver',scene=!!S.scene;
 $('dayName').textContent=scene?S.scene.title:S.free?'자유 공방':`${S.day}단 · ${dayNow().name}`;
 $('dots').innerHTML=S.free||scene?'':dayNow().jobs.map((_,i)=>`<i class="${S.results[i]?.recipe||''}${S.idx===i?' now':''}"></i>`).join('');
 $('dots').setAttribute('aria-label',`의뢰 ${S.idx+1}/${dayNow().jobs.length}${S.repeating?' · 다시 해요':''}`);
 $('askTag').textContent=scene?'발견':S.free?'자유':(seed.final?'마감 · ':'')+ASK_KO[seed.ask];
 $('briefText').textContent=scene?S.scene.text:S.free?'이음매를 마음대로 바꾸고 소리와 곡선을 살펴봐요.':briefText(seed,truth);
 $('hear').hidden=seed.ask!=='sound'||deliver||scene;$('hear').setAttribute('aria-pressed',String(S.hearing));
 const g=geo(),job=shownJob(),showCurves=S.free||scene||['score','repair','count'].includes(seed.ask)||deliver,scoreJob=S.free?mineNow():truth;
 const sk=JSON.stringify([seed.id,scoreJob.joints,showCurves,g.W]);if(sk!==scoreKey){scoreKey=sk;buildScore(g,scoreJob,showCurves);}
 const hideBells=!!seed.final&&pipe&&!S.free,veiled=count&&seed.reveal!=='before';
 const pk=JSON.stringify([seed.id,job.joints,g.W,g.row,hideBells]);if(pk!==pipesKey){pipesKey=pk;buildPipes(g,job,{hideBells});}
 $('pipesWrap').classList.toggle('veiled',veiled);$('veil').hidden=!veiled;$('joints').hidden=scene||!seed.tools;
 document.querySelectorAll('.joint').forEach(b=>{const k=+b.dataset.k,m=valve&&S.marks?S.marks.find(m=>m.k===k):null;b.disabled=!pipe;b.classList.toggle('bad',pipe?S.bad.includes(k):!!(m&&!m.ok));b.classList.toggle('ok',!!m?.ok);});
 let text=S.msg.text,tone=S.msg.tone;
 if(!text){if(count)text=seed.reveal==='before'?'물길의 방울을 보고 골라요.':'악보의 곡선을 보고 골라요.';else if(pipe)text=hideBells?'도움 없이 해요. 이음매를 정하고 검수를 눌러요.':`방울 ${bells(job)}번: ${soundLine(job)}`;else if(valve)text='누르고 있는 동안 물이 흘러요. 이음매에 맞춰 눌렀다 떼어 봐요.';else if(deliver){const c=toCurves(truth);text=`${soundLine(truth)}. 붙임줄 ${c.ties.length}개, 이음줄 ${c.slurs.length}개.`;}}
 $('readoutText').textContent=text;$('readout').className='readout '+tone;
 for(const [id,visible]of Object.entries({'g-count':count,'g-pipe':pipe,'g-scene':scene,'g-free':false,'g-valve':valve,'g-deliver':deliver}))$(id).hidden=!visible;
 if(count){const ch=countChoices(truth,seed.q),ck=seed.id+ch.join();if(ck!==choiceKey){choiceKey=ck;$('choices').innerHTML=ch.map(c=>`<button class="opt" role="radio" data-key="${c}">${countLabel(seed.q,c)}</button>`).join('');}for(const b of $('choices').children){b.setAttribute('aria-checked',String(b.dataset.key===S.picked));b.disabled=S.dead.includes(b.dataset.key);}$('countTrial').hidden=seed.reveal!=='before';$('countTrial').textContent=running()?'멈추기':'물 틀기';}
 if(pipe){$('tools').hidden=false;document.querySelectorAll('#tools [data-tool]').forEach(b=>{b.hidden=!(seed.tools||'').includes(TOOL_CODE[b.dataset.tool]);b.setAttribute('aria-checked',String(b.dataset.tool===S.tool));});$('trial').textContent=running()?'멈추기':'물 틀기';$('inspect').textContent=S.free?'밸브로 연주':'검수';}
 if(scene){$('sceneA').setAttribute('aria-pressed',String(S.sceneSide==='a'));$('sceneB').setAttribute('aria-pressed',String(S.sceneSide==='b'));$('sceneTrial').textContent=running()?'멈추기':'물 틀기';if(S.scene.card){$('sceneA').textContent='설명 보기';$('sceneB').textContent='뒷면 보기';}else{$('sceneA').textContent='가';$('sceneB').textContent='나';}}
 if(valve){$('pad').textContent=S.sub==='countin'?'준비 '+S.label:S.sub==='run'?'밸브':S.sub==='result'?'다시 하려면 눌러요':'누르면 준비 박이 시작해요';$('machine').setAttribute('aria-disabled',String(running()));$('deliverBtn').setAttribute('aria-disabled',String(running()));$('deliverBtn').textContent=S.free?'배관으로':'납품';}
 if(deliver){const r=S.currentResult||S.results[S.idx]||{recipe:S.assisted?'half':'full',valve:S.valve||'–'};$('rec').textContent=`물길 ${r.recipe==='full'?'● 한 번에':'◐ 도움 받음'} · 밸브 ${r.valve}`;$('next').textContent=S.idx===dayNow().jobs.length-1&&!S.repeating?'마감하기':'다음 의뢰';}
 document.querySelectorAll('.tutorial').forEach(n=>n.classList.remove('tutorial'));if(!save.settings.tutorialSeen&&!S.free&&!scene){let target=null;if(seed.id==='d0-01'&&count)target=$('countTrial');if(['d1-01','d3-01'].includes(seed.id)&&pipe)target=S.tutorialStep?$('joints').querySelector('button'):$(seed.id==='d1-01'?'tool-tie':'tool-slur');target?.classList.add('tutorial');}$('app').dataset.phase=S.phase;
 if(!scene&&S.screen==='work'&&lastScreen!=='work'){requestAnimationFrame(()=>{scoreKey='';pipesKey='';render();});}
 lastScreen='work';checkLow();
}
function focusMain(){if(S.screen!=='work'||!$('overlay').hidden)return;const el=S.phase==='count'?$('choices').querySelector('button:not(:disabled)'):S.phase==='pipe'?$('joints').querySelector('button')||$('inspect'):S.phase==='valve'?$('pad'):S.phase==='scene'?$('inspect'):$('next');el?.focus({preventScroll:true});}
function begin(kind){
 if(running()&&((kind==='hear'&&S.hearing)||(kind!=='hear'&&!S.hearing))){idle();return;}
 const bpm=S.free?(S.freeBpm||S.bpm):save.settings.slow?50:60,job=kind==='trial'?shownJob():S.free?mineNow():truthNow();
 setState({sub:kind==='hear'?'listen':kind==='hand'||kind==='machine'?'countin':kind==='listen'?'listen':'run',hearing:kind==='hear'});
 audioEngine.setVolume(save.settings.muted?0:save.settings.volume);
 const started=audioEngine.play(job,{kind,bpm,correctionMs:save.settings.holdOffsetMs});if(!started)setState({sub:'ready',hearing:false});
}
let waterFrame=null;
function drawWater(frame){
 waterFrame=frame;if(frame.kind==='hear'||S.screen!=='work'||!P.g)return;
 const beat=Math.max(0,frame.beat),g=P.g;
 const hand=frame.kind==='hand';
 document.querySelectorAll('#pipes .water.auto').forEach((r,i)=>{const w=P.waters[i];if(!w)return;let fraction=Math.max(0,Math.min(1,(beat-w.b0)/(w.b1-w.b0)));if(hand){const start=Math.max(w.b0,0),end=Math.min(w.b1,beat);const holds=frame.holds.concat(frame.down!==null?[[frame.down,beat]]:[]);fraction=holds.reduce((v,h)=>v+Math.max(0,Math.min(end,h[1]??beat)-Math.max(start,h[0])),0)/(w.b1-w.b0);}r.setAttribute('width',String(w.w*fraction));});
 document.querySelectorAll('#pipes .riserWater').forEach((r,i)=>r.style.opacity=beat>=P.risers[i]?.b?'1':'0');
 document.querySelectorAll('#pipes .bell').forEach((b,i)=>b.classList.toggle('rung',beat>=P.bells[i]?.b&&frame.beat>=0));
 for(const id of ['head','scoreHead']){const h=$(id);if(h){h.style.opacity=frame.beat>=0?'1':'0';h.setAttribute('x1',g.X(beat));h.setAttribute('x2',g.X(beat));}}
 $('pad').classList.toggle('down',!!frame.pressed);
}
function clearWater(){waterFrame=null;document.querySelectorAll('#pipes .water.auto').forEach(n=>n.setAttribute('width','0'));document.querySelectorAll('.headline').forEach(n=>n.style.opacity='0');$('pad')?.classList.remove('down');}
const audioEngine=new WorkshopAudio({onState(info){const b=$('soundChip');if(b){b.hidden=info.enabled;b.textContent='소리 켜기';$('hud').classList.toggle('nosound',!info.enabled);}if(S.soundUnavailable!==!info.enabled&&info.state==='unavailable')setState({soundUnavailable:!info.enabled});},onFrame(frame){drawWater(frame);if((frame.beat<0&&S.sub!=='countin')||(frame.beat>=0&&S.sub==='countin')||String(frame.label)!==S.label&&frame.beat<0)setState({sub:frame.beat<0?'countin':frame.kind==='listen'||frame.kind==='hear'?'listen':'run',label:String(frame.label||'')});},onFinish(result){if(S.screen!=='work')return;if(result.kind==='hand'||result.kind==='machine'){const v=result.machine?'기계':({smooth:'매끈',drip:'한 곳 샘',leak:'여러 곳 샘'}[result.judgment?.grade]||'여러 곳 샘');setState({sub:'result',hearing:false,valve:bestValve(S.valve,v),marks:result.judgment?.joints||null,msg:result.machine?{tone:'',text:'기계가 설계도대로 눌렀어요. 보고 따라 해 보세요.'}:valveText(result.judgment)});}else {const hint=result.kind==='listen'&&seedNow().id==='d0-01'?'차이가 들리게 넉넉히 뗐어요. 실제 연주에서는 이만큼 끊지 않아요.':result.kind==='listen'&&seedNow().id==='d3-01'?'틈 없이 이어서 연주하는 것을 레가토라고 해요.':'';setState({sub:'ready',hearing:false,label:'',...(hint?{msg:{tone:'',text:hint}}:{})});}},onAbort(reason){if(S.screen==='work')setState({sub:'ready',hearing:false,label:'',msg:{tone:'warn',text:reason?.text||typeof reason==='string'&&reason||'화면을 떠나서 멈췄어요. 다시 시작해 주세요.'}});}});
function valveDown(){if(S.phase!=='valve')return;if(!running()){begin('hand');}audioEngine.valveStart();}
function valveUp(){audioEngine.valveStop();}
function checkLow(){if(innerHeight>=MIN_H||S.lowOk)return;showModal('<h2>창을 조금 키워 주세요</h2><p>높이 545px부터 작업대가 한 화면에 들어가요.</p><button onclick="continueLow()">그래도 계속하기</button>');}
function continueLow(){setState({lowOk:true});document.documentElement.classList.add('allow-low');closeModal();}
function icon(name){const paths={map:'M3 4l6-2 6 2 6-2v18l-6 2-6-2-6 2z M9 2v18m6-16v18',tool:'M14 3a6 6 0 0 0-7 8L2 17l5 5 6-6a6 6 0 0 0 8-7l-5 4-5-5z',lock:'M6 10h12v11H6z M8 10V6a4 4 0 0 1 8 0v4',check:'m5 12 5 5L20 6',sparkle:'M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3z',arrow:'M4 12h16m-6-6 6 6-6 6',home:'M3 10 12 3l9 7v11H3z M9 21v-8h6v8',settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z',fullscreen:'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5',sound:'M3 9h4l5-5v16l-5-5H3z M16 8q5 4 0 8',back:'m14 5-7 7 7 7',play:'m8 4 12 8-12 8z',book:'M3 4h8l1 2 1-2h8v16h-8l-1 2-1-2H3z M12 6v14'};return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.sound}"/></svg>`;}
function boot(){
 applyMotion();audioEngine.setVolume(save.settings.muted?0:save.settings.volume);
 $('sceneA').onclick=()=>S.scene?.card?showModal('<h2>'+S.scene.card.title+'</h2><p>'+S.scene.card.text+'</p><button onclick="closeModal()">알겠어요</button>'):setSceneSide('a');$('sceneB').onclick=()=>S.scene?.card?showModal('<h2>도면 뒷면</h2><p>'+CARD_BACK+(S.scene.card.tag==='plain'?' 차이가 들리게 넉넉히 뗐어요. 실제 연주에서는 이만큼 끊지 않아요.':'')+'</p><button onclick="closeModal()">알겠어요</button>'):setSceneSide('b');$('sceneTrial').onclick=()=>begin('trial');$('sceneNext').onclick=finishScene;$('soundChip').onclick=()=>audioEngine.initialize();
 $('home').onclick=()=>openScreen('map');$('openSettings').onclick=()=>openScreen('settings');$('fullscreen').onclick=()=>{if(document.fullscreenElement)document.exitFullscreen?.();else document.documentElement.requestFullscreen?.();};
 $('choices').onclick=e=>{const b=e.target.closest('[data-key]');if(b)pick(b.dataset.key);};$('confirm').onclick=confirmCount;
 $('tools').onclick=e=>{const b=e.target.closest('[data-tool]');if(b)setState({tool:b.dataset.tool,tutorialStep:1,msg:{tone:'',text:''}});};
 $('joints').onclick=e=>{const b=e.target.closest('[data-k]');if(b)applyTool(+b.dataset.k);};
 $('trial').onclick=$('countTrial').onclick=()=>begin('trial');$('hear').onclick=()=>begin('hear');$('inspect').onclick=()=>S.scene?finishScene():inspectNow();
 $('machine').onclick=()=>{if(!running())begin('machine');};$('deliverBtn').onclick=toDeliver;$('again').onclick=()=>begin('listen');$('next').onclick=nextJob;
 $('pad').addEventListener('pointerdown',e=>{e.preventDefault();$('pad').setPointerCapture(e.pointerId);valveDown();});$('pad').addEventListener('pointerup',valveUp);$('pad').addEventListener('pointercancel',valveUp);$('pad').addEventListener('lostpointercapture',valveUp);$('pad').oncontextmenu=e=>e.preventDefault();
 $('pad').addEventListener('keydown',e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();if(!e.repeat)valveDown();}});$('pad').addEventListener('keyup',e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();valveUp();}});
 document.addEventListener('keydown',e=>{if(e.key==='Tab'&&!$('overlay').hidden){const focusables=[...$('overlayContent').querySelectorAll('button,input,select,[tabindex]')].filter(n=>!n.disabled);const first=focusables[0],last=focusables.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}if(e.key==='Escape'){if(!$('overlay').hidden)closeModal();else openScreen('map');}if(e.key==='0'&&!/INPUT|SELECT/.test(e.target.tagName))$('fullscreen').click();});
 for(const event of ['click','touchstart','keydown'])document.addEventListener(event,()=>audioEngine.initialize(),{passive:true});
 let width=innerWidth,height=innerHeight;window.addEventListener('resize',()=>{if(innerWidth===width&&innerHeight===height)return;width=innerWidth;height=innerHeight;if(S.screen==='work'){const old=P.g;const g=geo();if(running()&&(!old||old.W!==g.W||old.row!==g.row||innerHeight<MIN_H))idle();scoreKey='';pipesKey='';render();}});
 render();if(location.hash==='#layout-only')runLayoutFrame();else if(location.hash==='#test')runTestsScreen();else requestAnimationFrame(()=>{window.__tests=[...runEngineTests(DAYS),...runStorageTests(),...runAudioTests(),...runAppTests()];});
}
window.addEventListener('error',e=>{console.error(e.error||e.message);const err=document.createElement('div');err.className='error-box';err.innerHTML='<b>문제가 생겼어요.</b> <button onclick="location.reload()">새로고침</button>';document.body.append(err);},{once:true});
window.__app={S,get save(){return save;},startDay,startJob,pick,confirmCount,applyTool,inspectNow,toDeliver,nextJob,openScreen,seedNow,truthNow,mineNow,setState,begin,store,audioEngine};
boot();
