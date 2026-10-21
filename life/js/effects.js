// 선택지 효과 적용 (담당: Claude, DOM 없음) — SPEC "effects 키", SYSTEMS 1.4 순서
// 순서: do → 능력치·성향·행복·평판·친구 → cash/debt → flag → semi → title_progress → goto

import { STATS, STAT_NAMES, AXES, TRAIT_NAMES, clamp, hasTrait, addFlag, addLog, addSemi, asArray, warnOnce, josa } from './core.js';
import { plasticity, revealTalent, DISEASES } from './health.js';
import { resolveMoney, doHouse, doInvest, doCoin, doStock, doIndex, investValue } from './money.js';
import { hire, hireDirect, clearJob, retireNow, workRegion, moveTo, jobName } from './career.js';
import { doSchool, doMajor, doMilitary } from './school.js';
import { doPartner, doChild, surnameOf } from './family.js';

// 판정 성공 확률 (1.4): clamp(0.5 + (값 − dc)/50 + 특징 보너스, 0.1, 0.9)
export function checkChance(L, choice) {
  const { s } = L;
  const ck = choice.check;
  if (!ck) return 1;
  let v;
  if (ck.stat) v = s.stats[ck.stat] ?? 50;
  else if (ck.trait) v = ((s.traits[ck.trait] ?? 0) + 100) / 2;
  else return 1;
  let b = 0;
  const eff = choice.effects ?? {};
  if (hasTrait(s, 'diligence', '+') && ['intelligence', 'dexterity'].includes(ck.stat)) b += 0.05;
  if (hasTrait(s, 'risk', '+') && (eff['trait.risk'] ?? 0) > 0) b += 0.05;
  if (hasTrait(s, 'social', '+') && ck.stat === 'sociability') b += 0.1;
  if (hasTrait(s, 'social', '-') && ck.stat === 'intelligence') b += 0.05;
  if (hasTrait(s, 'outlook', '+') && ck.stat === 'mental') b += 0.1;
  if (hasTrait(s, 'outlook', '-') && ck.stat === 'mental') b -= 0.05;
  if (hasTrait(s, 'conform', '-') && (eff['trait.conform'] ?? 0) < 0) b += 0.05;
  return clamp(0.5 + (v - (ck.dc ?? 50)) / 50 + b, 0.1, 0.9);
}

// 효과 전후 상태를 비교해 결과 카드 칩을 만듭니다 (do 동작이 바꾼 것까지 한 번에)
function snap(L) {
  const { s } = L;
  const m = s.money;
  const c = s.career;
  return {
    stats: { ...s.stats }, happiness: s.happiness, rep: c.reputation, friends: s.relations.friends, traits: { ...s.traits },
    cash: m.cash, debt: m.debt, inv: investValue(L), houses: m.houses.length,
    partner: s.relations.partner?.name ?? null, married: !!s.relations.partner?.married, kids: s.relations.children.length,
    job: c.job ? `${c.job}|${c.company}|${c.employment}` : null, rank: c.rank, smod: c.salary_mod ?? 0,
  };
}
const num = (label, v, unit = '') => ({ label: `${label} ${v > 0 ? '+' : '−'}${Math.abs(v)}${unit}`, tone: v > 0 ? 'good' : 'bad' });
export function diffChips(L, a, b) {
  const { s } = L;
  const out = [];
  for (const k of STATS) { const v = Math.round(b.stats[k] - a.stats[k]); if (v) out.push(num(STAT_NAMES[k], v)); }
  const h = Math.round(b.happiness - a.happiness); if (h) out.push(num('행복', h));
  const r = Math.round(b.rep - a.rep); if (r && a.job === b.job) out.push(num('평판', r));
  const f = Math.round(b.friends - a.friends); if (f) out.push(num('친구', f));
  for (const ax of AXES) {
    const d = b.traits[ax] - a.traits[ax];
    if (Math.abs(d) < 2) continue;
    out.push({ label: `${TRAIT_NAMES[ax][d > 0 ? 1 : 0]} ${Math.abs(d) >= 8 ? '↑↑' : '↑'}`, tone: 'trait' });
  }
  const dc = b.cash - a.cash;
  const dInv = b.inv - a.inv;
  const dd = b.debt - a.debt;
  if (Math.abs(dc) >= 1) out.push({ label: '현금', money: dc, tone: dc > 0 ? 'good' : 'bad' });
  if (Math.abs(dInv) >= 1) out.push({ label: '투자', money: dInv, tone: 'money' });
  if (Math.abs(dd) >= 1) out.push({ label: '빚', money: dd, tone: dd > 0 ? 'bad' : 'good' });
  if (b.houses !== a.houses) out.push({ label: b.houses > a.houses ? '내 집 +1' : '집 −1', tone: b.houses > a.houses ? 'good' : 'bad' });
  if (!a.partner && b.partner) out.push({ label: `연인 · ${b.partner}`, tone: 'good' });
  else if (a.partner && !b.partner) out.push({ label: a.married ? '이혼' : '이별', tone: 'bad' });
  else if (!a.married && b.married) out.push({ label: '결혼', tone: 'good' });
  if (b.kids > a.kids) out.push({ label: `아이 +${b.kids - a.kids}`, tone: 'good' });
  if (a.job !== b.job) out.push({ label: b.job ? (a.job ? '새 직장' : '취업') : '퇴사', tone: b.job ? 'good' : 'bad' });
  else if (b.job && b.rank > a.rank) out.push({ label: '직급 ↑', tone: 'good' });
  const sm = Math.round(100 * (b.smod - a.smod)); if (sm && a.job === b.job) out.push(num('연봉', sm, '%'));
  void s;
  return out;
}

