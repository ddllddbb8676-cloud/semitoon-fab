// life/data 검사기. 사용법: node life/tools/validate.mjs
// 키 목록은 life/docs/SPEC.md와 같아야 한다. SPEC이 바뀌면 여기도 고친다.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { loadMatrix, expandJobs } from './jobs_expand.mjs';
import { loadData as loadFuture, validate as validateFuture } from './future_sim.mjs';

const ROOT = new URL('../', import.meta.url).pathname;
const DATA = join(ROOT, 'data');

const STATS = ['health', 'intelligence', 'dexterity', 'sociability', 'mental', 'looks'];
const AXES = ['diligence', 'risk', 'thrift', 'work_life', 'social', 'outlook', 'conform'];
const STAGES = ['infant', 'child', 'teen', 'young', 'middle', 'senior'];
const MARKET_KEYS = ['cycle', 'memory', 'logic_foundry', 'equipment', 'korea'];
const EFFECT_KEYS = new Set([...STATS, ...AXES.map((a) => `trait.${a}`),
  'happiness', 'cash', 'debt', 'reputation', 'friends', 'flag', 'semi', 'goto', 'title_progress', 'do']);
const WHEN_KEYS = new Set(['stage', 'age', 'year', 'gender', 'stat_min', 'trait_min', 'trait_max', 'edu_min', 'edu_max',
  'wealth_min', 'job', 'job_group', 'job_role', 'job_dim', 'sector', 'employment', 'career_years_min', 'rank_min',
  'company_state', 'region', 'near_fab', 'has_partner', 'has_children', 'parents_alive', 'flag', 'not_flag', 'flag_any',
  'semi_min', 'semi_max', 'market', 'macro', 'kospi_change', 'base_rate', 'house_change', 'cash_min', 'networth_min',
  'networth_max', 'debt_min', 'asset_grade_min', 'asset_grade_max', 'credit', 'house_tenure', 'has_house', 'has_loan',
  'holds_stock', 'stock_ret', 'concentration_min', 'holds_coin', 'coin_ret',
  'tech', 'tech_any', 'not_tech', 'tech_since', 'scenario', 'scenario_active', 'scenario_since', 'world_path',
  'skill_min', 'skill_value_min', 'skill_value_max', 'job_demand_min', 'job_demand_max', 'future']);
const RANGE_KEYS = new Set(['age', 'year', 'company_state', 'macro', 'kospi_change', 'base_rate', 'house_change', 'stock_ret', 'coin_ret']);
const EVENT_KEYS = new Set(['id', 'age', 'year', 'when', 'market', 'weight', 'once', 'big', 'forced', 'trigger',
  'priority', 'tags', 'bias', 'text', 'choices', 'default']);
const CHOICE_KEYS = new Set(['label', 'when', 'check', 'fail', 'effects', 'result']);
const DO_VERBS = new Set(['school', 'major', 'military', 'job', 'salary_mod', 'salary_mult', 'bonus', 'partner', 'child',
  'leave', 'house', 'tenure', 'invest', 'stock', 'index', 'coin', 'loan', 'repay', 'credit', 'move', 'wealth', 'habit',
  'cond', 'talent', 'skill_point', 'again', 'skill']);
const MONEY = /^-?@(avg_wage|avg_wage_month|salary|income|min_wage|min_wage_month|min_wage_year|house_seoul|house_local|house|house_mine|rent_month|krw26|cash|networth|allowance|living)(\*-?\d+(\.\d+)?)?$/;
const SEMI_KINDS = new Set(['core', 'near', 'eco', 'family', 'money', 'school', 'place', 'history', 'everyday']);
const PLACEHOLDERS = new Set(['name', 'birth_year', 'death_year', 'age', 'region', 'main_job', 'main_company',
  'career_years', 'trait_top', 'trait_second', 'children', 'semi_count', 'best_year', 'worst_year', 'title',
  'company', 'rival', 'acquirer', 'client', 'partner', 'child', 'offer1', 'offer2', 'offer3', 'tech', 'skill']);

