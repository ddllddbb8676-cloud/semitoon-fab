// 버스 잼 프로토타입 — 화면과 조작. 규칙 함수(SIZES, blockerOf 등)는 core.js에서 옵니다.

const $ = s => document.querySelector(s);
const stage = $('#stage');
const SAVE_KEY = 'busjam-proto-v1';
const PRICE = { slot: 120, revive: 150, booster: 100 };

// ---------- 저장 ----------
const save = loadSave();
function loadSave() {
  const base = { unlocked: 1, cleared: [], coins: 200, hearts: 5, boosters: { sort: 2, shuffle: 4, vip: 2 } };
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (raw) return { ...base, ...raw, boosters: { ...base.boosters, ...(raw.boosters || {}) } };
  } catch { /* 저장 불가 환경 */ }
  return base;
}
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* 무시 */ } }

// ---------- 판 상태 ----------
let run = null;

function startLevel(n) {
  if (save.hearts <= 0) { heartsSheet(n); return; }
  const L = LEVELS[n - 1];
  clearBoard();
  run = {
    L, n,
    vehicles: L.vehicles.map(v => ({ ...v, where: 'lot', revealed: !v.mystery, el: null })),
    slots: new Array(8).fill(null),
    open: [true, true, true, true, true, false, false, false],
    queue: L.queue.slice(),
    qi: 0, seq: 0, over: false, moved: false, vipMode: false,
    pax: new Map(),
  };
  $('#lv-title').textContent = `레벨 ${n}`;
  $('#tag').textContent = L.hard ? 'HARD' : '';
  renderSlots();
  for (const v of run.vehicles) makeVehicle(v);
  layoutAll(true);
  updateHud();
  hints();
}

function clearBoard() {
  stage.querySelectorAll('.veh, .pax, .tip').forEach(e => e.remove());
}

const lotVehicles = () => run.vehicles.filter(v => v.where === 'lot');

// ---------- 그리기 ----------
const ARROW = '<svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13M13 6l6 6-6 6"/></svg>';

function setColor(el, c) { el.style.setProperty('--col', `var(--c${c})`); el.style.setProperty('--dark', `var(--d${c})`); }

function makeVehicle(v) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'veh';
  el.dataset.dir = v.dir;
  el.dataset.size = v.size;
  el.dataset.vid = v.id;
  el.setAttribute('aria-label', `${v.size} 차`);
  el.innerHTML = ARROW + '<span class="seats"></span>';
  if (v.mystery) el.classList.add('mystery'); else setColor(el, v.color);
  el.addEventListener('click', () => tapVehicle(v));
  stage.appendChild(el);
  v.el = el;
}

function rel(el) {
  const r = el.getBoundingClientRect(), s = stage.getBoundingClientRect();
  return { x: r.left - s.left, y: r.top - s.top, w: r.width, h: r.height };
}

function cellBox(v) {
  const g = rel($('#grid'));
  const cw = g.w / run.L.cols, ch = g.h / run.L.rows;
  const len = SIZES[v.size].len;
  const horiz = v.dir === 'L' || v.dir === 'R';
  return {
    x: g.x + v.x * cw + 3, y: g.y + v.y * ch + 3,
    w: (horiz ? len : 1) * cw - 6, h: (horiz ? 1 : len) * ch - 6, cw, ch,
  };
}

function place(el, b) {
  el.style.width = b.w + 'px';
  el.style.height = b.h + 'px';
  el.style.transform = `translate(${b.x}px, ${b.y}px)`;
}

function slotBox(i) {
  const b = rel(document.querySelector(`.slot[data-slot="${i}"]`));
  return { x: b.x + 2, y: b.y + 2, w: b.w - 4, h: b.h - 4 };
}

function layoutAll(instant) {
  if (!run) return;
  const els = [];
  for (const v of run.vehicles) {
    if (!v.el) continue;
    els.push(v.el);
    if (v.where === 'lot') place(v.el, cellBox(v));
    else if (v.where === 'slot' || v.where === 'moving') { const i = run.slots.findIndex(s => s && s.vid === v.id); if (i >= 0) place(v.el, slotBox(i)); }
  }
  layoutPax(instant);
  if (instant) {
    els.forEach(e => { e.style.transition = 'none'; });
    stage.offsetHeight; // 강제 리플로우
    els.forEach(e => { e.style.transition = ''; });
  }
}

