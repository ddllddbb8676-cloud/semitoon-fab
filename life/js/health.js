// 능력치 변화·숨은 재능·질병·사망·행복·성향 (담당: Claude, DOM 없음) — SYSTEMS 2·3·9장 간단형

import { STATS, AXES, TRAIT_NAMES, clamp, lerpTable, hasTrait, addFlag, addLog, statusOf } from './core.js';

// 2.2 나이별 자연 변화 [나이 상한, [체력, 지능, 손재주, 사교성, 멘탈, 외모]]
const AGE_DELTA = [
  [6, [1.5, 1, 1, 1, 0, 0]], [12, [1, 0.5, 0.5, 0.5, 0.3, 0]], [19, [1, 0.3, 0.3, 0.5, 0.3, 0.5]], [29, [0, 0, 0.2, 0.3, 0.5, 0]],
  [44, [-0.3, 0, 0, 0, 0.3, -0.3]], [59, [-0.7, -0.2, -0.2, 0, 0.2, -0.5]], [69, [-1, -0.4, -0.5, -0.2, 0, -0.5]],
  [79, [-1.2, -0.8, -0.8, -0.4, -0.2, -0.5]], [999, [-1.5, -1.2, -1.2, -0.6, -0.4, -0.3]],
];
// 2.2 나이 기준 체력 H_exp
const H_EXP = [[1, 52], [6, 59], [12, 65], [19, 72], [29, 72], [44, 67], [59, 57], [69, 47], [79, 35], [89, 20], [99, 5]];
export const hExp = (age) => lerpTable(H_EXP, age);
// 9.1 기준 사망 나이 D(y). 출생 코호트 평균 수명 목표(9.1)에 맞춰 life_sim으로 다듬은 값
// (문서 값 76·78·80·83·86·89·91·92에서 시작해 life_sim 코호트 평균에 맞춤. 2027년 뒤는 문서의 +0.1/년·최대 97 대신 아래 표)
const D_TABLE = [[1940, 77], [1960, 78], [1970, 80], [1980, 82], [1990, 86.5], [2000, 89.5], [2010, 91.5], [2020, 93], [2026, 93.5],
  [2060, 94], [2100, 101.5], [2150, 103]];
export function deathAge(L, y) {
  return lerpTable(D_TABLE, y);
}
const SCHOOL_FX = {
  elem: { intelligence: 1 }, middle: { intelligence: 1, sociability: 0.3 },
  hs_general: { intelligence: 1.5, mental: -0.5, health: -0.3 }, hs_vocational: { dexterity: 1.5, intelligence: 0.5 },
  hs_meister: { dexterity: 2, intelligence: 0.7, mental: 0.3 }, hs_science: { intelligence: 2, mental: -0.7 },
  hs_factory: { dexterity: 1, intelligence: 0.7, health: -1, mental: -0.5 }, jc: { dexterity: 1, intelligence: 0.7 },
  college: { intelligence: 1.2, sociability: 0.5 }, master: { intelligence: 1.5, mental: -1 }, phd: { intelligence: 1.5, mental: -1 }, retry: { intelligence: 1, mental: -1 },
};
// 9.3 질병
export const DISEASES = {
  hypertension: { name: '고혈압', mult: 1.3, treated: 1.1, chronic: true },
  diabetes: { name: '당뇨', mult: 1.4, treated: 1.2, chronic: true },
  cancer: { name: '암', mult: 1, treated: 1 },
  heart: { name: '심혈관 질환', mult: 2, treated: 1.5, chronic: true },
  back_pain: { name: '허리 디스크', mult: 1, treated: 1 },
  depression: { name: '우울증', mult: 1.2, treated: 1.2 },
  dementia: { name: '치매', mult: 1.5, treated: 1.5 },
  injury: { name: '부상', mult: 1, treated: 1 },
};
const hasCond = (s, id) => s.condition.some((c) => c.id === id);

function addStat(s, k, v) { s.stats[k] = clamp(s.stats[k] + v, 0, 100); }

