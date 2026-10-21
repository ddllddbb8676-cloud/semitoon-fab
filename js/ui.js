// 화면 렌더링과 조작 (담당: Claude)
// state를 읽어 DOM의 텍스트·data-속성·CSS 변수만 바꿉니다. 모양은 전부 CSS(GPT 담당)에서 합니다.
// 여기서 쓰는 id/class/data-속성 목록은 docs/UI_CONTRACT.md 에 있습니다. 바꾸면 그 문서도 같이 고쳐주세요.

import { PROCESSES, PROCESS_INDEX, GRID, STOCKER, ACHIEVEMENTS, ENGINEER, FOUP } from './data.js';
import * as E from './engine.js';
import { won, pct, duration } from './format.js';

const $ = sel => document.querySelector(sel);
const FEED_MAX = 4;

// 화면 전용 상태 (저장 안 함)
const ui = {
  selected: null,          // 선택한 장비 id
  mode: null,              // null | { kind: 'buy', type } | { kind: 'move', id }
  els: { tools: new Map(), foups: new Map(), engineers: new Map() },
};

export function mountUI(s, emit) {
  buildShop();
  buildAchievements();

  // 바닥 탭: 좌표 → 칸으로 바꿔서 처리
  $('#floor').addEventListener('click', e => {
    const r = $('#floor').getBoundingClientRect();
    const cell = r.width / GRID.cols;
    const x = Math.floor((e.clientX - r.left) / cell);
    const y = Math.floor((e.clientY - r.top) / cell);
    onCellTap(s, x, y, emit);
  });

  $('#mode-cancel').addEventListener('click', () => setMode(null));

  $('#panel-close').addEventListener('click', () => select(null));
  $('#panel-upgrade').addEventListener('click', () => ui.selected && E.upgradeTool(s, ui.selected, emit));
  $('#panel-pm').addEventListener('click', () => ui.selected && E.orderPm(s, ui.selected, emit));
  $('#panel-move').addEventListener('click', () => ui.selected && setMode({ kind: 'move', id: ui.selected }));

  $('#shop').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.id === 'buy-foup') E.buyFoup(s, emit);
    else if (b.id === 'buy-expand') E.expandRows(s, emit);
    else if (b.id === 'buy-engineer') E.hireEngineer(s, emit);
    else if (b.dataset.type) {
      if (s.money < E.buyToolCost(s, b.dataset.type)) return;
      select(null);
      setMode({ kind: 'buy', type: b.dataset.type });
      $('#floor').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });

  $('#event-action').addEventListener('click', () => E.tapEvent(s, emit));

  const pBtn = $('#prestige-btn');
  pBtn.addEventListener('click', () => {
    if (pBtn.dataset.confirm === 'true') { delete pBtn.dataset.confirm; select(null); E.prestige(s, emit); }
    else if (E.canPrestige(s)) {
      pBtn.dataset.confirm = 'true';
      setTimeout(() => { delete pBtn.dataset.confirm; }, 4000);
    }
  });

  $('#modal-close').addEventListener('click', () => { $('#modal').hidden = true; });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { setMode(null); select(null); } });
}

function onCellTap(s, x, y, emit) {
  if (x < 0 || y < 0 || x >= GRID.cols || y >= s.rows) return;
  if (ui.mode) {
    if (!E.cellFree(s, x, y)) { toast('빈 칸을 골라주세요', 'bad'); return; }
    if (ui.mode.kind === 'buy') {
      const t = E.buyTool(s, ui.mode.type, x, y, emit);
      if (t) { setMode(null); select(t.id); }
      else toast('돈이 모자라요', 'bad');
    } else if (ui.mode.kind === 'move') {
      if (E.moveTool(s, ui.mode.id, x, y, emit)) { const id = ui.mode.id; setMode(null); select(id); }
    }
    return;
  }
  const t = E.toolAt(s, x, y);
  select(t ? (ui.selected === t.id ? null : t.id) : null);
}

function select(id) {
  ui.selected = id;
  $('#tool-panel').hidden = !id;
}

function setMode(mode) {
  ui.mode = mode;
  const bar = $('#mode-bar');
  bar.hidden = !mode;
  $('#floor').dataset.mode = mode?.kind ?? '';
  if (mode) {
    const name = mode.kind === 'buy' ? PROCESSES[PROCESS_INDEX[mode.type]].name : '';
    $('#mode-text').textContent = mode.kind === 'buy' ? `${name} 장비를 놓을 빈 칸을 누르세요` : '옮길 빈 칸을 누르세요';
  }
}

// ---------- 최초 1회 생성 ----------