const errors = [];
const warnings = [];
const err = (file, msg) => errors.push(`${relative(ROOT, file)}: ${msg}`);
const warn = (file, msg) => warnings.push(`${relative(ROOT, file)}: ${msg}`);

function load(file) {
  try { return JSON.parse(readFileSync(file, 'utf8')); }
  catch (e) { err(file, `JSON 오류 ${e.message}`); return null; }
}
function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : n.endsWith('.json') ? [p] : [];
  });
}
const isRange = (v) => Array.isArray(v) && v.length === 2 && v.every((x) => x === null || Number.isInteger(x));

// 기준 데이터
const companies = load(join(DATA, 'companies.json'));
const character = load(join(DATA, 'character.json'));
const jobsBase = load(join(DATA, 'jobs.json'));
const jobsExtra = existsSync(join(DATA, 'jobs_extra.json')) ? load(join(DATA, 'jobs_extra.json')) : null;
const sectors = new Set(companies?.sectors.map((s) => s.id) ?? []);
const regions = new Set([...(character?.regions ?? []), ...(character?.work_only_regions ?? [])].map((r) => r.id));
const allJobs = [...(jobsBase?.jobs ?? []), ...(jobsExtra?.jobs ?? [])];
const matrix = loadMatrix();
const matrixJobs = expandJobs(matrix);
const jobIds = new Set([...allJobs, ...matrixJobs].map((j) => j.id));
const roleIds = new Set(matrix.roles.map((r) => r.id));
const jobGroups = new Set(allJobs.map((j) => j.group));
const employment = new Set(jobsBase?.employment_types.map((e) => e.id) ?? []);
const education = new Set(jobsBase?.education_levels ?? []);
const FUT = loadFuture();
const techIds = new Set(FUT.nodes.map((n) => n.id));
const skillIds = new Set(FUT.skills.map((x) => x.id));
const scenarioIds = new Set(FUT.scenarios.map((x) => x.id));
const pathIds = new Set((FUT.world_paths ?? FUT.paths ?? []).map((x) => x.id));
{
  const r = validateFuture(FUT);
  for (const e of r.errors ?? []) err(join(DATA, 'future_tech.json'), e);
  for (const w of r.warnings ?? []) warn(join(DATA, 'future_tech.json'), w);
}
const MX = join(DATA, 'job_matrix.json');
{
  const seen = new Set();
  for (const j of matrixJobs) {
    if (seen.has(j.id)) err(MX, `세부 직업 id 중복 ${j.id}`);
    seen.add(j.id);
    if (!allJobs.some((b) => b.id === j.parent)) err(MX, `${j.role}: 없는 parent ${j.parent}`);
    for (const s of j.sectors) if (!sectors.has(s)) err(MX, `${j.role}: 없는 분야 ${s}`);
    for (const e of j.employment) if (!employment.has(e)) err(MX, `${j.role}: 없는 고용형태 ${e}`);
  }
}

for (const c of companies?.sectors.flatMap((s) => s.companies) ?? []) {
  for (const r of c.regions) if (!regions.has(r)) err(join(DATA, 'companies.json'), `${c.id}: 없는 지역 ${r}`);
}

function checkJobs(file, list, seen) {
  for (const j of list) {
    if (seen.has(j.id)) err(file, `직업 id 중복 ${j.id}`);
    seen.add(j.id);
    for (const s of j.sectors ?? []) if (!sectors.has(s)) err(file, `${j.id}: 없는 분야 ${s}`);
    for (const e of j.employment ?? []) if (!employment.has(e)) err(file, `${j.id}: 없는 고용형태 ${e}`);
    if (!education.has(j.education)) err(file, `${j.id}: 없는 학력 ${j.education}`);
    for (const k of Object.keys(j.stats ?? {})) if (!STATS.includes(k)) err(file, `${j.id}: 없는 능력치 ${k}`);
    if (!Number.isInteger(j.since)) err(file, `${j.id}: since가 연도가 아님`);
    if (j.until !== undefined && !(Number.isInteger(j.until) && j.until > j.since)) err(file, `${j.id}: until이 이상함`);
  }
}
const jobSeen = new Set();
checkJobs(join(DATA, 'jobs.json'), jobsBase?.jobs ?? [], jobSeen);
if (jobsExtra) checkJobs(join(DATA, 'jobs_extra.json'), jobsExtra.jobs ?? [], jobSeen);

