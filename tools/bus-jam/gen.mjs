// 버스 잼 레벨 생성기: node tools/bus-jam/gen.mjs
// 1) 역순 배치: 차를 하나씩 놓되 '이미 놓인 차'에 길이 막히지 않게 → 나중에 놓은 차부터 빼면 반드시 다 빠짐
// 2) 승객 행렬: 빼는 순서를 기준으로 승객 덩어리를 쪼개고 조금씩 섞음 (섞을수록 어려움)
// 3) 풀이기로 '일반 칸 4개만으로' 풀리는지 검증, 생각하는 플레이어 시뮬레이션으로 난이도 측정
// 4) 목표 난이도에 맞는 시드를 골라 prototypes/bus-jam/levels.json 저장

import { writeFileSync } from 'node:fs';
import { SIZES, DIRS, cellsOf, exitPath, occupancy, solve, playGreedy } from '../../prototypes/bus-jam/core.js';

const COLS = 7, ROWS = 8;

// 레벨 설계표. winRate = '적당히 생각하는 플레이어'의 클리어 비율 목표 구간
const PLAN = [
  { n: 1,  colors: 2, count: 4,  sizes: { car: 1 },                   mystery: 0, window: 1, chunk: [4, 4],  winRate: [0.95, 1],    hard: false },
  { n: 2,  colors: 3, count: 6,  sizes: { car: 1 },                   mystery: 0, window: 2, chunk: [2, 4],  winRate: [0.85, 1],    hard: false },
  { n: 3,  colors: 3, count: 8,  sizes: { car: 3, van: 1 },           mystery: 0, window: 2, chunk: [2, 4],  winRate: [0.75, 0.97], hard: false },
  { n: 4,  colors: 4, count: 10, sizes: { car: 3, van: 1 },           mystery: 0, window: 3, chunk: [2, 4],  winRate: [0.6, 0.9],   hard: false },
  { n: 5,  colors: 4, count: 11, sizes: { car: 2, van: 1, bus: 1 },   mystery: 0, window: 4, chunk: [2, 3],  winRate: [0.2, 0.5],   hard: true  },
  { n: 6,  colors: 4, count: 12, sizes: { car: 3, van: 1, bus: 1 },   mystery: 2, window: 3, chunk: [2, 4],  winRate: [0.55, 0.85], hard: false },
  { n: 7,  colors: 5, count: 13, sizes: { car: 3, van: 2, bus: 1 },   mystery: 2, window: 3, chunk: [2, 4],  winRate: [0.5, 0.8],   hard: false },
  { n: 8,  colors: 5, count: 14, sizes: { car: 3, van: 2, bus: 1 },   mystery: 4, window: 4, chunk: [2, 4],  winRate: [0.4, 0.7],   hard: false },
  { n: 9,  colors: 5, count: 15, sizes: { car: 3, van: 2, bus: 1 },   mystery: 4, window: 4, chunk: [2, 3],  winRate: [0.35, 0.65], hard: false },
  { n: 10, colors: 6, count: 16, sizes: { car: 3, van: 2, bus: 1 },   mystery: 5, window: 5, chunk: [2, 3],  winRate: [0.1, 0.35],  hard: true  },
];

function mulberry(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];
function weighted(w, rng) {
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (const [k, v] of Object.entries(w)) { if ((r -= v) < 0) return k; }
  return Object.keys(w)[0];
}

function placeVehicles(plan, rng) {
  const placed = [];
  for (let tries = 0; placed.length < plan.count && tries < 4000; tries++) {
    const size = weighted(plan.sizes, rng);
    const dir = pick(Object.keys(DIRS), rng);
    const len = SIZES[size].len;
    const horiz = dir === 'L' || dir === 'R';
    const x = Math.floor(rng() * (horiz ? COLS - len + 1 : COLS));
    const y = Math.floor(rng() * (horiz ? ROWS : ROWS - len + 1));
    const v = { id: placed.length, x, y, dir, size };
    const grid = occupancy(placed, COLS, ROWS);
    if (cellsOf(v).some(([cx, cy]) => grid[cy * COLS + cx] !== -1)) continue;
    // 이미 놓인 차들이 이 차의 길을 막으면 안 됨
    if (exitPath(v, COLS, ROWS).some(([cx, cy]) => grid[cy * COLS + cx] !== -1)) continue;
    // 반대로 이 차가 이미 놓인 차들의 길을 막는 건 OK (그게 '막힘'을 만듦). 다만 너무 쉬운 판을 피하려고
    // 아무도 안 막는 위치는 초반 몇 대 이후엔 덜 선호
    if (placed.length >= 2 && rng() < 0.6) {
      const blocksSomeone = placed.some(o => exitPath(o, COLS, ROWS).some(([cx, cy]) => cellsOf(v).some(([a, b]) => a === cx && b === cy)));
      if (!blocksSomeone) continue;
    }
    placed.push(v);
  }
  return placed.length === plan.count ? placed : null;
}

