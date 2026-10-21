// 화면 그리기 (담당: Claude)
// index.html의 계약된 요소(docs/UI_CONTRACT.md)에 글자와 data-속성만 채웁니다. 모양은 전부 CSS 몫입니다.

import { won, wonSigned, scoreWord } from './format.js';
import { STATS, AXES, TRAIT_NAMES, KIND_NAMES, stageName, statusOf, activeTraits, clamp } from './core.js';
import { jobName, rankName } from './career.js';
import { stageLabel, TRACK_NAMES } from './school.js';

const $ = (id) => document.getElementById(id);
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined && text !== null) e.textContent = text;
  return e;
}
const WEALTH = ['', '매우 어려움', '어려움', '보통', '여유', '부유'];
const MKT_NAMES = { cycle: '업계', memory: '메모리', logic_foundry: '로직', equipment: '장비', korea: '한국' };
const GENDER = { m: '남', f: '여' };

// ---------- 공통 ----------
export function showScreen(name) {
  for (const sec of document.querySelectorAll('.screen')) sec.hidden = sec.id !== `screen-${name}`;
  document.body.dataset.screen = name;
  window.scrollTo(0, 0);
}
export function toast(text, tone = '') {
  const t = el('div', 'toast', text);
  t.dataset.tone = tone;
  const stack = $('toast-stack');
  stack.append(t);
  while (stack.children.length > 2) stack.firstElementChild.remove(); // 빨리 넘길 때 화면을 덮지 않게 2개까지만
  setTimeout(() => t.remove(), 3500);
}
export function showTitle({ save, error }) {
  $('continue-info').hidden = !save;
  $('btn-continue').hidden = !save;
  if (save) $('continue-info').textContent = `${save.profile.name} · ${save.age}세 · ${save.year}년`;
  $('title-error').hidden = !error;
  $('title-error').textContent = error ?? '';
}

// ---------- 캐릭터 만들기 ----------
export function renderYearInfo(year, headline, worldSeed) {
  $('year-value').textContent = `${year}년`;
  $('create-headline').textContent = headline || '조용한 해였어요.';
  $('create-world').hidden = !worldSeed;
  $('create-world').textContent = worldSeed ? `같은 세계(시드 ${worldSeed})에서 새 인생을 시작해요` : '';
}
export function renderCandidates(D, list, selected, birthYear) {
  const ul = $('candidate-list');
  ul.replaceChildren();
  list.forEach((c, i) => {
    const li = el('li', 'candidate');
    li.dataset.index = String(i);
    li.dataset.selected = String(i === selected);
    li.tabIndex = 0;
    li.setAttribute('role', 'button');
    const reg = D.regions.get(c.region);
    const fab = reg?.fab_since && reg.fab_since <= birthYear;
    const head = el('div', 'candidate__head');
    head.append(el('span', null, `${GENDER[c.gender]} · ${reg?.name ?? ''}`), el('span', fab ? 'semi-mark' : null, fab ? '공장 동네' : ''));
    const parent = (p, who) => {
      const s = el('span');
      s.append(`${who} `, el('b', null, p.job));
      if (p.semi) s.append(el('span', 'semi-mark', ' ★반도체'));
      return s;
    };
    const l1 = el('p', 'candidate__line');
    l1.append(parent(c.father, '아버지'), ' · ', parent(c.mother, '어머니'));
    const l2 = el('p', 'candidate__line');
    l2.append('형편 ', el('b', null, WEALTH[c.wealth]), ` · 화목 `, el('b', null, String(c.harmony)), ` · 형제 `, el('b', null, `${c.siblings}명`), ' · 재능 ', el('b', null, '???'));
    const st = el('div', 'candidate__stats');
    for (const k of STATS) st.append(el('span', null, `${D.char.stats.find((x) => x.id === k)?.name ?? k} ${c.stats[k]}`));
    li.append(head, l1, l2, st);
    ul.append(li);
  });
  $('btn-start').disabled = selected < 0;
}

