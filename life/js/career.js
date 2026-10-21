// 커리어: 구직·채용·연봉·승진·구조조정·스카우트·은퇴·자영업 (담당: Claude, DOM 없음)
// SYSTEMS 5장과 ECONOMY 3장을 줄인 간단형입니다. 숫자는 문서 값을 그대로 쓰고, 빠진 규칙은 docs/UI_CONTRACT.md 끝에 적었습니다.

import { clamp, logistic, eduIdx, hasTrait, addFlag, addLog, addSemi, josa, endsWithRieul, statusOf } from './core.js';

// ---------- ECONOMY 3.2 표 ----------
const JOB_MULT = {
  process_engineer: 0.8, equipment_engineer: 0.7, yield_engineer: 0.82, device_researcher: 0.95, circuit_designer: 0.85, quality_engineer: 0.75,
  operator: 0.55, assembler: 0.45, field_service: 0.7, chemist: 0.9, hr: 0.7, purchasing: 0.7, sales: 0.75, patent: 0.8, environment_safety: 0.7,
  welder: 0.65, pipefitter: 0.62, electrician: 0.62, duct_worker: 0.58, scaffolder: 0.6, crane_operator: 0.9, site_manager: 0.8,
  cook: 0.45, dietitian: 0.55, security_gate: 0.48, facility_manager: 0.48, shuttle_driver: 0.55, cleanroom_laundry: 0.4, janitor: 0.38, dorm_manager: 0.45,
  professor: 1.1, journalist: 0.7, official: 0.6, analyst: 0.95, recruiter: 0.7, academy_teacher: 0.55,
  office_worker: 0.72, factory_worker: 0.48, teacher: 0.75, civil_servant: 0.62, nurse: 0.7, developer: 0.85, driver: 0.55, part_timer: 0.35,
};
const GROUP_MULT = { 현장: 0.75, 사무: 0.72, 기능직: 0.62, 서비스: 0.46, 생태계: 0.75, 일반: 0.6 };
const CO_MULT = [1, 0.7, 0.82, 1, 1.15, 1.35];
const RANK_MULT = [1, 1.22, 1.45, 1.68, 1.95, 3.2, 6.0];
const EMP_MULT = { regular: 1, contract: 0.85, dispatch: 0.78 };
const EMP_BONUS = { regular: 1, contract: 0.5, dispatch: 0.3, daily: 0 };
// 사다리 위치 → ECONOMY 직급 단계(0~6)
const RANK_LEVEL = {
  corporate: [0, 1, 2, 3, 4, 5, 5, 6], research: [0, 1, 2, 3, 5, 5, 6], production: [0, 1, 2, 3, 4], craft: [0, 1, 1, 2, 3, 4],
  service: [0, 1, 2, 3, 4], academic: [0, 0, 2, 3], public: [0, 1, 2, 3, 4], teacher: [0, 2, 3, 4],
};
// ECONOMY 3.5 자영업 배율 (없는 직종은 0.8)
const BIZ = { chicken_shop: 0.9, shuttle_driver: 0.8, recruiter: 1.0, academy_teacher: 0.9, farmer: 0.55, shopkeeper: 0.8, driver: 0.7, developer: 1.0, retail_investor: 0 };
const TOUCH_KM = { core: 0.6, near: 0.4, eco: 0.25, none: 0.15 };

export const jobOf = (L, id = L.s.career.job) => (id ? L.D.jobById.get(id) ?? null : null);
export function jobName(L, c = L.s.career) {
  if (!c.job) return '';
  return (c.sub && L.D.subById.get(c.sub)?.name) || L.D.jobById.get(c.job)?.name || c.job;
}
export const rankName = (L, c = L.s.career) => L.D.ladders[c.ladder]?.ranks?.[c.rank] ?? '';
export const ro = (w) => (endsWithRieul(w) ? `${w}로` : josa(w, '으로', '로'));

// ---------- 정년 (SYSTEMS 5.9) ----------
export function retireAge(L, ladder = L.s.career.ladder) {
  const y = L.s.year;
  const rule = L.D.ladders[ladder]?.retire;
  if (typeof rule === 'number') return rule;
  if (rule === 'teacher') return y <= 1998 ? 65 : 62;
  if (rule !== 'law') return null;
  if (y <= 1990) return 55;
  if (y <= 2012) return 57;
  if (y <= 2015) return 58;
  if (y <= 2026) return 60;
  return L.W.econ(y).retire_age ?? 60;
}

// ---------- 연봉 (ECONOMY 3.2~3.5, 간단형) ----------
function bonusParams(sector) {
  if (['memory', 'foundry', 'fabless'].includes(sector)) return [0.1, 0.1, 0.06, 0.6];
  if (['equipment_global', 'equipment_korea', 'materials', 'packaging'].includes(sector)) return [0.06, 0.06, 0.04, 0.35];
  if (sector === 'construction') return [0.04, 0.04, 0.02, 0.2];
  if (sector === 'catering' || sector === 'security') return [0.02, 0.02, 0, 0.08];
  return null;
}
function bonusMarket(W, sector, y) {
  const k = (key) => W.marketKey(key, y);
  if (sector === 'memory') return k('memory');
  if (sector === 'foundry' || sector === 'fabless') return k('logic_foundry');
  if (sector?.startsWith('equipment') || sector === 'construction') return k('equipment');
  if (sector === 'materials' || sector === 'packaging') return Math.round((k('memory') + k('logic_foundry')) / 2);
  return k('korea');
}
const jobMult = (j) => JOB_MULT[j.id] ?? GROUP_MULT[j.group] ?? 0.6;