function checkWhen(file, id, when) {
  for (const [k, v] of Object.entries(when ?? {})) {
    if (!WHEN_KEYS.has(k)) { err(file, `${id}: 없는 조건 키 ${k}`); continue; }
    const vals = [v].flat();
    if (k === 'job') vals.forEach((x) => x === 'none' || jobIds.has(x) || err(file, `${id}: 없는 직업 ${x}`));
    if (k === 'job_role') vals.forEach((x) => roleIds.has(x) || err(file, `${id}: 없는 세부 직무 ${x}`));
    if (k === 'job_dim') for (const [d, ids] of Object.entries(v)) {
      const known = new Set((matrix.dimensions[d] ?? []).map((x) => x.id));
      if (!matrix.dimensions[d]) err(file, `${id}: 없는 직업 축 ${d}`);
      else [ids].flat().forEach((x) => known.has(x) || err(file, `${id}: 축 ${d}에 없는 값 ${x}`));
    }
    if (k === 'job_group') vals.forEach((x) => jobGroups.has(x) || err(file, `${id}: 없는 직업 그룹 ${x}`));
    if (k === 'sector') vals.forEach((x) => sectors.has(x) || err(file, `${id}: 없는 분야 ${x}`));
    if (k === 'region') vals.forEach((x) => regions.has(x) || err(file, `${id}: 없는 지역 ${x}`));
    if (k === 'employment') vals.forEach((x) => employment.has(x) || err(file, `${id}: 없는 고용형태 ${x}`));
    if (k === 'stage') vals.forEach((x) => STAGES.includes(x) || err(file, `${id}: 없는 생애 단계 ${x}`));
    if (k === 'stat_min') Object.keys(v).forEach((x) => STATS.includes(x) || err(file, `${id}: 없는 능력치 ${x}`));
    if (k === 'trait_min' || k === 'trait_max') Object.keys(v).forEach((x) => AXES.includes(x) || err(file, `${id}: 없는 성향 축 ${x}`));
    if (k === 'market') checkMarket(file, id, v);
    if (RANGE_KEYS.has(k) && !isRange(v)) err(file, `${id}: ${k}는 [최소, 최대]`);
    const ids = (x) => (Array.isArray(x) || typeof x === 'string' ? [x].flat() : Object.keys(x));
    if (['tech', 'tech_any', 'not_tech', 'tech_since'].includes(k)) ids(v).forEach((x) => techIds.has(x) || err(file, `${id}: 없는 기술 노드 ${x}`));
    if (['scenario', 'scenario_active', 'scenario_since'].includes(k)) ids(v).forEach((x) => scenarioIds.has(x) || err(file, `${id}: 없는 시나리오 ${x}`));
    if (k === 'world_path' && pathIds.size) vals.forEach((x) => pathIds.has(x) || err(file, `${id}: 없는 세계 경로 ${x}`));
    if (['skill_min', 'skill_value_min', 'skill_value_max'].includes(k)) Object.keys(v).forEach((x) => skillIds.has(x) || err(file, `${id}: 없는 스킬 ${x}`));
    if (['job_demand_min', 'job_demand_max'].includes(k)) Object.keys(v).forEach((x) => jobIds.has(x) || err(file, `${id}: 없는 직업 ${x}`));
    if (k === 'gender') vals.forEach((x) => ['m', 'f'].includes(x) || err(file, `${id}: gender는 m|f`));
    if ((k === 'edu_min' || k === 'edu_max') && !education.has(v)) err(file, `${id}: 없는 학력 ${v}`);
    if (['cash_min', 'networth_min', 'networth_max', 'debt_min'].includes(k) && typeof v === 'string' && !MONEY.test(v))
      err(file, `${id}: ${k} 금액 형식 오류 ${v}`);
  }
}
function checkMoney(file, id, v) {
  if (!(v === 0 || (typeof v === 'string' && MONEY.test(v)))) err(file, `${id}: 돈은 "@salary*0.1" 같은 상대값 (${v})`);
}
function checkDo(file, id, v) {
  for (const a of [v].flat()) {
    if (typeof a !== 'string') { err(file, `${id}: do는 문자열`); continue; }
    const [verb, ...args] = a.split(':');
    if (!DO_VERBS.has(verb)) { err(file, `${id}: 없는 do 동작 ${a}`); continue; }
    if (verb === 'job' && ['hire', 'owner', 'side'].includes(args[0]) && !jobIds.has(args[1])) err(file, `${id}: 없는 직업 ${a}`);
    if (verb === 'job' && args[0] === 'found' && !sectors.has(args[1])) err(file, `${id}: 없는 분야 ${a}`);
    if (verb === 'move' && !['overseas', 'company'].includes(args[0]) && !regions.has(args[0])) err(file, `${id}: 없는 지역 ${a}`);
    const amount = args.at(-1) ?? '';
    if (amount.startsWith('@') || amount.startsWith('-@')) checkMoney(file, id, amount);
  }
}
function checkEffects(file, id, effects) {
  for (const [k, v] of Object.entries(effects ?? {})) {
    if (k.startsWith('skill.')) { skillIds.has(k.slice(6)) || err(file, `${id}: 없는 스킬 ${k}`); continue; }
    if (!EFFECT_KEYS.has(k)) { err(file, `${id}: 없는 효과 키 ${k}`); continue; }
    if (k === 'cash' || k === 'debt') checkMoney(file, id, v);
    if (k === 'goto') gotos.push([file, id, v]);
    if (k === 'do') checkDo(file, id, v);
    if (k === 'semi' && typeof v === 'object' && (!v.text || (v.kind && !SEMI_KINDS.has(v.kind)))) err(file, `${id}: semi는 {text, kind}`);
  }
}
function checkMarket(file, id, m) {
  for (const [k, v] of Object.entries(m ?? {})) {
    if (!MARKET_KEYS.includes(k)) err(file, `${id}: 없는 시황 키 ${k}`);
    if (!isRange(v)) err(file, `${id}: market.${k}는 [최소, 최대]`);
  }
}
function checkText(file, id, s) {
  if (typeof s !== 'string' || !s.trim()) { err(file, `${id}: 빈 문장`); return; }
  for (const m of s.matchAll(/\{(\w+)\}/g)) if (!PLACEHOLDERS.has(m[1])) err(file, `${id}: 없는 자리표시 {${m[1]}}`);
}

