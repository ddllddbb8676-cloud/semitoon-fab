// 돈: 상대값 토큰·연말 결산·집·주식 간단형 (담당: Claude, DOM 없음) — ECONOMY 0.1·1·3·4·6·7 줄인 판

import { clamp, hasTrait, addFlag, addLog, addSemi, statusOf, warnOnce, josa } from './core.js';
import { yearIncome, baseSalary, updateSalary, rankName } from './career.js';
import { wealthGrade } from './health.js';
import { won, nowPay } from './format.js';

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

// 주식·펀드·코인 평가액 합
export function investValue(L) {
  const m = L.s.money;
  return Object.values(m.stocks ?? {}).reduce((a, h) => a + h.value, 0) + Object.values(m.coins ?? {}).reduce((a, v) => a + v, 0);
}
export function networth(L) {
  const m = L.s.money;
  return m.cash + m.houses.reduce((a, h) => a + h.value, 0) + investValue(L) - m.debt;
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

  // 1) 소득 — 연봉은 해마다 다시 계산 (평균 임금·호봉·직급·평판·회사 실적, career.updateSalary)
  const sal = updateSalary(L);
  const { base, bonus } = yearIncome(L);
  let income = base + bonus;
  m.last_pay = null;
  if (s.career.job && !s.career.leave) {
    if (s.career.employment === 'owner' || s.career.employment === 'daily') s.career.salary = base;
    m.best_salary_ratio = Math.max(m.best_salary_ratio ?? 0, (base + bonus) / avg);
    salaryLines(L, sal, base, bonus);
    const c = s.career;
    m.last_pay = { base, bonus, job: c.job, sub: c.sub, company: c.company, employment: c.employment, ladder: c.ladder, rank: c.rank, years: c.years, total: c.total_years ?? 0 };
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
    const tenureK = { monthly: 1.5, jeonse: 1, parents: 0.2, dorm: 0.3 }[m.tenure] ?? 1;
    const housing = m.houses.length ? 0 : W.housePrice(s.profile.region, y) * 0.025 * (s.relations.partner?.married ? 1 : 0.6) * tenureK;
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
    const v0 = h.value;
    h.cost ??= v0;
    h.since ??= y;
    if (id === 'index') h.value *= 1 + kret;
    else if (id === 'semi_index') h.value *= Math.max(0.1, 1 + 0.6 * kret + 0.1 * W.index(y) + rng.gauss(0, 0.12));
    else {
      const co = W.co(id);
      if (!co || co.gone) {
        if (co?.acquirer) { h.value *= 1.1; stockLine(L, id, h, 0.1); continue; }
        addLog(L, `${josa(holdingName(L, id), '이', '가')} 상장 폐지돼 휴지 조각이 됐어요`, 2, 'money');
        h.value = 0;
        addFlag(s, 'delisted_loss');
        delete m.stocks[id];
        continue;
      }
      const sig = [0, 0.13, 0.16, 0.2, 0.25, 0.3][co.attrs.growth] * (co.attrs.stability >= 4 ? 0.85 : 1);
      const r = clamp(0.6 * kret + 0.15 * W.score(co.sector, y) / 2 + 0.1 * co.c + rng.gauss(0, sig), -0.9, 4);
      h.value *= 1 + r;
    }
    stockLine(L, id, h, v0 > 0 ? h.value / v0 - 1 : 0);
  }
  settleCoins(L);
  const nw = networth(L);
  m.networth = nw;
  m.last = { income, spend, networth: nw };
  m.best_networth_ratio = Math.max(m.best_networth_ratio ?? 0, nw / avg);
  return m.last;
}