// ---------- 메인 ----------
export function renderHud(L, speed, paused) {
  const { s } = L;
  $('life-name').textContent = s.profile.name;
  $('life-age').textContent = `${s.age}세`;
  $('life-year').textContent = `${s.year}년`;
  $('life-stage').textContent = stageName(s.stage);
  document.body.dataset.stage = s.stage ?? '';
  document.body.dataset.speed = String(speed);
  document.body.dataset.paused = String(paused);
  for (const b of document.querySelectorAll('.speed-btn')) b.dataset.active = String(b.dataset.speed === String(speed));
}
export function renderProgress(p) { $('year-progress').style.setProperty('--p', clamp(p, 0, 1).toFixed(3)); }
export function renderHeadline(text) { $('headline').textContent = text ? `뉴스 · ${text}` : ''; }

export function statusText(L) {
  const { s, W, D } = L;
  const st = statusOf(s);
  const e = s.education;
  switch (st) {
    case 'student':
      if (e.stage === 'retry') return '재수 중이에요';
      return `${stageLabel(e.stage, s.year, e.track)} ${e.years_in}학년${s.career.job ? ` · ${jobName(L)}` : ''}`;
    case 'military': return `군 복무 중 (${{ army: '현역', officer: '장교', industrial: '산업기능요원', research: '전문연구요원' }[s.military.type] ?? ''})`;
    case 'employed': {
      const co = W.co(s.career.company);
      const rank = rankName(L);
      const emp = D.employmentNames[s.career.employment] ?? '';
      return `${co ? `${co.name} · ` : ''}${jobName(L)}${rank ? ` · ${rank}` : ''} (${emp})${s.career.region === 'overseas' ? ' · 해외 근무' : ''}`;
    }
    case 'owner': return `${jobName(L)} · ${rankName(L) || '사장'}`;
    case 'unemployed': return '일자리를 찾는 중이에요';
    case 'retired': return s.career.side_jobs.length ? `은퇴 · ${s.career.side_jobs.map((j) => D.jobById.get(j)?.name).join(', ')}` : '은퇴해서 쉬는 중이에요';
    case 'child': return s.age <= 6 ? '무럭무럭 자라는 중이에요' : '집에서 지내요';
    default: return '';
  }
}
export function renderStatus(L) {
  const { s, W } = L;
  $('status-line').textContent = statusText(L);
  const y = s.year;
  const m = s.money;
  const stocks = Object.values(m.stocks).reduce((a, h) => a + h.value, 0);
  if (s.age < 15 && m.cash < 1 && !m.debt) { $('money-line').textContent = '용돈은 부모님이 챙겨 주세요'; }
  const parts = [`현금 ${won(m.cash, y)}`];
  if (m.debt > 0) parts.push(`빚 ${won(m.debt, y)}`);
  if (m.houses.length) parts.push(`집 ${m.houses.length}채`);
  if (stocks > 0) parts.push(`주식 ${won(stocks, y)}`);
  const coins = Object.values(m.coins ?? {}).reduce((a, v) => a + v, 0);
  if (coins > 0) parts.push(`코인 ${won(coins, y)}`);
  const co = W.co(s.career.company);
  if (co && s.career.job) parts.push(`회사 실적 ${scoreWord(co.c)}`);
  if (!(s.age < 15 && m.cash < 1 && !m.debt)) $('money-line').textContent = parts.join(' · ');
  for (const li of document.querySelectorAll('#stat-list .stat')) {
    const k = li.dataset.stat;
    const v = Math.round(k === 'happiness' ? s.happiness : s.stats[k]);
    li.querySelector('.stat__bar').style.setProperty('--v', String(v));
    li.querySelector('.stat__value').textContent = String(v);
  }
}

// 연표 피드: 새 항목만 위에 붙입니다
let feedCount = 0;
export function renderFeed(L, reset = false) {
  const ol = $('feed');
  const log = L.s.log;
  if (reset || feedCount > log.length) { ol.replaceChildren(); feedCount = Math.max(0, log.length - 150); }
  const items = log.slice(feedCount);
  for (const x of items) ol.prepend(feedItem(x, !reset));
  feedCount = log.length;
  while (ol.children.length > 200) ol.lastChild.remove();
}