// 기본급 추정 (채용 공고 비교·@salary 토큰용)
export function baseSalary(L, o) {
  const { W, s } = L;
  const y = s.year;
  const e = W.econ(y);
  const j = L.D.jobById.get(o.job);
  if (!j) return 0;
  const co = W.co(o.company);
  if (o.employment === 'owner') return e.avg_wage * (BIZ[j.id] ?? 0.8) * (0.8 + 0.15 * (o.stage ?? 0));
  const lvl = o.founder ? 4 : RANK_LEVEL[o.ladder ?? j.ladder]?.[o.rank ?? 0] ?? 0;
  if (o.employment === 'daily') {
    const dayRate = Math.max((e.avg_wage / 250) * jobMult(j) * RANK_MULT[lvl] * 1.6, (e.min_wage ?? 0) * 8);
    return dayRate * 220;
  }
  const edu = eduIdx(s.education.level) - eduIdx(j.education);
  let base = e.avg_wage * jobMult(j) * (co ? CO_MULT[co.attrs.salary] : 1) * RANK_MULT[lvl]
    * (1 + 0.02 * Math.min(o.rank_years ?? 0, 5)) * (EMP_MULT[o.employment] ?? 1)
    * (edu >= 2 ? 1.1 : edu === 1 ? 1.05 : 1) * (0.9 + 0.2 * (o.reputation ?? 50) / 100)
    * (j.shift ? 1.15 : 1) * (o.region === 'overseas' ? 1.3 : 1) * (1 + (o.salary_mod ?? 0));
  if (e.min_wage && j.id !== 'part_timer') base = Math.max(base, e.min_wage * 209 * 12);
  if (j.id === 'part_timer' && e.min_wage) base = Math.max(base, e.min_wage * 209 * 12 * 0.6);
  return base;
}

// 호봉·연차 (ECONOMY 3.2 보완): 총 경력 1년마다 실질 +0.8%(대기업 정규직)·+0.5%(그 밖의 정규직)·+0.3%(계약·파견), 25년까지.
// 직급(RANK)·직급 안 호봉(EXP)과 합치면 대기업 정규직 실질 인상은 해마다 약 2~4%
function seniority(c, co) {
  if (!['regular', 'contract', 'dispatch'].includes(c.employment)) return 1;
  const r = c.employment !== 'regular' ? 0.003 : co && co.attrs.salary >= 4 ? 0.008 : 0.005;
  return 1 + r * Math.min(25, c.total_years ?? 0);
}
// 올해 받을 연봉 목표치: 기본급(그 해 평균 임금·직급·평판·회사 등급) × 호봉 × 회사 실적 × 일시 배율
export function targetSalary(L, c = L.s.career) {
  const base = baseSalary(L, c);
  if (['owner', 'daily'].includes(c.employment)) return base;
  const co = L.W.co(c.company);
  const perf = co ? 1 + 0.03 * clamp(co.c, -2, 2) : 1;
  const mult = c.salary_mult && c.salary_mult.until >= L.s.year ? c.salary_mult.x : 1;
  return base * seniority(c, co) * perf * mult;
}
// 연말 결산 첫머리: 올해 연봉 다시 정하기. 명목 연봉은 잘 안 깎임(평소엔 동결, 회사 위기 때만 최대 −10%)
export function updateSalary(L) {
  const { s, W } = L;
  const c = s.career;
  if (!c.job || c.leave || ['owner', 'daily'].includes(c.employment)) return null;
  const prev = c.salary || 0;
  const t = targetSalary(L, c);
  const key = `${c.job}|${c.company}|${c.employment}`;
  const fresh = !prev || c.salary_key !== key;
  const co = W.co(c.company);
  const crisis = !!co && (co.c <= -1.5 || (W.marketKey('korea', s.year) <= -2 && co.c <= -1));
  const next = fresh || t >= prev ? t : crisis ? Math.max(t, prev * 0.9) : prev;
  const promoted = !fresh && c.rank > (c.salary_rank ?? c.rank);
  const moved = !fresh && (c.region === 'overseas') !== (c.salary_region === 'overseas');
  Object.assign(c, { salary: next, salary_key: key, salary_rank: c.rank, salary_region: c.region });
  return { next, fresh, change: fresh ? 0 : next / prev - 1, promoted, moved, abroad: c.region === 'overseas', crisis, frozen: !fresh && next === prev };
}

// 올해 소득 {base, bonus} — 연말 결산에서 부릅니다
export function yearIncome(L) {
  const { s, W, rng } = L;
  const c = s.career;
  const y = s.year;
  const e = W.econ(y);
  if (!c.job || c.leave) return { base: 0, bonus: 0 };
  const j = jobOf(L);
  if (c.employment === 'owner') {
    const mkt = j.serves === 'fab_region' ? fabRegionState(L) : e.macro_score;
    const key = j.id === 'chicken_shop' ? s.stats.dexterity : s.stats.sociability;
    const skill = 0.8 + 0.4 * key / 100;
    let mult = BIZ[j.id] ?? 0.8;
    if (j.id === 'youtuber') mult = 0.2 * Math.exp(rng.gauss(0, 1.2));
    const profit = e.avg_wage * mult * (1 + 0.15 * mkt + 0.1 * e.macro_score) * skill * Math.exp(rng.gauss(0, 0.3)) * (0.8 + 0.15 * (c.rank ?? 0));
    return { base: Math.max(0, profit), bonus: 0 };
  }
  if (c.employment === 'daily') {
    const lvl = RANK_LEVEL[c.ladder]?.[c.rank] ?? 0;
    const dayRate = Math.max((e.avg_wage / 250) * jobMult(j) * RANK_MULT[lvl] * 1.6, (e.min_wage ?? 0) * 8);
    const days = clamp(rng.gauss(220 + 25 * W.marketKey('equipment', y) + 15 * e.macro_score, 25), 80, 290);
    return { base: dayRate * days, bonus: 0 };
  }
  // 육아휴직·출산휴가 쓴 해는 기본급 75% (do leave:*)
  const base = (c.salary || baseSalary(L, c)) * (c.parental?.year === y ? 0.75 : 1);
  const co = W.co(c.company);
  const bp = co ? bonusParams(co.sector) : null;
  let rate = 0;
  if (bp) {
    const [b0, bpf, bm, cap] = bp;
    rate = clamp(b0 + bpf * co.c + bm * bonusMarket(W, co.sector, y), 0, cap);
    if (co.c >= 2 && bonusMarket(W, co.sector, y) >= 2 && (co.hist.at(-2)?.[1] ?? 0) >= 2) rate += rng.float(0, 0.4);
  } else if (j.ladder === 'public' || j.group === '생태계') rate = 0.05;
  const lvl = RANK_LEVEL[c.ladder]?.[c.rank] ?? 0;
  // 입사 첫해 성과급은 절반 (해 중간 입사 평균, v0.2)
  const bonus = base * rate * (EMP_BONUS[c.employment] ?? 0) * (lvl >= 6 ? 4 : lvl >= 5 ? 2.5 : 1) * (c.years === 0 ? 0.5 : 1);
  return { base, bonus };
}

