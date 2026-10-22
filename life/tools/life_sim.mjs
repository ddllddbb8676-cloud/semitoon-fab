// 세미툰 라이프 헤드리스 시뮬레이터 — 게임과 같은 엔진(life/js/)으로 인생 N개를 돌려 밸런스를 봅니다 (의존성 없음)
//
// 사용법 (저장소 루트에서):
//   node life/tools/life_sim.mjs                  1,000명 (1940~2026년생 고르게), 선택은 무작위
//   node life/tools/life_sim.mjs 300 --seed 7     인원·시드
//   node life/tools/life_sim.mjs 1 --story        한 사람의 연표를 자세히
//   node life/tools/life_sim.mjs --birth 1960-1969   태어난 해 범위
//   node life/tools/life_sim.mjs --data <dir>     다른 데이터 폴더(예: GPT 콘텐츠를 얹은 사본)로
//   node life/tools/life_sim.mjs --default        무작위 대신 늘 기본 선택(default)
//   node life/tools/life_sim.mjs --ms             인생에 남는 사건(major·drama·milestones)마다 뜬 인생 비율 (가중치 다듬기용)
//
// 목표치는 life/docs/SYSTEMS.md 14장. 엔진이 터지면(crash) 종료 코드 1.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadData } from '../js/data.js';
import { attach, beginYear, nextEvent, present, skipEvent, chooseEvent, finishYear, createLife, rollCandidate, snapshot, review, hydrate } from '../js/engine.js';
import { hire, workRegion } from '../js/career.js';
import { Rng } from '../js/rng.js';
import { statusOf, warnedKeys, eduIdx } from '../js/core.js';
import { won } from '../js/format.js';
import { hasMeaningful } from '../js/chronicle.js';
import { expandJobs } from './jobs_expand.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? args[i + 1] : def; };
const N = Number(args.find((a) => /^\d+$/.test(a)) ?? 1000);
const SEED = Number(opt('--seed', 1));
const DATA = resolve(opt('--data', fileURLToPath(new URL('../data/', import.meta.url))));
const [B0, B1] = opt('--birth', '1940-2026').split('-').map(Number);
const STORY = args.includes('--story');
const MS_REPORT = args.includes('--ms');
// 인생에 남는 사건 = 큰 줄기 파일의 사건 (생애 단계별 개수를 셈)
const MILESTONE_FILES = new Set(['events/major.json', 'events/drama.json', 'events/milestones.json']);
const STAGE_RANGES = [['infant', '유아', 1, 6], ['child', '어린이', 7, 12], ['teen', '청소년', 13, 19], ['young', '청년', 20, 34], ['middle', '중년', 35, 59], ['senior', '노년', 60, 999]];
const stageAt = (age) => STAGE_RANGES.find(([, , a, b]) => age >= a && age <= b)?.[0] ?? 'infant';
const DEFAULT = args.includes('--default');

const read = async (p) => { const f = join(DATA, p); return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null; };
const list = async (dir) => {
  const d = join(DATA, dir);
  if (!existsSync(d)) return null;
  return readdirSync(d).map((n) => (statSync(join(d, n)).isDirectory() ? `${n}/` : n));
};

const D = await loadData(read, list);
// 세부 직업 펼치기가 tools/jobs_expand.mjs와 같은지 (데이터 폴더를 바꾸지 않았을 때만)
if (!args.includes('--data')) {
  const ref = expandJobs().map((j) => j.id).join('|');
  if (ref !== D.subJobs.map((j) => j.id).join('|')) { console.error('세부 직업 펼치기 결과가 jobs_expand.mjs와 달라요'); process.exit(1); }
}

