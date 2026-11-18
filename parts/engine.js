// Reference implementation: appendix C.1–C.3, design v1.0 (2026-11-14).

// ═══ 음표 파이프 공방 · 이론 엔진 초안 ═══
// 길이는 전부 분수다. 소수로 바꾸는 곳은 화면 좌표와 소리 시각뿐이다.
// 음표 길이 표도, "이 곡선은 붙임줄" 같은 이름표도 두지 않는다. 곡선의 이름은 양 끝 음에서 읽는다.

// ── 분수 ──
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
const F = (n, d = 1) => { if (d < 0) { n = -n; d = -d; } const g = gcd(n, d) || 1; return { n: n / g, d: d / g }; };
const add = (a, b) => F(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a, b) => F(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a, b) => F(a.n * b.n, a.d * b.d);
const div = (a, b) => F(a.n * b.d, a.d * b.n);
const eq = (a, b) => a.n === b.n && a.d === b.d;
const lt = (a, b) => a.n * b.d < b.n * a.d;
const minF = (a, b) => (lt(a, b) ? a : b);
const num = (a) => a.n / a.d;
const str = (a) => (a.d === 1 ? String(a.n) : a.n + "/" + a.d);
const isPow2 = (x) => Number.isInteger(x) && x > 0 && (x & (x - 1)) === 0;

// ── 음표 길이와 음높이 ──
const noteWhole = (den, dots = 0) => F(2 ** (dots + 1) - 1, den * 2 ** dots);        // 온음표 = 1
const toBeats = (whole, beatDen = 4) => mul(whole, F(beatDen));                      // 박자표의 아래 숫자가 한 박
const MAJOR = [2, 2, 1, 2, 2, 2, 1];                                                 // 장음계 공식: 온 온 반 온 온 온 반
const semis = (letter) => MAJOR.slice(0, letter).reduce((s, x) => s + x, 0);
const midiOf = (p) => 12 * (p.oct + 1) + semis(p.letter);
const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
const stepOf = (p) => p.letter + 7 * (p.oct - 4);                                    // 가온 도 = 0. 오선의 줄과 칸을 하나씩 센다
const samePitch = (a, b) => a.letter === b.letter && a.oct === b.oct;

// ── 의뢰: 씨앗만 적는다. 음표 "C4/4 C4/4 D4/4 E4/4"(음이름·옥타브/음표 분모, 점은 뒤에 .), 이음매 "tss"(t 붙임, s 이음, g 뗌) ──
const LETTERS = "CDEFGAB";
const JOINT = { g: "gap", s: "slur", t: "tie" };
function parseNotes(text) {
  return text.trim().split(/\s+/).filter((tok) => tok !== "|").map((tok) => {
    const m = /^([A-G])(\d)\/(\d+)(\.*)$/.exec(tok);
    if (!m) throw new Error("음표 씨앗을 읽을 수 없다: " + tok);
    return { p: { letter: LETTERS.indexOf(m[1]), oct: +m[2] }, den: +m[3], dots: m[4].length };
  });
}
const parseJoints = (text, n) => Array.from({ length: n - 1 }, (_, k) => JOINT[(text || "")[k]] || "gap");
function makeJob(seed) {
  const meter = seed.meter.split("/").map(Number), notes = parseNotes(seed.notes);
  return { id: seed.id || "", meter, notes, joints: parseJoints(seed.joints, notes.length), bpm: seed.bpm || 60 };
}

// ── 시간 ──
const durOf = (job, i) => toBeats(noteWhole(job.notes[i].den, job.notes[i].dots), job.meter[1]);
function starts(job) { const out = []; let t = F(0); job.notes.forEach((_, i) => { out.push(t); t = add(t, durOf(job, i)); }); return out; }
const totalBeats = (job) => job.notes.reduce((t, _, i) => add(t, durOf(job, i)), F(0));
const barBeats = (job) => F(job.meter[0]);
const floorF = (a) => Math.floor(a.n / a.d);
function fitsBars(job) {                                                             // 음표 하나는 마디 하나 안에 있고, 마지막 마디가 꽉 찬다
  const bar = barBeats(job), st = starts(job), total = totalBeats(job);
  const inside = job.notes.every((_, i) => !lt(mul(F(floorF(div(st[i], bar)) + 1), bar), add(st[i], durOf(job, i))));
  return inside && div(total, bar).d === 1;
}
const onBar = (job, k) => div(starts(job)[k + 1], barBeats(job)).d === 1;            // 이음매 k가 마디선 위에 있는가