// 승객: 앞사람이 왼쪽 아래, 지그재그로 뒤로 줄 섬
function paxGeom() {
  const q = rel($('#queue'));
  const step = 20, pad = 12;
  const cols = Math.max(4, Math.floor((q.w - pad * 2 + 4) / step));
  const rows = Math.max(2, Math.floor((q.h - pad * 2 + 4) / step));
  return { q, step, pad, cols, rows, visible: cols * rows };
}
function paxPos(k, g) {
  const row = Math.floor(k / g.cols), col = k % g.cols;
  const cx = row % 2 === 0 ? col : g.cols - 1 - col;
  return { x: g.q.x + g.pad + cx * g.step, y: g.q.y + g.q.h - g.pad - 16 - row * g.step };
}
function layoutPax(instant) {
  const g = paxGeom();
  const end = Math.min(run.queue.length, run.qi + g.visible);
  for (let i = run.qi; i < end; i++) {
    let el = run.pax.get(i);
    const p = paxPos(i - run.qi, g);
    if (!el) {
      el = document.createElement('span');
      el.className = 'pax';
      stage.appendChild(el);
      run.pax.set(i, el);
      el.style.transition = 'none';
      el.style.transform = `translate(${p.x}px, ${p.y - 10}px)`;
      el.offsetHeight;
      el.style.transition = '';
    }
    setColor(el, run.queue[i]);
    el.style.transform = `translate(${p.x}px, ${p.y}px)`;
    if (instant) { el.style.transition = 'none'; el.offsetHeight; el.style.transition = ''; }
  }
  const left = run.queue.length - end;
  $('#pax-left').textContent = left > 0 ? `+${left}명 대기` : '';
}

function renderSlots() {
  document.querySelectorAll('.slot').forEach((el, i) => {
    if (i < 5) return;
    el.classList.toggle('locked', !run.open[i]);
    el.textContent = run.open[i] ? '' : '+';
    el.disabled = run.open[i];
  });
}

function updateHud() {
  $('#hearts').textContent = save.hearts;
  $('#coins').textContent = save.coins;
  for (const k of ['sort', 'shuffle', 'vip']) {
    $('#n-' + k).textContent = save.boosters[k] > 0 ? save.boosters[k] : '+';
    $('#b-' + k).dataset.empty = String(save.boosters[k] <= 0);
  }
  $('#b-vip').classList.toggle('active', !!run?.vipMode);
}

// ---------- 차 탭 ----------
function tapVehicle(v) {
  if (!run || run.over || v.where !== 'lot') return;
  clearHint();
  if (run.vipMode) { sendToVip(v); return; }

  const lot = lotVehicles();
  const blocker = blockerOf(v, lot, run.L.cols, run.L.rows);
  if (blocker !== null) {
    bump(v);
    const b = run.vehicles.find(o => o.id === blocker);
    retrigger(b.el, 'blocker');
    return;
  }
  const i = freeSlot();
  if (i === -1) { bump(v); toast('주차칸이 꽉 찼어요'); return; }
  buzz();
  run.moved = true;
  reveal(v);
  run.slots[i] = { vid: v.id, color: v.color, cap: SIZES[v.size].cap, filled: 0, ready: false, seq: ++run.seq };
  v.where = 'moving';

  // 1단계: 머리 방향으로 쭉 빠짐
  const b = cellBox(v);
  const { dx, dy } = DIRS[v.dir];
  const [hx, hy] = headOf(v);
  const toEdge = dx > 0 ? run.L.cols - 1 - hx : dx < 0 ? hx : dy > 0 ? run.L.rows - 1 - hy : hy;
  const dist = (toEdge + SIZES[v.size].len + 0.4) * (dx ? b.cw : b.ch);
  v.el.classList.add('flying');
  v.el.style.transform = `translate(${b.x + dx * dist}px, ${b.y + dy * dist}px)`;
  // 2단계: 주차칸으로
  setTimeout(() => {
    v.el.classList.add('parked');
    place(v.el, slotBox(i));
    setTimeout(() => { arrive(v, i); }, 300);
  }, 260);
}

function arrive(v, i) {
  v.where = 'slot';
  v.el.classList.remove('flying');
  if (run.slots[i]) run.slots[i].ready = true;
  seatLabel(v, run.slots[i]);
}

function freeSlot() {
  for (let i = 1; i < 8; i++) if (run.open[i] && !run.slots[i]) return i;
  return -1;
}

function reveal(v) {
  if (v.revealed) return;
  v.revealed = true;
  v.el.classList.remove('mystery');
  setColor(v.el, v.color);
}

