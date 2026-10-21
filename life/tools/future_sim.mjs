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
// 규칙 설명은 life/docs/FUTURE.md. 이 파일이 규칙의 기준 구현이며 게임 엔진(life/js/)은 같은 난수 순서로 옮긴다.
// 데이터 오류(선행 노드 누락, 연도 순서, 키 오류 등)가 있으면 오류를 출력하고 종료 코드 1.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../', import.meta.url).pathname;
const DATA = join(ROOT, 'data');
const SECTORS = ['cycle', 'memory', 'logic_foundry', 'equipment', 'korea'];
const SHORT = { cycle: 'C', memory: 'M', logic_foundry: 'L', equipment: 'E', korea: 'K' };
const CATEGORIES = ['logic_process', 'lithography', 'memory', 'packaging', 'materials', 'computing', 'ai', 'automation', 'energy', 'industry', 'society'];
const CONFIDENCE = ['high', 'medium', 'low'];
const ECON_KEYS = ['korea_growth_pct', 'inflation_pct', 'semis_wage_pct', 'years'];
const BANNED = ['삼성', '하이닉스', 'TSMC', '인텔', 'Intel', '엔비디아', 'NVIDIA', 'Nvidia', 'ASML', '마이크론', 'Micron', 'CXMT', 'YMTC', 'Rapidus', '라피더스',
  '키옥시아', 'Kioxia', '구글', 'Google', '아마존', 'Amazon', '마이크로소프트', 'Microsoft', 'OpenAI', 'GPT', 'IBM', '애플', 'Apple', '퀄컴', 'AMD',
  '브로드컴', '화웨이', 'Huawei', 'SMIC', 'Waymo', '웨이모', '테슬라', 'Tesla', '현대차', 'LG', 'SKC', '삼성전기', 'Anthropic', '앤트로픽', 'Quantinuum', 'IonQ',
  'PsiQuantum', 'Absolics', 'Unitree', 'Lightmatter', 'Insilico', 'SK'];

// ───────────────────────── 불러오기 ─────────────────────────
function loadJson(file) { return JSON.parse(readFileSync(join(DATA, file), 'utf8')); }
export function loadData() {
  const tech = loadJson('future_tech.json');
  const scen = loadJson('future_scenarios.json');
  const jobs = loadJson('jobs.json');
  const extra = existsSync(join(DATA, 'jobs_extra.json')) ? loadJson('jobs_extra.json') : { jobs: [] };
  const companies = loadJson('companies.json');
  const regions = loadJson('character.json');
  const market = loadJson('market_history.json');
  const econRows = loadJson('economy_history.json').years;
  return {
    nodes: tech.nodes, skills: tech.skills, skillGroups: tech.skill_groups, skillRules: tech.skill_rules,
    model: scen.model, paths: scen.world_paths, headlines: scen.cycle_headlines, society: scen.korea_society, scenarios: scen.scenarios,
    jobIds: new Set([...jobs.jobs, ...(extra.jobs ?? [])].map((j) => j.id)),
    coreJobIds: [...jobs.jobs, ...(extra.jobs ?? [])].filter((j) => j.touch === 'core').map((j) => j.id),
    sectorIds: new Set(companies.sectors.map((s) => s.id)),
    regionIds: new Set([...(regions.regions ?? []), ...(regions.work_only_regions ?? [])].map((r) => r.id)),
    market,
    econBase: econRows.find((r) => r.year === 2026),
    econPrev: econRows.find((r) => r.year === 2025),
  };
}