// 연표 한 줄. 사건 선택이면 "질문 요약 → 내 선택 → 결과"를 나눠 그림
function feedItem(x, isNew) {
  const li = el('li', 'feed-item');
  li.dataset.importance = String(x.importance);
  li.dataset.kind = x.kind ?? '';
  li.dataset.new = String(isNew);
  if (x.later) li.dataset.later = 'true';
  li.append(el('span', 'feed-item__when', `${x.year} · ${x.age}세`));
  if (x.q !== undefined && x.pick !== undefined) {
    if (x.later) li.append(el('span', 'feed-item__tag', typeof x.later === 'number' ? `그때 그 선택… ${x.later}` : '그때 그 선택…'));
    li.append(el('span', 'feed-item__q', x.q), el('span', 'feed-item__arrow', ' → '), el('b', 'feed-item__pick', x.pick));
    if (x.res) li.append(el('span', 'feed-item__arrow', ' → '), el('span', 'feed-item__res', x.res));
  } else li.append(x.text);
  return li;
}

export function selectTab(tab) {
  for (const b of document.querySelectorAll('.tab')) b.setAttribute('aria-selected', String(b.dataset.tab === tab));
  for (const p of document.querySelectorAll('.panel')) p.hidden = p.dataset.tab !== tab;
}

function kv(pairs) {
  const dl = el('dl', 'kv');
  for (const [k, v] of pairs) if (v !== null && v !== undefined && v !== '') dl.append(el('dt', null, k), el('dd', null, String(v)));
  return dl;
}
export function renderPanel(L, tab) {
  if (tab === 'feed') return;
  const p = $(`panel-${tab}`);
  const fn = { me: panelMe, work: panelWork, family: panelFamily, industry: panelIndustry }[tab];
  if (fn) p.replaceChildren(...fn(L));
}

function panelMe(L) {
  const { s, D, W } = L;
  const e = s.education;
  const talent = D.char.hidden_talents.find((t) => t.id === s.talent?.id);
  const out = [el('h3', null, '나')];
  out.push(kv([
    ['성별', GENDER[s.profile.gender]],
    ['태어난 곳', `${D.regions.get(s.profile.birth_region)?.name ?? ''} (${s.profile.birth_year}년)`],
    ['사는 곳', `${D.regions.get(s.profile.region)?.name ?? ''}${W.nearFab(s.profile.region, s.year) ? ' · 공장 동네' : ''}`],
    ['집안 형편', WEALTH[s.profile.family.wealth]],
    ['학력', `${e.level}${e.stage ? ` (${stageLabel(e.stage, s.year, e.track)} 다니는 중)` : e.track ? ` · ${TRACK_NAMES[e.track]}` : ''}${e.major ? ` · ${D.majors.find((m) => m.id === e.major)?.name ?? ''}` : ''}${e.specialty_name ? ` · ${e.specialty_name} 전공` : ''}`],
    ['병역', s.profile.gender === 'm' ? ({ none: '아직', serving: '복무 중', done: '마침', exempt: '면제', deferred: '연기', officer_pending: '졸업 뒤 장교' }[s.military.status] ?? '') : null],
    ['숨은 재능', s.talent?.revealed ? talent?.name : '???'],
    ['건강', s.condition.length ? s.condition.map((c) => ({ hypertension: '고혈압', diabetes: '당뇨', cancer: '암', heart: '심혈관 질환', back_pain: '허리 디스크', depression: '우울증', dementia: '치매', injury: '부상' }[c.id])).join(', ') : '건강해요'],
    ['습관', s.habits.length ? s.habits.map((h) => ({ exercise: '운동', smoking: '흡연', drinking: '과음', checkup: '정기 검진' }[h] ?? h)).join(', ') : null],
  ]));
  out.push(el('h3', null, '성향'));
  for (const a of AXES) {
    const row = el('div', 'axis');
    row.dataset.on = s.traitsOn[a] ?? '';
    const track = el('span', 'axis__track');
    const dot = el('span', 'axis__dot');
    dot.style.setProperty('--x', String(Math.round(s.traits[a])));
    track.append(dot);
    row.append(el('span', 'axis__l', TRAIT_NAMES[a][0]), track, el('span', 'axis__r', TRAIT_NAMES[a][1]));
    out.push(row);
  }
  const tr = activeTraits(s);
  if (tr.length) {
    const ul = el('ul', 'trait-badges');
    for (const t of tr) ul.append(el('li', 'trait-badge', t.name));
    out.push(ul);
  }
  out.push(el('h3', null, `반도체 순간 ${s.semi.length}개`));
  const ul = el('ul', 'mini-list');
  for (const m of s.semi.slice(-6).reverse()) ul.append(el('li', null, `${m.year} · ${m.text} (${KIND_NAMES[m.kind] ?? ''})`));
  if (!s.semi.length) ul.append(el('li', null, '아직 없어요'));
  out.push(ul);
  return out;
}