function buildShop() {
  const list = $('#shop-tools');
  list.innerHTML = '';
  for (const p of PROCESSES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'shop-tool';
    b.dataset.type = p.id;
    b.innerHTML = `<span class="shop-tool__icon" aria-hidden="true">${p.short}</span><span class="shop-tool__name">${p.name}</span><span class="shop-tool__cost"></span>`;
    list.appendChild(b);
  }
}

function buildAchievements() {
  const list = $('#achievement-list');
  list.innerHTML = '';
  for (const a of ACHIEVEMENTS) {
    const li = document.createElement('li');
    li.className = 'achievement';
    li.dataset.id = a.id;
    li.innerHTML = `<span class="achievement__name">${a.name}</span><span class="achievement__desc">${a.desc}</span>`;
    list.appendChild(li);
  }
}

// ---------- 매 프레임 갱신 ----------

export function render(s) {
  const d = E.derive(s);

  setText('#node-name', d.node.name);
  setText('#money', won(s.money));
  setText('#rate', won(d.incomePerSec) + '/초');
  setText('#yield-avg', pct(s.yieldAvg));
  setText('#lots-rate', (d.lotsPerSec * 60).toFixed(1) + ' Lot/분');
  setText('#lot-value', won(d.lotValue));
  setText('#bottleneck', PROCESSES[PROCESS_INDEX[d.bottleneck]].name);
  document.body.dataset.event = s.event?.type ?? '';

  renderFloor(s, d);
  renderPanel(s, d);
  renderShop(s);
  renderEngineerList(s);
  renderEvent(s);
  renderPrestige(s, d);
  renderAchievements(s);
}

function renderFloor(s, d) {
  const floor = $('#floor');
  floor.style.setProperty('--cols', GRID.cols);
  floor.style.setProperty('--rows', s.rows);
  floor.style.setProperty('--cell', (floor.clientWidth / GRID.cols).toFixed(2) + 'px');

  const st = $('#stocker');
  st.style.setProperty('--x', STOCKER.x);
  st.style.setProperty('--y', STOCKER.y);

  // 장비
  sync(ui.els.tools, s.tools, t => {
    const el = document.createElement('div');
    el.className = 'tool';
    el.dataset.type = t.type;
    el.innerHTML = `
      <span class="tool__icon" aria-hidden="true">${PROCESSES[PROCESS_INDEX[t.type]].short}</span>
      <span class="tool__lv"></span>
      <span class="tool__queue"></span>
      <span class="tool__progress"><span></span></span>
      <span class="tool__health"><span></span></span>`;
    return el;
  }, (el, t) => {
    el.style.setProperty('--x', t.x);
    el.style.setProperty('--y', t.y);
    el.style.setProperty('--progress', t.foup ? Math.min(1, t.progress).toFixed(3) : '0');
    el.style.setProperty('--health', (t.health / 100).toFixed(3));
    const state = t.down ? 'down' : t.health < 30 ? 'warn' : t.foup ? 'busy' : 'idle';
    setData(el, 'state', state);
    setData(el, 'bottleneck', String(t.type === d.bottleneck));
    setData(el, 'selected', String(ui.selected === t.id));
    setData(el, 'job', jobFor(s, t.id));
    setText(el.querySelector('.tool__lv'), `Lv${t.level}`);
    setText(el.querySelector('.tool__queue'), t.queue.length ? String(t.queue.length) : '');
  });

  // FOUP (장비 안에서 처리·대기 중이면 숨김. 장비의 대기열 숫자로 보임)
  sync(ui.els.foups, s.foups, () => {
    const el = document.createElement('div');
    el.className = 'foup';
    return el;
  }, (el, f) => {
    el.style.setProperty('--x', f.x.toFixed(3));
    el.style.setProperty('--y', f.y.toFixed(3));
    setData(el, 'phase', f.phase);
    setData(el, 'step', String(f.step));
    el.hidden = f.phase !== 'move';
  });

  // 엔지니어
  sync(ui.els.engineers, s.engineers, e => {
    const el = document.createElement('div');
    el.className = 'engineer';
    el.innerHTML = `<span class="engineer__body" aria-hidden="true"></span><span class="engineer__name">${e.name}</span>`;
    return el;
  }, (el, e) => {
    el.style.setProperty('--x', e.x.toFixed(3));
    el.style.setProperty('--y', e.y.toFixed(3));
    setData(el, 'phase', e.phase);
    setData(el, 'job', e.job?.type ?? '');
    setData(el, 'auto', String(e.auto));
  });

  // 배치 모드: 놓을 수 있는 칸 표시
  const hints = $('#floor-hints');
  if (ui.mode) {
    const want = [];
    for (let y = 0; y < s.rows; y++) for (let x = 0; x < GRID.cols; x++) if (E.cellFree(s, x, y)) want.push(`${x},${y}`);
    const key = want.join(';');
    if (hints.dataset.key !== key) {
      hints.dataset.key = key;
      hints.innerHTML = want.map(k => { const [x, y] = k.split(','); return `<span class="cell-hint" style="--x:${x};--y:${y}"></span>`; }).join('');
    }
  } else if (hints.dataset.key) { hints.dataset.key = ''; hints.innerHTML = ''; }
}

