// 관계: 부모·연애·결혼·출산·자녀 (담당: Claude, DOM 없음) — SYSTEMS 8장 간단형

import { clamp, lerpTable, addFlag, addLog, addSemi, josa, hasTrait, warnOnce } from './core.js';
import { parentDeathQ } from './health.js';

const FALLBACK = {
  surnames: ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권'],
  m: ['영수', '정호', '성민', '지훈', '현우', '동현', '준호', '민준', '서준', '도윤', '상철', '재석', '태호', '건우'],
  f: ['영희', '미영', '수진', '지은', '혜진', '은영', '서연', '지우', '민서', '하은', '순자', '정숙', '수빈', '예린'],
};
// 8.4 평균 초혼 나이 M(y)
const MARRY_AGE = { m: [[1960, 25], [1970, 27], [1980, 27], [1990, 28], [2000, 29], [2010, 32], [2020, 33], [2026, 34]], f: [[1960, 21], [1970, 23], [1980, 24], [1990, 25], [2000, 26], [2010, 29], [2020, 31], [2026, 32]] };
// 8.5 합계출산율
const TFR = [[1960, 6], [1970, 4.5], [1980, 2.8], [1985, 1.7], [1990, 1.6], [2000, 1.5], [2005, 1.1], [2010, 1.2], [2015, 1.2], [2020, 0.84], [2023, 0.72], [2026, 0.72], [2027, 0.75]];

// 이름: names.json(GPT)이 있으면 시대·성별 가중 추첨, 없으면 기본 목록
export function randomName(L, gender, birthYear, surname = null) {
  const { D, rng } = L;
  const n = D.names;
  let sur = surname;
  let given = null;
  if (n?.surnames?.length && n.given) {
    sur ??= rng.weighted(n.surnames)?.name;
    const keys = Object.keys(n.given).map(Number).sort((a, b) => a - b);
    const k = keys.filter((x) => x <= birthYear).pop() ?? keys[0];
    const list = n.given[String(k)]?.[gender];
    if (Array.isArray(list) && list.length) given = rng.weighted(list)?.name;
  }
  sur ??= rng.pick(FALLBACK.surnames);
  given ??= rng.pick(FALLBACK[gender] ?? FALLBACK.m);
  return `${sur}${given}`;
}
export const surnameOf = (name) => (name ?? '').slice(0, 1);

