// job_matrix.json(+ GPT가 만든 job_matrix_extra.json)을 세부 직업 목록으로 펼친다.
// 사용법: node life/tools/jobs_expand.mjs          → 분류별 개수
//         node life/tools/jobs_expand.mjs --list   → 전체 목록
import { readFileSync, existsSync } from 'node:fs';

const DATA = new URL('../data/', import.meta.url).pathname;
const read = (f) => JSON.parse(readFileSync(DATA + f, 'utf8'));

export function loadMatrix() {
  const m = read('job_matrix.json');
  if (existsSync(DATA + 'job_matrix_extra.json')) {
    const x = read('job_matrix_extra.json');
    for (const [dim, vals] of Object.entries(x.dimensions ?? {})) m.dimensions[dim] = [...(m.dimensions[dim] ?? []), ...vals];
    m.roles = [...m.roles, ...(x.roles ?? [])];
  }
  return m;
}

// 직무 하나를 축 값 조합으로 펼친다. 축 값의 only(다른 축 제한)와 직무의 only(쓸 값 제한)를 지킨다.
function combos(role, dims) {
  let out = [{}];
  for (const d of role.dims) {
    const allowed = role.only?.[d];
    const vals = (dims[d] ?? []).filter((v) => !allowed || allowed.includes(v.id));
    out = out.flatMap((c) => vals.map((v) => ({ ...c, [d]: v })));
  }
  return out.filter((c) => Object.values(c).every((v) =>
    Object.entries(v.only ?? {}).every(([od, ids]) => !c[od] || ids.includes(c[od].id))));
}

export function expandJobs(m = loadMatrix()) {
  const jobs = [];
  for (const role of m.roles) {
    for (const c of combos(role, m.dimensions)) {
      const vals = role.dims.map((d) => c[d]);
      const name = role.name.replace(/\{(\w+)\}/g, (_, d) => c[d]?.name ?? `{${d}}`);
      const sectors = role.sectors ?? [...new Set(vals.map((v) => v.sector).filter(Boolean))];
      jobs.push({
        id: [role.id, ...vals.map((v) => v.id)].join('.'),
        name, role: role.id, parent: role.parent, group: role.group, touch: role.touch,
        stats: role.stats, education: role.education, employment: role.employment,
        shift: role.shift ?? false, sectors,
        since: Math.max(role.since, ...vals.map((v) => v.since ?? 0)),
        future: vals.some((v) => v.future),
        dims: Object.fromEntries(role.dims.map((d) => [d, c[d].id])),
      });
    }
  }
  return jobs;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const jobs = expandJobs();
  if (process.argv.includes('--list')) {
    for (const j of jobs) console.log(`${j.since}  ${j.group}  ${j.name}  (${j.id})`);
  } else {
    const by = {};
    for (const j of jobs) by[j.role] = (by[j.role] ?? 0) + 1;
    const groups = {};
    for (const j of jobs) groups[j.group] = (groups[j.group] ?? 0) + 1;
    console.log('그룹별:', groups);
    console.log('2026년까지 열리는 직업:', jobs.filter((j) => j.since <= 2026).length, '/ 미래 직업:', jobs.filter((j) => j.future || j.since > 2026).length);
    const m = loadMatrix();
    const tracks = m.degree_tracks ? m.degree_tracks.levels.length * m.degree_tracks.dims.reduce((n, d) => n + (m.dimensions[d]?.length ?? 0), 0) : 0;
    console.log(`세부 직업 합계 ${jobs.length}개 (직무 ${Object.keys(by).length}개), 대학원 학위 전공 ${tracks}가지`);
  }
}
