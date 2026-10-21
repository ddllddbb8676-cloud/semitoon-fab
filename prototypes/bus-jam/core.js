// 버스 잼 프로토타입 — 순수 규칙 (DOM 없음). 게임 화면과 레벨 생성기가 함께 씁니다.
//
// 좌표: 주차장은 cols × rows 격자. 차는 (x, y)부터 진행 방향 축으로 len칸을 차지합니다.
// 방향 U/D/L/R. 차는 머리 방향으로만 빠지고, 머리 앞부터 격자 끝까지 다른 차가 없어야 합니다.

export const SIZES = {
  car: { len: 2, cap: 4 },
  van: { len: 3, cap: 6 },
  bus: { len: 4, cap: 10 },
};
export const DIRS = {
  U: { dx: 0, dy: -1 }, D: { dx: 0, dy: 1 },
  L: { dx: -1, dy: 0 }, R: { dx: 1, dy: 0 },
};

// 차가 차지하는 칸 목록. (x, y)는 차의 '꼬리 쪽 위/왼쪽 끝'이 아니라 항상 좌상단 칸입니다.
export function cellsOf(v) {
  const len = SIZES[v.size].len;
  const horiz = v.dir === 'L' || v.dir === 'R';
  const out = [];
  for (let i = 0; i < len; i++) out.push(horiz ? [v.x + i, v.y] : [v.x, v.y + i]);
  return out;
}

// 머리 칸 (진행 방향 쪽 끝)
export function headOf(v) {
  const c = cellsOf(v);
  return v.dir === 'R' || v.dir === 'D' ? c[c.length - 1] : c[0];
}

// 머리 앞에서 격자 끝까지의 칸
export function exitPath(v, cols, rows) {
  const { dx, dy } = DIRS[v.dir];
  let [x, y] = headOf(v);
  const out = [];
  for (;;) {
    x += dx; y += dy;
    if (x < 0 || y < 0 || x >= cols || y >= rows) return out;
    out.push([x, y]);
  }
}

export function occupancy(vehicles, cols, rows, skipId = null) {
  const grid = new Array(cols * rows).fill(-1);
  for (const v of vehicles) {
    if (v.id === skipId) continue;
    for (const [x, y] of cellsOf(v)) grid[y * cols + x] = v.id;
  }
  return grid;
}

// 빠질 수 있으면 null, 막혔으면 막은 차 id
export function blockerOf(v, vehicles, cols, rows, grid = occupancy(vehicles, cols, rows)) {
  for (const [x, y] of exitPath(v, cols, rows)) {
    const id = grid[y * cols + x];
    if (id !== -1 && id !== v.id) return id;
  }
  return null;
}

// ---------- 탑승 규칙 ----------
// slots: [{ id, color, cap, filled }] (빈 칸은 null). queue: 색 배열, qi: 맨 앞 승객 인덱스.
// 맨 앞 승객 색과 같은 차가 칸에 있으면 (먼저 들어온 차부터) 탄다. 가득 차면 출발.
// 이 함수는 한 명씩 태우는 대신 끝까지 한 번에 처리한 결과를 돌려줍니다 (풀이기용).
export function settle(slots, queue, qi) {
  slots = slots.map(s => s && { ...s });
  for (;;) {
    if (qi >= queue.length) break;
    const c = queue[qi];
    const s = slots.find(s => s && s.color === c && s.filled < s.cap);
    if (!s) break;
    s.filled++; qi++;
    if (s.filled === s.cap) slots[slots.indexOf(s)] = null;
  }
  return { slots, qi };
}

// ---------- 풀이기 ----------
// 일반 주차칸 slotCount개만으로 풀 수 있는지 깊이 우선 탐색. 풀리면 차를 빼는 순서를 돌려줍니다.
export function solve(level, slotCount = level.slots, nodeLimit = 200000) {
  const { cols, rows } = level;
  const all = level.vehicles;
  const n = all.length;
  const failed = new Set();
  let nodes = 0;
  const order = [];

  function key(alive, slots, qi) {
    return alive.join('') + '|' + qi + '|' + slots.map(s => s ? s.id + ':' + s.filled : '_').sort().join(',');
  }

  function dfs(alive, slots, qi) {
    if (qi >= level.queue.length) return true;
    if (++nodes > nodeLimit) throw new Error('limit');
    const k = key(alive, slots, qi);
    if (failed.has(k)) return false;
    const free = slots.indexOf(null);
    if (free === -1) { failed.add(k); return false; }
    const live = all.filter((v, i) => alive[i]);
    const grid = occupancy(live, cols, rows);
    // 맨 앞 승객과 같은 색 차를 먼저 시도 (탐색 가속)
    const front = level.queue[qi];
    const cands = live.filter(v => blockerOf(v, live, cols, rows, grid) === null)
      .sort((a, b) => (b.color === front) - (a.color === front));
    for (const v of cands) {
      const i = all.indexOf(v);
      const a2 = alive.slice(); a2[i] = 0;
      const s2 = slots.slice(); s2[free] = { id: v.id, color: v.color, cap: SIZES[v.size].cap, filled: 0 };
      const r = settle(s2, level.queue, qi);
      order.push(v.id);
      if (dfs(a2, r.slots, r.qi)) return true;
      order.pop();
    }
    failed.add(k);
    return false;
  }

  try {
    const ok = dfs(new Array(n).fill(1), new Array(slotCount).fill(null), 0);
    return { ok, order: ok ? order.slice() : null, nodes };
  } catch {
    return { ok: false, order: null, nodes, limit: true };
  }
}

// ---------- 난이도 측정용 플레이어 ----------
// '적당히 생각하는' 플레이어: 빠질 수 있는 차 중 맨 앞 승객 색 → 다음 몇 명 색 순으로 선호, 나머지는 무작위.
export function playGreedy(level, rng, slotCount = level.slots, look = 12) {
  const { cols, rows } = level;
  let live = level.vehicles.slice();
  let slots = new Array(slotCount).fill(null);
  let qi = 0;
  while (qi < level.queue.length) {
    const free = slots.indexOf(null);
    if (free === -1) return false;
    const grid = occupancy(live, cols, rows);
    const cands = live.filter(v => blockerOf(v, live, cols, rows, grid) === null);
    if (!cands.length) return false;
    const soon = level.queue.slice(qi, qi + look);
    const score = v => {
      const i = soon.indexOf(v.color);
      return (i === -1 ? 0 : look - i) + rng() * 4;
    };
    const v = cands.sort((a, b) => score(b) - score(a))[0];
    live = live.filter(o => o !== v);
    slots[free] = { id: v.id, color: v.color, cap: SIZES[v.size].cap, filled: 0 };
    ({ slots, qi } = settle(slots, level.queue, qi));
  }
  return true;
}
