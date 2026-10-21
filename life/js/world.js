// 세계: 시황·경제 기준표·회사 운명·업계 연표 (담당: Claude, DOM 없음)
// 2026년까지는 market_history·economy_history, 2027년부터는 future.js 시간선(시드별)을 씁니다 (SYSTEMS 6장).
// 회사 운명은 세계 난수 스트림만 써서, 같은 시드면 (플레이어가 회사를 세우지 않는 한) 같은 업계 역사가 나옵니다.

import { generate, jobMultipliers, medical } from './future.js';
import { Rng, streamSeed, STREAM } from './rng.js';
import { clamp, lerpTable } from './core.js';

export const WORLD_START = 1940;
export const HISTORY_END = 2026;
export const WORLD_END = 2150;
const MARKET_KEYS = ['cycle', 'memory', 'logic_foundry', 'equipment', 'korea'];
const NEAR_SECTOR = { equipment_global: 'equipment_korea', equipment_korea: 'equipment_global', memory: 'foundry', foundry: 'memory' };
const FAB_SECTORS = ['memory', 'foundry', 'packaging'];

// ECONOMY 7.1 지역 배율
const CAPITAL_W = { suwon: 0.45, giheung: 0.27, gwangju_gg: 0.21, bucheon: 0.2, hwaseong: 0.16, incheon: 0.15, paju: 0.11, yongin: 0.1, pyeongtaek: 0.09, icheon: 0.03 };
const LOCAL_M = { busan: 1.3, daegu: 1.1, daejeon: 1.05, gwangju_jn: 0.95, cheonan: 0.95, cheongju: 0.88, asan: 0.79, gumi: 0.73, eumseong: 0.65, gongju: 0.65, yeongju: 0.55 };

const r2 = (x) => Math.round(x * 100) / 100;

export class World {
  constructor(D, ws) {
    this.D = D;
    this.ws = ws;
    this.rng = new Rng(1);
    this.rng.s = ws.rng >>> 0;
    this._fut = null;
    this._jobMult = new Map();
  }

  // 새 세계 (회사 속성 ±1, 시작 기술력·점유율)
  static create(D, seed) {
    const rng = new Rng(streamSeed(seed, STREAM.world));
    const ws = { seed, year: WORLD_START - 1, rng: 0, co: {}, order: [], timeline: [], fates: [], leader: {}, lead2: {}, race: {}, spawned: {} };
    const jit = () => { const u = rng.next(); return u < 0.25 ? -1 : u < 0.75 ? 0 : 1; };
    for (const c of D.companies) {
      const attrs = {};
      for (const k of ['salary', 'wlb', 'stability', 'growth']) attrs[k] = clamp((c[k] ?? 3) + jit(), 1, 5);
      ws.co[c.id] = {
        id: c.id, name: c.name, sector: c.sector, country: c.country, founded: c.founded, regions: c.regions, clients: c.clients ?? null,
        attrs, base: c.share ?? 5, share: 0, on: false, gone: 0, acquirer: null,
        T: 50 + 5 * (attrs.growth - 3) + 5 * (attrs.stability - 3), a: 0, c: 0, tech: 0, crisis: 0, hist: [], player: false,
      };
      ws.order.push(c.id);
    }
    for (const s of D.sectors) ws.race[s.id] = WORLD_START + rng.int(4, 6);
    ws.rng = rng.s;
    return ws;
  }

  save() { this.ws.rng = this.rng.s; return this.ws; }

  // ---------- 미래 시간선 (필요할 때 한 번 만들고 저장은 시드만) ----------
  fut() {
    if (!this._fut) {
      this._fut = generate(this.D.future, this.ws.seed);
      this._futRow = new Map(this._fut.rows.map((r) => [r.year, r]));
    }
    return this._fut;
  }
  futRow(y) { this.fut(); return this._futRow.get(Math.min(WORLD_END, y)) ?? null; }