// ───────────────────────── 검사 ─────────────────────────
export function validate(D) {
  const errors = [];
  const warnings = [];
  const E = (m) => errors.push(m);
  const W = (m) => warnings.push(m);
  const isInt = Number.isInteger;
  const nodeIds = new Map();
  const skillIds = new Set(D.skills.map((s) => s.id));
  const pathIds = new Set(D.paths.map((p) => p.id));
  const flags = new Set([...D.nodes.map((n) => `tech_${n.id}`), ...D.scenarios.map((s) => `scen_${s.id}`)]);
  const textCheck = (where, s) => {
    if (typeof s !== 'string' || !s.trim()) { E(`${where}: 빈 문장`); return; }
    for (const b of BANNED) {
      const re = /^[A-Za-z]+$/.test(b) ? new RegExp(`(^|[^A-Za-z])${b}([^A-Za-z]|$)`) : null;
      if (re ? re.test(s) : s.includes(b)) E(`${where}: 실제 회사·제품 이름 '${b}'`);
    }
    for (const m of s.matchAll(/\{(\w+)\}/g)) if (m[1] !== 'company' && !where.startsWith('headline_tpl')) E(`${where}: 없는 자리표시 {${m[1]}}`);
  };
  const checkMarket = (where, market) => {
    for (const [k, v] of Object.entries(market ?? {})) {
      if (!SECTORS.includes(k)) E(`${where}: 없는 시황 키 ${k}`);
      for (const s of [v].flat()) {
        if (typeof s?.delta !== 'number' || Math.abs(s.delta) > 2) E(`${where}: ${k}.delta는 -2~2 숫자`);
        if (!isInt(s?.years) || s.years < 1) E(`${where}: ${k}.years는 1 이상 정수`);
        if (s?.lag !== undefined && !(isInt(s.lag) && s.lag >= 0)) E(`${where}: ${k}.lag는 0 이상 정수`);
      }
    }
  };
  const checkJobs = (where, jobs) => {
    for (const [j, v] of Object.entries(jobs ?? {})) {
      if (!D.jobIds.has(j)) E(`${where}: 없는 직업 ${j}`);
      if (typeof v === 'number') { if (!(v > 0 && v <= 3)) E(`${where}: ${j} 배율 범위 밖`); }
      else if (!(v && v.mult > 0 && v.mult <= 3 && isInt(v.years) && v.years >= 1)) E(`${where}: ${j}는 숫자 또는 {mult, years}`);
    }
  };
  const checkCommon = (where, eff) => {
    checkMarket(where, eff.market);
    checkJobs(where, eff.jobs);
    for (const k of Object.keys(eff.skills ?? {})) if (!skillIds.has(k)) E(`${where}: 없는 스킬 ${k}`);
    for (const k of Object.keys(eff.world_path ?? {})) if (!pathIds.has(k)) E(`${where}: 없는 세계 경로 ${k}`);
    for (const k of Object.keys(eff.region ?? {})) if (!D.regionIds.has(k)) E(`${where}: 없는 지역 ${k}`);
    if (eff.trend && !(typeof eff.trend.pct === 'number' && isInt(eff.trend.years))) E(`${where}: trend는 {pct, years}`);
    if (eff.medical) for (const [k, v] of Object.entries(eff.medical)) {
      if (k === 'life_d' ? !(v > 0 && v <= 5) : k === 'cure_mult' ? !(v > 0.5 && v <= 2) : true) E(`${where}: medical은 {life_d 0~5, cure_mult 0.5~2}`);
    }
    if (eff.new_sector) {
      const ns = eff.new_sector;
      if (!/^[a-z_]+$/.test(ns.id ?? '') || !ns.name_ko) E(`${where}: new_sector는 {id, name_ko, market_mix}`);
      if (D.sectorIds.has(ns.id)) W(`${where}: new_sector ${ns.id}는 이미 companies.json에 있음`);
      const mix = Object.entries(ns.market_mix ?? {});
      if (!mix.length || mix.some(([k]) => !SECTORS.includes(k)) || Math.abs(mix.reduce((x, [, v]) => x + v, 0) - 1) > 1e-6) E(`${where}: new_sector.market_mix는 시황 키 비율 합 1`);
    }
  };

  // 스킬
  const groupIds = new Set(D.skillGroups.map((g) => g.id));
  const seenSkill = new Set();
  for (const s of D.skills) {
    if (seenSkill.has(s.id)) E(`skill ${s.id}: id 중복`);
    seenSkill.add(s.id);
    if (!groupIds.has(s.group)) E(`skill ${s.id}: 없는 그룹 ${s.group}`);
    for (const j of s.jobs) if (!D.jobIds.has(j)) E(`skill ${s.id}: 없는 직업 ${j}`);
    for (const a of s.adjacent) if (!skillIds.has(a)) E(`skill ${s.id}: 없는 인접 스킬 ${a}`);
    textCheck(`skill ${s.id}`, s.name_ko); textCheck(`skill ${s.id}`, s.desc_ko);
  }
  if (D.skills.length < 20 || D.skills.length > 25) W(`스킬 수 ${D.skills.length}개 (권장 20~25)`);

  // 노드
  for (const n of D.nodes) {
    const w = `node ${n.id}`;
    if (!/^[a-z0-9_]+$/.test(n.id ?? '')) E(`${w}: id는 영문 소문자·숫자·_`);
    if (nodeIds.has(n.id)) E(`${w}: id 중복`);
    nodeIds.set(n.id, n);
  }
  const usedSkills = new Set();
  for (const n of D.nodes) {
    const w = `node ${n.id}`;
    textCheck(`${w} name_ko`, n.name_ko); textCheck(`${w} desc_ko`, n.desc_ko); textCheck(`${w} headline_ko`, n.headline_ko);
    (n.effects?.new_jobs_ko ?? []).forEach((t) => textCheck(`${w} new_jobs_ko`, t));
    if (!CATEGORIES.includes(n.category)) E(`${w}: 없는 분류 ${n.category}`);
    if (!CONFIDENCE.includes(n.confidence)) E(`${w}: confidence는 high|medium|low`);
    if (typeof n.fiction !== 'boolean') E(`${w}: fiction은 true/false`);
    const { earliest_year: a, median_year: m, late_year: b } = n;
    if (![a, m, b].every(isInt)) E(`${w}: 연도는 정수`);
    else if (!(a <= m && m <= b)) E(`${w}: 연도 순서 earliest ≤ median ≤ late 위반 (${a}, ${m}, ${b})`);
    if (a < 2025 || b > 2150) E(`${w}: 연도는 2025~2150`);
    for (const p of n.prereqs ?? []) {
      const pn = nodeIds.get(p);
      if (!pn) { E(`${w}: 없는 선행 노드 ${p}`); continue; }
      if (pn.median_year > m) E(`${w}: 선행 노드 ${p}의 중앙값(${pn.median_year})이 이 노드(${m})보다 늦음`);
      if (pn.earliest_year > a) W(`${w}: 선행 노드 ${p}의 earliest(${pn.earliest_year})가 더 늦음 — 실제 최소 연도는 선행+1`);
    }
    if (n.effects?.flag !== `tech_${n.id}`) E(`${w}: effects.flag는 tech_${n.id}`);
    checkCommon(w, n.effects ?? {});
    if (n.rnd_skill === null) { if (!['society', 'industry'].includes(n.category)) E(`${w}: rnd_skill null은 society·industry 이정표만`); }
    else if (!skillIds.has(n.rnd_skill)) E(`${w}: 없는 스킬 ${n.rnd_skill}`);
    else usedSkills.add(n.rnd_skill);
    if (!Array.isArray(n.sources)) E(`${w}: sources는 배열`);
    else if (!n.fiction && n.sources.length === 0) E(`${w}: 근거 노드는 출처가 있어야 함`);
    else if (n.fiction && !n.basis_ko) E(`${w}: 가상 노드는 basis_ko(근거 실마리) 필요`);
    if (n.fiction && m < 2060) W(`${w}: 가상 노드인데 중앙값이 2060년 전`);
    if (n.headline_ko?.includes('{company}') && !D.sectorIds.has(n.company_sector)) E(`${w}: {company}를 쓰면 company_sector(분야 id) 필요`);
    for (const f of n.requires_flags ?? []) if (!flags.has(f)) E(`${w}: 없는 플래그 ${f}`);
    if (n.p_never !== undefined && !(n.p_never >= 0 && n.p_never < 1)) E(`${w}: p_never는 0~1 미만`);
    if (n.trigger && !(n.trigger.sales_busd_min > 0)) E(`${w}: trigger는 {sales_busd_min}`);
    for (const [k, v] of Object.entries(n.path_year_shift ?? {})) if (!pathIds.has(k) || !isInt(v)) E(`${w}: path_year_shift는 {세계 경로: 정수 연}`);
    if (n.path_year_shift && !n.fiction) W(`${w}: path_year_shift는 가상 노드에만 의미가 있음 (2060년 이후 적용)`);
  }
  // 순환 검사
  const state = new Map();
  const dfs = (id, stack) => {
    if (state.get(id) === 2) return;
    if (state.get(id) === 1) { E(`선행 노드 순환: ${[...stack, id].join(' → ')}`); return; }
    state.set(id, 1);
    for (const p of nodeIds.get(id)?.prereqs ?? []) if (nodeIds.has(p)) dfs(p, [...stack, id]);
    state.set(id, 2);
  };
  for (const id of nodeIds.keys()) dfs(id, []);
  for (const s of skillIds) if (!usedSkills.has(s)) W(`스킬 ${s}: 연결된 노드가 없음`);

  // 시나리오
  const scenIds = new Set();
  for (const s of D.scenarios) {
    const w = `scenario ${s.id}`;
    if (scenIds.has(s.id)) E(`${w}: id 중복`);
    scenIds.add(s.id);
    textCheck(`${w} name_ko`, s.name_ko); textCheck(`${w} desc_ko`, s.desc_ko); textCheck(`${w} headline_ko`, s.headline_ko);
    if (!(Array.isArray(s.window) && s.window.length === 2 && s.window.every(isInt) && s.window[0] <= s.window[1] && s.window[0] >= 2027 && s.window[1] <= 2150)) E(`${w}: window는 [시작, 끝] 2027~2150`);
    const yp = s.yearly_probability;
    if (typeof yp === 'number') { if (!(yp >= 0 && yp <= 1)) E(`${w}: 확률 범위 밖`); }
    else if (yp && typeof yp === 'object') { for (const [y, p] of Object.entries(yp)) if (!(isInt(Number(y)) && p >= 0 && p <= 1)) E(`${w}: 확률표 {연도: 확률} 오류`); }
    else E(`${w}: yearly_probability는 숫자 또는 {연도: 확률}`);
    if (!isInt(s.max_occurrences) || s.max_occurrences < 1) E(`${w}: max_occurrences는 1 이상 정수`);
    if (s.effects?.flag !== `scen_${s.id}`) E(`${w}: effects.flag는 scen_${s.id}`);
    checkCommon(w, s.effects ?? {});
    if (s.effects?.phase && !(['up', 'down'].includes(s.effects.phase.set) && isInt(s.effects.phase.years))) E(`${w}: phase는 {set: up|down, years}`);
    if (s.effects?.phase?.depth && !D.model.cycle.depth[s.effects.phase.depth]) E(`${w}: phase.depth 오류`);
    for (const k of Object.keys(s.effects?.econ ?? {})) if (!ECON_KEYS.includes(k)) E(`${w}: 없는 econ 키 ${k}`);
    for (const k of Object.keys(s.effects?.delay_nodes ?? {})) if (!nodeIds.has(k)) E(`${w}: delay_nodes에 없는 노드 ${k}`);
    for (const f of [...(s.requires_flags ?? []), ...(s.not_flags ?? []), ...Object.keys(s.prob_mult_flags ?? {})]) if (!flags.has(f)) E(`${w}: 없는 플래그 ${f}`);
    for (const k of Object.keys(s.prob_mult_path ?? {})) if (!pathIds.has(k)) E(`${w}: 없는 세계 경로 ${k}`);
    for (const k of s.excludes_active ?? []) if (!D.scenarios.some((x) => x.id === k)) E(`${w}: 없는 시나리오 ${k}`);
    if (!CONFIDENCE.includes(s.confidence)) E(`${w}: confidence 오류`);
    if (!s.fiction && !(s.sources?.length)) E(`${w}: 근거 시나리오는 출처 필요`);
    if (s.fiction && !s.basis_ko) E(`${w}: 가상 시나리오는 basis_ko 필요`);
  }
  // 세계 경로·헤드라인
  for (const p of D.paths) {
    textCheck(`path ${p.id}`, p.name_ko); textCheck(`path ${p.id}`, p.desc_ko); textCheck(`path ${p.id}`, p.headline_ko);
    checkJobs(`path ${p.id}`, p.jobs);
  }
  for (const [k, list] of Object.entries(D.headlines)) list.forEach((t, i) => textCheck(`headline_tpl ${k}.${i}`, t));
  // 한국 사회표
  let prev = 0;
  for (const r of D.society.rows) { if (!(r.year > prev)) E(`korea_society: 연도 순서 오류 ${r.year}`); prev = r.year; }
  return { errors, warnings };
}