function fabRegionState(L) {
  const { W, s } = L;
  const fabs = W.allAlive().filter((c) => ['memory', 'foundry', 'packaging'].includes(c.sector) && c.regions.includes(s.profile.region));
  if (!fabs.length) return W.macro(s.year);
  return fabs.reduce((a, c) => a + c.c, 0) / fabs.length;
}

// ---------- 구직 (SYSTEMS 5.2·5.3) ----------
function companyHiring(L, co) {
  const yc = L.yc;
  yc.hiring ??= {};
  if (yc.hiring[co.id] === undefined) yc.hiring[co.id] = L.rng.chance(clamp(0.5 + 0.25 * co.c, 0.05, 1));
  return yc.hiring[co.id];
}

export function workRegion(L, co) {
  const { s, D } = L;
  const home = s.profile.region;
  if (!co) return home;
  const y = s.year;
  const ok = co.regions.filter((r) => { const reg = D.regions.get(r); return r === 'overseas' || !reg?.fab_since || reg.fab_since <= y; });
  const list = ok.length ? ok : co.regions;
  const area = D.regions.get(home)?.area;
  return list.find((r) => r === home) ?? list.find((r) => r !== 'overseas' && D.regions.get(r)?.area === area) ?? list.find((r) => r !== 'overseas') ?? list[0];
}

function hireChance(L, j, co, emp, region) {
  const { s, W, D } = L;
  const y = s.year;
  const myEdu = eduIdx(s.education.level);
  const req = eduIdx(j.education);
  const m = co ? W.score(co.sector, y) : j.touch === 'none' ? W.macro(y) : W.index(y);
  let z = -0.6 + (TOUCH_KM[j.touch] ?? 0.2) * m;
  if (co) z += 0.4 * co.c - 0.3 * ((co.attrs.salary + co.attrs.stability) / 2 - 3);
  z += 0.4 * Math.min(2, Math.max(0, myEdu - req));
  if (req >= 3 && s.education.tier) z += 0.25 * (s.education.tier - 3);
  for (const [k, v] of Object.entries(j.stats ?? {})) z += s.stats[k] >= v ? Math.min(0.75, (s.stats[k] - v) / 20) : (s.stats[k] - v) / 10;
  const major = D.majors.find((mj) => mj.id === s.education.major);
  if (major?.fits?.includes(j.id)) z += 0.5;
  if (j.group === '현장' && req >= 3 && s.education.major_group === 'nonsci') z -= 0.4;
  // 공대 대졸↑가 반도체 현장·연구 직종에 지원하면 전공 접점 +0.3, 박사가 연구직이면 +0.5 (v0.2)
  if (ENG.includes(s.education.major_group) && myEdu >= 3 && j.touch === 'core' && j.group === '현장') z += 0.3;
  if (myEdu >= 5 && (j.ladder === 'research' || j.ladder === 'academic')) z += 0.5;
  const home = s.profile.region;
  if (region === home) z += 0.3;
  else if (D.regions.get(region)?.area === D.regions.get(home)?.area) z += 0.15;
  if (region === 'overseas' && myEdu < 4 && !s.flags.overseas_post) z -= 0.4;
  const talent = D.char.hidden_talents.find((t) => t.id === s.talent?.id);
  if (s.talent?.revealed && talent?.favors?.includes(j.id)) z += 0.5;
  const track = s.education.track;
  if (track === 'vocational' && ['production', 'craft'].includes(j.ladder)) z += 0.3;
  if (track === 'meister' && ['operator', 'equipment_engineer', 'field_service'].includes(j.id)) z += 0.6;
  if (track === 'science' && myEdu >= 3 && (j.ladder === 'research' || j.id === 'circuit_designer')) z += 0.3;
  const exp = s.career.exp[j.id] ?? 0;
  z += Math.min(0.8, 0.1 * exp);
  if (s.flags.had_job) z += ((s.career.reputation ?? 50) - 50) / 100;
  z += { regular: -0.2, contract: 0.3, dispatch: 0.5, daily: 0.8 }[emp] ?? 0;
  if (s.relations.friends >= 70) z += 0.2;
  const exempt = j.ladder === 'service' || (j.ladder === 'craft' && emp === 'daily') || j.serves;
  if (!exempt) {
    if (!s.flags.had_job && s.age >= 35) z += Math.max(-1.5, -0.1 * (s.age - 35));
    if (s.age >= 55) z -= 0.5;
  }
  if (y >= 1965 && y <= 1995 && myEdu <= 1 && ['operator', 'assembler', 'factory_worker'].includes(j.id)) z += 0.4;
  if (y > 2026) z += 0.8 * Math.log(W.jobDemand(j.id, y));
  return clamp(logistic(z), 0.02, 0.95);
}

