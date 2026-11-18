// ── 그리기: 설계도와 물길은 같은 X(박)를 쓴다. 물길의 세로축은 도~라 여섯 줄로 고정한다 ──
const MIN_H = 545;                                                                  // 고정 줄 238(44+50+40+104) + 줄 사이와 여백 36 + 무대 최소 271
const GL = 46, PR = 8, SCORE_H = 92, STAFF_TOP = 14, LG = 9, PTOP = 28, TH = 14, RULER = 18, CHIPS = 42;
const yOf = (step) => STAFF_TOP + 4 * LG - (step - 2) * (LG / 2);                   // 첫째 줄의 미 = step 2
const CLEF = `<path class="clef" d="M15.2 9.5C15.2 5.5 16.2 3.5 17.6 3.5C19.4 3.5 20.4 6 20.4 9C20.4 14.5 14.5 19.5 10.5 25C7.5 29 6 32.5 6 36.5C6 43.5 10.5 49.5 15.5 49.5C19.5 49.5 22 46.5 22 42.5C22 38.5 19.3 35.5 15.8 35.5C12.6 35.5 10.4 37.8 10.4 40.6C10.4 43 12 44.8 14 45.2M15.2 9.5L18 55.5C18.3 59.5 16.3 62 13.6 62C11.4 62 9.8 60.6 9.8 58.6"/><circle class="clefDot" cx="11.4" cy="58.2" r="1.9"/>`;
const P = { g: null, waters: [], risers: [], bells: [] };
function geo() {
  const stage = $("stage"), W = Math.max(240, stage.clientWidth), H = stage.clientHeight, total = num(totalBeats(truthNow())), ppb = (W - GL - PR) / total;
  const row = Math.max(13, Math.min(24, Math.floor((H - 4 - SCORE_H - CHIPS - (PTOP + TH + 6 + RULER)) / 5)));     // 남는 높이를 다섯 칸에 나눈다
  return { W, H, total, ppb, row, X: (b) => GL + b * ppb };
}
function buildScore(g, job, showCurves) {
  const st = starts(job).map(num), C = showCurves ? toCurves(job) : { ties: [], slurs: [], all: [] }, cx = (i) => g.X(st[i]) + 13, y = (i) => yOf(stepOf(job.notes[i].p)), bottom = STAFF_TOP + 4 * LG;
  let h = "";
  for (let i = 0; i < 5; i++) h += `<line class="staff" x1="4" x2="${g.W - 4}" y1="${STAFF_TOP + i * LG}" y2="${STAFF_TOP + i * LG}"/>`;
  h += CLEF + `<text class="meter" x="34" y="${STAFF_TOP + LG}">${job.meter[0]}</text><text class="meter" x="34" y="${STAFF_TOP + 3 * LG}">${job.meter[1]}</text>`;
  for (let b = job.meter[0]; b < g.total - 1e-9; b += job.meter[0]) h += `<line class="bar" x1="${g.X(b)}" x2="${g.X(b)}" y1="${STAFF_TOP}" y2="${bottom}"/>`;
  h += `<line class="bar" x1="${g.W - 10}" x2="${g.W - 10}" y1="${STAFF_TOP}" y2="${bottom}"/><rect class="barEnd" x="${g.W - 7}" y="${STAFF_TOP}" width="3" height="${4 * LG}"/>`;
  job.notes.forEach((nt, i) => {
    const x = cx(i), yy = y(i), step = stepOf(nt.p);
    if (step <= 0) h += `<line class="staff" x1="${x - 10}" x2="${x + 10}" y1="${yOf(0)}" y2="${yOf(0)}"/>`;      // 가온 도의 덧줄
    h += `<ellipse class="head${nt.den <= 2 ? " open" : ""}" cx="${x}" cy="${yy}" rx="5.8" ry="4.2" transform="rotate(-22 ${x} ${yy})"/>`;
    if (nt.den >= 2) h += `<line class="stem" x1="${x + 5.3}" x2="${x + 5.3}" y1="${yy - 1.5}" y2="${yy - 29}"/>`;
    if (nt.den >= 8) h += `<path class="flag" d="M${x + 5.3} ${yy - 29}c1 6 8 8 6.5 17"/>`;
    for (let d = 0; d < nt.dots; d++) h += `<circle class="dot" cx="${x + 11 + d * 4.5}" cy="${step % 2 === 0 ? yy - LG / 2 : yy}" r="1.7"/>`;
  });
  const tied = new Set(); C.ties.forEach(([i, j]) => { tied.add(i); tied.add(j); });
  C.ties.forEach(([i, j]) => {                                                       // 붙임줄과 이음줄을 같은 선으로 그린다
    const x1 = cx(i) + 4.5, x2 = cx(j) - 4.5, y0 = y(i) + 7.5, dx = Math.min(14, (x2 - x1) * 0.28);
    h += `<path class="curve" d="M${x1} ${y0}C${x1 + dx} ${y0 + 6.5} ${x2 - dx} ${y0 + 6.5} ${x2} ${y0}"/>`;
  });
  C.slurs.forEach(([a, b]) => {
    const off = (i) => (tied.has(i) ? 17 : 8), x1 = cx(a), x2 = cx(b), y1 = y(a) + off(a), y2 = y(b) + off(b);
    let low = Math.max(y1, y2); for (let i = a; i <= b; i++) low = Math.max(low, y(i) + off(i));
    const cy = low + 8 + Math.min(5, (x2 - x1) / 50);
    h += `<path class="curve" d="M${x1} ${y1}C${x1 + (x2 - x1) * 0.22} ${cy} ${x1 + (x2 - x1) * 0.78} ${cy} ${x2} ${y2}"/>`;
  });
  h += `<line id="scoreHead" class="headline" x1="0" x2="0" y1="4" y2="${SCORE_H - 4}"/>`;
  const sv = $("score");
  sv.setAttribute("viewBox", `0 0 ${g.W} ${SCORE_H}`); sv.setAttribute("height", String(SCORE_H));
  sv.setAttribute("aria-label", `설계도. ${job.meter[0]}/${job.meter[1]}박자. ${job.notes.map((nt) => solfa(nt.p) + " " + noteKo(nt.den, nt.dots)).join(", ")}. 곡선 ${C.all.length}개${C.all.length ? ": " + C.all.map(([a, b]) => `${a + 1}번째 음에서 ${b + 1}번째 음까지`).join(", ") : ""}.`);
  sv.innerHTML = h;
}
function buildPipes(g, job, o) {
  const st = starts(job).map(num), yc = (p) => PTOP + (5 - stepOf(p)) * g.row + TH / 2, rulerY = PTOP + 5 * g.row + TH + 6, H = rulerY + RULER, list = sounds(job);
  let back = "", tubes = "", front = "";
  for (let s = 0; s <= 5; s++) {
    const yy = PTOP + (5 - s) * g.row + TH / 2;
    back += `<line class="rowline" x1="${GL}" x2="${g.W - PR}" y1="${yy}" y2="${yy}"/><text class="rowname" x="10" y="${yy + 4}">${solfa({ letter: s, oct: 4 })}</text>`;
  }
  for (let b = job.meter[0]; b < g.total - 1e-9; b += job.meter[0]) back += `<line class="pbar" x1="${g.X(b)}" x2="${g.X(b)}" y1="${PTOP - 16}" y2="${rulerY}"/>`;
  P.waters = []; P.risers = []; P.bells = [];
  list.forEach((s, i) => {
    const b0 = num(s.start), b1 = b0 + num(s.len), x0 = g.X(b0), x1 = g.X(b1), yy = yc(s.p);
    tubes += `<rect class="tube" x="${x0 + 1}" y="${yy - TH / 2}" width="${x1 - x0 - 2}" height="${TH}" rx="7"/><rect class="water auto" x="${x0 + 3.5}" y="${yy - TH / 2 + 3}" width="0" height="${TH - 6}" rx="4"/>`;
    P.waters.push({ b0, b1, w: x1 - x0 - 7, y: yy - TH / 2 + 3 });
    for (let k = s.from; k < s.to; k++) front += `<line class="seam" x1="${g.X(st[k + 1])}" x2="${g.X(st[k + 1])}" y1="${yy - TH / 2 - 3}" y2="${yy + TH / 2 + 3}"/>`;   // 붙인 자리는 흐린 점선으로만 남는다
    if (s.after === "slur") {                                                        // 이음쇠. 높이가 다르면 세로 관으로 꺾인다
      const xb = g.X(st[s.to + 1]), y2 = yc(list[i + 1].p);
      if (y2 !== yy) {
        back += `<rect class="riser" x="${xb - 5}" y="${Math.min(yy, y2)}" width="10" height="${Math.abs(y2 - yy)}"/><rect class="riserWater" x="${xb - 2.5}" y="${Math.min(yy, y2)}" width="5" height="${Math.abs(y2 - yy)}"/>`;
        P.risers.push({ b: st[s.to + 1] });
        front += `<rect class="coupler" x="${xb - 4}" y="${y2 - TH / 2 - 3}" width="8" height="${TH + 6}" rx="2"/>`;
      }
      front += `<rect class="coupler" x="${xb - 4}" y="${yy - TH / 2 - 3}" width="8" height="${TH + 6}" rx="2"/>`;
    }
    front += `<g class="bell"><circle class="rip" cx="${x0 + 12}" cy="${yy - TH / 2 - 11}" r="12.5"/><circle class="b" cx="${x0 + 12}" cy="${yy - TH / 2 - 11}" r="8"/><text x="${x0 + 12}" y="${yy - TH / 2 - 11}">${i + 1}</text></g>`;
    P.bells.push({ b: b0 });
    if (x1 - x0 >= 58) front += `<text class="len" x="${x0 + 25}" y="${yy - TH / 2 - 7}">${beatsKo(s.dur)}</text>`;
  });
  let ruler = `<line class="ruler" x1="${GL}" x2="${g.W - PR}" y1="${rulerY}" y2="${rulerY}"/>`;
  for (let b = 0; b <= g.total + 1e-9; b++) {
    const last = b + 1 > g.total + 1e-9;
    ruler += `<line class="ruler" x1="${g.X(b)}" x2="${g.X(b)}" y1="${rulerY}" y2="${rulerY + 4}"/><text class="tick" x="${last ? g.W - 1 : g.X(b)}" y="${rulerY + 15}" text-anchor="${last ? "end" : "middle"}">${b}${last ? "박" : ""}</text>`;
  }
  const sv = $("pipes");
  sv.setAttribute("viewBox", `0 0 ${g.W} ${H}`); sv.setAttribute("height", String(H));
  sv.setAttribute("aria-label", o.hideBells ? "물길. 방울은 물을 틀면 보여요." : `물길. ${soundLine(job)}. 방울 ${list.length}번.`);
  sv.classList.toggle("hidebells", !!o.hideBells);
  sv.innerHTML = back + tubes + `<g id="handWater"></g>` + front + ruler + `<line id="head" class="headline" x1="0" x2="0" y1="6" y2="${rulerY}"/>`;
  const el = $("joints"), act = document.activeElement, keepK = act && act.classList && act.classList.contains("joint") ? act.dataset.k : null;
  const xs = st.slice(1).map((b) => g.X(b)), gap = xs.length > 1 ? Math.min(...xs.slice(1).map((x, i) => x - xs[i])) : 60, w = Math.max(36, Math.min(46, gap - 2));
  el.innerHTML = job.joints.map((jt, k) => `<button type="button" class="joint" data-k="${k}" style="left:${xs[k]}px;width:${w}px" aria-label="${k + 1}번 이음매. ${wa(solfa(job.notes[k].p))} ${solfa(job.notes[k + 1].p)} 사이. 지금 ${JOINT_KO[jt]}."><span class="chip ${jt}"><i>${k + 1}</i>${JOINT_KO[jt]}</span></button>`).join("");
  if (keepK !== null && keepK !== undefined) { const b = el.querySelector(`.joint[data-k="${keepK}"]`); if (b) b.focus(); }
  P.g = g;
}
// JT8 illustration: inline vector workshop, no remote asset requests.
const WORKSHOP_ART = `<svg viewBox="0 0 620 250" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="강철 관과 놋쇠 이음쇠로 소리를 잇는 작은 음악 공방">
<defs><pattern id="work-grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#c6d3db" stroke-width=".7"/></pattern><linearGradient id="metal" x2="0" y2="1"><stop stop-color="#f6f9fa"/><stop offset=".45" stop-color="#dfe7ec"/><stop offset="1" stop-color="#b7c7d1"/></linearGradient><linearGradient id="brass-fill" x2="0" y2="1"><stop stop-color="#fff3d7"/><stop offset="1" stop-color="#e8c887"/></linearGradient></defs>
<rect x="8" y="20" width="604" height="218" rx="18" fill="#f5f8fa" stroke="#c6d3db"/><rect x="8" y="20" width="604" height="218" rx="18" fill="url(#work-grid)" opacity=".7"/>
<path d="M38 210h544" stroke="#5d707d" stroke-width="2"/><rect x="40" y="199" width="540" height="11" rx="4" fill="#c6d3db"/>
<g fill="url(#metal)" stroke="#5d707d" stroke-width="2"><rect x="58" y="143" width="149" height="25" rx="10"/><rect x="217" y="143" width="125" height="25" rx="10"/><rect x="333" y="91" width="22" height="77" rx="9"/><rect x="342" y="91" width="151" height="25" rx="10"/></g>
<g fill="#1f86bf"><rect x="63" y="151" width="137" height="9" rx="4"/><rect x="222" y="151" width="122" height="9" rx="4"/><rect x="339" y="98" width="9" height="62" rx="4"/><rect x="342" y="99" width="143" height="9" rx="4"/></g>
<g fill="url(#brass-fill)" stroke="#8a5407" stroke-width="2"><rect x="326" y="137" width="35" height="38" rx="5"/><rect x="326" y="84" width="35" height="38" rx="5"/><rect x="475" y="84" width="17" height="39" rx="4"/></g>
<path d="M123 139v35" stroke="#5d707d" stroke-dasharray="3 4" opacity=".7"/>
<g transform="translate(406 28) rotate(5)"><rect width="110" height="49" rx="5" fill="#fff" stroke="#c6d3db"/><g stroke="#8d9da6" stroke-width=".6"><path d="M9 13h92M9 19h92M9 25h92M9 31h92M9 37h92"/></g><g fill="#15232c"><ellipse cx="28" cy="34" rx="4" ry="3"/><ellipse cx="68" cy="28" rx="4" ry="3"/></g><path d="M32 34V11m40 17V5M29 39q20 16 39-4" fill="none" stroke="#15232c" stroke-width="1.5"/></g>
<g transform="translate(88 48)"><path d="M24 3v11" stroke="#8a5407" stroke-width="3"/><circle cx="24" cy="4" r="4" fill="#f4e3c1" stroke="#8a5407" stroke-width="2"/><path d="M4 57c5-9 6-14 6-24 0-19 28-19 28 0 0 10 1 15 6 24Z" fill="url(#brass-fill)" stroke="#8a5407" stroke-width="2"/><rect x="1" y="55" width="46" height="9" rx="4" fill="#f4e3c1" stroke="#8a5407" stroke-width="2"/><path d="M17 64a7 7 0 0 0 14 0" fill="#8a5407"/><circle cx="18" cy="38" r="2" fill="#15232c"/><circle cx="30" cy="38" r="2" fill="#15232c"/><path d="M19 45q5 5 10 0" fill="none" stroke="#15232c" stroke-width="1.8" stroke-linecap="round"/></g>
<g transform="translate(521 131)"><path d="M15 0v15m-12 0h24M15 15v40" fill="none" stroke="#5d707d" stroke-width="5" stroke-linecap="round"/><rect x="4" y="28" width="22" height="13" rx="4" fill="#f4e3c1" stroke="#8a5407" stroke-width="2"/><circle cx="15" cy="5" r="12" fill="#fff" stroke="#14607c" stroke-width="5"/><path d="M3 5h24M15-7v24" stroke="#14607c" stroke-width="3"/></g>
<g fill="#465864" font-family="system-ui,sans-serif" font-size="12" font-weight="700"><text x="64" y="192">시간을 잇고</text><text x="388" y="192">소리를 발견해요</text></g></svg>`;
function bellCharacter(mood = "normal") {
  const mouth = mood === "happy" ? 'M22 39q8 10 16 0' : mood === "thinking" ? 'M25 42q5-3 10 0' : 'M25 40q5 4 10 0';
  return `<svg viewBox="0 0 60 70" role="img" aria-label="놋쇠 방울"><path d="M30 3v8" stroke="#8a5407" stroke-width="3"/><path d="M8 55c6-9 6-15 6-23 0-22 32-22 32 0 0 8 0 14 6 23Z" fill="#f4e3c1" stroke="#8a5407" stroke-width="2"/><rect x="5" y="53" width="50" height="9" rx="4" fill="#f4e3c1" stroke="#8a5407" stroke-width="2"/><path d="M23 63a7 7 0 0 0 14 0" fill="#8a5407"/><circle cx="23" cy="32" r="2" fill="#15232c"/><circle cx="37" cy="32" r="2" fill="#15232c"/><path d="${mouth}" stroke="#15232c" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>`;
}
