// 데이터 불러오기와 색인 (담당: Claude, DOM·fs 없음)
// 브라우저(main.js)는 fetch로, 시뮬레이터(tools/life_sim.mjs)는 fs로 읽어 같은 loadData()에 넘깁니다.
//   read(path)  → Promise<JSON | null>   (path는 life/data/ 기준, 없으면 null)
//   list(dir)   → Promise<string[] | null> (디렉터리 목록, 하위 폴더는 'gpt/'처럼 끝에 /. 모르면 null)

import { prepareData } from './future.js';
import { warnOnce } from './core.js';

const REQUIRED = {
  character: 'character.json', jobs: 'jobs.json', companies: 'companies.json', matrix: 'job_matrix.json',
  market: 'market_history.json', economy: 'economy_history.json', family: 'family_policy.json', nameMap: 'name_map.json',
  tech: 'future_tech.json', scen: 'future_scenarios.json', coin: 'coin_history.json',
};
const STAGE_FILES = ['infant', 'child', 'teen', 'young', 'middle', 'senior', 'major'].map((n) => `events/${n}.json`);
// 사건 폴더의 그 밖의 Claude 사건 파일 (있을 때만). 목록을 못 얻으면 이 이름만 시도합니다.
const EXTRA_EVENT_FILES = ['events/drama.json'];
// GPT 콘텐츠: 있으면 쓰고, 없으면 건너뜁니다 (AGENTS.md 역할표)
const OPTIONAL = {
  names: 'names.json', news: 'news_general.json', review: 'review_text.json', achievements: 'achievements.json',
  jobsExtra: 'jobs_extra.json', matrixExtra: 'job_matrix_extra.json',
};
// 디렉터리 목록을 못 얻는 서버(예: GitHub Pages)에서 시도할 이름 (life/tasks/gpt 지시서의 저장 위치)
const GPT_EVENT_FILES = [
  'jobs_field', 'jobs_office', 'jobs_trade', 'jobs_service', 'jobs_eco',
  'future_tech', 'future_life', 'future_work',
  'dims_process', 'dims_product', 'dims_pkg', 'dims_design', 'dims_material', 'dims_facility', 'dims_system', 'dims_roles',
].map((n) => `events/gpt/${n}.json`);

export async function loadData(read, list = async () => null) {
  const raw = {};
  await Promise.all(Object.entries(REQUIRED).map(async ([k, f]) => {
    raw[k] = await read(f);
    if (!raw[k]) throw new Error(`데이터 파일을 읽지 못했어요: ${f}`);
  }));
  raw.stageEvents = await Promise.all(STAGE_FILES.map(async (f) => ({ file: f, list: (await read(f)) ?? [] })));

  // 선택 파일: 목록을 얻을 수 있으면 있는 것만 읽어 404를 만들지 않습니다
  const rootList = await safeList(list, '');
  const present = (f) => !rootList || rootList.includes(f);
  await Promise.all(Object.entries(OPTIONAL).map(async ([k, f]) => { raw[k] = present(f) ? await read(f) : null; }));

  let gptFiles = GPT_EVENT_FILES;
  let extraFiles = EXTRA_EVENT_FILES;
  if (rootList) {
    const evList = rootList.includes('events/') ? await safeList(list, 'events/') : null;
    const gptList = evList?.includes('gpt/') ? await safeList(list, 'events/gpt/') : [];
    gptFiles = (gptList ?? []).filter((f) => f.endsWith('.json')).map((f) => `events/gpt/${f}`);
    extraFiles = (evList ?? []).filter((f) => f.endsWith('.json') && !STAGE_FILES.includes(`events/${f}`)).map((f) => `events/${f}`);
  }
  raw.extraEvents = (await Promise.all(extraFiles.map(async (f) => ({ file: f, list: await read(f) })))).filter((x) => Array.isArray(x.list));
  raw.gptEvents = (await Promise.all(gptFiles.map(async (f) => ({ file: f, list: await read(f) })))).filter((x) => Array.isArray(x.list));
  return buildData(raw);
}

async function safeList(list, dir) {
  try { const r = await list(dir); return Array.isArray(r) ? r : null; } catch { return null; }
}

// ---------- 세부 직업 펼치기 (life/tools/jobs_expand.mjs와 같은 규칙) ----------

export function mergeMatrix(m, extra) {
  if (!extra) return m;
  const out = { ...m, dimensions: { ...m.dimensions }, roles: [...m.roles, ...(extra.roles ?? [])] };
  for (const [dim, vals] of Object.entries(extra.dimensions ?? {})) out.dimensions[dim] = [...(out.dimensions[dim] ?? []), ...vals];
  return out;
}
function combos(role, dims) {
  let out = [{}];
  for (const d of role.dims) {
    const allowed = role.only?.[d];
    const vals = (dims[d] ?? []).filter((v) => !allowed || allowed.includes(v.id));
    out = out.flatMap((c) => vals.map((v) => ({ ...c, [d]: v })));
  }
  return out.filter((c) => Object.values(c).every((v) => Object.entries(v.only ?? {}).every(([od, ids]) => !c[od] || ids.includes(c[od].id))));
}
export function expandMatrix(m) {
  const jobs = [];
  for (const role of m.roles) {
    for (const c of combos(role, m.dimensions)) {
      const vals = role.dims.map((d) => c[d]);
      jobs.push({
        id: [role.id, ...vals.map((v) => v.id)].join('.'),
        name: role.name.replace(/\{(\w+)\}/g, (_, d) => c[d]?.name ?? `{${d}}`),
        role: role.id, parent: role.parent, group: role.group, touch: role.touch,
        stats: role.stats, education: role.education, employment: role.employment,
        shift: role.shift ?? false, sectors: role.sectors ?? [...new Set(vals.map((v) => v.sector).filter(Boolean))],
        since: Math.max(role.since, ...vals.map((v) => v.since ?? 0)),
        future: vals.some((v) => v.future),
        dims: Object.fromEntries(role.dims.map((d) => [d, c[d].id])),
      });
    }
  }
  return jobs;
}

