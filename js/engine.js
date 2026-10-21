// 게임 엔진 (담당: Claude)
// DOM을 건드리지 않는 순수 로직입니다. 화면은 ui.js가 state와 emit 이벤트를 받아 그립니다.
//
// 세계 구조
//  - 클린룸 = cols × rows 격자. (0,0)은 스토커(FOUP 출발·도착 지점)
//  - 장비(tool)는 칸 하나를 차지. 같은 종류를 여러 대 놓으면 FOUP이 덜 붐비는 쪽으로 감
//  - FOUP은 천장 OHT를 타고 직각(가로 먼저, 세로 다음)으로 이동. 장비 사이 거리가 곧 시간
//  - 엔지니어는 바닥을 걸어 다니며 고장 수리·PM을 함

import {
  PROCESSES, PROCESS_INDEX, GRID, STOCKER, START_LAYOUT, TOOL, FOUP, ENGINEER, LOT_VALUE, YIELD,
  NODES, NODE_VALUE_MULT, PRESTIGE_BASE, PRESTIGE_GROWTH, TECH_POINT_BONUS, OFFLINE, EVENTS, ACHIEVEMENTS,
} from './data.js';

export const SAVE_VERSION = 2;
const LAST_STEP = PROCESSES.length; // step이 이 값이면 스토커로 귀환

// ---------- 상태 ----------

export function createState(now = Date.now(), keep = {}) {
  const s = {
    version: SAVE_VERSION,
    money: 0,
    runEarnings: 0,
    totalEarnings: keep.totalEarnings ?? 0,
    nodeIndex: keep.nodeIndex ?? 0,
    techPoints: keep.techPoints ?? 0,
    rows: GRID.startRows,
    nextId: 1,
    tools: [],
    foups: [],
    engineers: [],
    jobs: [],
    event: null,
    nextEventIn: randBetween(EVENTS.firstDelay, Math.random),
    stats: keep.stats ?? { lots: 0, golden: 0, scrap: 0, fixes: 0, pms: 0, moves: 0, rushWins: 0, maxBay: 1 },
    achievements: keep.achievements ?? [],
    yieldAvg: YIELD.baseMean,
    income: { rate: 0, lotRate: 0, acc: 0, lots: 0, t: 0 }, // 최근 매출 속도(원/초, Lot/초)
    lastSaved: now,
  };
  for (const t of START_LAYOUT) addTool(s, t.type, t.x, t.y);
  for (let i = 0; i < FOUP.start; i++) addFoup(s);
  addEngineer(s);
  return s;
}

function newId(s, p) { return p + (s.nextId++); }

function addTool(s, type, x, y) {
  const t = { id: newId(s, 't'), type, x, y, level: 1, health: 100, down: false, foup: null, progress: 0, queue: [] };
  s.tools.push(t);
  return t;
}

function addFoup(s) {
  const f = { id: newId(s, 'f'), x: STOCKER.x, y: STOCKER.y, step: 0, phase: 'move', target: null, penalty: 0 };
  s.foups.push(f);
  dispatch(s, f);
  return f;
}

function addEngineer(s) {
  const n = s.engineers.length;
  const e = {
    id: newId(s, 'e'), name: ENGINEER.names[n] ?? `엔지니어 ${n + 1}`,
    x: 0, y: 1, phase: 'idle', job: null, workLeft: 0, auto: n > 0, wanderIn: 2,
  };
  s.engineers.push(e);
  return e;
}

export function hydrate(raw, now = Date.now()) {
  if (!raw || raw.version !== SAVE_VERSION || !Array.isArray(raw.tools)) return createState(now);
  const base = createState(now);
  const s = { ...base, ...raw };
  s.stats = { ...base.stats, ...(raw.stats || {}) };
  s.income = { ...base.income, ...(raw.income || {}) };
  return s;
}

// ---------- 조회 ----------

