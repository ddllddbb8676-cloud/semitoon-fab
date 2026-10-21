// coin_history.json 규칙으로 성향별 코인 투자 결과를 시뮬레이션한다.
// 사용법: node life/tools/coin_sim.mjs [시행 횟수]
// 진입 연도는 '소문'에 끌려 전년에 크게 오른 해일수록 많이 고른다 (개인 투자자 대부분이 고점 근처에 들어온 현실 반영).
import { readFileSync } from 'node:fs';

const C = JSON.parse(readFileSync(new URL('../data/coin_history.json', import.meta.url), 'utf8'));
const B = C.behavior;
const price = Object.fromEntries(C.years.map((y) => [y.year, y.btc_usd]));
const LAST = Math.max(...C.years.map((y) => y.year));
const btcRet = (y) => price[y] / price[y - 1] - 1;
const hype = Object.fromEntries(C.years.map((y) => [y.year, y.entry_weight ?? 0]));

let seed = 12345;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const normal = () => Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand());
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

function assetRet(name, btc) {
  const a = C.assets[name];
  if (a.crash_chance && rand() < a.crash_chance) return a.crash_return;
  if (a.moon_chance && rand() < a.moon_chance) return a.moon_return;
  return Math.max(-0.99, btc * a.beta + (a.noise_sd ? normal() * a.noise_sd : 0));
}

function pickEntry() {
  const years = [];
  for (const y of C.years) if (y.entry_weight) years.push([y.year, y.entry_weight]);
  let r = rand() * years.reduce((s, [, w]) => s + w, 0);
  for (const [y, w] of years) if ((r -= w) <= 0) return y;
  return years.at(-1)[0];
}

function simulate(t) {
  const entry = pickEntry();
  const [h0, h1] = B.hold_years;
  const exit = Math.min(LAST, entry + h0 + Math.floor(rand() * (h1 - h0 + 1)));
  const wBtc = clamp(0.45 - t.risk / 200, 0.1, 0.8);
  const quit = clamp(B.capitulation.base + (t.outlook < -20 ? B.capitulation.outlook_minus : 0) + (t.outlook > 20 ? B.capitulation.outlook_plus : 0)
    + (t.conform > 20 ? B.capitulation.conform_plus : 0), 0, 1);
  const wAlt = (1 - wBtc) * 0.7, wMeme = (1 - wBtc) * 0.3;
  let invested = 1, value = 1, realized = 0, sitOut = false;
  for (let y = entry; y <= exit; y++) {
    const btc = btcRet(y);
    let r = wBtc * btc + wAlt * assetRet('alt', btc) + wMeme * assetRet('meme', btc) + B.friction_per_year;
    if (y === entry) r = r * B.late_entry.gain_factor + B.late_entry.penalty;
    const buyYear = y === entry;
    // 고점 추격 매수
    let extra = 0;
    if (y > entry && (t.conform > 20 || t.risk > 30) && hype[y] >= 3) {
      invested += B.fomo.add_amount; extra = B.fomo.add_amount;
    }
    if (sitOut) { if (r > 0) r = 0; sitOut = false; }
    let tranche = extra * (1 + r + B.fomo.entry_penalty + (B.kimchi_premium.years.includes(y) ? B.kimchi_premium.buy_penalty : 0));
    value = value * (1 + r + (buyYear && B.kimchi_premium.years.includes(y) ? B.kimchi_premium.buy_penalty : 0)) + tranche;
    if (t.risk > 40 && rand() < B.leverage.liquidation_chance) value *= 1 + B.leverage.loss;
    if (t.outlook < -20 && r < -0.35) sitOut = true;
    if (t.thrift > 30 && r > 1.0) { realized += value * B.take_profit.sell_share; value *= 1 - B.take_profit.sell_share; }
    value = Math.max(0, value);
    if (r < -0.4 && rand() < quit) break;
  }
  return (value + realized) / invested;
}

const TYPES = {
  '보통': {},
  '모험가 (risk 70)': { risk: 70 },
  '순응형·남 따라 사기 (conform 60)': { conform: 60 },
  '걱정 많음 (outlook -60)': { outlook: -60 },
  '짠돌이+낙천 (thrift 60, outlook 60)': { thrift: 60, outlook: 60 },
  '모험가+걱정 (risk 70, outlook -60)': { risk: 70, outlook: -60 },
};
const N = Number(process.argv[2] ?? 20000);
console.log(`성향별 코인 투자 결과 (시행 ${N}번씩, 진입 ${C.korea_since}~${LAST - 1}(광풍 해 가중), 보유 ${B.hold_years[0]}~${B.hold_years[1]}년)`);
for (const [name, tr] of Object.entries(TYPES)) {
  const t = { risk: 0, conform: 0, outlook: 0, thrift: 0, ...tr };
  const res = Array.from({ length: N }, () => simulate(t)).sort((a, b) => a - b);
  const win = res.filter((x) => x > 1).length / N;
  const big = res.filter((x) => x > 3).length / N;
  const wipe = res.filter((x) => x < 0.2).length / N;
  console.log(`${name.padEnd(34)} 수익 ${(win * 100).toFixed(0).padStart(3)}%  3배 이상 ${(big * 100).toFixed(0).padStart(3)}%  80% 이상 손실 ${(wipe * 100).toFixed(0).padStart(3)}%  중앙값 ×${res[N >> 1].toFixed(2)}`);
}
