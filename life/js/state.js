// 캐릭터 주사위와 새 인생 상태 (담당: Claude, DOM 없음) — character.json, SYSTEMS 2.1·3.1·8.1

import { STATS, AXES, clamp, addLog, addFlag } from './core.js';
import { streamSeed, STREAM } from './rng.js';
import { World } from './world.js';

export const SAVE_VERSION = 1;
export const decadeKey = (y) => (y < 1960 ? '1940' : y < 1980 ? '1960' : y < 2000 ? '1980' : '2000');

// 후보 하나 굴리기 (이름·태어난 해는 플레이어가 정함)
export function rollCandidate(D, birthYear, rng) {
  const C = D.char;
  const dec = decadeKey(birthYear);
  const gender = rng.chance(0.5) ? 'm' : 'f';
  const region = rng.weighted(C.regions, (r) => r.birth?.[dec] ?? 1);
  const jobs = (C.parent_jobs[dec] ?? []).filter((j) => !j.since || j.since <= birthYear);
  const father = rng.weighted(jobs.filter((j) => !j.mother_only));
  const mother = rng.weighted(jobs);
  const wealth = rng.weighted(C.family.wealth).level;
  const harmony = rng.int(C.family.harmony.min ?? 0, C.family.harmony.max ?? 100);
  const [sa, sb] = C.family.siblings[dec] ?? [0, 2];
  const siblings = rng.int(sa, sb);
  const pa = C.family.parent_age[dec] ?? { father: [26, 36], mother: [23, 33] };
  const R = C.stat_roll;
  const stats = {};
  for (const k of STATS) stats[k] = clamp(Math.round(rng.gauss(R.mean, R.sd)), R.min, R.max);
  if (harmony >= 70) stats.mental = clamp(stats.mental + 5, 0, 100);
  if (harmony < 30) stats.mental = clamp(stats.mental - 5, 0, 100);
  const traits = {};
  for (const a of AXES) traits[a] = clamp(rng.gauss(0, C.trait_roll.sd), -C.trait_roll.clamp, C.trait_roll.clamp);
  if (wealth <= 2) traits.thrift += 10;
  if (wealth === 5) traits.thrift -= 10;
  if (harmony >= 70) { traits.outlook += 8; traits.social += 5; }
  if (harmony < 30) { traits.outlook -= 8; traits.conform -= 8; }
  if (siblings >= 3) traits.social += 5;
  const talent = rng.pick(C.hidden_talents).id;
  return {
    gender, region: region.id, wealth, harmony, siblings, stats, traits, talent,
    father: { job: father?.name ?? '농사', semi: !!father?.semi, age: rng.int(pa.father[0], pa.father[1]) },
    mother: { job: mother?.name ?? '살림', semi: !!mother?.semi, age: rng.int(pa.mother[0], pa.mother[1]) },
  };
}

// 새 인생 상태 (저장되는 모양). 세계는 시드로 만들고 태어난 해까지 미리 돌립니다.
export function createLife(D, { name, birthYear, candidate: c, seed }) {
  const region = D.regions.get(c.region);
  const s = {
    v: SAVE_VERSION, seed, rng: { life: streamSeed(seed, STREAM.life) },
    world: World.create(D, seed),
    profile: {
      name, gender: c.gender, birth_year: birthYear, region: c.region, area: region?.area ?? null, birth_region: c.region,
      family: { father_job: c.father.job, mother_job: c.mother.job, wealth: c.wealth, harmony: c.harmony, siblings: c.siblings },
    },
    age: 0, year: birthYear,
    stats: { ...c.stats }, talent: { id: c.talent, revealed: false },
    traits: { ...c.traits }, traitsOn: {}, traitsYears: {},
    happiness: 60, condition: [], habits: [],
    education: { level: '무관', tier: null, major: null, major_group: null, track: null, stage: null, years_in: 0, dur: 0, next: null, grade: null, retries: 0, paused: null, started: false, stop: false },
    military: { status: 'none', type: null, start_year: null, end_year: null },
    career: {
      job: null, sub: null, company: null, client: null, employment: null, region: null, ladder: null, rank: 0, rank_years: 0, years: 0,
      total_years: 0, exp: {}, salary: 0, salary_mod: 0, reputation: 50, side_jobs: [], business: null, plateau: false, tries: 0,
      exec: false, exec_pending: false, leave: false, history: [], moves: 0, unemployed_years: 0, best_rank: 0, best_rep: 50, core_years: 0,
    },
    money: { cash: 0, debt: 0, houses: [], stocks: {}, last: null, networth: 0, pension: 0 },
    relations: {
      partner: null, children: [], grandchildren: 0,
      friends: clamp(40 + (c.stats.sociability - 50) / 5, 0, 100),
      parents: [
        { role: 'father', birth_year: birthYear - c.father.age, alive: true, job: c.father.job, semi: c.father.semi },
        { role: 'mother', birth_year: birthYear - c.mother.age, alive: true, job: c.mother.job, semi: c.mother.semi },
      ],
    },
    flags: {}, semi: [], titles: {}, log: [], seen: {}, again: {}, achievements: [],
    pendingTriggers: {}, yearFlags: {}, deferred: [], lastLotteryBig: -99,
    hist: [], dead: null, turn: null, retired: false,
  };
  if (c.father.semi || c.mother.semi) s.flags.parent_semi = birthYear;
  const L = { D, s, emit: null };
  addLog(L, `${birthYear}년, ${region?.name ?? ''}에서 태어났어요`, 3, 'life');
  if (c.father.semi || c.mother.semi) addFlag(s, 'parent_semi');
  return s;
}

// 저장본을 현재 형식으로 (모자란 필드는 새 인생 기본값으로)
export function hydrate(raw) {
  if (!raw || typeof raw !== 'object' || raw.v !== SAVE_VERSION || !raw.profile || !raw.world) return null;
  raw.flags ??= {}; raw.seen ??= {}; raw.again ??= {}; raw.titles ??= {}; raw.achievements ??= [];
  raw.pendingTriggers ??= {}; raw.yearFlags ??= {}; raw.deferred ??= []; raw.hist ??= [];
  return raw;
}