function panelWork(L) {
  const { s, D, W } = L;
  const c = s.career;
  const y = s.year;
  const out = [el('h3', null, '일')];
  if (c.job) {
    const co = W.co(c.company);
    out.push(kv([
      ['직업', jobName(L)],
      ['회사', co ? `${co.name} (${D.sectorById.get(co.sector)?.name ?? ''})` : null],
      ['원청', W.companyName(c.client) || null],
      ['고용 형태', D.employmentNames[c.employment]],
      ['근무지', D.regions.get(c.region)?.name ?? null],
      ['직급', rankName(L) || null],
      ['근속', `${c.years}년 (총 경력 ${c.total_years ?? 0}년)`],
      ['평판', Math.round(c.reputation)],
      ['연봉', c.salary ? won(c.salary, y) : null],
      ['회사 실적', co ? `${scoreWord(co.c)} · 최근 ${co.hist.slice(-5).map(([, v]) => (v > 0 ? '+' : '') + v.toFixed(1)).join(' ')}` : null],
      ['부업', c.side_jobs.map((j) => D.jobById.get(j)?.name).join(', ') || null],
    ]));
  } else out.push(el('p', null, statusText(L)));
  const m = s.money;
  out.push(el('h3', null, '돈'));
  out.push(kv([
    ['현금', won(m.cash, y)],
    ['빚', m.debt > 0 ? won(m.debt, y) : '없음'],
    ['집', m.houses.length ? m.houses.map((h) => `${D.regions.get(h.region)?.name ?? ''} ${won(h.value, y)}`).join(', ') : '없음'],
    ['주식', Object.keys(m.stocks).length ? Object.entries(m.stocks).map(([id, h]) => `${id === 'semi_index' ? '반도체 지수' : id === 'index' ? '코스피' : W.companyName(id)} ${won(h.value, y)}${h.cost > 0 ? ` (${h.value >= h.cost ? '+' : '−'}${Math.abs(Math.round(100 * (h.value / h.cost - 1)))}%)` : ''}`).join(', ') : '없음'],
    ['코인', Object.values(m.coins ?? {}).some((v) => v > 0) ? `${Object.entries(m.coins).filter(([, v]) => v > 0).map(([k, v]) => `${{ btc: '비트코인', alt: '알트코인', meme: '잡코인' }[k] ?? k} ${won(v, y)}`).join(', ')}${m.coin_cost > 0 ? ` (넣은 돈 ${won(m.coin_cost, y)})` : ''}` : null],
    ['지난해 수입', m.last ? won(m.last.income, y - 1) : null],
    ['지난해 지출', m.last ? won(m.last.spend, y - 1) : null],
    ['순자산', won(m.networth ?? 0, y)],
    ['평균 연봉', won(W.econ(y).avg_wage, y)],
  ]));
  return out;
}

