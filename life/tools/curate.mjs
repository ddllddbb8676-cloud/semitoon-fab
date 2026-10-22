// 인생에 남는 사건만 — 사건마다 "인생에 미치는 영향"을 데이터에서 점수 매겨, 너무 소소한 사건을 끄는 목록을 만듭니다.
// 지우지 않고 끕니다: 결과는 life/data/event_curation.json의 disabled 목록이고, 엔진(data.js)이 이 id들을 읽지 않습니다.
//
// 사용법 (저장소 루트에서):
//   node life/tools/curate.mjs            목록을 다시 만들고 파일별 개수와 무작위 예시 15개를 보여 줌
//   node life/tools/curate.mjs --dry      파일은 쓰지 않고 결과만 보여 줌
//   node life/tools/curate.mjs --list     꺼지는 사건을 전부 출력 (손으로 살릴 것 고르기용)
//
// 영향 규칙 (선택지마다 계산하고, 사건 점수 = 가장 큰 선택지. 판정 실패 효과도 그 선택지 몫으로 봄)
//   높음 3  do 동작 중 인생을 바꾸는 것(job·partner·child·house·invest·stock·index·coin·loan·move·school·military),
//           later(나중에 돌아오는 결과), 돈이 평균 연봉의 0.3배 이상
//   보통 2  그 밖의 do(연봉·성과급·가정 형편·습관·질병·휴직·집 형태·전공 등), 돈 0.05배 이상,
//           능력치 ±5 이상, 성향 ±15 이상, 행복·친구 ±8 이상, 평판 ±5 이상, 칭호 진행, R&D 스킬,
//           다른 사건(또는 엔진·업적)이 when으로 읽는 플래그
//   낮음 1  반도체 순간(semi)만, 작은 능력치·성향·행복·친구·평판
//   goto는 이어지는 사건의 점수를 그대로 물려받음
// 소소함(꺼짐) = 점수 ≤ 1 이고, major·drama·milestones 파일이 아니고, trigger가 없고, 손으로 살린 목록(RESCUE)에도 없음.
// 켜진 사건이 later·goto로 부르는 사건은 꺼지지 않음.

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DATA = join(ROOT, 'data');
const OUT = join(DATA, 'event_curation.json');
const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const LIST = args.includes('--list');

// 큰 줄기 파일: 점수와 상관없이 늘 켬
const PROTECTED = new Set(['events/major.json', 'events/drama.json', 'events/milestones.json']);

// 손으로 살린 사건: 숫자로는 작지만 기억에 남는 장면 (반도체 접점의 상징, 어린 시절의 따뜻한 순간, 시대의 공기)
// (방진복 사진·홍보관 체험·첫 알바 월급 내복·공단 편지·보릿고개·트랜지스터·PM과 학예회는 규칙만으로 켜져 있어 여기 없음)
const RESCUE = {
  // 유아 — 돌잡이·공장 불빛·가족 초청의 날: 반도체 접점 보장과 어린 시절 색깔
  infant_doljabi: '돌잡이 상 위의 메모리 칩, 첫 장면으로 남는 반도체 접점',
  infant_factory_lights: '어린 시절 공장 불빛, 동네가 반도체를 처음 보여 주는 장면',
  infant_family_day: '가족 초청의 날, 부모님 회사에 처음 가 본 기억',
  infant_kindergarten_first_day: '유치원 첫날, 세상에 처음 나서는 날',
  // 어린이 — 와플 웨이퍼·성과급 소고기·64K D램 뉴스·올림픽·혼자 밥 먹는 친구
  child_waffle_wafer: '“와플 아니고 웨이퍼”, 부모님 직업을 처음 설명해 본 날',
  child_bonus_beef_dinner: '성과급 날의 소고기, 반도체가 식탁에 닿는 순간',
  child_64k_dram_news: '64K D램 뉴스, 나라가 반도체를 처음 만든 해',
  child_olympics_1988: '1988 올림픽 개회식, 그 시절 아이들의 공통 기억',
  child_line_took_sports_day: '라인이 데려간 운동회, 교대근무 집 아이의 기억',
  child_lonely_classmate: '혼자 밥 먹는 친구 곁에 앉을지, 어린 날의 작은 용기',
  // 청소년 — 물리 시간의 ‘반만 도체’, 공장 앞 국밥집 알바
  teen_physics_half_conductor: '물리 시간 칠판의 ‘반도체’, 단어를 처음 만난 날',
  teen_gukbap_parttime: '공장 앞 국밥집 알바, 교대조 손님을 처음 본 주말',
  // 청년·중년·노년 — 첫 방진복, 첫 야간 알람, 손주의 질문, 꺼지지 않는 공장 불빛
  young_first_bunny_suit: '첫 방진복, 첫 클린룸',
  young_first_night_shift: '새벽 3시의 첫 알람',
  senior_grandkid_homework: '손주의 “반도체가 뭐예요?”, 평생을 설명해 보는 장면',
  senior_fab_lights_still: '노년의 밤 산책, 여전히 꺼지지 않는 공장 불빛',
  senior_memoir_notebook: '자서전 노트, 인생을 돌아보는 첫 페이지',
};