export const nodeMult = s => Math.pow(NODE_VALUE_MULT, s.nodeIndex);
export const techMult = s => 1 + s.techPoints * TECH_POINT_BONUS;
export const lotValue = s => LOT_VALUE * nodeMult(s) * techMult(s);
export const toolById = (s, id) => s.tools.find(t => t.id === id);
export const toolAt = (s, x, y) => s.tools.find(t => t.x === x && t.y === y);
export const isStocker = (x, y) => x === STOCKER.x && y === STOCKER.y;
export const cellFree = (s, x, y) =>
  x >= 0 && y >= 0 && x < GRID.cols && y < s.rows && !isStocker(x, y) && !toolAt(s, x, y);

export function levelMult(level) {
  let m = 1 + TOOL.speedPerLevel * (level - 1);
  for (const ms of TOOL.milestones) if (level >= ms) m *= 2;
  return m;
}
export const nextMilestone = level => TOOL.milestones.find(m => m > level) ?? null;

export function baySize(s, tool) {
  return s.tools.filter(t => t !== tool && t.type === tool.type && Math.abs(t.x - tool.x) + Math.abs(t.y - tool.y) === 1).length;
}

// FOUP/초 처리 능력
export function toolSpeed(s, t) {
  if (t.down) return 0;
  const p = PROCESSES[PROCESS_INDEX[t.type]];
  let v = levelMult(t.level) / p.time;
  if (t.health < TOOL.warnHealth) v *= TOOL.warnSpeed;
  v *= 1 + TOOL.bayBonus * baySize(s, t);
  return v;
}

// ---------- 가격 ----------

export const upgradeCost = (s, t) =>
  Math.ceil(PROCESSES[PROCESS_INDEX[t.type]].price * TOOL.upgradeCostFactor * Math.pow(TOOL.upgradeGrowth, t.level - 1) * nodeMult(s));
export const buyToolCost = (s, type) =>
  Math.ceil(PROCESSES[PROCESS_INDEX[type]].price * Math.pow(TOOL.buyGrowth, Math.max(0, s.tools.filter(t => t.type === type).length - 1)) * nodeMult(s));
export const foupCost = s =>
  Math.ceil(FOUP.cost * Math.pow(FOUP.costGrowth, s.foups.length - FOUP.start) * nodeMult(s));
export const expandCost = s =>
  Math.ceil(GRID.expandCost * Math.pow(GRID.expandGrowth, s.rows - GRID.startRows) * nodeMult(s));
export const hireCost = s =>
  Math.ceil(ENGINEER.hireCost * Math.pow(ENGINEER.hireGrowth, s.engineers.length - 1) * nodeMult(s));

export const prestigeTarget = s => PRESTIGE_BASE * Math.pow(PRESTIGE_GROWTH, s.nodeIndex);
export function prestigeGain(s) {
  const t = prestigeTarget(s);
  return s.runEarnings < t ? 0 : Math.floor(3 * Math.sqrt(s.runEarnings / t));
}
export const canPrestige = s => s.nodeIndex < NODES.length - 1 && prestigeGain(s) > 0;

// 화면이 쓰는 요약값
export function derive(s) {
  const cap = {};
  for (const p of PROCESSES) cap[p.id] = 0;
  for (const t of s.tools) cap[t.type] += toolSpeed(s, t);
  let bottleneck = null;
  for (const p of PROCESSES) if (bottleneck === null || cap[p.id] < cap[bottleneck]) bottleneck = p.id;
  return {
    capacity: cap,
    bottleneck,
    lotValue: lotValue(s),
    yieldMean: yieldMean(s),
    incomePerSec: s.income.rate,
    lotsPerSec: s.income.lotRate,
    node: NODES[s.nodeIndex],
    nextNode: NODES[s.nodeIndex + 1] ?? null,
    prestigeTarget: prestigeTarget(s),
    prestigeGain: prestigeGain(s),
    canPrestige: canPrestige(s),
  };
}

function yieldMean(s) {
  let m = YIELD.baseMean;
  if (s.event?.type === 'particle') m -= EVENTS.particle.yieldPenalty;
  return m;
}

// ---------- FOUP 흐름 ----------

const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