// ② 자연 변화 (상태 보정 포함)
export function naturalChange(L) {
  const { s, D } = L;
  const age = s.age;
  const row = AGE_DELTA.find(([max]) => age <= max)[1];
  STATS.forEach((k, i) => addStat(s, k, row[i]));
  const st = statusOf(s);
  const e = s.education;
  // 학교
  if (e.stage) {
    const key = e.stage === 'hs' ? `hs_${e.track ?? 'general'}` : e.stage;
    const mult = hasTrait(s, 'diligence', '+') ? 1.2 : hasTrait(s, 'diligence', '-') ? 0.8 : 1;
    for (const [k, v] of Object.entries(SCHOOL_FX[key] ?? {})) addStat(s, k, v * mult);
    if (e.stage === 'college' && ['semi', 'materials', 'other_eng'].includes(e.major_group)) addStat(s, 'dexterity', 0.3 * mult);
  } else if (age >= 7 && age <= 18 && st !== 'military') { addStat(s, 'health', 0.5); addStat(s, 'dexterity', 0.5); }
  // 병역
  if (st === 'military' && ['army', 'officer'].includes(s.military.type)) { addStat(s, 'health', 2); addStat(s, 'mental', 1); addStat(s, 'sociability', 0.5); }
  // 직업
  const c = s.career;
  const j = c.job ? D.jobById.get(c.job) : null;
  if (j && !c.leave) {
    const key = Object.keys(j.stats ?? {})[0];
    if (key && (c.exp[c.job] ?? 0) < 10) addStat(s, key, 0.5);
    if (j.group === '현장' && ['전문대졸', '대졸', '석사', '박사'].includes(s.education.level)) addStat(s, 'mental', -0.3);
    if (j.shift) { const half = s.talent?.id === 'iron_body' && s.talent.revealed ? 0.5 : 1; addStat(s, 'health', -0.8 * half); addStat(s, 'mental', -0.5 * half); }
    if (c.ladder === 'craft') { if ((c.exp[c.job] ?? 0) < 15) addStat(s, 'dexterity', 0.5); addStat(s, 'health', age < 40 ? 0.3 : age >= 45 ? -0.7 : 0); }
    if (j.group === '사무') { addStat(s, 'sociability', 0.3); addStat(s, 'health', -0.2); }
    if (j.group === '서비스') { addStat(s, 'sociability', 0.3); addStat(s, 'health', -0.3); }
    if (c.exec) { addStat(s, 'mental', -1); addStat(s, 'health', -0.5); }
  }
  if (st === 'unemployed' && age >= 18) addStat(s, 'mental', -1.5);
  if (s.retired && s.year - (s.retired_year ?? s.year) < 3) addStat(s, 'mental', 0.5);
  // 습관
  if (s.habits.includes('exercise')) { addStat(s, 'health', 1.5); addStat(s, 'mental', 0.5); }
  if (s.habits.includes('smoking')) addStat(s, 'health', -1);
  if (s.habits.includes('drinking')) { addStat(s, 'health', -0.7); addStat(s, 'sociability', 0.3); }
  if (hasTrait(s, 'work_life', '+')) addStat(s, 'health', -0.5);
  // 행복 → 멘탈
  if (s.happiness >= 70) addStat(s, 'mental', 0.5);
  else if (s.happiness <= 30) addStat(s, 'mental', -1);
  // 질병의 해마다 효과
  if (hasCond(s, 'depression')) addStat(s, 'sociability', -2);
  if (hasCond(s, 'dementia')) addStat(s, 'intelligence', -3);
  // 친구 (8.2)
  const rel = s.relations;
  if (age >= 30) rel.friends -= 1;
  if (hasTrait(s, 'social', '+')) rel.friends += 2;
  if (hasTrait(s, 'social', '-')) rel.friends = Math.max(Math.min(rel.friends, 20), rel.friends - 2);
  rel.friends = clamp(rel.friends, 0, 100);
}

// ① 숨은 재능 발견 (2.4)
export function talentCheck(L, triggers) {
  const { s, D, rng } = L;
  const t = s.talent;
  if (!t || t.revealed) return;
  const def = D.char.hidden_talents.find((x) => x.id === t.id);
  if (!def) return;
  const [a, b] = def.reveal_age;
  if (s.age < a || s.age > b) return;
  if (rng.chance(1 / (b - s.age + 1))) revealTalent(L, triggers);
}
export function revealTalent(L, triggers) {
  const { s, D } = L;
  const t = s.talent;
  if (!t || t.revealed) return;
  const def = D.char.hidden_talents.find((x) => x.id === t.id);
  t.revealed = true;
  for (const [k, v] of Object.entries(def?.effect ?? {})) addStat(s, k, v);
  addLog(L, `숨은 재능을 발견했어요: ${def?.name ?? t.id}`, 2, 'life');
  triggers?.set('talent_found', { talent: t.id });
  L.emit?.('talent', { id: t.id, name: def?.name });
}

