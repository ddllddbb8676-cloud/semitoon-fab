// 시작점: 게임 루프, 저장/불러오기, 이벤트 중계 (담당: Claude)

import { createState, hydrate, tick, applyOffline } from './engine.js';
import { PROCESSES, PROCESS_INDEX } from './data.js';
import { mountUI, render, pushLot, toast, showModal, clearSelection } from './ui.js';
import { won, duration } from './format.js';

const SAVE_KEY = 'semitoon-fab-save-v2';
const SAVE_EVERY_MS = 10_000;

const state = loadState();
let lastFeedAt = 0;
const pname = type => PROCESSES[PROCESS_INDEX[type]]?.name ?? '';

// 엔진에서 일어난 일을 화면 알림 + document 이벤트로 내보냅니다.
// 디자인 효과(js/fx.js)는 document.addEventListener('fab:golden', ...) 처럼 듣기만 하면 됩니다.
function emit(type, detail = {}) {
  document.dispatchEvent(new CustomEvent('fab:' + type, { detail }));
  switch (type) {
    case 'lot': {
      const now = performance.now();
      if (detail.kind !== 'normal' || now - lastFeedAt > 700) { pushLot(detail); lastFeedAt = now; }
      if (detail.kind === 'golden') document.dispatchEvent(new CustomEvent('fab:golden', { detail }));
      if (detail.kind === 'scrap') document.dispatchEvent(new CustomEvent('fab:scrap', { detail }));
      break;
    }
    case 'toolDown': toast(`${pname(detail.type)} 장비 다운! 엔지니어 출동`, 'bad'); break;
    case 'toolFixed': toast('장비 살렸어요', 'good'); break;
    case 'milestone': toast(`Lv${detail.level} 달성 · 속도 2배!`, 'good'); break;
    case 'hire': toast(`${detail.name} 입사! 알아서 PM 돌아요`, 'good'); break;
    case 'expand': toast('클린룸 확장 완료', 'good'); break;
    case 'eventEnd':
      if (detail.result === 'solved') toast(detail.type === 'rush' ? '납기 성공! 보너스 입금' : '클린 완료!', 'good');
      if (detail.result === 'failed') toast('납기 실패… 다음엔 꼭', 'bad');
      break;
    case 'achievement': toast(`칭호 획득: ${detail.name}`, 'achievement'); break;
    case 'prestige':
      clearSelection();
      showModal(`${detail.node.name} 진입!`, `기술 포인트 +${detail.gain}. 팹은 처음부터지만 칩값이 3배예요.`);
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

// ---------- 시작 ----------

mountUI(state, emit);

const fresh = state.stats.lots === 0 && state.nodeIndex === 0;
const offline = applyOffline(state);
if (offline && offline.earned > 0) {
  showModal('자리 비운 동안 팹이 돌았어요',
    `${duration(offline.seconds)} 동안 ${offline.lots.toLocaleString('ko-KR')} Lot · ${won(offline.earned)} 입금`);
} else if (fresh) {
  showModal('세미툰 FAB에 오신 걸 환영해요',
    '장비가 여기저기 흩어져 있어서 FOUP이 먼 길을 돌고 있어요. 장비를 눌러 "옮기기"로 가까이 모아보세요. 장비 헬스가 떨어지면 PM을 시키고요!');
}

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.25); // 탭 전환으로 몰린 시간은 오프라인 정산이 처리
  last = now;
  tick(state, dt, emit);
  render(state);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

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
  if (resetBtn.dataset.confirm === 'true') {
    try { localStorage.removeItem(SAVE_KEY); } catch { /* 무시 */ }
    location.reload();
    return;
  }
  resetBtn.dataset.confirm = 'true';
  resetBtn.textContent = '정말 초기화? 한 번 더 누르면 삭제';
  setTimeout(() => { delete resetBtn.dataset.confirm; resetBtn.textContent = '처음부터 다시'; }, 4000);
});

// 개발용: 콘솔에서 __fab.state 로 상태 확인
window.__fab = { state, save };
