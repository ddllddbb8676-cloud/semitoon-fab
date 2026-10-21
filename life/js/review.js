// 엔딩·되돌아보기 (담당: Claude, DOM 없음) — SYSTEMS 11장 간단형
// review(L) → 화면이 그대로 그릴 수 있는 묶음 { lastLine, title, ribbons, score, bars, traits, timeline, semi, industry, numbers, ... }

import { TRAIT_NAMES, KIND_NAMES, clamp, lerpTable, activeTraits, josa } from './core.js';
import { jobName, ro } from './career.js';

const COHORT_TARGET = [[1940, 76], [1960, 80], [1980, 84], [2000, 87], [2020, 89]];
const KIND_ORDER = ['core', 'near', 'eco', 'money', 'family', 'school', 'place', 'history', 'everyday'];

// 사다리별 최고 직급 비율이 가장 높은 것 { ratio, ladder, rank }
function bestRank(L) {
  const { s, D } = L;
  let best = { ratio: 0, ladder: null, rank: 0 };
  for (const [lad, r] of Object.entries(s.career.best_ranks ?? {})) {
    const n = D.ladders[lad]?.ranks?.length ?? 0;
    if (n > 1 && r / (n - 1) >= best.ratio) best = { ratio: Math.min(1, r / (n - 1)), ladder: lad, rank: r };
  }
  return best;
}

export function lifeScore(L) {
  const { s } = L;
  let hs = 0, hw = 0;
  for (const h of s.hist) { const age = h.y - s.profile.birth_year; const w = age >= 20 ? 1.5 : 1; hs += h.h * w; hw += w; }
  const happy = hw ? hs / hw : s.happiness;
  const age = s.dead?.age ?? s.age;
  const health = clamp(50 + 5 * (age - lerpTable(COHORT_TARGET, s.profile.birth_year)), 0, 100);
  const wealth = clamp(25 * Math.log2(1 + Math.max(0, s.money.best_networth_ratio ?? 0)), 0, 100);
  const rel = (s.flags.married_once ? 25 : 0) + Math.min(30, 10 * s.relations.children.length) + Math.min(30, 0.3 * (s.relations.best_friends ?? s.relations.friends))
    + (s.profile.family.harmony >= 60 ? 15 : 0);
  const hasLadder = s.career.history.length || s.career.job;
  const career = hasLadder ? clamp((s.career.best_rep ?? 50) * 0.5 + 50 * bestRank(L).ratio, 0, 100) : 0;
  const semiCount = s.semi.filter((m) => m.kind !== 'everyday').length;
  const semi = Math.min(100, 15 * semiCount + ((s.career.core_years ?? 0) >= 10 ? 20 : 0) + (s.flags.parent_semi || s.relations.children.some((c) => c.semi) ? 10 : 0));
  const bars = [
    { id: 'happiness', name: '행복', value: Math.round(happy), weight: 0.25 },
    { id: 'health', name: '건강·수명', value: Math.round(health), weight: 0.15 },
    { id: 'wealth', name: '재산', value: Math.round(wealth), weight: 0.15 },
    { id: 'relations', name: '관계', value: Math.round(clamp(rel, 0, 100)), weight: 0.2 },
    { id: 'career', name: '커리어', value: Math.round(career), weight: 0.15 },
    { id: 'semi', name: '반도체', value: Math.round(semi), weight: 0.1 },
  ];
  return { score: Math.round(bars.reduce((a, b) => a + b.value * b.weight, 0) * 10), bars };
}

