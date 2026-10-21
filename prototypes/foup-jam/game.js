import { CAPACITY, SLOT_LIMIT, COLORS, createState, getBlockers, dispatch, hint } from './engine.js';
import { LEVELS } from './levels.js';

const $ = (id) => document.getElementById(id);
const arrows = { U: '↑', D: '↓', L: '←', R: '→' };
const directions = { U: '위', D: '아래', L: '왼쪽', R: '오른쪽' };
const symbols = ['◒', '✦', 'ϟ'];
const soft = ['#dcf7ed', '#fce5ef', '#eee6fc'];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let selected = Math.max(0, Math.min(LEVELS.length - 1, Math.floor(Number(new URL(location.href).searchParams.get('level')) || 1) - 1));
let state;
let history = [];
let busy = false;
let runToken = 0;
let toastTimer;
let soundEnabled = false;
let audio;
let cleared = [];
try { cleared = JSON.parse(localStorage.getItem('foup-jam-cleared') || '[]'); } catch { /* Optional browser-local progress. */ }
if (!Array.isArray(cleared)) cleared = [];

function colorStyle(index) {
  return `--color:${COLORS[index].hex};--soft:${soft[index]}`;
}

function waferMarkup(color, count) {
  return Array.from({ length: count }, (_, index) => `<i class="wafer" style="--color:${COLORS[color].hex};--i:${index}" aria-hidden="true"></i>`).join('');
}

function notice(message) {
  clearTimeout(toastTimer);
  $('toast').textContent = message;
  $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 2400);
}

function tone(kind, chain = 1) {
  if (!soundEnabled) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    const notes = kind === 'complete' ? [523, 659, 784] : kind === 'blocked' ? [160] : [kind === 'load' ? 440 + chain * 80 : 330];
    notes.forEach((frequency, index) => {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const at = audio.currentTime + index * 0.075;
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(0.065, at + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, at + 0.17);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.19);
    });
  } catch { soundEnabled = false; }
}

function renderLevels() {
  $('levelButtons').innerHTML = LEVELS.map((level, index) => `<button class="level-button ${index === selected ? 'selected' : ''} ${cleared.includes(level.id) ? 'cleared' : ''}" data-level="${index}" aria-label="스테이지 ${index + 1}: ${level.title}" aria-pressed="${index === selected}">${cleared.includes(level.id) ? '✓' : index + 1}</button>`).join('');
}

function renderScene() {
  $('route').innerHTML = state.route.map((color, index) => `${index ? '<span class="process-arrow" aria-hidden="true">›</span>' : ''}<span class="process-step" style="${colorStyle(color)}"><b>${symbols[color]}</b>${COLORS[color].name}</span>`).join('') + '<span class="process-arrow" aria-hidden="true">›</span><span class="route-finish">✧ 출고</span>';
  $('factoryGrid').style.setProperty('--stages', state.route.length);
  $('factoryGrid').innerHTML = state.route.map((color, index) => {
    const queue = state.queues.filter((entry) => entry.location === COLORS[color].key && entry.count > 0);
    const count = queue.reduce((sum, entry) => sum + entry.count, 0);
    const final = index === state.route.length - 1;
    const label = final ? `출고 <b>${state.completed}장</b>` : `<span style="color:${COLORS[state.route[index + 1]].hex}">${COLORS[state.route[index + 1]].name}행</span> <b>${count}장</b>`;
    return `<div class="factory" data-stage="${color}" style="${colorStyle(color)}"><div class="factory-top"><span class="machine-symbol">${symbols[color]}</span><span class="factory-name">${COLORS[color].name}</span></div><div class="machine-body"><div class="machine-window"><i></i><i></i><i></i><span>${symbols[color]}</span></div><span class="machine-light"></span></div><div class="factory-queue-label">${label}</div><div class="wafer-crowd factory-crowd" data-location="${COLORS[color].key}" aria-label="${count}장 대기">${queue.map((entry) => waferMarkup(entry.color, entry.count)).join('')}${!count ? '<span class="queue-empty">' + (final ? '완성을 기다려요' : '다음 공정 대기') + '</span>' : ''}</div></div>`;
  }).join('');
  const input = state.queues.filter((entry) => entry.location === 'input' && entry.count > 0);
  const count = input.reduce((sum, entry) => sum + entry.count, 0);
  $('inputCount').textContent = `${count}장`;
  $('inputCrowd').innerHTML = input.map((entry) => waferMarkup(entry.color, entry.count)).join('') || '<span class="queue-empty">모두 공정으로 보냈어요!</span>';
  $('orbiters').innerHTML = state.active.map((vehicle) => `<div class="orbiter" style="${colorStyle(vehicle.color)};--phase:${vehicle.slot * -2.5}s"><span class="orbiter-foup">${symbols[vehicle.color]}</span></div>`).join('');
}

