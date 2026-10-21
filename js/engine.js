// 게임 엔진 (담당: Claude)
// DOM을 전혀 건드리지 않는 순수 로직입니다. 화면은 ui.js가 state와 emit 이벤트를 받아 그립니다.

import {
  STATIONS, FULL_LINE_BONUS, BASE_RATE, RATE_PER_LEVEL, LEVEL_MILESTONES,
  UPGRADE_COST_FACTOR, UPGRADE_COST_GROWTH, YIELD, NODES, NODE_VALUE_MULT,
  PRESTIGE_BASE, PRESTIGE_GROWTH, TECH_POINT_BONUS, OFFLINE, EVENTS, ACHIEVEMENTS,
} from './data.js';

export const SAVE_VERSION = 1;

// ---------- 상태 ----------

export function createState(now = Date.now()) {
  return {
    version: SAVE_VERSION,
    money: 0,
    runEarnings: 0,      // 이번 노드에서 번 돈 (전환 조건)
    totalEarnings: 0,    // 전체 누적
    nodeIndex: 0,
    techPoints: 0,
    stations: freshStations(),
    progress: 0,         // 다음 Lot까지 진행도 (0~1)
    event: null,
    nextEventIn: randBetween(EVENTS.firstDelay, Math.random),
    stats: { lots: 0, golden: 0, scrap: 0, fixes: 0, rushWins: 0, taps: 0 },
    achievements: [],
    yieldAvg: YIELD.baseMean,
    lastSaved: now,
  };
}

function freshStations() {
  const s = {};
  STATIONS.forEach((st, i) => { s[st.id] = { unlocked: i === 0, level: 1 }; });
  return s;
}

// 저장 데이터 불러오기. 필드가 빠졌거나 옛 버전이면 기본값으로 채웁니다.
export function hydrate(raw, now = Date.now()) {
  const base = createState(now);
  if (!raw || typeof raw !== 'object') return base;
  const s = { ...base, ...raw };
  s.stats = { ...base.stats, ...(raw.stats || {}) };
  s.stations = freshStations();
  for (const st of STATIONS) {
    const r = raw.stations?.[st.id];
    if (r) s.stations[st.id] = { unlocked: !!r.unlocked, level: Math.max(1, r.level | 0) };
  }
  s.stations[STATIONS[0].id].unlocked = true;
  s.achievements = Array.isArray(raw.achievements) ? raw.achievements : [];
  s.version = SAVE_VERSION;
  return s;
}

// ---------- 계산값 ----------

export function stationRate(level) {
  let r = BASE_RATE * (1 + RATE_PER_LEVEL * (level - 1));
  for (const m of LEVEL_MILESTONES) if (level >= m) r *= 2;
  return r;
}

// 노드가 오르면 Lot 가치와 함께 설비 값도 오릅니다 (안 그러면 후반이 너무 쉬워짐)
export function upgradeCost(state, stationIndex, level) {
  return Math.ceil(STATIONS[stationIndex].lotValue * UPGRADE_COST_FACTOR * Math.pow(UPGRADE_COST_GROWTH, level - 1) * nodeMult(state));
}

export function unlockCost(state, stationIndex) {
  return STATIONS[stationIndex].unlockCost * nodeMult(state);
}

export function nextMilestone(level) {
  return LEVEL_MILESTONES.find(m => m > level) ?? null;
}

export function nodeMult(state) { return Math.pow(NODE_VALUE_MULT, state.nodeIndex); }
export function techMult(state) { return 1 + state.techPoints * TECH_POINT_BONUS; }

export function prestigeTarget(state) {
  return PRESTIGE_BASE * Math.pow(PRESTIGE_GROWTH, state.nodeIndex);
}

export function prestigeGain(state) {
  const t = prestigeTarget(state);
  if (state.runEarnings < t) return 0;
  return Math.floor(3 * Math.sqrt(state.runEarnings / t));
}

// 8공정이 모두 열려 있어야 다음 노드로 갈 수 있습니다
export function canPrestige(state) {
  const fullLine = STATIONS.every(st => state.stations[st.id].unlocked);
  return fullLine && state.nodeIndex < NODES.length - 1 && prestigeGain(state) > 0;
}

