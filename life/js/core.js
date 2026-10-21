// 공용 상수·도구·상태 헬퍼 (담당: Claude, DOM 없음)
// 엔진 모듈 함수는 대부분 L = { D, s, W, rng, emit } (런타임 묶음)을 첫 인자로 받습니다.
//   D = 데이터(data.js), s = 저장되는 인생 상태, W = 세계(world.js), rng = 인생 난수, emit = 연출 이벤트

export const STATS = ['health', 'intelligence', 'dexterity', 'sociability', 'mental', 'looks'];
export const STAT_NAMES = { health: '체력', intelligence: '지능', dexterity: '손재주', sociability: '사교성', mental: '멘탈', looks: '외모' };
export const AXES = ['diligence', 'risk', 'thrift', 'work_life', 'social', 'outlook', 'conform'];
// [-쪽 특징, +쪽 특징] (SPEC 성향 축)
export const TRAIT_NAMES = {
  diligence: ['느긋함', '성실함'], risk: ['안정 추구', '모험가'], thrift: ['큰손', '짠돌이'], work_life: ['가정적', '워커홀릭'],
  social: ['혼자가 편함', '인싸'], outlook: ['걱정 많음', '낙천적'], conform: ['반골', '순응형'],
};
export const STAGES = [
  { id: 'infant', name: '유아', from: 1, to: 6 },
  { id: 'child', name: '어린이', from: 7, to: 12 },
  { id: 'teen', name: '청소년', from: 13, to: 19 },
  { id: 'young', name: '청년', from: 20, to: 34 },
  { id: 'middle', name: '중년', from: 35, to: 59 },
  { id: 'senior', name: '노년', from: 60, to: 999 },
];
export const EDU = ['무관', '고졸', '전문대졸', '대졸', '석사', '박사'];
export const SEMI_KINDS = ['core', 'near', 'eco', 'family', 'money', 'school', 'place', 'history', 'everyday'];
export const KIND_NAMES = { core: '현장', near: '주변', eco: '생태계', family: '가족', money: '돈', school: '학교', place: '동네', history: '뉴스', everyday: '일상' };

export const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
export const logistic = (z) => 1 / (1 + Math.exp(-z));
export const round1 = (x) => Math.round(x * 10) / 10;
export const eduIdx = (level) => Math.max(0, EDU.indexOf(level));
export const stageOf = (age) => STAGES.find((st) => age >= st.from && age <= st.to)?.id ?? 'infant';
export const stageName = (id) => STAGES.find((st) => st.id === id)?.name ?? '';

