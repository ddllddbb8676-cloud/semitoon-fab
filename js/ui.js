// 화면 렌더링 (담당: Claude)
// state를 읽어 DOM의 텍스트·data-속성만 바꿉니다. 모양·색·애니메이션은 전부 CSS(GPT 담당)에서 합니다.
// 여기서 쓰는 id/class/data-속성 목록은 docs/UI_CONTRACT.md 에 있습니다. 바꾸면 그 문서도 같이 고쳐주세요.

import { STATIONS, ACHIEVEMENTS } from './data.js';
import {
  derive, upgradeCost, unlockCost, nextMilestone, stationRate,
  tapInput, unlockStation, upgradeStation, tapEvent, prestige,
} from './engine.js';
import { won, pct, lotsPerSec, duration } from './format.js';

const $ = sel => document.querySelector(sel);
const FEED_MAX = 6;

export function mountUI(state, emit) {
  buildStations();
  buildAchievements();

  $('#tap-btn').addEventListener('click', () => tapInput(state, emit));

  $('#station-list').addEventListener('click', e => {
    const btn = e.target.closest('.station__action');
    if (!btn) return;
    const li = btn.closest('.station');
    const id = li.dataset.id;
    const st = li.dataset.state;
    if (st === 'down') tapEvent(state, emit);
    else if (st === 'locked') unlockStation(state, id, emit);
    else upgradeStation(state, id, emit);
  });

  $('#event-action').addEventListener('click', () => tapEvent(state, emit));

  const pBtn = $('#prestige-btn');
  pBtn.addEventListener('click', () => {
    if (pBtn.dataset.confirm === 'true') {
      delete pBtn.dataset.confirm;
      prestige(state, emit);
    } else if (derive(state).canPrestige) {
      pBtn.dataset.confirm = 'true';
      setTimeout(() => { delete pBtn.dataset.confirm; }, 4000);
    }
  });

  $('#modal-close').addEventListener('click', () => { $('#modal').hidden = true; });
}

// ---------- 최초 1회 생성 ----------

function buildStations() {
  const list = $('#station-list');
  list.innerHTML = '';
  STATIONS.forEach((st, i) => {
    const li = document.createElement('li');
    li.className = 'station';
    li.dataset.id = st.id;
    li.dataset.index = String(i + 1);
    li.innerHTML = `
      <div class="station__icon" aria-hidden="true">${i + 1}</div>
      <div class="station__body">
        <div class="station__head">
          <span class="station__name">${st.name}</span>
          <span class="station__level"></span>
        </div>
        <div class="station__equip">${st.equip}</div>
        <div class="station__rate"></div>
        <div class="station__bar"><span></span></div>
      </div>
      <button class="station__action" type="button">
        <span class="station__action-label"></span>
        <span class="station__cost"></span>
      </button>`;
    list.appendChild(li);
  });
}

function buildAchievements() {
  const list = $('#achievement-list');
  list.innerHTML = '';
  ACHIEVEMENTS.forEach(a => {
    const li = document.createElement('li');
    li.className = 'achievement';
    li.dataset.id = a.id;
    li.innerHTML = `<span class="achievement__name">${a.name}</span><span class="achievement__desc">${a.desc}</span>`;
    list.appendChild(li);
  });
}

// ---------- 매 프레임 갱신 ----------

export function render(state) {
  const d = derive(state);

  setText('#node-name', d.node.name);
  setText('#money', won(state.money));
  setText('#rate', won(d.incomePerSec) + '/초');
  setText('#yield-avg', pct(state.yieldAvg));
  setText('#throughput', lotsPerSec(d.throughput));
  setText('#lot-value', won(d.lotValue));
  document.body.dataset.fullLine = String(d.fullLine);
  document.body.dataset.event = state.event?.type ?? '';

  // 컨베이어 속도: Lot 하나가 나오는 간격(초). CSS에서 var(--lot-interval)로 씁니다.
  const line = $('#conveyor');
  // 멈췄을 때는 마지막 속도를 그대로 두고 data-running=false로 애니메이션만 멈춥니다
  if (d.throughput > 0) line.style.setProperty('--lot-interval', Math.max(0.15, 1 / d.throughput).toFixed(2) + 's');
  line.dataset.running = String(d.throughput > 0);

  renderStations(state, d);
  renderEvent(state);
  renderPrestige(state, d);
  renderAchievements(state);
}

