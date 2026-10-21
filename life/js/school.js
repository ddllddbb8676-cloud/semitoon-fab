// 교육·병역 (담당: Claude, DOM 없음) — SYSTEMS 4장 간단형
// 학교 상태: s.education = { level, tier, major, major_group, track, stage, years_in, dur, next, grade, retries, paused }
//   stage: elem | middle | hs | college | jc | master | phd | retry (재수) | null
//   next:  그해 갈림길에서 정한 다음 과정 {stage, track} — 연말 졸업 때 넘어감

import { clamp, lerpTable, addFlag, addLog, josa, warnOnce } from './core.js';
import { hire, clearJob, workRegion, ro } from './career.js';

// 4.2 시대별 진학 확률: [연도, 중학교, 고교, 대학·전문대, 그중 전문대 비율, 대학원]
const RATES = [
  [1950, 0.4, 0.55, 0.15, 0.1, 0.02], [1960, 0.5, 0.65, 0.2, 0.15, 0.03], [1970, 0.66, 0.7, 0.27, 0.25, 0.04],
  [1980, 0.95, 0.85, 0.27, 0.4, 0.06], [1990, 0.99, 0.95, 0.33, 0.45, 0.08], [2000, 0.99, 0.99, 0.68, 0.45, 0.1],
  [2008, 0.99, 0.99, 0.84, 0.4, 0.12], [2015, 0.99, 0.99, 0.71, 0.35, 0.13], [2026, 0.99, 0.99, 0.72, 0.35, 0.15],
];
export const rate = (y, col) => lerpTable(RATES.map((r) => [r[0], r[col]]), y);
const WEALTH_MULT = [1, 0.6, 0.8, 1, 1.15, 1.3];
// 진학 확률에 집안 형편 반영: p^(1/배율) — 진학률이 99%인 시대엔 가난해도 거의 다 가고, 40%인 시대엔 차이가 큼 (v0.2)
const withWealth = (p, wm) => Math.min(0.995, Math.pow(Math.min(0.999, p), 1 / wm));
const DUR = { elem: 6, middle: 3, hs: 3, college: 4, jc: 2, master: 2, phd: 6, retry: 1 };
const LEVEL_AFTER = { hs: '고졸', jc: '전문대졸', college: '대졸', master: '석사', phd: '박사' };
const TRACK_TIER = { general: 3, vocational: 3, meister: 4, science: 5, factory: 2 };
const TRACK_G = { general: 3, science: 8 };
export const TRACK_NAMES = { general: '인문계 고교', vocational: '실업계 고교', meister: '마이스터고', science: '과학고', factory: '산업체 부설 고교' };
export function stageLabel(stage, y, track) {
  if (stage === 'elem') return y < 1996 ? '국민학교' : '초등학교';
  if (stage === 'hs') return TRACK_NAMES[track] ?? '고등학교';
  return { middle: '중학교', college: '대학교', jc: '전문대', master: '대학원 석사', phd: '대학원 박사', retry: '재수' }[stage] ?? '';
}
const tierFromG = (g) => (g >= 85 ? 5 : g >= 75 ? 4 : g >= 60 ? 3 : g >= 45 ? 2 : 1);

function enter(L, stage, track = null) {
  const e = L.s.education;
  e.stage = stage;
  e.dur = DUR[stage];
  e.years_in = 0;
  if (track) e.track = track;
  e.next = null;
  if (stage !== 'retry') addLog(L, `${stageLabel(stage, L.s.year + 1, e.track)}에 들어가요`, stage === 'elem' ? 1 : 2, 'school');
}

// ④ 해마다: 입학·학년·트리거
export function schoolYearStart(L, triggers) {
  const { s, rng } = L;
  const e = s.education;
  if (s.age === 7 && !e.stage && !e.started) {
    e.started = true;
    e.stage = 'elem'; e.dur = 6; e.years_in = 0;
    addLog(L, `${stageLabel('elem', s.year)}에 입학했어요`, 2, 'school');
  }
  if (!e.stage) return;
  e.years_in++;
  // 성적 G (4.4)
  const study = 50;
  e.grade = clamp(0.55 * s.stats.intelligence + 0.15 * s.stats.mental + 0.15 * (s.traits.diligence + 100) / 2 + 0.15 * study
    + 2 * (s.profile.family.wealth - 3) + (e.stage === 'hs' || e.stage === 'retry' ? TRACK_G[e.track] ?? 0 : 0)
    + (e.stage === 'retry' ? 5 * e.retries : 0) + rng.gauss(0, 8), 0, 100);
  if (e.years_in >= e.dur) {
    if (e.stage === 'middle') triggers.set('hs_entry', {});
    if (e.stage === 'hs') triggers.set('hs_graduate', {});
    if (e.stage === 'college') triggers.set('college_senior', {});
  }
  if (['elem', 'middle', 'hs', 'college', 'jc'].includes(e.stage)) s.relations.friends = clamp(s.relations.friends + 3, 0, 100);
}