// ---------- 연봉 줄 (연표) ----------
const pctText = (x) => `${x >= 0 ? '+' : '−'}${Math.abs(100 * x).toFixed(1)}%`;
function salaryLines(L, sal, base, bonus) {
  const { s, W } = L;
  const y = s.year;
  const m = s.money;
  const c = s.career;
  const pick = (arr) => arr[y % arr.length];
  if (sal && !sal.fresh) {
    const wg = W.econ(y).avg_wage / W.econ(y - 1).avg_wage - 1;
    const pay = `${won(sal.next, y)}${nowPay(W, sal.next, y)}`;
    const p = pctText(sal.change);
    // 눈에 띄는 인상(평균 임금 상승률 +3%p 이상, 5% 이상)은 3년에 한 번까지, 15% 넘게 오르면 늘
    const big = sal.change >= Math.max(0.05, wg + 0.03) && (y - (c.salary_line_year ?? -99) >= 3 || sal.change >= 0.15);
    let line = null;
    // 은퇴 뒤 재취업(bridge)은 물가만 따라가요 — 승진·연봉 협상·삭감 줄을 쓰지 않음
    if (c.bridge) line = null;
    else if (sal.promoted && sal.change > 0.005) line = `${rankName(L)} 승진 뒤 첫 연봉: ${p} (${pay})`;
    else if (sal.moved && Math.abs(sal.change) > 0.005) line = `${sal.abroad ? '해외 근무 수당이 붙어' : '해외 근무를 마치며'} 연봉이 ${p} (${pay})`;
    else if (big) line = pick([`연봉 협상: ${p} (${pay})`, `올해 연봉이 ${p} 올라 ${pay}이 됐어요`, `인사 평가를 잘 받아 연봉 ${p} (${pay})`]);
    else if (sal.change < -0.005) line = `회사가 어려워 연봉이 ${p} 깎였어요 (${pay})`;
    else if (sal.frozen && sal.crisis && y - (c.salary_line_year ?? -99) >= 2) line = '회사 사정이 어려워 올해 연봉은 동결이에요';
    if (line) { addLog(L, line, 1, 'work'); c.salary_line_year = y; }
  }
  // 성과급: 처음 크게 나온 해, 크게 뛴 해, 아니면 몇 년에 한 번만
  const rate = base > 0 ? bonus / base : 0;
  const last = m.last_bonus_rate ?? 0;
  const gap = y - (m.bonus_line_year ?? -99);
  const pr = Math.round(100 * rate);
  const amt = won(bonus, y);
  let bl = null;
  if (rate >= 0.5 && (last < 0.5 || gap >= 3)) {
    bl = pick([`성과급이 연봉의 ${pr}%! 단톡방이 난리예요 (${amt})`, `성과급 ${pr}%가 찍혔어요. 통장 알림을 몇 번이나 다시 봤어요 (${amt})`, `역대급 성과급 ${pr}%! 회사 앞 고깃집이 예약으로 꽉 찼어요 (${amt})`]);
  } else if (rate >= 0.2 && rate < 0.5 && (last < 0.2 || rate - last >= 0.12 || gap >= 4)) {
    bl = rate >= 0.3
      ? pick([`성과급이 연봉의 ${pr}% 나왔어요. 회사 앞 고깃집이 꽉 찼어요`, `성과급 ${pr}%. 부모님 용돈을 조금 올려 드렸어요`, `성과급이 연봉의 ${pr}%예요. 다들 표정이 밝아요`])
      : pick([`성과급 연봉의 ${pr}%. 올해는 숨통이 좀 트여요`, `성과급이 ${pr}% 나왔어요. 카드값이 한결 가벼워요`]);
  } else if (last >= 0.3 && rate < 0.05) bl = `올해 성과급은 ${rate > 0 ? '쥐꼬리' : '0원'}이에요. 작년이 꿈 같아요`;
  if (bl) { addLog(L, bl, rate >= 0.5 ? 2 : 1, 'money'); m.bonus_line_year = y; }
  m.last_bonus_rate = rate;
}

// ---------- 주식 줄 (그때 산 주식이 몇 배, 반 토막) ----------
function holdingName(L, id) {
  if (id === 'semi_index') return '반도체주';
  if (id === 'index') return '코스피 펀드';
  return `${L.W.companyName(id) || '그 회사'} 주식`;
}
function stockLine(L, id, h, r) {
  const { s } = L;
  h.ret = r;
  if (h.value <= 0 || h.cost <= 0) return;
  const name = holdingName(L, id);
  const ratio = h.value / h.cost;
  const when = h.since && h.since < s.year ? `${h.since}년에 ` : '';
  for (const k of [10, 5, 3, 2]) {
    if (ratio >= k && (h.peak ?? 1) < k) {
      h.peak = k;
      addLog(L, `그때 ${when}산 ${josa(name, '이', '가')} ${k}배가 됐어요`, 2, 'money');
      return;
    }
  }
  if (r <= -0.4) addLog(L, `${josa(name, '이', '가')} 한 해 만에 반 토막 났어요 (${pctText(r)})`, 2, 'money');
  else if (ratio <= 0.5 && !h.halved) { h.halved = true; addLog(L, `${when}산 ${josa(name, '이', '가')} 산 값의 절반 아래로 떨어졌어요`, 1, 'money'); }
  else if (r >= 0.6) addLog(L, `${josa(name, '이', '가')} 올해 ${pctText(r)} 올랐어요`, 1, 'money');
}

