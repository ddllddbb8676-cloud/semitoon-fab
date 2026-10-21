import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Browser modules remain .js without adding a package.json or a build step.
async function loadBrowserModule(path) {
  const source = await readFile(new URL(path, import.meta.url));
  return import(`data:text/javascript;base64,${source.toString('base64')}`);
}
const {
  CAPACITY, SLOT_LIMIT, createState, dispatch, findSolution,
  getAvailable, getBlockers, hint, vehicleCells,
} = await loadBrowserModule('./engine.js');
const { LEVELS } = await loadBrowserModule('./levels.js');

const copy = value => JSON.parse(JSON.stringify(value));
const waferCount = state => state.completed
  + state.queues.reduce((count, queue) => count + queue.count, 0)
  + state.active.reduce((count, vehicle) => count + vehicle.load, 0);

function assertConservation(state) {
  assert.equal(waferCount(state), state.total, 'every wafer is waiting, riding, or completed');
  assert.ok(state.active.length <= SLOT_LIMIT);
  assert.equal(new Set(state.active.map(vehicle => vehicle.slot)).size, state.active.length);
  for (const vehicle of state.active) assert.ok(vehicle.load >= 0 && vehicle.load <= CAPACITY);
  for (const queue of state.queues) assert.ok(Number.isInteger(queue.count) && queue.count >= 0);
}

function play(state, ids) {
  const allSteps = [];
  for (const id of ids) {
    const before = copy(state);
    const result = dispatch(state, id);
    assert.equal(result.ok, true, `${id}: ${result.reason}`);
    assert.deepEqual(state, before, 'dispatch never mutates the supplied state');
    result.steps.forEach(step => assertConservation(step.state));
    assertConservation(result.state);
    allSteps.push(...result.steps);
    state = result.state;
  }
  return { state, steps: allSteps };
}

test('all authored levels are inside the grid, non-overlapping, and have exact process capacity', () => {
  for (const level of LEVELS) {
    const occupied = new Set();
    const ids = new Set();
    assert.equal(level.initialQueues.reduce((sum, queue) => sum + queue.count, 0), level.total);
    for (const vehicle of level.vehicles) {
      assert.ok(!ids.has(vehicle.id));
      ids.add(vehicle.id);
      for (const [x, y] of vehicleCells(vehicle)) {
        assert.ok(x >= 0 && x < level.cols && y >= 0 && y < level.rows);
        assert.ok(!occupied.has(`${x},${y}`), `${level.id}: overlapping ${vehicle.id}`);
        occupied.add(`${x},${y}`);
      }
    }
    for (const color of level.route) {
      assert.equal(level.vehicles.filter(vehicle => vehicle.color === color).length * CAPACITY, level.total);
    }
  }
});

test('exit ray sees all blockers, including non-adjacent cars and vertical crossings', () => {
  const tutorial = createState(LEVELS[0]);
  assert.deepEqual(getBlockers(tutorial, '1-c1'), ['1-p1']);
  assert.deepEqual(getBlockers(tutorial, '1-c2'), ['1-p2']);
  assert.deepEqual(getAvailable(tutorial), ['1-p1', '1-p2']);
  const hard = createState(LEVELS[2]);
  assert.deepEqual(getBlockers(hard, '3-c1'), ['3-p1', '3-e1']);
  assert.deepEqual(getBlockers(hard, '3-c4'), ['3-p2', '3-e1']);
  assert.deepEqual(getBlockers(hard, '3-e4'), ['3-c4', '3-p2', '3-e1']);
  assert.deepEqual(getBlockers(hard, '3-p3'), ['3-c3']);
});

test('blocked and unknown taps do not consume moves or alter the puzzle', () => {
  const state = createState(LEVELS[0]);
  for (const id of ['1-c1', 'missing']) {
    const result = dispatch(state, id);
    assert.equal(result.ok, false);
    assert.equal(result.state, state);
    assert.equal(state.moves, 0);
    assert.deepEqual(result.steps, []);
  }
});