// ② 질병 발병 (9.3)
export function diseaseCheck(L, triggers) {
  const { s, D, W, rng } = L;
  const age = s.age;
  const smoke = s.habits.includes('smoking');
  const drink = s.habits.includes('drinking');
  const ex = s.habits.includes('exercise');
  const j = s.career.job ? D.jobById.get(s.career.job) : null;
  const risk = j?.risk ?? 0;
  const p = {};
  if (age >= 30) {
    // 9.3 표의 발병률은 누적하면 유병률이 너무 높아(70세 거의 100%) 실제 유병률(고혈압 60%대·당뇨 30%대)에 맞게 낮춤
    p.hypertension = Math.min(0.05, 0.0012 * (age - 30)) * (smoke || drink ? 1.5 : 1);
    p.cancer = 0.0006 * Math.exp(0.075 * (age - 30)) * (smoke ? 2 : 1);
    p.heart = 0.0004 * Math.exp(0.08 * (age - 30)) * (hasCond(s, 'hypertension') ? 2 : 1) * (hasCond(s, 'diabetes') ? 1.5 : 1) * (smoke ? 2 : 1) * (ex ? 0.7 : 1);
    p.back_pain = ['craft', 'production'].includes(s.career.ladder) || s.career.job === 'cook' ? 0.02 : 0.006;
  }
  if (age >= 35) p.diabetes = Math.min(0.025, 0.0006 * (age - 35)) * (ex ? 0.6 : 1);
  if (age >= 75) p.dementia = Math.min(0.1, 0.005 * (age - 74)) * (s.stats.intelligence >= 70 ? 0.7 : 1);
  if (age >= 13) {
    p.depression = ((s.stats.mental < 25 ? 0.12 : 0) + (s.happiness < 20 ? 0.08 : 0)) * (hasTrait(s, 'outlook', '+') ? 0.5 : 1);
    p.injury = risk * 20;
  }
  const early = s.habits.includes('checkup') || hasTrait(s, 'outlook', '-');
  for (const [id, prob] of Object.entries(p)) {
    if (!prob || hasCond(s, id) || !rng.chance(prob)) continue;
    const cond = { id, year: s.year, treated: true, early: id === 'cancer' && early };
    s.condition.push(cond);
    const def = DISEASES[id];
    addLog(L, `${def.name} 진단을 받았어요`, 2, 'health');
    triggers.set(`disease:${id}`, {});
    if (id === 'cancer' || id === 'depression') s.happiness = clamp(s.happiness - 8, 0, 100);
    if (id === 'back_pain') { addStat(s, 'health', -5); s.happiness = clamp(s.happiness - 3, 0, 100); }
    if (id === 'injury') addStat(s, 'health', -5);
    // 치료비 (경제 모듈 medical_cost 대신 평균 연봉 배수)
    const cost = W.econ(s.year).avg_wage * ({ cancer: 0.5, heart: 0.3, dementia: 0.2 }[id] ?? 0.03);
    s.money.cash -= cost;
    s.money.medical = (s.money.medical ?? 0) + cost;
  }
  // 회복
  s.condition = s.condition.filter((c) => {
    const yrs = s.year - c.year;
    if (c.id === 'back_pain' && yrs >= 2 && rng.chance(0.5)) return false;
    if (c.id === 'depression' && yrs >= 1 && rng.chance(0.5)) return false;
    if (c.id === 'injury' && yrs >= 1 && rng.chance(0.6)) return false;
    if (c.id === 'cancer' && yrs >= 5) { addFlag(s, 'cancer_survivor'); addLog(L, '암을 이겨 냈어요', 2, 'health'); return false; }
    return true;
  });
}