  // ---------- 시황 ----------
  marketRow(y) {
    if (y <= HISTORY_END) return this.D.marketByYear.get(y) ?? null;
    return this.futRow(y);
  }
  // 분야 시황 m(s,y): market_mix로 섞고 null 키는 빼고 다시 나눔, 다 없으면 cycle, 그것도 없으면 0
  score(sectorId, y) {
    const row = this.marketRow(y);
    if (!row) return 0;
    const mix = this.D.sectorById.get(sectorId)?.market_mix ?? { cycle: 1 };
    let sum = 0, w = 0;
    for (const [k, v] of Object.entries(mix)) if (row[k] !== null && row[k] !== undefined) { sum += v * row[k]; w += v; }
    if (w > 0) return sum / w;
    return row.cycle ?? 0;
  }
  marketKey(key, y) { const row = this.marketRow(y); return row?.[key] ?? row?.cycle ?? 0; }
  // 업계 지수 I(y)
  index(y) { return this.D.sectors.reduce((a, s) => a + (s.index_weight ?? 0) * this.score(s.id, y), 0); }
  macro(y) { return this.econ(y).macro_score ?? 0; }

  // ---------- 경제 기준표 E(y) ----------
  econ(y) {
    if (y <= HISTORY_END) {
      const e = this.D.econByYear.get(Math.max(WORLD_START, y));
      return {
        year: y, cpi: e.cpi_index, avg_wage: e.avg_wage_krw, min_wage: e.min_wage_hourly_krw, house_seoul: e.house_seoul_krw, house_local: e.house_local_krw,
        base_rate: e.base_rate_pct, mortgage_rate: e.mortgage_rate_pct ?? (e.deposit_rate_pct ?? 5) + 3, deposit_rate: e.deposit_rate_pct ?? 3,
        kospi: e.kospi_close, macro_score: e.macro_score ?? 0, retire_age: null, pension_age: null,
      };
    }
    const f = this.futRow(y)._sim.econ;
    return {
      year: y, cpi: f.cpi_index, avg_wage: f.avg_wage_krw, min_wage: f.min_wage_hourly_krw, house_seoul: f.house_seoul_krw, house_local: f.house_local_krw,
      base_rate: f.base_rate_pct, mortgage_rate: f.base_rate_pct + f.mortgage_spread, deposit_rate: Math.max(0.2, f.base_rate_pct + f.deposit_spread),
      kospi: f.kospi_close, macro_score: f.macro_score, retire_age: f.retire_age, pension_age: f.pension_start_age,
    };
  }

  // ECONOMY 7.1 지역 집값 (84㎡급)
  housePrice(regionId, y) {
    const e = this.econ(y);
    const reg = this.D.regions.get(regionId);
    let p;
    if (!reg || regionId === 'seoul' || regionId === 'overseas') p = e.house_seoul;
    else if (CAPITAL_W[regionId] !== undefined) p = e.house_local + (e.house_seoul - e.house_local) * CAPITAL_W[regionId];
    else if (LOCAL_M[regionId] !== undefined) p = e.house_local * LOCAL_M[regionId];
    else if (regionId === 'rural') p = e.house_local * lerpTable([[1980, 0.6], [2000, 0.45], [2026, 0.35]], y);
    else p = e.house_local;
    if (reg?.fab_since) p *= 1 + 0.12 * clamp((y - reg.fab_since + 2) / 5, 0, 1);
    return p;
  }

  // 미래 직업 수요 배율 (FUTURE 8장, 2027년부터)
  jobDemand(jobId, y) {
    if (y <= HISTORY_END) return 1;
    if (!this._jobMult.has(y)) this._jobMult.set(y, jobMultipliers(this.D.future, this.fut(), y));
    return this._jobMult.get(y)[jobId] ?? 1;
  }

  // 비트코인 연 수익률: 2026년까지 coin_history.json 연말 시세, 그 뒤는 cycle_after_2026 규칙 (판 시드마다 같은 값)
  btcReturn(y) {
    const C = this.D.coin;
    if (!C) return 0;
    if (!this._btc) this._btc = new Map(C.years.map((r) => [r.year, r.btc_usd]));
    const last = Math.max(...this._btc.keys());
    if (y <= last) {
      const a = this._btc.get(y);
      const b = this._btc.get(y - 1);
      return a && b ? a / b - 1 : 0;
    }
    if (!this._btcFut) {
      const R = C.cycle_after_2026;
      const rng = new Rng(streamSeed(this.ws.seed, 13));
      this._btcFut = new Map();
      for (let yy = last + 1; yy <= WORLD_END; yy++) {
        const k = Math.max(0, Math.floor((yy - R.halving_years_from) / R.halving_every));
        const ph = (((yy - R.halving_years_from) % R.halving_every) + R.halving_every) % R.halving_every;
        const span = ph === 1 ? R.boom_return : ph === 2 ? R.bust_return : R.flat_return;
        let r = rng.float(span[0], span[1]) * Math.pow(R.amplitude_decay_per_cycle, k);
        if (rng.chance(R.collapse_chance)) r = R.collapse_return;
        this._btcFut.set(yy, r);
      }
    }
    return this._btcFut.get(Math.min(y, WORLD_END)) ?? 0;
  }