// ---------- 부모 ----------
export function familyYearStart(L, triggers) {
  const { s, rng } = L;
  const y = s.year;
  const rel = s.relations;

  for (const p of rel.parents) {
    if (!p.alive) continue;
    const age = y - p.birth_year;
    if (rng.chance(parentDeathQ(L, age, y))) {
      p.alive = false;
      p.death_year = y;
      const who = p.role === 'father' ? '아버지' : '어머니';
      addLog(L, `${y}년, ${who}가 세상을 떠나셨어요`, 2, 'family');
      s.happiness = clamp(s.happiness - (s.profile.family.harmony >= 60 ? 20 : 15), 0, 100);
      triggers.set('parent_died', { role: p.role });
      if (p.semi) addSemi(L, `${who}의 사원증을 정리했어요`, 'family');
      if (rel.parents.every((x) => !x.alive)) inherit(L);
    }
  }
  // 부모 직업이 반도체면 8세까지 순간이 없을 때 자동 기록 (SYSTEMS 7)
  if (s.age === 8 && s.flags.parent_semi && !s.semi.some((m) => m.kind === 'family')) {
    const p = rel.parents.find((x) => x.semi);
    addSemi(L, `${p?.role === 'mother' ? '엄마' : '아빠'}의 방진복 사진`, 'family');
  }

  // 연애 시작 (행동 없이도 17~45세)
  if (!rel.partner && s.age >= 17 && s.age <= 45) {
    let p = clamp(0.1 + 0.1 * (s.stats.sociability - 50) / 50 + (hasTrait(s, 'social', '+') ? 0.05 : 0), 0.02, 0.3);
    // 맞선·중매 (life_sim 튜닝): 혼인 적령기에는 시대에 따라 소개가 많았음 → 1960년 이전 출생 결혼 비율 목표(90%)에 가깝게
    const M = lerpTable(MARRY_AGE[s.profile.gender], Math.min(y, 2026));
    if (s.age >= M - 4 && s.age <= M + 8) p += y < 1990 ? 0.2 : y < 2010 ? 0.08 : 0.04;
    if (rng.chance(p)) newPartner(L, s.age >= M - 4 && y < 1990 && rng.chance(0.5) ? 'matchmaking' : 'life');
  }
  const pt = rel.partner;
  // 프러포즈 (8.4) — 같은 연인에게는 두 번까지만 묻습니다 (v0.2: 같은 질문 반복 줄이기)
  if (pt && !pt.married && y - pt.met_year >= 1 && s.age >= 20 && pt.love >= 60 && (pt.asked ?? 0) < 2) {
    const M = lerpTable(MARRY_AGE[s.profile.gender], Math.min(y, 2026));
    const p = 0.05 + 0.35 * Math.exp(-(((s.age - M) / 6) ** 2));
    if (rng.chance(p)) { triggers.set('proposal', {}); pt.asked = (pt.asked ?? 0) + 1; }
  }
  // 출산 기회 (8.5)
  if (pt?.married && !s.flags.childfree && !s.flags.family_complete) {
    const wifeAge = s.profile.gender === 'f' ? s.age : y - pt.birth_year;
    if (wifeAge <= 44) {
      const f = clamp(lerpTable(TFR, y) / 2, 0.3, 1.5);
      let p = rel.children.length ? Math.min(0.6, 0.25 * f) : 0.5 * f;
      if (hasTrait(s, 'work_life', '-')) p *= 1.3;
      if (rng.chance(p)) triggers.set('baby_chance', { child: youngestChild(s)?.name });
    }
  }
  // 자녀 (8.6 추상 시뮬)
  for (const ch of rel.children) {
    const age = y - ch.birth_year;
    if (age === 17) triggers.set('child_17', { child: ch.name });
    if (age === 24 && !ch.job) childCareer(L, ch);
    if (age >= 27 && !ch.married && rng.chance(0.3)) ch.married = true;
    if (ch.married && (ch.kids ?? 0) < 3 && rng.chance(0.2)) {
      ch.kids = (ch.kids ?? 0) + 1;
      rel.grandchildren = (rel.grandchildren ?? 0) + 1;
      if (rel.grandchildren === 1) { addFlag(s, 'has_grandchild'); addLog(L, `${josa(ch.name, '이', '가')} 아이를 낳았어요. 첫 손주예요`, 2, 'family'); }
    }
  }
}

// 연말: 애정 변화, 이별·이혼
export function familyYearEnd(L) {
  const { s, rng } = L;
  const pt = s.relations.partner;
  if (!pt) return;
  pt.love = clamp(pt.love + (s.happiness >= 60 ? 2 : 0) - (hasTrait(s, 'work_life', '+') ? 3 : 0)
    - ((s.career.unemployed_years ?? 0) >= 2 ? 5 : 0) + rng.gauss(0, 5), 0, 100);
  if (pt.love < 20) {
    if (!pt.married && rng.chance(0.5)) breakup(L, '연인과 헤어졌어요');
    else if (pt.married && rng.chance(0.2 * (s.year < 1990 ? 0.3 : 1))) { addFlag(s, 'divorced'); breakup(L, `${josa(pt.name, '과', '와')} 이혼했어요`); }
  }
}

function breakup(L, text) {
  const { s } = L;
  addLog(L, text, 2, 'family');
  s.relations.partner = null;
  s.happiness = clamp(s.happiness - 8, 0, 100);
}