// ---------- 코인 (coin_history.json, ECONOMY 14장 줄인 판) ----------
const COIN_NAMES = { btc: '비트코인', alt: '알트코인', meme: '잡코인' };
function coinTotal(m) { return Object.values(m.coins ?? {}).reduce((a, v) => a + v, 0); }
function sellCoins(m, share) {
  let got = 0;
  for (const k of Object.keys(m.coins)) { const v = m.coins[k] * share; m.coins[k] -= v; got += v; }
  m.coin_cost = (m.coin_cost ?? 0) * (1 - share);
  m.cash += got;
  if (share >= 1) m.coins = {};
  return got;
}
function settleCoins(L) {
  const { s, W, D, rng } = L;
  const m = s.money;
  const C = D.coin;
  const t0 = coinTotal(m);
  if (!C || t0 <= 0) { m.coin_ret = null; return; }
  const y = s.year;
  const B = C.behavior;
  const A = C.assets;
  const T = s.traits;
  const rb = W.btcReturn(y);
  const ret = { btc: rb };
  let moon = false;
  let crash = false;
  ret.alt = rng.chance(A.alt.crash_chance) ? A.alt.crash_return : Math.max(-0.99, rb * A.alt.beta + rng.gauss(0, A.alt.noise_sd));
  if (rng.chance(A.meme.crash_chance)) { ret.meme = A.meme.crash_return; crash = true; }
  else if (rng.chance(A.meme.moon_chance)) { ret.meme = A.meme.moon_return; moon = true; }
  else ret.meme = Math.max(-0.99, rb * A.meme.beta + rng.gauss(0, A.meme.noise_sd));
  const first = m.coin_buy_year === y;
  const memeShare = (m.coins.meme ?? 0) / t0;
  for (const k of Object.keys(m.coins)) {
    let r = (ret[k] ?? rb) + B.friction_per_year;
    if (first) r = r * B.late_entry.gain_factor + B.late_entry.penalty; // 소문 듣고 고점 근처에서 들어간 첫해
    m.coins[k] = Math.max(0, m.coins[k] * (1 + r));
  }
  let t1 = coinTotal(m);
  // 모험가: 레버리지 강제 청산
  if (T.risk > 40 && rng.chance(B.leverage.liquidation_chance * (rb < 0 ? 1.5 : 0.5))) {
    for (const k of Object.keys(m.coins)) m.coins[k] *= 1 + B.leverage.loss;
    t1 = coinTotal(m);
    addLog(L, '코인에 레버리지를 썼다가 강제 청산당했어요', 2, 'money');
  }
  const r = t1 / t0 - 1;
  m.coin_ret = r;
  const multi = (x) => (x >= 10 ? Math.round(x) : Math.round(x * 10) / 10);
  if (moon && memeShare >= 0.1) addLog(L, '산 잡코인이 한 해 만에 10배로 뛰었어요!', 2, 'money');
  else if (crash && memeShare >= 0.2) addLog(L, '들고 있던 잡코인이 상장 폐지됐어요', 2, 'money');
  if (r >= 1) addLog(L, `코인이 한 해 만에 ${multi(1 + r)}배가 됐어요`, 2, 'money');
  else if (r <= -0.75) addLog(L, `코인 값이 바닥을 뚫었어요 (${pctText(r)}). 앱을 지웠다 다시 깔았어요`, 2, 'money');
  else if (r <= -0.45) addLog(L, `코인이 반 토막 났어요 (${pctText(r)})`, 2, 'money');
  // 짠돌이: 두 배 오르면 40% 익절
  if (T.thrift > 30 && r > 1) {
    const got = sellCoins(m, B.take_profit.sell_share);
    addLog(L, `두 배 넘게 오른 코인 일부를 팔아 ${won(got, y)}을 챙겼어요`, 1, 'money');
  }
  // 크게 빠지면 손절하고 접음 (걱정 많음 +, 낙천 −, 순응형 +)
  if (r < -0.4) {
    const cap = B.capitulation;
    const q = clamp(cap.base + (T.outlook < -20 ? cap.outlook_minus : 0) + (T.outlook > 20 ? cap.outlook_plus : 0) + (T.conform > 20 ? cap.conform_plus : 0), 0, 1);
    if (rng.chance(q)) {
      const got = sellCoins(m, 1);
      addLog(L, `결국 코인을 다 팔고 접었어요. 남은 돈은 ${won(got, y)}이에요`, 2, 'money');
      addFlag(s, 'coin_capitulated');
      return;
    }
  }
  // 순응형·모험가: 보유 중 광풍 해가 오면 고점에서 더 삼
  const hype = C.years.find((x) => x.year === y)?.entry_weight ?? 0;
  if (!first && hype >= 3 && (T.conform > 20 || T.risk > 30) && m.cash > 0) {
    const add = Math.min(m.cash * 0.2, coinTotal(m));
    if (add > 0) {
      m.cash -= add;
      m.coin_cost = (m.coin_cost ?? 0) + add;
      const tot = coinTotal(m) || 1;
      for (const k of Object.keys(m.coins)) m.coins[k] += add * (1 + B.fomo.entry_penalty) * (m.coins[k] / tot);
      addLog(L, '주변이 다 코인 얘기라 고점에서 더 샀어요', 1, 'money');
    }
  }
}

