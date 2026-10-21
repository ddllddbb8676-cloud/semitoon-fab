// 조건(when) 판정 (담당: Claude, DOM 없음) — SPEC "조건 키" 표
// 지원하지 않는 키는 거짓으로 보고(사건이 안 뜸) 콘솔에 한 번 알립니다.

import { STATS, inRange, asArray, eduIdx, hasFlag, stageOf, warnOnce } from './core.js';
import { resolveMoney, networth } from './money.js';
import { wealthGrade } from './health.js';

const MARKET_KEYS = ['cycle', 'memory', 'logic_foundry', 'equipment', 'korea'];

// 시황 조건 {memory: [1, 2], ...}
export function matchMarket(L, market) {
  if (!market) return true;
  const row = L.W.marketRow(L.s.year);
  for (const [k, r] of Object.entries(market)) {
    if (!MARKET_KEYS.includes(k)) { warnOnce(`market-${k}`, `알 수 없는 시황 키: ${k}`); return false; }
    const v = row?.[k] ?? row?.cycle ?? 0;
    if (!inRange(v, r)) return false;
  }
  return true;
}

function jobMatches(L, ids) {
  const { s, D } = L;
  const c = s.career;
  const mine = [];
  if (c.job && !c.leave) {
    mine.push(c.job);
    if (c.sub) mine.push(c.sub, D.subById.get(c.sub)?.parent);
  }
  mine.push(...c.side_jobs);
  for (const id of asArray(ids)) {
    if (id === 'none') { if (!c.job || c.leave) return true; continue; }
    if (mine.includes(id)) return true;
  }
  return false;
}

