// 해마다 연표에 남길 짧은 줄 (담당: Claude, DOM 없음) — v0.2
// 사건이 없는 해도 "죽은 해"처럼 보이지 않게, 그 해에 실제로 일어난 일(가족 소식·근속·재산·집값·업황·세상 소식)을 한 줄 남깁니다.
// "학교에 다니며 한 해를 보냈어요" 같은 반복 문장은 학교 단계·직장마다 한 번만.

import { addLog, josa, statusOf } from './core.js';
import { paroText } from './world.js';
import { won } from './format.js';
import { stageLabel } from './school.js';

const SEMI_SECTORS = ['memory', 'foundry', 'fabless', 'equipment_global', 'equipment_korea', 'materials', 'packaging', 'construction'];
const NW_STEPS = [1e7, 1e8, 3e8, 5e8, 1e9, 3e9, 1e10];
const PARENT_AGES = { 60: '환갑', 70: '칠순', 80: '팔순', 90: '구순' };
const MY_AGES = { 30: '서른', 40: '마흔', 50: '쉰', 60: '환갑', 70: '칠순', 80: '팔순', 90: '구순', 100: '백 살' };

// 이 해에 이미 의미 있는 줄(중요도 1 이상, 반복 문장 제외)이 있나
export function hasMeaningful(s, year = s.year) {
  for (let i = s.log.length - 1; i >= 0; i--) {
    const x = s.log[i];
    if (x.year !== year) { if (x.year < year) break; continue; }
    if (x.importance >= 1 && x.kind !== 'quiet') return true;
  }
  return false;
}

// 연말(⑥ 뒤)에 부릅니다
export function chronicle(L) {
  const { s } = L;
  s.chron ??= { nw: -1, routine: {}, grade: {}, debt: 0, house: null };
  milestones(L);
  if (!hasMeaningful(s)) {
    const line = flavor(L);
    if (line) addLog(L, line.text, 1, line.kind);
    else routine(L);
  }
  s.chron.debt = s.money.debt;
}

// 늘 남기는 드문 소식들 (가족·근속·재산·빚·집값·업황)
function milestones(L) {
  const { s, W } = L;
  const y = s.year;
  const ch = s.chron;
  // 자녀
  for (const c of s.relations.children) {
    const a = y - c.birth_year;
    const nm = c.name;
    if (a === 7) addLog(L, `${josa(nm, '이', '가')} ${stageLabel('elem', y)}에 입학했어요. 가방이 몸보다 커 보여요`, 1, 'family');
    else if (a === 13) addLog(L, `${josa(nm, '이', '가')} 중학생이 됐어요. 방문을 닫기 시작했어요`, 1, 'family');
    else if (a === 16) addLog(L, `${josa(nm, '이', '가')} 고등학생이 됐어요`, 1, 'family');
    else if (a === 20) addLog(L, `${josa(nm, '이', '가')} 스무 살이 됐어요. 첫 술잔은 내가 따라 줬어요`, 1, 'family');
  }
  // 부모님 잔치
  for (const p of s.relations.parents) {
    if (!p.alive) continue;
    const a = y - p.birth_year;
    if (PARENT_AGES[a] && s.age >= 5) addLog(L, `${p.role === 'father' ? '아버지' : '어머니'} ${PARENT_AGES[a]} 잔치를 했어요`, 1, 'family');
  }
  // 결혼기념일
  const pt = s.relations.partner;
  if (pt?.married && pt.married_year) {
    const n = y - pt.married_year;
    if ([10, 25, 40, 50].includes(n)) addLog(L, `${josa(pt.name, '과', '와')} 결혼 ${n}주년이에요`, 1, 'family');
  }
  // 근속
  const c = s.career;
  if (c.job && !c.leave && c.company && [5, 10, 20, 30].includes(c.years)) {
    addLog(L, `${W.companyName(c.company)} 근속 ${c.years}년${c.years >= 10 ? ', 기념 금배지를 받았어요' : '이에요'}`, 1, 'work');
  }
  // 재산 문턱 (그 해 돈으로)
  const nw = s.money.networth ?? 0;
  let k = ch.nw;
  while (k + 1 < NW_STEPS.length && nw >= NW_STEPS[k + 1]) k++;
  if (k > ch.nw && s.age >= 20) addLog(L, `모은 재산이 처음으로 ${won(NW_STEPS[k], y)}을 넘었어요`, 1, 'money');
  ch.nw = Math.max(ch.nw, k);
  // 빚 다 갚음
  if (ch.debt >= W.econ(y).avg_wage * 0.3 && s.money.debt <= 0) addLog(L, '빚을 다 갚았어요! 통장이 가벼워진 대신 마음이 가벼워졌어요', 2, 'money');
  // 내 집 값
  const h = s.money.houses[0];
  if (h) {
    const p0 = W.housePrice(h.region, y - 1);
    const p1 = W.housePrice(h.region, y);
    const r = p1 / p0 - 1;
    if (h.bought_year < y && r >= 0.15) addLog(L, `우리 집 값이 올해 ${Math.round(r * 100)}% 올랐대요 (${won(h.value, y)})`, 1, 'money');
    else if (h.bought_year < y && r <= -0.1) addLog(L, `집값이 ${Math.round(-r * 100)}% 떨어졌대요. 대출 이자가 더 무겁게 느껴져요`, 1, 'money');
  }
  // 업황 (반도체 쪽 회사에 다니면)
  const co = c.job && !c.leave ? W.co(c.company) : null;
  if (co && SEMI_SECTORS.includes(co.sector)) {
    const m0 = Math.round(W.score(co.sector, y - 1));
    const m1 = Math.round(W.score(co.sector, y));
    const build = co.sector === 'construction';
    if (m1 >= 2 && m0 < 2) addLog(L, build ? '팹 증설 공사가 몰려 현장이 쉴 틈이 없어요' : '슈퍼사이클이 왔어요. 공장이 쉴 틈 없이 돌아가고 특근이 늘었어요', 1, 'work');
    else if (m1 <= -2 && m0 > -2) addLog(L, build ? '공사가 끊겨 현장이 한산해졌어요. 다음 일감 소식만 기다려요' : '불황이 왔어요. 회사에 감원 소문이 돌아요', 1, 'work');
    else if (m1 >= 1 && m0 <= -1) addLog(L, build ? '새 팹 공사 소식이 들려요. 일감이 다시 늘었어요' : '업황이 돌아섰어요. 다시 회식 자리가 늘었어요', 1, 'work');
  } else if (W.nearFab(s.profile.region, y) && s.age >= 8) {
    const c0 = Math.round(W.marketRow(y - 1)?.cycle ?? 0);
    const c1 = Math.round(W.marketRow(y)?.cycle ?? 0);
    if (c1 >= 2 && c0 < 2) addLog(L, '동네 반도체 공장이 밤새 불을 밝혀요. 호황이래요', 1, 'world');
    else if (c1 <= -2 && c0 > -2) addLog(L, '동네 반도체 공장 앞 식당들이 한산해졌어요. 불황이래요', 1, 'world');
  }
}

