// 돈: 상대값 토큰·연말 결산·집·주식 간단형 (담당: Claude, DOM 없음) — ECONOMY 0.1·1·3·4·6·7 줄인 판

import { clamp, hasTrait, addFlag, addLog, addSemi, statusOf, warnOnce } from './core.js';
import { yearIncome, baseSalary } from './career.js';
import { wealthGrade } from './health.js';

// ---------- 상대값 토큰 (SPEC 돈 상대값, ECONOMY 1절) ----------
export function roundMoney(x) {
  const a = Math.abs(x);
  if (a < 1000) return Math.round(x * 100) / 100;
  const p = Math.pow(10, Math.floor(Math.log10(a)) - 2);
  return Math.round(x / p) * p;
}

export function tokenValue(L, name) {
  const { s, W } = L;
  const y = s.year;
  const e = W.econ(y);
  const avg = e.avg_wage;
  const minw = e.min_wage ?? (avg / 12) * 0.25 / 209;
  switch (name) {
    case 'avg_wage': return avg;
    case 'avg_wage_month': return avg / 12;
    case 'salary': return currentSalary(L);
    case 'income': return s.money.last?.income || avg * 0.5;
    case 'min_wage': return minw;
    case 'min_wage_month': return minw * 209;
    case 'min_wage_year': return minw * 209 * 12;
    case 'house_seoul': return e.house_seoul;
    case 'house_local': return e.house_local;
    case 'house': return W.housePrice(s.profile.region, y);
    case 'house_mine': return s.money.houses[0]?.value ?? W.housePrice(s.profile.region, y);
    case 'rent_month': return W.housePrice(s.profile.region, y) * 0.003;
    case 'krw26': return e.cpi / W.econ(2026).cpi;
    case 'cash': return Math.max(0, s.money.cash);
    case 'networth': return Math.max(0, networth(L));
    case 'allowance': return allowance(L);
    case 'living': return essentialLiving(L);
    default: return null;
  }
}
// "@salary*-0.4" → 원 (없는 토큰이면 null)
export function resolveMoney(L, v) {
  if (typeof v === 'number') return v;
  const m = /^(-?)@([a-z_0-9]+)(?:\*(-?\d+(?:\.\d+)?))?$/.exec(String(v).trim());
  if (!m) { warnOnce(`money-${v}`, `알 수 없는 돈 값: ${v}`); return null; }
  const base = tokenValue(L, m[2]);
  if (base === null) { warnOnce(`money-${m[2]}`, `지원하지 않는 돈 토큰: @${m[2]}`); return null; }
  return roundMoney((m[1] ? -1 : 1) * base * (m[3] !== undefined ? Number(m[3]) : 1));
}

export function currentSalary(L) {
  const { s, W } = L;
  const c = s.career;
  if (c.job && !c.leave) return c.salary || baseSalary(L, c);
  if (s.retired && s.money.pension) return s.money.pension;
  return W.econ(s.year).avg_wage * 0.5;
}

// 4.3 용돈
export function allowance(L) {
  const { s, W } = L;
  const age = s.age;
  const A = age < 7 ? 0 : age <= 9 ? 0.004 : age <= 12 ? 0.008 : age <= 15 ? 0.02 : age <= 19 ? 0.03 : s.education.stage ? 0.08 : 0;
  const WF = [0, 0.3, 0.6, 1, 1.6, 3][s.profile.family.wealth] ?? 1;
  return W.econ(s.year).avg_wage * A * WF * (s.year < 1970 ? 0.5 : 1);
}

const livesWithParents = (s) => s.age < 19 || (s.education.stage && s.age < 24 && !s.relations.partner?.married) || (s.age < 27 && !s.career.job && !s.relations.partner?.married);
const regionCost = (L) => {
  const { s, D } = L;
  if (s.career.region === 'overseas' && s.career.job) return 1.3;
  const r = s.profile.region;
  if (r === 'seoul') return 1.15;
  if (r === 'rural') return 0.85;
  return D.regions.get(r)?.area === 'capital' ? 1.05 : 1;
};
// 4.1 꼭 써야 하는 돈 F
export function essentialLiving(L) {
  const { s, W } = L;
  const e = W.econ(s.year);
  const adults = s.relations.partner?.married ? 1 : 0;
  // 4.1의 eq에는 자녀(+0.3)가 들어 있지만 4.2 양육비와 겹쳐서, 자녀 몫은 양육비로만 셉니다
  let F = e.avg_wage * 0.28 * (1 + 0.5 * adults) * regionCost(L);
  if (s.age >= 60) F += e.avg_wage * 0.02 * (s.age - 60) / 10;
  if (hasTrait(s, 'thrift', '+')) F *= 0.85;
  if (hasTrait(s, 'thrift', '-')) F *= 1.2;
  return F;
}

