/* AU checks use a deterministic AudioContext/AudioParam spy.
 * They verify submitted events and lifecycle/clock code, not real PCM rendering,
 * speaker audibility, physical touch latency, or Safari's device audio policy.
 */
function runAudioTests() {
  const results = [];
  const assert = (condition, message = 'Audio assertion failed') => { if (!condition) throw new Error(message); };
  const near = (a, b) => Math.abs(a - b) < 1e-8;
  const test = (id, fn) => {
    try { results.push({ id, pass: true, detail: fn() || '모의 AudioContext 예약·상태 검증' }); }
    catch (error) { results.push({ id, pass: false, error: error.message }); }
  };
  const sample = (joints = 'tss') => makeJob({ meter: '4/4', notes: 'C4/4 C4/4 D4/4 E4/4', joints });
  function harness(extra = {}) {
    const env = { now: 0, nodes: [], frames: [], finished: [], aborted: [], states: [], pending: null };
    class Param {
      constructor() { this.value = 0; this.log = []; }
      setValueAtTime(value, time) { this.log.push({ kind: 'set', value, time }); }
      linearRampToValueAtTime(value, time) { this.log.push({ kind: 'linear', value, time }); }
      exponentialRampToValueAtTime(value, time) { this.log.push({ kind: 'exp', value, time }); }
      cancelScheduledValues(time) { this.log.push({ kind: 'cancel', time }); }
      setTargetAtTime(value, time, constant) { this.log.push({ kind: 'target', value, time, constant }); }
    }
    class Node {
      constructor(kind) { this.kind = kind; this.gain = new Param(); this.frequency = new Param(); this.Q = {}; this.stops = []; this.listeners = {}; env.nodes.push(this); }
      connect(target) { this.connected = target; return target; }
      addEventListener(name, fn) { this.listeners[name] = fn; }
      setPeriodicWave(wave) { this.wave = wave; }
      start(time) { this.started = time; this.called = env.now; }
      stop(time) { this.stops.push(time); }
    }
    class Context {
      constructor() { this.state = extra.suspended ? 'suspended' : 'running'; this.currentTime = 0; this.sampleRate = 100; this.destination = {}; this.handlers = {}; this.outputLatency = 0.02; }
      createGain() { return new Node('gain'); }
      createOscillator() { return new Node('osc'); }
      createBufferSource() { return new Node('noise'); }
      createBiquadFilter() { return new Node('filter'); }
      createPeriodicWave(real, imag) { return { real, imag }; }
      createBuffer() { return { getChannelData: () => new Float32Array(100) }; }
      addEventListener(name, fn) { this.handlers[name] = fn; }
      removeEventListener(name) { delete this.handlers[name]; }
      resume() { return null; } // Intentionally does not advance or unlock a clock.
    }
    const Factory = extra.unavailable ? class { constructor() { throw new Error('Simulated unavailable AudioContext'); } } : Context;
    env.audio = new WorkshopAudio({ contextFactory: Factory, now: () => env.now, raf: fn => { env.pending = fn; return 1; }, cancelRaf: () => { env.pending = null; },
      onFrame: frame => env.frames.push(frame), onFinish: result => env.finished.push(result), onAbort: reason => env.aborted.push(reason), onState: state => env.states.push(state) });
    env.oscillators = () => env.nodes.filter(n => n.kind === 'osc');
    return env;
  }

  test('AU-01', () => {
    const env = harness();
    try {
      env.audio.play(sample());
      const osc = env.oscillators(), times = [0.12, 2.12, 3.12], pitches = [60, 62, 64];
      assert(osc.length === 3, 'Tied note must not create another oscillator');
      osc.forEach((o, i) => { assert(near(o.started, times[i])); assert(near(o.frequency.log[0].value, hz(pitches[i]))); assert(o.called === 0, 'All tones must be submitted before the first frame'); });
      assert(env.nodes.filter(n => n.kind === 'noise').length === 3, 'One unpitched drop per sound');
      return '모의 예약: 0.12·2.12·3.12초 / 도·레·미. 첫 프레임 전에 모두 예약';
    } finally { env.audio.dispose(); }
  });

  test('AU-02', () => {
    const env = harness();
    try {
      env.audio.play(sample());
      const old = [...env.audio.live];
      env.audio.play(sample('ggg'));
      assert(old.every(n => n.stops.includes(undefined)), 'Every old event must be cancelled before replacement');
      const current = [...env.audio.live];
      env.audio.stop();
      assert(current.every(n => n.stops.includes(undefined)) && env.audio.live.size === 0);
      return '모의 노드: 재생 교체·정지 때 이전 발진기와 예약 방울 전부 stop()';
    } finally { env.audio.dispose(); }
  });

  test('AU-03', () => {
    const cases = [];
    for (const joint of ['t', 's', 'g']) {
      const env = harness();
      try {
        const job = makeJob({ meter: '2/4', notes: 'C4/4 C4/4', joints: joint });
        env.audio.play(job);
        const osc = env.oscillators(), first = osc[0].connected.gain.log;
        if (joint === 't') assert(osc.length === 1 && near(osc[0].stops[0], 2.18), 'Tie must be one sustained envelope');
        if (joint === 's') assert(osc.length === 2 && first.some(e => e.kind === 'linear' && near(e.value, 0.0001) && near(e.time, 1.108)), 'Same-pitch slur must dip 12 ms before the new sound');
        if (joint === 'g') assert(osc.length === 2 && first.some(e => e.kind === 'linear' && near(e.value, 0.0001) && near(e.time, 0.87)) && near(osc[1].started, 1.12), 'Gap must leave a quarter-beat without tone');
        cases.push(joint);
      } finally { env.audio.dispose(); }
    }
    assert(cases.length === 3);
    return '모의 AudioParam: 붙임 단일 지속음·같은 음 이음 dip·뗌 ¼박 빈틈. 실제 파형·청취는 별도';
  });

  test('AU-04', () => {
    const suspended = harness(), frozen = harness(), hidden = harness();
    try {
      suspended.audio.play(sample());
      suspended.audio.ctx.state = 'suspended'; suspended.audio.ctx.handlers.statechange();
      assert(suspended.audio.run === null && suspended.aborted[0]?.reason === 'sound');
      assert(suspended.states.at(-1)?.enabled === false, 'Suspended context must expose disabled sound');
      frozen.audio.play(sample());
      frozen.audio.ctx.currentTime = 0.2; frozen.now = 200; frozen.audio._frame();
      frozen.now = 1101; frozen.audio._frame();
      assert(frozen.audio.run === null && frozen.aborted[0]?.reason === 'sound', 'A moving-then-frozen clock must abort after 800 ms');
      hidden.audio.play(sample()); hidden.audio.abort('hidden');
      assert(hidden.audio.run === null && hidden.audio.live.size === 0 && hidden.aborted[0]?.reason === 'hidden');
      return '모의 statechange·800ms 시계 정지·화면 이탈 중단 경로. 실제 브라우저 visibility 전환은 화면 검증';
    } finally { suspended.audio.dispose(); frozen.audio.dispose(); hidden.audio.dispose(); }
  });

  test('AU-05', () => {
    const env = harness();
    try {
      env.audio.play(sample());
      const r = env.audio.run;
      env.audio.ctx.currentTime = r.tb0 + 1.5 * r.beat + env.audio.latency();
      env.audio._frame();
      assert(near(env.frames.at(-1).beat, 1.5));
      env.audio.ctx.currentTime = r.tb0 + 2.25 * r.beat + env.audio.latency();
      env.audio._frame();
      assert(near(env.frames.at(-1).beat, 2.25));
      return '출력 지연 20ms를 뺀 오디오 시각 → 물머리 콜백 1½박·2¼박';
    } finally { env.audio.dispose(); }
  });

  test('AU-06', () => {
    const env = harness();
    try {
      env.audio.play(sample(), { kind: 'hand' });
      assert(env.oscillators().length === 0, 'Hand mode must not pre-play the answer');
      env.audio.valveStart();
      assert(env.oscillators().length === 1, 'One held oscillator');
      const osc = env.oscillators()[0], frequencies = osc.frequency.log;
      assert(frequencies.length === 4 && frequencies[0].value === frequencies[1].value);
      assert(near(frequencies[2].time, env.audio.run.tb0 + 2));
      assert(near(frequencies[3].time, env.audio.run.tb0 + 3));
      const extras = [...env.audio.valve.extras];
      env.audio.ctx.currentTime = env.audio.run.tb0 + 0.5;
      env.audio.valveStop();
      assert(env.audio.valve === null && extras.every(n => n.stops.includes(undefined)));
      assert(osc.connected.gain.log.some(e => e.kind === 'cancel') && osc.connected.gain.log.some(e => e.kind === 'target' && e.constant === 0.012));
      return '모의 손 밸브: 누름 발진기 하나·미래 주파수 선예약·뗌 때 게인과 방울 취소';
    } finally { env.audio.dispose(); }
  });

  test('AU-07', () => {
    const env = harness();
    try {
      env.audio.play(sample(), { kind: 'hand' }); assert(env.audio.run.countIn === 4);
      env.audio.stop(); env.audio.play(sample(), { kind: 'machine' }); assert(env.audio.run.countIn === 2);
      env.audio.stop(); env.audio.resetDay(); env.audio.play(sample(), { kind: 'machine' }); assert(env.audio.run.countIn === 4);
      const p = WorkshopAudio.buildPlan(makeJob({ meter: '2/4', notes: 'C4/4 E4/4 E4/4 C4/4', joints: 'gtg' }), { kind: 'machine', countIn: 4 });
      assert(p.ticks.length === 9);
      assert(p.ticks.filter(t => t.strong).map(t => t.t).join(',') === '0,4,6,8');
      return '준비 박 4→2·새 작업일 4 / 2박자 센박 0·4·6·8초 예약';
    } finally { env.audio.dispose(); }
  });

  test('AU-08', () => {
    const unavailable = harness({ unavailable: true }), blocked = harness({ suspended: true });
    try {
      unavailable.audio.play(sample()); assert(unavailable.audio.run.perf);
      unavailable.now = 5000; unavailable.audio._frame(); assert(unavailable.finished.length === 1 && unavailable.finished[0].fallback);
      blocked.audio.play(sample()); assert(!blocked.audio.run.perf);
      blocked.now = 1300; blocked.audio._frame();
      assert(blocked.audio.run.perf && blocked.audio.live.size === 0);
      blocked.now = 7000; blocked.audio._frame(); assert(blocked.finished.length === 1 && blocked.finished[0].fallback);
      return '모의 생성 거부·정지한 suspended 시계: 1.2초 뒤 화면 시계 전환·끝까지 진행';
    } finally { unavailable.audio.dispose(); blocked.audio.dispose(); }
  });

  test('AU-09', () => {
    const plan = WorkshopAudio.buildPlan(sample(), { bpm: 50 });
    assert(plan.tones.length === 3);
    [0, 2.4, 3.6].forEach((time, i) => assert(near(plan.tones[i].t, time)));
    assert(near(plan.tones[0].len, 2.4) && near(plan.beat, 1.2));
    return '♩=50 모의 예약표: 0·2.4·3.6초 / 붙인 소리 2.4초';
  });
  return results;
}
