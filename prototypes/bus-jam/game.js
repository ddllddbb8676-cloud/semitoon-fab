// 버스 잼 프로토타입 — 화면과 조작. 규칙 함수(SIZES, blockerOf 등)는 core.js에서 옵니다.

const $ = s => document.querySelector(s);
const stage = $('#stage');
const SAVE_KEY = 'busjam-proto-v2';
const PRICE = { slot: 120, revive: 150, booster: 100 };
const DIR_ANGLE = { R: 0, D: 90, L: 180, U: 270 };

// 색 (캔버스에서도 쓰려고 CSS 변수에서 읽음)
const css = getComputedStyle(document.documentElement);
const PAL = [0, 1, 2, 3, 4, 5].map(i => ({
  c: css.getPropertyValue(`--c${i}`).trim(), l: css.getPropertyValue(`--l${i}`).trim(), d: css.getPropertyValue(`--d${i}`).trim(),
}));

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
  stage.querySelectorAll('.veh, .barrier, .walker, .tip').forEach(e => e.remove());
  run = {
    L, n,
    vehicles: L.vehicles.map(v => ({ ...v, where: 'lot', revealed: !v.mystery, el: null, ang: DIR_ANGLE[v.dir] })),
    barriers: (L.barriers ?? []).map(b => ({ ...b, el: null, open: false })),
    slots: new Array(8).fill(null),
    open: [true, true, true, true, true, false, false, false],
    queue: L.queue.slice(),
    qi: 0, seq: 0, exited: 0, over: false, moved: false, vipMode: false,
  };
  crowd.people = new Map();
  $('#lv-title').textContent = `레벨 ${n}`;
  $('#tag').textContent = L.hard ? 'HARD' : '';
  renderSlots();
  for (const v of run.vehicles) makeVehicle(v);
  for (const b of run.barriers) makeBarrier(b);
  layoutAll(true);
  crowd.retarget(true);
  updateHud();
  hints();
}

const lotVehicles = () => run.vehicles.filter(v => v.where === 'lot');
const lotGrid = () => occupancy(lotVehicles(), run.L.cols, run.L.rows, run.L.barriers ?? [], run.exited);

// ---------- 좌표 ----------
function rel(el) {
  const r = el.getBoundingClientRect(), s = stage.getBoundingClientRect();
  return { x: r.left - s.left, y: r.top - s.top, w: r.width, h: r.height };
}
function gridGeom() {
  const g = rel($('#grid'));
  return { ...g, cw: g.w / run.L.cols, ch: g.h / run.L.rows };
}
function cellBox(v) {
  const g = gridGeom();
  const len = SIZES[v.size].len;
  const horiz = v.dir === 'L' || v.dir === 'R';
  return { x: g.x + v.x * g.cw + 3, y: g.y + v.y * g.ch + 3, w: (horiz ? len : 1) * g.cw - 6, h: (horiz ? 1 : len) * g.ch - 6, cw: g.cw, ch: g.ch };
}
function slotBox(i) {
  const b = rel(document.querySelector(`.slot[data-slot="${i}"]`));
  return { x: b.x + 2, y: b.y + 2, w: b.w - 4, h: b.h - 4 };
}

// ---------- 차 ----------
const ARROW = '<svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13M13 6l6 6-6 6"/></svg>';

function paint(el, c) {
  el.style.setProperty('--col', PAL[c].c);
  el.style.setProperty('--hi', PAL[c].l);
  el.style.setProperty('--dk', PAL[c].d);
}

function makeVehicle(v) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'veh';
  el.dataset.dir = v.dir;
  el.dataset.size = v.size;
  el.dataset.vid = v.id;
  el.setAttribute('aria-label', { car: '소형차', van: '밴', bus: '버스' }[v.size]);
  el.innerHTML = `<div class="car"><i class="shadow"></i><i class="wheel w1"></i><i class="wheel w2"></i><i class="wheel w3"></i><i class="wheel w4"></i><i class="body"></i><i class="roof"></i><i class="glass back"></i><i class="glass front"></i>${ARROW}</div><span class="q">?</span><span class="seats"></span>`;
  if (v.mystery) el.classList.add('mystery'); else paint(el, v.color);
  el.addEventListener('click', () => tapVehicle(v));
  stage.appendChild(el);
  v.el = el;
}