const ENG = ['semi', 'materials', 'other_eng'];
// 학력·전공 맞춤 선호 (v0.2): 공대 대졸↑는 반도체 현장·연구, 석사는 연구·현장, 박사는 R&D(연구소·교수·국책연) 먼저.
// 학력보다 한참 낮은 일·전공과 먼 서비스 일은 거의 고르지 않습니다.
export function fitMult(L, j, o = {}) {
  const { s, D } = L;
  const myEdu = eduIdx(s.education.level);
  const req = eduIdx(j.education);
  const g = s.education.major_group;
  const eng = ENG.includes(g);
  const fits = !!D.majors.find((m) => m.id === s.education.major)?.fits?.includes(j.id);
  const core = j.touch === 'core' && j.group === '현장';
  let w = fits ? 3 : 1;
  if (eng && myEdu >= 3 && core) w *= 2.5;
  if (myEdu >= 5) w *= j.ladder === 'research' || j.ladder === 'academic' || o.role === 'eco_gov_lab' ? 6 : core ? 1.2 : 0.1;
  else if (myEdu === 4) w *= j.ladder === 'research' || core ? 2.5 : req <= 2 ? 0.2 : 0.6;
  if (myEdu >= 3 && req <= 1) w *= 0.3;
  if (eng && myEdu >= 3 && ['서비스', '일반'].includes(j.group) && !fits) w *= 0.3;
  if (g === 'nonsci' && myEdu >= 3 && core && req >= 3 && !fits) w *= 0.5;
  return w;
}

// 지금 지원할 수 있는 자리 목록 (직종 × 회사 × 고용형태)
export function postings(L) {
  const { s, D, W } = L;
  const y = s.year;
  const myEdu = eduIdx(s.education.level);
  const noHs = s.age < 18 && myEdu === 0;
  const out = [];
  for (const j of D.jobs) {
    if (j.since > y || (j.until && j.until < y) || j.side_job) continue;
    if (eduIdx(j.education) > myEdu || (noHs && j.education !== '무관')) continue;
    if (Object.entries(j.stats ?? {}).some(([k, v]) => s.stats[k] < v - 15)) continue;
    const emps = (j.employment ?? []).filter((e) => e !== 'owner');
    if (!emps.length) continue;
    const cos = j.sectors?.length ? W.allAlive().filter((c) => j.sectors.includes(c.sector) && c.founded <= y && companyHiring(L, c)) : [null];
    for (const co of cos) {
      const region = workRegion(L, co);
      for (const emp of emps) out.push({ job: j.id, company: co?.id ?? null, employment: emp, region, p: hireChance(L, j, co, emp, region), touch: j.touch });
    }
  }
  // 박사: 국책연구소 연구원 자리 (세부 직무 eco_gov_lab, 회사 없음·대전)
  const lab = D.jobById.get('device_researcher');
  if (myEdu >= 5 && lab && y >= 1976 && D.subJobs.some((x) => x.role === 'eco_gov_lab')) {
    const region = D.regions.has('daejeon') ? 'daejeon' : s.profile.region;
    out.push({ job: lab.id, company: null, employment: 'regular', region, role: 'eco_gov_lab', p: hireChance(L, lab, null, 'regular', region), touch: lab.touch });
  }
  return out;
}

const keyOf = (o) => `${o.job}|${o.company}|${o.employment}|${o.role ?? ''}`;
export function offerLabel(L, o) {
  const j = L.D.jobById.get(o.job);
  const co = L.W.co(o.company);
  const where = o.role === 'eco_gov_lab' ? '국책연구소' : co ? co.name : L.D.regions.get(o.region)?.name ?? '동네';
  const title = (o.sub && L.D.subById.get(o.sub)?.name) || j?.name || o.job;
  return `${where} · ${title} (${L.D.employmentNames[o.employment] ?? o.employment})`;
}

// 붙은 곳 고르기: first면 5.3 슬롯(연봉·가까움·다른 길), 아니면 연락 온 곳 최대 3개
export function makeOffers(L, { first = false } = {}) {
  const { s, rng, D, W } = L;
  const posts = postings(L);
  const noSemi = s.semi.length === 0;
  const myEdu = eduIdx(s.education.level);
  const fit = (o) => (o._fit ??= fitMult(L, D.jobById.get(o.job), o));
  const prefer = (o) => {
    const j = D.jobById.get(o.job);
    let w = o.p * (1 + 0.8 * eduIdx(j.education)) * (o.touch !== 'none' ? (noSemi && s.age >= 30 ? 2.5 : 1.4) : 1) * fit(o);
    if (o.region === 'overseas') w *= 0.3;
    return w;
  };
  const accepted = [];
  const pool = [...posts];
  for (let i = 0; i < 12 && pool.length; i++) {
    const o = rng.weighted(pool, prefer);
    if (!o) break;
    pool.splice(pool.indexOf(o), 1);
    if (rng.chance(o.p) && !accepted.some((a) => keyOf(a) === keyOf(o))) accepted.push(o);
  }
  const pay = (o) => baseSalary(L, { ...o, rank: 0 });
  const dist = (o) => (o.region === s.profile.region ? 0 : D.regions.get(o.region)?.area === D.regions.get(s.profile.region)?.area ? 1 : 2);
  const semiJob = (o) => o.touch !== 'none';
  const fallback = (pred) => posts.filter(pred).sort((a, b) => b.p * fit(b) - a.p * fit(a))[0];
  const easy = () => {
    const pt = D.jobById.get('part_timer');
    return { job: 'part_timer', company: null, employment: 'contract', region: s.profile.region, p: 0.9, touch: pt?.touch ?? 'none' };
  };
  const picked = [];
  const take = (o) => { if (o && !picked.some((p) => keyOf(p) === keyOf(o))) { picked.push(o); return true; } return false; };

  if (first) {
    take([...accepted].sort((a, b) => pay(b) - pay(a))[0] ?? fallback((o) => o.touch === 'core' && ['contract', 'dispatch'].includes(o.employment)));
    if (picked.length < 1) take(easy());
    const rest = accepted.filter((a) => !picked.some((p) => keyOf(p) === keyOf(a)));
    // 가까운 곳: 거리 다음으로 학력·전공 맞춤
    take(rest.sort((a, b) => dist(a) - dist(b) - Math.log(fit(a) / fit(b)) || pay(b) - pay(a))[0]
      ?? fallback((o) => o.touch === 'none' && dist(o) === 0 && !picked.some((p) => keyOf(p) === keyOf(o))));
    const allSemi = picked.every(semiJob);
    // 다른 길: 석사↑면 연구소·교수 같은 학위 맞춤 길, 아니면 touch가 다른 곳
    const rest2 = accepted.filter((a) => !picked.some((p) => keyOf(p) === keyOf(a)) && (allSemi ? !semiJob(a) : semiJob(a)))
      .sort((a, b) => fit(b) - fit(a));
    if (myEdu >= 4) {
      const alt = accepted.filter((a) => !picked.some((p) => keyOf(p) === keyOf(a)) && fit(a) >= 2).sort((a, b) => fit(b) - fit(a));
      if (alt.length) rest2.unshift(alt[0]);
    }
    if (!take(rest2[0])) {
      const fb = fallback((o) => (allSemi ? !semiJob(o) : semiJob(o)) && !picked.some((p) => keyOf(p) === keyOf(o)));
      if (!take(fb)) take(easy());
    }
    while (picked.length < 3) {
      const extra = posts.filter((o) => !picked.some((p) => keyOf(p) === keyOf(o))).sort((a, b) => b.p - a.p)[0];
      if (!extra || !take(extra)) break;
    }
    if (picked.length < 3) take(easy());
  } else {
    const semiFirst = accepted.filter(semiJob).sort((a, b) => pay(b) * fit(b) - pay(a) * fit(a));
    take(semiFirst[0]);
    for (const o of [...accepted].sort((a, b) => pay(b) * fit(b) - pay(a) * fit(a))) { if (picked.length >= 3) break; take(o); }
    if (picked.length < 3) take(easy());
  }
  // 세부 직무를 미리 정해 공고에 보여 줌 (예: "삼송전자 · D램 포토 공정 엔지니어 (정규직)")
  return picked.slice(0, 3).map((o) => {
    const sub = pickSub(L, D.jobById.get(o.job), W.co(o.company), o.role ?? null)?.id ?? null;
    const x = { job: o.job, company: o.company, employment: o.employment, region: o.region, role: o.role ?? null, sub };
    return { ...x, label: offerLabel(L, x) };
  });
}