const SEMI_PARTNER_JOBS = ['반도체 엔지니어', '반도체 오퍼레이터', '반도체 협력사 직원'];
export function newPartner(L, metAt = 'life') {
  const { s, D, rng, W } = L;
  const y = s.year;
  const gender = s.profile.gender === 'm' ? 'f' : 'm';
  const by = Math.round(s.profile.birth_year + rng.gauss(0, 3));
  const myTouch = s.career.job ? D.jobById.get(s.career.job)?.touch : null;
  const pSemi = myTouch === 'core' ? 0.3 : myTouch === 'near' || myTouch === 'eco' ? 0.15 : W.nearFab(s.profile.region, y) ? 0.1 : 0.05;
  const semi = y >= 1970 && rng.chance(pSemi);
  let job;
  let company = null;
  if (semi) {
    job = rng.pick(SEMI_PARTNER_JOBS);
    company = W.nearbyFab(s.profile.region)?.id ?? null;
  } else {
    const key = String([2000, 1980, 1960, 1940].find((k) => by - 25 >= k) ?? 1940);
    const list = (D.char.parent_jobs[key] ?? []).filter((j) => !j.semi && (!j.since || j.since <= y) && (gender === 'f' || !j.mother_only));
    job = rng.weighted(list)?.name ?? '회사원';
  }
  const pt = {
    name: randomName(L, gender, by), gender, birth_year: by, job, company, semi, met_year: y, met_at: metAt,
    love: rng.float(50, 80), married: false,
    stats: { intelligence: clamp(rng.gauss(50, 15), 5, 95), dexterity: clamp(rng.gauss(50, 15), 5, 95), health: clamp(rng.gauss(50, 15), 5, 95) },
  };
  s.relations.partner = pt;
  addLog(L, `${josa(pt.name, '과', '와')} 사귀기 시작했어요`, 2, 'family');
  if (semi) addSemi(L, `${pt.name}의 사원증에 ${W.companyName(company) || '반도체 회사'} 로고가 있었어요`, 'family');
  return pt;
}

function inherit(L) {
  const { s, W, rng } = L;
  const PE = [0, 0.1, 0.6, 1.5, 4, 15];
  const e = W.econ(s.year);
  const amount = e.house_local * PE[s.profile.family.wealth] / (s.profile.family.siblings + 1) * Math.exp(rng.gauss(0, 0.3));
  if (amount > 0) {
    s.money.cash += amount;
    s.money.inherited = (s.money.inherited ?? 0) + amount;
    addLog(L, '부모님이 남기신 재산을 형제들과 나눴어요', 1, 'money');
  }
}

export const youngestChild = (s) => s.relations.children.reduce((a, c) => (!a || c.birth_year >= a.birth_year ? c : a), null);

// 자녀 취업 (8.6): 반도체 직군 확률
function childCareer(L, ch) {
  const { s, W, rng, D } = L;
  const y = s.year;
  let p = y <= 1985 ? 0.03 : y <= 2005 ? 0.05 : 0.07;
  const exp = s.career.exp ?? {};
  const touches = Object.keys(exp).map((id) => D.jobById.get(id)?.touch);
  if (touches.includes('core')) p += 0.1;
  else if (touches.includes('near') || touches.includes('eco')) p += 0.05;
  if (W.nearFab(s.profile.region, y)) p += 0.05;
  if (ch.encouraged === 'semi') p += 0.15;
  if (ch.encouraged === 'medic') p -= 0.05;
  if (ch.intelligence >= 70) p += 0.05;
  if (s.age >= 70 && s.semi.length === 0) p += 0.1;
  p = clamp(p, 0, 0.6);
  if (rng.chance(p)) {
    const jobId = ch.intelligence >= 65 ? rng.pick(['process_engineer', 'yield_engineer', 'circuit_designer', 'device_researcher']) : rng.pick(['operator', 'equipment_engineer']);
    const sector = jobId === 'circuit_designer' ? 'fabless' : rng.pick(['memory', 'foundry']);
    const local = W.alive(sector).filter((c) => c.regions.some((r) => r !== 'overseas'));
    const co = rng.weighted(local.length ? local : W.alive(sector), (c) => c.share * (1 + c.c) + 0.01);
    ch.job = D.jobById.get(jobId)?.name ?? jobId;
    ch.company = co?.id ?? null;
    ch.semi = true;
    const text = `${josa(ch.name, '이', '가')} ${co?.name ?? '반도체 회사'} ${josa(ch.job, '이', '가')} 되었어요`;
    addLog(L, text, 2, 'family');
    addSemi(L, text, 'family');
  } else {
    ch.job = ch.encouraged === 'medic' && ch.intelligence >= 70 ? '의사' : rng.pick(['회사원', '교사', '간호사', '개발자', '공무원', '자영업']);
    addLog(L, `${josa(ch.name, '이', '가')} ${josa(ch.job, '으로', '로')} 일을 시작했어요`, 1, 'family');
  }
}