// 상자(b)에 차를 놓고, 차 그림을 각도(ang)로 돌림
function setBox(v, b, ang, parked) {
  const el = v.el;
  el.style.width = b.w + 'px';
  el.style.height = b.h + 'px';
  el.style.transform = `translate(${b.x}px, ${b.y}px)`;
  const vertical = Math.abs(((ang % 180) + 180) % 180 - 90) < 1;
  const L = vertical ? b.h : b.w, S = vertical ? b.w : b.h;
  el.style.setProperty('--L', (parked ? L * 0.96 : L) + 'px');
  el.style.setProperty('--S', (parked ? S * 0.86 : S) + 'px');
  el.style.setProperty('--a', ang + 'deg');
  v.ang = ang;
}
function nearestAngle(cur, target) {
  let d = ((target - cur) % 360 + 540) % 360 - 180;
  return cur + d;
}

function makeBarrier(b) {
  const el = document.createElement('div');
  el.className = 'barrier';
  el.innerHTML = '<span class="bar"></span><span class="n"></span>';
  stage.appendChild(el);
  b.el = el;
}

function layoutAll(instant) {
  if (!run) return;
  const els = [];
  for (const v of run.vehicles) {
    if (!v.el) continue;
    els.push(v.el);
    if (v.where === 'lot') setBox(v, cellBox(v), DIR_ANGLE[v.dir], false);
    else { const i = run.slots.findIndex(s => s && s.vid === v.id); if (i >= 0) setBox(v, slotBox(i), nearestAngle(v.ang, 270), true); }
  }
  const g = gridGeom();
  for (const b of run.barriers) {
    if (!b.el) continue;
    b.el.style.width = g.cw + 'px'; b.el.style.height = g.ch + 'px';
    b.el.style.transform = `translate(${g.x + b.x * g.cw}px, ${g.y + b.y * g.ch}px)`;
    b.el.querySelector('.n').textContent = Math.max(0, b.n - run.exited);
  }
  if (instant) {
    els.forEach(e => { e.style.transition = 'none'; e.firstChild.style.transition = 'none'; });
    stage.offsetHeight;
    els.forEach(e => { e.style.transition = ''; e.firstChild.style.transition = ''; });
  }
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

  const blocker = blockerOf(v, run.L.cols, run.L.rows, lotGrid());
  if (blocker !== null) {
    bump(v);
    if (blocker === BARRIER) {
      const b = run.barriers.find(b => !b.open && exitPath(v, run.L.cols, run.L.rows).some(([x, y]) => x === b.x && y === b.y));
      if (b) retrigger(b.el, 'ping');
    } else retrigger(run.vehicles.find(o => o.id === blocker).el, 'blocker');
    return;
  }
  const i = freeSlot();
  if (i === -1) { bump(v); toast('주차칸이 꽉 찼어요'); return; }
  buzz();
  run.moved = true;
  leaveLot(v);
  run.slots[i] = { vid: v.id, color: v.color, cap: SIZES[v.size].cap, filled: 0, ready: false, seq: ++run.seq };

  // 1단계: 머리 방향으로 쭉 빠짐
  const b = cellBox(v);
  const { dx, dy } = DIRS[v.dir];
  const [hx, hy] = headOf(v);
  const toEdge = dx > 0 ? run.L.cols - 1 - hx : dx < 0 ? hx : dy > 0 ? run.L.rows - 1 - hy : hy;
  const dist = (toEdge + SIZES[v.size].len + 0.3) * (dx ? b.cw : b.ch);
  v.el.classList.add('flying');
  v.el.style.transform = `translate(${b.x + dx * dist}px, ${b.y + dy * dist}px)`;
  // 2단계: 돌면서 주차칸으로
  setTimeout(() => {
    v.el.classList.add('parked');
    setBox(v, slotBox(i), nearestAngle(v.ang, 270), true);
    setTimeout(() => arrive(v, i), 330);
  }, 250);
}

function leaveLot(v) {
  v.where = 'moving';
  run.exited++;
  reveal(v);
  for (const b of run.barriers) {
    const left = Math.max(0, b.n - run.exited);
    if (b.el) b.el.querySelector('.n').textContent = left;
    if (!b.open && left === 0) {
      b.open = true;
      b.el.classList.add('open');
      const el = b.el;
      setTimeout(() => el.remove(), 400);
      b.el = null;
      toast('차단기가 열렸어요');
    }
  }
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
  paint(v.el, v.color);
}