// ⑥ 사망 판정 (9.2). 돌려주는 값: null 또는 { cause }
export function deathCheck(L) {
  const { s, D, rng } = L;
  const age = s.age;
  const y = s.year;
  if (age >= 110) return { cause: '노환', kind: 'old_age' };
  const med = y > 2026 ? L.W.medical(y) : null;
  const Dy = deathAge(L, y) + (med?.life_d_bonus ?? 0);
  const muAge = 0.1 * Math.exp(0.1 * (age - Dy));
  const Fh = clamp(Math.exp(-(s.stats.health - hExp(age)) / 30), 0.5, 2.5);
  let Fc = 1;
  for (const c of s.condition) {
    const def = DISEASES[c.id];
    if (!def || c.id === 'cancer') continue;
    if (c.id === 'heart' && c.year === y) continue;
    Fc *= c.treated ? def.treated : def.mult;
  }
  const Fl = (s.habits.includes('smoking') ? 1.6 : 1) * (s.habits.includes('drinking') ? 1.2 : 1) * (s.habits.includes('exercise') ? 0.8 : 1);
  const Fw = [1.2, 1.2, 1.1, 1.0, 0.95, 0.9][wealthGrade(L)];
  const Fm = s.happiness <= 20 ? 1.15 : 1;
  const j = s.career.job ? D.jobById.get(s.career.job) : null;
  const muJob = j?.risk ?? 0;
  let muYoung = 0;
  if (age <= 29) {
    muYoung = y < 1960 ? 0.003 : y < 1970 ? 0.0015 : y < 1980 ? 0.0008 : y < 1990 ? 0.0004 : 0.0002;
    if (age < 18) muYoung *= 0.5;
  }
  const muBase = muAge * Fh * Fc * Fl * Fw * Fm;
  const qMain = 1 - Math.exp(-(muBase + muJob + muYoung));
  const cancer = s.condition.find((c) => c.id === 'cancer');
  const qCancer = cancer ? (cancer.treated ? (y <= 1990 ? 0.15 : y >= 2011 ? 0.07 : 0.1) * (cancer.early ? 0.6 : 1) / (med?.cure_mult ?? 1) : 0.25) : 0;
  const qHeart = s.condition.some((c) => c.id === 'heart' && c.year === y) ? 0.2 : 0;
  const q = 1 - (1 - qMain) * (1 - qCancer) * (1 - qHeart);
  if (!rng.chance(q)) return null;
  // 사인: 기여한 몫으로 가중 추첨 (9.4)
  const parts = [
    { kind: age >= 85 ? 'old_age' : 'illness', cause: age >= 85 ? '노환' : '지병', w: muBase },
    { kind: 'accident', cause: '사고', w: muJob },
    { kind: 'young', cause: age < 18 ? '어린 나이의 병' : '갑작스러운 사고', w: muYoung },
    { kind: 'cancer', cause: '암', w: qCancer },
    { kind: 'heart', cause: '갑작스러운 심장 질환', w: qHeart },
  ];
  const pick = rng.weighted(parts, (x) => x.w) ?? parts[0];
  const dem = s.condition.some((c) => c.id === 'dementia');
  return { cause: pick.cause, kind: pick.kind, dementia: dem };
}

// 부모 사망 확률 (체력 = H_exp, 습관·질병 없음, 경제력 = 가정 경제력)
export function parentDeathQ(L, age, y) {
  if (age >= 105) return 1;
  const Dy = deathAge(L, y);
  const Fw = [1.2, 1.2, 1.1, 1.0, 0.95, 0.9][L.s.profile.family.wealth];
  const mu = 0.1 * Math.exp(0.1 * (age - Dy)) * Fw * 1.25 + (age < 60 ? 0.002 : 0);
  return 1 - Math.exp(-mu);
}

// 성인 경제력 단계 (9.2): 25세 전에는 가정 경제력
export function wealthGrade(L) {
  const { s, W } = L;
  if (s.age < 25) return s.profile.family.wealth;
  const r = (s.money.networth ?? 0) / W.econ(s.year).avg_wage;
  return r < 0.5 ? 1 : r < 2 ? 2 : r < 6 ? 3 : r < 15 ? 4 : 5;
}