  // 미래 의료 기술 (FUTURE 7.2): {life_d_bonus, cure_mult}
  medical(y) {
    if (y <= HISTORY_END) return { life_d_bonus: 0, cure_mult: 1 };
    this._med ??= new Map();
    if (!this._med.has(y)) this._med.set(y, medical(this.D.future, this.fut(), y));
    return this._med.get(y);
  }

  // ---------- 미래 조건용 ----------
  techArrived(id, y) { if (y <= HISTORY_END) return false; const a = this.fut().arrived.get(id); return a !== undefined && a <= y; }
  techYear(id) { return this.fut().arrived.get(id); }
  scenarioFired(id, y) { return y > HISTORY_END && this.fut().fired.some((f) => f.id === id && f.year <= y); }
  scenarioActive(id, y) { return y > HISTORY_END && this.fut().fired.some((f) => f.id === id && f.year <= y && y <= f.until); }
  worldPath(y) { if (y <= HISTORY_END) return null; const p = [...this.fut().pathHistory].reverse().find((x) => x.year <= y); return p?.path ?? null; }
  latestTech(y) {
    if (y <= HISTORY_END) return null;
    let best = null;
    for (const n of this.D.future.nodes) { const a = this.fut().arrived.get(n.id); if (a !== undefined && a <= y && a > 2026 && (!best || a >= best.year)) best = { year: a, node: n }; }
    return best?.node ?? null;
  }

  // ---------- 회사 ----------
  co(id) { return id ? this.ws.co[id] ?? null : null; }
  alive(sectorId) { return this.ws.order.map((id) => this.ws.co[id]).filter((c) => c.on && !c.gone && c.sector === sectorId); }
  allAlive() { return this.ws.order.map((id) => this.ws.co[id]).filter((c) => c.on && !c.gone); }
  leaderOf(sectorId) { const l = this.alive(sectorId); return l.length ? l.reduce((a, b) => (b.share > a.share ? b : a)) : null; }
  companyName(id) { return this.co(id)?.name ?? ''; }

  // 근처 팹 회사: 내 지역 → 같은 권역에 공장이 있는 memory·foundry·packaging 중 점유율 최대 → 메모리 1위
  nearbyFab(regionId) {
    const fabs = this.allAlive().filter((c) => FAB_SECTORS.includes(c.sector));
    const area = this.D.regions.get(regionId)?.area;
    const best = (l) => (l.length ? l.reduce((a, b) => (b.share > a.share ? b : a)) : null);
    return best(fabs.filter((c) => c.regions.includes(regionId)))
      ?? best(fabs.filter((c) => c.regions.some((r) => this.D.regions.get(r)?.area === area && area !== 'overseas')))
      ?? this.leaderOf('memory') ?? best(fabs);
  }
  nearFab(regionId, y) { const r = this.D.regions.get(regionId); return !!(r?.fab_since && r.fab_since <= y); }

  // 같은 분야(없으면 가까운 분야) 다른 회사 중 c ≥ −0.5, 가중치 = 점유율 × (1 + c)
  rival(companyId, rng) {
    const me = this.co(companyId);
    const sector = me?.sector ?? 'memory';
    let list = this.alive(sector).filter((c) => c.id !== companyId && c.c >= -0.5);
    if (!list.length && NEAR_SECTOR[sector]) list = this.alive(NEAR_SECTOR[sector]).filter((c) => c.c >= -0.5);
    if (!list.length) list = this.alive(sector).filter((c) => c.id !== companyId);
    return rng.weighted(list, (c) => c.share * (1 + c.c) + 0.01) ?? null;
  }