function bump(v) { v.el.style.setProperty('--bx', '6px'); retrigger(v.el, 'bump'); }
function retrigger(el, cls) { if (!el) return; el.classList.remove(cls); el.offsetWidth; el.classList.add(cls); setTimeout(() => el.classList.remove(cls), 600); }
function buzz() { try { navigator.vibrate?.(8); } catch { /* 무시 */ } }
function seatLabel(v, s) { if (s && v.el) v.el.querySelector('.seats').textContent = `${s.filled}/${s.cap}`; }

// ---------- 승객 행렬 (캔버스) ----------
// 도로: 오른쪽 위 화면 밖에서 시작 → 위쪽을 따라 왼쪽 → 왼쪽 아래로 꺾여 → 아래쪽 가운데 '탑승구'에서 끝
const crowd = {
  canvas: $('#crowd'), ctx: null, W: 0, H: 0, dpr: 1,
  path: [], lens: [], total: 0, road: null, people: new Map(),
  ROW: 14, LANES: [0, -14, 14], ROAD_W: 50,

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = r.width; this.H = r.height;
    this.canvas.width = Math.round(r.width * this.dpr);
    this.canvas.height = Math.round(r.height * this.dpr);
    this.ctx = this.canvas.getContext('2d');
    this.buildPath();
    this.buildRoad();
    this.retarget(true);
  },

  buildPath() {
    const { W, H } = this;
    const m = 34, R = 36;
    const gate = { x: W * 0.5, y: H - m };
    const pts = [];
    const line = (a, b, n = 12) => { for (let i = 0; i <= n; i++) pts.push({ x: a.x + (b.x - a.x) * i / n, y: a.y + (b.y - a.y) * i / n }); };
    const arc = (cx, cy, a0, a1) => { for (let i = 1; i <= 10; i++) { const t = a0 + (a1 - a0) * i / 10; pts.push({ x: cx + R * Math.cos(t), y: cy + R * Math.sin(t) }); } };
    // 탑승구에서 거꾸로 (맨 앞 → 맨 뒤)
    line(gate, { x: m + R, y: H - m });
    arc(m + R, H - m - R, Math.PI / 2, Math.PI);
    line({ x: m, y: H - m - R }, { x: m, y: m + R });
    arc(m + R, m + R, Math.PI, Math.PI * 1.5);
    line({ x: m + R, y: m }, { x: W + 80, y: m }, 30);
    this.path = pts;
    this.lens = [0];
    for (let i = 1; i < pts.length; i++) this.lens.push(this.lens[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    this.total = this.lens[this.lens.length - 1];
    this.gate = gate;
  },

  at(s) {
    const { path, lens } = this;
    s = Math.max(0, Math.min(s, this.total));
    let i = 1;
    while (i < lens.length - 1 && lens[i] < s) i++;
    const a = path[i - 1], b = path[i];
    const t = (s - lens[i - 1]) / ((lens[i] - lens[i - 1]) || 1);
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
    return { x: a.x + dx * t, y: a.y + dy * t, nx: -dy / d, ny: dx / d };
  },

  buildRoad() {
    const c = document.createElement('canvas');
    c.width = this.canvas.width; c.height = this.canvas.height;
    const g = c.getContext('2d');
    g.scale(this.dpr, this.dpr);
    const { W, H, path, gate } = this;
    // 광장 바닥 타일
    g.fillStyle = '#e9eef4'; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(160,172,188,.25)'; g.lineWidth = 1;
    for (let x = 0; x < W; x += 22) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    for (let y = 0; y < H; y += 22) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    const stroke = (w, col) => {
      g.lineWidth = w; g.strokeStyle = col; g.lineJoin = 'round'; g.lineCap = 'butt';
      g.beginPath(); g.moveTo(path[0].x, path[0].y + 0); path.forEach(p => g.lineTo(p.x, p.y));
      g.moveTo(gate.x, gate.y); g.lineTo(gate.x, H + 10);
      g.stroke();
    };
    stroke(this.ROAD_W + 10, '#c3ccd8');
    stroke(this.ROAD_W + 6, '#ffffff');
    stroke(this.ROAD_W, '#b9c2ce');
    // 탑승구 횡단보도
    g.fillStyle = 'rgba(255,255,255,.85)';
    for (let i = -2; i <= 2; i++) g.fillRect(gate.x + i * 9 - 3, H - 22, 6, 14);
    // 꾸밈: 나무와 가로등
    const tree = (x, y) => {
      g.fillStyle = 'rgba(0,0,0,.12)'; g.beginPath(); g.ellipse(x, y + 9, 10, 4, 0, 0, 7); g.fill();
      g.fillStyle = '#5cb85c'; g.beginPath(); g.arc(x, y, 10, 0, 7); g.fill();
      g.fillStyle = '#7fd17f'; g.beginPath(); g.arc(x - 3, y - 3, 5, 0, 7); g.fill();
    };
    tree(W * 0.78, H * 0.55); tree(W * 0.9, H * 0.72); tree(W * 0.3, H * 0.5);
    this.road = c;
  },

  // 맨 앞(k=0)부터 줄 선 자리 목표 좌표
  slotXY(k) {
    const row = Math.floor(k / 3), lane = k % 3;
    const p = this.at(10 + row * this.ROW);
    const off = this.LANES[lane];
    return { x: p.x + p.nx * off, y: p.y + p.ny * off, hidden: 10 + row * this.ROW > this.total - 4 };
  },

  retarget(instant) {
    if (!run || !this.total) return;
    const maxShow = Math.floor((this.total - 20) / this.ROW) * 3;
    const end = Math.min(run.queue.length, run.qi + maxShow);
    const alive = new Set();
    for (let i = run.qi; i < end; i++) {
      alive.add(i);
      const t = this.slotXY(i - run.qi);
      let p = this.people.get(i);
      if (!p) {
        const start = this.at(this.total - 2);
        p = { x: instant ? t.x : start.x, y: instant ? t.y : start.y, phase: Math.random() * 6 };
        this.people.set(i, p);
      }
      p.tx = t.x; p.ty = t.y; p.color = run.queue[i];
      if (instant) { p.x = t.x; p.y = t.y; }
    }
    for (const k of [...this.people.keys()]) if (!alive.has(k)) this.people.delete(k);
    const left = run.queue.length - end;
    $('#pax-left').textContent = left > 0 ? `+${left}명` : '';
  },

  draw(dt) {
    const { ctx, dpr } = this;
    if (!ctx || !this.road) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.road, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const list = [...this.people.values()];
    const speed = 110;
    for (const p of list) {
      const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
      p.walking = d > 0.6;
      if (p.walking) { const m = Math.min(d, speed * dt); p.x += dx / d * m; p.y += dy / d * m; p.phase += dt * 16; }
    }
    list.sort((a, b) => a.y - b.y);
    for (const p of list) drawPerson(ctx, p.x, p.y, PAL[p.color], p.walking ? Math.sin(p.phase) : 0);
  },
};

function drawPerson(ctx, x, y, pal, bob) {
  const by = y - Math.abs(bob) * 1.6;
  ctx.fillStyle = 'rgba(0,0,0,.22)';
  ctx.beginPath(); ctx.ellipse(x, y + 6, 6, 2.6, 0, 0, 7); ctx.fill();
  // 몸통
  const g = ctx.createLinearGradient(0, by - 3, 0, by + 7);
  g.addColorStop(0, pal.l); g.addColorStop(0.5, pal.c); g.addColorStop(1, pal.d);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.roundRect(x - 5.5, by - 3, 11, 10, [5, 5, 3, 3]); ctx.fill();
  // 머리
  const h = ctx.createRadialGradient(x - 1.5, by - 8, 0.5, x, by - 6.5, 5);
  h.addColorStop(0, pal.l); h.addColorStop(1, pal.c);
  ctx.fillStyle = h;
  ctx.beginPath(); ctx.arc(x, by - 6.5, 4.6, 0, 7); ctx.fill();
}

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
  const p = crowd.people.get(run.qi);
  crowd.people.delete(run.qi);
  const color = run.queue[run.qi];
  run.qi++;
  s.filled++;
  seatLabel(v, s);
  // 맨 앞 손님이 차로 걸어감
  const pz = rel($('#plaza'));
  const from = p ? { x: pz.x + p.x, y: pz.y + p.y } : { x: pz.x + crowd.gate.x, y: pz.y + crowd.gate.y };
  const b = slotBox(i);
  const w = document.createElement('span');
  w.className = 'walker';
  paint(w, color);
  w.style.transform = `translate(${from.x - 7}px, ${from.y - 12}px)`;
  stage.appendChild(w);
  w.offsetWidth;
  w.style.transform = `translate(${b.x + b.w / 2 - 7}px, ${b.y + b.h / 2 - 9}px) scale(.8)`;
  w.classList.add('in');
  setTimeout(() => w.remove(), 520);
  crowd.retarget(false);
  if (s.filled === s.cap) {
    s.leaving = true;
    setTimeout(() => {
      retrigger(v.el, 'full');
      setTimeout(() => {
        v.el.style.transform += ' translateY(-70px)';
        v.el.classList.add('depart');
        const el = v.el;
        setTimeout(() => { el.remove(); }, 320);
        v.el = null; v.where = 'gone';
        run.slots[i] = null;
      }, 200);
    }, 200);
  }
}