// [[x, y], ...] 표를 선형 보간 (양끝은 고정)
export function lerpTable(table, x) {
  if (x <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    if (x <= table[i][0]) {
      const [x0, y0] = table[i - 1];
      const [x1, y1] = table[i];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return table[table.length - 1][1];
}
// [[x, y], ...] 계단표: x 이상인 마지막 행
export function stepTable(table, x) {
  let v = table[0][1];
  for (const [k, val] of table) if (x >= k) v = val;
  return v;
}
export const inRange = (v, r) => !r || ((r[0] === null || r[0] === undefined || v >= r[0]) && (r[1] === null || r[1] === undefined || v <= r[1]));
export const asArray = (v) => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);

// 받침 유무로 조사 고르기: josa('하이닉수', '이', '가') → '하이닉수가'
export function josa(word, withBatchim, without) {
  const w = String(word ?? '');
  const core = w.replace(/[)\]」』"'”’\s]+$/, '');
  const ch = core.charCodeAt(core.length - 1);
  if (ch >= 0xac00 && ch <= 0xd7a3) return w + (((ch - 0xac00) % 28) ? withBatchim : without);
  return w + (/[0136780lmnLMN]$/.test(core) ? withBatchim : without);
}
// 받침이 ㄹ이면 '로' (예: 서울로, 기술로)
export function endsWithRieul(word) {
  const w = String(word ?? '').replace(/[)\]」』"'”’\s]+$/, '');
  const ch = w.charCodeAt(w.length - 1);
  return ch >= 0xac00 && ch <= 0xd7a3 && (ch - 0xac00) % 28 === 8;
}

// ---------- 성향과 특징 ----------

// 특징 상태: s.traitsOn[axis] = '+' | '-' | undefined (50에서 붙고 40 밑으로 내려가야 사라짐)
export const hasTrait = (s, axis, sign) => s.traitsOn?.[axis] === sign;
export function traitLabel(axis, sign, value) {
  const name = TRAIT_NAMES[axis][sign === '+' ? 1 : 0];
  return Math.abs(value ?? 0) >= 80 ? `아주 ${name}` : name;
}
export function activeTraits(s) {
  return AXES.filter((a) => s.traitsOn?.[a]).map((a) => ({ axis: a, sign: s.traitsOn[a], value: s.traits[a], name: TRAIT_NAMES[a][s.traitsOn[a] === '+' ? 1 : 0] }));
}

// ---------- 상태 ----------

export const inSchool = (s) => !!s.education.stage;
export const serving = (s) => s.military.status === 'serving';
export const employed = (s) => !!s.career.job && s.career.employment !== 'owner';
export const isOwner = (s) => !!s.career.job && s.career.employment === 'owner';

// career.status (SPEC): student|military|employed|owner|unemployed|homemaker|retired (+ child: 아직 어린이)
export function statusOf(s) {
  if (s.retired) return 'retired';
  if (serving(s)) return 'military';
  if (inSchool(s)) return 'student';
  if (s.career.job) return s.career.employment === 'owner' ? 'owner' : 'employed';
  if (s.homemaker) return 'homemaker';
  if (s.age < 13) return 'child';
  return 'unemployed';
}

// is_ 상태 플래그는 저장하지 않고 상태에서 바로 계산합니다 (SYSTEMS 1.6)
export function stateFlag(s, f) {
  const st = s.education.stage;
  const next = s.education.next?.stage;
  switch (f) {
    case 'is_student': return inSchool(s);
    case 'is_hs': return st === 'hs' || next === 'hs';
    case 'is_college': return st === 'college' || next === 'college';
    case 'is_jc': return st === 'jc' || next === 'jc';
    case 'is_grad': return st === 'master' || st === 'phd' || next === 'master' || next === 'phd';
    case 'is_military': return serving(s);
    case 'is_employed': return !!s.career.job && s.career.employment !== 'owner' && !s.career.leave;
    case 'is_owner': return isOwner(s);
    case 'is_unemployed': return statusOf(s) === 'unemployed';
    case 'is_homemaker': return statusOf(s) === 'homemaker';
    case 'is_retired': return !!s.retired;
    case 'is_married': return !!s.relations.partner?.married;
    case 'is_rejected': return s.yearFlags?.is_rejected === true;
    default: return false;
  }
}
export function hasFlag(s, f) {
  if (f.startsWith('is_')) return stateFlag(s, f);
  return !!s.flags[f];
}
export function addFlag(s, f) {
  if (!f || f.startsWith('is_')) return;
  s.flags[f] = s.year;
}

// ---------- 기록 ----------

export function addLog(L, text, importance = 1, kind = 'life', eventId = null) {
  const s = L.s;
  const item = { year: s.year, age: s.age, text, importance, kind, event_id: eventId };
  s.log.push(item);
  L.emit?.('log', item);
  return item;
}

// 반도체 순간 (SYSTEMS 7). 같은 해 같은 문장은 한 번만.
export function addSemi(L, text, kind = 'place', eventId = null) {
  const s = L.s;
  if (!text) return null;
  if (s.semi.some((m) => m.text === text && m.year === s.year)) return null;
  const item = { year: s.year, age: s.age, text, kind: SEMI_KINDS.includes(kind) ? kind : 'place', event_id: eventId };
  s.semi.push(item);
  s.flags.semi_touched = s.flags.semi_touched ?? s.year;
  if (!eventId) addLog(L, `반도체 순간: ${item.text}`, 1, 'semi');
  L.emit?.('semi', item);
  return item;
}

// 지원하지 않는 do·조건은 콘솔에 한 번만 알립니다
const warned = new Set();
export function warnOnce(key, msg) {
  if (warned.has(key)) return;
  warned.add(key);
  if (typeof console !== 'undefined') console.info(`[life] ${msg}`);
}
export const warnedKeys = () => [...warned];