// ── 이음매: 뗌(gap) · 이음(slur) · 붙임(tie) ──
const canTie = (job, k) => samePitch(job.notes[k].p, job.notes[k + 1].p);
function withJoint(job, k, state) {                                                  // 붙임은 같은 높이에서만 된다
  if (state === "tie" && !canTie(job, k)) return { ok: false, why: "pitch", job };
  const joints = job.joints.slice(); joints[k] = state;
  return { ok: true, job: Object.assign({}, job, { joints }) };
}
const validJoints = (job) => job.joints.every((jt, k) => jt !== "tie" || canTie(job, k));
const gapBeats = (dur) => minF(F(1, 4), div(dur, F(2)));                             // 뗌: 소리 끝에서 1/4박을 비운다. 짧은 소리는 절반까지만

// 소리 목록: 붙임으로 이어진 음표들을 소리 하나로 합친다
function sounds(job) {
  const st = starts(job), out = [];
  for (let i = 0; i < job.notes.length;) {
    let j = i, dur = durOf(job, i);
    while (j < job.joints.length && job.joints[j] === "tie") { j++; dur = add(dur, durOf(job, j)); }
    const before = i === 0 ? null : job.joints[i - 1], after = j < job.joints.length ? job.joints[j] : null;
    const gap = after === "gap" ? gapBeats(dur) : F(0);
    out.push({ p: job.notes[i].p, from: i, to: j, start: st[i], dur, gap, len: sub(dur, gap), attack: before === "slur" ? "legato" : "fresh", after });
    i = j + 1;
  }
  return out;
}
const bells = (job) => sounds(job).length;                                           // 방울 = 소리 시작
function streams(job) {                                                              // 물줄기: 뗌으로 나뉜 구간 [첫 음, 끝 음]
  const out = []; let a = 0;
  job.joints.forEach((jt, k) => { if (jt === "gap") { out.push([a, k]); a = k + 1; } });
  out.push([a, job.notes.length - 1]);
  return out;
}

// ── 악보의 곡선 ──
function toCurves(job) {                                                             // 이음매 → 곡선. 이음줄은 물줄기의 첫 음에서 끝 음까지
  const ties = [], slurs = [];
  job.joints.forEach((jt, k) => { if (jt === "tie") ties.push([k, k + 1]); });
  streams(job).forEach(([a, b]) => { if (job.joints.slice(a, b).includes("slur")) slurs.push([a, b]); });
  return { ties, slurs, all: ties.concat(slurs) };
}
function readCurves(notes, curves) {                                                 // 곡선 → 이음매. 같은 높이의 이웃한 두 음만 이으면 붙임줄, 그 밖에는 이음줄
  const joints = Array(notes.length - 1).fill("gap");
  const isTie = ([i, j]) => j === i + 1 && samePitch(notes[i].p, notes[j].p);
  curves.filter(isTie).forEach(([i]) => { joints[i] = "tie"; });
  curves.filter((c) => !isTie(c)).forEach(([i, j]) => { for (let k = i; k < j; k++) if (joints[k] !== "tie") joints[k] = "slur"; });
  return joints;
}
const ambiguous = (job) => toCurves(job).slurs.filter(([a, b]) => b === a + 1 && samePitch(job.notes[a].p, job.notes[b].p));   // 붙임줄로 읽히고 마는 이음줄

// ── 붙임줄은 왜 필요한가 ──
function singleNote(beats, beatDen = 4, maxDots = 1) {                               // 이 길이를 음표 하나로 적을 수 있으면 그 음표
  const whole = div(beats, F(beatDen));
  for (let dots = 0; dots <= maxDots; dots++) {
    const den = div(F(2 ** (dots + 1) - 1, 2 ** dots), whole);
    if (den.d === 1 && isPow2(den.n)) return { den: den.n, dots };
  }
  return null;
}
function whyTie(job, k) {                                                            // bar 마디선을 넘는다 · need 음표 하나로 적을 수 없다 · choice 음표 하나로도 적을 수 있다
  if (job.joints[k] !== "tie") return null;
  if (onBar(job, k)) return "bar";
  const s = sounds(job).find((x) => x.from <= k && k < x.to);
  return singleNote(s.dur, job.meter[1]) ? "choice" : "need";
}

// ── 소리 예약표(초). 첫 음의 시작이 0 ──
const beatsToSec = (beats, bpm) => (num(beats) * 60) / bpm;
function schedule(job, bpm = job.bpm) {
  const list = sounds(job);
  return list.map((s, i) => ({ t: beatsToSec(s.start, bpm), len: beatsToSec(s.len, bpm), midi: midiOf(s.p), attack: s.attack,
    release: s.after !== "slur" ? "cut" : samePitch(s.p, list[i + 1].p) ? "dip" : "over" }));
}