// ---------- 채용 ----------
// 세부 직업 고르기 (job_matrix): 회사 분야에 맞고, 학력에 가까운 직무일수록, 대학원 전공(specialty)과 축이 맞을수록 잘 뽑힘
function pickSub(L, j, co, role = null) {
  const { s } = L;
  const y = s.year;
  const myEdu = eduIdx(s.education.level);
  let subs = (L.D.subByParent.get(j.id) ?? []).filter((x) => x.since <= y && (!x.future || y > 2026) && eduIdx(x.education) <= myEdu
    && (co ? (!x.sectors.length || x.sectors.includes(co.sector)) && (x.touch !== 'eco' || j.touch === 'eco') : !x.sectors.length));
  if (role) { const r = subs.filter((x) => x.role === role); if (r.length) subs = r; }
  if (!subs.length) return null;
  const [sd, sv] = String(s.education.specialty ?? '').split('.');
  return L.rng.weighted(subs, (x) => {
    const gap = myEdu - eduIdx(x.education);
    let w = gap <= 0 ? 3 : gap === 1 ? 2 : gap === 2 ? 0.6 : 0.2;
    if (sd && x.dims?.[sd] === sv) w *= 6;
    return w;
  });
}
function pickClient(L, co, region) {
  const { W } = L;
  if (!co?.clients) return null;
  const cl = co.clients.map((id) => W.co(id)).filter((c) => c?.on && !c.gone);
  return (cl.find((c) => c.regions.includes(region)) ?? cl[0])?.id ?? null;
}

export function clearJob(L, reason = '') {
  const c = L.s.career;
  if (c.job) c.history.push({ job: c.job, sub: c.sub, company: c.company, from: c.since, to: L.s.year, reason });
  Object.assign(c, { job: null, sub: null, company: null, client: null, employment: null, ladder: null, rank: 0, rank_years: 0, years: 0, salary: 0, exec: false, exec_pending: false, leave: false, military_job: null, contract_years: 0, tries: 0, founder: false });
}

