// Pure puzzle rules. All public actions return new, JSON-serializable states.
export const CAPACITY = 25;
export const SLOT_LIMIT = 4;
export const COLORS = [
  { key: 'clean', name: '클린', short: 'CLN', symbol: '💧', hex: '#54cdb5' },
  { key: 'photo', name: '포토', short: 'PHOTO', symbol: '✦', hex: '#ec81ad' },
  { key: 'etch', name: '에치', short: 'ETCH', symbol: 'ϟ', hex: '#a28ae7' },
];

const clone = value => JSON.parse(JSON.stringify(value));
const offsets = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] };

export function vehicleCells(vehicle) {
  const horizontal = vehicle.dir === 'L' || vehicle.dir === 'R';
  return Array.from({ length: vehicle.length }, (_, index) => [
    vehicle.x + (horizontal ? index : 0),
    vehicle.y + (horizontal ? 0 : index),
  ]);
}

export function createState(level) {
  return {
    levelId: level.id,
    size: { cols: level.cols, rows: level.rows },
    route: [...level.route],
    vehicles: clone(level.vehicles),
    active: [],
    queues: clone(level.initialQueues),
    completed: 0,
    total: level.total,
    moves: 0,
    status: 'playing',
  };
}

// A car can only move straight in its arrow direction, all the way off the board.
export function getBlockers(state, id) {
  const vehicle = state.vehicles.find(item => item.id === id);
  if (!vehicle) return [];
  const occupied = new Map();
  for (const other of state.vehicles) {
    if (other.id === id) continue;
    for (const [x, y] of vehicleCells(other)) occupied.set(`${x},${y}`, other.id);
  }
  const [dx, dy] = offsets[vehicle.dir];
  let x = vehicle.x + (vehicle.dir === 'R' ? vehicle.length - 1 : 0) + dx;
  let y = vehicle.y + (vehicle.dir === 'D' ? vehicle.length - 1 : 0) + dy;
  const blockers = new Set();
  while (x >= 0 && y >= 0 && x < state.size.cols && y < state.size.rows) {
    const blocker = occupied.get(`${x},${y}`);
    if (blocker) blockers.add(blocker);
    x += dx;
    y += dy;
  }
  return [...blockers];
}

export function getAvailable(state) {
  if (state.status !== 'playing' || state.active.length >= SLOT_LIMIT) return [];
  return state.vehicles.filter(vehicle => !getBlockers(state, vehicle.id).length)
    .map(vehicle => vehicle.id);
}

function settledStatus(state) {
  if (state.completed === state.total) return 'won';
  if (state.active.length >= SLOT_LIMIT) return 'lost';
  if (!state.vehicles.some(vehicle => !getBlockers(state, vehicle.id).length)) return 'lost';
  return 'playing';
}

export function dispatch(previous, id) {
  const rejected = reason => ({ ok: false, reason, state: previous, steps: [] });
  if (previous.status !== 'playing') return rejected('이번 라운드가 끝났어요. 다시 도전해 주세요.');
  const vehicle = previous.vehicles.find(item => item.id === id);
  if (!vehicle) return rejected('이미 출발한 OHT예요.');
  if (getBlockers(previous, id).length) return rejected('화살표 앞의 OHT를 먼저 꺼내 주세요.');
  if (previous.active.length >= SLOT_LIMIT) return rejected('운행 레일 네 자리가 모두 찼어요.');

  const state = clone(previous);
  const steps = [];
  const record = (type, active, extra = {}) => steps.push({
    type,
    vehicleId: active.id,
    color: active.color,
    slot: active.slot,
    ...extra,
    state: clone(state),
  });
  const slot = Array.from({ length: SLOT_LIMIT }, (_, index) => index)
    .find(index => !state.active.some(item => item.slot === index));
  const launched = { id: vehicle.id, color: vehicle.color, slot, load: 0 };
  state.vehicles = state.vehicles.filter(item => item.id !== id);
  state.active.push(launched);
  state.moves += 1;
  record('dispatch', launched);

  // One dispatch can supply several already-waiting vehicles in the process route.
  let madeProgress = true;
  let chain = 0;
  while (madeProgress) {
    madeProgress = false;
    for (const active of [...state.active].sort((a, b) => a.slot - b.slot)) {
      for (const queue of state.queues) {
        if (queue.color !== active.color || queue.count === 0 || active.load === CAPACITY) continue;
        const amount = Math.min(queue.count, CAPACITY - active.load);
        queue.count -= amount;
        active.load += amount;
        madeProgress = true;
        record('load', active, { from: queue.location, amount, chain });
      }
      if (active.load !== CAPACITY) continue;
      chain += 1;
      record('deliver', active, { chain });
      state.active = state.active.filter(item => item.id !== active.id);
      const routeIndex = state.route.indexOf(active.color);
      const nextColor = state.route[routeIndex + 1];
      if (nextColor === undefined) {
        state.completed += CAPACITY;
        record('complete', active, { amount: CAPACITY, chain });
      } else {
        const location = COLORS[active.color].key;
        let output = state.queues.find(queue => queue.location === location && queue.color === nextColor);
        if (!output) {
          output = { location, color: nextColor, count: 0 };
          state.queues.push(output);
        }
        output.count += CAPACITY;
        record('process', active, { to: location, nextColor, amount: CAPACITY, chain });
      }
      madeProgress = true;
    }
  }

  state.status = settledStatus(state);
  // Keep intermediate visual frames playable-looking until the entire chain settles.
  if (steps.length) steps[steps.length - 1].state = clone(state);
  return { ok: true, reason: '', state, steps };
}

function stateKey(state) {
  // Slot order affects animation only; all cars have the same capacity.
  const active = state.active.map(vehicle => `${vehicle.color}:${vehicle.load}`).sort().join(',');
  const queues = state.route.map(color => state.queues
    .filter(queue => queue.color === color).reduce((count, queue) => count + queue.count, 0)).join(',');
  return `${state.vehicles.map(vehicle => vehicle.id).sort().join(',')}|${active}|${queues}|${state.completed}`;
}

export function findSolution(initial) {
  const visited = new Set();
  function search(state) {
    if (state.status === 'won' || state.completed === state.total) return [];
    if (state.status === 'lost') return null;
    const key = stateKey(state);
    if (visited.has(key)) return null;
    visited.add(key);
    const available = getAvailable(state);
    // Prefer a car that can fill now. Backtracking still explores deliberate setup moves.
    available.sort((a, b) => {
      const score = id => {
        const vehicle = state.vehicles.find(item => item.id === id);
        return state.queues.filter(queue => queue.color === vehicle.color)
          .reduce((count, queue) => count + queue.count, 0);
      };
      return score(b) - score(a);
    });
    for (const id of available) {
      const result = dispatch(state, id);
      const rest = search(result.state);
      if (rest !== null) return [id, ...rest];
    }
    return null;
  }
  return search(initial);
}

export function hint(state) {
  const solution = findSolution(state);
  if (!solution?.length) return null;
  const id = solution[0];
  const vehicle = state.vehicles.find(item => item.id === id);
  const count = state.queues.filter(queue => queue.color === vehicle.color)
    .reduce((total, queue) => total + queue.count, 0);
  return {
    id,
    message: count >= CAPACITY
      ? `${COLORS[vehicle.color].name} OHT를 보내면 25장을 채울 수 있어요.`
      : `${COLORS[vehicle.color].name} OHT를 먼저 빼서 뒤쪽 길을 열어 보세요.`,
  };
}
