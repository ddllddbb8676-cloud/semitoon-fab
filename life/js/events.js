// 사건 추첨·보여 주기·선택 처리 (담당: Claude, DOM 없음) — SYSTEMS 1.3·1.4·7장
// 한 해의 사건은 큐(s.turn.queue)에 { uid, id, at(0~1 진행률), big, ctx, trigger, syn? }로 들어갑니다.

import { clamp, inRange, hasTrait, stageOf, addLog, STAT_NAMES } from './core.js';
import { matchWhen, matchMarket } from './conditions.js';
import { applyEffects, checkChance } from './effects.js';
import { fill } from './text.js';
import { hotCompany } from './money.js';
import { chanceWord } from './format.js';

// 1.3 한 해 사건 수 N 분포 [N=0, 1, 2, 3]
const N_DIST = {
  infant: [0.4, 0.5, 0.1, 0], child: [0.25, 0.5, 0.2, 0.05], teen: [0.1, 0.45, 0.35, 0.1],
  young: [0.1, 0.4, 0.35, 0.15], middle: [0.15, 0.45, 0.3, 0.1], senior: [0.25, 0.5, 0.2, 0.05],
};
const PLACES = [[], [0.4], [0.25, 0.65], [0.15, 0.45, 0.75]];
// 3.4 특징 → 사건 tags 가중치
const TAG_MULT = [
  ['diligence', '+', { study: 1.3, work: 1.2 }], ['diligence', '-', { study: 0.7, leisure: 1.3 }],
  ['risk', '+', { risk: 1.6, invest: 1.6 }], ['risk', '-', { risk: 0.6, invest: 0.6 }],
  ['thrift', '+', { spend: 0.7 }], ['thrift', '-', { spend: 1.4 }],
  ['work_life', '+', { work: 1.5, family: 0.8 }], ['work_life', '-', { family: 1.4, romance: 1.4, work: 0.8 }],
  ['social', '+', { social: 1.5, romance: 1.5 }], ['social', '-', { social: 0.6 }],
  ['outlook', '+', { conflict: 0.8 }], ['outlook', '-', { health: 1.4 }],
  ['conform', '+', { conflict: 0.7 }], ['conform', '-', { conflict: 1.5, risk: 1.2 }],
];
const STAT_KEYS = ['health', 'intelligence', 'dexterity', 'sociability', 'mental', 'looks'];

let uidSeq = 0;
const newUid = () => `e${Date.now().toString(36)}${(uidSeq++).toString(36)}`;

export function visibleChoices(L, ev) {
  return ev.choices.map((c, i) => ({ c, i })).filter(({ c }) => matchWhen(L, c.when));
}

// 사건이 지금 뜰 수 있나 (opts.triggered: 트리거가 생김, opts.grace: 미뤄진 큰 사건 1년 유예)
export function eligible(L, ev, opts = {}) {
  const { s } = L;
  if (ev.trigger && !opts.triggered) return false;
  const age = s.age;
  if (ev.age && !inRange(age, opts.grace ? [ev.age[0], (ev.age[1] ?? 999) + 1] : ev.age)) return false;
  if (ev.year && !inRange(s.year, ev.year)) return false;
  if (ev.once && s.seen[ev.id] !== undefined && !opts.again) return false;
  if (s.again[ev.id] !== undefined && s.again[ev.id] > s.year) return false;
  if (!matchWhen(L, ev.when) || !matchMarket(L, ev.market)) return false;
  const vis = visibleChoices(L, ev).length;
  return vis >= (ev.trigger || ev.forced || opts.triggered ? 1 : 2);
}

