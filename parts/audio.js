/* JOINT · Web Audio scheduling and valve input.
 * The synthesis/envelopes and timing constants are copied from Appendix C.7–C.8.
 * Adaptation: DOM writes are callbacks, so the one-file application owns its UI.
 */
class WorkshopAudio {
  constructor(options = {}) {
    this.options = options;
    this.ctx = null;
    this.master = null;
    this.noiseBuf = null;
    this.wave = null;
    this.run = null;
    this.valve = null;
    this.live = new Set();
    this.raf = 0;
    this.volume = 1;
    this.valved = false;
    this.endedAt = -1e9;
    this._now = options.now || (() => performance.now());
    this._raf = options.raf || ((fn) => requestAnimationFrame(fn));
    this._caf = options.cancelRaf || ((id) => cancelAnimationFrame(id));
    this._visibility = () => {
      if (typeof document !== 'undefined' && document.hidden && this.run) this.abort('hidden');
    };
    this._blur = () => { if (this.run) this.abort('blur'); };
    this._stateChange = () => {
      this._notifyState();
      const r = this.run;
      if (r && !r.perf && this.ctx.state !== 'running' && r.audioStarted) this.abort('sound');
    };
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this._visibility);
    if (typeof window !== 'undefined') {
      window.addEventListener('blur', this._blur);
      window.addEventListener('pagehide', this._blur);
    }
  }

  _emit(name, value) {
    if (typeof this.options[name] === 'function') this.options[name](value);
  }

  _notifyState() {
    this._emit('onState', { enabled: !!this.ctx && this.ctx.state === 'running', state: this.ctx ? this.ctx.state : 'unavailable', fallback: !!this.run && this.run.perf });
  }

  initialize() {
    try {
      if (!this.ctx || this.ctx.state === 'closed') {
        const AC = this.options.contextFactory || (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext));
        if (!AC) { this._notifyState(); return null; }
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.8 * this.volume;
        this.master.connect(this.ctx.destination);
        this.noiseBuf = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        this.wave = this.ctx.createPeriodicWave(new Float32Array(7), new Float32Array([0, 1, 0.42, 0.26, 0.1, 0.06, 0.03]));
        this.ctx.addEventListener('statechange', this._stateChange);
      }
      if (this.ctx.state !== 'running') {
        const p = this.ctx.resume();
        if (p && p.catch) p.catch(() => this._notifyState());
      }
      this._notifyState();
      return this.ctx;
    } catch (error) {
      this._emit('onError', error);
      this._notifyState();
      return null;
    }
  }

  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, Number(value) || 0));
    if (this.master && this.ctx) this.master.gain.setValueAtTime(0.8 * this.volume, this.ctx.currentTime);
  }

  _keep(node) {
    this.live.add(node);
    node.addEventListener('ended', () => this.live.delete(node));
    return node;
  }

  _silence() {
    this.live.forEach((node) => { try { node.stop(); } catch (_) { /* already ended */ } });
    this.live.clear();
  }

  _pipeTone(midi, when, len, attack, release) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    const peak = 0.24, up = attack === 'legato' ? 0.03 : 0.018, end = when + len;
    o.setPeriodicWave(this.wave);
    o.frequency.setValueAtTime(hz(midi), when);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(peak, when + up);
    if (release === 'over') {
      g.gain.setValueAtTime(peak, end);
      g.gain.linearRampToValueAtTime(0.0001, end + 0.03);
    } else if (release === 'dip') {
      g.gain.setValueAtTime(peak, Math.max(when + up, end - 0.07));
      g.gain.linearRampToValueAtTime(0.0001, end - 0.012);
    } else {
      g.gain.setValueAtTime(peak, Math.max(when + up, end - 0.04));
      g.gain.linearRampToValueAtTime(0.0001, end);
    }
    o.connect(g); g.connect(this.master); o.start(when); o.stop(end + 0.06);
    this._keep(o);
  }

  _burst(when, dur, freq, q, peak) {
    const s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    s.buffer = this.noiseBuf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(peak, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(when); s.stop(when + dur + 0.02);
    return this._keep(s);
  }

  _drop(when, fresh) { return this._burst(when, 0.035, 1900, 1.4, fresh ? 0.22 : 0.08); }
  _tick(when, strong) { return this._burst(when, 0.035, strong ? 2600 : 1700, 6, strong ? 0.6 : 0.35); }
  latency() { return this.ctx ? this.ctx.outputLatency || this.ctx.baseLatency || 0 : 0; }
  clock() { return this.run && this.run.perf ? this._now() / 1000 : this.ctx.currentTime - this.latency(); }

  // A pure, inspectable plan. Every audio event is submitted before the first frame.
  static buildPlan(job, options = {}) {
    const bpm = options.bpm || 60, beat = 60 / bpm, kind = options.kind || 'trial';
    const valving = kind === 'hand' || kind === 'machine';
    const countIn = valving ? (options.countIn === undefined ? 4 : options.countIn) : 0;
    const total = num(totalBeats(job)), ticks = [];
    if (valving) {
      for (let k = 0; k < countIn; k++) ticks.push({ t: k * beat, strong: k === 0 });
      for (let k = 0; k <= Math.ceil(total - 1e-9); k++) ticks.push({ t: (countIn + k) * beat, strong: k % job.meter[0] === 0 });
    }
    return { kind, bpm, beat, total, countIn, ticks, tones: kind === 'hand' ? [] : schedule(job, bpm), holds: valving ? pressPlan(job).map(([a, b]) => [num(a), num(b)]) : [], duration: (countIn + total) * beat + 0.42 };
  }

  play(jobOrNotes, jointsOrOptions = {}, options = {}) {
    let job, opts;
    if (Array.isArray(jobOrNotes)) {
      opts = options;
      job = { notes: jobOrNotes, joints: jointsOrOptions, meter: opts.meter || [4, 4], bpm: opts.bpm || 60 };
    } else { job = jobOrNotes; opts = jointsOrOptions || {}; }
    const kind = opts.kind || 'trial', valving = kind === 'hand' || kind === 'machine';
    if (kind === 'hand' && this._now() - this.endedAt < 600) return null;
    this.stop();
    const a = this.initialize();
    const plan = WorkshopAudio.buildPlan(job, { ...opts, kind, countIn: opts.countIn === undefined ? (this.valved ? 2 : 4) : opts.countIn });
    const t0 = (a ? a.currentTime : this._now() / 1000) + 0.12;
    const r = { ...plan, job, perf: !a, t0, tb0: t0 + plan.countIn * plan.beat, end: t0 + (plan.countIn + plan.total) * plan.beat + 0.3,
      holds: [], down: null, ctx0: a ? a.currentTime : 0, p0: this._now(), lastNow: null, lastAt: this._now(), correctionMs: Number(opts.correctionMs) || 0,
      audioStarted: !!a && a.state === 'running', plan: plan.holds };
    this.run = r;
    if (valving) this.valved = true;
    if (a) {
      try {
        for (const x of plan.ticks) this._tick(t0 + x.t, x.strong);
        for (const x of plan.tones) {
          this._pipeTone(x.midi, r.tb0 + x.t, x.len, x.attack, x.release);
          this._drop(r.tb0 + x.t, x.attack === 'fresh');
        }
      } catch (error) { this._emit('onError', error); this._toPerformance(r); }
    }
    this._emit('onStart', r);
    this.raf = this._raf(() => this._frame());
    return r;
  }

  _toPerformance(r) {
    this._stopValveSound(); this._silence();
    const shift = this._now() / 1000 + 0.1 - r.t0;
    r.perf = true; r.t0 += shift; r.tb0 += shift; r.end += shift;
    r.holds = []; r.down = null;
    this._notifyState();
  }

  _frame() {
    const r = this.run;
    if (!r) return;
    if (!r.perf && this._now() - r.p0 > 1200 && this.ctx.currentTime === r.ctx0) this._toPerformance(r);
    const now = this.clock(), beat = (now - r.tb0) / r.beat;
    if (!r.perf) {
      if (this.ctx.state === 'running') r.audioStarted = true;
      if (now !== r.lastNow) { r.lastNow = now; r.lastAt = this._now(); }
      else if (this.ctx.currentTime !== r.ctx0 && this._now() - r.lastAt > 800) { this.abort('sound'); return; }
    }
    const label = beat < 0 && r.countIn ? String(Math.min(r.countIn, Math.max(1, r.countIn - Math.ceil(-beat) + 1))) : '';
    const pressed = r.kind === 'machine' ? r.plan.some(([a, b]) => beat >= a && beat < b) : r.down !== null;
    this._emit('onFrame', { beat, total: r.total, kind: r.kind, countIn: r.countIn, label, holds: r.holds, down: r.down, pressed, fallback: r.perf, run: r });
    if (now >= r.end) { this._finish(); return; }
    this.raf = this._raf(() => this._frame());
  }

  _inputBeat(r) { return (this.clock() - r.correctionMs / 1000 - r.tb0) / r.beat; }

  valveStart() {
    const r = this.run;
    if (!r || r.kind !== 'hand' || r.down !== null) return false;
    const b = this._inputBeat(r);
    if (b >= r.total) return false;
    r.down = b;
    if (this.ctx && !r.perf) this._startValveSound(r);
    this._emit('onValve', { pressed: true, beat: b });
    return true;
  }

  valveStop() {
    const r = this.run;
    if (!r || r.kind !== 'hand' || r.down === null) { this._stopValveSound(); return false; }
    const b = this._inputBeat(r);
    if (b > 0) r.holds.push([r.down, Math.min(b, r.total)]);
    r.down = null;
    this._stopValveSound();
    this._emit('onValve', { pressed: false, beat: b });
    return true;
  }

  _startValveSound(r) {
    const job = r.job, st = starts(job).map(num), t = this.ctx.currentTime;
    const when = Math.max(t, r.tb0), endT = r.tb0 + r.total * r.beat;
    if (when >= endT) return;
    const bs = (when - r.tb0) / r.beat;
    let i0 = 0;
    st.forEach((s, i) => { if (s <= bs + 1e-9) i0 = i; });
    const o = this.ctx.createOscillator(), g = this.ctx.createGain(), extras = [];
    o.setPeriodicWave(this.wave);
    o.frequency.setValueAtTime(hz(midiOf(job.notes[i0].p)), when);
    for (let i = i0 + 1; i < st.length; i++) {
      const T = r.tb0 + st[i] * r.beat;
      o.frequency.setValueAtTime(hz(midiOf(job.notes[i].p)), T);
      if (!samePitch(job.notes[i].p, job.notes[i - 1].p)) extras.push(this._drop(T, false));
    }
    g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(0.24, when + 0.018);
    g.gain.setValueAtTime(0.24, Math.max(when + 0.018, endT - 0.04));
    g.gain.linearRampToValueAtTime(0.0001, Math.max(when + 0.019, endT));
    o.connect(g); g.connect(this.master); o.start(when); o.stop(Math.max(when + 0.02, endT + 0.06)); this._keep(o);
    extras.push(this._drop(when, true));
    this.valve = { o, g, extras };
  }

  _stopValveSound() {
    if (!this.valve) return;
    const t = this.ctx.currentTime, v = this.valve;
    try { v.g.gain.cancelScheduledValues(t); v.g.gain.setTargetAtTime(0.0001, t, 0.012); v.o.stop(t + 0.09); } catch (_) { /* already ended */ }
    v.extras.forEach((node) => { try { node.stop(); } catch (_) { /* already ended */ } });
    this.valve = null;
  }

  _finish() {
    const r = this.run;
    if (!r) return;
    if (r.kind === 'hand' && r.down !== null) { r.holds.push([r.down, r.total]); r.down = null; }
    const result = { kind: r.kind, holds: r.kind === 'machine' ? r.plan : r.holds, judgment: r.kind === 'hand' ? judgeHold(r.holds, r.job) : null, machine: r.kind === 'machine', fallback: r.perf };
    this.stop();
    if (r.kind === 'hand' || r.kind === 'machine') this.endedAt = this._now();
    this._emit('onFinish', result);
  }

  stop() {
    if (this.raf) this._caf(this.raf);
    this.raf = 0;
    this._stopValveSound(); this._silence(); this.run = null;
  }

  abort(reason = 'sound') {
    const hadRun = !!this.run;
    this.stop();
    if (hadRun) this._emit('onAbort', { reason, text: reason === 'hidden' || reason === 'blur' ? '화면을 떠나서 멈췄어요. 다시 시작해 주세요.' : '소리가 멈춰서 중단했어요. 소리를 켜고 다시 시작해 주세요.' });
  }

  resetDay() { this.valved = false; }

  dispose() {
    this.stop();
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this._visibility);
    if (typeof window !== 'undefined') { window.removeEventListener('blur', this._blur); window.removeEventListener('pagehide', this._blur); }
    if (this.ctx) this.ctx.removeEventListener('statechange', this._stateChange);
  }
}