// ── 검수: 내 이음매를 정답과 견준다 ──
function inspect(job, truth) {
  const out = [];
  truth.forEach((want, k) => {
    const got = job.joints[k];
    if (got === want) return;
    const why = want === "tie" ? "tie-missed" : got === "tie" ? (want === "slur" ? "tie-in-slur" : "tie-no-curve") : want === "slur" ? "slur-broken" : "slur-extra";
    out.push({ k, want, got, why });
  });
  return out;
}

// ── 밸브(손) 판정: 누른 구간 [누름, 뗌](박)만 받는 순수 함수 ──
// 누른 채로 지나가야 하는 이음매: 붙임, 높이가 다른 이음. 뗐다 눌러야 하는 이음매: 뗌, 높이가 같은 이음
const expectHeld = (job, k) => job.joints[k] === "tie" || (job.joints[k] === "slur" && !canTie(job, k));
function pressPlan(job) {                                                            // 설계도대로 누를 구간
  const st = starts(job), total = totalBeats(job), out = [];
  let a = F(0);
  job.joints.forEach((jt, k) => {
    if (expectHeld(job, k)) return;
    const s = sounds(job).find((x) => x.from <= k && k <= x.to);
    out.push([a, sub(st[k + 1], jt === "gap" ? s.gap : F(1, 16))]);
    a = st[k + 1];
  });
  out.push([a, total]);
  return out;
}
function judgeHold(holds, job, eps = 1 / 16, win = 1 / 4) {
  const st = starts(job).map(num);
  const heldThrough = (t) => holds.some(([a, b]) => a <= t - eps && t + eps <= b);
  const pressNear = (t) => holds.some(([a]) => Math.abs(a - t) <= win);
  const first = holds.some(([a, b]) => a <= win && b >= eps);                          // 첫 음이 시작할 때 누르고 있었는가(준비 박에서 미리 눌러도 된다)
  const joints = job.joints.map((want, k) => {
    const held = expectHeld(job, k), t = st[k + 1];
    return { k, want, expectHeld: held, ok: held ? heldThrough(t) : pressNear(t) && !heldThrough(t) };
  });
  const planned = 1 + joints.filter((j) => !j.expectHeld).length;                      // 설계도대로면 누르는 횟수
  const extra = holds.filter(([a], i) => i > 0 && !st.some((t) => Math.abs(a - t) <= win)).length;   // 음표 한가운데에서 새로 누른 횟수(이음매 근처의 누름은 이음매 쪽에서, 첫 누름은 first에서 센다)
  const errors = joints.filter((j) => !j.ok).length + extra + (first ? 0 : 1);
  return { joints, first, extra, presses: holds.length, planned, errors, grade: errors === 0 ? "smooth" : errors === 1 ? "drip" : "leak" };
}

// ── 우리말 ──
const SOLFA = ["도", "레", "미", "파", "솔", "라", "시"];                              // 계이름 글자. 이론 표가 아니다
const GLYPH = { "1/2": "½", "1/4": "¼", "3/4": "¾" };                                // 분수 글자
const wa = (word) => word + ((word.charCodeAt(word.length - 1) - 0xac00) % 28 ? "과" : "와");   // 받침에 따라 와/과
const solfa = (p) => (p.oct > 4 ? "높은 " : p.oct < 4 ? "낮은 " : "") + SOLFA[p.letter];
const noteKo = (den, dots = 0) => "점".repeat(dots) + (den === 1 ? "온음표" : den + "분음표");
function beatsKo(f) {
  const whole = floorF(f), rest = F(f.n - whole * f.d, f.d);
  if (rest.n === 0) return whole + "박";
  return (GLYPH[str(rest)] ? (whole || "") + GLYPH[str(rest)] : str(f)) + "박";
}
const JOINT_KO = { gap: "뗌", slur: "이음", tie: "붙임" };
const soundLine = (job) => sounds(job).map((s, i, all) => solfa(s.p) + " " + beatsKo(s.dur) + (i < all.length - 1 ? (s.after === "slur" ? " → " : " · ") : "")).join("");

