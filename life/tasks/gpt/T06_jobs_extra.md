# T06 직업 60개 추가 (사라진 직업 포함)

## 목적
1940년생부터 2026년생까지 살기 때문에 시대마다 있다가 사라진 직업이 필요합니다. 또 반도체와 닿는 길을 더 넓혀야 합니다.

## 읽을 파일
`life/tasks/gpt/README.md`, `life/docs/SPEC.md`, `life/data/jobs.json`(형식과 기존 40개 — 겹치지 않게), `life/data/companies.json`(sectors id).

## 할 일
- **반도체 관련 20개**: 기존에 없는 것. 예: 클린룸 필터 교체 기사, 특수가스 운반 기사, 반도체 장비 중고 딜러, 웨이퍼 운반(AMHS) 정비, 반도체 공장 소방대원, 사내 어린이집 교사, 반도체 교육 강사, 장비 부품 가공 선반공, 반도체 전문 변리사…
- **시대 직업 25개**: 생겼다 사라진 직업 포함 (`until` 사용). 예: 버스 안내양, 타자수, 전화 교환원, 다방 DJ, 비디오 가게 사장, PC방 사장, 삐삐 대리점, 연탄 배달…
- **일반 직업 15개**: 반도체 밖이지만 흔한 직업 (교사, 간호사, 공무원, 택시 기사, 농부, 개발자 등) — 반도체와 닿을 수 있는 연결을 `touch_ko`에 한 줄로.
- 각 직업: 기존 스키마 + `until`(사라지는 해, 없으면 생략) + `desc_ko`(한 줄 설명) + `touch_ko`(반도체와 닿는 방식).

## 형식
`jobs.json`의 `jobs` 항목과 같은 필드 (`id`, `name`, `group`, `touch`, `stats`, `education`, `sectors`, `employment`, `since`, 필요시 `shift`, `side_job`, `needs_wealth`) + `until`, `desc_ko`, `touch_ko`.

## 저장 위치
`life/data/jobs_extra.json` (`{ "_note": "...", "jobs": [ ... ] }`). id는 기존과 겹치면 안 됨.

## 검사
`node life/tools/validate.mjs` 오류 0개.