// effects 하나를 적용하고 변화 칩 목록을 돌려줍니다. ctx: 사건 맥락(라이벌·제안·아이 이름 등) + notes/cancelGoto/requeue
export function applyEffects(L, eff, ctx, ev) {
  const { s } = L;
  ctx.notes ??= [];
  ctx.semiAdded = !!eff.semi;
  ctx.eventId = ev?.id ?? null;
  const tags = ev?.tags ?? [];
  const before = snap(L);
  const extra = [];

  for (const act of asArray(eff.do)) doAction(L, String(act), ctx);

  for (const [k, raw] of Object.entries(eff)) {
    if (STATS.includes(k)) {
      const v = Number(raw) || 0;
      s.stats[k] = clamp(s.stats[k] + v, 0, 100);
    } else if (k.startsWith('trait.')) {
      const axis = k.slice(6);
      if (!AXES.includes(axis)) { warnOnce(`trait-${axis}`, `알 수 없는 성향 축: ${axis}`); continue; }
      s.traits[axis] = clamp(s.traits[axis] + (Number(raw) || 0) * plasticity(s.age), -100, 100);
    } else if (k === 'happiness') {
      let v = Number(raw) || 0;
      if (v < 0) v *= (hasTrait(s, 'diligence', '-') ? 0.8 : 1) * (hasTrait(s, 'outlook', '+') ? 0.7 : 1) * (hasTrait(s, 'outlook', '-') ? 1.3 : 1);
      if (v > 0 && tags.includes('family') && hasTrait(s, 'work_life', '-')) v *= 1.2;
      s.happiness = clamp(s.happiness + Math.round(v), 0, 100);
    } else if (k === 'reputation') {
      const v = Math.round((Number(raw) || 0) * (hasTrait(s, 'work_life', '+') ? 1.2 : 1));
      s.career.reputation = clamp(s.career.reputation + v, 0, 100);
    } else if (k === 'friends') {
      s.relations.friends = clamp(s.relations.friends + (Number(raw) || 0), 0, 100);
    }
  }

  if (eff.cash !== undefined) {
    let v = resolveMoney(L, eff.cash);
    if (v !== null) {
      if (v < 0) {
        v *= hasTrait(s, 'thrift', '+') ? 0.85 : hasTrait(s, 'thrift', '-') ? 1.15 : 1;
        if (hasTrait(s, 'thrift', '-')) s.happiness = clamp(s.happiness + 2, 0, 100);
      }
      s.money.cash += v;
      if (s.money.cash < 0) { s.money.debt += -s.money.cash; s.money.cash = 0; }
    }
  }
  if (eff.debt !== undefined) {
    const v = resolveMoney(L, eff.debt);
    if (v !== null) {
      const before = s.money.debt;
      s.money.debt = Math.max(0, before + v);
      if (v < 0 && -v > before) s.money.cash += -v - before; // 갚고 남은 돈은 현금으로
    }
  }
  for (const f of asArray(eff.flag)) addFlag(s, f);
  if (eff.semi) {
    const text = typeof eff.semi === 'string' ? eff.semi : eff.semi.text;
    const kind = typeof eff.semi === 'object' && eff.semi.kind ? eff.semi.kind : guessKind(L, tags);
    const filled = ctx.fill ? ctx.fill(text) : text;
    if (addSemi(L, filled, kind, ev?.id)) extra.push({ label: '반도체 순간', tone: 'semi', text: filled });
  }
  if (eff.title_progress) for (const t of asArray(eff.title_progress)) s.titles[t] = (s.titles[t] ?? 0) + (hasTrait(s, 'conform', '-') && t === '소신 엔지니어' ? 2 : 1);
  if (eff.later) for (const l of asArray(eff.later)) scheduleLater(L, l, ev, ctx);
  const gotoId = ctx.cancelGoto ? null : eff.goto ?? null;
  return { chips: [...diffChips(L, before, snap(L)), ...extra], goto: ctx.requeue ?? gotoId };
}