// when 객체 전체가 맞으면 true
export function matchWhen(L, when) {
  if (!when) return true;
  const { s, D, W } = L;
  const y = s.year;
  const c = s.career;
  const job = c.job && !c.leave ? D.jobById.get(c.job) : null;
  const co = c.job && !c.leave ? W.co(c.company) : null;
  for (const [k, v] of Object.entries(when)) {
    let ok;
    switch (k) {
      case 'stage': ok = asArray(v).includes(stageOf(s.age)); break;
      case 'age': ok = inRange(s.age, v); break;
      case 'year': ok = inRange(y, v); break;
      case 'gender': ok = asArray(v).includes(s.profile.gender); break;
      case 'stat_min': ok = Object.entries(v).every(([st, n]) => STATS.includes(st) && s.stats[st] >= n); break;
      case 'trait_min': ok = Object.entries(v).every(([a, n]) => (s.traits[a] ?? 0) >= n); break;
      case 'trait_max': ok = Object.entries(v).every(([a, n]) => (s.traits[a] ?? 0) <= n); break;
      case 'edu_min': ok = eduIdx(s.education.level) >= eduIdx(v); break;
      case 'edu_max': ok = eduIdx(s.education.level) <= eduIdx(v); break;
      case 'wealth_min': ok = wealthGrade(L) >= v; break;
      case 'job': ok = jobMatches(L, v); break;
      case 'job_group': ok = !!job && asArray(v).includes(job.group); break;
      case 'job_role': ok = !!c.sub && asArray(v).includes(D.subById.get(c.sub)?.role); break;
      case 'job_dim': { const dims = c.sub ? D.subById.get(c.sub)?.dims ?? {} : {}; ok = Object.entries(v).every(([d, vals]) => asArray(vals).includes(dims[d])); break; }
      case 'sector': ok = !!co && asArray(v).includes(co.sector); break;
      case 'employment': ok = !!job && asArray(v).includes(c.employment); break;
      case 'career_years_min': ok = !!job && (c.exp[c.job] ?? 0) >= v; break;
      case 'rank_min': ok = !!job && c.rank >= v; break;
      case 'company_state': ok = !!co && inRange(Math.round(co.c), v); break;
      case 'region': ok = asArray(v).includes(s.profile.region); break;
      case 'near_fab': ok = W.nearFab(s.profile.region, y) === !!v; break;
      case 'has_partner': ok = !!s.relations.partner === !!v; break;
      case 'has_children': ok = (s.relations.children.length > 0) === !!v; break;
      case 'parents_alive': ok = s.relations.parents.some((p) => p.alive) === !!v; break;
      case 'flag': ok = asArray(v).every((f) => hasFlag(s, f)); break;
      case 'not_flag': ok = !asArray(v).some((f) => hasFlag(s, f)); break;
      case 'flag_any': ok = asArray(v).some((f) => hasFlag(s, f)); break;
      case 'semi_min': ok = s.semi.length >= v; break;
      case 'semi_max': ok = s.semi.length <= v; break;
      case 'market': ok = matchMarket(L, v); break;
      case 'macro': ok = inRange(W.macro(y), v); break;
      case 'kospi_change': { const a = W.econ(y).kospi, b = W.econ(y - 1).kospi; ok = !!(a && b) && inRange(100 * (a / b - 1), v); break; }
      case 'base_rate': { const r = W.econ(y).base_rate; ok = r !== null && r !== undefined && inRange(r, v); break; }
      case 'house_change': { const a = W.housePrice(s.profile.region, y), b = W.housePrice(s.profile.region, y - 1); ok = inRange(100 * (a / b - 1), v); break; }
      case 'cash_min': { const n = resolveMoney(L, v); ok = n !== null && s.money.cash >= n; break; }
      case 'networth_min': { const n = resolveMoney(L, v); ok = n !== null && networth(L) >= n; break; }
      case 'networth_max': { const n = resolveMoney(L, v); ok = n !== null && networth(L) <= n; break; }
      case 'debt_min': { const n = resolveMoney(L, v); ok = n !== null && s.money.debt >= n; break; }
      case 'asset_grade_min': ok = wealthGrade(L) >= v; break;
      case 'asset_grade_max': ok = wealthGrade(L) <= v; break;
      case 'credit': ok = asArray(v).includes(s.flags.credit_default ? 'default' : 'ok'); break;
      case 'house_tenure': ok = asArray(v).includes(s.money.houses.length ? 'own' : s.money.tenure ?? (s.age < 27 && !s.relations.partner?.married ? 'parents' : 'jeonse')); break;
      case 'has_house': ok = (s.money.houses.length > 0) === !!v; break;
      case 'has_loan': ok = (s.money.debt > 0) === !!v; break;
      case 'holds_stock': {
        const ids = Object.keys(s.money.stocks).filter((id) => s.money.stocks[id].value > 0);
        ok = asArray(v).some((x) => (x === 'any' ? ids.length > 0 : x === 'my_company' ? ids.includes(c.company) : ids.includes(x)));
        break;
      }
      case 'holds_coin': {
        const coins = s.money.coins ?? {};
        const held = Object.keys(coins).filter((k) => coins[k] > 0);
        ok = v === true ? held.length > 0 : v === false ? !held.length : asArray(v).some((k) => (k === 'any' ? held.length > 0 : held.includes(k)));
        break;
      }
      case 'coin_ret': ok = s.money.coin_ret !== null && s.money.coin_ret !== undefined && inRange(100 * s.money.coin_ret, v); break;
      case 'stock_ret': {
        const hs = Object.values(s.money.stocks).filter((h) => h.value > 0 && h.ret !== undefined);
        const tot = hs.reduce((a, h) => a + h.value, 0);
        ok = tot > 0 && inRange(100 * hs.reduce((a, h) => a + h.ret * h.value, 0) / tot, v);
        break;
      }
      case 'concentration_min': {
        const vals = Object.values(s.money.stocks).map((h) => h.value);
        const tot = Math.max(0, s.money.cash) + vals.reduce((a, x) => a + x, 0);
        ok = tot > 0 && Math.max(0, ...vals) / tot >= v;
        break;
      }
      case 'future': ok = (y > 2026) === !!v; break;
      case 'tech': ok = asArray(v).every((id) => W.techArrived(id, y)); break;
      case 'tech_any': ok = asArray(v).some((id) => W.techArrived(id, y)); break;
      case 'not_tech': ok = !asArray(v).some((id) => W.techArrived(id, y)); break;
      case 'tech_since': ok = y > 2026 && Object.entries(v).every(([id, r]) => { const a = W.techYear(id); return a !== undefined && a <= y && inRange(y - a, r); }); break;
      case 'scenario': ok = asArray(v).every((id) => W.scenarioFired(id, y)); break;
      case 'scenario_active': ok = asArray(v).some((id) => W.scenarioActive(id, y)); break;
      case 'world_path': ok = asArray(v).includes(W.worldPath(y)); break;
      default:
        warnOnce(`when-${k}`, `지원하지 않는 조건 키: ${k} (그 사건·선택지는 숨김)`);
        ok = false;
    }
    if (!ok) return false;
  }
  return true;
}