// ⑥ 연말: 졸업과 다음 과정
export function schoolYearEnd(L) {
  const { s, rng } = L;
  const e = s.education;
  if (!e.stage || e.years_in < e.dur) return;
  const y = s.year;
  const st = e.stage;
  const wm = WEALTH_MULT[s.profile.family.wealth] ?? 1;
  if (st === 'elem') {
    if (rng.chance(withWealth(rate(y + 1, 1), wm))) enter(L, 'middle');
    else {
      e.stage = null;
      addFlag(s, 'no_middle_school');
      s.pendingTriggers.no_middle_school = {};
      addLog(L, '중학교 대신 집안일과 일을 돕기로 했어요', 2, 'school');
    }
    return;
  }
  if (st === 'middle') {
    if (e.next?.stage === 'hs') return enter(L, 'hs', e.next.track);
    if (e.stop) { e.stage = null; addLog(L, '중학교를 마치고 일을 시작해요', 2, 'school'); return; }
    if (rng.chance(withWealth(rate(y + 1, 2), wm))) return enter(L, 'hs', 'general');
    e.stage = null;
    addFlag(s, 'no_highschool');
    addLog(L, '중학교를 마치고 일을 시작해요', 2, 'school');
    return;
  }
  if (st === 'retry') {
    const nx = e.next;
    e.stage = null;
    if (nx?.stage) enter(L, nx.stage);
    return;
  }
  // 고교·대학·대학원 졸업
  if (LEVEL_AFTER[st]) {
    e.level = LEVEL_AFTER[st];
    (e.grad ??= {})[e.level] = y;
    if (st === 'hs') e.tier = TRACK_TIER[e.track] ?? 3;
    else if (st === 'college') e.tier = tierFromG(e.grade);
    else if (st === 'jc') e.tier = Math.max(1, tierFromG(e.grade) - 1 + (e.major === 'semi_equipment' ? 1 : 0));
    else e.tier = Math.max(e.tier ?? 1, tierFromG(e.grade));
    // 대학원 학위 전공 (job_matrix degree_tracks, SPEC education.specialty = "<축>.<값>")
    if ((st === 'master' || st === 'phd') && (!e.specialty || (st === 'phd' && rng.chance(0.3)))) {
      const sp = pickSpecialty(L);
      if (sp) { e.specialty = sp.id; e.specialty_name = sp.name; }
    }
    const spec = (st === 'master' || st === 'phd') && e.specialty_name ? ` · ${e.specialty_name} 전공` : '';
    addLog(L, `${josa(stageLabel(st, y, e.track), '을', '를')} 졸업했어요 (${e.level}${spec})`, 2, 'school');
    if (st === 'master') addFlag(s, 'grad_master');
    if (st === 'phd') addFlag(s, 'grad_phd');
  }
  const nx = e.next;
  e.stage = null;
  if (nx?.stage) enter(L, nx.stage, nx.track);
  // 장교는 졸업 뒤 복무
  if (!e.stage && s.military.status === 'officer_pending') startService(L, 'officer');
}

// 대학원 전공 분야: 전공 계열에 맞는 축(공정·설계·소재·패키징·연구 분야)에서 그 해 있는 값 하나
const SPEC_DIMS = { semi: ['process', 'process', 'design', 'field'], materials: ['material', 'process', 'field'], other_eng: ['process', 'pkg', 'design', 'field'] };
function pickSpecialty(L) {
  const { s, D, rng } = L;
  const e = s.education;
  const M = D.raw?.matrix;
  const allowed = M?.degree_tracks?.dims ?? [];
  let pref = e.major === 'computer' ? ['design'] : SPEC_DIMS[e.major_group] ?? [];
  pref = pref.filter((d) => allowed.includes(d));
  if (!pref.length) return null;
  const d = rng.pick(pref);
  const vals = (M.dimensions?.[d] ?? []).filter((v) => (v.since ?? 0) <= s.year && !v.future);
  const v = rng.pick(vals);
  return v ? { id: `${d}.${v.id}`, name: v.name } : null;
}

