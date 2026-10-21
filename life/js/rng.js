// 시드 고정 난수 (mulberry32, 담당: Claude)
// 상태가 정수 하나(this.s)라서 저장·불러오기가 쉽습니다. 세계용·인생용 스트림을 따로 씁니다.

export class Rng {
  constructor(seed = 1) { this.s = seed >>> 0; }

  next() {
    const a = (this.s + 0x6d2b79f5) | 0;
    this.s = a >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  float(a = 0, b = 1) { return a + (b - a) * this.next(); }
  int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
  chance(p) { return this.next() < p; }

  // Box–Muller 정규난수
  gauss(mean = 0, sd = 1) {
    const u = Math.max(this.next(), 1e-12);
    const v = this.next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  pick(arr) { return arr.length ? arr[Math.floor(this.next() * arr.length)] : undefined; }

  // 가중 추첨. weightOf가 0 이하인 항목은 뽑히지 않습니다.
  weighted(arr, weightOf = (x) => x.weight ?? 1) {
    let total = 0;
    const ws = arr.map((x) => { const w = Math.max(0, weightOf(x) || 0); total += w; return w; });
    if (total <= 0) return undefined;
    let r = this.next() * total;
    for (let i = 0; i < arr.length; i++) { r -= ws[i]; if (r < 0) return arr[i]; }
    return arr[arr.length - 1];
  }
}

// 판 시드에서 스트림 시드를 만듭니다 (future.js와 같은 방식, 번호만 다르게)
export const streamSeed = (seed, k) => (Math.imul(seed | 0, 0x9e3779b1) + k) >>> 0;
export const STREAM = { world: 11, life: 12 };

export function newSeed() { return ((Math.random() * 4294967296) >>> 0) || 1; }