// o = {job, company, employment, region} — opts: keepRank, rankUp, salaryMod, semiAdded, military
export function hire(L, o, opts = {}) {
  const { s, D, W } = L;
  const j = D.jobById.get(o.job);
  if (!j) return false;
  const co = W.co(o.company);
  const prev = s.career;
  const prevLadder = prev.ladder;
  const prevRank = prev.rank;
  const hadJob = !!s.flags.had_job;
  const prevRep = prev.reputation ?? 50;
  if (prev.job) clearJob(L, 'move');
  const employment = o.employment ?? j.employment?.[0] ?? 'contract';
  const ladder = employment === 'owner' ? (j.ladder === 'creator' ? 'creator' : 'owner') : j.ladder;
  const lad = D.ladders[ladder];
  let rank = 0;
  let rankYears = 0;
  if (opts.keepRank && prevLadder === ladder) rank = prevRank;
  else if (['corporate', 'research'].includes(ladder) && s.education.level === '박사') rank = 2;
  else if (['corporate', 'research'].includes(ladder) && s.education.level === '석사') rankYears = 2;
  if (opts.rankUp && lad?.ranks?.length && rank + 1 < (lad.exec_from ?? lad.ranks.length)) rank++;
  if (opts.exec) rank = opts.exec;
  const region = o.region ?? workRegion(L, co);
  const pre = o.sub ? D.subById.get(o.sub) : null;
  const sub = pre && pre.parent === j.id ? pre : pickSub(L, j, co, o.role ?? null);
  const c = s.career;
  Object.assign(c, {
    job: j.id, sub: sub?.id ?? null, company: co?.id ?? null, employment, region, ladder, rank, rank_years: rankYears, years: 0,
    client: j.serves === 'fab' ? W.nearbyFab(region)?.id ?? null : pickClient(L, co, region),
    reputation: hadJob ? 50 + 0.5 * (prevRep - 50) : 50 + (s.flags.served_officer ? 5 : 0),
    salary_mod: opts.salaryMod ?? (opts.keepRank ? c.salary_mod : 0), since: s.year, tries: 0, plateau: false, exec: !!opts.exec,
    exec_pending: false, leave: false, military_job: opts.military ?? null, contract_years: 0, founder: !!opts.founder,
  });
  if (employment === 'owner') c.business = { score: 0, stage: 0, up: 0, down: 0 };
  c.salary = targetSalary(L, c);
  c.salary_key = `${c.job}|${c.company}|${c.employment}`;
  c.salary_rank = c.rank;
  c.salary_region = c.region;
  c.salary_mult = null;
  c.moves = (c.moves ?? 0) + (hadJob ? 1 : 0);
  if (!hadJob) { c.first_job = j.id; c.first_job_year = s.year; c.first_job_employment = employment; }
  s.retired = false;
  addFlag(s, 'had_job');
  const name = jobName(L);
  const where = co?.name ?? '';
  if (!opts.quiet) addLog(L, hadJob ? `${where ? `${where}에서 ` : ''}${ro(name)} 일을 시작했어요` : `${where ? `${where}에 ` : ''}${ro(name)} 첫 출근했어요`, hadJob ? 2 : 3, 'work');
  // 반도체 직종 첫 출근은 순간으로 (SYSTEMS 5.3·7)
  if (j.touch !== 'none' && !s.flags.semi_job) {
    addFlag(s, 'semi_job');
    if (!opts.semiAdded) {
      const place = where || (o.role ? '' : W.nearbyFab(region)?.name || '반도체 공장');
      addSemi(L, `${place ? `${place} ` : ''}${name} 첫 출근`, j.touch, null);
    }
  }
  // 다른 권역 근무지면 이사 (해외는 근무지만)
  const home = s.profile.region;
  if (region && region !== 'overseas' && region !== home && D.regions.get(region)?.area !== D.regions.get(home)?.area) moveTo(L, region);
  L.emit?.('company', { kind: 'hired', company: co?.id ?? null, job: j.id });
  return true;
}

export function moveTo(L, regionId) {
  const { s, D } = L;
  const reg = D.regions.get(regionId);
  if (!reg || regionId === s.profile.region || regionId === 'overseas') return;
  const otherArea = reg.area !== D.regions.get(s.profile.region)?.area;
  s.profile.region = regionId;
  s.profile.area = reg.area;
  if (otherArea) s.relations.friends = Math.max(0, s.relations.friends - 5);
  addLog(L, `${ro(reg.name)} 이사했어요`, 1, 'life');
}

// 지정 채용 (job:hire:<id>): 학력·능력치 무시, 근처 회사로
export function hireDirect(L, jobId, opts = {}) {
  const { D, W, s } = L;
  const j = D.jobById.get(jobId);
  if (!j) return false;
  let co = null;
  if (j.sectors?.length) {
    const near = W.allAlive().filter((c) => j.sectors.includes(c.sector) && c.founded <= s.year);
    const home = s.profile.region;
    const area = D.regions.get(home)?.area;
    co = near.find((c) => c.regions.includes(home)) ?? near.find((c) => c.regions.some((r) => D.regions.get(r)?.area === area))
      ?? near.filter((c) => c.regions.some((r) => r !== 'overseas')).sort((a, b) => b.share - a.share)[0] ?? near[0] ?? null;
  }
  const employment = opts.employment ?? (j.employment.includes('contract') ? 'contract' : j.employment[0]);
  return hire(L, { job: j.id, company: co?.id ?? null, employment, region: co ? workRegion(L, co) : s.profile.region }, opts);
}

