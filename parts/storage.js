// 8 STORAGE · SaveV1; blocked storage falls back to memory without losing this visit.
const SAVE_KEY = "ppg_save_v1";
const SAVE_BACKUP_KEY = "ppg_save_v1_backup";
const SAVE_CARD_KEYS = ["plain", "tie", "tie-dot", "tie-bar", "tie-need", "slur", "slur-same", "tie-in-slur"];
const saveClone = value => JSON.parse(JSON.stringify(value));
function defaultSave() {
  return {
    version: 1,
    settings: { volume: 0.8, muted: false, slow: false, holdOffsetMs: 0, motion: "system", tutorialSeen: false, soundChecked: false },
    days: Object.fromEntries(Array.from({length:7}, (_, i) => ["d" + i, {passed:false, stamp:0, runs:0, best:0}])),
    cards: Object.fromEntries(SAVE_CARD_KEYS.map(tag => [tag, {got:false, valve:0}])),
    scenes: [],
    stats: { jobs:0, clean:0, valves:0, smooth:0 },
    active: null
  };
}
function validateSave(value, dayDefinitions) {
  const object = v => v !== null && typeof v === "object" && !Array.isArray(v);
  const integer = v => Number.isInteger(v) && v >= 0;
  if (!object(value) || value.version !== 1) return null;
  const defs = dayDefinitions || (typeof DAYS !== "undefined" ? DAYS : null);
  const counts = defs ? Object.fromEntries(defs.map(day => [day.id, day.jobs.length])) : {d0:6,d1:7,d2:8,d3:7,d4:7,d5:7,d6:7};
  const out = defaultSave();
  if (value.settings !== undefined) {
    if (!object(value.settings)) return null;
    for (const [key, base] of Object.entries(out.settings)) {
      if (!(key in value.settings)) continue;
      const v = value.settings[key];
      if (typeof v !== typeof base) return null;
      if (typeof base === "number" && !Number.isFinite(v)) return null;
      if (key === "volume" && (v < 0 || v > 1)) return null;
      if (key === "motion" && !["system", "reduced", "full"].includes(v)) return null;
      out.settings[key] = v;
    }
  }
  if (value.days !== undefined) {
    if (!object(value.days)) return null;
    for (const key of Object.keys(out.days)) {
      if (!(key in value.days)) continue;
      const day = value.days[key];
      if (!object(day)) return null;
      const fields = out.days[key];
      for (const prop of Object.keys(fields)) {
        if (!(prop in day)) continue;
        if (prop === "passed" ? typeof day[prop] !== "boolean" : !integer(day[prop])) return null;
        fields[prop] = day[prop];
      }
      if (fields.stamp > 2 || fields.best > counts[key]) return null;
    }
  }
  if (value.cards !== undefined) {
    if (!object(value.cards)) return null;
    for (const key of SAVE_CARD_KEYS) {
      if (!(key in value.cards)) continue;
      const card = value.cards[key];
      if (!object(card)) return null;
      if (card.got !== undefined && typeof card.got !== "boolean") return null;
      if (card.valve !== undefined && (!integer(card.valve) || card.valve > 3)) return null;
      out.cards[key] = {got:card.got === undefined ? false : card.got, valve:card.valve === undefined ? 0 : card.valve};
    }
  }
  if (value.scenes !== undefined) {
    if (!Array.isArray(value.scenes) || value.scenes.some(id => !["S1", "S2", "S3", "S4"].includes(id))) return null;
    out.scenes = [...new Set(value.scenes)];
  }
  if (value.stats !== undefined) {
    if (!object(value.stats)) return null;
    for (const key of Object.keys(out.stats)) {
      if (!(key in value.stats)) continue;
      if (!integer(value.stats[key])) return null;
      out.stats[key] = value.stats[key];
    }
  }
  if (value.active !== undefined && value.active !== null) {
    const a = value.active, n = object(a) ? counts[a.day] : null;
    if (!n || !integer(a.index) || a.index >= n || !Array.isArray(a.retry) || !Array.isArray(a.results)) return null;
    if (a.retry.some(i => !integer(i) || i >= n - 1) || new Set(a.retry).size !== a.retry.length) return null;
    if (a.results.length > n || Object.keys(a.results).length !== a.results.length || a.results.some(r => !object(r) || ![1,2].includes(r.recipe) || ![0,1,2,3,4].includes(r.valve))) return null;
    if (a.repeating !== undefined && typeof a.repeating !== "boolean") return null;
    if (a.retryPos !== undefined && (!integer(a.retryPos) || a.retryPos > a.retry.length)) return null;
    if (a.phase !== undefined && !["count", "pipe", "valve", "deliver"].includes(a.phase)) return null;
    const cursor = a.retryPos === undefined ? 0 : a.retryPos;
    if (a.repeating === true && (cursor >= a.retry.length || a.retry[cursor] !== a.index)) return null;
    out.active = {day:a.day, index:a.index, retry:[...a.retry], results:a.results.map(r => ({recipe:r.recipe, valve:r.valve}))};
    // Optional v1 extensions preserve the retry cursor and delivered screen across reloads.
    if (a.repeating !== undefined) out.active.repeating = a.repeating;
    if (a.retryPos !== undefined) out.active.retryPos = a.retryPos;
    if (a.phase !== undefined) out.active.phase = a.phase;
  }
  return out;
}
class WorkshopStorage {
  constructor(storage) {
    this.memory = defaultSave();
    this.backupRaw = null;
    this.lastError = null;
    this.persistent = false;
    try {
      this.storage = arguments.length ? storage : window.localStorage;
      if (!this.storage || typeof this.storage.getItem !== "function" || typeof this.storage.setItem !== "function") throw new Error("Storage unavailable");
      // A readable previous save remains usable even if a later quota check fails.
      const existing = this.storage.getItem(SAVE_KEY);
      if (existing !== null) {
        let candidate = null;
        try { candidate = validateSave(JSON.parse(existing)); } catch (_) {}
        if (candidate) this.memory = candidate;
        else this.backupRaw = existing;
      }
      const probe = SAVE_KEY + "_probe";
      this.storage.setItem(probe, "1");
      this.storage.removeItem(probe);
      this.persistent = true;
    } catch (error) { this.lastError = error; this.storage = null; }
  }
  load() {
    if (!this.persistent) return saveClone(this.memory);
    let raw;
    try { raw = this.storage.getItem(SAVE_KEY); }
    catch (error) { this.lastError = error; this.persistent = false; return saveClone(this.memory); }
    if (raw === null) return saveClone(this.memory);
    let parsed = null;
    try { parsed = validateSave(JSON.parse(raw)); } catch (_) { /* Corruption is backed up below. */ }
    if (parsed) { this.memory = parsed; return saveClone(parsed); }
    this.backupRaw = raw;
    this.memory = defaultSave();
    try {
      // Preserve the exact raw string before replacing the invalid active save.
      this.storage.setItem(SAVE_BACKUP_KEY, raw);
      this.storage.setItem(SAVE_KEY, JSON.stringify(this.memory));
    } catch (error) { this.lastError = error; this.persistent = false; }
    return saveClone(this.memory);
  }
  save(value) {
    const normalized = validateSave(value);
    if (!normalized) throw new TypeError("Invalid SaveV1 data");
    this.memory = normalized;
    if (!this.persistent) return false;
    try { this.storage.setItem(SAVE_KEY, JSON.stringify(normalized)); return true; }
    catch (error) { this.lastError = error; this.persistent = false; return false; }
  }
  reset() {
    this.save(defaultSave());
    return saveClone(this.memory);
  }
}
function runStorageTests() {
  const checks = [];
  const check = (id, name, fn) => { try { fn(); checks.push({id,name,pass:true,error:null}); } catch (error) { checks.push({id,name,pass:false,error:error.message}); } };
  const expect = (condition, message) => { if (!condition) throw new Error(message); };
  const backend = () => { const records = new Map(); return {getItem:k => records.has(k) ? records.get(k) : null, setItem:(k,v) => records.set(k,String(v)), removeItem:k => records.delete(k)}; };
  check("SV-01", "저장 version:1 왕복", () => {
    const store = backend(), first = new WorkshopStorage(store), data = defaultSave();
    data.settings.slow = true; data.days.d0 = {passed:true,stamp:1,runs:2,best:5};
    data.active = {day:"d1",index:1,retry:[0],results:[{recipe:1,valve:4}]};
    first.save(data);
    expect(JSON.stringify(new WorkshopStorage(store).load()) === JSON.stringify(data), "SaveV1 round trip differs");
    expect(validateSave({version:1,settings:{slow:true}}).settings.volume === 0.8, "Missing defaults were not restored");
    data.active = {day:"d1",index:2,retry:[0,2],results:[{recipe:1,valve:2},{recipe:2,valve:0},{recipe:1,valve:0}],repeating:true,retryPos:1,phase:"deliver"};
    first.save(data);
    expect(JSON.stringify(new WorkshopStorage(store).load().active) === JSON.stringify(data.active), "Retry cursor/phase did not survive reload");
  });
  check("SV-02", "손상·미래 버전 원본 보존", () => {
    for (const raw of ["{invalid", '{"version":2}', '{"version":1,"settings":{"slow":4}}']) {
      const store = backend(); store.setItem(SAVE_KEY,raw);
      const data = new WorkshopStorage(store).load();
      expect(data.version === 1 && data.stats.jobs === 0, "Invalid save was not reset");
      expect(store.getItem(SAVE_BACKUP_KEY) === raw, "Original save was not backed up");
    }
  });
  check("SV-03", "인메모리 폴백", () => {
    const blocked = {getItem:() => {throw new Error("blocked");},setItem:() => {throw new Error("blocked");},removeItem:() => {}};
    const instance = new WorkshopStorage(blocked), data = defaultSave(); data.stats.jobs = 5;
    expect(instance.save(data) === false && instance.persistent === false && instance.load().stats.jobs === 5, "Blocked storage loses memory progress");
    const store = backend(), quota = new WorkshopStorage(store); store.setItem = () => {throw new Error("quota");};
    expect(quota.save(data) === false && quota.load().stats.jobs === 5, "Quota fallback loses memory progress");
  });
  check("SV-04", "도면 카드 키 저장 왕복", () => {
    const store = backend(), instance = new WorkshopStorage(store), data = defaultSave();
    data.cards["tie-bar"] = {got:true,valve:3}; data.cards["tie-in-slur"] = {got:true,valve:2};
    instance.save(data); const loaded = new WorkshopStorage(store).load();
    expect(loaded.cards["tie-bar"].got && loaded.cards["tie-in-slur"].valve === 2, "Hyphenated keys changed");
    expect(!("lowOk" in loaded), "Visit-only field persisted");
  });
  return checks;
}
