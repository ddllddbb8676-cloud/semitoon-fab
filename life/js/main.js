// 시작점: 데이터 불러오기, 화면 흐름, 게임 시계, 저장 (담당: Claude)
// 엔진(engine.js)이 보내는 일을 document의 life:* 이벤트로 다시 내보냅니다.
// 연출(js/fx.js, GPT)은 document.addEventListener('life:semi', ...)처럼 듣기만 하면 됩니다. 목록은 docs/UI_CONTRACT.md.

import { loadData } from './data.js';
import {
  attach, beginYear, nextEvent, present, skipEvent, chooseEvent, finishYear, snapshot, review,
  createLife, rollCandidate, hydrate, yearSpeedMult,
} from './engine.js';
import { Rng, newSeed } from './rng.js';
import { yearHeadline } from './world.js';
import { ro } from './career.js';
import * as ui from './ui.js';

const SAVE_KEY = 'semilife.save.v1';
const BAK_KEY = 'semilife.save.bak';
const ARCHIVE_KEY = 'semilife.archive.v1';
const SETTINGS_KEY = 'semilife.settings.v1';
const YEAR_MS = 60_000;          // 1배속 = 1년 60초 (SPEC)
const AUTO_YEAR_MS = 600;        // '자동' 배속: 사건 없는 해는 0.6초, 사건이 있으면 카드에서 기다림 (v0.2 기본)
const SMALL_EVENT_MS = 15_000;   // 작은 사건은 실제 시간 15초 안에 안 고르면 default
const RESULT_MS = 5_000;         // 작은 사건 결과는 5초 뒤 저절로 닫힘 (자동은 4초)
const AUTO_RESULT_MS = 4_000;
const SAVE_GAP_MS = 3_000;       // 자동 배속에서 해마다 저장하면 너무 잦아 3초에 한 번만 (큰 사건·멈춤·창 숨김 때는 바로)
const SPEEDS = ['auto', 0, 1, 2, 4, 8];

// localStorage가 막혀 있어도 게임은 돌아갑니다
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  raw(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch { /* 무시 */ } },
};

let D = null;
let L = null;
const game = { speed: 'auto', progress: 0, card: null, lastTs: 0, tab: 'feed', worldSeed: null, year: null, lastSave: 0 };
const create = { name: '', year: 1985, candidates: [], selected: -1, rerolls: 3, rng: null };

// ---------- 엔진 → 화면·연출 ----------
function emit(type, detail = {}) {
  document.dispatchEvent(new CustomEvent(`life:${type}`, { detail }));
  switch (type) {
    case 'semi': ui.toast(`반도체 순간 · ${detail.text}`, 'semi'); break;
    case 'trait': if (detail.gained) ui.toast(`특징이 생겼어요 · ${detail.name}`); break;
    case 'promo': ui.toast(`${ro(detail.name)} 승진했어요`); break;
    case 'talent': ui.toast(`숨은 재능을 찾았어요 · ${detail.name}`); break;
    case 'achievement': ui.toast(`업적 달성 · ${detail.name}`, 'achievement'); break;
    default: break;
  }
}