// 조용한 해에 고를 한 줄: 학교 성적(단계마다 한 번) → 내 나이 고비 → 세상 소식
function flavor(L) {
  const { s, W, D, rng } = L;
  const y = s.year;
  const e = s.education;
  if (s.age < 6) return null;
  if (e.stage && ['elem', 'middle', 'hs', 'college'].includes(e.stage) && !s.chron.grade[e.stage] && e.years_in >= 2) {
    s.chron.grade[e.stage] = y;
    const g = e.grade ?? 50;
    const where = stageLabel(e.stage, y, e.track);
    const t = g >= 80 ? '성적은 늘 상위권이에요. 선생님이 기대가 크대요' : g >= 60 ? '성적은 중상위권이에요. 친구들과도 잘 지내요'
      : g >= 40 ? '성적은 중간쯤이에요. 시험 기간마다 벼락치기를 해요' : '공부보다 다른 게 더 재밌어요. 성적표는 몰래 숨겼어요';
    return { text: `${where} ${t}`, kind: 'school' };
  }
  if (MY_AGES[s.age]) return { text: `${MY_AGES[s.age]}이 됐어요${s.age >= 60 ? '. 자식들이 상을 차려 줬어요' : s.age === 30 ? '. 서른 즈음에 노래가 남 얘기 같지 않아요' : ''}`, kind: 'life' };
  // 세상 소식: 일반 뉴스(패러디 이름) → 업계 헤드라인
  const news = D.newsByYear.get(y)?.headlines_ko ?? [];
  const pick = news.length ? news[Math.floor(rng.next() * news.length)] : y > 2026 ? W.headline(y) : null;
  if (pick) return { text: `세상 소식 · ${paroText(D, pick)}`, kind: 'world' };
  return null;
}

// 그래도 아무 일 없는 해: 반복 문장은 학교 단계·직장마다 한 번만 (중요도 0)
function routine(L) {
  const { s } = L;
  const st = statusOf(s);
  const key = st === 'student' ? `student:${s.education.stage}` : st === 'employed' || st === 'owner' ? `work:${s.career.company ?? s.career.job}` : st;
  if (s.chron.routine[key]) return;
  s.chron.routine[key] = s.year;
  const text = s.age <= 6 ? '무럭무럭 자랐어요' : st === 'student' ? (s.education.stage === 'retry' ? '재수하며 한 해를 보냈어요' : `${stageLabel(s.education.stage, s.year, s.education.track) || '학교'}에 다니며 한 해를 보냈어요`)
    : st === 'military' ? '복무하며 한 해를 보냈어요' : st === 'employed' || st === 'owner' ? '일하며 조용히 한 해를 보냈어요'
      : st === 'retired' ? '느긋하게 한 해를 보냈어요' : st === 'unemployed' ? '일자리를 찾으며 한 해를 보냈어요' : '조용히 한 해가 지나갔어요';
  addLog(L, text, 0, 'quiet');
}