  // 플레이어 창업 (job:found)
  foundCompany(sectorId, name, y) {
    const id = `player_${y}_${Object.keys(this.ws.co).length}`;
    const peers = this.alive(sectorId);
    const meanT = peers.length ? peers.reduce((a, c) => a + c.T, 0) / peers.length : 50;
    this.ws.co[id] = {
      id, name, sector: sectorId, country: 'KR', founded: y, regions: peers[0]?.regions?.slice(0, 1) ?? ['seoul'], clients: null,
      attrs: { salary: 3, wlb: 3, stability: 2, growth: 4 }, base: 1, share: 0.01, on: true, gone: 0, acquirer: null,
      T: meanT - 8, a: 0, c: 0, tech: 0, crisis: 0, hist: [], player: true,
    };
    this.ws.order.push(id);
    this.addTimeline(y, 'founded', `${name} 창업`, sectorId, [id]);
    return this.ws.co[id];
  }

  addTimeline(year, kind, text, sector, companies) {
    this.ws.timeline.push({ year, kind, text, sector, companies });
  }
  fatesOf(y) { return this.ws.fates.filter((f) => f.year === y); }

  // 실제 역사 헤드라인은 화면에 낼 때 패러디 이름으로 (name_map.json)
  paro(text) { return paroText(this.D, text); }
  headline(y) {
    if (y <= HISTORY_END) return this.paro(this.marketRow(y)?.headline_ko ?? null);
    const row = this.futRow(y);
    if (!row) return null;
    const node = (row._sim.nodes ?? []).map((id) => this.D.future.nodes.find((n) => n.id === id)).find((n) => n?.company_sector);
    const co = this.leaderOf(node?.company_sector ?? 'memory');
    return row.headline_ko.replaceAll('{company}', co?.name ?? '반도체 회사');
  }
  marketWord(y) {
    const c = this.marketRow(y)?.cycle ?? 0;
    return c >= 2 ? '슈퍼호황' : c >= 1 ? '호황' : c <= -2 ? '대불황' : c <= -1 ? '불황' : '보통';
  }

  advanceTo(y) { while (this.ws.year < Math.min(y, WORLD_END)) this.step(this.ws.year + 1); }