// 화면과 엔진이 함께 쓰는 파생값 묶음
export function derive(state) {
  const rates = {};
  let unlockedCount = 0;
  let valueSum = 0;
  let throughput = Infinity;
  let bottleneckId = null;

  STATIONS.forEach(st => {
    const s = state.stations[st.id];
    if (!s.unlocked) return;
    unlockedCount++;
    valueSum += st.lotValue;
    const down = state.event?.type === 'down' && state.event.stationId === st.id;
    const r = down ? 0 : stationRate(s.level);
    rates[st.id] = r;
    if (r < throughput) { throughput = r; bottleneckId = st.id; }
  });
  if (!isFinite(throughput)) throughput = 0;

  const fullLine = unlockedCount === STATIONS.length;
  const lotValue = valueSum * (fullLine ? FULL_LINE_BONUS : 1) * nodeMult(state) * techMult(state);
  const yieldMean = currentYieldMean(state);
  const expectedYield = expectedYieldFactor(yieldMean);

  return {
    rates, unlockedCount, fullLine, throughput, bottleneckId,
    lotValue, yieldMean,
    incomePerSec: throughput * lotValue * expectedYield,
    node: NODES[state.nodeIndex],
    nextNode: NODES[state.nodeIndex + 1] ?? null,
    prestigeTarget: prestigeTarget(state),
    prestigeGain: prestigeGain(state),
    canPrestige: canPrestige(state),
  };
}

function currentYieldMean(state) {
  let m = YIELD.baseMean;
  if (state.event?.type === 'particle') m -= EVENTS.particle.yieldPenalty;
  return m;
}

// 골든/스크랩까지 고려한 Lot당 기대 가치 비율
function expectedYieldFactor(mean) {
  const normal = 1 - YIELD.goldenChance - YIELD.scrapChance;
  return normal * clamp(mean, YIELD.min, YIELD.max) + YIELD.goldenChance * 0.999 * YIELD.goldenValueMult;
}

// ---------- 한 Lot 굴리기 ----------

export function rollLot(state, d, rng) {
  const r = rng();
  let kind = 'normal', y, mult = 1;
  if (r < YIELD.goldenChance) { kind = 'golden'; y = 0.999; mult = YIELD.goldenValueMult; }
  else if (r < YIELD.goldenChance + YIELD.scrapChance) { kind = 'scrap'; y = 0; }
  else y = clamp(d.yieldMean + gauss(rng) * YIELD.stdev, YIELD.min, YIELD.max);
  return { kind, yield: y, value: d.lotValue * y * mult };
}

function bankLot(state, lot, emit, source) {
  state.money += lot.value;
  state.runEarnings += lot.value;
  state.totalEarnings += lot.value;
  state.stats.lots++;
  if (lot.kind === 'golden') state.stats.golden++;
  if (lot.kind === 'scrap') state.stats.scrap++;
  if (lot.kind !== 'scrap') state.yieldAvg = state.yieldAvg * 0.9 + lot.yield * 0.1;
  if (state.event?.type === 'rush') state.event.progress++;
  emit('lot', { ...lot, source });
}

// ---------- 플레이어 행동 ----------

// 수동 투입: 탭 한 번 = Lot 하나 즉시 생산
export function tapInput(state, emit = noop, rng = Math.random) {
  const d = derive(state);
  state.stats.taps++;
  bankLot(state, rollLot(state, d, rng), emit, 'tap');
  checkAchievements(state, emit);
}

export function unlockStation(state, id, emit = noop) {
  const i = STATIONS.findIndex(s => s.id === id);
  if (i < 1) return false;
  const st = state.stations[id];
  if (st.unlocked || !state.stations[STATIONS[i - 1].id].unlocked) return false;
  const cost = unlockCost(state, i);
  if (state.money < cost) return false;
  state.money -= cost;
  st.unlocked = true;
  emit('unlock', { id });
  checkAchievements(state, emit);
  return true;
}

export function upgradeStation(state, id, emit = noop) {
  const i = STATIONS.findIndex(s => s.id === id);
  const st = state.stations[id];
  if (i < 0 || !st.unlocked) return false;
  const cost = upgradeCost(state, i, st.level);
  if (state.money < cost) return false;
  state.money -= cost;
  st.level++;
  if (LEVEL_MILESTONES.includes(st.level)) emit('milestone', { id, level: st.level });
  emit('upgrade', { id, level: st.level });
  return true;
}

// 이벤트 대응 탭 (장비 다운 수리 / 파티클 클린)
export function tapEvent(state, emit = noop) {
  const ev = state.event;
  if (!ev || ev.type === 'rush') return false;
  ev.tapsLeft--;
  if (ev.tapsLeft <= 0) {
    if (ev.type === 'down') state.stats.fixes++;
    endEvent(state, emit, 'solved');
    checkAchievements(state, emit);
  }
  return true;
}

export function prestige(state, emit = noop) {
  if (!canPrestige(state)) return false;
  const gain = prestigeGain(state);
  state.techPoints += gain;
  state.nodeIndex++;
  state.money = 0;
  state.runEarnings = 0;
  state.progress = 0;
  state.stations = freshStations();
  state.event = null;
  state.nextEventIn = randBetween(EVENTS.firstDelay, Math.random);
  emit('prestige', { node: NODES[state.nodeIndex], gain });
  checkAchievements(state, emit);
  return true;
}

