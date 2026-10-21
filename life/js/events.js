// 사건 추첨·보여 주기·선택 처리 (담당: Claude, DOM 없음) — SYSTEMS 1.3·1.4·7장
// 한 해의 사건은 큐(s.turn.queue)에 { uid, id, at(0~1 진행률), big, ctx, trigger, syn? }로 들어갑니다.

import { clamp, inRange, hasTrait, stageOf, addLog, asArray, STAT_NAMES } from './core.js';
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

// 반복 규칙 (SPEC 사건 필드 repeatable·repeat_gap): 기본은 한 인생에 한 번.
// 시스템 트리거에 묶인 사건(결혼·출산·구직·스카우트처럼 상태가 다시 만들어 주는 것)은 트리거가 생길 때마다 뜹니다.
// again:n(do)·goto 재요청은 opts.again으로 다시 열립니다.
// 같은 질문을 조르는 트리거(프러포즈·출산·집·스카우트)는 같은 사건이 3년 안에 다시 뜨지 않게
const NAG_TRIGGERS = { proposal: 3, baby_chance: 3, house_chance: 3, scout: 4 };
export function repeatOk(L, ev, opts = {}) {
  const s = L.s;
  const seen = s.seen[ev.id];
  if (seen === undefined || opts.requeue) return true;
  // again:n 다시 묻기: 조르는 질문(결혼·출산·집)은 한 번까지만, 재수 같은 진로 흐름은 그대로
  if (opts.again) return !!ev.repeatable || !NAG_TRIGGERS[ev.trigger] || (s.seen_n?.[ev.id] ?? 1) < 2;
  if (ev.once) return false;
  if (ev.repeatable) return s.year - seen >= (ev.repeat_gap ?? 10);
  if (!ev.trigger || ev.repeatable === false) return false;
  return s.year - seen >= (NAG_TRIGGERS[ev.trigger] ?? 0);
}

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
  if (!repeatOk(L, ev, opts)) return false;
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
  // 반복 가능한 사건이 다시 열린 직후(간격의 2배 안)에는 덜 뜨게, GPT 공식형 두 갈래 사건은 ×0.4 (손으로 쓴 사건이 이기게)
  const ago = s.seen[ev.id] !== undefined ? s.year - s.seen[ev.id] : 99;
  const R = ev.repeatable && ago < 2 * (ev.repeat_gap ?? 10) ? 0.5 : 1;
  return (ev.weight ?? 1) * B * T * semiMult(L, ev) * R * (ev._formulaic ? 0.4 : 1);
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
  // 나중에 돌아오는 결과 (SPEC effects.later): 정한 해가 되면 가중치와 상관없이 강제로. 조건이 안 맞으면 3년까지 기다림
  s.later = (s.later ?? []).filter((x) => {
    if (x.year > s.year) return true;
    const ev = D.eventById.get(x.id);
    if (!ev || !repeatOk(L, ev)) return false;
    if (eligible(L, ev, { triggered: true, grace: true, later: true })) {
      push(ev, { ...(x.ctx ?? {}), later: { year: x.made, from: x.from, pick: x.pick ?? null } }, 'later');
      return false;
    }
    return s.year - x.year < 3;
  });
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
  const tagCount = {};
  for (const f of chosen) { const t = f.ev.tags?.[0]; if (t) tagCount[t] = (tagCount[t] ?? 0) + 1; }
  // 비슷한 사건 막기: 최근 5년 안에 뜬 사건과 문장 앞 12글자가 같거나 선택지 이름이 똑같으면 후보에서 뺌
  const heads = new Set();
  const labelSets = new Set();
  const mark = (ev) => { if (ev._head) heads.add(ev._head); if (ev._labels) labelSets.add(ev._labels); };
  for (const [id, y] of Object.entries(s.seen)) if (s.year - y < 5) { const e = D.eventById.get(id); if (e) mark(e); }
  for (const f of chosen) mark(f.ev);
  const similar = (ev) => heads.has(ev._head) || labelSets.has(ev._labels);
  const pool = D.events.filter((ev) => !ev.trigger && !ev.forced && (ev.weight ?? 0) > 0 && !used.has(ev.id) && !similar(ev) && eligible(L, ev)).concat(againPool);
  // 후보가 넉넉한 해(6개↑)는 35% 확률로 한 자리 더 (v0.2: 한 번씩만 뜨는 사건을 나이대가 지나기 전에 쓰게)
  if (pool.length >= 6 && N < 3 && rng.chance(0.35)) N++;
  let slots = Math.max(0, Math.min(3, Math.max(N, chosen.length)) - chosen.length);
  const lottery = [];
  const reserveSemi = !s.semi.length && (s.age === 35 || s.age === 50);
  let lotteryBig = s.year - (s.lastLotteryBig ?? -99) <= 2 ? 1 : 0;
  while (slots > 0 && pool.length) {
    const cand = pool.filter((ev) => (!ev.big || lotteryBig === 0) && (!ev.tags?.[0] || (tagCount[ev.tags[0]] ?? 0) < 2) && (againPool.includes(ev) || !similar(ev)));
    const semiOnly = reserveSemi && !lottery.length ? cand.filter((ev) => ev._semi) : [];
    const ev = rng.weighted(semiOnly.length ? semiOnly : cand, (e) => weightOf(L, e));
    if (!ev) break;
    pool.splice(pool.indexOf(ev), 1);
    if (ev.big) { lotteryBig++; s.lastLotteryBig = s.year; }
    if (ev.tags?.[0]) tagCount[ev.tags[0]] = (tagCount[ev.tags[0]] ?? 0) + 1;
    used.add(ev.id);
    mark(ev);
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
  // 나중에 돌아온 결과면 "그때 그 선택…" 꼬리표 (그 해·그때 고른 선택지)
  const lt = ctx.later ?? null;
  const later = lt ? { year: lt.year ?? null, pick: lt.pick ?? null } : null;
  const kicker = later ? `그때 그 선택…${later.year ? ` (${later.year}년${later.pick ? ` · ${later.pick}` : ''})` : ''}` : ev.big ? '인생의 갈림길' : '';
  return {
    uid: inst.uid, id: ev.id, big: !!ev.big, kicker, later, text: fill(L, ev.text, ctx),
    choices: vis.map(({ c, i }) => {
      const p = c.check ? checkChance(L, c) : null;
      const what = c.check?.stat ? STAT_NAMES[c.check.stat] : c.check?.trait ? '성향' : '';
      return { index: i, label: fill(L, c.label, ctx), check: c.check ? `${what} 판정 · 가능성 ${chanceWord(p)}` : null, isDefault: i === def };
    }),
    defaultIndex: def,
  };
}