function renderStations(state, d) {
  const nextLocked = STATIONS.findIndex(st => !state.stations[st.id].unlocked);
  STATIONS.forEach((st, i) => {
    const li = document.querySelector(`.station[data-id="${st.id}"]`);
    const s = state.stations[st.id];
    const isDown = state.event?.type === 'down' && state.event.stationId === st.id;

    let st8, label, cost, costNum;
    if (!s.unlocked) {
      st8 = i === nextLocked ? 'locked' : 'hidden';
      label = '오픈';
      costNum = unlockCost(state, i);
      cost = won(costNum);
    } else if (isDown) {
      st8 = 'down';
      label = '살리기!';
      cost = `${state.event.tapsLeft}번 더`;
      costNum = 0;
    } else {
      st8 = d.bottleneckId === st.id && d.unlockedCount > 1 ? 'bottleneck' : 'running';
      label = '증설';
      costNum = upgradeCost(state, i, s.level);
      cost = won(costNum);
    }

    setData(li, 'state', st8);
    setData(li, 'affordable', String(state.money >= costNum));
    setText(li.querySelector('.station__level'), s.unlocked ? `Lv.${s.level}` : '');
    const ms = nextMilestone(s.level);
    setText(li.querySelector('.station__rate'),
      s.unlocked ? `${lotsPerSec(isDown ? 0 : stationRate(s.level))}${ms ? ` · Lv.${ms}에 속도 2배` : ''}` : `Lot당 +${won(st.lotValue)}`);
    setText(li.querySelector('.station__action-label'), label);
    setText(li.querySelector('.station__cost'), cost);
    const rate = d.rates[st.id];
    li.style.setProperty('--cycle', rate ? Math.max(0.15, 1 / rate).toFixed(2) + 's' : '0s');
  });
}

function renderEvent(state) {
  const box = $('#event-banner');
  const ev = state.event;
  box.hidden = !ev;
  if (!ev) return;
  setData(box, 'type', ev.type);
  const st = ev.stationId ? STATIONS.find(s => s.id === ev.stationId) : null;
  const copy = {
    down:     { title: `${st?.name} 장비 다운!`, desc: '라인이 멈췄어요. 빨리 살려주세요', btn: `리셋 (${ev.tapsLeft})` },
    particle: { title: '파티클 폭주', desc: '수율이 떨어지고 있어요. 클린 작업!', btn: `클린 (${ev.tapsLeft})` },
    rush:     { title: '고객사 긴급 오더', desc: `${ev.progress ?? 0} / ${ev.target} Lot · 보상 ${won(ev.reward)}`, btn: '' },
  }[ev.type];
  setText('#event-title', copy.title);
  setText('#event-desc', copy.desc);
  setText('#event-timer', duration(Math.max(0, ev.timeLeft)));
  const btn = $('#event-action');
  btn.hidden = !copy.btn;
  setText(btn, copy.btn);
  box.style.setProperty('--time-left', String(Math.max(0, ev.timeLeft / ev.duration)));
}

function renderPrestige(state, d) {
  const box = $('#prestige');
  const ratio = Math.min(1, state.runEarnings / d.prestigeTarget);
  box.style.setProperty('--progress', ratio.toFixed(3));
  setData(box, 'ready', String(d.canPrestige));
  setText('#tech-points', `${state.techPoints}`);
  if (!d.nextNode) {
    setText('#prestige-info', '최종 노드 도달! 무한 생산 모드');
    $('#prestige-btn').hidden = true;
    return;
  }
  const needLine = !d.fullLine ? ' · 8공정을 모두 열어야 해요' : '';
  setText('#prestige-info',
    `${d.nextNode.name}까지 ${won(state.runEarnings)} / ${won(d.prestigeTarget)}${needLine}`);
  const btn = $('#prestige-btn');
  btn.disabled = !d.canPrestige;
  setText(btn, btn.dataset.confirm === 'true'
    ? `정말 전환? 돈·설비 초기화, 기술포인트 +${d.prestigeGain}`
    : d.canPrestige ? `${d.nextNode.short}로 전환 (+${d.prestigeGain} 기술포인트)` : '노드 전환');
}

function renderAchievements(state) {
  for (const a of ACHIEVEMENTS) {
    const li = document.querySelector(`.achievement[data-id="${a.id}"]`);
    setData(li, 'unlocked', String(state.achievements.includes(a.id)));
  }
  setText('#achievement-count', `${state.achievements.length} / ${ACHIEVEMENTS.length}`);
}

// ---------- 일회성 알림 ----------

export function pushLot(lot) {
  const feed = $('#lot-feed');
  const li = document.createElement('li');
  li.className = 'lot';
  li.dataset.kind = lot.kind;
  const tag = lot.kind === 'golden' ? '골든 Lot!' : lot.kind === 'scrap' ? '스크랩' : '수율';
  li.innerHTML = `<span class="lot__tag">${tag}</span><span class="lot__yield">${pct(lot.yield)}</span><span class="lot__value">+${won(lot.value)}</span>`;
  feed.prepend(li);
  while (feed.children.length > FEED_MAX) feed.lastChild.remove();
}

export function toast(text, kind = 'info') {
  const stack = $('#toast-stack');
  const el = document.createElement('div');
  el.className = 'toast';
  el.dataset.kind = kind;
  el.textContent = text;
  stack.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

export function showModal(title, body) {
  setText('#modal-title', title);
  setText('#modal-body', body);
  $('#modal').hidden = false;
}

// ---------- 헬퍼: 바뀐 것만 건드려 깜빡임 방지 ----------

function setText(target, text) {
  const el = typeof target === 'string' ? $(target) : target;
  if (el && el.textContent !== text) el.textContent = text;
}
function setData(el, key, val) {
  if (el && el.dataset[key] !== val) el.dataset[key] = val;
}