function renderSlots() {
  $('activeCount').textContent = state.active.length;
  $('activeSlots').innerHTML = Array.from({ length: SLOT_LIMIT }, (_, slot) => {
    const vehicle = state.active.find((item) => item.slot === slot);
    if (!vehicle) return `<div class="slot empty" data-slot="${slot}"><span class="empty-slot-symbol">＋</span><span>빈자리</span></div>`;
    return `<div class="slot occupied ${vehicle.load === CAPACITY ? 'is-full' : ''}" data-slot="${slot}" style="${colorStyle(vehicle.color)}"><div class="slot-top"><span class="slot-symbol">${symbols[vehicle.color]}</span><span class="slot-label">${COLORS[vehicle.color].name}행</span></div><div class="slot-foup"><div class="slot-fill" style="--fill:${vehicle.load / CAPACITY * 100}%"></div><i></i><i></i><i></i></div><strong class="slot-count">${vehicle.load}<small> / ${CAPACITY}</small></strong></div>`;
  }).join('');
}

function renderBoard() {
  const { cols, rows } = state.size;
  $('board').style.setProperty('--cols', cols);
  $('board').style.setProperty('--rows', rows);
  $('board').style.aspectRatio = `${cols} / ${rows}`;
  $('board').innerHTML = state.vehicles.map((vehicle) => {
    const horizontal = vehicle.dir === 'L' || vehicle.dir === 'R';
    const width = horizontal ? vehicle.length : 1;
    const height = horizontal ? 1 : vehicle.length;
    const blocked = getBlockers(state, vehicle.id).length > 0;
    const label = `${COLORS[vehicle.color].name}행 OHT ${vehicle.id}, ${directions[vehicle.dir]} 방향, ${blocked ? '앞이 막혀 있어요' : '꺼낼 수 있어요'}, 25장`;
    return `<button class="vehicle ${blocked ? 'is-blocked' : 'is-ready'}" data-id="${vehicle.id}" data-dir="${vehicle.dir}" style="${colorStyle(vehicle.color)};left:calc(${vehicle.x / cols * 100}% + 1px);top:calc(${vehicle.y / rows * 100}% + 1px);width:calc(${width / cols * 100}% - 2px);height:calc(${height / rows * 100}% - 2px)" aria-label="${label}" ${busy ? 'disabled' : ''}><span class="vehicle-hoist" aria-hidden="true"></span><span class="vehicle-body"><span class="vehicle-symbol" aria-hidden="true">${symbols[vehicle.color]}</span><span class="vehicle-arrow" aria-hidden="true">${arrows[vehicle.dir]}</span><span class="vehicle-capacity">25</span></span></button>`;
  }).join('') || '<div class="board-empty"><span>✦</span><b>길이 활짝 열렸어요!</b></div>';
  $('remainingCount').textContent = `${state.vehicles.length}대 대기`;
}

function render(message) {
  $('completedCount').textContent = state.completed;
  $('totalCount').textContent = `/ ${state.total}장`;
  $('progressFill').style.width = `${state.completed / state.total * 100}%`;
  $('progress').setAttribute('aria-valuenow', Math.round(state.completed / state.total * 100));
  renderScene();
  renderSlots();
  renderBoard();
  $('undoButton').disabled = busy || history.length === 0;
  $('hintButton').disabled = busy || state.status !== 'playing';
  if (message) $('statusText').textContent = message;
}

function pulseStage(color) {
  const factory = document.querySelector(`.factory[data-stage="${color}"]`);
  factory?.classList.add('pulse');
}