// 나중에 돌아오는 결과 (SPEC effects.later): 해를 정해 s.later에 넣어 두면 events.buildQueue가 그 해에 강제로 띄웁니다
const LATER_CTX = ['company', 'rival', 'acquirer', 'client', 'region', 'child', 'tech', 'skill'];
export function scheduleLater(L, l, ev, ctx = {}) {
  const { s, rng, D } = L;
  if (!l || typeof l.event !== 'string') return;
  if (!D.eventById.has(l.event)) { warnOnce(`later-${l.event}`, `later 대상 사건이 없어요: ${l.event}`); return; }
  if (!rng.chance(l.chance ?? 1)) return;
  const [a, b] = Array.isArray(l.years) ? l.years : [1, 3];
  const lo = Math.max(1, Number(a) || 1);
  const hi = Math.max(lo, Number(b ?? a) || lo);
  const keep = {};
  for (const k of LATER_CTX) if (ctx[k] !== undefined && ctx[k] !== null) keep[k] = ctx[k];
  s.later ??= [];
  s.later_n = (s.later_n ?? 0) + 1;
  s.later.push({ id: l.event, year: s.year + rng.int(lo, hi), made: s.year, from: ev?.id ?? null, pick: ctx.pick ?? null, ctx: keep });
}

// semi 효과가 글자만이면 kind 추정: 지금 직종 touch → 사건 tags → place (SYSTEMS 7)
function guessKind(L, tags) {
  const j = L.s.career.job ? L.D.jobById.get(L.s.career.job) : null;
  if (j && j.touch !== 'none') return j.touch;
  if (tags.includes('invest') || tags.includes('money')) return 'money';
  if (tags.includes('family')) return 'family';
  if (tags.includes('study') || L.s.education.stage) return 'school';
  return 'place';
}