// 연표용 질문 요약: recap이 있으면 그것, 없으면 text 첫 문장 (30자 안팎)
export function recapOf(L, ev, ctx = {}) {
  const raw = ev.recap ? fill(L, ev.recap, ctx) : fill(L, ev.text, ctx);
  let t = String(raw).replace(/\s+/g, ' ').trim();
  if (!ev.recap) {
    const m = /^(.+?[.!?…])(?=\s|$)/.exec(t);
    if (m) t = m[1];
    t = t.replace(/[.!?]+$/, '');
  }
  return t.length > 32 ? `${t.slice(0, 30).trimEnd()}…` : t;
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
  (s.seen_n ??= {})[ev.id] = (s.seen_n[ev.id] ?? 0) + 1;
  const label = fill(L, ch.label, ctx);
  const recap = recapOf(L, ev, ctx);
  ctx.notes = [];
  ctx.fill = (t) => fill(L, t, ctx);
  ctx.pick = label;
  const at = s.log.length;
  const out = applyEffects(L, eff, ctx, ev);
  delete ctx.fill;
  // {child} 같은 자리표시는 효과 뒤에 채움 (child:add 뒤 새 아이 이름)
  const text = [fill(L, result, ctx), ...ctx.notes].filter(Boolean).join(' ');
  // 연표: "질문 요약 → 내 선택 → 결과" (결과가 선택지 이름을 되풀이하면 그 부분은 뺌)
  const res = text.startsWith(label) ? text.slice(label.length).replace(/^[\s.,!?…]+/, '') : text;
  const line = `${recap} → ${label}${res ? ` → ${res}` : ''}`;
  addLog(L, line, ev.big ? 3 : 1, ev.big ? 'choice' : 'event', ev.id, { q: recap, pick: label, res, later: ctx.later ? (ctx.later.year ?? true) : null });
  // 선택 줄이 그 선택으로 생긴 일(입사·결혼 등)보다 먼저 오게
  if (s.log.length - 1 > at) s.log.splice(at, 0, s.log.pop());
  L.emit?.('choice', { id: ev.id, index, failed });
  delete ctx.notes;
  // goto: 이어지는 사건을 바로 다음에 (사건 수에 안 셈)
  let follow = null;
  if (out.goto) {
    const nx = D.eventById.get(out.goto);
    if (nx && eligible(L, nx, { triggered: true, requeue: out.goto === ev.id })) {
      follow = { uid: newUid(), id: nx.id, at: 0, big: !!nx.big, ctx: prepareCtx(L, nx, { ...ctx, later: undefined }), trigger: 'goto', syn: null };
    }
  }
  return { result: text, chips: out.chips, failed, follow, recap, label };
}