// 다음 공정 장비 고르기: (대기열 길이 × 처리시간 + 이동시간)이 가장 짧은 곳
function dispatch(s, f) {
  f.phase = 'move';
  if (f.step >= LAST_STEP) { f.target = { kind: 'stocker' }; return; }
  const type = PROCESSES[f.step].id;
  const cands = s.tools.filter(t => t.type === type);
  const up = cands.filter(t => !t.down);
  const pool = up.length ? up : cands;
  let best = null, bestScore = Infinity;
  for (const t of pool) {
    const incoming = s.foups.filter(o => o !== f && o.target?.id === t.id && o.phase === 'move').length;
    const load = t.queue.length + (t.foup ? 1 : 0) + incoming;
    const sp = toolSpeed(s, t) || 0.01;
    const score = load / sp + dist(f, t) / FOUP.speed;
    if (score < bestScore) { bestScore = score; best = t; }
  }
  f.target = best ? { kind: 'tool', id: best.id } : { kind: 'stocker' };
}

// 직각 이동: 가로 먼저, 다음 세로. 도착하면 true
function stepToward(ent, tx, ty, d) {
  if (ent.x !== tx) {
    const dx = tx - ent.x, m = Math.min(Math.abs(dx), d);
    ent.x += Math.sign(dx) * m; d -= m;
    if (Math.abs(tx - ent.x) < 1e-6) ent.x = tx;
  }
  if (d > 0 && ent.y !== ty) {
    const dy = ty - ent.y, m = Math.min(Math.abs(dy), d);
    ent.y += Math.sign(dy) * m;
    if (Math.abs(ty - ent.y) < 1e-6) ent.y = ty;
  }
  return ent.x === tx && ent.y === ty;
}

function updateFoups(s, dt, emit, rng) {
  for (const f of s.foups) {
    if (f.phase !== 'move') continue;
    const tool = f.target?.kind === 'tool' ? toolById(s, f.target.id) : null;
    if (f.target?.kind === 'tool' && !tool) { dispatch(s, f); continue; }
    const dest = tool ?? STOCKER;
    if (!stepToward(f, dest.x, dest.y, FOUP.speed * dt)) continue;
    if (tool) { f.phase = 'queue'; tool.queue.push(f.id); }
    else finishLot(s, f, emit, rng);
  }
}

function updateTools(s, dt, emit, rng) {
  for (const t of s.tools) {
    if (t.down) continue;
    if (!t.foup && t.queue.length) {
      t.foup = t.queue.shift();
      t.progress = 0;
      const f = s.foups.find(o => o.id === t.foup);
      if (f) f.phase = 'proc';
    }
    if (!t.foup) continue;
    t.progress += toolSpeed(s, t) * dt;
    if (t.progress < 1) continue;

    const f = s.foups.find(o => o.id === t.foup);
    const p = PROCESSES[PROCESS_INDEX[t.type]];
    const warn = t.health < TOOL.warnHealth;
    t.health = Math.max(0, t.health - p.wear);
    t.foup = null;
    t.progress = 0;
    if (f) {
      if (warn) f.penalty += TOOL.warnYieldPenalty;
      f.step++;
      f.x = t.x; f.y = t.y;
      dispatch(s, f);
    }
    if (t.health <= 0 || (t.health < TOOL.warnHealth && rng() < TOOL.breakChance)) breakTool(s, t, emit);
  }
}

function breakTool(s, t, emit) {
  t.down = true;
  s.jobs = s.jobs.filter(j => j.toolId !== t.id || j.type === 'fix');
  if (!s.jobs.some(j => j.toolId === t.id) && !s.engineers.some(e => e.job?.toolId === t.id)) {
    s.jobs.unshift({ type: 'fix', toolId: t.id });
  } else {
    for (const e of s.engineers) if (e.job?.toolId === t.id) e.job.type = 'fix';
  }
  emit('toolDown', { id: t.id, type: t.type });
}

// ---------- Lot 완성 ----------