function buildLevel(plan, seed) {
  const rng = mulberry(seed);
  const vehicles = placeVehicles(plan, rng);
  if (!vehicles) return null;

  // 색 배정: 색마다 최소 1대, 나머지는 무작위
  const colorOf = vehicles.map((_, i) => (i < plan.colors ? i : Math.floor(rng() * plan.colors)));
  for (let i = colorOf.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [colorOf[i], colorOf[j]] = [colorOf[j], colorOf[i]]; }
  vehicles.forEach((v, i) => { v.color = colorOf[i]; });

  // 의도한 빼는 순서 = 놓은 역순. 차마다 승객 덩어리를 쪼갬
  const exitOrder = vehicles.slice().reverse();
  const chunks = [];
  exitOrder.forEach((v, rank) => {
    let left = SIZES[v.size].cap;
    while (left > 0) {
      const [a, b] = plan.chunk;
      const c = Math.min(left, a + Math.floor(rng() * (b - a + 1)));
      chunks.push({ color: v.color, n: c, rank });
      left -= c;
    }
  });
  // 창(window) 안에서 무작위로 꺼내 순서를 흐트러뜨림
  const queueChunks = [];
  const pool = chunks.slice();
  while (pool.length) {
    const w = Math.min(plan.window, pool.length);
    const i = Math.floor(rng() * w);
    queueChunks.push(pool.splice(i, 1)[0]);
  }
  const queue = [];
  for (const c of queueChunks) for (let k = 0; k < c.n; k++) queue.push(c.color);

  // 노이즈(미스터리) 차: 처음부터 빠질 수 있는 차는 제외하고 고름
  const level = { n: plan.n, cols: COLS, rows: ROWS, slots: 4, colors: plan.colors, hard: plan.hard, vehicles, queue };
  const grid = occupancy(vehicles, COLS, ROWS);
  const blocked = vehicles.filter(v => exitPath(v, COLS, ROWS).some(([cx, cy]) => grid[cy * COLS + cx] !== -1));
  for (let k = 0; k < plan.mystery && blocked.length; k++) {
    const v = blocked.splice(Math.floor(rng() * blocked.length), 1)[0];
    v.mystery = true;
  }
  return level;
}

function measure(level, trials = 300) {
  const rng = mulberry(12345);
  let wins = 0;
  for (let t = 0; t < trials; t++) if (playGreedy(level, rng)) wins++;
  return wins / trials;
}

const out = [];
for (const plan of PLAN) {
  let best = null;
  for (let seed = plan.n * 1000; seed < plan.n * 1000 + 3000; seed++) {
    const level = buildLevel(plan, seed);
    if (!level) continue;
    const sol = solve(level);
    if (!sol.ok) continue;
    // 원작처럼 '칸 하나만 더 있었으면' 느낌: 3칸으로는 안 풀리는 판을 어려운 판으로 선호
    const wr = measure(level);
    const [lo, hi] = plan.winRate;
    if (wr < lo || wr > hi) continue;
    const tight = plan.hard ? !solve(level, 3).ok : true;
    if (!tight) continue;
    best = { level, wr, seed, nodes: sol.nodes, solution: sol.order };
    break;
  }
  if (!best) { console.error(`레벨 ${plan.n}: 조건에 맞는 판을 못 찾음`); process.exit(1); }
  const { level, wr, seed, solution } = best;
  level.solution = solution; // 테스트용 정답 (게임에서는 안 씀)
  out.push(level);
  const pax = level.queue.length;
  console.log(`레벨 ${String(plan.n).padStart(2)} | 시드 ${seed} | 차 ${level.vehicles.length}대 | 승객 ${pax}명 | 색 ${plan.colors} | 미스터리 ${plan.mystery} | 생각하는 플레이어 클리어율 ${(wr * 100).toFixed(0)}%${plan.hard ? ' | HARD' : ''}`);
}
writeFileSync(new URL('../../prototypes/bus-jam/levels.json', import.meta.url), JSON.stringify(out));
console.log('저장: prototypes/bus-jam/levels.json');