// ───────────────────────── 난수 ─────────────────────────
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const stream = (seed, k) => mulberry32((Math.imul(seed | 0, 0x9e3779b1) + k) >>> 0);
const gauss = (u1, u2) => Math.sqrt(-2 * Math.log(Math.max(u1, 1e-12))) * Math.cos(2 * Math.PI * u2);
const lerpU = (u, [lo, hi]) => lo + (hi - lo) * u;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const roundHalfAway = (x) => Math.sign(x) * Math.floor(Math.abs(x) + 0.5);
const step = (table, t) => { let v = table[0][1]; for (const [y, val] of table) if (t >= y) v = val; return v; };
const lerpTable = (table, t) => {
  if (t <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) if (t <= table[i][0]) { const [y0, v0] = table[i - 1]; const [y1, v1] = table[i]; return v0 + ((v1 - v0) * (t - y0)) / (y1 - y0); }
  return table[table.length - 1][1];
};
// 2조각 삼각분포: P(year ≤ median) = 0.5, 최빈값 = median
export function splitTri(u, a, m, b) { return u < 0.5 ? a + (m - a) * Math.sqrt(2 * u) : b - (b - m) * Math.sqrt(2 * (1 - u)); }
const probAt = (yp, t) => (typeof yp === 'number' ? yp : step(Object.entries(yp).map(([y, p]) => [Number(y), p]).sort((x, y) => x[0] - y[0]), t));
const segs = (v) => [v].flat();