export function rollLot(s, f, rng) {
  const r = rng();
  const mean = yieldMean(s) - (f?.penalty ?? 0);
  let kind = 'normal', y, mult = 1;
  if (r < YIELD.goldenChance) { kind = 'golden'; y = 0.999; mult = YIELD.goldenValueMult; }
  else if (r < YIELD.goldenChance + YIELD.scrapChance) { kind = 'scrap'; y = 0; }
  else y = clamp(mean + gauss(rng) * YIELD.stdev, YIELD.min, YIELD.max);
  return { kind, yield: y, value: lotValue(s) * y * mult };
}

function finishLot(s, f, emit, rng) {
  const lot = rollLot(s, f, rng);
  earn(s, lot.value);
  s.income.lots++;
  s.stats.lots++;
  if (lot.kind === 'golden') s.stats.golden++;
  if (lot.kind === 'scrap') s.stats.scrap++;
  if (lot.kind !== 'scrap') s.yieldAvg = s.yieldAvg * 0.9 + lot.yield * 0.1;
  if (s.event?.type === 'rush') s.event.progress++;
  emit('lot', { ...lot, foupId: f.id });
  f.step = 0;
  f.penalty = 0;
  dispatch(s, f);
}

// track=false: 보너스·오프라인 정산처럼 '생산 속도'에 넣으면 안 되는 돈
function earn(s, v, track = true) {
  s.money += v; s.runEarnings += v; s.totalEarnings += v;
  if (track) s.income.acc += v;
}

// 최근 10초 단위로 매출 속도를 부드럽게 갱신
function updateIncome(s, dt) {
  const inc = s.income;
  inc.t += dt;
  if (inc.t < 10) return;
  const r = inc.acc / inc.t, lr = inc.lots / inc.t;
  inc.rate = inc.rate ? inc.rate * 0.6 + r * 0.4 : r;
  inc.lotRate = inc.lotRate ? inc.lotRate * 0.6 + lr * 0.4 : lr;
  inc.acc = 0; inc.lots = 0; inc.t = 0;
}

// ---------- 엔지니어 ----------

function updateEngineers(s, dt, emit, rng) {
  for (const e of s.engineers) {
    if (e.phase === 'idle') {
      takeJob(s, e);
      if (!e.job) wander(s, e, dt, rng);
    }
    if (e.phase === 'walk') {
      const t = toolById(s, e.job?.toolId);
      if (!t) { e.job = null; e.phase = 'idle'; continue; }
      if (stepToward(e, t.x, t.y, ENGINEER.speed * dt)) {
        e.phase = 'work';
        e.workLeft = e.job.type === 'fix' || t.down ? ENGINEER.fixTime : ENGINEER.pmTime;
        emit('engineerWork', { id: e.id, toolId: t.id, job: e.job.type });
      }
    } else if (e.phase === 'work') {
      e.workLeft -= dt;
      if (e.workLeft > 0) continue;
      const t = toolById(s, e.job?.toolId);
      if (t) {
        const wasDown = t.down;
        t.down = false;
        t.health = 100;
        if (wasDown) s.stats.fixes++; else s.stats.pms++;
        emit(wasDown ? 'toolFixed' : 'toolPm', { id: t.id, by: e.id });
      }
      e.job = null; e.phase = 'idle'; e.wanderIn = 1.5;
    } else if (e.phase === 'wander') {
      if (stepToward(e, e.wx, e.wy, ENGINEER.speed * 0.5 * dt)) { e.phase = 'idle'; e.wanderIn = 2 + rng() * 4; }
      takeJob(s, e); // 산책 중에도 일이 생기면 바로 감
    }
  }
}

function takeJob(s, e) {
  if (e.job) return;
  let j = null;
  const fixes = s.jobs.filter(x => x.type === 'fix');
  if (fixes.length) {
    j = fixes.reduce((a, b) => dist(e, toolById(s, a.toolId) ?? e) <= dist(e, toolById(s, b.toolId) ?? e) ? a : b);
  } else if (s.jobs.length) {
    j = s.jobs[0];
  } else if (e.auto) {
    const busy = new Set(s.engineers.map(o => o.job?.toolId));
    const t = s.tools.filter(t => !busy.has(t.id) && t.health < ENGINEER.autoPmBelow).sort((a, b) => a.health - b.health)[0];
    if (t) j = { type: 'pm', toolId: t.id };
  }
  if (!j) return;
  s.jobs = s.jobs.filter(x => x !== j);
  e.job = j;
  e.phase = 'walk';
}

