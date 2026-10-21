# T11 세부 직업 설명·현업 호칭 + 직업 500개 더 늘리기

## 목적
반도체 직업은 `life/data/job_matrix.json`에서 **직무 × 축(제품·공정·소재·패키징·설계 제품·인프라·시공 계통·사업·근무지·분야)** 조합으로 1,466개가 만들어집니다 (예: "D램 EUV 노광 공정 엔지니어", "가스 라인 오비탈 용접공"). 현업 사람이 보면 "맞아, 우리 팀 얘기네" 할 설명과 호칭이 필요하고, 직업 수도 2,000개 이상으로 늘립니다.

## 읽을 파일
`life/tasks/gpt/README.md`, `life/docs/SPEC.md`, `life/data/job_matrix.json`(구조와 `_note`), `life/data/jobs.json`(기본 직업 = parent), `life/data/companies.json`(분야 id). 펼친 목록은 `node life/tools/jobs_expand.mjs --list`.

## 할 일
1. **설명 파일** — 모든 직무(roles, 97개)와 모든 축 값에 대해:
   - 직무: `desc_ko`(한 줄), `day_ko`(하루 일과 3~5줄), `alias_ko`(현업에서 실제로 부르는 말, 예: "포토 PE", "설비 셋업", "YE"), `pros_ko`, `cons_ko`
   - 축 값: `desc_ko`(한 줄), `alias_ko`
   - 실제 회사 내부 정보(공정 조건, 수율 수치)는 쓰지 않습니다.
2. **확장 파일** — 새 직무와 새 축 값을 추가해 펼친 결과가 **2,000개 이상**이 되게 합니다. 기존 id는 바꾸거나 지우지 않고 새것만 추가합니다.
   - 새 축 값 예: 제품(MRAM, SiC 전력, GaN, 차량용 MCU 팹), 공정(웨이퍼 본딩, 레이저 어닐, 백사이드 파워), 근무지(해외 법인: 미국·대만·중국·유럽), 분야(EDA, 반도체 정책).
   - 새 직무 예: 클린룸 방진복 관리, 웨이퍼 반송(OHT) 정비, 팹 안전 순찰, 해외 법인 주재원, 장비 중고 딜러, 반도체 전문 변리사, 사내 어린이집 교사, 교대조 반장, 라인 파트장.
   - 형식은 `job_matrix.json`과 같음 (`dimensions`에 축별 새 값 배열, `roles`에 새 직무). parent는 반드시 `jobs.json`에 있는 id, sectors는 `companies.json`에 있는 id, 고용형태·학력은 `jobs.json` 목록 안에서.
   - 미래에만 생길 값은 `"future": true`와 대략 `since`를 넣습니다.

## 형식
설명 파일:
```json
{ "_note": "...", "roles": { "fab_pe": { "desc_ko": "", "day_ko": [""], "alias_ko": [""], "pros_ko": "", "cons_ko": "" } }, "dim_values": { "process.euv": { "desc_ko": "", "alias_ko": [""] } } }
```

## 저장 위치
- `life/data/job_matrix_text.json` (설명)
- `life/data/job_matrix_extra.json` (확장)

## 검사
`node life/tools/validate.mjs` 오류 0개, `node life/tools/jobs_expand.mjs`로 합계 2,000개 이상 확인. PR 설명에 그 출력 붙이기.