// ---------- 색인 ----------

export function buildData(raw) {
  const D = { raw };
  D.char = raw.character;
  D.regions = new Map([...raw.character.regions, ...(raw.character.work_only_regions ?? [])].map((r) => [r.id, r]));
  D.areas = new Map((raw.character.areas ?? []).map((a) => [a.id, a]));

  const extraJobs = (raw.jobsExtra?.jobs ?? []).filter((j) => j && j.id && j.ladder);
  D.jobs = [...raw.jobs.jobs, ...extraJobs];
  D.jobById = new Map(D.jobs.map((j) => [j.id, j]));
  D.ladders = raw.jobs.rank_ladders;
  D.majors = raw.jobs.majors ?? [];
  D.employmentNames = Object.fromEntries((raw.jobs.employment_types ?? []).map((e) => [e.id, e.name]));

  D.subJobs = expandMatrix(mergeMatrix(raw.matrix, raw.matrixExtra));
  D.subById = new Map(D.subJobs.map((j) => [j.id, j]));
  D.subByParent = new Map();
  for (const j of D.subJobs) {
    if (!D.subByParent.has(j.parent)) D.subByParent.set(j.parent, []);
    D.subByParent.get(j.parent).push(j);
  }

  D.sectors = raw.companies.sectors;
  D.sectorById = new Map(D.sectors.map((s) => [s.id, s]));
  D.companies = D.sectors.flatMap((s) => s.companies.map((c) => ({ ...c, sector: s.id })));

  D.marketByYear = new Map(raw.market.years.map((r) => [r.year, r]));
  D.econByYear = new Map(raw.economy.years.map((r) => [r.year, r]));
  D.familyPolicy = raw.family;
  D.nameMap = [...(raw.nameMap.pairs ?? [])].sort((a, b) => b.real.length - a.real.length);
  D.future = prepareData({
    tech: raw.tech, scen: raw.scen, jobs: raw.jobs, extra: raw.jobsExtra ?? { jobs: [] }, companies: raw.companies,
    character: raw.character, market: raw.market, economy: raw.economy,
  });

  // 사건: 단계 파일 + major + GPT. id가 겹치면 먼저 읽은 것을 씁니다.
  D.events = [];
  D.eventById = new Map();
  const addEvents = (file, list, source) => {
    for (const ev of list ?? []) {
      if (!ev || typeof ev.id !== 'string' || !Array.isArray(ev.choices) || !ev.choices.length || typeof ev.text !== 'string') {
        warnOnce(`bad-event-${file}`, `${file}: 형식이 맞지 않는 사건을 건너뛰었어요`);
        continue;
      }
      if (D.eventById.has(ev.id)) { warnOnce(`dup-${ev.id}`, `사건 id 중복: ${ev.id} (${file})`); continue; }
      const labels = ev.choices.map((c) => String(c.label ?? '').trim());
      const e = {
        ...ev, _file: file, _source: source, _semi: ev.choices.some((c) => c.effects?.semi || c.fail?.effects?.semi),
        // 비슷한 사건 막기용 (events.js): 문장 앞 12글자, 선택지 이름 묶음
        _head: ev.text.replace(/\s+/g, ' ').trim().slice(0, 12), _labels: labels.join('|'),
        // GPT 공식형 사건 ("…해요 / …쉬어요" 두 갈래)은 가중치를 낮춤
        _formulaic: source === 'gpt' && labels.length === 2 && labels.some((l) => /쉬어|쉬고/.test(l)),
      };
      D.events.push(e);
      D.eventById.set(e.id, e);
    }
  };
  for (const { file, list } of raw.stageEvents) addEvents(file, list, 'claude');
  for (const { file, list } of raw.extraEvents ?? []) addEvents(file, list, 'claude');
  for (const { file, list } of raw.gptEvents ?? []) addEvents(file, list, 'gpt');

  D.names = raw.names ?? null;
  D.newsByYear = new Map((raw.news?.years ?? []).map((r) => [r.year, r]));
  D.review = raw.review ?? null;
  D.achievements = Array.isArray(raw.achievements?.items) ? raw.achievements.items.filter((a) => a && a.id && a.when) : [];
  D.coin = raw.coin ?? null;
  D.optionalLoaded = Object.keys(OPTIONAL).filter((k) => raw[k]).concat((raw.extraEvents ?? []).map((x) => x.file), (raw.gptEvents ?? []).map((x) => x.file));
  return D;
}