export function networth(L) {
  const m = L.s.money;
  return m.cash + m.houses.reduce((a, h) => a + h.value, 0) + Object.values(m.stocks).reduce((a, h) => a + h.value, 0) - m.debt;
}

// 3.7 실효세율
function taxRate(x, y) {
  const pts = [[0.5, 0.05], [1, 0.11], [2, 0.19], [4, 0.27], [8, 0.34]];
  let t;
  if (x <= 0.5) t = 0.05;
  else if (x >= 8) t = 0.34;
  else {
    let i = 1;
    while (pts[i][0] < x) i++;
    const [x0, t0] = pts[i - 1];
    const [x1, t1] = pts[i];
    t = t0 + ((t1 - t0) * Math.log(x / x0)) / Math.log(x1 / x0);
  }
  return y < 1977 ? Math.max(0, t - 0.02) : t;
}

// ---------- ⑥ 연말 결산 (ECONOMY 0.1 줄인 순서) ----------
export function settleYear(L) {
  const { s, W, rng } = L;
  const y = s.year;
  const e = W.econ(y);
  const m = s.money;
  const avg = e.avg_wage;

  // 1) 소득
  const { base, bonus } = yearIncome(L);
  let income = base + bonus;
  if (s.career.job && !s.career.leave) {
    s.career.salary = s.career.employment === 'owner' || s.career.employment === 'daily' ? base : (s.career.salary || base);
    m.best_salary_ratio = Math.max(m.best_salary_ratio ?? 0, (base + bonus) / avg);
    // 반도체 회사 첫 성과급 대박 (7장 자동 순간)
    const co = W.co(s.career.company);
    if (co && co.c >= 2 && bonus > base * 0.3 && !s.flags.first_big_bonus && ['memory', 'foundry', 'fabless', 'equipment_global', 'equipment_korea', 'materials', 'packaging'].includes(co.sector)) {
      addFlag(s, 'first_big_bonus');
      addSemi(L, `${co.name} 성과급이 연봉의 절반 가까이 나왔어요`, 'money');
    }
  }
  if (statusOf(s) === 'military' && !s.career.job) income += avg * (y >= 2018 ? 0.12 : 0.03);
  // 부업: 원룸 임대
  if (s.career.side_jobs.includes('landlord')) income += e.house_local * 0.3 * 0.06 * (1 + 0.1 * (W.nearbyFab(s.profile.region)?.c ?? 0));
  // 맞벌이 배우자 (간단형: 20~60세, 평균 연봉의 55%)
  const pt = s.relations.partner;
  if (pt?.married) {
    const pa = y - pt.birth_year;
    if (pa >= 22 && pa < 60 && pt.job !== '살림') income += avg * 0.55;
  }
  // 연금 (간단형: 은퇴 뒤 수급 나이부터 평균 연봉 × 0.3 × 가입 비율) + 기초연금
  const pensionAge = e.pension_age ?? (s.profile.birth_year <= 1952 ? 60 : s.profile.birth_year <= 1968 ? 63 : 65);
  if (y >= 1988 && s.age >= pensionAge && (s.retired || !s.career.job)) {
    const yrs = Math.min(40, s.career.pension_years ?? 0);
    m.pension = yrs >= 10 ? avg * 0.3 * yrs / 40 : 0;
    income += m.pension;
    if (y >= 2008 && s.age >= 65 && networth(L) < e.house_local * 1.5) income += (avg / 12) * 0.06 * 12;
  }
  if (s.career.job && !s.career.leave && y >= 1988) s.career.pension_years = (s.career.pension_years ?? 0) + 1;
  // 노후에 일하는 자녀가 주는 용돈 (4.3)
  if (s.age >= 60) income += avg * (y < 1990 ? 0.06 : 0.03) * s.relations.children.filter((ch) => ch.job && y - ch.birth_year >= 24).length;
  // 미성년·학생은 부모님이 생활비를 대고 용돈을 주심
  const withParents = livesWithParents(s);
  if (withParents) income += allowance(L);

  const tax = income * taxRate(income / avg, y);
  const net = income - tax;

  // 2) 지출 — 꼭 써야 하는 돈(생활비·양육비·주거비·빚 상환·이자)을 먼저, 남으면 성향(MPC)만큼 더 씁니다.
  //    모자라면 생활비·양육비를 최대 30%까지 줄이고(가난한 집의 실제 모습), 그래도 모자라면 빚이 됩니다.
  let spend = 0;
  let hardship = false;
  const interest = m.debt * (e.mortgage_rate ?? 6) / 100;
  if (!withParents) {
    const F = essentialLiving(L);
    const housing = m.houses.length ? 0 : W.housePrice(s.profile.region, y) * 0.025 * (s.relations.partner?.married ? 1 : 0.6);
    const kidsCost = s.relations.children.reduce((a, ch) => {
      const age = y - ch.birth_year;
      const r = age <= 6 ? 0.1 : age <= 12 ? 0.14 : age <= 18 ? 0.2 * (y >= 2010 ? 1.3 : y >= 1990 ? 1.2 : 1) : age <= 22 ? 0.18 : 0;
      return a + avg * r;
    }, 0);
    const debtService = m.debt * 0.05;
    const support = s.age >= 40 && s.profile.family.wealth <= 2 ? avg * 0.04 * s.relations.parents.filter((p) => p.alive).length : 0;
    const need = F + kidsCost + housing + debtService + interest + support;
    if (net >= need) spend = need + (net - need) * clamp(0.55 - s.traits.thrift / 250, 0.15, 0.95);
    else {
      const floor = need - 0.3 * (F + kidsCost + support) - 0.5 * housing; // 더 싼 집으로 옮기는 것까지
      const avail = net + Math.max(0, m.cash);
      spend = Math.max(floor, Math.min(need, avail));
      hardship = floor > avail;
    }
    m.debt = Math.max(0, m.debt - debtService);
  } else spend = allowance(L) * 0.8 + interest;

  // 3) 현금·예금 이자 4) 모자라면 빚으로
  m.cash += net - spend;
  if (m.cash > 0) m.cash += m.cash * (e.deposit_rate / 100) * 0.846;
  if (m.cash < 0) { m.debt += -m.cash; m.cash = 0; }
  if (hardship) { s.happiness = clamp(s.happiness - 5, 0, 100); s.stats.health = clamp(s.stats.health - 0.5, 0, 100); m.hardship_years = (m.hardship_years ?? 0) + 1; }
  // 빚이 감당 못 할 만큼 커지면 신용불량 → 개인회생으로 빚 일부 탕감 (ECONOMY 9장 간단형)
  if (m.debt > Math.max(income, avg) * 6) {
    if (!s.flags.credit_default) { addFlag(s, 'credit_default'); addLog(L, '빚이 너무 많아져 신용이 무너졌어요', 2, 'money'); }
    addFlag(s, 'personal_rehab');
    m.debt *= 0.4;
    addLog(L, '개인회생으로 빚의 일부를 덜었어요', 2, 'money');
  }

  // 5) 자산 재평가: 집값, 주식
  for (const h of m.houses) {
    const p0 = W.housePrice(h.region, y - 1);
    const p1 = W.housePrice(h.region, y);
    h.value *= (p1 / p0) * (1 + rng.gauss(0, 0.03));
  }
  const kret = kospiReturn(L, y);
  for (const [id, h] of Object.entries(m.stocks)) {
    if (id === 'index') { h.value *= 1 + kret; continue; }
    if (id === 'semi_index') { h.value *= Math.max(0.1, 1 + 0.6 * kret + 0.08 * W.index(y) + rng.gauss(0, 0.12)); continue; }
    const co = W.co(id);
    if (!co || co.gone) {
      if (co?.acquirer) { h.value *= 1.1; continue; }
      h.value = 0;
      addFlag(s, 'delisted_loss');
      delete m.stocks[id];
      continue;
    }
    const sig = [0, 0.13, 0.16, 0.2, 0.25, 0.3][co.attrs.growth] * (co.attrs.stability >= 4 ? 0.85 : 1);
    const r = clamp(0.6 * kret + 0.15 * W.score(co.sector, y) / 2 + 0.1 * co.c + rng.gauss(0, sig), -0.9, 4);
    h.value *= 1 + r;
  }
  const nw = networth(L);
  m.networth = nw;
  m.last = { income, spend, networth: nw };
  m.best_networth_ratio = Math.max(m.best_networth_ratio ?? 0, nw / avg);
  return m.last;
}