function bump(v) {
  const { dx, dy } = DIRS[v.dir];
  v.el.style.setProperty('--bx', dx * 6 + 'px');
  v.el.style.setProperty('--by', dy * 6 + 'px');
  retrigger(v.el, 'bump');
}
function retrigger(el, cls) { el.classList.remove(cls); el.offsetWidth; el.classList.add(cls); setTimeout(() => el.classList.remove(cls), 600); }
function buzz() { try { navigator.vibrate?.(8); } catch { /* 무시 */ } }

function seatLabel(v, s) { if (s) v.el.querySelector('.seats').textContent = `${s.filled}/${s.cap}`; }

// ---------- 탑승 루프 ----------
setInterval(step, 85);

function step() {
  if (!run || run.over) return;
  if (run.qi < run.queue.length) {
    const c = run.queue[run.qi];
    const s = run.slots.filter(s => s && s.ready && !s.leaving && s.color === c && s.filled < s.cap).sort((a, b) => a.seq - b.seq)[0];
    if (s) board(s);
  }
  checkEnd();
}

function board(s) {
  const i = run.slots.indexOf(s);
  const v = run.vehicles.find(o => o.id === s.vid);
  const el = run.pax.get(run.qi);
  run.pax.delete(run.qi);
  run.qi++;
  s.filled++;
  seatLabel(v, s);
  if (el) {
    const b = slotBox(i);
    el.classList.add('board');
    el.style.transform = `translate(${b.x + b.w / 2 - 8}px, ${b.y + b.h / 2 - 8}px)`;
    setTimeout(() => el.remove(), 230);
  }
  layoutPax(false);
  if (s.filled === s.cap) {
    s.leaving = true;
    retrigger(v.el, 'full');
    setTimeout(() => {
      v.el.style.transform += ' translateY(-60px)';
      v.el.classList.add('depart');
      setTimeout(() => { v.el.remove(); v.el = null; v.where = 'gone'; }, 320);
      run.slots[i] = null;
    }, 260);
  }
}

function checkEnd() {
  if (run.qi >= run.queue.length) {
    if (run.slots.every(s => !s)) win();
    return;
  }
  // 움직이는 중이거나 떠나는 중이면 아직 판정 안 함
  if (run.slots.some(s => s && (!s.ready || s.leaving))) return;
  if (freeSlot() !== -1) return;
  const c = run.queue[run.qi];
  if (run.slots.some(s => s && s.color === c && s.filled < s.cap)) return;
  if (run.vipMode) return;
  lose();
}

// ---------- 부스터 ----------
$('#b-sort').addEventListener('click', () => useBooster('sort'));
$('#b-shuffle').addEventListener('click', () => useBooster('shuffle'));
$('#b-vip').addEventListener('click', () => useBooster('vip'));
$('#b-shop').addEventListener('click', shopSheet);

function useBooster(k) {
  if (!run || run.over) return;
  if (save.boosters[k] <= 0) { shopSheet(); return; }
  if (k === 'vip') {
    if (run.vipMode) { setVip(false); return; }
    if (run.slots[0]) { toast('VIP 칸이 이미 차 있어요'); return; }
    setVip(true);
    return;
  }
  if (k === 'sort') {
    // 지금 주차칸에 있는 색 승객을 앞으로 (순서는 유지)
    const inSlot = new Set(run.slots.filter(s => s && !s.leaving).map(s => s.color));
    if (!inSlot.size) { toast('주차칸에 차가 있어야 써요'); return; }
    const rest = run.queue.slice(run.qi);
    const a = rest.filter(c => inSlot.has(c)), b = rest.filter(c => !inSlot.has(c));
    run.queue.splice(run.qi, rest.length, ...a, ...b);
    layoutPax(false);
    toast('승객 줄을 정리했어요');
  }
  if (k === 'shuffle') {
    const lot = lotVehicles();
    if (lot.length < 2) { toast('섞을 차가 부족해요'); return; }
    for (const size of Object.keys(SIZES)) {
      const g = lot.filter(v => v.size === size);
      const cols = g.map(v => v.color);
      for (let i = cols.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cols[i], cols[j]] = [cols[j], cols[i]]; }
      g.forEach((v, i) => { v.color = cols[i]; if (v.revealed) setColor(v.el, v.color); retrigger(v.el, 'blocker'); });
    }
    toast('같은 크기끼리 색을 섞었어요');
  }
  save.boosters[k]--;
  persist(); updateHud();
}

function setVip(on) {
  run.vipMode = on;
  lotVehicles().forEach(v => v.el.classList.toggle('pickable', on));
  stage.querySelectorAll('.tip').forEach(e => e.remove());
  if (on) tip('VIP 칸으로 보낼 차를 고르세요', rel($('#grid')).y - 30);
  updateHud();
}