function semiMult(L, ev) {
  const { s, W } = L;
  if (!ev._semi) return 1;
  let m = W.nearFab(s.profile.region, s.year) ? 1.5 : 1;
  if (!s.semi.length) {
    const a = s.age;
    m *= a <= 19 ? (s.flags.parent_semi || W.nearFab(s.profile.region, s.year) ? 1.5 : 1) : a <= 29 ? 2 : a <= 39 ? 3 : a <= 49 ? 4 : a <= 59 ? 6 : 10;
  } else if (s.year - s.semi[s.semi.length - 1].year > 15) m *= 1.5;
  return m;
}
function weightOf(L, ev) {
  const { s } = L;
  let B = 1;
  for (const [k, coef] of Object.entries(ev.bias ?? {})) {
    const x = k.startsWith('trait.') ? (s.traits[k.slice(6)] ?? 0) / 100 : STAT_KEYS.includes(k) ? (s.stats[k] - 50) / 50 : 0;
    B *= 1 + coef * x;
  }
  B = clamp(B, 0.2, 3);
  let T = 1;
  for (const [axis, sign, mults] of TAG_MULT) {
    if (!hasTrait(s, axis, sign)) continue;
    for (const t of ev.tags ?? []) if (mults[t]) T *= mults[t];
  }
  // R: 같은 사건이 몇 해 만에 또 뜨면 어색하니 6년 안에는 막고, 12년 안에는 ×0.3
  const ago = s.seen[ev.id] !== undefined ? s.year - s.seen[ev.id] : 99;
  const R = ev.once ? 1 : ago < 6 ? 0 : ago < 12 ? 0.3 : 1;
  return (ev.weight ?? 1) * B * T * semiMult(L, ev) * R;
}

// 트리거에 맞는 데이터 사건이 없을 때 엔진 기본 동작
function fallback(L, name, ctx, list) {
  const { s } = L;
  if (name === 'job_search') {
    if (s.rest_year === s.year) return;
    list.push({ syn: jobBoard(ctx), ctx, trigger: name });
  } else if (name === 'military_due') {
    // 사건이 없으면 현역으로
    list.push({ syn: { id: 'military_auto', big: true, priority: 5, text: '입영 통지서가 왔어요.', choices: [{ label: '입대한다', effects: { do: 'military:army', flag: 'served_army' }, result: '머리를 짧게 자르고 훈련소로 향했어요.' }], default: 0 }, ctx, trigger: name });
  }
}

// 첫 직장 이후의 구직 화면을 대신하는 간단한 갈림길 (SYSTEMS 5.2 구직 화면의 v0 대체)
export function jobBoard(ctx) {
  const offers = ctx.offers ?? [];
  const choices = offers.map((o, i) => ({ label: `{offer${i + 1}}`, effects: { do: `job:offer${i + 1}` }, result: '새 출발이에요. 첫 출근 날 아침이 조금 설레요.' }));
  if (ctx.look) choices.push({ label: '지금 자리에 남는다', effects: { do: 'job:stay' }, result: '조금 더 지금 자리에서 버텨 보기로 했어요.' });
  else choices.push({ label: '올해는 쉬며 준비한다', effects: { do: 'job:rest', mental: 2, happiness: -2 }, result: '자격증 책을 펴 놓고 다음 기회를 기다려요.' });
  return {
    id: 'job_board', big: true, priority: 6, tags: ['work'],
    text: ctx.look ? '이직을 알아봤더니 연락이 온 곳이 있어요. 어떻게 할까요?' : '새 일자리를 찾고 있어요. 연락이 온 곳이 있어요. 어디로 갈까요?',
    choices, default: 0,
  };
}

// 사건 하나를 띄우기 전에 맥락 채우기 (라이벌, 투자 대상 회사 등)
function prepareCtx(L, ev, ctx) {
  const { s, W, rng } = L;
  const raw = JSON.stringify(ev.choices) + ev.text;
  if (/\{rival\}|job:rival/.test(raw) && !ctx.rival) ctx.rival = W.rival(ctx.company ?? s.career.company, rng)?.id ?? null;
  if (/invest:company/.test(raw) && !ctx.company) ctx.company = hotCompany(L)?.id ?? null;
  if (/\{tech\}/.test(raw) && !ctx.tech) ctx.tech = W.latestTech(s.year)?.name_ko ?? null;
  return ctx;
}