// ═══ 제품용 확장(의뢰 스파이크부터) ═══
// ── 셈 의뢰: 보기와 답은 글자열 열쇠("3", "5/2")로 견준다 ──
const fromStr = (s) => { const [n, d] = String(s).split("/").map(Number); return F(n, d || 1); };
const longest = (job) => sounds(job).reduce((a, s) => (lt(a.dur, s.dur) ? s : a));          // 가장 긴 소리(같으면 앞의 것)
const countAnswer = (job, q) => (q === "bells" ? String(bells(job)) : str(longest(job).dur));
function countChoices(job, q) {                                                      // 방울: 1~음표 수. 길이: 정답, 이음줄 안을 다 더한 값, 음표 하나하나, 전체에서 넷까지
  if (q === "bells") return Array.from({ length: job.notes.length }, (_, i) => String(i + 1));
  const cand = [];
  const push = (f) => { if (!cand.some((c) => eq(c, f))) cand.push(f); };
  push(longest(job).dur);
  toCurves(job).slurs.forEach(([a, b]) => { let t = F(0); for (let i = a; i <= b; i++) t = add(t, durOf(job, i)); push(t); });
  job.notes.forEach((_, i) => push(durOf(job, i)));
  push(totalBeats(job));
  return cand.slice(0, 4).sort((x, y) => num(x) - num(y)).map(str);
}
function countCause(job, q, picked) {                                                // 틀린 셈의 원인
  const C = toCurves(job);
  if (q === "bells") {
    if (!C.all.length) return "no-curve";                                            // 곡선이 없으면 음표마다 방울
    if (+picked > bells(job)) return "tie-counted";                                  // 붙임줄 뒤의 음도 셌다
    return C.slurs.length ? "slur-merged" : "tie-over";                              // 이음줄을 한 음으로 셌다 · 붙임줄 밖의 음까지 합쳤다
  }
  const top = longest(job);
  if (lt(fromStr(picked), top.dur)) return top.to > top.from ? "not-summed" : "note-length";   // 붙인 길이를 더하지 않았다 · 음표 길이를 잘못 읽었다
  return C.slurs.length ? "slur-summed" : "over-summed";                             // 이음줄 안을 더했다 · 곡선 없는 음까지 더했다
}
const countLabel = (q, key) => (q === "bells" ? key + "번" : beatsKo(fromStr(key)));

// ── 검수에서 먼저 말할 원인: 초안의 순서(같은 음과 소리 시작 → 선율의 연결), 같으면 앞의 이음매 ──
const CAUSE_ORDER = ["tie-missed", "tie-in-slur", "tie-no-curve", "slur-broken", "slur-extra"];
const firstCause = (list) => list.slice().sort((a, b) => CAUSE_ORDER.indexOf(a.why) - CAUSE_ORDER.indexOf(b.why) || a.k - b.k)[0] || null;

// ── 말 의뢰의 문장 틀 ──
function wordKind(job) {
  const n = job.notes.length, j = job.joints;
  if (n === 2 && j[0] === "tie") return "tie-pair";                                  // "두 도를 한 번만 소리 나게 붙여 주세요."
  if (j.length && j.every((x) => x === "slur")) return "slur-all";                   // "도 레 미를 틈 없이 이어 주세요."
  if (j.includes("tie") && j.includes("gap") && j.every((x, k) => (canTie(job, k) ? x === "tie" : x === "gap"))) return "tie-all";   // "붙일 수 있는 곳을 모두 붙여 주세요."
  return null;
}

// ── 도면 카드: 이 의뢰가 다루는 연결의 종류 ──
function tagsOf(job) {
  const t = [], add1 = (x) => { if (!t.includes(x)) t.push(x); }, C = toCurves(job);
  if (!C.all.length) add1("plain");
  job.joints.forEach((jt, k) => {
    if (jt === "tie") {
      const w = whyTie(job, k), s = sounds(job).find((x) => x.from <= k && k < x.to), one = singleNote(s.dur, job.meter[1]);
      add1(w === "bar" ? "tie-bar" : w === "need" ? "tie-need" : one && one.dots ? "tie-dot" : "tie");
    }
    if (jt === "slur") add1(canTie(job, k) ? "slur-same" : "slur");
  });
  C.slurs.forEach(([a, b]) => { if (job.joints.slice(a, b).includes("tie")) add1("tie-in-slur"); });
  return t;
}
const eul = (word) => word + ((word.charCodeAt(word.length - 1) - 0xac00) % 28 ? "을" : "를");   // 받침에 따라 을/를

const ASK_KO = { word: "말", score: "설계도", sound: "소리", repair: "수리", count: "셈" };
const TOOL_CODE = { gap: "g", slur: "s", tie: "t" };
const RANK = { "매끈": 3, "한 곳 샘": 2, "여러 곳 샘": 1, "기계": 0.5 };