// 대학 합격 판정 (4.5)
function admit(L, kind) {
  const { s, rng } = L;
  const e = s.education;
  const g = e.grade ?? 50;
  const p = kind === 'college' ? clamp(rate(s.year + 1, 3) * (0.6 + g / 100) + 0.1 * e.retries, 0.05, 0.97) : clamp(0.6 + g / 100, 0.6, 0.98);
  return rng.chance(p);
}

// do school:<x>  — ctx에 notes(결과 문장 덧붙이기)·cancelGoto·requeue를 남길 수 있음
export function doSchool(L, arg, ctx) {
  const { s } = L;
  const e = s.education;
  const hsTrack = { hs_general: 'general', hs_vocational: 'vocational', hs_meister: 'meister', hs_science: 'science', hs_factory: 'factory' }[arg];
  if (hsTrack) { e.next = { stage: 'hs', track: hsTrack }; e.stop = false; return; }
  switch (arg) {
    case 'none': e.next = null; e.stop = true; return;
    case 'college':
    case 'junior_college': {
      const kind = arg === 'college' ? 'college' : 'jc';
      s.yearFlags.admit_tries = (s.yearFlags.admit_tries ?? 0) + 1;
      if (admit(L, kind)) {
        e.next = { stage: kind };
        ctx.notes.push(kind === 'college' ? '합격이에요!' : '전문대 합격 소식이 왔어요.');
      } else {
        s.yearFlags.is_rejected = true;
        ctx.cancelGoto = true;
        ctx.notes.push('아쉽게도 불합격이에요.');
        if (s.yearFlags.admit_tries < 3) ctx.requeue = 'college_choice';
      }
      return;
    }
    case 'retry':
      if (e.retries >= 2) { ctx.notes.push('더는 재수하지 않기로 했어요.'); return; }
      e.retries++;
      e.next = { stage: 'retry' };
      return;
    case 'master': e.next = { stage: 'master' }; return;
    case 'phd': e.next = { stage: 'phd' }; return;
    default: warnOnce(`do-school-${arg}`, `지원하지 않는 do: school:${arg}`);
  }
}

// do major:<group> (4.6)
export function doMajor(L, group) {
  const { s, D, rng } = L;
  const e = s.education;
  const y = s.year;
  const jc = e.next?.stage === 'jc' || e.stage === 'jc';
  const level = jc ? '전문대' : '대학';
  let pick = null;
  if (group === 'semi') {
    if (!jc && y >= 2006 && rng.chance(0.3)) pick = 'semi_eng';
    else if (jc && y >= 1995 && rng.chance(0.5)) pick = 'semi_equipment';
    else pick = 'electronics';
  }
  if (!pick) {
    const list = D.majors.filter((m) => m.group === group && m.levels.includes(level) && m.since <= y);
    const m = rng.weighted(list, (mj) => (s.stats.intelligence >= 70 && ['physics', 'semi_eng', 'electronics'].includes(mj.id) ? 1.5 : 1)
      * (s.stats.dexterity >= 65 && ['mechanical', 'semi_equipment'].includes(mj.id) ? 1.5 : 1));
    pick = m?.id ?? null;
  }
  e.major = pick;
  e.major_group = group;
}

// ---------- 병역 (4.7) ----------
const armyYears = (y) => (y <= 1992 ? 3 : 2);

export function militaryYearStart(L, triggers) {
  const { s, rng } = L;
  const m = s.military;
  if (s.profile.gender !== 'm') return;
  const free = !s.education.stage && !s.education.next;
  if (m.status === 'none' && s.age >= 20 && s.age <= 30) {
    if (s.stats.health < 20 || rng.chance(0.03)) {
      m.status = 'exempt';
      addLog(L, '신체검사 결과 병역 면제를 받았어요', 2, 'military');
    } else if (s.stats.health < 35) {
      m.status = 'done';
      m.type = 'supplementary';
      addLog(L, '보충역으로 출퇴근하며 복무하게 됐어요', 2, 'military');
    } else triggers.set('military_due', {});
  } else if (m.status === 'deferred' && (free || s.age >= 28)) triggers.set('military_due', {});
  else if (m.status === 'officer_pending' && free) startService(L, 'officer');
}