// ---------- 데이터 (life/data/) ----------
const DATA = new URL('../data/', import.meta.url);
async function read(path) {
  try {
    const r = await fetch(new URL(path, DATA));
    return r.ok ? await r.json() : null;
  } catch { return null; }
}
// 디렉터리 목록(python http.server 등)이 되면 선택 파일 중 있는 것만 읽어 404를 피합니다
async function list(dir) {
  try {
    const r = await fetch(new URL(dir || './', DATA));
    if (!r.ok || !(r.headers.get('content-type') ?? '').includes('text/html')) return null;
    const html = await r.text();
    const names = [...html.matchAll(/href="([^"?#]+)"/g)].map((m) => decodeURIComponent(m[1])).filter((n) => !n.startsWith('/') && !n.startsWith('.') && !n.includes(':'));
    return names.length ? names : null;
  } catch { return null; }
}

// ---------- 저장 (SYSTEMS 12장) ----------
function save() {
  if (!L || L.s.dead) return;
  game.lastSave = performance.now();
  if (L.s.turn) L.s.turn.progress = game.progress;
  const json = JSON.stringify(snapshot(L));
  const prev = store.raw(SAVE_KEY);
  if (prev) store.set(BAK_KEY, prev);
  store.set(SAVE_KEY, json);
}
function loadSave() {
  return hydrate(store.get(SAVE_KEY)) ?? hydrate(store.get(BAK_KEY));
}
function archive(rv) {
  const list = store.get(ARCHIVE_KEY);
  const arr = Array.isArray(list) ? list : [];
  arr.push({ v: 1, name: rv.name, birth_year: rv.birthYear, death_year: rv.deathYear, title: rv.title, score: rv.score, seed: rv.seed, semi: rv.semi.slice(0, 3).map((m) => m.text) });
  store.set(ARCHIVE_KEY, arr.slice(-30));
}

// ---------- 화면 흐름 ----------
function toTitle(error) {
  L = null;
  game.card = null;
  ui.hideEvent();
  ui.showTitle({ save: loadSave(), error });
  ui.showScreen('title');
}

function toCreate(worldSeed = null) {
  game.worldSeed = worldSeed;
  create.candidates = [];
  create.selected = -1;
  create.rerolls = D.char.rerolls ?? 3;
  document.getElementById('create-step1').hidden = false;
  document.getElementById('create-step2').hidden = true;
  const input = document.getElementById('input-name');
  if (!input.value) input.value = '김세미';
  setCreateYear(create.year);
  ui.showScreen('create');
}
function setCreateYear(y) {
  create.year = Math.max(D.char.birth_year.min, Math.min(D.char.birth_year.max, Number(y) || 1985));
  document.getElementById('input-year').value = String(create.year);
  ui.renderYearInfo(create.year, yearHeadline(D, create.year), game.worldSeed);
}
function roll() {
  create.name = (document.getElementById('input-name').value || '김세미').trim().slice(0, 8) || '김세미';
  create.rng = new Rng(newSeed());
  create.candidates = [rollCandidate(D, create.year, create.rng)];
  create.selected = 0;
  create.rerolls = D.char.rerolls ?? 3;
  document.getElementById('create-step1').hidden = true;
  document.getElementById('create-step2').hidden = false;
  renderCreate();
}
function reroll() {
  if (create.rerolls <= 0) return;
  create.rerolls--;
  create.candidates.push(rollCandidate(D, create.year, create.rng));
  create.selected = create.candidates.length - 1;
  renderCreate();
}
function renderCreate() {
  ui.renderCandidates(D, create.candidates, create.selected, create.year);
  document.getElementById('reroll-left').textContent = String(create.rerolls);
  document.getElementById('btn-reroll').disabled = create.rerolls <= 0;
}
function startLife() {
  const cand = create.candidates[create.selected];
  if (!cand) return;
  const seed = game.worldSeed ?? newSeed();
  const s = createLife(D, { name: create.name, birthYear: create.year, candidate: cand, seed });
  L = attach(D, s, emit);
  beginYear(L);
  game.progress = 0;
  save();
  enterMain();
}
function continueLife() {
  const s = loadSave();
  if (!s) return toTitle('이어 하기를 열 수 없어요. 새 인생을 시작해 주세요.');
  try {
    L = attach(D, s, emit);
    if (!s.turn) { beginYear(L); game.progress = 0; } else game.progress = s.turn.progress ?? 0;
  } catch (e) {
    console.warn(e);
    return toTitle('이어 하기를 열 수 없어요. 새 인생을 시작해 주세요.');
  }
  enterMain();
}
function enterMain() {
  game.card = null;
  game.year = null;
  ui.hideEvent();
  ui.showScreen('main');
  ui.selectTab(game.tab);
  ui.renderFeed(L, true);
  refresh(true);
}
function refresh(yearChanged = false) {
  if (!L) return;
  ui.renderHud(L, game.speed, isPaused());
  ui.renderStatus(L);
  ui.renderFeed(L);
  if (yearChanged || game.year !== L.s.year) {
    game.year = L.s.year;
    ui.renderHeadline(L.W.headline(L.s.year) ?? D.newsByYear.get(L.s.year)?.headlines_ko?.[0] ?? '');
  }
  ui.renderPanel(L, game.tab);
}
const isPaused = () => game.speed === 0 || !!game.card?.big;
const isAuto = () => game.speed === 'auto';

function setSpeed(v) {
  game.speed = SPEEDS.includes(v) ? v : 'auto';
  store.set(SETTINGS_KEY, { v: 2, speed: game.speed });
  if (game.speed === 0) save();
  if (L) ui.renderHud(L, game.speed, isPaused());
}

// ---------- 사건 카드 ----------
function openCard(inst) {
  const view = present(L, inst);
  if (!view) { skipEvent(L, inst); return; }
  game.card = { inst, view, big: view.big, phase: 'choose', left: SMALL_EVENT_MS };
  ui.showEvent(view);
  ui.renderHud(L, game.speed, isPaused());
}
function pick(index) {
  const card = game.card;
  if (!card || card.phase !== 'choose') return;
  const out = chooseEvent(L, card.inst, index);
  card.phase = 'result';
  card.left = isAuto() ? AUTO_RESULT_MS : RESULT_MS;
  ui.showResult(out, L.s.year);
  refresh();
  if (card.big) save();
}
function closeCard() {
  if (!game.card || game.card.phase !== 'result') return;
  game.card = null;
  ui.hideEvent();
  refresh();
}

function endYear() {
  const { dead } = finishYear(L);
  ui.renderFeed(L);
  if (dead) {
    const rv = review(L);
    archive(rv);
    store.del(SAVE_KEY);
    store.del(BAK_KEY);
    game.worldSeed = L.s.seed;
    ui.renderEnding(rv);
    ui.showScreen('ending');
    return true;
  }
  beginYear(L);
  game.progress = 0;
  if (!isAuto() || performance.now() - game.lastSave >= SAVE_GAP_MS) save();
  refresh(true);
  return false;
}

// "다음 사건까지 ▶▶": 열린 결과 카드를 닫고, 사건 카드가 열릴 때까지 해를 넘김 (한 번에 최대 40년)
function skipToEvent() {
  if (!L || L.s.dead) return;
  if (game.card) {
    if (game.card.phase !== 'result') return;
    closeCard();
  }
  for (let i = 0; i < 200 && !game.card; i++) {
    const inst = nextEvent(L, 1);
    if (inst) { game.progress = Math.max(game.progress, inst.at); openCard(inst); continue; }
    if (L.s.turn?.queue.length) continue;
    if (L.s.year - (game.skipFrom ?? L.s.year) >= 40) break;
    game.skipFrom ??= L.s.year;
    if (endYear()) return;
  }
  game.skipFrom = null;
  save();
  ui.renderProgress(game.progress);
}

// ---------- 시계 ----------
function tick(dt) {
  const card = game.card;
  if (card && !card.big && game.speed !== 0) {   // 플레이어가 멈춤을 누르면 읽을 시간을 줍니다 (자동 포함)
    card.left -= dt;
    if (card.phase === 'choose') {
      ui.setTimer(card.left / SMALL_EVENT_MS);
      if (card.left <= 0) pick(card.view.defaultIndex);
    } else if (card.left <= 0) closeCard();
  }
  if (!isPaused()) {
    const yearMs = isAuto() ? AUTO_YEAR_MS : YEAR_MS / game.speed / yearSpeedMult(L.s);
    game.progress = Math.min(1, game.progress + dt / yearMs);
  }
  if (!game.card) {
    const inst = nextEvent(L, game.progress);
    if (inst) openCard(inst);
    else if (game.progress >= 1 && !(L.s.turn?.queue.length)) endYear();
  }
  ui.renderProgress(game.progress);
}
function frame(ts) {
  const dt = game.lastTs ? Math.min(250, ts - game.lastTs) : 0;
  game.lastTs = ts;
  if (L && !L.s.dead && document.body.dataset.screen === 'main') {
    try { tick(dt); } catch (e) { console.error(e); setSpeed(0); ui.toast('문제가 생겨 잠시 멈췄어요'); }
  }
  requestAnimationFrame(frame);
}

// ---------- 입력 ----------
function bind() {
  const on = (id, ev, fn) => document.getElementById(id).addEventListener(ev, fn);
  on('btn-new', 'click', () => toCreate(null));
  on('btn-continue', 'click', continueLife);
  on('btn-create-back', 'click', () => toTitle());
  on('input-year', 'input', (e) => setCreateYear(e.target.value));
  on('btn-roll', 'click', roll);
  on('btn-reroll', 'click', reroll);
  on('btn-back', 'click', () => { document.getElementById('create-step1').hidden = false; document.getElementById('create-step2').hidden = true; });
  on('btn-start', 'click', startLife);
  on('candidate-list', 'click', (e) => {
    const li = e.target.closest('.candidate');
    if (!li) return;
    create.selected = Number(li.dataset.index);
    renderCreate();
  });
  on('candidate-list', 'keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const li = e.target.closest('.candidate');
    if (li) { e.preventDefault(); create.selected = Number(li.dataset.index); renderCreate(); }
  });
  on('speed-controls', 'click', (e) => {
    const b = e.target.closest('.speed-btn');
    if (b) setSpeed(b.dataset.speed === 'auto' ? 'auto' : Number(b.dataset.speed));
  });
  on('btn-skip', 'click', () => { try { skipToEvent(); } catch (err) { console.error(err); setSpeed(0); ui.toast('문제가 생겨 잠시 멈췄어요'); } });
  on('tabs', 'click', (e) => {
    const b = e.target.closest('.tab');
    if (!b) return;
    game.tab = b.dataset.tab;
    ui.selectTab(game.tab);
    if (L) ui.renderPanel(L, game.tab);
  });
  on('event-choices', 'click', (e) => {
    const b = e.target.closest('.choice');
    if (b) pick(Number(b.dataset.index));
  });
  on('event-ok', 'click', closeCard);
  on('btn-again-same', 'click', () => toCreate(game.worldSeed));
  on('btn-again-new', 'click', () => toCreate(null));
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  window.addEventListener('pagehide', save);
}

async function boot() {
  bind();
  const st = store.get(SETTINGS_KEY);
  // v0 설정(v: 1, 기본 4배)은 무시하고 v0.2 기본 '자동'으로 시작
  if (st?.v === 2 && SPEEDS.includes(st.speed)) game.speed = st.speed === 0 ? 'auto' : st.speed;
  try {
    D = await loadData(read, list);
  } catch (e) {
    console.error(e);
    ui.showScreen('title');
    ui.showTitle({ save: null, error: '데이터를 불러오지 못했어요. 저장소 폴더에서 python3 -m http.server로 열어 주세요.' });
    document.getElementById('btn-new').disabled = true;
    return;
  }
  toTitle();
  requestAnimationFrame(frame);
}

boot();