// 11.6 인생 칭호 (조건이 맞는 것 중 우선순위 순)
export function lifeTitles(L) {
  const { s, D } = L;
  const f = s.flags;
  const c = s.career;
  const sy = c.sector_years ?? {};
  const br = c.best_ranks ?? {};
  const topReached = (lad) => (br[lad] ?? -1) >= (D.ladders[lad]?.ranks?.length ?? 99) - 1;
  const rehired = (flag) => f[flag] && [...c.history.map((h) => h.from), c.job ? c.since : null].some((y) => y && y > f[flag] && y <= f[flag] + 3);
  const founded = Object.values(L.W.ws.co).find((x) => x.player);
  const firstSemi = s.semi.find((m) => m.kind !== 'everyday');
  const childSemi = s.relations.children.some((ch) => ch.semi);
  const list = [
    ['반도체 신화', (br.corporate ?? 0) >= 7 || (br.research ?? 0) >= 6 || ((c.exec || f.became_exec) && (c.core_years ?? 0) >= 20)],
    ['현장의 전설', topReached('craft') || topReached('production')],
    ['1세대 엔지니어', s.profile.birth_year < 1960 && f.first_core_year && f.first_core_year < 1985],
    ['반도체 가족', f.parent_semi && (c.core_years ?? 0) > 0 && childSemi],
    ['창업가', f.founded_company && founded && ((founded.gone || s.year) - founded.founded >= 10)],
    ['IMF를 견딘 사람', f.imf_survived || rehired('imf_laid_off')],
    ['동학개미', f.covid_ant || f.crisis2008_bought],
    ['세계를 누빈 엔지니어', f.overseas_post],
    ['팹을 지은 손', (sy.construction ?? 0) >= 10],
    ['클린룸의 밥심', (sy.catering ?? 0) >= 10],
    ['게이트의 수호자', (sy.security ?? 0) >= 10 || f.retire_rehired],
    ['공장 앞 사장님', (c.exp.chicken_shop ?? 0) + (sy.landlord ?? 0) >= 10],
    ['소신 엔지니어', (s.titles['소신 엔지니어'] ?? 0) >= 3],
    ['늦게 만난 반도체', firstSemi && firstSemi.age >= 60],
    ['교수님', (br.academic ?? 0) >= 3],
    ['워라밸 수호자', (s.traitsYears['가정적'] ?? 0) >= 20 && s.relations.children.length >= 2],
    ['백 세 인생', (s.dead?.age ?? s.age) >= 100],
    ['반도체를 피해 간 사람', s.semi.length > 0 && s.semi.every((m) => m.kind === 'everyday')],
  ].filter(([, ok]) => ok).map(([t]) => t);
  list.push('평범하지만 단단한 삶');
  return list;
}

// 11.2 연표 요약
function timelineSummary(L) {
  const { s } = L;
  const imp3 = s.log.filter((x) => x.importance >= 3);
  const imp2 = s.log.filter((x) => x.importance === 2);
  const picked = [...imp3];
  for (const x of imp2) { if (picked.length >= 14) break; picked.push(x); }
  picked.sort((a, b) => a.year - b.year || s.log.indexOf(a) - s.log.indexOf(b));
  const byYear = [];
  for (const x of picked) {
    const last = byYear[byYear.length - 1];
    if (last && last.year === x.year) last.text += ` · ${x.text}`;
    else byYear.push({ year: x.year, age: x.age, text: x.text, importance: x.importance });
  }
  return byYear.slice(0, 12);
}

// 11.3 반도체 순간 카드 (최대 5장)
function semiCards(L) {
  const { s, W } = L;
  const m = s.semi;
  if (!m.length) return [];
  const pick = [m[0]];
  const rest = m.slice(1, -1).sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
  for (const x of rest) { if (pick.length >= 4) break; if (!pick.includes(x)) pick.push(x); }
  if (m.length > 1 && !pick.includes(m[m.length - 1])) pick.push(m[m.length - 1]);
  return pick.sort((a, b) => a.year - b.year).slice(0, 5).map((x) => ({ ...x, kindName: KIND_NAMES[x.kind] ?? '', market: W.marketWord(x.year) }));
}

// 11.4 업계 연표
function industryTimeline(L) {
  const { s, W } = L;
  const from = s.profile.birth_year;
  const to = s.dead?.year ?? s.year;
  const myCos = new Set([s.career.company, ...s.career.history.map((h) => h.company), ...Object.keys(s.money.stocks)].filter(Boolean));
  const items = W.ws.timeline.filter((t) => t.year >= from && t.year <= to && t.kind !== 'founded').map((t) => ({ ...t, mine: t.companies.some((id) => myCos.has(id)) }));
  const out = [...items.filter((t) => t.mine), ...items.filter((t) => !t.mine && ['leader', 'bankrupt', 'acquired'].includes(t.kind))];
  for (let y = from; y <= to && out.length < 10; y++) {
    const row = W.marketRow(y);
    if (row && Math.abs(row.cycle ?? 0) >= 2) { const h = W.headline(y); if (h) out.push({ year: y, kind: 'history', text: h }); }
  }
  const seen = new Set();
  return out.filter((t) => (seen.has(t.text) ? false : seen.add(t.text))).slice(0, 10).sort((a, b) => a.year - b.year)
    .map((t) => ({ year: t.year, kind: t.kind, text: t.kind === 'history' ? `${t.year}년 ${t.text}` : t.text, mine: !!t.mine }));
}

