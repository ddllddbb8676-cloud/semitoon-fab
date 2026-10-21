// 게임 데이터·밸런스 상수 (담당: Claude)
// 숫자를 바꾸면 밸런스가 바뀝니다. 디자인 작업에서는 수정하지 마세요.

// 8대 공정 = 생산 라인의 스테이션. 순서가 곧 라인 순서입니다.
export const STATIONS = [
  { id: 'clean', name: '세정',     equip: 'Wet Station',      unlockCost: 0,       lotValue: 1_000 },
  { id: 'photo', name: '포토',     equip: 'Scanner',          unlockCost: 30_000,  lotValue: 4_000 },
  { id: 'etch',  name: '식각',     equip: 'Dry Etcher',       unlockCost: 250_000, lotValue: 15_000 },
  { id: 'diff',  name: '확산',     equip: 'Furnace',          unlockCost: 2e6,     lotValue: 60_000 },
  { id: 'imp',   name: '이온주입', equip: 'Implanter',        unlockCost: 15e6,    lotValue: 250_000 },
  { id: 'depo',  name: '증착',     equip: 'CVD Chamber',      unlockCost: 120e6,   lotValue: 1e6 },
  { id: 'metal', name: '금속배선', equip: 'PVD Sputter',      unlockCost: 1e9,     lotValue: 4e6 },
  { id: 'cmp',   name: 'CMP',      equip: 'CMP Polisher',     unlockCost: 8e9,     lotValue: 16e6 },
];

// 라인 전체(8공정)를 갖추면 "완성 칩"이 되어 Lot 가치가 배수로 뜁니다.
export const FULL_LINE_BONUS = 3;

// 스테이션 처리 속도 (Lot/초)
export const BASE_RATE = 0.5;          // 레벨 1 기준
export const RATE_PER_LEVEL = 0.25;    // 레벨당 +25%p
export const LEVEL_MILESTONES = [10, 25, 50, 100, 200]; // 도달 시 속도 ×2
export const UPGRADE_COST_FACTOR = 10; // 첫 업그레이드 비용 = lotValue × 10
export const UPGRADE_COST_GROWTH = 1.15;

// 수율 (0~1)
export const YIELD = {
  baseMean: 0.86,
  stdev: 0.05,
  min: 0.35,
  max: 0.995,
  goldenChance: 0.01,  // 골든 Lot: 수율 99.9%, 가치 ×10
  goldenValueMult: 10,
  scrapChance: 0.02,   // 스크랩 Lot: 가치 0
};

// 기술 노드 = 프레스티지 단계. 전환하면 돈·레벨이 초기화되고 기술 포인트를 얻습니다.
export const NODES = [
  { id: 'n2d',  name: '2D NAND 20nm', short: '2D' },
  { id: 'v24',  name: '3D NAND 24단', short: '24단' },
  { id: 'v48',  name: '3D NAND 48단', short: '48단' },
  { id: 'v64',  name: '3D NAND 64단', short: '64단' },
  { id: 'v96',  name: '3D NAND 96단', short: '96단' },
  { id: 'v128', name: '3D NAND 128단', short: '128단' },
  { id: 'v176', name: '3D NAND 176단', short: '176단' },
  { id: 'v236', name: '3D NAND 236단', short: '236단' },
  { id: 'v321', name: '3D NAND 321단', short: '321단' },
  { id: 'v400', name: '3D NAND 400단+', short: '400단+' },
];
export const NODE_VALUE_MULT = 3;          // 노드마다 Lot 가치 ×3
export const PRESTIGE_BASE = 2e10;         // 첫 전환 조건: 이번 노드 누적 매출 200억
export const PRESTIGE_GROWTH = 12;         // 다음 노드 조건 ×12
export const TECH_POINT_BONUS = 0.05;      // 기술 포인트 1당 매출 +5%

// 오프라인 수익
export const OFFLINE = { rate: 0.5, maxHours: 8, minSeconds: 60 };

// 이벤트
export const EVENTS = {
  firstDelay: [45, 75],     // 첫 이벤트까지(초)
  interval: [80, 140],      // 이후 간격(초)
  down: { fixTaps: 5, autoFix: 30 },
  particle: { yieldPenalty: 0.25, duration: 45, cleanTaps: 3 },
  rush: { seconds: 60, targetFactor: 1.3, rewardSeconds: 180 },
};

// 업적 / 칭호. check(state, derived)가 true가 되면 해금
export const ACHIEVEMENTS = [
  { id: 'first_lot',  name: '첫 Lot 아웃',        desc: 'Lot 1개 생산',               check: s => s.stats.lots >= 1 },
  { id: 'lots_1k',    name: '천 Lot 장인',         desc: 'Lot 1,000개 생산',           check: s => s.stats.lots >= 1000 },
  { id: 'golden',     name: '수율 귀신',           desc: '골든 Lot 처음 뽑기',          check: s => s.stats.golden >= 1 },
  { id: 'scrap_10',   name: '스크랩은 거들 뿐',     desc: '스크랩 Lot 10번 겪기',        check: s => s.stats.scrap >= 10 },
  { id: 'full_line',  name: '풀 라인 구축',         desc: '8공정 전부 오픈',             check: (s, d) => d.unlockedCount === 8 },
  { id: 'fix_10',     name: '새벽 3시 콜 받는 사람', desc: '장비 다운 10번 직접 살리기',    check: s => s.stats.fixes >= 10 },
  { id: 'rush_ok',    name: '납기 지켜드렸습니다',   desc: '긴급 오더 처음 성공',          check: s => s.stats.rushWins >= 1 },
  { id: 'taps_500',   name: '수동 투입 장인',       desc: '직접 투입 500번',            check: s => s.stats.taps >= 500 },
  { id: 'node_1',     name: '3D로 간다',           desc: '첫 노드 전환',               check: s => s.nodeIndex >= 1 },
  { id: 'node_5',     name: '단수 올리기 중독',     desc: '128단 도달',                check: s => s.nodeIndex >= 5 },
];