// 사건
const eventIds = new Map();
const gotos = [];
for (const file of walk(join(DATA, 'events'))) {
  const list = load(file);
  if (!list) continue;
  if (!Array.isArray(list)) { err(file, '사건 파일은 배열이어야 함'); continue; }
  for (const e of list) {
    const id = e.id ?? '(id 없음)';
    if (!/^[a-z0-9_]+$/.test(id)) err(file, `${id}: id는 영문 소문자·숫자·_`);
    if (eventIds.has(id)) err(file, `${id}: id 중복 (${relative(ROOT, eventIds.get(id))})`);
    eventIds.set(id, file);
    for (const k of Object.keys(e)) if (!EVENT_KEYS.has(k)) err(file, `${id}: 없는 사건 키 ${k}`);
    if (e.age != null && !isRange(e.age)) err(file, `${id}: age는 [최소, 최대]`);
    if (e.year != null && !isRange(e.year)) err(file, `${id}: year는 [최소, 최대]`);
    checkWhen(file, id, e.when);
    if (e.market) checkMarket(file, id, e.market);
    checkText(file, id, e.text);
    const ch = e.choices;
    if (!Array.isArray(ch) || ch.length < 1 || ch.length > 4) { err(file, `${id}: 선택지는 1~4개`); continue; }
    if (!Number.isInteger(e.default) || e.default < 0 || e.default >= ch.length) err(file, `${id}: default가 선택지 범위 밖`);
    ch.forEach((c, i) => {
      if (typeof c.label !== 'string' || !c.label.trim()) err(file, `${id}: 선택지 ${i} 이름 없음`);
      for (const k of Object.keys(c)) if (!CHOICE_KEYS.has(k)) err(file, `${id}: 없는 선택지 키 ${k}`);
      if (c.result !== undefined) checkText(file, id, c.result);
      checkWhen(file, id, c.when);
      if (c.check && !((STATS.includes(c.check.stat) || AXES.includes(c.check.trait)) && Number.isFinite(c.check.dc)))
        err(file, `${id}: check는 {stat|trait, dc}`);
      if (c.fail) { checkEffects(file, id, c.fail.effects); if (c.fail.result) checkText(file, id, c.fail.result); }
      checkEffects(file, id, c.effects);
    });
  }
}
for (const [file, id, target] of gotos) if (!eventIds.has(target)) warn(file, `${id}: goto 대상 ${target} 없음`);

