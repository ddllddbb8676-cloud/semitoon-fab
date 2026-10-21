// 세미툰 라이프 2027~2150 미래 시간선 시뮬레이터 + 데이터 검사기 (의존성 없음)
//
// 사용법 (저장소 루트에서):
//   node life/tools/future_sim.mjs [seed]            한 판 시간선을 한 해 한 줄로 출력
//   node life/tools/future_sim.mjs 7 --headlines     + 그해 헤드라인
//   node life/tools/future_sim.mjs 7 --econ          + ECONOMY용 거시 입력값
//   node life/tools/future_sim.mjs 7 --json          market_history.json과 같은 형식의 행 배열(JSON)
//   node life/tools/future_sim.mjs --stats 500       시드 1~500 몬테카를로 요약 (점수 분포, 호황·불황 빈도, AGI 시점, 세계 경로)
//   node life/tools/future_sim.mjs --median          모든 노드를 중앙값 연도에 둔 '중앙 경로' — 노드 연표, 직업 수요 배율표, 스킬 가치
//
// 규칙 설명은 life/docs/FUTURE.md. 규칙의 기준 구현은 life/js/future.js(브라우저·Node 공용)로 옮겼고,
// 이 파일은 데이터를 fs로 읽어 넘기고 결과를 출력하는 얇은 CLI입니다. 게임 엔진도 같은 future.js를 씁니다.
// 데이터 오류(선행 노드 누락, 연도 순서, 키 오류 등)가 있으면 오류를 출력하고 종료 코드 1.
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SECTORS, SHORT, prepareData, validate, generate, jobMultipliers, skillValues } from '../js/future.js';

// 예전처럼 이 파일에서 가져다 쓰는 도구(validate.mjs 등)를 위해 다시 내보냅니다.
export { validate, generate, splitTri, jobMultipliers, skillValues, skillFit, populationIndex, retireAge, pensionAge, semiChildBase, medical } from '../js/future.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DATA = join(ROOT, 'data');

// ───────────────────────── 불러오기 ─────────────────────────
function loadJson(file) { return JSON.parse(readFileSync(join(DATA, file), 'utf8')); }
export function loadData() {
  return prepareData({
    tech: loadJson('future_tech.json'),
    scen: loadJson('future_scenarios.json'),
    jobs: loadJson('jobs.json'),
    extra: existsSync(join(DATA, 'jobs_extra.json')) ? loadJson('jobs_extra.json') : { jobs: [] },
    companies: loadJson('companies.json'),
    character: loadJson('character.json'),
    market: loadJson('market_history.json'),
    economy: loadJson('economy_history.json'),
  });
}