// ───────────────────────── 시간선 생성 ─────────────────────────
export function generate(D, seed, opt = {}) {
  const M = D.model, C = M.cycle, SE = M.sectors;
  const rN = stream(seed, 1);
  const rY = stream(seed, 2);
  const rE = stream(seed, 3); // 거시(ECONOMY 행) 전용
  const nodes = D.nodes; // 파일 순서 = 위상 순서(선행이 앞)
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const pathById = new Map(D.paths.map((p) => [p.id, p]));

  // 1) 노드 계획 연도: 노드마다 난수 2개 (연도, p_never)
  const plan = new Map();
  for (const n of nodes) {
    const u = rN(), v = rN();
    const year = opt.median ? n.median_year : Math.round(splitTri(u, n.earliest_year, n.median_year, n.late_year));
    const never = !opt.median && (n.p_never ?? 0) > 0 && v < n.p_never;
    plan.set(n.id, { year, never, delay: 0 });
  }
  const flagYear = new Map();
  const arrived = new Map(); // id → 등장 연도 (2026 = 게임 시작 전에 이미 등장)
  for (const n of nodes) {
    const p = plan.get(n.id);
    if (!p.never && !n.trigger && !n.requires_flags && p.year <= M.base_year && n.prereqs.every((q) => arrived.get(q) === M.base_year)) {
      arrived.set(n.id, M.base_year); flagYear.set(n.effects.flag, M.base_year);
    }
  }

  // 2) 상태
  const active = []; // {sector, delta, from, to}
  const trendFx = []; // {pct, from, to}
  const econFx = []; // {key, val, from, to}
  const phaseFx = []; // {set, depth, from, to}
  const fired = []; // {id, year}
  const firedCount = new Map();
  const lastFired = new Map();
  const tilt = Object.fromEntries(D.paths.map((p) => [p.id, 0]));
  let path = null; const pathHistory = [];
  const addTilt = (wp) => { for (const [k, v] of Object.entries(wp ?? {})) tilt[k] = Math.min(M.world_path.tilt_cap, tilt[k] + v); };
  const pushMarket = (market, t, w) => {
    for (const [sector, v] of Object.entries(market ?? {})) for (const s of segs(v)) {
      const from = t + (s.lag ?? 0); active.push({ sector, delta: s.delta * w, from, to: from + s.years - 1 });
    }
  };
  const applyEffects = (eff, t, w) => {
    pushMarket(eff.market, t, w);
    if (eff.trend) trendFx.push({ pct: eff.trend.pct, from: t, to: t + eff.trend.years - 1 });
    if (eff.econ) for (const [k, v] of Object.entries(eff.econ)) if (k !== 'years') econFx.push({ key: k, val: v, from: t, to: t + (eff.econ.years ?? 1) - 1 });
    if (eff.phase) phaseFx.push({ set: eff.phase.set, depth: eff.phase.depth ?? 'medium', from: t, to: t + eff.phase.years - 1 });
    for (const [id, y] of Object.entries(eff.delay_nodes ?? {})) if (!arrived.has(id)) plan.get(id).delay += y;
    addTilt(eff.world_path);
  };
  const flagOn = (f, t) => flagYear.has(f) && flagYear.get(f) < t; // 지난해까지 켜진 플래그만 조건으로 쓴다

  const T0 = M.trend.level_2027_busd / (1 + step(M.trend.growth_pct, M.start_year) / 100);
  let S = M.base_sales_busd, T = T0, d = Math.log(S / T);
  let ePrev = M.base_excess_pct ?? 12;
  const yoys = [M.base_yoy_pct];
  let phase = 'up', upYears = 2, downLeft = 0, downDepth = null, downIdx = 0, lastSuper = M.base_year, forcedPrev = false;
  const rows = [];
  const sum = (arr) => arr.reduce((a, b) => a + b, 0);
  const B = D.econBase;
  const E = { cpi: B.cpi_index, wage: B.avg_wage_krw, minw: B.min_wage_hourly_krw, house: { seoul: B.house_seoul_krw, local: B.house_local_krw },
    kospi: B.kospi_close, rate: B.base_rate_pct, infl: 100 * (B.cpi_index / D.econPrev.cpi_index - 1) };

  for (let t = M.start_year; t <= M.end_year; t++) {
    // 그해 난수: 시나리오마다 1개(파일 순서) + 시황 18개
    const uS = D.scenarios.map(() => rY());
    const u = Array.from({ length: 18 }, () => rY());
    const eventsWorld = [], eventsKorea = [];
    let pathHeadline = null;

    // a) 세계 경로 판정 (2060, 2100)
    if (t === M.world_path.decide_year || (t === M.world_path.reroll_year && u[15] >= M.world_path.reroll_keep)) {
      const r = t === M.world_path.decide_year ? u[15] : (u[15] - M.world_path.reroll_keep) / (1 - M.world_path.reroll_keep);
      const w = D.paths.map((p) => Math.max(0.01, p.base_weight + tilt[p.id]));
      let acc = 0, pick = D.paths[D.paths.length - 1];
      const total = sum(w);
      for (let i = 0; i < D.paths.length; i++) { acc += w[i] / total; if (r < acc) { pick = D.paths[i]; break; } }
      if (pick.id !== path) { path = pick.id; pathHistory.push({ year: t, path }); pathHeadline = pick.headline_ko; eventsWorld.push(`세계 경로: ${pick.name_ko}`); }
    }
    const P = path ? pathById.get(path) : null;

    // b) 시나리오
    const firedNow = [];
    D.scenarios.forEach((s, i) => {
      if (opt.median && s.id !== 'agi_arrival') return;
      if (t < s.window[0] || t > s.window[1]) return;
      if ((firedCount.get(s.id) ?? 0) >= s.max_occurrences) return;
      if (lastFired.has(s.id) && t - lastFired.get(s.id) < (s.cooldown_years ?? 1)) return;
      if (!(s.requires_flags ?? []).every((f) => flagOn(f, t))) return;
      if ((s.not_flags ?? []).some((f) => flagYear.has(f))) return;
      if ((s.excludes_active ?? []).some((id) => fired.some((x) => x.id === id && t <= x.until))) return;
      let p = probAt(s.yearly_probability, t);
      for (const [f, mlt] of Object.entries(s.prob_mult_flags ?? {})) if (flagOn(f, t)) p *= mlt;
      if (P && s.prob_mult_path?.[P.id]) p *= s.prob_mult_path[P.id];
      let hit = uS[i] < p;
      if (opt.median) hit = t === (opt.agiYear ?? 2041) && flagOn('tech_superhuman_coder', t + 1);
      if (!hit) return;
      const span = Math.max(1, ...Object.values(s.effects.market ?? {}).flatMap((v) => segs(v).map((x) => (x.lag ?? 0) + x.years)), s.effects.phase?.years ?? 1);
      fired.push({ id: s.id, year: t, until: t + span - 1 });
      firedNow.push(s);
      firedCount.set(s.id, (firedCount.get(s.id) ?? 0) + 1);
      lastFired.set(s.id, t);
      if (!flagYear.has(s.effects.flag)) flagYear.set(s.effects.flag, t);
      applyEffects(s.effects, t, M.effects.scenario_delta_weight);
      eventsWorld.push(s.name_ko);
    });

    // c) 노드 등장 (trigger 노드는 매출 계산 뒤)
    const arrivedNow = [];
    const tryArrive = (n, salesNow) => {
      if (arrived.has(n.id)) return;
      const p = plan.get(n.id);
      if (p.never) return;
      let due = p.year + p.delay;
      if (n.fiction && P && n.path_year_shift?.[P.id]) due += n.path_year_shift[P.id];
      if (n.trigger) { if (salesNow === undefined || salesNow < n.trigger.sales_busd_min || t < n.earliest_year) return; }
      else if (t < due) return;
      if (!n.prereqs.every((q) => arrived.has(q) && arrived.get(q) < t)) return;
      if (!(n.requires_flags ?? []).every((f) => flagOn(f, t))) return;
      arrived.set(n.id, t); flagYear.set(n.effects.flag, t);
      applyEffects(n.effects, t, M.effects.node_delta_weight);
      arrivedNow.push(n);
      const kr = n.category === 'society' || n.effects.region || n.effects.market?.korea;
      (kr ? eventsKorea : eventsWorld).push(n.name_ko);
    };
    for (const n of nodes) if (!n.trigger) tryArrive(n);

    // d) 활성 효과 합산 (분야별 상한)
    const D_ = Object.fromEntries(SECTORS.map((k) => [k, clamp(sum(active.filter((a) => a.sector === k && a.from <= t && t <= a.to).map((a) => a.delta)), -M.effects.delta_cap, M.effects.delta_cap)]));

    // e) 사이클 국면과 초과성장 e(%p)
    const gT = (P ? (P.trend_schedule ? step(P.trend_schedule, t) : P.trend_pct) : step(M.trend.growth_pct, t)) + sum(trendFx.filter((x) => x.from <= t && t <= x.to).map((x) => x.pct));
    const amp = t > M.world_path.decide_year ? C.amp_post_2060 * (P?.amp ?? 1) : 1;
    let excess, kind;
    const force = phaseFx.filter((f) => f.from <= t && t <= f.to).pop();
    const pickDepth = (x) => { let acc = 0; for (const [k, v] of Object.entries(C.depth)) { acc += v.p; if (x < acc) return k; } return 'mild'; };
    if (t === M.start_year) {
      const A = M.anchor_2027;
      const yoy27 = clamp(A.yoy_mean_pct + A.yoy_sd_pct * gauss(u[16], u[17]), A.yoy_min_pct, A.yoy_max_pct);
      excess = yoy27 - gT; kind = 'anchor'; phase = 'up'; upYears++;
    } else if (force) {
      if (force.set === 'down') {
        const first = !(forcedPrev && phase === 'down');
        downDepth = first ? force.depth : downDepth;
        excess = lerpU(u[3], C.depth[downDepth].excess_pct) * (first ? 1 : C.second_down_year_scale);
        phase = 'down'; downLeft = 0; kind = 'forced_down';
      } else {
        const r = u[4] < C.up_kinds.normal.p / (C.up_kinds.normal.p + C.up_kinds.strong.p) ? 'normal' : 'strong'; // 강제 상승기에는 평년 대신 보통·강세만
        excess = lerpU(u[3], C.up_kinds[r].excess_pct); phase = 'up'; upYears++; kind = 'forced_up';
      }
    } else if (phase === 'down' && downLeft > 0) {
      excess = lerpU(u[3], C.depth[downDepth].excess_pct) * C.second_down_year_scale; downLeft--; kind = 'down2';
    } else if (phase === 'down') {
      phase = 'up'; upYears = 1; excess = lerpU(u[3], C.rebound_excess_pct); kind = 'rebound';
    } else {
      let p = C.p_down;
      const n = yoys.length;
      if (n >= C.overheat_years && yoys.slice(-C.overheat_years).every((y) => y >= C.overheat_yoy_pct)) p = C.p_down_overheat;
      p += C.p_down_gap_coef * Math.max(0, d);
      if (upYears < C.min_up_years) p = 0;
      if (u[0] < p) {
        phase = 'down'; downDepth = pickDepth(u[2]);
        downLeft = u[1] < C.down_years[0][1] ? C.down_years[0][0] - 1 : C.down_years[1][0] - 1;
        excess = lerpU(u[3], C.depth[downDepth].excess_pct); kind = 'down';
      } else {
        upYears++;
        const uk = u[4] < C.up_kinds.flat.p ? 'flat' : u[4] < C.up_kinds.flat.p + C.up_kinds.normal.p ? 'normal' : 'strong';
        excess = lerpU(u[3], C.up_kinds[uk].excess_pct); kind = uk;
        if (t - lastSuper >= C.super_min_gap_years && u[5] < C.p_super) { excess = lerpU(u[3], C.super_excess_pct); kind = 'super'; lastSuper = t; }
      }
    }
    forcedPrev = !!force;
    const meanRev = kind === 'anchor' ? 0 : C.mean_reversion * 100 * d;
    const e = amp * excess - meanRev + SE.cycle.unit_pct * D_.cycle;

    // f) 매출
    const yoy = Math.max(-60, gT + e);
    S = S * (1 + yoy / 100);
    T = t === M.start_year ? M.trend.level_2027_busd : T * (1 + gT / 100);
    d = Math.log(S / T);
    yoys.push(yoy);

    // g) 분야 점수
    const z = (a, b) => gauss(u[a], u[b]);
    const anchor = kind === 'anchor'; // 2027은 2026 메모리 슈퍼사이클과 이어지도록 메모리 잡음·비중 회귀를 빼고 계산
    const xM = SE.memory.beta * e + (anchor ? 0 : step(SE.memory.share_drift_pct, t) + SE.memory.noise_pct * z(6, 7));
    const sM = xM / SE.memory.unit_pct + D_.memory;
    const sC = (e + (SE.cycle.offset_pct ?? 0)) / SE.cycle.unit_pct; // D_.cycle은 e에 이미 들어 있음
    const sL = (SE.logic_foundry.beta * e + SE.logic_foundry.noise_pct * z(8, 9)) / SE.logic_foundry.unit_pct + D_.logic_foundry + SE.logic_foundry.bias_steps;
    const eLag = SE.equipment.lag_weight * e + (1 - SE.equipment.lag_weight) * ePrev;
    const sE = (SE.equipment.beta * eLag + SE.equipment.noise_pct * z(10, 11)) / SE.equipment.unit_pct + D_.equipment;
    const sK = SE.korea.mix_memory * sM + SE.korea.mix_cycle * sC + SE.korea.noise_steps * z(12, 13) + D_.korea + (P?.korea_bias ?? 0);
    ePrev = e;
    const cap = M.effects.score_cap;
    const score = (x) => clamp(roundHalfAway(x), -cap, cap);
    const sc = { cycle: score(sC), memory: score(sM), logic_foundry: score(sL), equipment: score(sE), korea: score(sK) };

    // h) 매출 기준 이정표 노드
    for (const n of nodes) if (n.trigger) tryArrive(n, S);

    // i) 헤드라인
    let headline;
    const prio = (x) => sum(Object.values(x.effects.market ?? {}).flatMap((v) => segs(v).map((q) => Math.abs(q.delta)))) + (x.confidence === 'high' ? 0.3 : 0) + (x.trigger ? 0.6 : 0);
    // 우선순위: 드문 시나리오(max_occurrences ≤ 2) > 세계 경로 판정 > 잦은 시나리오(업계 점수 ±1 이내 해만) > 큰 노드(±1 이내 해만) > 시황 틀
    const calm = Math.abs(sc.cycle) <= 1;
    const big = [...firedNow.filter((x) => x.max_occurrences <= 2 || calm).map((x) => ({ h: x.headline_ko, p: 1 + prio(x) + (x.max_occurrences <= 2 ? 3 : 0) })),
      ...(pathHeadline ? [{ h: pathHeadline, p: 3.5 }] : [])].sort((a, b) => b.p - a.p);
    const topNode = [...arrivedNow].sort((a, b) => prio(b) - prio(a))[0];
    if (big.length) headline = big[0].h;
    else if (topNode && calm && prio(topNode) >= 0.5) headline = topNode.headline_ko;
    else {
      const overheat = yoys.slice(-3, -1).every((y) => y >= C.overheat_yoy_pct);
      const b = sc.cycle <= -2 ? 'bust' : sc.cycle === -1 ? 'down' : kind === 'rebound' ? 'recovery' : sc.cycle === 2 ? 'super'
        : sc.memory === 2 ? 'memory_boom' : sc.memory <= -1 ? 'memory_weak' : sc.cycle === 1 ? (overheat ? 'peak_warning' : 'up') : 'flat';
      const list = D.headlines[b];
      headline = list[Math.floor(u[14] * list.length)];
    }
    headline = headline.replaceAll('{sales_t}', (S / 1000).toFixed(S < 10000 ? 2 : 1)).replaceAll('{yoy}', `${Math.abs(yoy).toFixed(0)}%`);

    // j) 거시 입력 — ECONOMY.md 11.1 행 (난수 스트림 3, 해마다 정규난수 8개)
    const EC = M.econ;
    const pathOn = !!P && t > M.world_path.decide_year;
    const zz = Array.from({ length: 8 }, () => gauss(rE(), rE()));
    const econSum = (k) => sum(econFx.filter((x) => x.key === k && x.from <= t && t <= x.to).map((x) => x.val));
    const st = { arrived, flagYear, pathHistory, fired };
    const gBase = pathOn ? P.korea_real_growth_pct : step(EC.korea_real_growth_pct, t);
    const growth = gBase + EC.growth_per_korea_score * sc.korea + econSum('korea_growth_pct');
    const macro = clamp(roundHalfAway(0.5 * sc.korea + (growth - gBase)), -2, 2);
    const piStar = (pathOn ? P.inflation_pct : EC.inflation_target_pct) + econSum('inflation_pct');
    const infl = clamp(piStar + EC.inflation_persistence * (E.infl - piStar) + EC.inflation_noise_pct * zz[0], -1, 8);
    const halfY = flagYear.get(EC.automation_wage_drag.flag);
    const drag = halfY !== undefined && t >= halfY && t < halfY + EC.automation_wage_drag.years ? EC.automation_wage_drag.pct : 0;
    const realWage = clamp((pathOn ? P.real_wage_pct : step(EC.real_wage_pct, t)) + drag + EC.real_wage_macro * macro + EC.real_wage_noise_pct * zz[1], -4, 5);
    const rStar = pathOn ? P.r_star_pct : lerpTable(EC.r_star_pct, t);
    const ratePrev = E.rate;
    const rate = clamp(ratePrev + EC.rate_adjust * (rStar + infl - ratePrev) + EC.rate_noise_pct * zz[2], EC.rate_floor_pct, EC.rate_cap_pct);
    const popG = 100 * (populationIndex(D, st, t) / populationIndex(D, st, t - 1) - 1);
    const wagePrev = E.wage;
    E.cpi *= 1 + infl / 100;
    E.wage *= (1 + infl / 100) * (1 + realWage / 100);
    let minW = E.minw * (E.wage / wagePrev) * (1 + (EC.min_wage_extra_pct[0] + EC.min_wage_extra_pct[1] * zz[3]) / 100);
    const [rLo, rHi] = EC.min_wage_ratio_fence;
    minW = clamp(minW, (rLo * E.wage) / 12 / 209, (rHi * E.wage) / 12 / 209);
    const minG = 100 * (minW / E.minw - 1); E.minw = minW;
    const H = EC.house, houseChg = {};
    ['seoul', 'local'].forEach((k, i) => {
      const ln = Math.log(1 + infl / 100) + realWage / 100 + H.pir_coef * Math.log(H.pir_target[k] / (E.house[k] / wagePrev))
        - (H.rate_coef * (rate - ratePrev)) / 100 + (H.pop_coef[k] * popG) / 100 + H.noise[k] * zz[4 + i];
      const v = clamp(E.house[k] * Math.exp(ln), H.pir_fence[k][0] * E.wage, H.pir_fence[k][1] * E.wage);
      houseChg[k] = 100 * (v / E.house[k] - 1); E.house[k] = v;
    });
    const K = EC.kospi;
    const kret = clamp(100 * (Math.exp(Math.log(1 + infl / 100) + K.premium + (pathOn ? P.kospi_adj : 0) + K.macro * macro + K.korea * sc.korea + K.noise * zz[6]) - 1), K.min_pct, K.max_pct);
    E.kospi *= 1 + kret / 100;
    E.infl = infl; E.rate = rate;
    const r2 = (x) => +x.toFixed(2);
    const econ = {
      infl_pct: r2(infl), real_wage_pct: r2(realWage), min_wage_growth_pct: r2(minG), base_rate_pct: r2(rate),
      mortgage_spread: r2(EC.mortgage_spread_pct[0] + EC.mortgage_spread_pct[1] * zz[7]), deposit_spread: EC.deposit_spread_pct,
      house_seoul_chg_pct: r2(houseChg.seoul), house_local_chg_pct: r2(houseChg.local), kospi_ret_pct: r2(kret),
      dividend_yield_pct: EC.dividend_yield_pct, macro_score: macro, jeonse_ratio: EC.jeonse_ratio, ltv_capital: EC.ltv_capital, ltv_local: EC.ltv_local,
      retire_age: retireAge(D, st, t), pension_start_age: pensionAge(D, t), population_index: +populationIndex(D, st, t).toFixed(3),
      // 참고값 (같은 공식으로 굴린 수준, 엔진은 위 변화율로 직접 만든다)
      korea_real_growth_pct: r2(growth), semis_wage_extra_pct: r2(EC.semis_wage_per_korea_score * sc.korea + econSum('semis_wage_pct')),
      cpi_index: +E.cpi.toFixed(1), avg_wage_krw: Math.round(E.wage), min_wage_hourly_krw: Math.round(E.minw),
      house_seoul_krw: Math.round(E.house.seoul), house_local_krw: Math.round(E.house.local), kospi_close: Math.round(E.kospi),
    };

    rows.push({
      year: t, global_sales_busd: Math.round(S), sales_basis: 'model', yoy_pct: +yoy.toFixed(1),
      ...sc, events_world: eventsWorld, events_korea: eventsKorea, headline_ko: headline,
      confidence: 'model', fiction: t > M.world_path.decide_year, sources: [],
      _sim: { phase: kind, trend_busd: Math.round(T), excess_pct: +e.toFixed(1), path, nodes: arrivedNow.map((n) => n.id), scenarios: firedNow.map((s) => s.id), econ,
        raw: { cycle: +sC.toFixed(2), memory: +sM.toFixed(2), logic_foundry: +sL.toFixed(2), equipment: +sE.toFixed(2), korea: +sK.toFixed(2) } },
    });
  }
  return { seed, rows, arrived, fired, flagYear, pathHistory, plan, tilt };
}