// ---------- 해마다 (④ 제도 처리) ----------
// triggers: Map(이름 → ctx). 사건은 엔진이 이 트리거로 뽑습니다.
export function careerYearStart(L, triggers) {
  const { s, W, rng } = L;
  const c = s.career;
  const y = s.year;
  const co = W.co(c.company);
  const j = jobOf(L);

  if (c.job && co) {
    const semiCo = j?.touch !== 'none' && ['memory', 'foundry', 'fabless', 'equipment_global', 'equipment_korea', 'materials', 'packaging'].includes(co.sector);
    for (const f of W.fatesOf(y)) {
      if (f.id !== co.id) continue;
      if (f.kind === 'bankrupt') {
        const name = co.name;
        clearJob(L, 'bankrupt');
        triggers.set('company_bankrupt', { company: co.id });
        addLog(L, `${josa(name, '이', '가')} 문을 닫았어요`, 2, 'company');
        if (semiCo) addSemi(L, `${name}의 마지막 날을 함께했어요`, 'core');
        L.emit?.('company', { kind: 'bankrupt', company: co.id });
      } else if (f.kind === 'acquired') {
        if (rng.chance(0.7)) {
          c.company = f.acquirer;
          triggers.set('company_acquired', { acquirer: f.acquirer, company: f.acquirer, old: co.id });
          addLog(L, `${josa(co.name, '이', '가')} ${W.companyName(f.acquirer)}에 인수됐어요`, 2, 'company');
          if (semiCo) addSemi(L, `${josa(co.name, '이', '가')} ${W.companyName(f.acquirer)}에 인수되던 날`, 'core');
        } else triggers.set('layoff_target', { company: co.id });
        L.emit?.('company', { kind: 'acquired', company: co.id, acquirer: f.acquirer });
      } else if (f.kind === 'leader' && semiCo) {
        addSemi(L, `${josa(co.name, '이', '가')} 1위에 올랐어요`, 'core');
        L.emit?.('company', { kind: 'leader', company: co.id });
      }
    }
  }
  // 원청이 망하면 협력사 사업장 계약 종료 (SYSTEMS 6.7)
  if (c.job && c.client && W.co(c.client)?.gone) triggers.set('contract_lost', { client: c.client });

  if (c.job && !c.leave) {
    const cur = W.co(c.company);
    // 구조조정 (5.7)
    if (cur && !triggers.has('company_bankrupt')) {
      const korea = W.marketKey('korea', y);
      let pAnn = cur.c <= -2 ? 0.7 : cur.c <= -1.5 ? 0.5 : 0;
      if (!pAnn && korea <= -2 && cur.c <= -1 && cur.country === 'KR') pAnn = 0.5;
      if (pAnn && rng.chance(pAnn)) {
        if (['daily', 'dispatch'].includes(c.employment)) {
          clearJob(L, 'not_renewed');
          addLog(L, '재계약이 안 돼서 일을 그만두게 됐어요', 2, 'work');
        } else {
          const p = clamp(0.15 + (s.age >= 50 ? 0.15 : 0) + (c.rank >= 3 ? 0.1 : 0) + (50 - c.reputation) / 200 + (c.employment === 'contract' ? 0.15 : 0)
            - 0.03 * (cur.attrs.stability - 3) - (hasTrait(s, 'conform', '+') ? 0.05 : 0), 0.05, 0.7);
          if (rng.chance(p)) triggers.set('layoff_target', { company: cur.id });
        }
      } else if (['daily', 'dispatch'].includes(c.employment) && cur.c <= -1 && rng.chance(cur.c <= -2 ? 0.4 : 0.25)) {
        clearJob(L, 'not_renewed');
        addLog(L, '일감이 끊겨 재계약이 안 됐어요', 2, 'work');
      }
    }
    // 계약직 2년마다 갱신·전환
    if (c.job && c.employment === 'contract' && c.years > 0 && c.years % 2 === 0 && c.ladder !== 'none' && !c.military_job) {
      const cc = W.co(c.company)?.c ?? 0;
      if (rng.chance(clamp(0.1 + 0.05 * (c.reputation - 50) / 10, 0, 0.6)) && jobOf(L).employment.includes('regular')) {
        c.employment = 'regular';
        addLog(L, '정규직으로 전환됐어요', 2, 'work');
      } else if (!rng.chance(clamp(0.8 + 0.1 * cc, 0.3, 0.98))) {
        clearJob(L, 'contract_end');
        addLog(L, '계약이 끝났어요', 2, 'work');
      }
    }
    // 스카우트 (5.6)
    const lad = c.ladder;
    if (c.job && ['regular', 'contract'].includes(c.employment) && c.years >= 3 && ['corporate', 'research', 'production', 'craft'].includes(lad)
      && !c.exec && y - (c.last_scout ?? 0) >= 4 && W.co(c.company)) {
      const cur2 = W.co(c.company);
      const talent = L.D.char.hidden_talents.find((t) => t.id === s.talent?.id);
      const p = clamp(0.02 + 0.003 * (c.reputation - 50) + 0.02 * Math.max(0, W.score(cur2.sector, y)) + (hasTrait(s, 'social', '+') ? 0.02 : 0)
        + (s.talent?.revealed && talent?.favors?.includes(c.job) ? 0.03 : 0), 0, 0.2);
      if (rng.chance(p)) {
        const rv = W.rival(cur2.id, rng);
        if (rv) {
          c.last_scout = y;
          triggers.set('scout', { rival: rv.id, region: workRegion(L, rv), mod: rng.float(0.2, 0.5), rankUp: rng.chance(0.3) });
        }
      }
    }
    // 임원 제안 (지난해 승진 판정 성공)
    if (c.job && c.exec_pending) { c.exec_pending = false; triggers.set('exec_offer', {}); }
  }

  // 정년·은퇴 (5.9)
  if (c.job && !c.leave && !c.military_job) {
    const ra = retireAge(L);
    const regularLaw = c.employment === 'regular' && ra;
    let retire = false;
    if (c.exec && s.age >= 65) retire = true;
    else if (regularLaw && s.age >= ra) retire = true;
    else if (!regularLaw && (s.age >= 70 || s.stats.health < 20) && rng.chance(0.3)) retire = true;
    if (retire) retireNow(L, triggers);
  } else if (!c.job && statusOf(s) === 'unemployed' && s.age >= 62) {
    s.retired = true;
    addFlag(s, 'retired_once');
    addLog(L, '일을 내려놓고 쉬기로 했어요', 2, 'work');
  }

  // 무직이면 구직 (job_search)
  if (statusOf(s) === 'unemployed' && s.age >= 14 && !s.yearFlags.no_search) {
    s.career.unemployed_years = (s.career.unemployed_years ?? 0) + 1;
    triggers.set('job_search', { offers: makeOffers(L, { first: !s.flags.had_job }) });
  } else if (s.career.job) s.career.unemployed_years = 0;
  if (s.yearFlags.look && s.career.job) triggers.set('job_search', { offers: makeOffers(L, { first: false }), look: true });
}

export function retireNow(L, triggers) {
  const { s } = L;
  const first = !s.flags.retired_once;
  const where = L.W.companyName(s.career.company);
  addLog(L, `${where ? `${where}에서 ` : ''}${s.age}세에 은퇴했어요`, 3, 'work');
  clearJob(L, 'retired');
  s.retired = true;
  s.retired_year = s.year;
  addFlag(s, 'retired_once');
  if (first && triggers) triggers.set('retired', {});
}