function wander(s, e, dt, rng) {
  e.wanderIn -= dt;
  if (e.wanderIn > 0) return;
  const nx = clamp(Math.round(e.x) + Math.round(rng() * 4 - 2), 0, GRID.cols - 1);
  const ny = clamp(Math.round(e.y) + Math.round(rng() * 4 - 2), 0, s.rows - 1);
  e.wx = nx; e.wy = ny; e.phase = 'wander';
}

// ---------- 플레이어 행동 ----------

function pay(s, cost) {
  if (s.money < cost) return false;
  s.money -= cost;
  return true;
}

export function upgradeTool(s, id, emit = noop) {
  const t = toolById(s, id);
  if (!t || !pay(s, upgradeCost(s, t))) return false;
  t.level++;
  if (TOOL.milestones.includes(t.level)) emit('milestone', { id, level: t.level });
  emit('upgrade', { id, level: t.level });
  return true;
}

export function orderPm(s, id, emit = noop) {
  const t = toolById(s, id);
  if (!t) return false;
  if (s.jobs.some(j => j.toolId === id) || s.engineers.some(e => e.job?.toolId === id)) return false;
  s.jobs.push({ type: t.down ? 'fix' : 'pm', toolId: id });
  emit('jobQueued', { toolId: id });
  return true;
}

export function buyTool(s, type, x, y, emit = noop) {
  if (!cellFree(s, x, y) || !pay(s, buyToolCost(s, type))) return false;
  const t = addTool(s, type, x, y);
  updateBayStat(s, t);
  emit('toolPlaced', { id: t.id, type });
  checkAchievements(s, emit);
  return t;
}

export function moveTool(s, id, x, y, emit = noop) {
  const t = toolById(s, id);
  if (!t || !cellFree(s, x, y)) return false;
  t.x = x; t.y = y;
  // 장비 위에서 기다리던 FOUP도 같이 옮겨감
  for (const fid of [t.foup, ...t.queue]) {
    const f = s.foups.find(o => o.id === fid);
    if (f) { f.x = x; f.y = y; }
  }
  s.stats.moves++;
  updateBayStat(s, t);
  emit('toolMoved', { id, x, y });
  checkAchievements(s, emit);
  return true;
}

export function buyFoup(s, emit = noop) {
  if (s.foups.length >= FOUP.max || !pay(s, foupCost(s))) return false;
  const f = addFoup(s);
  emit('foupAdded', { id: f.id });
  return true;
}

export function expandRows(s, emit = noop) {
  if (s.rows >= GRID.maxRows || !pay(s, expandCost(s))) return false;
  s.rows++;
  emit('expand', { rows: s.rows });
  return true;
}

export function hireEngineer(s, emit = noop) {
  if (s.engineers.length >= ENGINEER.max || !pay(s, hireCost(s))) return false;
  const e = addEngineer(s);
  emit('hire', { id: e.id, name: e.name });
  return true;
}

export function tapEvent(s, emit = noop) {
  const ev = s.event;
  if (!ev || ev.type !== 'particle') return false;
  ev.tapsLeft--;
  if (ev.tapsLeft <= 0) endEvent(s, emit, 'solved');
  return true;
}

export function prestige(s, emit = noop) {
  if (!canPrestige(s)) return false;
  const gain = prestigeGain(s);
  const next = createState(Date.now(), {
    totalEarnings: s.totalEarnings, nodeIndex: s.nodeIndex + 1, techPoints: s.techPoints + gain,
    stats: s.stats, achievements: s.achievements,
  });
  Object.keys(s).forEach(k => delete s[k]);
  Object.assign(s, next);
  emit('prestige', { node: NODES[s.nodeIndex], gain });
  checkAchievements(s, emit);
  return true;
}

