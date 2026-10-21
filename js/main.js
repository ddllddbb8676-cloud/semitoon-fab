// 시작점: 게임 루프, 저장/불러오기, 이벤트 중계 (담당: Claude)

import { createState, hydrate, tick, applyOffline } from './engine.js';
import { mountUI, render, pushLot, toast, showModal } from './ui.js';
import { won, duration } from './format.js';

const SAVE_KEY = 'semitoon-fab-save-v1';
const TICK_MS = 100;
const SAVE_EVERY_MS = 10_000;

const state = loadState();
let lastFeedAt = 0;

// 엔진에서 일어난 일을 화면 알림 + document 이벤트로 내보냅니다.
// 디자인 효과(js/fx.js)는 document.addEventListener('fab:golden', ...) 처럼 듣기만 하면 됩니다.
function emit(type, detail = {}) {
  document.dispatchEvent(new CustomEvent('fab:' + type, { detail }));
  switch (type) {
    case 'lot': {
      const now = performance.now();
      if (detail.source === 'tap' || detail.kind !== 'normal' || now - lastFeedAt > 500) {
        pushLot(detail); lastFeedAt = now;
      }
      if (detail.kind === 'golden') document.dispatchEvent(new CustomEvent('fab:golden', { detail }));
      if (detail.kind === 'scrap') document.dispatchEvent(new CustomEvent('fab:scrap', { detail }));
      break;
    }
    case 'unlock': toast('새 공정 오픈!', 'good'); break;
    case 'milestone': toast(`Lv.${detail.level} 달성 · 속도 2배!`, 'good'); break;
    case 'eventEnd':
      if (detail.result === 'solved') toast(detail.type === 'rush' ? '납기 성공! 보너스 입금' : '해결 완료!', 'good');
      if (detail.result === 'failed') toast('납기 실패… 다음엔 꼭', 'bad');
      break;
    case 'achievement': toast(`업적 달성: ${detail.name}`, 'achievement'); break;
    case 'prestige':
      showModal(`${detail.node.name} 진입!`, `기술 포인트 +${detail.gain}. 설비는 처음부터지만 칩값이 훨씬 비싸졌어요.`);
      save();
      break;
  }
}

function loadState() {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { raw = null; }
  return raw ? hydrate(raw) : createState();
}

function save() {
  state.lastSaved = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch { /* 저장 불가 환경이면 무시 */ }
}

function resetGame() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* 무시 */ }
  location.reload();
}

// ---------- 시작 ----------

mountUI(state, emit);

const offline = applyOffline(state);
if (offline && offline.earned > 0) {
  showModal('자리 비운 동안 라인이 돌았어요',
    `${duration(offline.seconds)} 동안 웨이퍼 ${offline.lots.toLocaleString('ko-KR')} Lot 생산 · ${won(offline.earned)} 입금`);
}
render(state);

let last = performance.now();
setInterval(() => {
  const now = performance.now();
  const dt = Math.min((now - last) / 1000, 1); // 탭 전환 등으로 몰린 시간은 오프라인 정산이 처리
  last = now;
  tick(state, dt, emit);
  render(state);
}, TICK_MS);

setInterval(save, SAVE_EVERY_MS);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) save();
  else {
    const off = applyOffline(state);
    if (off && off.earned > 0) showModal('다녀오셨어요?', `${duration(off.seconds)} 동안 ${won(off.earned)} 벌었어요`);
    last = performance.now();
  }
});
window.addEventListener('pagehide', save);

// 초기화: 한 번 누르면 확인 상태, 4초 안에 다시 누르면 초기화
const resetBtn = document.querySelector('#reset-btn');
resetBtn?.addEventListener('click', () => {
  if (resetBtn.dataset.confirm === 'true') return resetGame();
  resetBtn.dataset.confirm = 'true';
  resetBtn.textContent = '정말 초기화? 한 번 더 누르면 삭제';
  setTimeout(() => { delete resetBtn.dataset.confirm; resetBtn.textContent = '처음부터 다시'; }, 4000);
});

// 개발용: 콘솔에서 __fab.state 로 상태 확인
window.__fab = { state, save };