// ---------- 연말 (⑥ 승진·평판·자영업) ----------
export function careerYearEnd(L) {
  const { s, D, W, rng } = L;
  const c = s.career;
  if (!c.job || c.leave) return;
  const j = jobOf(L);
  c.years++;
  c.rank_years++;
  c.total_years = (c.total_years ?? 0) + 1;
  c.exp[c.job] = (c.exp[c.job] ?? 0) + 1;
  if (j.touch === 'core') c.core_years = (c.core_years ?? 0) + 1;
  if (c.employment === 'contract') c.contract_years++;
  const lad = D.ladders[c.ladder];
  const keyStat = lad?.key_stat ?? 'intelligence';
  const co = W.co(c.company);

  // 평판
  let dr = (c.years <= 10 ? 0.5 : 0) + clamp((s.stats[keyStat] - 60) / 20, -1, 1);
  if (hasTrait(s, 'diligence', '+')) dr += 1;
  if (hasTrait(s, 'work_life', '+')) dr += 1;
  if (hasTrait(s, 'social', '-') && c.ladder === 'research') dr += 1;
  c.reputation = clamp(c.reputation + dr, 0, 100);

  // 자영업 실적 b (5.8)
  if (c.employment === 'owner' && c.business) {
    const b = c.business;
    const Lf = j.serves === 'fab_region' ? fabRegionState(L) : W.macro(s.year);
    const talent = D.char.hidden_talents.find((t) => t.id === s.talent?.id);
    const K = (s.stats[j.id === 'chicken_shop' ? 'dexterity' : 'sociability'] - 50) / 25 + (s.talent?.revealed && talent?.favors?.includes(j.id) ? 0.5 : 0);
    b.score = clamp(0.5 * Lf + 0.3 * K + rng.gauss(0, 0.6), -2, 2);
    b.up = b.score >= 1 ? b.up + 1 : 0;
    b.down = b.score <= -1 ? b.down + 1 : 0;
    b.bust = b.score <= -1.5 ? (b.bust ?? 0) + 1 : 0;
    const top = (lad?.ranks?.length ?? 5) - 1;
    if (b.up >= 2 && c.rank < top) { c.rank++; b.up = 0; addLog(L, `가게가 ${rankName(L)} 단계가 됐어요`, 1, 'work'); }
    else if (b.down >= 2 && c.rank > 0) { c.rank--; b.down = 0; }
    else if (c.rank === 0 && b.bust >= 2 && !['farmer', 'retail_investor', 'landlord'].includes(j.id)) {
      addLog(L, '장사가 안 돼 가게 문을 닫았어요', 2, 'work');
      clearJob(L, 'shop_closed');
      s.pendingTriggers.shop_closed = {};
    }
    return;
  }

  if (!lad?.ranks?.length || !lad.promo_base) return;

  // 임원 재계약 (5.5)
  if (c.exec && !c.founder) {
    const cc = co?.c ?? 0;
    if (!rng.chance(clamp(0.75 + 0.1 * cc + (c.reputation - 70) / 100, 0.3, 0.95))) {
      addLog(L, '임원 재계약이 안 됐어요', 2, 'work');
      if (s.age >= 50) retireNow(L, null);
      else clearJob(L, 'exec_end');
      return;
    }
  }
  // 승진 판정
  const r = c.rank;
  const minY = lad.min_years?.[r];
  const base = lad.promo_base?.[r];
  if (minY === null || minY === undefined || base === null || base === undefined) return;
  const toExecNext = lad.exec_from !== null && lad.exec_from !== undefined && r + 1 >= lad.exec_from;
  // 임원 문턱은 최소 연수를 0.6배로 (정년 전에 임원 도전 기회가 오게, v0.2 life_sim 튜닝)
  const need = minY * (c.ladder === 'corporate' && eduIdx(s.education.level) <= 2 ? 1.5 : 1) * (toExecNext ? 0.6 : 1);
  if (c.rank_years < need) return;
  if (c.plateau) return;
  const execFrom = lad.exec_from;
  if (execFrom !== null && execFrom !== undefined && r + 1 >= execFrom && !c.exec && s.flags.declined_exec) return;
  const talent = D.char.hidden_talents.find((t) => t.id === s.talent?.id);
  let tb = 0;
  if (hasTrait(s, 'diligence', '+')) tb += 0.1;
  if (hasTrait(s, 'diligence', '-')) tb -= 0.1;
  if (hasTrait(s, 'work_life', '+')) tb += 0.15;
  if (hasTrait(s, 'work_life', '-')) tb -= 0.05;
  if (hasTrait(s, 'conform', '+') && r < 3) tb += 0.05;
  if (hasTrait(s, 'conform', '-') && execFrom !== null && r + 1 >= execFrom) tb -= 0.2;
  const sv = clamp((c.reputation - 50) / 100 + (s.stats[lad.key_stat ?? 'intelligence'] - 60) / 200 + tb + 0.05 * (c.rank_years - need)
    + (s.talent?.revealed && talent?.favors?.includes(c.job) ? 0.1 : 0), -0.5, 0.6);
  const coF = !co ? 1 : co.c <= -1 ? 0.3 : co.c >= 1.5 ? 1.2 : 1;
  // 피라미드 보정 (life_sim 튜닝): 문서 공식 그대로면 대졸 회사원의 80%가 부장이 돼 14장 목표(30~45%)를 크게 넘어서,
  // 사다리 위쪽(임원 승진 제외)으로 갈수록 확률을 줄입니다.
  const nR = lad.ranks.length - 1;
  const toExec = execFrom !== null && execFrom !== undefined && r + 1 >= execFrom;
  const ratio = (r + 1) / Math.max(1, nR);
  const squeeze = toExec || c.ladder === 'academic' ? 1 : ratio <= 0.4 ? 1 : ratio <= 0.55 ? 0.22 : 0.13;
  // 임원 문턱 (v0.2 life_sim 튜닝): 문서 값(promo_base 0.04)으로는 대졸 회사원·연구원 임원이 1~2%라 목표(3~8%)에 맞게 ×2
  const P = base * (1 + sv) * coF * squeeze * (toExec ? 2 : 1);
  if (rng.chance(P)) {
    if (execFrom !== null && execFrom !== undefined && r + 1 === execFrom && !c.exec) {
      c.exec_pending = true;
      return;
    }
    c.rank++;
    c.rank_years = 0;
    c.tries = 0;
    c.best_rank = Math.max(c.best_rank ?? 0, c.rank);
    addLog(L, `${ro(rankName(L))} 승진했어요`, c.rank >= 3 ? 2 : 1, 'work');
    L.emit?.('promo', { rank: c.rank, name: rankName(L) });
  } else {
    c.tries = (c.tries ?? 0) + 1;
    const mt = lad.max_tries?.[r];
    if (mt && c.tries >= mt) { c.plateau = true; addFlag(s, 'career_plateau'); }
  }
}
