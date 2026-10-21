// 숫자·시간 표기 (담당: Claude)

const UNITS = [
  [1e20, '해'], [1e16, '경'], [1e12, '조'], [1e8, '억'], [1e4, '만'],
];

// 1234567 → "123.5만원"
export function won(n) {
  if (!isFinite(n)) return '∞원';
  const neg = n < 0; n = Math.abs(n);
  let out;
  if (n < 1e4) out = Math.floor(n).toLocaleString('ko-KR');
  else {
    const [v, u] = UNITS.find(([v]) => n >= v);
    const x = n / v;
    out = (x >= 1000 ? Math.floor(x).toLocaleString('ko-KR') : x >= 100 ? x.toFixed(0) : x.toFixed(1)) + u;
  }
  return (neg ? '-' : '') + out + '원';
}

export function pct(y, digits = 1) { return (y * 100).toFixed(digits) + '%'; }

export function lotsPerSec(r) {
  if (r === 0) return '정지';
  if (r < 1) return (r * 60).toFixed(1) + ' Lot/분';
  return r.toFixed(1) + ' Lot/초';
}

export function duration(sec) {
  sec = Math.floor(sec);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (h) return `${h}시간 ${m}분`;
  if (m) return `${m}분 ${s}초`;
  return `${s}초`;
}
