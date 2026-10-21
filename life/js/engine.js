// 인생 엔진: 한 해 루프 (담당: Claude)
// DOM을 전혀 건드리지 않는 순수 로직입니다. 화면(ui.js)과 연출(fx.js)은 emit으로 받은 life:* 이벤트와 state를 읽어 그립니다.
//
// 쓰는 법 (main.js · tools/life_sim.mjs 공통)
//   const L = attach(D, s, emit)        저장 상태 s에 데이터·세계·난수를 붙인 런타임
//   beginYear(L)                        ①~④ 처리 + ⑤ 사건 큐(s.turn.queue) 만들기
//   const inst = nextEvent(L, progress) 진행률에 닿은 다음 사건 (없으면 null)
//   const view = present(L, inst)       화면용 문장·선택지 (null이면 건너뜀 → skipEvent)
//   const out = chooseEvent(L, inst, i) 선택 → { result, chips, follow }
//   const end = finishYear(L)           ⑥ 결산·승진·행복·성향·사망 → { dead }
//   snapshot(L)                         저장할 상태 (난수 상태 포함)

import { STAGES, stageOf, clamp, addLog, addSemi, addFlag, statusOf } from './core.js';
import { Rng } from './rng.js';
import { World } from './world.js';
import { naturalChange, talentCheck, diseaseCheck, deathCheck, happinessTarget, traitsYearEnd, hExp } from './health.js';
import { schoolYearStart, schoolYearEnd, militaryYearStart, militaryYearEnd } from './school.js';
import { careerYearStart, careerYearEnd, workRegion, ro } from './career.js';
import { familyYearStart, familyYearEnd, giveIndependenceFund } from './family.js';
import { settleYear, houseChance } from './money.js';
import { buildQueue, present as presentEvent, choose } from './events.js';
import { matchWhen } from './conditions.js';
import { chronicle } from './chronicle.js';

export { createLife, rollCandidate, hydrate, SAVE_VERSION } from './state.js';
export { review } from './review.js';

export function attach(D, s, emit = () => {}) {
  const W = new World(D, s.world);
  W.advanceTo(s.year);
  const rng = new Rng(1);
  rng.s = s.rng.life >>> 0;
  return { D, s, W, rng, emit, yc: {} };
}

export function snapshot(L) {
  L.s.rng.life = L.rng.s;
  L.s.world = L.W.save();
  return L.s;
}

// 해마다 실제 시간 배율 (SYSTEMS 1.1): 유아 ×2, 은퇴 후 ×1.5 빠르게
export function yearSpeedMult(s) {
  if (s.age <= 6) return 2;
  if (s.retired) return 1.5;
  return 1;
}

// ①~⑤
export function beginYear(L) {
  const { s, W } = L;
  s.year++;
  s.age++;
  s.stage = stageOf(s.age);
  s.yearFlags = {};
  L.yc = {};
  W.advanceTo(s.year);
  const triggers = new Map(Object.entries(s.pendingTriggers ?? {}));
  s.pendingTriggers = {};
  if (s.rest_year === s.year) s.yearFlags.no_search = true;
  if (s.look_year === s.year) s.yearFlags.look = true;

  // ① 생일 ② 자연 변화·질병
  talentCheck(L, triggers);
  naturalChange(L);
  diseaseCheck(L, triggers);
  // 해외 근무 귀국
  if (s.abroad_until && s.year >= s.abroad_until) {
    s.abroad_until = null;
    if (s.career.job && s.career.region === 'overseas') s.career.region = s.career.home_region ?? workRegion(L, W.co(s.career.company));
    addLog(L, '해외 근무를 마치고 돌아왔어요', 2, 'work');
  }
  // ④ 제도·관계
  schoolYearStart(L, triggers);
  militaryYearStart(L, triggers);
  careerYearStart(L, triggers);
  familyYearStart(L, triggers);
  houseChance(L, triggers);
  if (s.age === 30) giveIndependenceFund(L);

  // ⑤ 사건 큐
  s.turn = { year: s.year, queue: buildQueue(L, triggers), done: [] };
  L.emit('year', { year: s.year, age: s.age, stage: s.stage, headline: W.headline(s.year) });
  return s.turn;
}