// ⑥ 행복 목표치로 25% 이동 (2.5)
export function happinessTarget(L) {
  const { s, W } = L;
  const st = statusOf(s);
  const c = s.career;
  const salary = c.salary || W.econ(s.year).avg_wage * 0.5;
  let t = 50;
  if (s.age >= 20) {
    if (s.money.cash >= salary) t += 5;
    if (s.money.debt > salary * 3) t -= 8;
    if ((s.money.networth ?? 0) < 0 && st === 'unemployed') t -= 12;
  }
  t += { employed: c.employment === 'regular' ? 4 : 0, owner: 2, unemployed: -12, retired: 3, homemaker: 2 }[st] ?? 0;
  const co = W.co(c.company);
  if (co && c.job) t += 2 * co.c;
  const pt = s.relations.partner;
  if (pt) t += pt.married ? 8 : 5;
  t += Math.min(9, 3 * s.relations.children.length);
  if (!hasTrait(s, 'social', '-')) t += (s.relations.friends - 50) / 10;
  t += (s.stats.health - hExp(s.age)) / 5;
  for (const cd of s.condition) t += cd.id === 'cancer' || cd.id === 'depression' ? -8 : DISEASES[cd.id]?.chronic ? -3 : 0;
  if (hasTrait(s, 'diligence', '-')) t += 3;
  if (hasTrait(s, 'risk', '-') && c.employment === 'regular') t += 2;
  if (hasTrait(s, 'thrift', '-')) t += 2;
  if (hasTrait(s, 'work_life', '-') && (pt?.married || s.relations.children.length)) t += 3;
  if (hasTrait(s, 'outlook', '+')) t += 6;
  if (hasTrait(s, 'outlook', '-')) t -= 6;
  return clamp(t, 0, 100);
}

// ⑥ 성향: 환경 이동(3.2) → 연말 회귀 ×0.97 → 특징 붙이고 떼기(3.3)
export function traitsYearEnd(L) {
  const { s, D, W } = L;
  const T = s.traits;
  const c = s.career;
  const j = c.job ? D.jobById.get(c.job) : null;
  const mv = (a, v) => { T[a] = clamp(T[a] + v, -100, 100); };
  if ((j?.shift && !c.leave) || c.exec) mv('work_life', 1);
  if (s.relations.children.some((ch) => s.year - ch.birth_year <= 12)) mv('work_life', -1);
  if ((c.unemployed_years ?? 0) >= 2) mv('outlook', -2);
  if ((W.co(c.company)?.c ?? 0) >= 1.5 && c.job) mv('outlook', 1);
  if (s.money.debt > (c.salary || W.econ(s.year).avg_wage) * 3 && s.age >= 20) { mv('thrift', 1); mv('outlook', -1); }
  if (s.age <= 18 && s.profile.family.wealth <= 2) mv('thrift', 1);
  if (s.age <= 18 && s.profile.family.wealth === 5) mv('thrift', -1);
  if (statusOf(s) === 'military') mv('conform', 2);
  if (s.education.stage === 'college') mv('social', 1);
  if (c.employment === 'owner') mv('risk', 1);
  for (const a of AXES) T[a] *= 0.97;
  for (const a of AXES) {
    const v = T[a];
    const on = s.traitsOn[a];
    if (!on && Math.abs(v) >= 50) {
      s.traitsOn[a] = v > 0 ? '+' : '-';
      const name = TRAIT_NAMES[a][v > 0 ? 1 : 0];
      addLog(L, `'${name}' 특징이 생겼어요`, 1, 'trait');
      L.emit?.('trait', { axis: a, name, gained: true });
    } else if (on && (Math.abs(v) < 40 || (on === '+') !== (v > 0))) {
      const name = TRAIT_NAMES[a][on === '+' ? 1 : 0];
      delete s.traitsOn[a];
      L.emit?.('trait', { axis: a, name, gained: false });
    }
    if (s.traitsOn[a]) {
      const name = TRAIT_NAMES[a][s.traitsOn[a] === '+' ? 1 : 0];
      s.traitsYears[name] = (s.traitsYears[name] ?? 0) + 1;
    }
  }
}

// 성향 효과의 나이 가소성 (3.2)
export const plasticity = (age) => (age <= 12 ? 0.6 : age <= 24 ? 1.3 : age <= 44 ? 1 : age <= 64 ? 0.8 : 0.6);