// 되돌아보기 문구(GPT review_text.json)용 자리표시
function reviewVars(L, title) {
  const { s, D, W } = L;
  const c = s.career;
  const exp = Object.entries(c.exp).sort((a, b) => b[1] - a[1])[0];
  const mainJob = exp ? D.jobById.get(exp[0])?.name : null;
  const coYears = {};
  for (const h of c.history) if (h.company && h.job === exp?.[0]) coYears[h.company] = (coYears[h.company] ?? 0) + (h.to - h.from);
  if (c.company && c.job === exp?.[0]) coYears[c.company] = (coYears[c.company] ?? 0) + c.years;
  const mainCo = Object.entries(coYears).sort((a, b) => b[1] - a[1])[0]?.[0];
  const traits = activeTraits(s).sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  const happy = [...s.hist].sort((a, b) => b.h - a.h);
  return {
    name: s.profile.name, birth_year: s.profile.birth_year, death_year: s.dead?.year ?? s.year, age: s.dead?.age ?? s.age,
    region: D.regions.get(s.profile.birth_region)?.name ?? '', main_job: mainJob, main_company: mainCo ? W.companyName(mainCo) : null,
    career_years: exp?.[1] ?? null, trait_top: traits[0]?.name ?? null, trait_second: traits[1]?.name ?? null,
    children: s.relations.children.length || null, semi_count: s.semi.length, best_year: happy[0]?.y ?? null, worst_year: happy[happy.length - 1]?.y ?? null, title,
  };
}
function pickLine(L, list, vars) {
  const ok = (list ?? []).filter((t) => typeof t === 'string' && [...t.matchAll(/\{(\w+)\}/g)].every((m) => vars[m[1]] !== null && vars[m[1]] !== undefined));
  if (!ok.length) return null;
  const t = ok[Math.floor(L.rng.next() * ok.length)];
  return t.replace(/\{(\w+)\}/g, (_, k) => String(vars[k]));
}

export function review(L) {
  const { s, D, W } = L;
  const d = s.dead ?? { year: s.year, age: s.age, cause: '노환', kind: 'old_age' };
  const region = D.regions.get(s.profile.region)?.name ?? '';
  const lastLine = d.dementia
    ? `${s.profile.name}, ${s.profile.birth_year}~${d.year} (${d.age}세). 가족 곁에서 조용히 눈을 감았어요.`
    : `${s.profile.name}, ${s.profile.birth_year}~${d.year} (${d.age}세). ${region}에서 ${ro(d.cause)} 눈을 감았어요.`;
  const titles = lifeTitles(L);
  const { score, bars } = lifeScore(L);
  const traits = activeTraits(s).sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 3);
  const longest = Object.entries(s.traitsYears).sort((a, b) => b[1] - a[1])[0];
  const c = s.career;
  const b = bestRank(L);
  const bestRankName = b.ladder ? D.ladders[b.ladder]?.ranks?.[b.rank] : null;
  const avg = W.econ(d.year).avg_wage;
  const numbers = [
    { label: '최고 연봉', value: c.history.length || c.job ? `그 해 평균의 ${(s.money.best_salary_ratio ?? 0).toFixed(1)}배` : '—' },
    { label: '총 경력', value: `${c.total_years ?? 0}년` },
    { label: '이직', value: `${c.moves ?? 0}번` },
    { label: '최고 직급', value: bestRankName ?? '—' },
    { label: '순자산', value: `그 해 평균 연봉의 ${((s.money.networth ?? 0) / avg).toFixed(1)}배` },
    { label: '자녀', value: `${s.relations.children.length}명` },
    { label: '집', value: `${s.money.houses.length}채` },
  ];
  // GPT 되돌아보기 문구가 있으면 사용
  const R = D.review;
  const vars = reviewVars(L, titles[0]);
  const summary = R ? pickLine(L, R.summary_templates, vars) : null;
  const traitLines = R ? traits.map((t) => pickLine(L, R.trait_lines?.[`${t.axis}${t.sign}`], vars)).filter(Boolean) : [];
  const group = (c.job ? D.jobById.get(c.job) : D.jobById.get(c.history.at(-1)?.job))?.group;
  const epitaph = R ? pickLine(L, (R.epitaphs ?? []).filter((e) => (!e.group || e.group === group) && (!traits[0] || !e.trait || e.trait === `${traits[0].axis}${traits[0].sign}`)).map((e) => e.text), vars) : null;
  const causeKind = { old_age: 'old_age', illness: 'illness', cancer: 'illness', heart: 'illness', accident: 'accident', young: 'accident' }[d.kind] ?? 'old_age';
  const causeLine = R ? pickLine(L, (R.death_causes ?? []).filter((x) => x.kind === causeKind).map((x) => x.text), vars) : null;
  return {
    name: s.profile.name, birthYear: s.profile.birth_year, deathYear: d.year, age: d.age, cause: d.cause, seed: s.seed,
    lastLine, causeLine, summary, epitaph, title: titles[0], ribbons: titles.slice(1, 4), score, bars,
    traits: traits.map((t) => ({ name: t.name, axis: t.axis, sign: t.sign })), traitLines,
    longestTrait: longest ? { name: longest[0], years: longest[1] } : null,
    timeline: timelineSummary(L), semi: semiCards(L), industry: industryTimeline(L), numbers,
    path: [s.education.level, ...new Set(c.history.map((h) => D.jobById.get(h.job)?.name).filter(Boolean))].slice(0, 4).join(' → '),
    job: c.job ? jobName(L) : null,
  };
}

export { TRAIT_NAMES, josa };
