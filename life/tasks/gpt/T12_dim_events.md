# T12 직업 축별 사건 약 270개

## 목적
세부 직업이 1,466개(T11 후 2,000개 이상)라서 직업마다 사건을 쓸 수는 없습니다. 대신 **축 단위**로 씁니다. 예: `"job_dim": { "process": ["euv"] }` 사건은 "D램 EUV 노광 공정 엔지니어", "HBM EUV 노광 오퍼레이터" 등 EUV가 들어간 직업 전부에 뜹니다. 같은 포토라도 엔지니어와 오퍼레이터가 겪는 일이 다르니 `job_role`도 함께 씁니다.

## 읽을 파일
`life/tasks/gpt/README.md`, `life/docs/SPEC.md`(특히 `job_role`, `job_dim`), `life/docs/EVENTS.md`, `life/data/job_matrix.json`(+ 있으면 `job_matrix_extra.json`, `job_matrix_text.json`), `life/data/market_history.json`. 이미 있는 `life/data/events/` 사건과 겹치지 않게.

## 할 일
| 축 | 값마다 | 합계 약 |
|---|---|---|
| process (공정 20개) | 4개 (엔지니어용 2, 오퍼레이터·협력사 기사용 2) | 80 |
| product (제품 10개) | 4개 (시황 연동 1개 포함) | 40 |
| pkg (패키징 12개) | 2개 | 24 |
| design (설계 제품 12개) | 2개 | 24 |
| material (소재 10개) | 2개 | 20 |
| facility (인프라 10개) | 2개 | 20 |
| system (시공 계통 6개) | 3개 | 18 |
| 직무 묶음 (`job_role`: 설계 직무들, 장비사 직무들, 지원 직무들, 생태계 직무들) | 묶음마다 10개 | 40 |

- 기술 변화가 드러나게: 예) 1990년대 포토는 i-line·KrF, 2019년 이후 EUV, 2028년 이후 하이브리드 본딩. `year` 범위로 시대를 나눕니다.
- 시황 연동 사건은 `market` 조건 사용 (예: 메모리 -2일 때 감산·라인 축소, +2일 때 증설·특근).
- 반도체 순간 기록(`semi`)은 절반 이상에.
- 선택지 2~3개, `default` 필수. 돈은 상대값(`"@salary*0.1"`).
- **효과는 인생에 흔적이 남게** (v0.3 오너 결정: 소소한 질문은 뺀다). 선택지 하나는 꼭 `do`·`later`·돈 `@salary*0.05`↑·능력치 ±5·성향 ±15·평판 ±5 중 하나를 가져야 해요. 효과가 작으면 게임에서 꺼집니다 — 영향 규칙과 예시는 `T16_life_moments.md`, 확인은 `node life/tools/curate.mjs --dry`.
- id는 `dim_<축>_<값>_<내용>` 또는 `role_<묶음>_<내용>`.

## 저장 위치
`life/data/events/gpt/dims_process.json`, `dims_product.json`, `dims_pkg.json`, `dims_design.json`, `dims_material.json`, `dims_facility.json`, `dims_system.json`, `dims_roles.json`

## 검사
`node life/tools/validate.mjs` 오류 0개. PR 설명에 파일별 개수 표.