function kospiReturn(L, y) {
  const { W, rng } = L;
  const k1 = W.econ(y).kospi;
  const k0 = W.econ(y - 1).kospi;
  if (k1 && k0) return k1 / k0 - 1;
  return rng.gauss(0.1 + 0.08 * W.macro(y), 0.25);
}

// ---------- 집 (house_chance 트리거, do house:*) ----------
export function houseChance(L, triggers) {
  const { s, W, rng } = L;
  if (s.money.houses.length || s.age < 27 || livesWithParents(s)) return;
  const price = W.housePrice(s.profile.region, s.year);
  if (s.money.cash < price * 0.25) return;
  if (rng.chance(0.25 * (s.relations.partner?.married ? 1.5 : 1))) triggers.set('house_chance', {});
}
export function doHouse(L, arg) {
  const { s, W } = L;
  const m = s.money;
  if (arg === 'buy' || arg === 'buy_small') {
    const region = s.profile.region;
    const value = W.housePrice(region, s.year) * (arg === 'buy_small' ? 0.6 : 1);
    const down = Math.min(Math.max(0, m.cash), value * 1.03);
    m.cash -= down;
    const loan = Math.max(0, value * 1.03 - down);
    m.debt += loan;
    m.houses.push({ region, bought_year: s.year, price: value, value, small: arg === 'buy_small' });
    addFlag(s, 'first_house');
    addLog(L, `${arg === 'buy_small' ? '작은 ' : ''}집을 샀어요`, 2, 'money');
    return;
  }
  if (arg === 'sell') {
    const h = m.houses.shift();
    if (!h) return;
    m.cash += h.value * 0.97;
    const repay = Math.min(m.debt, m.cash);
    m.debt -= repay;
    m.cash -= repay;
    addLog(L, '집을 팔았어요', 2, 'money');
    return;
  }
  warnOnce(`do-house-${arg}`, `지원하지 않는 do: house:${arg}`);
}