const HIGH_DO = new Set(['job', 'partner', 'child', 'house', 'invest', 'stock', 'index', 'coin', 'loan', 'move', 'school', 'military']);
const NOOP_DO = new Set(['job:stay', 'job:wait', 'partner:wait']);
const STATS = ['health', 'intelligence', 'dexterity', 'sociability', 'mental', 'looks'];
// 돈 토큰을 그 해 평균 연봉 단위로 대략 바꾸는 계수 (2026년 기준 대략값)
const TOKEN_SCALE = {
  salary: 1, avg_wage: 1, income: 1, cash: 1, avg_wage_month: 1 / 12, min_wage: 1 / 4300, min_wage_month: 0.048, min_wage_year: 0.55,
  house_seoul: 20, house_local: 6, house: 10, house_mine: 10, rent_month: 0.03, krw26: 1 / 45e6, networth: 3, allowance: 0.03, living: 0.3,
};
const LEVEL_NAME = ['없음', '낮음', '보통', '높음'];

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).sort().flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : n.endsWith('.json') ? [p] : [];
  });
}
const asArray = (v) => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);

// 사건 읽기
const events = [];
const byId = new Map();
for (const f of walk(join(DATA, 'events'))) {
  const file = relative(DATA, f).replace(/\\/g, '/');
  const list = JSON.parse(readFileSync(f, 'utf8'));
  for (const ev of list) { events.push({ ev, file }); byId.set(ev.id, { ev, file }); }
}