// ---------- do 동작 ----------
const SUPPORTED_NOTE = 'school·major·military·job·salary_mod·salary_mult·bonus·partner·child·house·invest·stock·index·coin·move·wealth·habit·cond·talent·skill_point·again·loan·repay';
export function doAction(L, act, ctx) {
  const { s } = L;
  const [verb, ...args] = act.split(':');
  switch (verb) {
    case 'school': return doSchool(L, args[0], ctx);
    case 'major': return doMajor(L, args[0]);
    case 'military': return doMilitary(L, args[0]);
    case 'job': return doJob(L, args, ctx);
    case 'salary_mod': s.career.salary_mod = (s.career.salary_mod ?? 0) + (Number(args[0]) || 0); return;
    case 'bonus': { const v = resolveMoney(L, args.join(':')); if (v) s.money.cash += v; return; }
    case 'partner': return doPartner(L, args[0]);
    case 'child': return doChild(L, args[0], ctx);
    case 'house': return doHouse(L, args[0]);
    case 'invest': return doInvest(L, args, ctx);
    case 'coin': return doCoin(L, args);
    case 'tenure': {
      // 사는 형태 (간단형): 연말 주거비 배율만 바꿈 — money.settleYear
      if (['jeonse', 'monthly', 'parents', 'dorm'].includes(args[0])) s.money.tenure = args[0];
      else if (args[0] === 'own') { if (s.money.houses.length) s.money.tenure = null; }
      else warnOnce(`do-tenure-${args[0]}`, `지원하지 않는 do: tenure:${args[0]}`);
      return;
    }
    case 'leave': {
      // 육아휴직·출산휴가 (간단형): 그 해 기본급 75%, 평판 조금 (family_policy.json 상세 규칙은 다음 판)
      if (!s.career.job || !['parental', 'maternity'].includes(args[0])) return;
      s.career.parental = { year: s.year, type: args[0] };
      s.career.reputation = clamp(s.career.reputation - (s.year < 2010 ? 4 : 2), 0, 100);
      addFlag(s, args[0] === 'parental' ? 'used_parental_leave' : 'used_maternity_leave');
      return;
    }
    case 'stock': return doStock(L, args, ctx);
    case 'index': return doIndex(L, args);
    case 'salary_mult': {
      const x = Number(args[0]);
      if (x > 0) s.career.salary_mult = { x, until: s.year + Math.max(1, Number(args[1]) || 1) - 1 };
      return;
    }
    case 'move': return doMove(L, args);
    case 'wealth': s.profile.family.wealth = clamp(s.profile.family.wealth + (Number(args[0]) || 0), 1, 5); return;
    case 'habit': {
      const a = args[0] ?? '';
      const id = a.slice(1);
      if (a[0] === '+' && !s.habits.includes(id)) s.habits.push(id);
      if (a[0] === '-') s.habits = s.habits.filter((h) => h !== id);
      return;
    }
    case 'cond': {
      const a = args[0] ?? '';
      const id = a.slice(1);
      if (a[0] === '+' && DISEASES[id] && !s.condition.some((c) => c.id === id)) s.condition.push({ id, year: s.year, treated: true });
      if (a[0] === '-') s.condition = s.condition.filter((c) => c.id !== id);
      return;
    }
    case 'talent': if (args[0] === 'reveal') revealTalent(L, null); return;
    case 'skill_point': s.career.skill_points = (s.career.skill_points ?? 0) + (Number(args[0]) || 0); return;
    case 'again': if (ctx.eventId) s.again[ctx.eventId] = s.year + Math.max(1, Number(args[0]) || 1); return;
    case 'loan': { const v = resolveMoney(L, args.slice(1).join(':')); if (v > 0) { s.money.cash += v; s.money.debt += v; } return; }
    case 'repay': { const v = Math.min(resolveMoney(L, args.slice(1).join(':')) ?? 0, s.money.cash, s.money.debt); if (v > 0) { s.money.cash -= v; s.money.debt -= v; } return; }
    default:
      warnOnce(`do-${verb}`, `지원하지 않는 do: ${act} (무시함 · v0 지원: ${SUPPORTED_NOTE})`);
  }
}

function doMove(L, args) {
  const { s } = L;
  if (args[0] === 'overseas') {
    const n = Number(args[1]) || 3;
    if (s.career.job) { s.career.home_region = s.career.region; s.career.region = 'overseas'; }
    s.abroad_until = s.year + n;
    addLog(L, `${n}년 동안 해외에서 일하게 됐어요`, 2, 'work');
    return;
  }
  if (args[0] === 'company') { if (s.career.region && s.career.region !== 'overseas') moveTo(L, s.career.region); return; }
  if (L.D.regions.has(args[0])) { moveTo(L, args[0]); return; }
  warnOnce(`do-move-${args[0]}`, `지원하지 않는 do: move:${args.join(':')}`);
}