function sendToVip(v) {
  setVip(false);
  save.boosters.vip--; persist(); updateHud();
  run.moved = true;
  reveal(v);
  run.slots[0] = { vid: v.id, color: v.color, cap: SIZES[v.size].cap, filled: 0, ready: false, seq: ++run.seq };
  v.where = 'moving';
  v.el.classList.add('flying', 'parked');
  place(v.el, slotBox(0));
  setTimeout(() => arrive(v, 0), 420);
}

// ---------- 잠긴 칸 ----------
document.querySelectorAll('.slot.locked').forEach(el => el.addEventListener('click', () => {
  if (!run || run.over || run.open[+el.dataset.slot]) return;
  sheet({
    title: '칸 열기', body: '이번 판에서만 주차칸이 하나 늘어나요.',
    buttons: [
      { label: `${PRICE.slot}코인으로 열기`, cls: 'gold', disabled: save.coins < PRICE.slot, on: () => { save.coins -= PRICE.slot; openSlot(); } },
      { label: '광고 보고 열기', sub: '프로토타입이라 바로 열려요', on: openSlot },
      { label: '닫기' },
    ],
  });
}));

function openSlot() {
  const i = run.open.findIndex((o, k) => k >= 5 && !o);
  if (i === -1) return false;
  run.open[i] = true;
  renderSlots(); persist(); updateHud();
  return true;
}

// ---------- 결과 ----------
function win() {
  run.over = true;
  const reward = run.L.hard ? 40 : 20;
  save.coins += reward;
  if (!save.cleared.includes(run.n)) save.cleared.push(run.n);
  save.unlocked = Math.max(save.unlocked, Math.min(LEVELS.length, run.n + 1));
  persist(); updateHud(); confetti();
  const last = run.n === LEVELS.length;
  setTimeout(() => sheet({
    title: last ? '10레벨 모두 클리어!' : '클리어!',
    body: `코인 +${reward}${last ? ' · 프로토타입은 여기까지예요' : ''}`,
    buttons: last
      ? [{ label: '레벨 고르기', cls: 'primary', on: levelsSheet }]
      : [{ label: `레벨 ${run.n + 1} 하기`, cls: 'primary', on: () => startLevel(run.n + 1) }, { label: '한 번 더', on: () => startLevel(run.n) }],
  }), 500);
}

function lose() {
  run.over = true;
  buzz();
  const canSlot = run.open.some((o, k) => k >= 5 && !o);
  sheet({
    title: '주차칸이 꽉 찼어요!',
    body: `남은 승객 ${run.queue.length - run.qi}명. 칸이 하나만 더 있으면 이어갈 수 있어요.`,
    buttons: [
      { label: `칸 +1 하고 이어하기`, sub: `${PRICE.revive}코인`, cls: 'gold', disabled: !canSlot || save.coins < PRICE.revive, on: () => { save.coins -= PRICE.revive; revive(); } },
      { label: '광고 보고 이어하기', sub: '프로토타입이라 바로 이어져요', disabled: !canSlot, on: revive },
      { label: '다시 하기', sub: '하트 -1', on: () => { save.hearts = Math.max(0, save.hearts - 1); persist(); startLevel(run.n); } },
    ],
  });
}

function revive() { openSlot(); run.over = false; }