// ⑤ 한 해 큐 만들기
export function buildQueue(L, triggers) {
  const { s, D, rng } = L;
  const forced = [];
  const used = new Set();
  const push = (ev, ctx, trigger) => {
    const id = ev.id;
    if (used.has(id)) return;
    used.add(id);
    forced.push({ ev, ctx: prepareCtx(L, ev, { ...ctx }), trigger });
  };
  // 지난해 넘친 큰 사건
  for (const d of s.deferred ?? []) {
    const ev = D.eventById.get(d.id);
    if (ev && eligible(L, ev, { triggered: true, grace: true })) push(ev, d.ctx ?? {}, d.trigger);
  }
  s.deferred = [];
  // 트리거 사건
  for (const [name, ctx] of triggers) {
    const cands = D.events.filter((ev) => ev.trigger === name && eligible(L, ev, { triggered: true }));
    if (!cands.length) {
      const fb = [];
      fallback(L, name, ctx, fb);
      for (const f of fb) { forced.push({ ev: f.syn, ctx: prepareCtx(L, f.syn, { ...f.ctx }), trigger: name, syn: true }); }
      continue;
    }
    const strong = cands.filter((e) => e.forced);
    const list = strong.length ? strong : [rng.weighted(cands, (e) => e.weight ?? 1)];
    for (const ev of list) if (!(name === 'job_search' && s.rest_year === s.year)) push(ev, ctx, name);
  }
  // again으로 다시 후보가 된 사건
  const againPool = [];
  for (const [id, y] of Object.entries(s.again)) {
    if (y > s.year) continue;
    delete s.again[id];
    const ev = D.eventById.get(id);
    if (!ev || !eligible(L, ev, { triggered: true, again: true })) continue;
    if (ev.forced || ev.trigger) push(ev, {}, 'again');
    else againPool.push(ev);
  }
  // 트리거 없는 강제 사건 (IMF 등)
  for (const ev of D.events) if (ev.forced && !ev.trigger && eligible(L, ev)) push(ev, {}, null);

  // 큰 사건은 한 해 2개까지, 넘치면 다음 해로
  forced.sort((a, b) => (b.ev.priority ?? 5) - (a.ev.priority ?? 5));
  const chosen = [];
  let bigCount = 0;
  for (const f of forced) {
    if (f.ev.big) {
      if (bigCount >= 2) { if (!f.syn) s.deferred.push({ id: f.ev.id, ctx: f.ctx, trigger: f.trigger }); continue; }
      bigCount++;
    }
    chosen.push(f);
  }

  // 일반 추첨
  const dist = N_DIST[stageOf(s.age)] ?? N_DIST.young;
  let r = rng.next();
  let N = 0;
  while (N < 3 && r >= dist[N]) { r -= dist[N]; N++; }
  let slots = Math.max(0, Math.min(3, Math.max(N, chosen.length)) - chosen.length);
  const tagCount = {};
  for (const f of chosen) { const t = f.ev.tags?.[0]; if (t) tagCount[t] = (tagCount[t] ?? 0) + 1; }
  const pool = D.events.filter((ev) => !ev.trigger && !ev.forced && (ev.weight ?? 0) > 0 && !used.has(ev.id) && eligible(L, ev)).concat(againPool);
  const lottery = [];
  const reserveSemi = !s.semi.length && (s.age === 35 || s.age === 50);
  let lotteryBig = s.year - (s.lastLotteryBig ?? -99) <= 2 ? 1 : 0;
  while (slots > 0 && pool.length) {
    const cand = pool.filter((ev) => (!ev.big || lotteryBig === 0) && (!ev.tags?.[0] || (tagCount[ev.tags[0]] ?? 0) < 2));
    const semiOnly = reserveSemi && !lottery.length ? cand.filter((ev) => ev._semi) : [];
    const ev = rng.weighted(semiOnly.length ? semiOnly : cand, (e) => weightOf(L, e));
    if (!ev) break;
    pool.splice(pool.indexOf(ev), 1);
    if (ev.big) { lotteryBig++; s.lastLotteryBig = s.year; }
    if (ev.tags?.[0]) tagCount[ev.tags[0]] = (tagCount[ev.tags[0]] ?? 0) + 1;
    used.add(ev.id);
    lottery.push({ ev, ctx: prepareCtx(L, ev, {}), trigger: null });
    slots--;
  }

  // 배치: 강제·트리거 사건이 앞자리
  const all = [...chosen, ...lottery];
  const places = all.length < PLACES.length ? PLACES[all.length] : all.map((_, i) => 0.1 + (0.75 * i) / Math.max(1, all.length - 1));
  return all.map((f, i) => ({
    uid: newUid(), id: f.ev.id, at: places[i], big: !!f.ev.big, ctx: f.ctx, trigger: f.trigger ?? null,
    syn: f.syn || !D.eventById.has(f.ev.id) ? f.ev : null,
  }));
}