function doJob(L, args, ctx) {
  const { s, W, D, rng } = L;
  const [what, id] = args;
  const c = s.career;
  switch (what) {
    case 'offer1': case 'offer2': case 'offer3': {
      const o = ctx.offers?.[Number(what.slice(-1)) - 1];
      if (o) hire(L, o, { semiAdded: ctx.semiAdded });
      return;
    }
    case 'rival': {
      const lastJob = c.job ?? c.history.at(-1)?.job ?? 'operator';
      const from = ctx.company ?? c.company ?? c.history.at(-1)?.company;
      const rv = W.co(ctx.rival) ?? W.rival(from, rng);
      if (!rv) return;
      hire(L, { job: lastJob, company: rv.id, employment: 'regular', region: ctx.region ?? workRegion(L, rv) },
        { keepRank: true, rankUp: !!ctx.rankUp, salaryMod: (c.salary_mod ?? 0) + (ctx.mod ?? 0.1), semiAdded: ctx.semiAdded });
      return;
    }
    case 'stay': case 'wait': return;
    case 'quit':
      if (c.job) { addLog(L, `${josa(W.companyName(c.company) || jobName(L), '을', '를')} 떠났어요`, 2, 'work'); clearJob(L, 'quit'); }
      return;
    case 'rest': s.rest_year = s.year + 1; if (c.job && ctx.eventId === 'company_bankrupt') clearJob(L, 'rest'); return;
    case 'search':
      if (c.job && !c.military_job) { addLog(L, '일을 그만두고 새 일자리를 찾기로 했어요', 2, 'work'); clearJob(L, 'search'); }
      return;
    case 'look': s.look_year = s.year + 1; return;
    case 'transfer': return transfer(L, ctx);
    case 'exec': {
      const lad = D.ladders[c.ladder];
      if (c.job && lad?.exec_from !== null && lad?.exec_from !== undefined) {
        c.rank = lad.exec_from; c.rank_years = 0; c.exec = true; c.best_rank = Math.max(c.best_rank ?? 0, c.rank);
        addLog(L, `${lad.ranks[c.rank]} 자리에 올랐어요`, 2, 'work');
        L.emit?.('promo', { rank: c.rank, name: lad.ranks[c.rank], exec: true });
      }
      return;
    }
    case 'retire':
      if (c.job) retireNow(L, null);
      else { s.retired = true; s.retired_year ??= s.year; }
      return;
    case 'hire': hireDirect(L, id, { semiAdded: ctx.semiAdded }); return;
    case 'owner': {
      const j = D.jobById.get(id);
      if (j) hire(L, { job: id, company: null, employment: 'owner', region: s.profile.region }, { semiAdded: ctx.semiAdded });
      return;
    }
    case 'side':
      if (D.jobById.get(id) && !c.side_jobs.includes(id) && c.side_jobs.length < 2) {
        c.side_jobs.push(id);
        addLog(L, `${D.jobById.get(id).name} 일을 함께 시작했어요`, 2, 'work');
      }
      return;
    case 'found': {
      if (!D.sectorById.get(id)) return;
      const sur = surnameOf(s.profile.name) || '새';
      const co = W.foundCompany(id, `${sur}${rng.pick(['테크', '세미', '이엔지', '솔루션'])}`, s.year);
      const job = c.job ?? 'equipment_engineer';
      const lad = D.ladders[D.jobById.get(job)?.ladder ?? 'corporate'];
      hire(L, { job, company: co.id, employment: 'regular', region: co.regions[0] }, { exec: (lad?.ranks?.length ?? 8) - 1, founder: true, semiAdded: ctx.semiAdded });
      addFlag(s, 'founded_company');
      return;
    }
    default: warnOnce(`do-job-${what}`, `지원하지 않는 do: job:${args.join(':')}`);
  }
}

// 전적 (5.6): 같은 원청을 상대하는 협력사·자회사로, salary_mod −0.15
function transfer(L, ctx) {
  const { s, W, rng } = L;
  const c = s.career;
  const cur = W.co(c.company) ?? W.co(ctx.company);
  const job = c.job ?? c.history.at(-1)?.job;
  if (!job) return;
  const client = c.client ?? (cur?.clients ? cur.clients[0] : cur?.id);
  const sectors = cur?.clients ? [cur.sector] : ['equipment_korea', 'packaging', 'materials'];
  const list = W.allAlive().filter((x) => sectors.includes(x.sector) && x.id !== cur?.id && x.regions.some((r) => r !== 'overseas'));
  const target = list.find((x) => x.clients?.includes(client)) ?? (list.length ? rng.pick(list) : null);
  if (!target) {
    if (rng.chance(0.5)) return;
    clearJob(L, 'transfer_failed');
    return;
  }
  hire(L, { job, company: target.id, employment: c.employment === 'daily' ? 'daily' : 'contract', region: workRegion(L, target) },
    { keepRank: true, salaryMod: (c.salary_mod ?? 0) - 0.15, quiet: false });
}