// do coin:buy:<btc|alt|meme>:<현금 비율> · coin:sell_all
export function doCoin(L, args) {
  const { s, W, D } = L;
  const m = s.money;
  m.coins ??= {};
  const [what, asset, ratioStr] = args;
  if (what === 'sell_all') { if (coinTotal(m) > 0) sellCoins(m, 1); return; }
  if (what !== 'buy' || !COIN_NAMES[asset]) { warnOnce(`do-coin-${args.join(':')}`, `지원하지 않는 do: coin:${args.join(':')}`); return; }
  const y = s.year;
  if (y < 2010) return; // 비트코인 전
  let amount = Math.max(0, m.cash) * clamp(Number(ratioStr) || 0, 0, 1);
  if (y < (D.coin?.korea_since ?? 2013)) amount = Math.min(amount, W.econ(y).avg_wage * 0.02); // 인터넷에서 들은 이야기, 아주 적은 돈만
  if (amount <= 0) return;
  const kimchi = D.coin?.behavior?.kimchi_premium;
  m.cash -= amount;
  m.coins[asset] = (m.coins[asset] ?? 0) + amount * (1 + (kimchi?.years?.includes(y) ? kimchi.buy_penalty : 0));
  m.coin_cost = (m.coin_cost ?? 0) + amount;
  m.coin_buy_year = y;
  m.coin_since ??= y;
}

// do stock:buy:<company|my_company>:<금액> · stock:sell:<company>:<비율> (상세형을 간단형 보유로)
export function doStock(L, args, ctx) {
  const { s, W } = L;
  const m = s.money;
  const [what, target, amt] = args;
  const id = target === 'my_company' ? s.career.company : target === 'company' ? ctx.company ?? hotCompany(L)?.id : target;
  if (!id || !W.co(id)) { if (target !== 'my_company') warnOnce(`do-stock-${target}`, `지원하지 않는 do: stock:${args.join(':')}`); return; }
  if (what === 'buy') {
    const v = Math.min(Math.max(0, m.cash), resolveMoney(L, amt) ?? 0);
    if (v > 0) buyHolding(L, id, v, ctx);
  } else if (what === 'sell') {
    const h = m.stocks[id];
    if (!h) return;
    const share = clamp(Number(amt) || 1, 0, 1);
    m.cash += h.value * share;
    h.value *= 1 - share; h.cost *= 1 - share;
    if (h.value < 1) delete m.stocks[id];
  } else warnOnce(`do-stock-${what}`, `지원하지 않는 do: stock:${args.join(':')}`);
}
// do index:buy:<금액> · index:sell:<금액>
export function doIndex(L, args) {
  const m = L.s.money;
  const [what, amt] = args;
  const v = resolveMoney(L, amt) ?? 0;
  if (what === 'buy') { const x = Math.min(Math.max(0, m.cash), v); if (x > 0) buyHolding(L, 'index', x, {}); }
  else if (what === 'sell' && m.stocks.index) {
    const h = m.stocks.index;
    const x = Math.min(h.value, v);
    m.cash += x; h.cost *= h.value > 0 ? 1 - x / h.value : 0; h.value -= x;
    if (h.value < 1) delete m.stocks.index;
  }
}
function buyHolding(L, id, amount, ctx) {
  const { s } = L;
  const m = s.money;
  m.cash -= amount;
  const h = (m.stocks[id] ??= { value: 0, cost: 0, since: s.year });
  h.value += amount;
  h.cost += amount;
  if (id !== 'index' && !s.flags.first_semi_stock) {
    addFlag(s, 'first_semi_stock');
    if (!ctx.semiAdded) addSemi(L, '처음으로 반도체 주식을 샀어요', 'money');
  }
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
    m.tenure = null;
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
    if (!m.houses.length) m.tenure = 'jeonse';
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
  buyHolding(L, id, amount, ctx);
}

export { wealthGrade };