// 진행률 progress(0~1)에 닿은 다음 사건. 진행률을 안 주면 순서대로.
export function nextEvent(L, progress = 1) {
  const q = L.s.turn?.queue ?? [];
  return q.length && q[0].at <= progress ? q[0] : null;
}
export function present(L, inst) {
  const view = presentEvent(L, inst);
  if (view) L.emit('event', { id: view.id, big: view.big });
  return view;
}
// 조건이 바뀌어 못 띄우는 사건은 건너뜀
export function skipEvent(L, inst) {
  const q = L.s.turn.queue;
  const i = q.findIndex((x) => x.uid === inst.uid);
  if (i >= 0) q.splice(i, 1);
}
export function chooseEvent(L, inst, index) {
  const q = L.s.turn.queue;
  const i = q.findIndex((x) => x.uid === inst.uid);
  if (i >= 0) q.splice(i, 1);
  const out = choose(L, inst, index);
  L.s.turn.done.push(inst.id);
  if (out.follow) { out.follow.at = inst.at; q.unshift(out.follow); }
  return out;
}

// ⑥ 연말 결산 → ⑦ 기록. 돌려주는 값 { dead }
export function finishYear(L) {
  const { s, D } = L;
  settleYear(L);
  careerYearEnd(L);
  schoolYearEnd(L);
  militaryYearEnd(L);
  familyYearEnd(L);
  s.happiness = clamp(s.happiness + 0.25 * (happinessTarget(L) - s.happiness), 0, 100);
  traitsYearEnd(L);
  s.career.best_rep = Math.max(s.career.best_rep ?? 50, s.career.reputation);
  if (s.career.job && s.career.ladder) {
    s.career.best_ranks ??= {};
    s.career.best_ranks[s.career.ladder] = Math.max(s.career.best_ranks[s.career.ladder] ?? 0, s.career.rank);
  }
  s.relations.best_friends = Math.max(s.relations.best_friends ?? 0, s.relations.friends);
  if (s.career.job) {
    const co = L.W.co(s.career.company);
    const sec = co?.sector ?? D.jobById.get(s.career.job)?.id;
    s.career.sector_years ??= {};
    if (sec) s.career.sector_years[sec] = (s.career.sector_years[sec] ?? 0) + 1;
    for (const sj of s.career.side_jobs) s.career.sector_years[sj] = (s.career.sector_years[sj] ?? 0) + 1;
    if (D.jobById.get(s.career.job)?.touch === 'core' && !s.flags.first_core_year) s.flags.first_core_year = s.year;
  }
  // 업적 (GPT achievements.json이 있으면 when으로 판정) — 연표에는 안 쓰고 토스트와 엔딩 목록으로만 (v0.2)
  for (const a of D.achievements) {
    if (s.achievements.includes(a.id)) continue;
    try {
      if (matchWhen(L, a.when)) {
        s.achievements.push(a.id);
        (s.ach_log ??= []).push({ id: a.id, name: a.name, year: s.year, age: s.age });
        L.emit('achievement', { id: a.id, name: a.name });
      }
    } catch { /* 형식이 이상한 업적은 무시 */ }
  }
  // 그 해의 소식 한 줄 (가족·근속·재산·업황·세상 소식). 반복 문장은 단계마다 한 번만
  chronicle(L);
  const aw = L.W.econ(s.year).avg_wage;
  const r2 = (x) => Math.round(100 * x / aw) / 100;
  s.hist.push({ y: s.year, h: Math.round(s.happiness), nw: r2(s.money.networth ?? 0), cash: r2(s.money.cash), debt: r2(s.money.debt), inc: r2(s.money.last?.income ?? 0), st: statusOf(s) });

  // 사망 판정 (9.2)
  const d = deathCheck(L);
  if (d) {
    s.dead = { year: s.year, age: s.age, cause: d.cause, kind: d.kind, dementia: !!d.dementia };
    if (!s.semi.length) {
      const dev = s.year >= 2007 ? '휴대폰' : s.year >= 1980 ? '텔레비전' : '라디오';
      addSemi(L, `평생 반도체와 먼 길을 걸었지만, 매일 곁에 있던 ${dev} 속 칩은 늘 당신과 함께였어요.`, 'everyday');
    }
    addLog(L, `${s.age}세, ${ro(d.cause)} 세상을 떠났어요`, 3, 'death');
    addFlag(s, 'dead');
    L.emit('death', { ...s.dead });
  }
  s.turn = null;
  return { dead: !!d };
}

export { STAGES, hExp };