// ───────────────────────── 직업 수요·스킬·사회 (SYSTEMS·ECONOMY가 읽는 값) ─────────────────────────
const pathAt = (D, tl, t) => { const p = [...tl.pathHistory].reverse().find((x) => x.year <= t); return p ? D.paths.find((x) => x.id === p.path) : null; };
const effectsUntil = (D, tl, t) => [
  ...D.nodes.filter((n) => tl.arrived.has(n.id) && tl.arrived.get(n.id) <= t).map((n) => ({ eff: n.effects, year: tl.arrived.get(n.id) })),
  ...tl.fired.filter((f) => f.year <= t).map((f) => ({ eff: D.scenarios.find((x) => x.id === f.id).effects, year: f.year })),
];
// 직업 수요 배율: 영구 배율은 곱하고 ramp_years에 걸쳐 서서히, 일시 배율은 (mult−1)을 더해 temp_boost_cap까지, 2060년 이후 세계 경로 보정
export function jobMultipliers(D, tl, t) {
  const M = D.model;
  const path = pathAt(D, tl, t);
  const post = path && t > M.world_path.decide_year;
  const out = {};
  for (const j of D.jobIds) {
    let perm = 1, up = 0, down = 1;
    for (const { eff, year } of effectsUntil(D, tl, t)) {
      const v = eff.jobs?.[j];
      if (v === undefined) continue;
      if (typeof v === 'number') {
        let m = 1 + (v - 1) * Math.min(1, (t - year + 1) / (eff.jobs_ramp ?? M.jobs.ramp_years));
        if (post && m < 1) m = 1 - path.automation_scale * (1 - m);
        perm *= Math.max(0.01, m);
      } else if (t < year + v.years) { if (v.mult >= 1) up += v.mult - 1; else down *= v.mult; }
    }
    let m = perm * (1 + Math.min(M.jobs.temp_boost_cap, up)) * down;
    if (post && path.jobs[j]) m *= 1 + (path.jobs[j] - 1) * Math.min(1, (t - M.world_path.decide_year) / 10);
    out[j] = +clamp(m, M.jobs.min, M.jobs.max).toFixed(3);
  }
  return out;
}
// 스킬 가치 v(s,y): 1 + 최근 노드 보너스 + 영구 증감, 오래 조용하면 fade_floor까지 서서히 하락
export function skillValues(D, tl, t) {
  const R = D.skillRules;
  const out = {};
  const effs = effectsUntil(D, tl, t);
  for (const s of D.skills) {
    const mine = D.nodes.filter((n) => n.rnd_skill === s.id && tl.arrived.has(n.id) && tl.arrived.get(n.id) <= t).map((n) => tl.arrived.get(n.id));
    const hot = mine.filter((y) => t - y < R.hot_years).length;
    const last = Math.max(D.model.base_year - 5, ...mine);
    const base = Math.max(R.fade_floor, 1 - R.fade_per_year * Math.max(0, t - last - R.fade_after_years));
    const v = base + Math.min(R.hot_cap, R.hot_bonus * hot) + sum0(effs.map((x) => x.eff.skills?.[s.id] ?? 0));
    out[s.id] = +clamp(v, R.value_min, R.value_max).toFixed(2);
  }
  return out;
}
const sum0 = (a) => a.reduce((x, y) => x + y, 0);
// R&D 적합도 (SYSTEMS 5.11): career = { job, skills: [{id, level}] }
export function skillFit(D, tl, t, career) {
  if (!career?.skills?.length) return D.skillRules.fit.base;
  const v = skillValues(D, tl, t);
  const F = D.skillRules.fit;
  const best = Math.max(...career.skills.map((k) => (D.skills.find((s) => s.id === k.id)?.jobs.includes(career.job) ? 1 : F.off_job_weight) * k.level * v[k.id]));
  return +clamp(F.base + F.per_level_value * best, 0, 1).toFixed(3);
}
// 한국 사회 값 (FUTURE.md 6장)
const societyAt = (D, key, t) => {
  const rows = D.society.rows.filter((r) => r[key] !== null && r[key] !== undefined);
  return lerpTable(rows.map((r) => [r.year, r[key]]), t);
};
export function populationIndex(D, st, t) {
  let p = societyAt(D, 'population_m', t) / societyAt(D, 'population_m', D.model.base_year);
  if (t > 2072) { const path = pathAt(D, st, t); if (path) p *= 1 + (path.population_2150_mult - 1) * Math.min(1, (t - 2072) / (2150 - 2072)); }
  const reb = st.fired?.find((f) => f.id === 'demographic_rebound' && f.year <= t);
  if (reb) p *= 1 + 0.15 * Math.min(1, (t - reb.year) / 40);
  return p;
}
export function retireAge(D, st, t) {
  if (t < 2029) return 60;
  const y65 = st.arrived.get('korea_retirement_65');
  if (y65 === undefined || y65 > t) return Math.min(64, 61 + Math.floor((t - 2029) / 2));
  return Math.max(65, ...D.society.rows.filter((r) => r.year >= 2045 && r.year <= t).map((r) => r.retirement_age));
}
export function pensionAge(D, t) { return Math.max(65, ...D.society.rows.filter((r) => r.year <= t && r.year >= 2035).map((r) => r.pension_age)); }
// SYSTEMS 8.6 자녀가 반도체 직군이 될 기본 확률
export function semiChildBase(D, tl, t) {
  const m = jobMultipliers(D, tl, t);
  const avg = D.coreJobIds.reduce((x, j) => x + m[j], 0) / Math.max(1, D.coreJobIds.length);
  return +clamp(0.07 * avg, 0.03, 0.10).toFixed(3);
}
export function medical(D, tl, t) {
  let life = 0, cure = 1;
  for (const { eff } of effectsUntil(D, tl, t)) { life += eff.medical?.life_d ?? 0; cure *= eff.medical?.cure_mult ?? 1; }
  return { life_d_bonus: Math.min(4, life), cure_mult: +Math.min(1.5, cure).toFixed(3) };
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
if (import.meta.url === `file://${process.argv[1]}`) {
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