// 플래그를 읽는 곳: 사건·선택지 when, 업적 when, 엔진 코드
const readers = new Map(); // flag → Set(읽는 곳)
const addReader = (flag, who) => { if (!readers.has(flag)) readers.set(flag, new Set()); readers.get(flag).add(who); };
const whenFlags = (w) => (w ? [...asArray(w.flag), ...asArray(w.not_flag), ...asArray(w.flag_any)] : []);
for (const { ev } of events) {
  for (const f of whenFlags(ev.when)) addReader(f, ev.id);
  for (const c of ev.choices ?? []) for (const f of whenFlags(c.when)) addReader(f, ev.id);
}
const achFile = join(DATA, 'achievements.json');
if (existsSync(achFile)) for (const a of JSON.parse(readFileSync(achFile, 'utf8')).items ?? []) for (const f of whenFlags(a.when)) addReader(f, `업적 ${a.id}`);
for (const f of readdirSync(join(ROOT, 'js')).filter((n) => n.endsWith('.js'))) {
  const src = readFileSync(join(ROOT, 'js', f), 'utf8');
  for (const m of src.matchAll(/\b(?:flags|f)\.([a-z][a-z0-9_]+)/g)) addReader(m[1], `엔진 ${f}`);
  for (const m of src.matchAll(/(?:hasFlag\(s, |rehired\()'([a-z][a-z0-9_]+)'/g)) addReader(m[1], `엔진 ${f}`);
}
const flagRead = (flag, self) => [...(readers.get(flag) ?? [])].some((w) => w !== self);

function moneyLevel(v) {
  if (typeof v !== 'string') return v ? 1 : 0;
  const m = /^-?@([a-z_0-9]+)(?:\*(-?\d+(?:\.\d+)?))?$/.exec(v.trim());
  if (!m) return 0;
  const x = Math.abs((TOKEN_SCALE[m[1]] ?? 1) * (m[2] !== undefined ? Number(m[2]) : 1));
  return x >= 0.3 ? 3 : x >= 0.05 ? 2 : x > 0 ? 1 : 0;
}

// 효과 묶음 하나의 점수와 이유
function effectLevel(eff, selfId, seen) {
  let lv = 0;
  const why = [];
  const up = (n, w) => { if (n > lv) { lv = n; why.length = 0; } if (n === lv && n > 0 && w) why.push(w); };
  for (const [k, v] of Object.entries(eff ?? {})) {
    if (k === 'do') {
      for (const a of asArray(v)) {
        const s = String(a);
        if (NOOP_DO.has(s) || s.startsWith('again:')) continue;
        const verb = s.split(':')[0];
        up(HIGH_DO.has(verb) ? 3 : 2, `do ${s}`);
        const amt = s.split(':').at(-1);
        if (amt.includes('@')) up(Math.min(moneyLevel(amt), 3), `돈 ${amt}`);
      }
    } else if (k === 'later') up(3, 'later');
    else if (k === 'goto') {
      const t = byId.get(v);
      if (t && !seen.has(v)) { const r = eventLevel(t.ev, new Set([...seen, v])); up(r.level, `goto ${v}`); }
    } else if (k === 'cash' || k === 'debt') up(moneyLevel(v), `돈 ${v}`);
    else if (STATS.includes(k)) up(Math.abs(v) >= 5 ? 2 : v ? 1 : 0, `${k} ${v}`);
    else if (k.startsWith('trait.')) up(Math.abs(v) >= 15 ? 2 : v ? 1 : 0, `${k} ${v}`);
    else if (k === 'happiness' || k === 'friends') up(Math.abs(v) >= 8 ? 2 : v ? 1 : 0, `${k} ${v}`);
    else if (k === 'reputation') up(Math.abs(v) >= 5 ? 2 : v ? 1 : 0, `${k} ${v}`);
    else if (k === 'title_progress') up(2, '칭호 진행');
    else if (k.startsWith('skill.')) up(2, 'R&D 스킬');
    else if (k === 'flag') for (const f of asArray(v)) up(flagRead(f, selfId) ? 2 : 1, `플래그 ${f}`);
    else if (k === 'semi') up(1, '반도체 순간');
  }
  return { level: lv, why };
}
const memo = new Map();
function eventLevel(ev, seen = new Set([ev.id])) {
  if (memo.has(ev.id)) return memo.get(ev.id);
  let best = { level: 0, why: [], choice: null };
  for (const c of ev.choices ?? []) {
    for (const eff of [c.effects, c.fail?.effects]) {
      const r = effectLevel(eff, ev.id, seen);
      if (r.level > best.level) best = { ...r, choice: c.label };
    }
  }
  if (seen.size === 1) memo.set(ev.id, best);
  return best;
}

// 판정
const rows = events.map(({ ev, file }) => {
  const r = eventLevel(ev);
  const prot = PROTECTED.has(file);
  const trivial = r.level <= 1 && !prot && !ev.trigger;
  return { id: ev.id, file, ev, level: r.level, why: r.why, choice: r.choice, trivial, rescued: trivial && !!RESCUE[ev.id] };
});
// 켜진 사건이 later·goto로 부르는 사건은 켜 둠 (반복해서 퍼뜨림)
const on = (r) => !r.trivial || r.rescued || r.calledBy;
for (let changed = true; changed;) {
  changed = false;
  for (const r of rows) {
    if (!on(r)) continue;
    for (const c of r.ev.choices ?? []) for (const eff of [c.effects, c.fail?.effects]) {
      const targets = [...asArray(eff?.later).map((l) => l?.event), eff?.goto].filter(Boolean);
      for (const t of targets) {
        const tr = rows.find((x) => x.id === t);
        if (tr && !on(tr)) { tr.calledBy = r.id; changed = true; }
      }
    }
  }
}
for (const id of Object.keys(RESCUE)) if (!byId.has(id)) console.warn(`경고: RESCUE에 없는 사건 id ${id}`);
const notTrivialRescue = Object.keys(RESCUE).filter((id) => rows.find((r) => r.id === id && !r.trivial));
if (notTrivialRescue.length) console.warn(`참고: 이미 켜져 있어 RESCUE가 필요 없는 사건 ${notTrivialRescue.join(', ')}`);

const disabled = rows.filter((r) => r.trivial && !r.rescued && !r.calledBy);
const reasonOf = (r) => `영향 ${LEVEL_NAME[r.level]}: ${r.level ? `가장 큰 선택지도 ${[...new Set(r.why)].slice(0, 3).join(', ')} 정도` : '효과가 거의 없음'}`;

// 파일별 개수
const files = [...new Set(rows.map((r) => r.file))];
console.log('파일별 사건 수 (전체 · 꺼짐 · 손으로 살림 · 이어지는 결과라 켬 · 남음)');
for (const f of files) {
  const rs = rows.filter((r) => r.file === f);
  const off = rs.filter((r) => disabled.includes(r)).length;
  console.log(`  ${f.padEnd(28)} ${String(rs.length).padStart(4)} · 꺼짐 ${String(off).padStart(3)} · 살림 ${String(rs.filter((r) => r.rescued).length).padStart(2)} · 이어짐 ${String(rs.filter((r) => r.calledBy && r.trivial && !r.rescued).length).padStart(2)} · 남음 ${String(rs.length - off).padStart(3)}`);
}
console.log(`  합계 ${rows.length}개 중 ${disabled.length}개 꺼짐, ${rows.filter((r) => r.rescued).length}개 손으로 살림 → ${rows.length - disabled.length}개 남음`);
const lv = [0, 1, 2, 3].map((n) => rows.filter((r) => r.level === n).length);
console.log(`  영향 분포: 없음 ${lv[0]} · 낮음 ${lv[1]} · 보통 ${lv[2]} · 높음 ${lv[3]}`);

// 무작위 예시 15개 (시드 고정)
let seed = 20261022;
const rnd = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };
const sample = [...disabled].sort(() => rnd() - 0.5).slice(0, 15);
console.log('\n꺼지는 사건 예시 15개');
for (const r of sample) console.log(`  ${r.id} (${r.file}) — ${r.ev.text.replace(/\s+/g, ' ').slice(0, 40)}… · ${reasonOf(r)}`);
if (LIST) {
  console.log('\n꺼지는 사건 전체');
  for (const r of disabled) console.log(`  ${r.file}\t${r.id}\t${r.ev.text.replace(/\s+/g, ' ').slice(0, 50)}`);
}
if (args.includes('--kept')) {
  console.log('\n켜 두는 사건 (큰 줄기 파일·trigger 제외)');
  for (const r of rows) if (!disabled.includes(r) && !PROTECTED.has(r.file) && !r.ev.trigger) console.log(`  ${r.file}\t${r.id}\t${LEVEL_NAME[r.level]}\t${r.rescued ? '손으로 살림' : r.calledBy ? `이어짐(${r.calledBy})` : [...new Set(r.why)].slice(0, 3).join(', ')}`);
}

const out = {
  _note: '인생에 영향 없는 소소한 사건을 지우지 않고 끄는 목록입니다. life/tools/curate.mjs가 만들고 엔진(data.js)은 이 id를 읽지 않습니다. 규칙: 선택지마다 영향 점수(높음=인생을 바꾸는 do·later·큰 돈, 보통=작은 do·돈 5%↑·능력치 ±5·성향 ±15·다른 사건이 읽는 플래그, 낮음=반도체 순간·작은 수치)를 매겨 가장 큰 선택지가 낮음 이하이고 major·drama·milestones·trigger가 아니면 끕니다. 손으로 살린 사건은 rescued에 있습니다. 다시 켜려면 curate.mjs의 RESCUE에 넣고 다시 돌리세요.',
  rule: '사건 영향 = 가장 큰 선택지의 영향. 낮음 이하 + 큰 줄기 파일 아님 + trigger 없음 → 끔',
  disabled: disabled.map((r) => ({ id: r.id, file: r.file, reason: reasonOf(r) })),
  rescued: rows.filter((r) => r.rescued).map((r) => ({ id: r.id, file: r.file, reason: RESCUE[r.id] })),
};
if (!DRY) {
  // 사람이 훑어보기 쉽게 항목 하나를 한 줄로
  const lines = (arr) => arr.map((x) => `    ${JSON.stringify(x)}`).join(',\n');
  const text = `{\n  "_note": ${JSON.stringify(out._note)},\n  "rule": ${JSON.stringify(out.rule)},\n  "disabled": [\n${lines(out.disabled)}\n  ],\n  "rescued": [\n${lines(out.rescued)}\n  ]\n}\n`;
  JSON.parse(text);
  writeFileSync(OUT, text);
  console.log(`\n${relative(join(ROOT, '..'), OUT)}에 ${disabled.length}개를 썼어요.`);
}