function panelFamily(L) {
  const { s, W } = L;
  const r = s.relations;
  const out = [el('h3', null, '연인·배우자')];
  if (r.partner) out.push(kv([['이름', r.partner.name], ['사이', r.partner.married ? '결혼' : '연애 중'], ['직업', `${r.partner.job}${r.partner.company ? ` (${W.companyName(r.partner.company)})` : ''}`], ['애정', Math.round(r.partner.love)]]));
  else out.push(el('p', null, '아직 없어요'));
  out.push(el('h3', null, `자녀 ${r.children.length}명${r.grandchildren ? ` · 손주 ${r.grandchildren}명` : ''}`));
  if (r.children.length) {
    const ul = el('ul', 'mini-list');
    for (const ch of r.children) ul.append(el('li', null, `${ch.name} (${s.year - ch.birth_year}세)${ch.job ? ` · ${ch.job}${ch.company ? ` @ ${W.companyName(ch.company)}` : ''}` : ''}${ch.semi ? ' ★반도체' : ''}`));
    out.push(ul);
  }
  out.push(el('h3', null, '부모님'));
  const ul = el('ul', 'mini-list');
  for (const p of r.parents) ul.append(el('li', null, `${p.role === 'father' ? '아버지' : '어머니'} · ${p.job}${p.semi ? ' ★반도체' : ''} · ${p.alive ? `${s.year - p.birth_year}세` : `${p.death_year}년 별세`}`));
  out.push(ul);
  out.push(kv([['친구', Math.round(r.friends)]]));
  return out;
}

function panelIndustry(L) {
  const { s, W, D } = L;
  const y = s.year;
  const out = [el('h3', null, `${y}년 시황`)];
  const row = W.marketRow(y);
  const mkt = el('div', 'mkt');
  for (const k of Object.keys(MKT_NAMES)) {
    const v = row?.[k];
    const span = el('span', null, `${MKT_NAMES[k]} ${v === null || v === undefined ? '–' : (v > 0 ? '+' : '') + v}`);
    span.dataset.score = String(v ?? 0);
    mkt.append(span);
  }
  out.push(mkt);
  const h = W.headline(y);
  if (h) out.push(el('p', null, h));
  const mine = new Set([s.career.company, ...Object.keys(s.money.stocks)]);
  for (const sec of D.sectors.filter((x) => !x.follows)) {
    const list = W.ws.order.map((id) => W.ws.co[id]).filter((c) => c.sector === sec.id && c.on);
    if (!list.length) continue;
    out.push(el('h3', null, sec.name));
    for (const c of list.sort((a, b) => b.share - a.share)) {
      const r = el('div', 'share');
      r.dataset.mine = String(mine.has(c.id));
      r.dataset.gone = String(!!c.gone);
      const bar = el('span', 'share__bar');
      bar.style.setProperty('--s', String(Math.round(c.share * 100)));
      r.append(el('span', null, c.name), bar, el('span', null, c.gone ? (c.acquirer ? '인수' : '파산') : `${Math.round(c.share * 100)}%`));
      out.push(r);
    }
  }
  const tl = W.ws.timeline.filter((t) => t.kind !== 'founded' && t.year <= y).slice(-8).reverse();
  if (tl.length) {
    out.push(el('h3', null, '업계 연표'));
    const ul = el('ul', 'mini-list');
    for (const t of tl) ul.append(el('li', null, `${t.year} · ${t.text}`));
    out.push(ul);
  }
  return out;
}

// ---------- 사건 카드 ----------
export function showEvent(view) {
  $('event-layer').hidden = false;
  const card = $('event-card');
  card.dataset.size = view.big ? 'big' : 'small';
  card.dataset.phase = 'choose';
  card.dataset.id = view.id;
  document.body.dataset.event = view.big ? 'big' : 'small';
  card.dataset.later = String(!!view.later);
  $('event-kicker').textContent = view.kicker ?? (view.big ? '인생의 갈림길' : '');
  $('event-text').textContent = view.text;
  const box = $('event-choices');
  box.replaceChildren();
  for (const c of view.choices) {
    const b = el('button', 'choice');
    b.type = 'button';
    b.dataset.index = String(c.index);
    b.dataset.default = String(c.isDefault);
    b.dataset.check = c.check ? 'true' : 'false';
    b.append(el('span', 'choice__label', c.label));
    if (c.check) b.append(el('span', 'choice__check', c.check));
    box.append(b);
  }
  $('event-result').hidden = true;
  setTimer(1);
}
export function setTimer(t) { $('event-timer').style.setProperty('--t', clamp(t, 0, 1).toFixed(3)); }
export function showResult(out, year) {
  $('event-card').dataset.phase = 'result';
  $('event-result').hidden = false;
  $('event-result-text').textContent = out.result || '…';
  const chips = $('event-chips');
  chips.replaceChildren();
  for (const c of out.chips ?? []) {
    const sp = el('span', 'chip', c.money !== undefined ? `${c.label} ${wonSigned(c.money, year)}` : c.label);
    sp.dataset.tone = c.tone ?? '';
    chips.append(sp);
  }
  chips.hidden = !(out.chips ?? []).length;
  $('event-ok').focus({ preventScroll: true });
}
export function hideEvent() {
  $('event-layer').hidden = true;
  document.body.dataset.event = '';
}

