// 밸런스 시뮬레이션: node tools/sim.mjs
// 욕심쟁이 플레이어(병목만 업그레이드, 열 수 있으면 다음 공정 오픈)를 가정합니다.
import { createState, tick, derive, unlockStation, upgradeStation, tapInput, upgradeCost, unlockCost, prestige, canPrestige } from '../js/engine.js';
import { STATIONS } from '../js/data.js';
import { won, duration } from '../js/format.js';

let seed = 42;
const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const s = createState(0);
const marks = [];
let t = 0;
const HOURS = Number(process.argv[2] || 12);
for (; t < HOURS * 3600; t++) {
  if (t < 600) for (let k = 0; k < 3; k++) tapInput(s, () => {}, rng);
  if (s.event && s.event.type !== 'rush') { s.event.tapsLeft = 1; }
  for (let k = 0; k < 10; k++) tick(s, 0.1, (type, p) => {
    if (type === 'eventStart' && s.event.type !== 'rush') { /* 플레이어가 바로 대응한다고 가정 */ }
  }, rng);
  // 구매 루프
  for (let guard = 0; guard < 50; guard++) {
    const d = derive(s);
    const nextIdx = STATIONS.findIndex(st => !s.stations[st.id].unlocked);
    if (nextIdx > 0 && s.money >= unlockCost(s, nextIdx)) {
      unlockStation(s, STATIONS[nextIdx].id);
      marks.push(`${duration(t)} — ${STATIONS[nextIdx].name} 오픈`);
      continue;
    }
    const bi = STATIONS.findIndex(st => st.id === d.bottleneckId);
    const c = upgradeCost(s, bi, s.stations[d.bottleneckId].level);
    const saveFor = nextIdx > 0 ? unlockCost(s, nextIdx) : Infinity;
    if (s.money >= c && (c < saveFor * 0.25 || s.money - c >= saveFor * 0.5 || nextIdx < 0)) upgradeStation(s, d.bottleneckId);
    else break;
  }
  if (canPrestige(s)) {
    const before = s.nodeIndex;
    prestige(s);
    marks.push(`${duration(t)} — 노드 전환 → ${before + 1}단계, 기술포인트 ${s.techPoints}`);
  }
  if (t % 1800 === 0) {
    const d = derive(s);
    marks.push(`  [${duration(t)}] 돈 ${won(s.money)}, 초당 ${won(d.incomePerSec)}, 처리량 ${d.throughput.toFixed(2)}/s, 병목 ${d.bottleneckId}`);
  }
}
console.log(marks.join('\n'));