function flyWafers(step) {
  if (reducedMotion) return;
  const location = typeof step.from === 'string' ? step.from : (step.from?.location || 'input');
  const start = location === 'input' ? $('inputCrowd') : document.querySelector(`[data-location="${location}"]`);
  const end = document.querySelector(`.slot[data-slot="${step.slot}"]`);
  if (!start || !end) return;
  const a = start.getBoundingClientRect();
  const b = end.getBoundingClientRect();
  for (let index = 0; index < 10; index++) {
    const particle = document.createElement('i');
    particle.className = 'flying-wafer';
    particle.style.background = COLORS[step.color].hex;
    particle.style.left = `${a.left + a.width * (0.3 + Math.random() * 0.4)}px`;
    particle.style.top = `${a.top + a.height / 2}px`;
    $('particles').append(particle);
    const x = b.left + b.width / 2 - parseFloat(particle.style.left);
    const y = b.top + b.height / 2 - parseFloat(particle.style.top);
    const animation = particle.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${x / 2}px,${y / 2 - 24}px) scale(1.2)`, opacity: 1 }, { transform: `translate(${x}px,${y}px) scale(.3)`, opacity: 0 }], { duration: 390, delay: index * 18, easing: 'ease-in-out' });
    animation.onfinish = () => particle.remove();
  }
}

function confetti() {
  if (reducedMotion) return;
  for (let index = 0; index < 32; index++) {
    const particle = document.createElement('i');
    particle.className = 'confetti';
    particle.style.background = COLORS[index % COLORS.length].hex;
    particle.style.left = `${20 + Math.random() * 60}vw`;
    particle.style.top = '-20px';
    $('particles').append(particle);
    const animation = particle.animate([{ transform: 'translate(0,0) rotate(0deg)', opacity: 1 }, { transform: `translate(${Math.random() * 140 - 70}px,90vh) rotate(${Math.random() * 900}deg)`, opacity: 0 }], { duration: 1700 + Math.random() * 1100, delay: Math.random() * 200 });
    animation.onfinish = () => particle.remove();
  }
}

function stepMessage(step, deliveries) {
  const name = COLORS[step.color]?.name || '';
  if (step.type === 'dispatch') return `${name}행 출발! 같은 색 웨이퍼를 찾아요.`;
  if (step.type === 'load') return `${name}행 ${CAPACITY}장 만차! 공정으로 이동해요.`;
  if (step.type === 'deliver') return `${name} 장비에 도착했어요.`;
  if (step.type === 'process') {
    const index = state.route.indexOf(step.color);
    return `${name} 완료 → ${COLORS[state.route[index + 1]]?.name || '다음 공정'}행 웨이퍼가 나왔어요!`;
  }
  if (step.type === 'complete') return `${CAPACITY}장 출고! ${deliveries > 1 ? `${deliveries}연쇄 Lot 아웃!` : 'Lot 아웃!'}`;
  return '다음 OHT를 골라 주세요.';
}

async function chooseVehicle(id) {
  if (busy || state.status !== 'playing') return;
  const vehicle = state.vehicles.find((item) => item.id === id);
  if (!vehicle) return;
  const blockers = getBlockers(state, id);
  if (blockers.length) {
    const button = [...document.querySelectorAll('.vehicle')].find((node) => node.dataset.id === id);
    button?.classList.add('is-shaking');
    setTimeout(() => button?.classList.remove('is-shaking'), 400);
    for (const blocker of blockers) {
      const element = [...document.querySelectorAll('.vehicle')].find((node) => node.dataset.id === blocker);
      element?.classList.add('is-obstacle');
      setTimeout(() => element?.classList.remove('is-obstacle'), 1000);
    }
    notice('화살표 앞의 OHT를 먼저 꺼내 주세요.');
    tone('blocked');
    return;
  }
  const result = dispatch(state, id);
  if (!result.ok) { notice(result.reason || '지금은 출발할 수 없어요.'); return; }
  history.push(structuredClone(state));
  busy = true;
  const token = ++runToken;
  let deliveries = 0;
  tone('dispatch');
  for (const step of result.steps) {
    if (token !== runToken) return;
    state = step.state;
    if (step.type === 'process' || step.type === 'complete') deliveries++;
    render(stepMessage(step, deliveries));
    if (step.type === 'load') { flyWafers(step); tone('load', deliveries); }
    if (step.type === 'process' || step.type === 'complete') { pulseStage(step.color); tone('complete', deliveries); }
    $('chainBadge').hidden = deliveries < 2;
    if (deliveries >= 2) $('chainBadge').textContent = `${deliveries}연쇄 · Lot 아웃!`;
    await new Promise((resolve) => setTimeout(resolve, reducedMotion ? 90 : step.type === 'load' ? 580 : step.type === 'deliver' ? 260 : step.type === 'dispatch' ? 220 : 460));
  }
  if (token !== runToken) return;
  state = result.state;
  busy = false;
  let message = deliveries ? `${deliveries}대가 공정을 이었어요. 다음 길도 열어 보세요!` : `${COLORS[vehicle.color].name}행이 기다려요. 이 색을 만들어 줄 공정을 보내 주세요.`;
  if (state.status === 'won') message = '모든 웨이퍼가 마지막 공정을 마쳤어요!';
  if (state.status === 'lost') message = '운행이 멈췄어요. 한 수 뒤로 가서 순서를 바꿔 보세요.';
  render(message);
  if (state.status !== 'playing') showResult();
}

function resetLevel(index = selected) {
  runToken++;
  busy = false;
  selected = index;
  history = [];
  state = createState(LEVELS[selected]);
  $('resultDialog').close();
  $('chainBadge').hidden = true;
  $('particles').replaceChildren();
  $('toast').hidden = true;
  renderLevels();
  render(LEVELS[selected].subtitle || LEVELS[selected].intro || '화살표 방향이 열린 OHT를 눌러 주세요.');
  const url = new URL(location.href);
  url.searchParams.set('level', selected + 1);
  window.history.replaceState(null, '', url);
}

function undo() {
  if (busy || !history.length) return;
  runToken++;
  state = history.pop();
  $('resultDialog').close();
  $('chainBadge').hidden = true;
  render('한 수 되돌렸어요. 다른 순서로 길을 열어 보세요.');
}

function showResult() {
  const won = state.status === 'won';
  if (won) {
    if (!cleared.includes(LEVELS[selected].id)) cleared.push(LEVELS[selected].id);
    try { localStorage.setItem('foup-jam-cleared', JSON.stringify(cleared)); } catch { /* Play works without storage. */ }
    renderLevels();
    confetti();
  }
  $('resultIcon').textContent = won ? '✦' : '↶';
  $('resultKicker').textContent = won ? `STAGE ${selected + 1} CLEAR` : '다른 순서도 있어요';
  $('resultTitle').textContent = won ? '라인이 활짝 열렸어요!' : '잠깐, 라인 정지!';
  $('resultDescription').textContent = won ? `${state.total}장의 웨이퍼를 ${state.moves}번의 선택으로 완성했어요.${selected === LEVELS.length - 1 ? ' 세 가지 판을 다른 순서로도 도전해 보세요.' : ' 다음 판에서는 한 수 더 앞을 생각해 보세요.'}` : '아직 없는 색을 기다리느라 다음 OHT가 나오지 못해요. 한 수 되돌리고, 지금 웨이퍼가 있는 색을 보내 보세요.';
  $('resultPrimary').textContent = won ? (selected < LEVELS.length - 1 ? '다음 스테이지 →' : '스테이지 1부터 다시') : '한 수 뒤로 가기 ↶';
  $('resultSecondary').textContent = won ? '이 판 다시 플레이' : '처음부터 다시';
  $('resultPrimary').onclick = () => won ? resetLevel((selected + 1) % LEVELS.length) : undo();
  $('resultSecondary').onclick = () => resetLevel();
  $('resultDialog').showModal();
}

$('board').addEventListener('click', (event) => {
  const vehicle = event.target.closest('.vehicle');
  if (vehicle) chooseVehicle(vehicle.dataset.id);
});
$('levelButtons').addEventListener('click', (event) => {
  const button = event.target.closest('[data-level]');
  if (button) resetLevel(Number(button.dataset.level));
});
$('undoButton').addEventListener('click', undo);
$('restartButton').addEventListener('click', () => resetLevel());
$('helpButton').addEventListener('click', () => $('helpDialog').showModal());
$('hintButton').addEventListener('click', () => {
  if (busy || state.status !== 'playing') return;
  const suggestion = hint(state);
  if (!suggestion) { notice('이 순서로는 막혀요. 한 수 뒤로 가서 다시 생각해 보세요.'); return; }
  const button = [...document.querySelectorAll('.vehicle')].find((element) => element.dataset.id === suggestion.id);
  button?.classList.add('is-hint');
  notice(suggestion.message || '반짝이는 OHT부터 꺼내 보세요.');
  setTimeout(() => button?.classList.remove('is-hint'), 3000);
});
$('soundButton').addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  $('soundButton').setAttribute('aria-pressed', String(soundEnabled));
  $('soundButton').setAttribute('aria-label', soundEnabled ? '효과음 끄기' : '효과음 켜기');
  notice(soundEnabled ? '효과음을 켰어요.' : '효과음을 껐어요.');
  if (soundEnabled) tone('complete');
});
for (const dialog of document.querySelectorAll('dialog')) {
  dialog.addEventListener('click', (event) => { if (event.target === dialog) { const bounds = dialog.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close(); } });
}
resetLevel();
