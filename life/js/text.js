// 사건 문장의 자리표시 채우기 (담당: Claude) — SPEC "자리표시", SYSTEMS 1.4
// ctx는 사건 하나를 띄울 때 정해 둔 값(라이벌, 제안, 아이 이름 등)이라 문장과 결과가 같은 대상을 가리킵니다.

import { youngestChild } from './family.js';
import { josa, endsWithRieul } from './core.js';

export function placeholder(L, key, ctx = {}) {
  const { s, W, D } = L;
  switch (key) {
    case 'name': return s.profile.name;
    case 'year': return String(s.year);
    case 'age': return String(s.age);
    case 'company': {
      if (ctx.company) return W.companyName(ctx.company);
      const mine = s.career.job && !s.career.leave ? W.co(s.career.company) : null;
      return (mine ?? W.nearbyFab(s.profile.region))?.name ?? '반도체 회사';
    }
    case 'rival': return W.companyName(ctx.rival) || '경쟁사';
    case 'acquirer': return W.companyName(ctx.acquirer) || '새 회사';
    case 'client': return W.companyName(ctx.client ?? s.career.client) || W.nearbyFab(s.profile.region)?.name || '원청';
    case 'region': return D.regions.get(ctx.region ?? s.profile.region)?.name ?? '';
    case 'partner': return s.relations.partner?.name ?? '연인';
    case 'child': return ctx.child ?? youngestChild(s)?.name ?? '아이';
    case 'offer1': case 'offer2': case 'offer3': return ctx.offers?.[Number(key.slice(-1)) - 1]?.label ?? '';
    case 'tech': return ctx.tech ?? W.latestTech(s.year)?.name_ko ?? '새 기술';
    case 'skill': return ctx.skill ?? D.future.skills[0]?.name_ko ?? '새 스킬';
    default: return null;
  }
}

// 자리표시 바로 뒤의 조사는 채운 말의 받침에 맞게 고칩니다 ({partner}가 → 최상철이)
// (조사 뒤에 한글이 바로 이어지면 '이랑'처럼 다른 말일 수 있어 건드리지 않음)
const PAIRS = [['이에요', '예요'], ['으로', '로'], ['이', '가'], ['을', '를'], ['은', '는'], ['과', '와']];
const PARTICLE = new RegExp(`\\{(\\w+)\\}(?:(${PAIRS.flat().join('|')})(?![가-힣]))?`, 'g');
export function fill(L, text, ctx = {}) {
  if (!text) return '';
  return String(text).replace(PARTICLE, (m, k, p) => {
    const v = placeholder(L, k, ctx);
    if (v === null || v === undefined) return m;
    if (!p) return v;
    const pair = PAIRS.find((x) => x.includes(p));
    if (pair[0] === '으로') return endsWithRieul(v) ? `${v}로` : josa(v, '으로', '로');
    return josa(v, pair[0], pair[1]);
  });
}