// ---------- do partner:* · child:* ----------
export function doPartner(L, arg) {
  const { s, W } = L;
  const pt = s.relations.partner;
  switch (arg) {
    case 'new': if (!pt) newPartner(L, 'event'); return;
    case 'marry': {
      if (!pt) return;
      pt.married = true;
      pt.married_year = s.year;
      addFlag(s, 'married_once');
      addLog(L, `${josa(pt.name, '과', '와')} 결혼했어요`, 3, 'family');
      L.emit?.('family', { kind: 'married' });
      const e = W.econ(s.year);
      s.money.cash -= e.avg_wage * 0.5; // 예식·혼수
      giveIndependenceFund(L);
      return;
    }
    case 'wait': return;
    case 'breakup': if (pt) breakup(L, pt.married ? `${josa(pt.name, '과', '와')} 헤어졌어요` : '연인과 헤어졌어요'); return;
    default: warnOnce(`do-partner-${arg}`, `지원하지 않는 do: partner:${arg}`);
  }
}

// 독립·결혼 자금 (ECONOMY 4.3): 결혼 때 또는 30세에 한 번
export function giveIndependenceFund(L) {
  const { s, W } = L;
  if (s.flags.independence_fund) return;
  const k = [0, 0, 0.03, 0.1, 0.3, 1.0][s.profile.family.wealth] ?? 0;
  const amt = W.econ(s.year).house_local * k * (0.5 + s.profile.family.harmony / 100);
  s.flags.independence_fund = s.year;
  if (amt > 0) { s.money.cash += amt; addLog(L, '부모님이 독립 자금을 보태 주셨어요', 1, 'money'); }
}

export function doChild(L, arg, ctx) {
  const { s, rng } = L;
  const rel = s.relations;
  if (arg === 'add') {
    const pt = rel.partner;
    const gender = rng.chance(0.51) ? 'm' : 'f';
    const sur = s.profile.gender === 'm' ? surnameOf(s.profile.name) : surnameOf(pt?.name) || surnameOf(s.profile.name);
    const avg = (k) => ((s.stats[k] ?? 50) + (pt?.stats?.[k] ?? 50)) / 2;
    const ch = {
      name: randomName(L, gender, s.year, sur), gender, birth_year: s.year,
      intelligence: clamp(avg('intelligence') + rng.gauss(0, 12), 5, 95), dexterity: clamp(avg('dexterity') + rng.gauss(0, 12), 5, 95), health: clamp(avg('health') + rng.gauss(0, 12), 5, 95),
      edu: null, job: null, company: null, semi: false, encouraged: null, alive: true, married: false,
    };
    rel.children.push(ch);
    ctx.child = ch.name;
    addFlag(s, 'parent');
    addLog(L, `${josa(ch.name, '이', '가')} 태어났어요`, 3, 'family');
    L.emit?.('family', { kind: 'child', name: ch.name });
    return;
  }
  const target = rel.children.find((c) => c.name === ctx.child) ?? youngestChild(s);
  const enc = { encourage_semi: 'semi', encourage_medic: 'medic', free: 'free' }[arg];
  if (enc && target) { target.encouraged = enc; return; }
  warnOnce(`do-child-${arg}`, `지원하지 않는 do: child:${arg}`);
}