function briefText(seed, job) {
  if (seed.ask === "count") return (seed.reveal === "before" ? "물을 틀어 보세요. " : "악보만 보고 맞혀요. ") + (seed.q === "bells" ? "방울은 몇 번 울릴까요?" : "가장 긴 소리는 몇 박일까요?");
  if (seed.ask === "word") {
    const kind = wordKind(job), names = job.notes.map((nt) => solfa(nt.p));
    return kind === "tie-pair" ? `두 ${eul(names[0])} 한 번만 소리 나게 붙여 주세요.` : kind === "slur-all" ? `${names.slice(0, -1).join(" ")} ${eul(names[names.length - 1])} 틈 없이 이어 주세요.` : "붙일 수 있는 곳을 모두 붙여 주세요.";
  }
  if (seed.ask === "score") return "악보대로 물길을 놓아 주세요.";
  if (seed.ask === "sound") return "소리를 듣고 물길을 놓아 주세요.";
  const n = inspect(Object.assign({}, job, { joints: parseJoints(seed.given, job.notes.length) }), job.joints).length;
  return seed.final ? "물길이 악보와 달라요. 틀린 곳을 찾아 고쳐 주세요." : `물길이 악보와 달라요. ${n}곳을 고쳐 주세요.`;
}
function causeText(w, seed, job) {                                                   // 검수의 원인 문구. 소리·말 의뢰에는 곡선이 안 보이므로 말을 달리한다
  const n = w.k + 1 + "번: ";
  if (seed.ask === "sound") return n + (w.want === "tie" ? "뒤의 음이 다시 시작하지 않았어요. 한 소리로 붙어 있어요." : w.want === "slur" && w.got === "tie" ? "뒤의 음이 다시 시작했어요. 붙은 소리가 아니에요." : w.want === "slur" ? "틈이 들리지 않았어요. 이어서 소리 나요." : "소리 사이에 틈이 있었어요. 떼어 주세요.");
  if (seed.ask === "word") return n + (w.want === "tie" ? "같은 높이예요. 붙이기를 고르고 눌러요." : w.want === "slur" ? "틈이 남아 있어요. 잇기를 고르고 눌러요." : "여기는 그대로 떼어 둬요.");
  return n + { "tie-missed": "같은 높이의 이웃한 두 음만 잇는 곡선은 붙임줄이에요. 뒤의 음은 다시 내지 않아요.", "tie-in-slur": `두 ${solfa(job.notes[w.k].p)}만 잇는 곡선이 없어요. 이음줄 안에서는 다시 소리 내요.`, "tie-no-curve": "여기는 곡선이 없어요. 같은 음이라도 따로 소리 내요.", "slur-broken": "이음줄 안이에요. 틈 없이 이어요.", "slur-extra": "곡선이 여기까지 오지 않아요. 살짝 떼요." }[w.why];
}
function countText(job, q, picked) {                                                 // 틀린 셈의 원인 문구
  const why = countCause(job, q, picked), top = longest(job);
  if (why === "no-curve") return "곡선이 없으면 음표마다 방울이 울려요. 같은 음도 따로 세요.";
  if (why === "tie-counted") return "붙임줄로 이어진 음은 다시 시작하지 않아요. 방울이 줄어요.";
  if (why === "slur-merged") return "이음줄은 음을 합치지 않아요. 음마다 새로 시작해요.";
  if (why === "tie-over") return "붙임줄은 곡선이 잇는 두 음만 합쳐요. 나머지는 따로 세요.";
  if (why === "not-summed") { const parts = []; for (let i = top.from; i <= top.to; i++) parts.push(beatsKo(durOf(job, i))); return `붙인 소리는 더한 길이예요. ${parts.join(" + ")} = ${beatsKo(top.dur)}.`; }
  if (why === "note-length") return `${noteKo(job.notes[top.from].den, job.notes[top.from].dots)}는 ${beatsKo(top.dur)}이에요. 관의 길이를 보세요.`;
  if (why === "slur-summed") return "이음줄은 길이를 합치지 않아요. 음마다 제 길이만큼 울려요.";
  return "곡선이 잇지 않은 음은 더하지 않아요.";
}
function valveText(j) {
  if (j.grade === "smooth") return { tone: "good", text: `매끈해요. ${j.presses}번 눌렀어요(설계도 ${j.planned}번).` };
  const bad = j.joints.find((x) => !x.ok), n = bad ? bad.k + 1 : 0;
  const why = !j.first ? "첫 음이 시작할 때 눌러요."
    : !bad ? "음표 한가운데에서는 새로 누르지 않아요."
    : bad.want === "tie" ? `${n}번은 붙임이에요. 떼지 않고 계속 눌러요.`
    : bad.want === "slur" && bad.expectHeld ? `${n}번은 이음이에요. 누른 채로 지나가요.`
    : bad.want === "slur" ? `${n}번은 같은 음을 잇는 자리예요. 짧게 뗐다 바로 눌러요.`
    : `${n}번은 뗌이에요. 뗐다가 다시 눌러요.`;
  return { tone: j.grade === "drip" ? "warn" : "bad", text: `${j.grade === "drip" ? "한 곳에서 샜어요." : "여러 곳에서 샜어요."} ${why}` };
}