function updateBayStat(s, t) {
  // 같은 종류가 상하좌우로 이어진 덩어리 크기
  const seen = new Set([t.id]);
  const stack = [t];
  while (stack.length) {
    const c = stack.pop();
    for (const o of s.tools) {
      if (!seen.has(o.id) && o.type === c.type && Math.abs(o.x - c.x) + Math.abs(o.y - c.y) === 1) {
        seen.add(o.id); stack.push(o);
      }
    }
  }
  s.stats.maxBay = Math.max(s.stats.maxBay, seen.size);
}

// ---------- 돌발 이벤트 ----------

function updateEvents(s, dt, emit, rng) {
  const ev = s.event;
  if (ev) {
    ev.timeLeft -= dt;
    if (ev.type === 'rush' && ev.progress >= ev.target) {
      earn(s, ev.reward, false);
      s.stats.rushWins++;
      endEvent(s, emit, 'solved');
    } else if (ev.timeLeft <= 0) {
      endEvent(s, emit, ev.type === 'rush' ? 'failed' : 'expired');
    }
    return;
  }
  s.nextEventIn -= dt;
  if (s.nextEventIn > 0) return;
  const canRush = s.income.lotRate > 0;
  const type = canRush && rng() < 0.5 ? 'rush' : 'particle';
  if (type === 'particle') {
    s.event = { type, tapsLeft: EVENTS.particle.cleanTaps, timeLeft: EVENTS.particle.duration, duration: EVENTS.particle.duration };
  } else {
    const target = Math.max(3, Math.ceil(s.income.lotRate * EVENTS.rush.seconds * EVENTS.rush.targetFactor));
    s.event = {
      type, target, progress: 0,
      reward: Math.ceil(Math.max(s.income.rate, lotValue(s) * 0.05) * EVENTS.rush.rewardSeconds),
      timeLeft: EVENTS.rush.seconds, duration: EVENTS.rush.seconds,
    };
  }
  emit('eventStart', { ...s.event });
}

function endEvent(s, emit, result) {
  const ev = s.event;
  s.event = null;
  s.nextEventIn = randBetween(EVENTS.interval, Math.random);
  emit('eventEnd', { ...ev, result });
}

// ---------- 시간 흐름 ----------

export function tick(s, dt, emit = noop, rng = Math.random) {
  // 큰 dt는 잘게 나눠서 FOUP이 장비를 건너뛰지 않게
  while (dt > 0) {
    const h = Math.min(dt, 0.05);
    dt -= h;
    updateEvents(s, h, emit, rng);
    updateFoups(s, h, emit, rng);
    updateTools(s, h, emit, rng);
    updateEngineers(s, h, emit, rng);
    updateIncome(s, h);
  }
  checkAchievements(s, emit);
}

// ---------- 오프라인 ----------

export function applyOffline(s, now = Date.now()) {
  const secs = Math.min((now - (s.lastSaved || now)) / 1000, OFFLINE.maxHours * 3600);
  s.lastSaved = now;
  if (secs < OFFLINE.minSeconds) return null;
  if (s.event) { s.event = null; s.nextEventIn = randBetween(EVENTS.interval, Math.random); }
  const earned = s.income.rate * secs * OFFLINE.rate;
  const lots = Math.floor(s.income.lotRate * secs * OFFLINE.rate);
  earn(s, earned, false);
  s.stats.lots += lots;
  return { seconds: secs, earned, lots };
}

// ---------- 칭호 ----------

export function checkAchievements(s, emit = noop) {
  for (const a of ACHIEVEMENTS) {
    if (s.achievements.includes(a.id) || !a.check(s)) continue;
    s.achievements.push(a.id);
    emit('achievement', { id: a.id, name: a.name, desc: a.desc });
  }
}

// ---------- 유틸 ----------

function noop() {}
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function randBetween([a, b], rng) { return a + rng() * (b - a); }
function gauss(rng) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