const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(1)}%` : '-');
const avg = (arr) => (arr.length ? arr.reduce((x, y) => x + y, 0) / arr.length : 0);
const stats = {
  crashes: [], lives: 0, years: 0, events: 0, big: 0, eventCount: {}, semiAny: 0, semiReal: 0, firstSemiAge: [], lifespan: {},
  firstJobGroup: {}, firstJobTouch: {}, at40: 0, at40n: 0, unemployedYears: [], married: {}, titles: {}, scores: [], saveBytes: 0,
  deathCause: {}, world26: [], world27: [], everEmployed: 0, rescue: 0, exec: 0, engineers: 0, bujang: 0, traitAt40: 0, traitAt40n: 0,
  bigBy: {}, bigId: {}, pay: [], repeatViol: {}, repeatTrig: 0, laterMade: 0, laterFired: 0, meaningful: 0, meaningfulN: 0, meaningfulNoWorld: 0,
  engGrad: 0, engGradSemi: 0, phd: 0, phdRnd: 0, mismatch: [],
  // 속도·밀도 (v0.3): 단계별 큰 줄기 사건, 6~80세 해마다 사건·의미 있는 줄, 큰 사건 수
  msStage: {}, srcBy: {}, cover: 0, coverN: 0, coverNoWorld: 0, coverEvent: 0, msEvents: 0, msLife: {}, perLife: [], bigLife: [],
};
const SEMI_SECTORS = ['memory', 'foundry', 'fabless', 'equipment_global', 'equipment_korea', 'materials', 'packaging'];
const RND_ROLES = ['fab_td', 'rnd_adv', 'rnd_future', 'rnd_adv_pkg', 'rnd_future_mat', 'eco_gov_lab', 'eco_prof', 'mat_rnd', 'des_arch', 'eq_proc', 'eq_app'];

// 한 해 연봉 기록 (연봉 보고서용)
function recordPay(L, extra) {
  const s = L.s;
  const p = s.money.last_pay;
  if (!p || p.employment === 'owner') return;
  const co = L.W.co(p.company);
  const j = D.jobById.get(p.job);
  (extra ?? stats.pay).push({
    y: s.year, age: s.age, by: s.profile.birth_year, pay: p.base + p.bonus, base: p.base, bonus: p.bonus, group: j?.group, touch: j?.touch,
    edu: eduIdx(s.education.level), big: !!co && co.attrs.salary >= 4 && co.country === 'KR', sector: co?.sector ?? null, years: p.years, total: p.total,
    avg: L.W.econ(s.year).avg_wage, sub: p.sub,
  });
}

function runLife(i) {
  const seed = SEED * 100003 + i;
  const rng = new Rng(seed * 7 + 3);
  const by = rng.int(B0, B1);
  const cand = rollCandidate(D, by, rng);
  let s = createLife(D, { name: `${rng.pick(['김', '이', '박', '최'])}세미`, birthYear: by, candidate: cand, seed });
  let L = attach(D, s, () => {});
  const story = [];
  const occ = {};
  const ms = {};      // 단계 → 큰 줄기 사건 수
  const msSeen = new Set();
  let nEv = 0;
  let nBig = 0;
  for (let guard = 0; guard < 140; guard++) {
    beginYear(L);
    for (let k = 0; k < 12; k++) {
      const inst = nextEvent(L, 1);
      if (!inst) break;
      const view = present(L, inst);
      if (!view) { skipEvent(L, inst); continue; }
      const pick = DEFAULT ? view.defaultIndex : view.choices[Math.floor(rng.next() * view.choices.length)].index;
      const out = chooseEvent(L, inst, pick);
      stats.events++;
      nEv++;
      if (view.big) nBig++;
      { const k = inst.trigger === 'later' ? 'later' : inst.trigger === 'goto' ? 'goto' : inst.trigger === 'again' ? 'again' : inst.trigger ? '트리거' : D.eventById.get(view.id)?.forced ? '강제' : '추첨'; stats.srcBy[k] = (stats.srcBy[k] ?? 0) + 1; }
      const evFile = D.eventById.get(view.id)?._file;
      if (MILESTONE_FILES.has(evFile)) {
        const st = stageAt(L.s.age);
        ms[st] = (ms[st] ?? 0) + 1;
        stats.msEvents++;
        if (!msSeen.has(view.id)) { msSeen.add(view.id); stats.msLife[view.id] = (stats.msLife[view.id] ?? 0) + 1; }
      }
      if (view.big) { stats.big++; const k = inst.trigger === 'later' ? 'later' : inst.trigger ? '트리거' : D.eventById.get(view.id)?.forced ? '강제' : '추첨'; stats.bigBy[k] = (stats.bigBy[k] ?? 0) + 1; stats.bigId[view.id] = (stats.bigId[view.id] ?? 0) + 1; }
      stats.eventCount[view.id] = (stats.eventCount[view.id] ?? 0) + 1;
      if (inst.trigger === 'later') stats.laterFired++;
      // 반복 검사: 트리거에 묶이지 않은 사건이 again·goto 없이 두 번 뜨면 위반 (repeatable 제외)
      const ev = D.eventById.get(view.id);
      if (ev && !ev.trigger && !['again', 'goto'].includes(inst.trigger)) {
        occ[view.id] = (occ[view.id] ?? 0) + 1;
        if (occ[view.id] > 1 && !ev.repeatable) stats.repeatViol[view.id] = (stats.repeatViol[view.id] ?? 0) + 1;
      } else if (ev?.trigger && occ[`t:${view.id}`]) stats.repeatTrig++;
      if (ev?.trigger) occ[`t:${view.id}`] = 1;
      if (STORY) story.push(`  [${view.later ? '그때 그 선택' : view.big ? '갈림길' : '사건'}] ${view.text}\n     → ${view.choices.find((c) => c.index === pick)?.label}: ${out.result}${out.chips?.length ? `\n     [${out.chips.map((c) => (c.money !== undefined ? `${c.label} ${c.money > 0 ? '+' : ''}${won(c.money, L.s.year)}` : c.label)).join(' · ')}]` : ''}`);
    }
    stats.years++;
    if (L.s.age === 40) {
      stats.at40n++;
      if (['employed', 'owner'].includes(statusOf(L.s))) stats.at40++;
      stats.traitAt40n++;
      if (Object.keys(L.s.traitsOn).length) stats.traitAt40++;
    }
    const { dead } = finishYear(L);
    recordPay(L);
    if (L.s.age >= 6 && L.s.age <= 75) {
      stats.meaningfulN++;
      if (hasMeaningful(L.s)) stats.meaningful++;
      if (L.s.log.some((x) => x.year === L.s.year && x.importance >= 1 && x.kind !== 'quiet' && x.kind !== 'world')) stats.meaningfulNoWorld++;
    }
    // 6~80세: 사건이 있었던 해 / 사건이나 의미 있는 시스템 줄(가족·근속·재산·업황·진학 등)이 있는 해
    if (L.s.age >= 6 && L.s.age <= 80) {
      const yl = L.s.log.filter((x) => x.year === L.s.year);
      const hadEvent = yl.some((x) => x.kind === 'event' || x.kind === 'choice');
      stats.coverN++;
      if (hadEvent) stats.coverEvent++;
      if (hasMeaningful(L.s)) stats.cover++;
      if (hadEvent || yl.some((x) => x.importance >= 1 && !['quiet', 'world'].includes(x.kind))) stats.coverNoWorld++;
    }
    // 가끔 저장·불러오기 왕복 (이어 하기 검사)
    if (i % 25 === 0 && L.s.age % 17 === 0) {
      const json = JSON.stringify(snapshot(L));
      s = hydrate(JSON.parse(json));
      L = attach(D, s, () => {});
    }
    if (dead || L.s.year >= 2150) break;
  }
  // 단계를 끝까지 산 인생만 그 단계 통계에 넣음 (노년은 75세까지 산 인생)
  const lastAge = L.s.dead?.age ?? L.s.age;
  for (const [st, , , b] of STAGE_RANGES) {
    if (lastAge < Math.min(b, 75)) continue;
    (stats.msStage[st] ??= []).push(ms[st] ?? 0);
  }
  stats.perLife.push(nEv);
  stats.bigLife.push(nBig);
  return { L, story };
}

const t0 = Date.now();
for (let i = 0; i < N; i++) {
  let res;
  try { res = runLife(i); } catch (e) { stats.crashes.push({ i, msg: String(e?.stack ?? e).split('\n').slice(0, 4).join('\n') }); continue; }
  const { L, story } = res;
  const s = L.s;
  stats.lives++;
  let rv;
  try { rv = review(L); } catch (e) { stats.crashes.push({ i, msg: `review: ${String(e?.stack ?? e).split('\n').slice(0, 4).join('\n')}` }); continue; }
  const bytes = JSON.stringify(snapshot(L)).length;
  stats.saveBytes = Math.max(stats.saveBytes, bytes);
  stats.laterMade += s.later_n ?? 0;
  // 학력·전공 맞춤: 졸업 뒤 첫 직장
  const jobsAfter = (y0) => [...s.career.history.map((h) => ({ job: h.job, sub: h.sub, company: h.company, from: h.from })), ...(s.career.job ? [{ job: s.career.job, sub: s.career.sub, company: s.career.company, from: s.career.since }] : [])]
    .filter((h) => h.from >= y0).sort((a, b) => a.from - b.from)[0];
  const g = s.education.grad ?? {};
  if (['semi', 'materials', 'other_eng'].includes(s.education.major_group) && g['대졸']) {
    const fj = jobsAfter(g['대졸']);
    if (fj) {
      stats.engGrad++;
      const j = D.jobById.get(fj.job);
      const co = L.W.co(fj.company);
      const role = fj.sub ? D.subById.get(fj.sub)?.role : null;
      if ((j?.touch === 'core' && (j.group === '현장' || j.group === '사무') && (!co || SEMI_SECTORS.includes(co.sector))) || j?.ladder === 'academic' || RND_ROLES.includes(role)) stats.engGradSemi++;
      else if (stats.mismatch.length < 6 && eduIdx(s.education.level) >= 4) stats.mismatch.push(`${s.education.level} ${s.education.major} → ${fj.sub ?? fj.job}`);
    }
  }
  if (g['박사']) {
    const fj = jobsAfter(g['박사']);
    if (fj) {
      stats.phd++;
      const j = D.jobById.get(fj.job);
      const role = fj.sub ? D.subById.get(fj.sub)?.role : null;
      if (['research', 'academic'].includes(j?.ladder) || RND_ROLES.includes(role)) stats.phdRnd++;
    }
  }
  if (s.semi.length) stats.semiAny++;
  const real = s.semi.filter((m) => m.kind !== 'everyday');
  if (real.length) { stats.semiReal++; stats.firstSemiAge.push(real[0].age); }
  if (s.flags.late_semi) stats.rescue++;
  const tl = L.W.ws.timeline;
  const cnt = (from, to, kinds) => tl.filter((t) => t.year >= from && t.year <= to && kinds.includes(t.kind) && (t.kind !== 'leader' || t.upset)).length;
  if ((s.dead?.year ?? s.year) >= 2026) stats.world26.push([cnt(1940, 2026, ['bankrupt']), cnt(1940, 2026, ['leader']), cnt(1940, 2026, ['acquired'])]);
  if ((s.dead?.year ?? s.year) >= 2100) stats.world27.push([cnt(2027, 2100, ['bankrupt']), cnt(2027, 2100, ['acquired'])]);
  const dec = `${Math.floor(s.profile.birth_year / 10) * 10}년대생`;
  (stats.lifespan[dec] ??= []).push(s.dead?.age ?? s.age);
  const fj = s.career.first_job;
  if (fj) {
    stats.everEmployed++;
    const j = D.jobById.get(fj);
    stats.firstJobGroup[j.group] = (stats.firstJobGroup[j.group] ?? 0) + 1;
    stats.firstJobTouch[j.touch] = (stats.firstJobTouch[j.touch] ?? 0) + 1;
  }
  stats.unemployedYears.push(s.hist.filter((h) => h.st === 'unemployed').length);
  const cohort = s.profile.birth_year < 1960 ? '1960년 이전생' : s.profile.birth_year >= 1990 ? '1990년 이후생' : '1960~1989년생';
  stats.married[cohort] ??= [0, 0];
  stats.married[cohort][1]++;
  if (s.flags.married_once) stats.married[cohort][0]++;
  if (s.flags.married_once) { stats.widowN = (stats.widowN ?? 0) + 1; if (s.flags.widowed) stats.widow = (stats.widow ?? 0) + 1; if (s.flags.widowed && s.relations.partner) stats.rewed = (stats.rewed ?? 0) + 1; }
  stats.titles[rv.title] = (stats.titles[rv.title] ?? 0) + 1;
  stats.scores.push(rv.score);
  stats.deathCause[s.dead?.cause ?? '살아 있음'] = (stats.deathCause[s.dead?.cause ?? '살아 있음'] ?? 0) + 1;
  const ladders = [s.career.ladder, ...s.career.history.map((h) => D.jobById.get(h.job)?.ladder)];
  if (s.education.level === '대졸' || s.education.level === '석사' || s.education.level === '박사') {
    if (ladders.includes('corporate') || ladders.includes('research')) {
      stats.engineers++;
      const br = s.career.best_ranks ?? {};
      if ((br.corporate ?? 0) >= 4 || (br.research ?? 0) >= 3) stats.bujang++;
      if (s.flags.became_exec || s.career.exec) stats.exec++;
    }
  }
  if (STORY) {
    console.log(`\n=== ${s.profile.name} (${s.profile.birth_year}년생, ${s.profile.gender === 'm' ? '남' : '여'}, ${D.regions.get(s.profile.birth_region)?.name}) 시드 ${s.seed}`);
    const money = new Map(s.hist.map((h) => [h.y, h]));
    for (const x of s.log) if (x.importance >= 1) console.log(`${x.year} (${x.age}세) ${x.later ? `[그때 그 선택… ${x.later}] ` : ''}${x.text}`);
    console.log('\n--- 돈 (평균 연봉 대비) ---');
    console.log(s.hist.filter((h) => h.y % 5 === 0).map((h) => `${h.y} 순자산 ${h.nw} 현금 ${h.cash} 빚 ${h.debt} 소득 ${h.inc} 행복 ${h.h}`).join('\n'));
    void money;
    console.log('\n--- 사건 ---');
    console.log(story.join('\n'));
    console.log('\n--- 되돌아보기 ---');
    console.log(JSON.stringify({ lastLine: rv.lastLine, title: rv.title, ribbons: rv.ribbons, score: rv.score, bars: rv.bars, traits: rv.traits, semi: rv.semi.map((x) => `${x.year} ${x.text} (${x.kindName})`), industry: rv.industry.map((x) => x.text), numbers: rv.numbers, summary: rv.summary }, null, 1));
  }
}
// 연봉 보정용 가상 경력 (같은 엔진으로 해마다 진행): 공대 대졸이 대기업 반도체 회사에 엔지니어로 들어간 사람들
// - mid: 1985~1995년생, 23~28세 입사 → 2024년 연봉 / old: 1995년 신입 (1966~1972년생)
function calibCareer(i, { by, hireYear, until, out }) {
  const rng = new Rng(777 + i * 13 + SEED);
  const cand = rollCandidate(D, by, rng);
  const s = createLife(D, { name: '보정', birthYear: by, candidate: cand, seed: 5000 + i + SEED * 7 });
  Object.assign(s.education, { level: rng.chance(0.25) ? '석사' : '대졸', major: rng.pick(['electronics', 'materials', 'chem_eng', 'physics']), major_group: 'semi', started: true, tier: rng.int(2, 5) });
  s.military.status = 'done';
  s.year = hireYear - 1;
  s.age = hireYear - 1 - by;
  const L = attach(D, s, () => {});
  beginYear(L);
  L.s.turn.queue = L.s.turn.queue.filter((q) => q.trigger !== 'job_search');
  const co = rng.pick(['samsong', 'hynixu'].map((id) => L.W.co(id)).filter((c) => c?.on && !c.gone));
  if (!co) return;
  hire(L, { job: rng.pick(['process_engineer', 'process_engineer', 'equipment_engineer', 'yield_engineer', 'quality_engineer']), company: co.id, employment: 'regular', region: workRegion(L, co) }, { quiet: true });
  for (let g = 0; g < 60; g++) {
    for (let k = 0; k < 12; k++) {
      const inst = nextEvent(L, 1);
      if (!inst) break;
      const view = present(L, inst);
      if (!view) { skipEvent(L, inst); continue; }
      chooseEvent(L, inst, view.defaultIndex);
    }
    finishYear(L);
    recordPay(L, out);
    if (L.s.dead || L.s.year >= until) break;
    beginYear(L);
  }
}
const calib = { mid: [], old: [] };
if (N >= 300 && !STORY) {
  for (let i = 0; i < 120; i++) {
    const by = 1985 + (i % 11);
    try { calibCareer(i, { by, hireYear: by + 23 + (i % 6), until: 2024, out: calib.mid }); } catch (e) { stats.crashes.push({ i: `calib${i}`, msg: String(e?.stack ?? e).split('\n').slice(0, 4).join('\n') }); }
  }
  for (let i = 0; i < 60; i++) {
    try { calibCareer(1000 + i, { by: 1966 + (i % 7), hireYear: 1995, until: 1995, out: calib.old }); } catch (e) { stats.crashes.push({ i: `calib${i}`, msg: String(e?.stack ?? e).split('\n').slice(0, 4).join('\n') }); }
  }
}
const ms = Date.now() - t0;

console.log(`세미툰 라이프 시뮬 — ${N}명 (${B0}~${B1}년생, 선택 ${DEFAULT ? '기본값' : '무작위'}, 시드 ${SEED}) · ${(ms / 1000).toFixed(1)}초`);
console.log(`데이터: 사건 ${D.events.length}개, 기본 직업 ${D.jobs.length}개, 세부 직업 ${D.subJobs.length}개${D.optionalLoaded.length ? ` · 선택 파일 ${D.optionalLoaded.join(', ')}` : ' · GPT 선택 파일 없음'}`);
console.log(`\n터짐(crash): ${stats.crashes.length}`);
for (const c of stats.crashes.slice(0, 5)) console.log(`  #${c.i} ${c.msg}`);
console.log(`반도체 순간 1개↑: ${pct(stats.semiAny, stats.lives)} (사망 시 '일상' 카드 제외하면 ${pct(stats.semiReal, stats.lives)}, 노년 구조 사건으로 만난 사람 ${pct(stats.rescue, stats.lives)})`);
const fs = stats.firstSemiAge;
console.log(`  첫 순간: 30세까지 ${pct(fs.filter((a) => a <= 30).length, stats.lives)} · 50세까지 ${pct(fs.filter((a) => a <= 50).length, stats.lives)} · 72세까지 ${pct(fs.filter((a) => a <= 72).length, stats.lives)}  (목표 ≥55% / ≥80% / ≥97%)`);
console.log('\n평균 수명 (태어난 연대별, 목표 1940 76 · 1960 80 · 1980 84 · 2000 87 · 2020 89)');
for (const k of Object.keys(stats.lifespan).sort()) console.log(`  ${k}  ${avg(stats.lifespan[k]).toFixed(1)}세  (${stats.lifespan[k].length}명)`);
console.log(`\n6~75세 중 의미 있는 줄(사건·연봉·가족·업황 등)이 있는 해: ${pct(stats.meaningful, stats.meaningfulN)} (세상 소식 줄을 빼면 ${pct(stats.meaningfulNoWorld, stats.meaningfulN)})`);
console.log(`\n한 해 평균 사건 ${(stats.events / stats.years).toFixed(2)}개 · 인생당 사건 ${(stats.events / stats.lives).toFixed(1)}개 (큰 사건 ${(stats.big / stats.lives).toFixed(1)}개)  (v0.3 목표 40~60 / 14~20: 결혼·출산·첫 직장·진학 같은 진짜 갈림길이라 줄이지 않음)`);
{
  const q = (arr, p) => { const a = [...arr].sort((x, y) => x - y); return a.length ? a[Math.min(a.length - 1, Math.floor(p * a.length))] : 0; };
  console.log(`  사건 출처(인생당): ${Object.entries(stats.srcBy).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${(n / Math.max(1, stats.lives)).toFixed(1)}`).join(' · ')}`);
  console.log(`  인생당 사건 분포: 하위 10% ${q(stats.perLife, 0.1)} · 중앙 ${q(stats.perLife, 0.5)} · 상위 10% ${q(stats.perLife, 0.9)} · 큰 사건 중앙 ${q(stats.bigLife, 0.5)}`);
  console.log(`  6~80세 중 사건이 있는 해 ${pct(stats.coverEvent, stats.coverN)} · 사건이나 의미 있는 시스템 줄이 있는 해 ${pct(stats.coverNoWorld, stats.coverN)} (세상 소식까지 ${pct(stats.cover, stats.coverN)})`);
  console.log(`  인생에 남는 사건(major·drama·milestones) 인생당 ${(stats.msEvents / Math.max(1, stats.lives)).toFixed(1)}개 — 단계를 끝까지 산 인생 기준 (목표 단계마다 2~3개↑)`);
  for (const [st, name] of STAGE_RANGES) {
    const arr = stats.msStage[st] ?? [];
    if (!arr.length) continue;
    console.log(`    ${name.padEnd(4)} 평균 ${avg(arr).toFixed(1)}개 · 2개↑ ${pct(arr.filter((n) => n >= 2).length, arr.length)} · 0개 ${pct(arr.filter((n) => !n).length, arr.length)} (${arr.length}명)`);
  }
}
console.log(`  큰 사건 출처(인생당): ${Object.entries(stats.bigBy).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${(n / Math.max(1, stats.lives)).toFixed(1)}`).join(' · ')}`);
console.log(`  큰 사건 많이 뜬 것(인생당): ${Object.entries(stats.bigId).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, n]) => `${k} ${(n / Math.max(1, stats.lives)).toFixed(2)}`).join(' · ')}`);
console.log(`\n첫 직장 (일해 본 사람 ${pct(stats.everEmployed, stats.lives)})`);
for (const [g, n] of Object.entries(stats.firstJobGroup).sort((a, b) => b[1] - a[1])) console.log(`  ${g.padEnd(4)} ${pct(n, stats.everEmployed)}`);
console.log(`  반도체 접점: ${Object.entries(stats.firstJobTouch).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} ${pct(n, stats.everEmployed)}`).join(' · ')}`);
console.log(`\n40세에 일하는 중(재직·자영업): ${pct(stats.at40, stats.at40n)} · 40세에 특징 1개↑: ${pct(stats.traitAt40, stats.traitAt40n)} (목표 70~90%)`);
console.log(`평생 무직 기간 평균 ${avg(stats.unemployedYears).toFixed(1)}년 (목표 ≤ 3년)`);
console.log(`공대 대졸↑ 졸업 뒤 첫 직장이 반도체 현장·연구·사무·교수: ${pct(stats.engGradSemi, stats.engGrad)} (${stats.engGrad}명) · 박사 졸업 뒤 첫 직장이 R&D(연구직·교수·국책연): ${pct(stats.phdRnd, stats.phd)} (${stats.phd}명)`);
if (stats.mismatch.length) console.log(`  석사↑ 공대생이 다른 길로 간 예: ${stats.mismatch.join(' / ')}`);
console.log(`대졸 회사원·연구원 부장↑ ${pct(stats.bujang, stats.engineers)} · 임원 ${pct(stats.exec, stats.engineers)} (목표 30~45% / 3~8%)`);
console.log(`결혼: ${Object.entries(stats.married).map(([k, [a, b]]) => `${k} ${pct(a, b)}`).join(' · ')}`);
console.log(`  사별: 결혼한 사람 중 배우자를 먼저 보낸 비율 ${pct(stats.widow ?? 0, stats.widowN ?? 0)} · 그중 새 인연 ${pct(stats.rewed ?? 0, stats.widow ?? 0)}`);
console.log(`인생 점수 평균 ${avg(stats.scores).toFixed(0)} · 가장 큰 저장본 ${(stats.saveBytes / 1024).toFixed(0)}KB`);
const w26 = (i) => avg(stats.world26.map((x) => x[i])).toFixed(2);
const w27 = (i) => avg(stats.world27.map((x) => x[i])).toFixed(2);
console.log(`세계(판당): 2026년까지 파산 ${w26(0)} · 1위 교체(예정된 역사 추월 제외) ${w26(1)} · 인수 ${w26(2)} (${stats.world26.length}판, 목표 0~2 / 0~2) · 2027~2100 파산 ${w27(0)} · 인수 ${w27(1)} (${stats.world27.length}판, 목표 3~8 / 3~8)`);
console.log(`사인: ${Object.entries(stats.deathCause).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pct(v, stats.lives)}`).join(' · ')}`);
console.log(`대표 칭호: ${Object.entries(stats.titles).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k} ${pct(v, stats.lives)}`).join(' · ')}`);
// 연봉 보고서
const med = (arr) => { if (!arr.length) return null; const a = [...arr].sort((x, y) => x - y); return a[a.length >> 1]; };
const man = (v, y) => (v === null ? '   -   ' : won(v, y).padStart(9));
console.log('\n연봉 중앙값 (명목, 성과급 포함, 자영업 제외) — 나이별 · 태어난 연대별');
console.log(`  ${'연대'.padEnd(8)}${[30, 40, 50].map((a) => `${a}세`.padStart(10)).join('')}   (평균 임금 대비)`);
for (let dec = 1940; dec <= 2000; dec += 10) {
  const row = [30, 40, 50].map((a) => { const r = stats.pay.filter((p) => p.age === a && p.by >= dec && p.by < dec + 10); return { v: med(r.map((p) => p.pay)), y: med(r.map((p) => p.y)), x: med(r.map((p) => p.pay / p.avg)), n: r.length }; });
  console.log(`  ${`${dec}년대생`.padEnd(8)}${row.map((c) => man(c.v, c.y ?? 2026).padStart(10)).join('')}   ${row.map((c) => (c.x === null ? '-' : `×${c.x.toFixed(2)}`)).join(' ')}`);
}
console.log('연봉 중앙값 — 직업 그룹별 (그 해 평균 임금 대비 배수)');
for (const gname of ['현장', '사무', '기능직', '서비스', '생태계', '일반']) {
  const row = [30, 40, 50].map((a) => { const r = stats.pay.filter((p) => p.age === a && p.group === gname); return r.length ? `×${med(r.map((p) => p.pay / p.avg)).toFixed(2)} (${r.length})` : '-'; });
  console.log(`  ${gname.padEnd(4)} ${row.map((x) => x.padStart(12)).join('')}`);
}
const isEng24 = (p) => p.y === 2024 && p.by >= 1985 && p.by <= 1995 && p.edu >= 3 && p.big && ['memory', 'foundry'].includes(p.sector) && p.touch === 'core' && p.group === '현장';
const isFresh95 = (p) => p.y === 1995 && p.edu >= 3 && p.big && p.total === 0;
const show = (label, list, y, goal) => {
  const v = med(list.map((p) => p.pay));
  const b = med(list.map((p) => p.base));
  const lo = list.length >= 4 ? [...list].sort((a, c) => a.pay - c.pay)[Math.floor(list.length / 4)].pay : null;
  const hi = list.length >= 4 ? [...list].sort((a, c) => a.pay - c.pay)[Math.floor((3 * list.length) / 4)].pay : null;
  console.log(`${label}: ${v === null ? '-' : won(v, y)}${b !== null ? ` (기본급 ${won(b, y)}${lo !== null ? `, 사분위 ${won(lo, y)}~${won(hi, y)}` : ''})` : ''} · ${list.length}명 · 목표 ${goal}`);
};
show('대기업 반도체 대졸↑ 엔지니어(1985~1995년생) 2024년 연봉 중앙값 — 보정 표본', calib.mid.filter(isEng24), 2024, '9천만~1.3억');
show('  같은 조건, 무작위 인생 표본', stats.pay.filter(isEng24), 2024, '9천만~1.3억');
show('1995년 대기업 대졸↑ 신입 연봉 중앙값 — 보정 표본', calib.old.filter(isFresh95), 1995, '약 2천만');
show('  같은 조건, 무작위 인생 표본', stats.pay.filter(isFresh95), 1995, '약 2천만');

const viol = Object.entries(stats.repeatViol).sort((a, b) => b[1] - a[1]);
console.log(`\n반복 검사: repeatable 아닌 사건이 한 인생에 두 번 이상 뜬 경우 ${viol.reduce((a, [, n]) => a + n, 0)}건${viol.length ? ` — ${viol.slice(0, 8).map(([id, n]) => `${id} ${n}`).join(', ')}` : ''} (트리거 사건 재발생 ${stats.repeatTrig}건은 허용)`);
console.log(`나중에 돌아오는 결과(later): 예약 ${stats.laterMade}건 · 발동 ${stats.laterFired}건 (인생당 ${(stats.laterFired / Math.max(1, stats.lives)).toFixed(2)}건)`);

if (MS_REPORT) {
  console.log('\n인생에 남는 사건별 — 한 번이라도 뜬 인생 비율 (milestones.json)');
  const rows = D.events.filter((e) => e._file === 'events/milestones.json').map((e) => [e.id, stats.msLife[e.id] ?? 0, e.weight ?? 0, e.trigger ?? '']);
  for (const [id, n, w, t] of rows.sort((a, b) => b[1] - a[1])) console.log(`  ${pct(n, stats.lives).padStart(6)}  ${id}${w ? ` (w${w})` : ''}${t ? ` [${t}]` : ''}`);
}
console.log('\n가장 자주 뜬 사건 10');
for (const [id, n] of Object.entries(stats.eventCount).sort((a, b) => b[1] - a[1]).slice(0, 10)) console.log(`  ${String(n).padStart(6)}  ${id}`);
const w = warnedKeys();
if (w.length) console.log(`\n엔진 알림 (지원 안 하는 키 등): ${w.join(', ')}`);
if (stats.crashes.length) process.exit(1);