function jobFor(s, toolId) {
  const e = s.engineers.find(x => x.job?.toolId === toolId);
  if (e) return e.phase === 'work' ? 'working' : 'coming';
  return s.jobs.some(j => j.toolId === toolId) ? 'queued' : '';
}

function renderPanel(s, d) {
  if (!ui.selected) return;
  const t = E.toolById(s, ui.selected);
  if (!t) { select(null); return; }
  const p = PROCESSES[PROCESS_INDEX[t.type]];
  const panel = $('#tool-panel');
  setData(panel, 'type', t.type);
  setData(panel, 'state', t.down ? 'down' : t.health < 30 ? 'warn' : 'ok');
  setText('#panel-name', `${p.name} · Lv${t.level}`);
  setText('#panel-equip', p.equip);
  panel.style.setProperty('--health', (t.health / 100).toFixed(3));
  setText('#panel-health', t.down ? '고장' : `${Math.round(t.health)}%`);
  const sp = E.toolSpeed(s, t);
  setText('#panel-speed', sp ? `${(sp * 60).toFixed(1)} Lot/분` : '정지');
  setText('#panel-queue', `${t.queue.length + (t.foup ? 1 : 0)}개`);
  const bay = E.baySize(s, t);
  setText('#panel-bay', bay ? `+${Math.round(bay * 15)}%` : '없음');
  const ms = E.nextMilestone(t.level);
  setText('#panel-hint', t.type === d.bottleneck
    ? '이 공정이 라인 병목이에요. 증설하거나 같은 장비를 옆에 붙여 놓으세요.'
    : ms ? `Lv${ms}에 속도 2배` : '');

  const uc = E.upgradeCost(s, t);
  const up = $('#panel-upgrade');
  setText(up.querySelector('.btn__cost'), won(uc));
  setData(up, 'affordable', String(s.money >= uc));

  const job = jobFor(s, t.id);
  const pm = $('#panel-pm');
  pm.disabled = !!job || (!t.down && t.health >= 99.5);
  setText(pm.querySelector('.btn__label'), t.down ? '수리 시키기' : 'PM 시키기');
  setText(pm.querySelector('.btn__cost'),
    job === 'working' ? '작업 중' : job === 'coming' ? '가는 중' : job === 'queued' ? '대기 중' : t.down ? '' : `헬스 ${Math.round(t.health)}%`);
}

function renderShop(s) {
  const fc = E.foupCost(s), ec = E.expandCost(s), hc = E.hireCost(s);
  shopBtn('#buy-foup', fc, s.foups.length >= FOUP.max, `${s.foups.length}개 보유`);
  shopBtn('#buy-expand', ec, s.rows >= GRID.maxRows, `${GRID.cols}×${s.rows}`);
  shopBtn('#buy-engineer', hc, s.engineers.length >= ENGINEER.max, `${s.engineers.length}명`);
  for (const b of document.querySelectorAll('.shop-tool')) {
    const c = E.buyToolCost(s, b.dataset.type);
    setText(b.querySelector('.shop-tool__cost'), won(c));
    setData(b, 'affordable', String(s.money >= c));
    setData(b, 'active', String(ui.mode?.kind === 'buy' && ui.mode.type === b.dataset.type));
  }
  function shopBtn(sel, cost, maxed, note) {
    const b = $(sel);
    b.disabled = maxed;
    setText(b.querySelector('.btn__cost'), maxed ? '최대' : won(cost));
    setText(b.querySelector('.btn__note'), note);
    setData(b, 'affordable', String(!maxed && s.money >= cost));
  }
}