function startService(L, type) {
  const { s } = L;
  const m = s.military;
  const dur = type === 'army' ? armyYears(s.year) : 3;
  Object.assign(m, { status: 'serving', type, start_year: s.year, end_year: s.year + dur - 1 });
  // 학교는 휴학, 회사는 휴직 (산업기능요원·전문연구요원은 그 회사가 복무지)
  const e = s.education;
  if (e.stage) {
    e.paused = { stage: e.stage, years_in: Math.max(0, e.years_in - 1), dur: e.dur, track: e.track, next: e.next };
    e.stage = null;
    e.next = null;
  }
  if (s.career.job && (type === 'army' || type === 'officer')) s.career.leave = true;
  const label = { army: '현역', officer: '장교', industrial: '산업기능요원', research: '전문연구요원' }[type] ?? '';
  addLog(L, `${ro(label)} ${type === 'army' || type === 'officer' ? '입대' : '복무를 시작'}했어요 (${dur}년)`, 2, 'military');
}

export function doMilitary(L, arg) {
  const { s, W, rng, D } = L;
  const m = s.military;
  const inCollege = s.education.stage === 'college' || s.education.next?.stage === 'college';
  switch (arg) {
    case 'army': startService(L, 'army'); return;
    case 'officer':
      if (inCollege) { m.status = 'officer_pending'; m.type = 'officer'; }
      else startService(L, 'officer');
      return;
    case 'industrial': {
      // equipment_korea·packaging·materials (마이스터고면 30% memory·foundry) 회사의 오퍼레이터·설비 직종
      const sectors = s.education.track === 'meister' && rng.chance(0.3) ? ['memory', 'foundry'] : ['equipment_korea', 'packaging', 'materials'];
      const cos = W.allAlive().filter((c) => sectors.includes(c.sector) && c.regions.some((r) => r !== 'overseas'));
      const co = cos.length ? rng.weighted(cos, (c) => c.share + 0.05) : null;
      const job = s.education.level === '전문대졸' && D.jobById.get('equipment_engineer') ? 'equipment_engineer' : 'operator';
      startService(L, 'industrial');
      if (s.career.job) clearJob(L, 'military');
      hire(L, { job, company: co?.id ?? null, employment: 'contract', region: co ? workRegion(L, co) : s.profile.region }, { military: 'industrial', semiAdded: true });
      return;
    }
    case 'research': {
      const cos = W.allAlive().filter((c) => ['memory', 'foundry', 'materials'].includes(c.sector) && c.regions.some((r) => r !== 'overseas'));
      const co = cos.length ? rng.weighted(cos, (c) => c.share + 0.05) : null;
      const job = co?.sector === 'materials' ? 'chemist' : 'device_researcher';
      startService(L, 'research');
      if (s.career.job) clearJob(L, 'military');
      hire(L, { job, company: co?.id ?? null, employment: 'regular', region: co ? workRegion(L, co) : s.profile.region }, { military: 'research', semiAdded: true });
      return;
    }
    case 'defer': m.status = 'deferred'; return;
    default: warnOnce(`do-military-${arg}`, `지원하지 않는 do: military:${arg}`);
  }
}

// ⑥ 연말: 전역
export function militaryYearEnd(L) {
  const { s, rng } = L;
  const m = s.military;
  if (m.status !== 'serving' || s.year < m.end_year) return;
  m.status = 'done';
  addLog(L, '무사히 전역했어요', 2, 'military');
  const c = s.career;
  if (c.leave) c.leave = false;
  if (c.military_job) {
    if (m.type === 'industrial' && !rng.chance(0.6)) { clearJob(L, 'military_end'); addLog(L, '복무하던 회사를 나와 새 일을 찾아요', 1, 'work'); }
    else { c.military_job = null; if (c.employment !== 'regular' && m.type === 'industrial') { c.employment = 'regular'; addLog(L, '복무하던 회사에 정규직으로 남았어요', 2, 'work'); } }
  }
  const p = s.education.paused;
  if (p) {
    Object.assign(s.education, { stage: p.stage, years_in: p.years_in, dur: p.dur, track: p.track, next: p.next });
    s.education.paused = null;
  }
}