// ── Pure verification suite (TH, IN, CN, JD 01–06, GN) ──
// Does not mutate jobs or play audio. Pair cases are exhaustive, not snapshots.
function runEngineTests(days) {
  const out = [], equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);
  const assert = (v,m='assertion failed') => {if(!v) throw new Error(m);};
  const test = (id,fn) => {try {const detail=fn();out.push({id,pass:true,detail:detail||''});}catch(e){out.push({id,pass:false,error:e.message});}};
  const jobs = days.flatMap(day => day.jobs.map(seed => ({seed,day,job:makeJob(seed)})));
  const byId = id => jobs.find(x=>x.seed.id===id).job;
  const product = (n, chars) => n ? product(n-1,chars).flatMap(s=>chars.map(c=>s+c)) : [''];
  const all = [];
  for(let n=2;n<=5;n++) {
    for(const pitches of product(n,['C','D','E'])) {
      const base=makeJob({meter:n+'/4',notes:pitches.split('').map(p=>p+'4/4').join(' ')});
      for(const jts of product(n-1,['g','s','t'])) {
        const job=Object.assign({},base,{joints:parseJoints(jts,n)});
        if(validJoints(job)) all.push(job);
      }
    }
  }
  test('TH-01',()=>{assert(all.length===8400);for(const job of all) assert(eq(sounds(job).reduce((a,s)=>add(a,s.dur),F(0)),totalBeats(job)));return '8,400 valid arrangements';});
  test('TH-02',()=>{for(const job of all){const list=sounds(job);assert(list.length===job.notes.length-job.joints.filter(j=>j==='tie').length);assert(new Set(list.map(s=>str(s.start))).size===list.length);}});
  test('TH-03',()=>{for(const job of all)assert(streams(job).length===job.joints.filter(j=>j==='gap').length+1);});
  test('TH-04',()=>{for(const job of all)for(const s of sounds(job)){assert(eq(add(s.len,s.gap),s.dur));assert(!lt(div(s.dur,F(2)),s.gap));assert((s.gap.n>0)===(s.after==='gap'));}});
  test('TH-05',()=>{for(const job of all){const c=toCurves(job);assert(c.ties.length===job.joints.filter(j=>j==='tie').length);assert(equal(c.slurs,streams(job).filter(([a,b])=>job.joints.slice(a,b).includes('slur'))));}});
  test('TH-06',()=>{let round=0,amb=0;for(const job of all){const ok=equal(readCurves(job.notes,toCurves(job).all),job.joints);assert(ok===(ambiguous(job).length===0));ok?round++:amb++;}assert(round===7056&&amb===1344);return '7,056 round trips; 1,344 explicitly ambiguous';});
  test('TH-07',()=>{let rejected=0;for(const job of all)for(let k=0;k<job.joints.length;k++)if(!canTie(job,k)){const before=JSON.stringify(job);const r=withJoint(job,k,'tie');assert(!r.ok&&r.job===job&&JSON.stringify(job)===before);rejected++;}/* Design prose says 13,740. The specified 8,400-case universe yields 18,408; verified rejection is a strict superset. */assert(rejected===18408);return '18,408 rejected ties (design prose: 13,740; documented arithmetic discrepancy)';});
  test('TH-08',()=>{for(const job of all){const st=starts(job);for(const s of sounds(job)){assert(eq(s.start,st[s.from]));assert(s.attack===(s.from>0&&job.joints[s.from-1]==='slur'?'legato':'fresh'));for(let k=s.from;k<s.to;k++)assert(canTie(job,k));}}});
  test('TH-09',()=>{const cases=[
    ['4/4','C4/4 C4/4 D4/4 E4/4','ggg',4,'도 1박 · 도 1박 · 레 1박 · 미 1박',0,0],
    ['2/4','C4/4 C4/4','t',1,'도 2박',1,0],
    ['3/4','C4/2 C4/4','t',1,'도 3박',1,0],
    ['3/4','C4/2 C4/8 E4/8','tg',2,'도 2½박 · 미 ½박',1,0],
    ['3/4','C4/4 D4/4 E4/4','ss',3,'도 1박 → 레 1박 → 미 1박',0,1],
    ['4/4','E4/4 E4/4 G4/2','ss',3,'미 1박 → 미 1박 → 솔 2박',0,1],
    ['4/4','E4/4 E4/4 G4/2','ts',2,'미 2박 → 솔 2박',1,1],
    ['4/4','C4/4 C4/4 D4/4 E4/4','tss',3,'도 2박 → 레 1박 → 미 1박',1,1],
    ['4/4','C4/4 C4/4 D4/4 E4/4','sss',4,'도 1박 → 도 1박 → 레 1박 → 미 1박',0,1],
    ['2/4','C4/4 E4/4 E4/4 C4/4','gtg',3,'도 1박 · 미 2박 · 도 1박',1,0]];
    for(const [meter,notes,joints,b,line,t,s]of cases){const job=makeJob({meter,notes,joints});const c=toCurves(job);assert(bells(job)===b&&soundLine(job)===line&&c.ties.length===t&&c.slurs.length===s);}return '10 locked appendix B.1 examples';});
  test('TH-10',()=>{assert(equal(singleNote(F(3)),{den:2,dots:1}));assert(equal(singleNote(F(1)),{den:4,dots:0}));assert(singleNote(F(5,2))===null);});
  test('TH-11',()=>{assert(whyTie(byId('d2-05'),1)==='bar');assert(whyTie(byId('d2-07'),0)==='need');assert(whyTie(byId('d1-01'),0)==='choice');});
  test('TH-12',()=>{assert(!fitsBars(makeJob({meter:'3/4',notes:'C4/2 D4/2 E4/2'})));assert(!fitsBars(makeJob({meter:'3/4',notes:'C4/4 D4/4'})));});
  test('TH-13',()=>{assert(hz(69)===440);assert(hz(60).toFixed(2)==='261.63');assert(midiOf({letter:5,oct:4})===69);});
  test('TH-14',()=>{assert(eq(sub(F(1),gapBeats(F(1))),F(3,4)));assert(eq(sub(F(1,2),gapBeats(F(1,2))),F(1,4)));});
  test('TH-15',()=>{assert(beatsToSec(F(1),50)===1.2);for(const{job}of jobs)assert(equal(sounds(job),sounds(Object.assign({},job,{bpm:50}))));});
  test('TH-16',()=>{const seen=new Map();for(const job of all){const pitch=JSON.stringify(job.notes);if(!seen.has(pitch))seen.set(pitch,new Set());const s=JSON.stringify(schedule(job));assert(!seen.get(pitch).has(s));seen.get(pitch).add(s);}});
  test('TH-17',()=>{assert(noteWhole.toString().includes('2 ** (dots + 1)'));assert(toCurves.toString().includes('streams(job)'));assert(readCurves.toString().includes('j === i + 1'));return 'Reference formulas; curve labels derived from span and pitch';});
  test('IN-01',()=>{const got=new Set();for(const{seed,job}of jobs.filter(x=>x.seed.ask==='repair'))for(const w of inspect(Object.assign({},job,{joints:parseJoints(seed.given,job.notes.length)}),job.joints))got.add(w.why);assert(equal([...got].sort(),[...CAUSE_ORDER].sort()));});
  test('IN-02',()=>{const cases=[{k:0,why:'slur-broken'},{k:1,why:'tie-missed'},{k:2,why:'tie-missed'}];assert(firstCause(cases).k===1);assert(firstCause([])===null);for(const perm of product(3,['0','1','2'])){const arr=perm.split('').map(i=>cases[+i]);const a=firstCause(arr);for(const b of arr)assert(CAUSE_ORDER.indexOf(a.why)<CAUSE_ORDER.indexOf(b.why)||(a.why===b.why&&a.k<=b.k));}});
  test('IN-03',()=>{const grouped=new Map();for(const job of all){const key=JSON.stringify(job.notes);if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(job);}let pairs=0;for(const list of grouped.values())for(const a of list)for(const b of list){const errors=inspect(a,b.joints);assert(errors.length===a.joints.filter((j,k)=>j!==b.joints[k]).length);if(a!==b)pairs++;}assert(pairs===257820);return '257,820 distinct arrangement pairs';});
  test('CN-01',()=>{assert(countAnswer(byId('d5-02'),'bells')==='2');assert(countAnswer(byId('d2-07'),'longest')==='5/2');assert(longest(byId('d4-06')).from===0);});
  test('CN-02',()=>{for(const{seed,job}of jobs.filter(x=>x.seed.ask==='count')){const c=countChoices(job,seed.q);assert(c.length>=2&&c.length<=5);assert(c.filter(x=>x===countAnswer(job,seed.q)).length===1);assert(c.every((v,k)=>!k||num(fromStr(c[k-1]))<num(fromStr(v))));}});
  test('CN-03',()=>{const cases=[['d0-04','bells','1','no-curve'],['d1-02','bells','2','tie-counted'],['d3-06','bells','1','slur-merged'],['d1-03','bells','1','tie-over'],['d2-03','longest','1','not-summed'],['d0-03','longest','1','note-length'],['d5-05','longest','4','slur-summed'],['d0-03','longest','4','over-summed']];for(const[id,q,p,w]of cases)assert(countCause(byId(id),q,p)===w);});
  test('CN-04',()=>assert(countText(byId('d2-03'),'longest','1')==='붙인 소리는 더한 길이예요. 1박 + 2박 = 3박.'));
  test('JD-01',()=>{for(const job of all.concat(jobs.map(x=>x.job)))assert(judgeHold(pressPlan(job).map(h=>h.map(num)),job).grade==='smooth');return 'All 8,400 arrangements and 49 jobs';});
  test('JD-02',()=>{const job=byId('d5-01');assert(judgeHold([[0,.9],[1.03,4]],job).grade==='drip');assert(judgeHold([[0,1.9],[2.05,2.9],[3.05,4]],job).grade==='leak');});
  test('JD-03',()=>{const job=byId('d2-05');assert(judgeHold([[-.1,.8],[1,2.8],[3,4]],job).grade==='smooth');assert(judgeHold([[-.1,4]],job).errors===2);});
  test('JD-04',()=>{const job=byId('d4-03');assert(judgeHold([[0,4]],job).grade==='drip');assert(judgeHold([[0,15/16],[1,4]],job).grade==='smooth');});
  test('JD-05',()=>{const job=byId('d5-01');assert(judgeHold([[.6,4]],job).grade==='drip');assert(judgeHold([[-.3,4]],job).grade==='smooth');});
  test('JD-06',()=>{const r=judgeHold([[-.1,.8],[1,1.4],[1.6,2.8],[3,4]],byId('d2-05'));assert(r.extra===1&&r.grade==='drip');});
  test('GN-01',()=>{for(const{job}of jobs)assert(fitsBars(job));});
  test('GN-02',()=>{for(const{job}of jobs)assert(validJoints(job));});
  test('GN-03',()=>{for(const{job}of jobs)assert(equal(readCurves(job.notes,toCurves(job).all),job.joints));});
  test('GN-04',()=>{for(const{job}of jobs)assert(job.notes.every(n=>stepOf(n.p)>=0&&stepOf(n.p)<=5));});
  test('GN-05',()=>{for(const{job}of jobs)assert(job.notes.every(n=>[1,2,4,8].includes(n.den)&&(!n.dots||(n.dots===1&&[2,4].includes(n.den)))));});
  test('GN-06',()=>{for(const{job}of jobs){const st=starts(job).map(num);const scale=(302-46-8)/num(totalBeats(job));for(let k=1;k<job.joints.length;k++)assert((st[k+1]-st[k])*scale>=40-1e-8);}});
  test('GN-07',()=>{for(const{job}of jobs)assert(job.notes.length>=2&&job.notes.length<=5&&!lt(F(6),totalBeats(job)));});
  test('GN-08',()=>{for(const{seed,day,job}of jobs.filter(x=>x.seed.ask==='repair')){const given=Object.assign({},job,{joints:parseJoints(seed.given,job.notes.length)});assert(inspect(given,job.joints).length>0);assert(validJoints(given));assert(equal(readCurves(given.notes,toCurves(given).all),given.joints));assert(given.joints.every(j=>day.tools.includes(TOOL_CODE[j])));}});
  test('GN-09',()=>{for(const day of days)assert(day.jobs.filter(x=>x.final).length===1&&day.jobs.at(-1).final===true);});
  test('GN-10',()=>{assert(days.length===7);for(const day of days)assert(day.jobs.length>=6&&day.jobs.length<=8);assert(jobs.length===49);});
  test('GN-11',()=>{for(const{seed,day,job}of jobs)if(seed.ask!=='count')assert(job.joints.every(j=>day.tools.includes(TOOL_CODE[j])));});
  test('GN-12',()=>{for(const{seed,job}of jobs.filter(x=>x.seed.ask==='count')){const c=countChoices(job,seed.q);assert(c.length>=2&&c.length<=5&&c.includes(countAnswer(job,seed.q)));}});
  test('GN-13',()=>{for(const{seed,job}of jobs.filter(x=>x.seed.ask==='word'))assert(wordKind(job)!==null);});
  test('GN-14',()=>{for(const{seed,job}of jobs.filter(x=>x.seed.ask==='sound'))assert(job.joints.some(j=>j!=='gap'));});
  return out;
}

// Public inspection API; gameplay can continue using the reference lexical names.
if(typeof globalThis!=='undefined')globalThis.JOINT_ENGINE={F,add,sub,mul,div,eq,lt,minF,num,str,noteWhole,toBeats,midiOf,hz,stepOf,samePitch,parseNotes,parseJoints,makeJob,durOf,starts,totalBeats,barBeats,fitsBars,onBar,canTie,withJoint,validJoints,gapBeats,sounds,bells,streams,toCurves,readCurves,ambiguous,singleNote,whyTie,beatsToSec,schedule,inspect,expectHeld,pressPlan,judgeHold,solfa,noteKo,beatsKo,soundLine,fromStr,longest,countAnswer,countChoices,countCause,countLabel,firstCause,wordKind,tagsOf,briefText,causeText,countText,valveText,runEngineTests};