// ---------- 시간 흐름 ----------

export function tick(state, dt, emit = noop, rng = Math.random) {
  updateEvents(state, dt, emit, rng);

  const d = derive(state);
  state.progress += d.throughput * dt;
  const n = Math.floor(state.progress);
  if (n > 0) {
    state.progress -= n;
    const rolled = Math.min(n, 20);
    for (let k = 0; k < rolled; k++) bankLot(state, rollLot(state, d, rng), emit, 'line');
    const rest = n - rolled;
    if (rest > 0) {
      // 아주 빠른 라인은 나머지를 기대값으로 한 번에 정산
      const v = rest * d.lotValue * expectedYieldFactor(d.yieldMean);
      state.money += v; state.runEarnings += v; state.totalEarnings += v;
      state.stats.lots += rest;
      if (state.event?.type === 'rush') state.event.progress += rest;
    }
    checkAchievements(state, emit);
  }
}

function updateEvents(state, dt, emit, rng) {
  const ev = state.event;
  if (ev) {
    ev.timeLeft -= dt;
    if (ev.type === 'rush' && ev.progress >= ev.target) {
      state.money += ev.reward; state.runEarnings += ev.reward; state.totalEarnings += ev.reward;
      state.stats.rushWins++;
      endEvent(state, emit, 'solved');
      checkAchievements(state, emit);
    } else if (ev.timeLeft <= 0) {
      endEvent(state, emit, ev.type === 'rush' ? 'failed' : 'expired');
    }
    return;
  }
  state.nextEventIn -= dt;
  if (state.nextEventIn <= 0) startRandomEvent(state, emit, rng);
}

function startRandomEvent(state, emit, rng) {
  const d = derive(state);
  const unlocked = STATIONS.filter(s => state.stations[s.id].unlocked);
  const pool = ['particle'];
  if (unlocked.length >= 2) pool.push('down', 'down');
  if (d.throughput >= 0.5) pool.push('rush');
  const type = pool[Math.floor(rng() * pool.length)];

  if (type === 'down') {
    const st = unlocked[Math.floor(rng() * unlocked.length)];
    state.event = { type, stationId: st.id, tapsLeft: EVENTS.down.fixTaps, timeLeft: EVENTS.down.autoFix, duration: EVENTS.down.autoFix };
  } else if (type === 'particle') {
    state.event = { type, tapsLeft: EVENTS.particle.cleanTaps, timeLeft: EVENTS.particle.duration, duration: EVENTS.particle.duration };
  } else {
    const target = Math.max(10, Math.ceil(d.throughput * EVENTS.rush.seconds * EVENTS.rush.targetFactor));
    state.event = { type, target, progress: 0, reward: Math.ceil(d.incomePerSec * EVENTS.rush.rewardSeconds), timeLeft: EVENTS.rush.seconds, duration: EVENTS.rush.seconds };
  }
  emit('eventStart', { ...state.event });
}

function endEvent(state, emit, result) {
  const ev = state.event;
  state.event = null;
  state.nextEventIn = randBetween(EVENTS.interval, Math.random);
  emit('eventEnd', { ...ev, result });
}

// ---------- 오프라인 ----------

// 저장 시각부터 지금까지 자리 비운 동안 번 돈을 정산하고 결과를 돌려줍니다.
export function applyOffline(state, now = Date.now()) {
  const secs = Math.min((now - (state.lastSaved || now)) / 1000, OFFLINE.maxHours * 3600);
  if (secs < OFFLINE.minSeconds) return null;
  const saved = state.event;
  state.event = null; // 자리 비운 동안 이벤트는 없던 걸로
  const d = derive(state);
  const earned = d.incomePerSec * secs * OFFLINE.rate;
  const lots = Math.floor(d.throughput * secs * OFFLINE.rate);
  state.money += earned; state.runEarnings += earned; state.totalEarnings += earned;
  state.stats.lots += lots;
  if (saved?.type === 'rush') state.nextEventIn = randBetween(EVENTS.interval, Math.random);
  state.lastSaved = now;
  return { seconds: secs, earned, lots };
}

// ---------- 업적 ----------

export function checkAchievements(state, emit = noop) {
  const d = derive(state);
  for (const a of ACHIEVEMENTS) {
    if (state.achievements.includes(a.id)) continue;
    if (a.check(state, d)) {
      state.achievements.push(a.id);
      emit('achievement', { id: a.id, name: a.name, desc: a.desc });
    }
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