// ---------- 주식 간단형 (do invest:*) ----------
// "요즘 뜨는 회사": 최근 2년 c 합이 가장 큰 회사, 반도체 회사 재직 중이면 50% 확률로 내 회사
export function hotCompany(L) {
  const { s, W, rng } = L;
  const mine = W.co(s.career.company);
  if (mine && !mine.gone && ['memory', 'foundry', 'fabless', 'equipment_global', 'equipment_korea', 'materials', 'packaging'].includes(mine.sector) && rng.chance(0.5)) return mine;
  const list = W.allAlive().filter((c) => !['construction', 'catering', 'security'].includes(c.sector));
  const sc = (c) => c.hist.slice(-2).reduce((a, [, v]) => a + v, 0);
  return list.reduce((a, b) => (sc(b) > sc(a) ? b : a), list[0]);
}
export function doInvest(L, args, ctx) {
  const { s } = L;
  const m = s.money;
  const [target, ratioStr] = args;
  if (target === 'sell_all') {
    let sum = 0;
    for (const h of Object.values(m.stocks)) sum += h.value;
    m.cash += sum;
    m.stocks = {};
    return;
  }
  const ratio = clamp(Number(ratioStr) || 0, 0, 1);
  const amount = Math.max(0, m.cash) * ratio;
  if (amount <= 0) return;
  let id = target === 'semi_index' ? 'semi_index' : target === 'index' ? 'index' : null;
  if (target === 'company') id = ctx.company ?? hotCompany(L)?.id;
  if (!id) { warnOnce(`do-invest-${target}`, `지원하지 않는 do: invest:${target}`); return; }
  m.cash -= amount;
  const h = (m.stocks[id] ??= { value: 0, cost: 0, since: s.year });
  h.value += amount;
  h.cost += amount;
  if (!s.flags.first_semi_stock) {
    addFlag(s, 'first_semi_stock');
    if (!ctx.semiAdded) addSemi(L, '처음으로 반도체 주식을 샀어요', 'money');
  }
}

export { wealthGrade };