// ───────────────────────── 출력 ─────────────────────────
const sgn = (x) => (x > 0 ? `+${x}` : `${x}`);
const PATH_SHORT = { abundance: '풍요', stagnation: '정체', fragmentation: '분열', transition: '전환' };
function printTimeline(D, tl, opt) {
  for (const r of tl.rows) {
    const s = r._sim;
    const sc = SECTORS.map((k) => `${SHORT[k]}${sgn(r[k])}`.padEnd(3)).join(' ');
    const ph = { anchor: 'A', rebound: 'R', down: 'D', down2: 'D', forced_down: 'X', forced_up: 'F', super: 'S', strong: 'U', normal: 'U', flat: 'U' }[s.phase] ?? '?';
    let line = `${r.year} ${String(r.global_sales_busd).padStart(6)}B ${sgn(r.yoy_pct.toFixed(0)).padStart(4)}% ${sc} ${ph}${s.path ? ' ' + PATH_SHORT[s.path] : ''}`;
    if (s.nodes.length) line += ` | N ${s.nodes.join(',')}`;
    if (s.scenarios.length) line += ` | S ${s.scenarios.join(',')}`;
    if (opt.econ) { const e = s.econ; line += ` | 성장${sgn(e.korea_real_growth_pct)} 물가${e.infl_pct} 실질임금${sgn(e.real_wage_pct)} 금리${e.base_rate_pct} 경기${sgn(e.macro_score)} 서울집${sgn(e.house_seoul_chg_pct.toFixed(0))}% 코스피${sgn(e.kospi_ret_pct.toFixed(0))}% 정년${e.retire_age} 인구${e.population_index}`; }
    if (opt.headlines) line += ` | ${r.headline_ko}`;
    console.log(line);
  }
  const pre = [...tl.arrived].filter(([, y]) => y === D.model.base_year).map(([id]) => id);
  console.log(`\n시드 ${tl.seed}: 2026년 전에 등장 ${pre.join(', ') || '없음'} · 끝내 안 나온 노드 ${D.nodes.filter((n) => !tl.arrived.has(n.id)).length}개 · 세계 경로 ${tl.pathHistory.map((p) => `${p.year} ${PATH_SHORT[p.path]}`).join(' → ') || '-'}`);
  const warn = plateauWarnings(tl.rows);
  for (const w of warn) console.log(`경고  ${w}`);
}
function runs(rows, key, val) { let best = 0, cur = 0; for (const r of rows) { cur = r[key] === val ? cur + 1 : 0; best = Math.max(best, cur); } return best; }
function plateauWarnings(rows) {
  const out = [];
  for (const k of SECTORS) for (const v of [2, -2]) { const n = runs(rows, k, v); if (n >= 5) out.push(`${k} 점수 ${v}가 ${n}년 연속 (평탄 구간)`); }
  const first = rows[0];
  if (first && (first.cycle < 1 || first.memory < 1)) out.push(`2027년이 2026년(업계 +2, 메모리 +2)과 이어지지 않음: 업계 ${first.cycle}, 메모리 ${first.memory}`);
  return out;
}
const q = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
function stats(D, N) {
  const eras = [[2027, 2060], [2061, 2150]];
  const dist = eras.map(() => Object.fromEntries(SECTORS.map((k) => [k, { '-2': 0, '-1': 0, 0: 0, 1: 0, 2: 0 }])));
  const negYears = eras.map(() => 0), yearsCount = eras.map(() => 0);
  const downStarts = eras.map(() => []);
  const maxRun = Object.fromEntries(SECTORS.map((k) => [k, []]));
  const agi = []; let agiNever = 0;
  const path60 = {}, path100 = {};
  const scenRuns = Object.fromEntries(D.scenarios.map((s) => [s.id, 0]));
  const scenCount = Object.fromEntries(D.scenarios.map((s) => [s.id, 0]));
  const sales = { 2030: [], 2040: [], 2050: [], 2060: [], 2100: [], 2150: [] };
  const nodeYears = Object.fromEntries(D.nodes.map((n) => [n.id, []]));
  let plateauRuns = 0, contBreaks = 0;
  for (let seed = 1; seed <= N; seed++) {
    const tl = generate(D, seed);
    tl.rows.forEach((r, i) => {
      const e = r.year <= 2060 ? 0 : 1;
      yearsCount[e]++;
      if (r.yoy_pct < 0) negYears[e]++;
      if (r.yoy_pct < 0 && (i === 0 || tl.rows[i - 1].yoy_pct >= 0)) downStarts[e].push(r.year);
      for (const k of SECTORS) dist[e][k][r[k]]++;
      if (sales[r.year]) sales[r.year].push(r.global_sales_busd);
    });
    for (const k of SECTORS) maxRun[k].push(Math.max(runs(tl.rows, k, 2), runs(tl.rows, k, -2)));
    const ay = tl.flagYear.get('scen_agi_arrival'); if (ay) agi.push(ay); else agiNever++;
    const p60 = tl.pathHistory.find((p) => p.year === 2060)?.path; path60[p60] = (path60[p60] ?? 0) + 1;
    const p100 = [...tl.pathHistory].reverse().find((p) => p.year <= 2100)?.path; path100[p100] = (path100[p100] ?? 0) + 1;
    const seen = new Set(); for (const f of tl.fired) { scenCount[f.id]++; seen.add(f.id); } for (const id of seen) scenRuns[id]++;
    for (const [id, y] of tl.arrived) nodeYears[id].push(y);
    const w = plateauWarnings(tl.rows); if (w.some((x) => x.includes('평탄'))) plateauRuns++; if (w.some((x) => x.includes('2027'))) contBreaks++;
  }
  const pct = (x, n) => `${((100 * x) / n).toFixed(0)}%`;
  console.log(`몬테카를로 ${N}판`);
  eras.forEach(([a, b], e) => {
    console.log(`\n[${a}~${b}] 역성장 해 비율 ${pct(negYears[e], yearsCount[e])}, 하강 시작 간격 평균 ${((b - a + 1) * N / Math.max(1, downStarts[e].length)).toFixed(1)}년`);
    for (const k of SECTORS) { const c = dist[e][k]; const n = Object.values(c).reduce((x, y) => x + y, 0); console.log(`  ${k.padEnd(13)} -2 ${pct(c[-2], n).padStart(4)}  -1 ${pct(c[-1], n).padStart(4)}   0 ${pct(c[0], n).padStart(4)}  +1 ${pct(c[1], n).padStart(4)}  +2 ${pct(c[2], n).padStart(4)}`); }
  });
  console.log(`\n±2 최장 연속(판별 최대의 중앙값/최댓값): ${SECTORS.map((k) => `${k} ${q(maxRun[k], 0.5)}/${Math.max(...maxRun[k])}`).join(', ')}`);
  console.log(`평탄 경고(±2 5년 연속) 판 ${pct(plateauRuns, N)}, 2027 불연속 판 ${pct(contBreaks, N)}`);
  console.log(`매출(10억 달러) 10/50/90%: ${Object.entries(sales).map(([y, v]) => `${y} ${q(v, 0.1)}/${q(v, 0.5)}/${q(v, 0.9)}`).join(' · ')}`);
  console.log(`AGI 도래 10/25/50/75/90%: ${[0.1, 0.25, 0.5, 0.75, 0.9].map((p) => (agi.length / N >= p ? q(agi, p / (agi.length / N)) : '없음')).join('/')} · 2150년까지 없음 ${pct(agiNever, N)} · 2030 이전 ${pct(agi.filter((y) => y <= 2030).length, N)} · 2050 이전 ${pct(agi.filter((y) => y <= 2050).length, N)}`);
  console.log(`세계 경로 2060: ${Object.entries(path60).map(([k, v]) => `${PATH_SHORT[k]} ${pct(v, N)}`).join(', ')} · 2100: ${Object.entries(path100).map(([k, v]) => `${PATH_SHORT[k]} ${pct(v, N)}`).join(', ')}`);
  console.log('\n시나리오 (한 번 이상 일어난 판 비율 / 판당 평균 횟수)');
  for (const s of D.scenarios) console.log(`  ${s.id.padEnd(24)} ${pct(scenRuns[s.id], N).padStart(4)}  ${(scenCount[s.id] / N).toFixed(2)}`);
  if (process.argv.includes('--nodes')) {
    console.log('\n노드 (등장한 판 비율, 등장 연도 10/50/90%)');
    for (const n of D.nodes) { const v = nodeYears[n.id]; console.log(`  ${n.id.padEnd(30)} ${pct(v.length, N).padStart(4)}  ${v.length ? `${q(v, 0.1)}/${q(v, 0.5)}/${q(v, 0.9)}` : '-'}  (데이터 ${n.earliest_year}/${n.median_year}/${n.late_year})`); }
  }
}
function median(D) {
  const tl = generate(D, 1, { median: true, agiYear: 2041 });
  console.log('중앙 경로: 모든 노드를 median_year(선행 보정)에, AGI 2041년, 다른 시나리오 없음\n');
  const byYear = new Map();
  for (const [id, y] of tl.arrived) { if (!byYear.has(y)) byYear.set(y, []); byYear.get(y).push(id); }
  for (const y of [...byYear.keys()].sort((a, b) => a - b)) console.log(`${y === D.model.base_year ? '~2026' : y}: ${byYear.get(y).join(', ')}`);
  const never = D.nodes.filter((n) => !tl.arrived.has(n.id)).map((n) => n.id);
  if (never.length) console.log(`2150년까지 안 나옴: ${never.join(', ')}`);
  const years = [2030, 2040, 2050, 2060, 2080, 2100];
  console.log(`\n직업 수요 배율 (1.00 = 2026년 수준, 시황 효과 제외)\n${'job'.padEnd(20)}${years.map((y) => String(y).padStart(7)).join('')}`);
  const tables = years.map((y) => jobMultipliers(D, tl, y));
  for (const j of D.jobIds) console.log(`${j.padEnd(20)}${tables.map((t) => t[j].toFixed(2).padStart(7)).join('')}`);
  console.log(`\n스킬 가치 (1.00 = 보통)\n${'skill'.padEnd(20)}${years.map((y) => String(y).padStart(7)).join('')}`);
  const sv = years.map((y) => skillValues(D, tl, y));
  for (const s of D.skills) console.log(`${s.id.padEnd(20)}${sv.map((t) => t[s.id].toFixed(2).padStart(7)).join('')}`);
}

// ───────────────────────── 실행 ─────────────────────────
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const D = loadData();
  const { errors, warnings } = validate(D);
  for (const w of warnings) console.error(`경고  ${w}`);
  if (errors.length) { for (const e of errors) console.error(`오류  ${e}`); console.error(`\n데이터 오류 ${errors.length}개`); process.exit(1); }
  const num = args.find((a) => /^\d+$/.test(a));
  if (args.includes('--stats')) stats(D, Number(num ?? 500));
  else if (args.includes('--median')) median(D);
  else {
    const tl = generate(D, Number(num ?? 1));
    if (args.includes('--json')) console.log(JSON.stringify(tl.rows.map(({ _sim, ...r }) => r), null, 1));
    else printTimeline(D, tl, { econ: args.includes('--econ'), headlines: args.includes('--headlines') });
  }
}