// ---------- 엔딩 ----------
export function renderEnding(rv) {
  $('ending-line').textContent = rv.lastLine;
  $('ending-cause').hidden = !rv.causeLine;
  $('ending-cause').textContent = rv.causeLine ?? '';
  $('ending-title').textContent = rv.title;
  $('ending-ribbons').replaceChildren(...rv.ribbons.map((r) => el('li', 'ribbon', r)));
  $('ending-summary').hidden = !rv.summary;
  $('ending-summary').textContent = rv.summary ?? '';
  $('ending-score').textContent = `${rv.score}점`;
  $('score-bars').replaceChildren(...rv.bars.map((b) => {
    const li = el('li', 'bar');
    li.dataset.id = b.id;
    const f = el('span', 'bar__fill');
    f.style.setProperty('--v', String(b.value));
    li.append(el('span', null, b.name), f, el('span', null, String(b.value)));
    return li;
  }));
  const traits = rv.traits.map((t) => el('li', 'trait-badge', t.name));
  if (rv.longestTrait) traits.push(el('li', 'trait-badge', `가장 오래 간 특징: ${rv.longestTrait.name} (${rv.longestTrait.years}년)`));
  if (!traits.length) traits.push(el('li', 'trait-badge', '뚜렷한 특징 없이 두루두루'));
  $('ending-traits').replaceChildren(...traits);
  $('ending-trait-lines').hidden = !rv.traitLines?.length;
  $('ending-trait-lines').textContent = (rv.traitLines ?? []).join(' ');
  $('ending-semi').replaceChildren(...rv.semi.map((m) => {
    const li = el('li', 'semi-card');
    li.dataset.kind = m.kind;
    li.append(el('div', 'semi-card__meta', `${m.year}년 · ${m.age}세 · ${m.kindName} · 그 해 업계 ${m.market}`), el('div', 'semi-card__text', m.text));
    return li;
  }));
  const tlItem = (t) => {
    const li = el('li');
    li.dataset.mine = String(!!t.mine);
    li.append(el('span', 'timeline__year', t.age !== undefined ? `${t.year} · ${t.age}세` : `${t.year}`), t.text);
    return li;
  };
  $('ending-timeline').replaceChildren(...rv.timeline.map(tlItem));
  $('ending-industry').replaceChildren(...rv.industry.map((t) => tlItem({ ...t, text: t.text.replace(/^\d{4}년 /, '') })));
  $('ending-numbers').replaceChildren(...rv.numbers.flatMap((n) => [el('dt', null, n.label), el('dd', null, n.value)]));
  const ach = rv.achievements ?? [];
  $('ending-achievements').replaceChildren(...(ach.length ? ach.map((a) => {
    const li = el('li', 'ach');
    li.dataset.id = a.id;
    li.append(el('span', 'ach__when', `${a.year} · ${a.age}세`), el('span', 'ach__name', a.name));
    return li;
  }) : [el('li', 'ach ach--none', '이번 인생에서는 업적이 없었어요')]));
  $('ending-epitaph').hidden = !rv.epitaph;
  $('ending-epitaph').textContent = rv.epitaph ? `“${rv.epitaph}”` : '';
  $('ending-seed').textContent = `세계 시드 ${rv.seed}`;
}