  // ---------- 한 해 진행 (SYSTEMS 6.3~6.6, 간단형) ----------
  step(y) {
    const { D, ws } = this;
    const r = this.rng;
    const hist = y <= HISTORY_END;
    const all = ws.order.map((id) => ws.co[id]);

    // 설립 (역사)
    for (const c of all) {
      if (!c.on && !c.gone && c.founded <= y) {
        // 기존 회사 점유율은 합이 1이라, 새 회사는 분야 기준 가중치 비율로 끼어든 뒤 아래에서 다시 정규화 (6.5)
        const peers = all.filter((x) => x.sector === c.sector && (x.on && !x.gone));
        const baseSum = peers.reduce((a, x) => a + x.base, 0) + c.base;
        c.on = true;
        c.share = peers.length ? c.base / baseSum / (1 - c.base / baseSum) : 1;
        if (c.founded > WORLD_START && y > WORLD_START) this.addTimeline(y, 'founded', `${c.name} 설립`, c.sector, [c.id]);
      }
    }
    const live = all.filter((c) => c.on && !c.gone);

    // 기술력: T += N(0,2) + 0.8(growth−3) + c(y−1)
    for (const c of live) c.T += r.gauss(0, 2) + 0.8 * (c.attrs.growth - 3) + 1.0 * c.c;
    for (const s of D.sectors) {
      const l = live.filter((c) => c.sector === s.id);
      const meanT = l.reduce((a, c) => a + c.T, 0) / Math.max(1, l.length);
      for (const c of l) c.tech = clamp(0.04 * (c.T - meanT), -0.6, 0.6);
    }

    // 실적 c(k,y): 시황을 따르는 분야 먼저, 원청을 따르는 분야(급식·보안·건설)는 나중에
    const sigma = hist ? 0.25 : 0.4;
    const ordered = [...D.sectors].sort((a, b) => (a.follows ? 1 : 0) - (b.follows ? 1 : 0));
    for (const s of ordered) {
      const m = this.score(s.id, y);
      for (const c of live.filter((x) => x.sector === s.id)) {
        c.a = 0.6 * c.a + r.gauss(0, sigma);
        let v;
        if (s.follows) {
          const cl = (c.clients ?? []).map((id) => ws.co[id]).filter((x) => x?.on && !x.gone);
          const clAvg = cl.length ? cl.reduce((a, x) => a + x.c, 0) / cl.length : m;
          if (s.follows === 'capex') v = 0.5 * clAvg + 0.5 * ((this.score('memory', y - 1) + this.score('foundry', y - 1)) / 2) + c.a;
          else v = 0.6 * clAvg + 0.4 * this.marketKey('korea', y) + c.a;
        } else v = m + c.a + c.tech;
        v = clamp(v, -2, 2);
        if (hist) v = clamp(v, m - 1, m + 1);
        c.c = r2(v);
        c.hist.push([y, c.c]);
        if (c.hist.length > 12) c.hist.shift();
        c.crisis = c.c <= -1.5 ? c.crisis + 1 : c.c >= 0 ? 0 : c.crisis;
      }
    }

    // 점유율
    for (const s of D.sectors) {
      const l = live.filter((c) => c.sector === s.id);
      if (!l.length) continue;
      for (const c of l) c.share = Math.max(1e-4, c.share) * Math.exp(0.12 * c.c + 0.05 * c.tech);
      const tot = l.reduce((a, c) => a + c.share, 0);
      for (const c of l) c.share /= tot;
      if (hist) {
        const bt = l.reduce((a, c) => a + c.base, 0);
        for (const c of l) c.share = 0.7 * c.share + 0.3 * (c.base / bt);
      }
      this.checkLeader(s, l, y, hist);
    }

    // 세대 경쟁 (분야마다 4~6년에 한 번)
    for (const s of D.sectors) {
      if (s.follows || ws.race[s.id] > y) continue;
      ws.race[s.id] = y + r.int(4, 6);
      const l = live.filter((c) => c.sector === s.id);
      if (l.length < 2 || y < 1960) continue;
      const ranked = l.map((c) => ({ c, v: c.T + r.gauss(0, 5) })).sort((a, b) => b.v - a.v);
      ranked[0].c.T += 8;
      ranked[ranked.length - 1].c.T -= 5;
      this.addTimeline(y, 'tech', `${ranked[0].c.name}, 차세대 공정 경쟁에서 앞서 나가요`, s.id, [ranked[0].c.id]);
    }

    // 위기·파산·인수 (2026년까지는 드물게)
    for (const s of D.sectors) {
      const l = () => live.filter((c) => c.sector === s.id && !c.gone);
      for (const c of l()) {
        if (l().length <= 2) break;
        const leader = this.leaderOf(s.id);
        if (c.crisis >= 2 && leader?.id !== c.id && l().length >= 3) {
          // H: 문서 값 0.25(역사)·1(미래). 미래 1이면 2027~2100 파산이 판당 10건이 넘어 14장 목표(3~8)에 맞게 0.35로 (life_sim 튜닝)
          const p = (!hist && c.crisis >= 6) ? 1 : 0.06 * c.crisis * ((6 - c.attrs.stability) / 3) * (hist ? 0.25 : 0.35);
          if (r.chance(p)) { this.bankrupt(c, y); continue; }
        }
        if ((c.crisis >= 1 || !hist) && c.share < 0.2) {
          const near = [...l(), ...(NEAR_SECTOR[s.id] ? this.alive(NEAR_SECTOR[s.id]) : [])].filter((x) => x.id !== c.id && x.c >= 0.5 && x.share >= 0.25);
          // H2: 문서 값 0.3·1, 건강한 작은 회사 0.01 → 미래 인수가 판당 20건이라 0.35·0.002로 (life_sim 튜닝)
          const p = c.crisis >= 1 ? 0.08 * c.crisis * (hist ? 0.3 : 0.35) : 0.002;
          if (near.length && r.chance(p)) this.acquire(c, near.reduce((a, b) => (b.share * b.c > a.share * a.c ? b : a)), y);
        }
      }
    }

    // 새 회사 (2027년부터, 분야에 4곳 미만이면)
    if (!hist) {
      for (const s of D.sectors) {
        const l = this.alive(s.id);
        if (l.length >= 4 || !r.chance(0.1 + 0.1 * Math.max(0, this.score(s.id, y)))) continue;
        const used = ws.spawned[s.id] ?? 0;
        ws.spawned[s.id] = used + 1;
        const names = s.spawn_names ?? [];
        const name = used < names.length ? names[used] : `${names[used % Math.max(1, names.length)] ?? s.name}${Math.floor(used / Math.max(1, names.length)) + 1}`;
        const meanT = l.reduce((a, c) => a + c.T, 0) / Math.max(1, l.length);
        const regions = [...new Set(l.flatMap((c) => c.regions))];
        const id = `new_${s.id}_${used}`;
        ws.co[id] = {
          id, name, sector: s.id, country: 'KR', founded: y, regions: regions.length ? [r.pick(regions)] : ['seoul'], clients: s.follows ? l[0]?.clients ?? null : null,
          attrs: { salary: 3, wlb: 3, stability: 2, growth: 4 }, base: 5, share: 0.05, on: true, gone: 0, acquirer: null,
          T: meanT - 8, a: 0, c: 0, tech: 0, crisis: 0, hist: [], player: false,
        };
        ws.order.push(id);
        this.addTimeline(y, 'founded', `${name} 설립`, s.id, [id]);
      }
    }
    if (ws.fates.length > 40) ws.fates = ws.fates.slice(-40);
    ws.year = y;
  }