function renderEngineerList(s) {
  const list = $('#engineer-list');
  if (list.children.length !== s.engineers.length) {
    list.innerHTML = s.engineers.map(e => `<li class="engineer-row" data-id="${e.id}"><span class="engineer-row__name">${e.name}</span><span class="engineer-row__status"></span></li>`).join('');
  }
  s.engineers.forEach((e, i) => {
    const li = list.children[i];
    const t = e.job ? E.toolById(s, e.job.toolId) : null;
    const tn = t ? PROCESSES[PROCESS_INDEX[t.type]].name : '';
    const what = e.job?.type === 'fix' ? '수리' : 'PM';
    const text = e.phase === 'walk' ? `${tn} ${what}하러 가는 중`
      : e.phase === 'work' ? `${tn} ${what} 중`
      : e.auto ? '순찰 중 (헬스 낮은 장비 자동 PM)' : '대기 중 · 장비를 눌러 일을 시키세요';
    setData(li, 'phase', e.phase);
    setText(li.querySelector('.engineer-row__status'), text);
  });
  const waiting = s.jobs.length;
  setText('#job-count', waiting ? `밀린 일 ${waiting}건` : '');
}

function renderEvent(s) {
  const box = $('#event-banner');
  const ev = s.event;
  box.hidden = !ev;
  if (!ev) return;
  setData(box, 'type', ev.type);
  const copy = {
    particle: { title: '파티클 폭주', desc: '수율이 떨어지고 있어요. 클린 작업!', btn: `클린 (${ev.tapsLeft})` },
    rush: { title: '고객사 긴급 오더', desc: `${ev.progress ?? 0} / ${ev.target} Lot · 보상 ${won(ev.reward)}`, btn: '' },
  }[ev.type];
  setText('#event-title', copy.title);
  setText('#event-desc', copy.desc);
  setText('#event-timer', duration(Math.max(0, ev.timeLeft)));
  const btn = $('#event-action');
  btn.hidden = !copy.btn;
  setText(btn, copy.btn);
  box.style.setProperty('--time-left', String(Math.max(0, ev.timeLeft / ev.duration)));
}

function renderPrestige(s, d) {
  const box = $('#prestige');
  box.style.setProperty('--progress', Math.min(1, s.runEarnings / d.prestigeTarget).toFixed(3));
  setData(box, 'ready', String(d.canPrestige));
  setText('#tech-points', String(s.techPoints));
  const btn = $('#prestige-btn');
  if (!d.nextNode) { setText('#prestige-info', '최종 노드 도달!'); btn.hidden = true; return; }
  setText('#prestige-info', `${d.nextNode.name}까지 ${won(s.runEarnings)} / ${won(d.prestigeTarget)}`);
  btn.disabled = !d.canPrestige;
  setText(btn, btn.dataset.confirm === 'true'
    ? `정말 전환? 팹이 초기화되고 기술포인트 +${d.prestigeGain}`
    : d.canPrestige ? `${d.nextNode.short}로 전환 (+${d.prestigeGain} 기술포인트)` : '노드 전환');
}

function renderAchievements(s) {
  for (const a of ACHIEVEMENTS) {
    setData(document.querySelector(`.achievement[data-id="${a.id}"]`), 'unlocked', String(s.achievements.includes(a.id)));
  }
  setText('#achievement-count', `${s.achievements.length} / ${ACHIEVEMENTS.length}`);
}

// ---------- 일회성 알림 ----------

export function pushLot(lot) {
  const feed = $('#lot-feed');
  const li = document.createElement('li');
  li.className = 'lot';
  li.dataset.kind = lot.kind;
  const tag = lot.kind === 'golden' ? '골든 Lot!' : lot.kind === 'scrap' ? '스크랩' : 'Lot 아웃';
  li.innerHTML = `<span class="lot__tag">${tag}</span><span class="lot__yield">${pct(lot.yield)}</span><span class="lot__value">+${won(lot.value)}</span>`;
  feed.prepend(li);
  while (feed.children.length > FEED_MAX) feed.lastChild.remove();
}

export function toast(text, kind = 'info') {
  const el = document.createElement('div');
  el.className = 'toast';
  el.dataset.kind = kind;
  el.textContent = text;
  $('#toast-stack').appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

export function showModal(title, body) {
  setText('#modal-title', title);
  setText('#modal-body', body);
  $('#modal').hidden = false;
}

export function clearSelection() { select(null); setMode(null); }

// ---------- 헬퍼 ----------

// 엔티티 목록과 DOM 요소를 id 기준으로 맞춤
function sync(map, items, create, update) {
  const layer = $('#floor-entities');
  const alive = new Set();
  for (const it of items) {
    alive.add(it.id);
    let el = map.get(it.id);
    if (!el) { el = create(it); el.dataset.id = it.id; layer.appendChild(el); map.set(it.id, el); }
    update(el, it);
  }
  for (const [id, el] of map) if (!alive.has(id)) { el.remove(); map.delete(id); }
}

function setText(target, text) {
  const el = typeof target === 'string' ? $(target) : target;
  if (el && el.textContent !== text) el.textContent = text;
}
function setData(el, key, val) {
  if (el && el.dataset[key] !== val) el.dataset[key] = val;
}