test('a fourth future-color car causes an understandable full waiting-lane loss', () => {
  const { state } = play(createState(LEVELS[1]), ['2-e1', '2-p3', '2-e2', '2-p1']);
  assert.equal(state.status, 'lost');
  assert.equal(state.active.length, 4);
  assert.equal(state.active.every(vehicle => vehicle.load === 0), true);
  assert.equal(state.completed, 0);
  assert.equal(state.queues[0].count, 75);
  assert.equal(findSolution(state), null);
  assert.equal(hint(state), null);
});

test('the last slot can launch three successive process deliveries before failure is checked', () => {
  const waiting = play(createState(LEVELS[1]), ['2-e1', '2-p3', '2-e2']).state;
  assert.equal(waiting.active.length, 3);
  const { state, steps } = play(waiting, ['2-c2']);
  assert.equal(state.status, 'playing');
  assert.equal(state.completed, 25);
  assert.equal(state.active.length, 1);
  assert.deepEqual(steps.filter(step => step.type === 'deliver').map(step => step.color), [0, 1, 2]);
  assert.deepEqual(steps.filter(step => step.type === 'deliver').map(step => step.chain), [1, 2, 3]);
  assert.ok(steps.some(step => step.state.active.length === 4), 'an animation frame may fill all slots safely');
});

test('25 individual wafers can be collected from multiple equipment queues without rounding', () => {
  const level = {
    id: 'counting', cols: 6, rows: 4, route: [0, 1], total: 25,
    initialQueues: [
      { location: 'input', color: 0, count: 12 },
      { location: 'clean', color: 0, count: 13 },
    ],
    vehicles: [
      { id: 'c', color: 0, x: 0, y: 0, dir: 'L', length: 2 },
      { id: 'p', color: 1, x: 0, y: 2, dir: 'L', length: 2 },
    ],
  };
  const result = play(createState(level), ['c', 'p']);
  assert.deepEqual(result.steps.filter(step => step.type === 'load').map(step => step.amount), [12, 13, 25]);
  assert.equal(result.steps.find(step => step.type === 'load').state.active[0].load, 12);
  assert.equal(result.state.status, 'won');
});

test('every level has a real solution; every replay frame conserves all wafers', () => {
  for (const level of LEVELS) {
    const initial = createState(level);
    const solution = findSolution(initial);
    assert.ok(solution, `level ${level.id} must be solvable`);
    const { state } = play(initial, solution);
    assert.equal(state.status, 'won');
    assert.equal(state.completed, level.total);
    assert.equal(state.vehicles.length, 0);
    assert.equal(state.active.length, 0);
    assert.equal(state.queues.every(queue => queue.count === 0), true);
  }
});

test('hint is a winning continuation, including after a setup move', () => {
  for (const level of LEVELS) {
    let state = createState(level);
    let count = 0;
    while (state.status === 'playing') {
      const suggestion = hint(state);
      assert.ok(suggestion);
      assert.ok(suggestion.message.length > 0);
      state = play(state, [suggestion.id]).state;
      assert.ok(++count <= level.vehicles.length);
    }
    assert.equal(state.status, 'won');
  }
});

test('undo is exact immutable state restoration, including after a loss', () => {
  const waiting = play(createState(LEVELS[1]), ['2-e1', '2-p3', '2-e2']).state;
  const saved = copy(waiting);
  assert.equal(dispatch(waiting, '2-p1').state.status, 'lost');
  assert.deepEqual(waiting, saved);
  const recovered = play(saved, ['2-c2']).state;
  assert.equal(recovered.status, 'playing');
  assert.ok(findSolution(recovered));
});

test('a geometric deadlock also ends, even if waiting-lane slots remain', () => {
  const state = createState({
    id: 'deadlock', cols: 6, rows: 4, route: [0, 1], total: 25,
    initialQueues: [{ location: 'input', color: 0, count: 25 }],
    vehicles: [
      { id: 'left', color: 0, x: 0, y: 0, dir: 'R', length: 2 },
      { id: 'right', color: 1, x: 3, y: 0, dir: 'L', length: 2 },
      { id: 'free', color: 1, x: 0, y: 2, dir: 'L', length: 2 },
    ],
  });
  const result = dispatch(state, 'free');
  assert.equal(result.state.status, 'lost');
  assert.equal(result.state.active.length, 1);
  assertConservation(result.state);
});