  checkLeader(s, l, y, hist) {
    const ws = this.ws;
    const top = l.reduce((a, b) => (b.share > a.share ? b : a));
    const cur = ws.co[ws.leader[s.id]];
    if (!cur || cur.gone || cur.sector !== s.id) { ws.leader[s.id] = top.id; ws.lead2[s.id] = null; return; }
    // 1위 교체는 점유율이 15% 넘게 앞설 때만 셉니다 (비슷한 두 회사가 해마다 뒤집히는 것 방지, life_sim 튜닝)
    if (top.id === cur.id || top.share < cur.share * 1.15) { ws.lead2[s.id] = null; return; }
    const st = ws.lead2[s.id]?.id === top.id ? ws.lead2[s.id].n + 1 : 1;
    ws.lead2[s.id] = { id: top.id, n: st };
    if (st >= (hist ? 3 : 2)) {
      ws.leader[s.id] = top.id;
      ws.lead2[s.id] = null;
      // upset: 기준 점유율 순서와 다른(판마다 랜덤인) 교체. 역사 구간의 예정된 추월(예: 새로 생긴 큰 회사)은 false
      if (!s.follows) {
        this.addTimeline(y, 'leader', `${y}년 ${top.name}, ${s.name} 1위 등극 (${cur.name} 추월)`, s.id, [top.id, cur.id]);
        this.ws.timeline[this.ws.timeline.length - 1].upset = y > HISTORY_END || top.base <= cur.base;
      }
      ws.fates.push({ year: y, kind: 'leader', id: top.id });
    }
  }
  bankrupt(c, y) {
    c.gone = y;
    c.share = 0;
    this.addTimeline(y, 'bankrupt', `${c.name}, 끝내 문을 닫았어요`, c.sector, [c.id]);
    this.ws.fates.push({ year: y, kind: 'bankrupt', id: c.id });
  }
  acquire(c, by, y) {
    c.gone = y;
    c.acquirer = by.id;
    by.share += c.share;
    by.T = Math.max(by.T, c.T);
    c.share = 0;
    this.addTimeline(y, 'acquired', `${by.name}, ${c.name} 인수`, c.sector, [by.id, c.id]);
    this.ws.fates.push({ year: y, kind: 'acquired', id: c.id, acquirer: by.id });
  }
}

export function paroText(D, text) {
  if (!text) return text;
  let out = text;
  for (const { real, game } of D.nameMap) {
    if (/^[A-Za-z0-9]+$/.test(real)) out = out.replace(new RegExp(`(^|[^A-Za-z0-9])${real}(?=[^A-Za-z0-9]|$)`, 'g'), `$1${game}`);
    else out = out.split(real).join(game);
  }
  return out;
}

// 캐릭터 만들기 화면용: 그 해 업계 헤드라인 (없으면 일반 뉴스 → 경제 사건)
export function yearHeadline(D, y) {
  const m = D.marketByYear.get(y)?.headline_ko;
  if (m) return paroText(D, m);
  const n = D.newsByYear.get(y)?.headlines_ko?.[0];
  if (n) return paroText(D, n);
  return paroText(D, D.econByYear.get(y)?.events_ko?.[0] ?? null);
}

export { MARKET_KEYS };
