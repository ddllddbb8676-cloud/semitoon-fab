// 화면 표시용 형식 (담당: Claude)
// 돈은 저장할 때 1962년 이후 '원'이고, 화면에서만 시대 단위로 바꿉니다 (ECONOMY 12장).

const sig = (x) => {
  if (x >= 100) return Math.round(x).toLocaleString('ko-KR');
  if (x >= 10) return String(Math.round(x * 10) / 10);
  return String(Math.round(x * 100) / 100);
};

// won(51480000, 2026) → '5,150만 원' (만·억·조 뒤에는 띄어 씀, 그 밖에는 '3,500원')
export function won(amount, year = 2026) {
  let v = Number(amount) || 0;
  let unit = '원';
  if (year <= 1952) v *= 1000;              // 구 원
  else if (year <= 1961) { v *= 10; unit = '환'; }
  const neg = v < 0;
  const a = Math.abs(v);
  let out;
  if (a >= 1e12) out = `${sig(a / 1e12)}조`;
  else if (a >= 1e8) out = `${sig(a / 1e8)}억`;
  else if (a >= 1e4) out = `${sig(a / 1e4)}만`;
  else out = a >= 10 ? Math.round(a).toLocaleString('ko-KR') : String(Math.round(a * 100) / 100);
  return `${neg ? '−' : ''}${out}${/[만억조]$/.test(out) ? ' ' : ''}${unit}`;
}
// 그 시대 연봉을 지금(2026년) 감각으로: 그 해 평균 임금 대비 배율 × 2026년 평균 임금 (물가가 아니라 임금 기준이라 '그때 그 정도 벌이'가 보여요).
// 2026년에서 10년 넘게 떨어진 해에만 붙입니다. → ' · 지금 기준 약 6,200만 원'
export function nowPay(W, amount, year) {
  if (!amount || Math.abs(year - 2026) < 10) return '';
  const a = W.econ(year)?.avg_wage;
  const b = W.econ(2026)?.avg_wage;
  return a && b ? ` · 지금 기준 약 ${won(amount * b / a, 2026)}` : '';
}
// 부호를 붙인 돈: '+120만 원', '−3,000원'
export const wonSigned = (amount, year) => `${amount > 0 ? '+' : ''}${won(amount, year)}`;

export const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');
export const pct = (x) => `${Math.round(x * 100)}%`;
export const scoreWord = (c) => (c >= 1.5 ? '아주 좋음' : c >= 0.5 ? '좋음' : c > -0.5 ? '보통' : c > -1.5 ? '나쁨' : '아주 나쁨');
export const chanceWord = (p) => (p >= 0.65 ? '높음' : p >= 0.4 ? '보통' : '낮음');
