// 밸런스 시뮬레이션: node tools/sim.mjs [시간]
// 가정: 처음에 장비를 스토커 근처에 순서대로 모으고, 헬스 40 아래면 PM 지시,
//       가장 싼 '쓸모 있는' 구매(병목 증설/같은 장비 추가/FOUP/확장/엔지니어)를 반복
import * as E from '../js/engine.js';
import { PROCESSES, GRID } from '../js/data.js';
import { won, duration } from '../js/format.js';

let seed = 7;
const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const s = E.createState(0);
const log = [];
const HOURS = Number(process.argv[2] || 3);

function relayout() {
  // 스토커 옆부터 지그재그로 8대 배치 (사람이 할 법한 정리)
  const spots = [[1,0],[2,0],[3,0],[4,0],[4,1],[3,1],[2,1],[1,1]];
  // 먼저 전부 아래쪽 빈칸으로 치워두고
  s.tools.forEach((t, i) => E.moveTool(s, t.id, i % GRID.cols, s.rows - 1 - Math.floor(i / GRID.cols)));
  PROCESSES.forEach((p, i) => { const t = s.tools.find(t => t.type === p.id); E.moveTool(s, t.id, ...spots[i]); });
}
function freeNear(t) {
  for (let r = 1; r < 10; r++)
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++)
      if (Math.abs(dx) + Math.abs(dy) === r && E.cellFree(s, t.x + dx, t.y + dy)) return [t.x + dx, t.y + dy];
  return null;
}
relayout();
let firstPrestige = null;
for (let t = 0; t < HOURS * 3600; t++) {
  E.tick(s, 1, () => {}, rng);
  s.tools.filter(x => x.health < 40).forEach(x => E.orderPm(s, x.id));
  for (let g = 0; g < 30; g++) {
    const d = E.derive(s);
    const bt = s.tools.filter(x => x.type === d.bottleneck).sort((a, b) => a.level - b.level)[0];
    const opts = [];
    opts.push({ c: E.upgradeCost(s, bt), f: () => E.upgradeTool(s, bt.id) });
    const spot = freeNear(bt);
    if (spot) opts.push({ c: E.buyToolCost(s, bt.type) * 1.3, f: () => E.buyTool(s, bt.type, ...spot) });
    else if (s.rows < GRID.maxRows) opts.push({ c: E.expandCost(s), f: () => E.expandRows(s) });
    const busy = s.tools.filter(x => x.foup || x.queue.length).length / s.tools.length;
    if (busy < 0.7) opts.push({ c: E.foupCost(s) * 0.8, f: () => E.buyFoup(s) });
    if (s.tools.filter(x => x.down || x.health < 30).length >= 2 || s.engineers.length * 12 < s.tools.length) opts.push({ c: E.hireCost(s), f: () => E.hireEngineer(s) });
    opts.sort((a, b) => a.c - b.c);
    if (s.money >= opts[0].c && opts[0].f()) continue;
    break;
  }
  if (E.canPrestige(s)) {
    E.prestige(s); relayout();
    log.push(`${duration(t)} — 노드 전환 → ${E.derive(s).node.name}, 기술포인트 ${s.techPoints}`);
    firstPrestige ??= t;
  }
  if (t % 600 === 0) {
    const d = E.derive(s);
    log.push(`  [${duration(t)}] 돈 ${won(s.money)} · ${won(d.incomePerSec)}/초 · ${(d.lotsPerSec*60).toFixed(1)} Lot/분 · 장비 ${s.tools.length} · FOUP ${s.foups.length} · ${s.rows}줄 · 병목 ${d.bottleneck} · 다운 ${s.tools.filter(x=>x.down).length}`);
  }
}
console.log(log.join('\n'));
console.log('칭호', s.achievements.join(', '));
