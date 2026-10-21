// 게임 데이터·밸런스 상수 (담당: Claude)
// 숫자를 바꾸면 밸런스가 바뀝니다. 디자인 작업에서는 수정하지 마세요.

// 8대 공정 = 장비 종류. 배열 순서가 곧 FOUP이 거치는 공정 순서입니다.
// time: 레벨1 장비가 FOUP 하나를 처리하는 시간(초), price: 추가 구매가, wear: 처리 1회당 헬스 감소
export const PROCESSES = [
  { id: 'clean', name: '세정',     equip: 'Wet Station',  short: '세정', time: 3, price: 60_000,  wear: 1.0 },
  { id: 'photo', name: '포토',     equip: 'Scanner',      short: '포토', time: 6, price: 400_000, wear: 1.6 },
  { id: 'etch',  name: '식각',     equip: 'Dry Etcher',   short: '식각', time: 5, price: 200_000, wear: 1.3 },
  { id: 'diff',  name: '확산',     equip: 'Furnace',      short: '확산', time: 7, price: 150_000, wear: 1.0 },
  { id: 'imp',   name: '이온주입', equip: 'Implanter',    short: '임프', time: 4, price: 250_000, wear: 1.3 },
  { id: 'depo',  name: '증착',     equip: 'CVD Chamber',  short: '증착', time: 5, price: 150_000, wear: 1.2 },
  { id: 'metal', name: '금속배선', equip: 'PVD Sputter',  short: '메탈', time: 5, price: 200_000, wear: 1.3 },
  { id: 'cmp',   name: 'CMP',      equip: 'CMP Polisher', short: 'CMP',  time: 4, price: 120_000, wear: 1.5 },
];
export const PROCESS_INDEX = Object.fromEntries(PROCESSES.map((p, i) => [p.id, i]));

// 클린룸 격자
export const GRID = {
  cols: 6,
  startRows: 8,
  maxRows: 16,
  expandCost: 600_000,     // 첫 확장 비용 (1줄)
  expandGrowth: 2.2,
};
export const STOCKER = { x: 0, y: 0 }; // FOUP이 출발하고 돌아오는 스토커 (고정)

// 시작 배치: 일부러 흩어 놓았습니다. 가까이 모으면 빨라진다는 걸 플레이어가 깨닫게.
export const START_LAYOUT = [
  { type: 'clean', x: 2, y: 1 }, { type: 'photo', x: 4, y: 1 },
  { type: 'etch',  x: 1, y: 3 }, { type: 'diff',  x: 5, y: 3 },
  { type: 'imp',   x: 3, y: 4 }, { type: 'depo',  x: 0, y: 6 },
  { type: 'metal', x: 4, y: 6 }, { type: 'cmp',   x: 2, y: 7 },
];

// 장비
export const TOOL = {
  speedPerLevel: 0.2,            // 레벨당 처리속도 +20%
  milestones: [10, 25, 50, 100], // 도달 시 속도 ×2
  upgradeCostFactor: 0.5,        // 첫 증설 = 장비값 × 0.5
  upgradeGrowth: 1.25,
  buyGrowth: 2.0,                // 같은 종류 n대째 구매가 ×2^(n-1)
  bayBonus: 0.15,                // 상하좌우로 붙은 같은 종류 장비 1대당 속도 +15% (Bay 효과)
  warnHealth: 30,                // 이 아래면 느려지고 고장 위험
  warnSpeed: 0.7,
  warnYieldPenalty: 0.06,
  breakChance: 0.15,             // 헬스 경고 상태에서 처리 끝날 때 고장 확률
  sellRefund: 0.5,
};

// FOUP (웨이퍼 25장이 든 상자 = Lot 1개)
export const FOUP = {
  start: 3,
  max: 40,
  speed: 2.5,          // OHT 이동 속도 (칸/초). 천장 레일이라 장비를 피해 가지 않고 직각으로 이동
  cost: 40_000,
  costGrowth: 1.55,
};

// 엔지니어
export const ENGINEER = {
  speed: 1.6,          // 걷는 속도 (칸/초)
  fixTime: 4,          // 다운 장비 살리기(초)
  pmTime: 3,           // PM(초) → 헬스 100
  hireCost: 1_500_000,
  hireGrowth: 3,
  max: 4,
  autoPmBelow: 50,     // 2번째부터 고용한 엔지니어는 헬스가 이 아래인 장비를 알아서 PM
  names: ['신입 세미', '박 선임', '최 책임', '김 수석'],
};

// 칩 가치
export const LOT_VALUE = 30_000;   // 2D 노드, 수율 100% 기준 Lot 1개 가치

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

// 기술 노드 = 프레스티지 단계
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
export const NODE_VALUE_MULT = 3;     // 노드마다 칩값·장비값 ×3
export const PRESTIGE_BASE = 4e7;     // 첫 전환 조건: 이번 노드 누적 매출 4천만
export const PRESTIGE_GROWTH = 6;
export const TECH_POINT_BONUS = 0.05; // 기술 포인트 1당 매출 +5%

// 오프라인 수익
export const OFFLINE = { rate: 0.5, maxHours: 8, minSeconds: 60 };

// 돌발 이벤트 (장비 고장은 헬스로 따로 발생)
export const EVENTS = {
  firstDelay: [60, 90],
  interval: [90, 150],
  particle: { yieldPenalty: 0.25, duration: 45, cleanTaps: 3 },
  rush: { seconds: 90, targetFactor: 1.4, rewardSeconds: 180 },
};

// 칭호. check(state)가 true가 되면 해금
export const ACHIEVEMENTS = [
  { id: 'first_lot',  name: '첫 Lot 아웃',          desc: 'Lot 1개 완성',              check: s => s.stats.lots >= 1 },
  { id: 'lots_1k',    name: '천 Lot 장인',           desc: 'Lot 1,000개 완성',          check: s => s.stats.lots >= 1000 },
  { id: 'golden',     name: '수율 귀신',             desc: '골든 Lot 처음 뽑기',         check: s => s.stats.golden >= 1 },
  { id: 'scrap_10',   name: '스크랩은 거들 뿐',       desc: '스크랩 Lot 10번 겪기',       check: s => s.stats.scrap >= 10 },
  { id: 'relayout',   name: '레이아웃 장인',          desc: '장비 10번 옮기기',           check: s => s.stats.moves >= 10 },
  { id: 'fix_10',     name: '새벽 3시 콜 받는 사람',   desc: '다운 장비 10번 살리기',       check: s => s.stats.fixes >= 10 },
  { id: 'pm_50',      name: 'PM 안 미루는 사람',      desc: 'PM 50번',                  check: s => s.stats.pms >= 50 },
  { id: 'rush_ok',    name: '납기 지켜드렸습니다',     desc: '긴급 오더 처음 성공',         check: s => s.stats.rushWins >= 1 },
  { id: 'bay',        name: 'Bay 구성 완료',          desc: '같은 장비 3대 붙여 놓기',      check: s => s.stats.maxBay >= 3 },
  { id: 'node_1',     name: '3D로 간다',             desc: '첫 노드 전환',               check: s => s.nodeIndex >= 1 },
];