// GPT 작업 결과물 (있을 때만)
const ach = join(DATA, 'achievements.json');
if (existsSync(ach)) {
  const d = load(ach); const seen = new Set();
  for (const a of d?.items ?? []) {
    if (seen.has(a.id)) err(ach, `id 중복 ${a.id}`); seen.add(a.id);
    if (!['achievement', 'title'].includes(a.kind)) err(ach, `${a.id}: kind는 achievement|title`);
    if (!['common', 'rare', 'epic', 'legend'].includes(a.rarity)) err(ach, `${a.id}: rarity 오류`);
    if (!a.name || !a.desc || !a.condition_ko) err(ach, `${a.id}: name/desc/condition_ko 필요`);
    checkWhen(ach, a.id, a.when);
  }
}
const news = join(DATA, 'news_general.json');
if (existsSync(news)) {
  const d = load(news);
  const years = new Set((d?.years ?? []).map((y) => y.year));
  for (let y = 1940; y <= 2026; y++) if (!years.has(y)) err(news, `${y}년 없음`);
  for (const y of d?.years ?? []) if (!Array.isArray(y.headlines_ko) || !y.headlines_ko.length) err(news, `${y.year}: 헤드라인 없음`);
}
const names = join(DATA, 'names.json');
if (existsSync(names)) {
  const d = load(names);
  if (!d?.surnames?.length) err(names, 'surnames 없음');
  for (const [dec, v] of Object.entries(d?.given ?? {})) if (!v.m?.length || !v.f?.length) err(names, `${dec}: 남·여 이름 필요`);
}
const review = join(DATA, 'review_text.json');
if (existsSync(review)) {
  const d = load(review);
  const texts = [...(d?.summary_templates ?? []), ...Object.values(d?.trait_lines ?? {}).flat(),
    ...(d?.semi_cards ?? []).flatMap((c) => [c.title, c.line]), ...(d?.epitaphs ?? []).map((e) => e.text),
    ...(d?.death_causes ?? []).map((e) => e.text)];
  texts.forEach((t, i) => checkText(review, `문구${i}`, t));
}
for (const file of walk(DATA)) load(file);

for (const w of warnings) console.log(`경고  ${w}`);
for (const e of errors) console.log(`오류  ${e}`);
console.log(`\n사건 ${eventIds.size}개, 직업 ${jobIds.size}개(세부 ${matrixJobs.length}) 검사 — 오류 ${errors.length}개, 경고 ${warnings.length}개`);
process.exit(errors.length ? 1 : 0);