function checkEnd() {
  if (run.qi >= run.queue.length) {
    if (run.slots.every(s => !s)) win();
    return;
  }
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
    const inSlot = new Set(run.slots.filter(s => s && !s.leaving).map(s => s.color));
    if (!inSlot.size) { toast('주차칸에 차가 있어야 써요'); return; }
    const rest = run.queue.slice(run.qi);
    const a = rest.filter(c => inSlot.has(c)), b = rest.filter(c => !inSlot.has(c));
    run.queue.splice(run.qi, rest.length, ...a, ...b);
    // 줄을 다시 서는 모습: 기존 사람들 색만 바꾸지 않고 자리를 섞어 걸어가게
    const old = [...crowd.people.entries()];
    crowd.people = new Map();
    const shuffled = old.map(([, p]) => p).sort(() => Math.random() - 0.5);
    old.forEach(([idx], j) => crowd.people.set(idx, shuffled[j]));
    crowd.retarget(false);
    toast('손님 줄을 정리했어요');
  }
  if (k === 'shuffle') {
    const lot = lotVehicles();
    if (lot.length < 2) { toast('섞을 차가 부족해요'); return; }
    for (const size of Object.keys(SIZES)) {
      const g = lot.filter(v => v.size === size);
      const cols = g.map(v => v.color);
      for (let i = cols.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cols[i], cols[j]] = [cols[j], cols[i]]; }
      g.forEach((v, i) => { v.color = cols[i]; if (v.revealed) paint(v.el, v.color); retrigger(v.el, 'blocker'); });
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
  leaveLot(v);
  run.slots[0] = { vid: v.id, color: v.color, cap: SIZES[v.size].cap, filled: 0, ready: false, seq: ++run.seq };
  v.el.classList.add('flying', 'parked');
  setBox(v, slotBox(0), nearestAngle(v.ang, 270), true);
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
    body: `남은 손님 ${run.queue.length - run.qi}명. 칸이 하나만 더 있으면 이어갈 수 있어요.`,
    buttons: [
      { label: '칸 +1 하고 이어하기', sub: `${PRICE.revive}코인`, cls: 'gold', disabled: !canSlot || save.coins < PRICE.revive, on: () => { save.coins -= PRICE.revive; revive(); } },
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
    const grid = lotGrid();
    const front = run.queue[0];
    const free = lot.filter(v => blockerOf(v, run.L.cols, run.L.rows, grid) === null);
    const v = free.find(v => v.color === front) ?? free[0];
    if (v) { v.el.classList.add('hint'); hintEl = v.el; }
    tip('맨 앞 손님 색과 같은 차를 눌러요', rel($('#grid')).y - 30);
  }
  if (n === 2) toast('밴은 6명, 버스는 10명을 태워요');
  if (n === 4) toast('? 차는 꺼내야 색이 보여요');
  if (n === 5 || n === 10) toast('HARD! 꺼내는 순서를 잘 생각해요');
  if (n === 6) toast('차단기는 차가 숫자만큼 빠지면 열려요');
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
  for (let i = 0; i < 40; i++) {
    const c = document.createElement('span');
    c.className = 'confetti';
    c.style.left = Math.random() * 100 + 'vw';
    c.style.background = PAL[i % PAL.length].c;
    c.style.animationDelay = Math.random() * 0.4 + 's';
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 2000);
  }
}

// ---------- 시작 ----------
// 개발·테스트용: 콘솔에서 __bus.run 으로 판 상태 확인
window.__bus = { get run() { return run; }, save };
new ResizeObserver(() => { crowd.resize(); layoutAll(true); }).observe(stage);
let lastT = performance.now();
(function frame(t) {
  const dt = Math.min(0.05, (t - lastT) / 1000);
  lastT = t;
  crowd.draw(dt);
  requestAnimationFrame(frame);
})(lastT);
updateHud();
crowd.resize();
startLevel(Math.min(save.unlocked, LEVELS.length));
