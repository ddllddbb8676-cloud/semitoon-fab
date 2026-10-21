// 세미툰 라이프 헤드리스 시뮬레이터 — 게임과 같은 엔진(life/js/)으로 인생 N개를 돌려 밸런스를 봅니다 (의존성 없음)
//
// 사용법 (저장소 루트에서):
//   node life/tools/life_sim.mjs                  1,000명 (1940~2026년생 고르게), 선택은 무작위
//   node life/tools/life_sim.mjs 300 --seed 7     인원·시드
//   node life/tools/life_sim.mjs 1 --story        한 사람의 연표를 자세히
//   node life/tools/life_sim.mjs --birth 1960-1969   태어난 해 범위
//   node life/tools/life_sim.mjs --data <dir>     다른 데이터 폴더(예: GPT 콘텐츠를 얹은 사본)로
//   node life/tools/life_sim.mjs --default        무작위 대신 늘 기본 선택(default)
//
// 목표치는 life/docs/SYSTEMS.md 14장. 엔진이 터지면(crash) 종료 코드 1.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadData } from '../js/data.js';
import { attach, beginYear, nextEvent, present, skipEvent, chooseEvent, finishYear, createLife, rollCandidate, snapshot, review, hydrate } from '../js/engine.js';
import { Rng } from '../js/rng.js';
import { statusOf, warnedKeys } from '../js/core.js';
import { expandJobs } from './jobs_expand.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? args[i + 1] : def; };
const N = Number(args.find((a) => /^\d+$/.test(a)) ?? 1000);
const SEED = Number(opt('--seed', 1));
const DATA = resolve(opt('--data', fileURLToPath(new URL('../data/', import.meta.url))));
const [B0, B1] = opt('--birth', '1940-2026').split('-').map(Number);
const STORY = args.includes('--story');
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
};

function runLife(i) {
  const seed = SEED * 100003 + i;
  const rng = new Rng(seed * 7 + 3);
  const by = rng.int(B0, B1);
  const cand = rollCandidate(D, by, rng);
  let s = createLife(D, { name: `${rng.pick(['김', '이', '박', '최'])}세미`, birthYear: by, candidate: cand, seed });
  let L = attach(D, s, () => {});
  const story = [];
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
      if (view.big) stats.big++;
      stats.eventCount[view.id] = (stats.eventCount[view.id] ?? 0) + 1;
      if (STORY) story.push(`  [${view.big ? '갈림길' : '사건'}] ${view.text}\n     → ${view.choices.find((c) => c.index === pick)?.label}: ${out.result}`);
    }
    stats.years++;
    if (L.s.age === 40) {
      stats.at40n++;
      if (['employed', 'owner'].includes(statusOf(L.s))) stats.at40++;
      stats.traitAt40n++;
      if (Object.keys(L.s.traitsOn).length) stats.traitAt40++;
    }
    const { dead } = finishYear(L);
    // 가끔 저장·불러오기 왕복 (이어 하기 검사)
    if (i % 25 === 0 && L.s.age % 17 === 0) {
      const json = JSON.stringify(snapshot(L));
      s = hydrate(JSON.parse(json));
      L = attach(D, s, () => {});
    }
    if (dead || L.s.year >= 2150) break;
  }
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
    for (const x of s.log) if (x.importance >= 1) console.log(`${x.year} (${x.age}세) ${x.text}`);
    console.log('\n--- 돈 (평균 연봉 대비) ---');
    console.log(s.hist.filter((h) => h.y % 5 === 0).map((h) => `${h.y} 순자산 ${h.nw} 현금 ${h.cash} 빚 ${h.debt} 소득 ${h.inc} 행복 ${h.h}`).join('\n'));
    void money;
    console.log('\n--- 사건 ---');
    console.log(story.join('\n'));
    console.log('\n--- 되돌아보기 ---');
    console.log(JSON.stringify({ lastLine: rv.lastLine, title: rv.title, ribbons: rv.ribbons, score: rv.score, bars: rv.bars, traits: rv.traits, semi: rv.semi.map((x) => `${x.year} ${x.text} (${x.kindName})`), industry: rv.industry.map((x) => x.text), numbers: rv.numbers, summary: rv.summary }, null, 1));
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
console.log(`\n한 해 평균 사건 ${(stats.events / stats.years).toFixed(2)}개 · 인생당 사건 ${(stats.events / stats.lives).toFixed(1)}개 (큰 사건 ${(stats.big / stats.lives).toFixed(1)}개)  (목표 80~120 / 10~16)`);
console.log(`\n첫 직장 (일해 본 사람 ${pct(stats.everEmployed, stats.lives)})`);
for (const [g, n] of Object.entries(stats.firstJobGroup).sort((a, b) => b[1] - a[1])) console.log(`  ${g.padEnd(4)} ${pct(n, stats.everEmployed)}`);
console.log(`  반도체 접점: ${Object.entries(stats.firstJobTouch).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} ${pct(n, stats.everEmployed)}`).join(' · ')}`);
console.log(`\n40세에 일하는 중(재직·자영업): ${pct(stats.at40, stats.at40n)} · 40세에 특징 1개↑: ${pct(stats.traitAt40, stats.traitAt40n)} (목표 70~90%)`);
console.log(`평생 무직 기간 평균 ${avg(stats.unemployedYears).toFixed(1)}년 (목표 ≤ 3년)`);
console.log(`대졸 회사원·연구원 부장↑ ${pct(stats.bujang, stats.engineers)} · 임원 ${pct(stats.exec, stats.engineers)} (목표 30~45% / 3~8%)`);
console.log(`결혼: ${Object.entries(stats.married).map(([k, [a, b]]) => `${k} ${pct(a, b)}`).join(' · ')}`);
console.log(`인생 점수 평균 ${avg(stats.scores).toFixed(0)} · 가장 큰 저장본 ${(stats.saveBytes / 1024).toFixed(0)}KB`);
const w26 = (i) => avg(stats.world26.map((x) => x[i])).toFixed(2);
const w27 = (i) => avg(stats.world27.map((x) => x[i])).toFixed(2);
console.log(`세계(판당): 2026년까지 파산 ${w26(0)} · 1위 교체(예정된 역사 추월 제외) ${w26(1)} · 인수 ${w26(2)} (${stats.world26.length}판, 목표 0~2 / 0~2) · 2027~2100 파산 ${w27(0)} · 인수 ${w27(1)} (${stats.world27.length}판, 목표 3~8 / 3~8)`);
console.log(`사인: ${Object.entries(stats.deathCause).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pct(v, stats.lives)}`).join(' · ')}`);
console.log(`대표 칭호: ${Object.entries(stats.titles).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k} ${pct(v, stats.lives)}`).join(' · ')}`);
console.log('\n가장 자주 뜬 사건 10');
for (const [id, n] of Object.entries(stats.eventCount).sort((a, b) => b[1] - a[1]).slice(0, 10)) console.log(`  ${String(n).padStart(6)}  ${id}`);
const w = warnedKeys();
if (w.length) console.log(`\n엔진 알림 (지원 안 하는 키 등): ${w.join(', ')}`);
if (stats.crashes.length) process.exit(1);