// ---------- 시트 ----------
function sheet({ title, body, buttons, extra }) {
  closeSheet();
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><h2></h2><p></p>${extra ?? ''}<div class="btns"></div></div>`;
  wrap.querySelector('h2').textContent = title;
  wrap.querySelector('p').textContent = body;
  for (const b of buttons) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'btn ' + (b.cls ?? '');
    el.textContent = b.label;
    if (b.sub) { const s = document.createElement('small'); s.textContent = b.sub; el.appendChild(s); }
    el.disabled = !!b.disabled;
    el.addEventListener('click', () => { closeSheet(); b.on?.(); });
    wrap.querySelector('.btns').appendChild(el);
  }
  document.body.appendChild(wrap);
  return wrap;
}
function closeSheet() { document.querySelectorAll('.sheet-wrap').forEach(e => e.remove()); }

function levelsSheet() {
  const extra = '<div class="levels">' + LEVELS.map((L, i) => {
    const n = i + 1;
    const st = save.cleared.includes(n) ? 'cleared' : n <= save.unlocked ? 'open' : 'locked';
    return `<button type="button" data-n="${n}" data-state="${st}" ${n > save.unlocked ? 'disabled' : ''}>${n}</button>`;
  }).join('') + '</div>';
  const w = sheet({
    title: '레벨 고르기', body: 'HARD: 5, 10',
    extra,
    buttons: [{ label: '진행 초기화', on: () => { try { localStorage.removeItem(SAVE_KEY); } catch { /* 무시 */ } location.reload(); } }, { label: '닫기' }],
  });
  w.querySelectorAll('.levels button').forEach(b => b.addEventListener('click', () => { closeSheet(); startLevel(+b.dataset.n); }));
}

function shopSheet() {
  const buy = k => () => { save.coins -= PRICE.booster; save.boosters[k]++; persist(); updateHud(); shopSheet(); };
  sheet({
    title: '상점', body: `보유 코인 ${save.coins} · 프로토타입이라 실제 결제는 없어요`,
    buttons: [
      { label: '승객 정렬 +1', sub: `${PRICE.booster}코인`, disabled: save.coins < PRICE.booster, on: buy('sort') },
      { label: '차 섞기 +1', sub: `${PRICE.booster}코인`, disabled: save.coins < PRICE.booster, on: buy('shuffle') },
      { label: 'VIP 빼기 +1', sub: `${PRICE.booster}코인`, disabled: save.coins < PRICE.booster, on: buy('vip') },
      { label: '테스트용 코인 +500', cls: 'gold', on: () => { save.coins += 500; persist(); updateHud(); shopSheet(); } },
      { label: '닫기' },
    ],
  });
}

function heartsSheet(n) {
  sheet({
    title: '하트가 없어요', body: '원래는 25분마다 하나씩 차요. 프로토타입이라 바로 채울 수 있어요.',
    buttons: [{ label: '하트 채우기', cls: 'primary', on: () => { save.hearts = 5; persist(); updateHud(); startLevel(n); } }],
  });
}

$('#btn-levels').addEventListener('click', levelsSheet);
$('#btn-restart').addEventListener('click', () => {
  if (!run) return;
  if (!run.moved || run.over) { startLevel(run.n); return; }
  sheet({
    title: '다시 시작할까요?', body: '하던 판을 그만두면 하트가 1개 줄어요.',
    buttons: [
      { label: '다시 시작', sub: '하트 -1', cls: 'primary', on: () => { save.hearts = Math.max(0, save.hearts - 1); persist(); startLevel(run.n); } },
      { label: '계속하기' },
    ],
  });
});

// ---------- 안내 ----------
let hintEl = null;
function hints() {
  const n = run.n;
  if (n === 1) {
    const lot = lotVehicles();
    const front = run.queue[0];
    const v = lot.find(v => v.color === front && blockerOf(v, lot, run.L.cols, run.L.rows) === null)
      ?? lot.find(v => blockerOf(v, lot, run.L.cols, run.L.rows) === null);
    if (v) { v.el.classList.add('hint'); hintEl = v.el; }
    tip('맨 앞 손님 색과 같은 차를 눌러 꺼내요', rel($('#grid')).y - 30);
  }
  if (n === 3) toast('큰 차는 손님을 더 많이 태워요');
  if (n === 5 || n === 10) toast('HARD 레벨! 순서를 잘 생각해요');
  if (n === 6) toast('? 차는 꺼내야 색이 보여요');
}
function clearHint() {
  if (hintEl) { hintEl.classList.remove('hint'); hintEl = null; }
  if (!run.vipMode) stage.querySelectorAll('.tip').forEach(e => e.remove());
}
function tip(text, y) {
  const el = document.createElement('div');
  el.className = 'tip';
  el.textContent = text;
  el.style.top = Math.max(0, y) + 'px';
  stage.appendChild(el);
}
function toast(text) {
  document.querySelectorAll('.toast').forEach(e => e.remove());
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2400);
}
function confetti() {
  const cols = ['--c0', '--c1', '--c2', '--c3', '--c4', '--c5'];
  for (let i = 0; i < 40; i++) {
    const c = document.createElement('span');
    c.className = 'confetti';
    c.style.left = Math.random() * 100 + 'vw';
    c.style.background = `var(${cols[i % cols.length]})`;
    c.style.animationDelay = Math.random() * 0.4 + 's';
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 2000);
  }
}

// ---------- 시작 ----------
// 개발·테스트용: 콘솔에서 __bus.run 으로 판 상태 확인
window.__bus = { get run() { return run; }, save };
new ResizeObserver(() => layoutAll(true)).observe(stage);
updateHud();
startLevel(Math.min(save.unlocked, LEVELS.length));