export const eventOf = (L, inst) => inst.syn ?? L.D.eventById.get(inst.id) ?? null;

// 화면에 넘길 모양 (문장 채우기, 보이는 선택지, 판정 가능성)
export function present(L, inst) {
  const ev = eventOf(L, inst);
  if (!ev) return null;
  const ctx = inst.ctx ?? {};
  const vis = visibleChoices(L, ev);
  if (!vis.length || (vis.length < 2 && !ev.trigger && !ev.forced && !inst.syn && !inst.trigger)) return null;
  let def = ev.default ?? 0;
  if (!vis.some((v) => v.i === def)) def = vis[0].i;
  return {
    uid: inst.uid, id: ev.id, big: !!ev.big, text: fill(L, ev.text, ctx),
    choices: vis.map(({ c, i }) => {
      const p = c.check ? checkChance(L, c) : null;
      const what = c.check?.stat ? STAT_NAMES[c.check.stat] : c.check?.trait ? '성향' : '';
      return { index: i, label: fill(L, c.label, ctx), check: c.check ? `${what} 판정 · 가능성 ${chanceWord(p)}` : null, isDefault: i === def };
    }),
    defaultIndex: def,
  };
}

// 선택 처리 → { result, chips, goto }
export function choose(L, inst, index) {
  const { s, rng, D } = L;
  const ev = eventOf(L, inst);
  const ch = ev?.choices[index];
  if (!ch) return { result: '', chips: [] };
  const ctx = inst.ctx ?? (inst.ctx = {});
  let eff = ch.effects ?? {};
  let result = ch.result ?? '';
  let failed = false;
  if (ch.check) {
    if (!rng.chance(checkChance(L, ch))) {
      failed = true;
      eff = ch.fail?.effects ?? {};
      result = ch.fail?.result ?? '';
    }
  }
  s.seen[ev.id] = s.year;
  ctx.notes = [];
  ctx.fill = (t) => fill(L, t, ctx);
  const out = applyEffects(L, eff, ctx, ev);
  delete ctx.fill;
  // {child} 같은 자리표시는 효과 뒤에 채움 (child:add 뒤 새 아이 이름)
  const text = [fill(L, result, ctx), ...ctx.notes].filter(Boolean).join(' ');
  const label = fill(L, ch.label, ctx);
  if (ev.big) addLog(L, text.startsWith(label) ? text : `${label} — ${text}`, 3, 'choice', ev.id);
  else if (text) addLog(L, text, 1, 'event', ev.id);
  L.emit?.('choice', { id: ev.id, index, failed });
  delete ctx.notes;
  // goto: 이어지는 사건을 바로 다음에 (사건 수에 안 셈)
  let follow = null;
  if (out.goto) {
    const nx = D.eventById.get(out.goto);
    if (nx && eligible(L, nx, { triggered: true, again: out.goto === ev.id })) {
      follow = { uid: newUid(), id: nx.id, at: 0, big: !!nx.big, ctx: prepareCtx(L, nx, { ...ctx }), trigger: 'goto', syn: null };
    }
  }
  return { result: text, chips: out.chips, failed, follow };
}

