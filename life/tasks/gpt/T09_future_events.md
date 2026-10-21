# T09 2027~2150 미래 사건

**시작 조건**: `life/docs/FUTURE.md`와 `life/data/future_tech.json`이 저장소에 올라온 뒤.

## 목적
2026년생은 2100년대까지 살고, "자녀로 이어 하기"로 2150년까지 갑니다. 미래 시대의 일상과 일터 사건이 필요합니다. 근거 있는 전망(~2060)과 가상 시나리오(2060~)를 FUTURE.md가 정해 두었으니 그 위에 사건을 씁니다.

## 읽을 파일
`life/tasks/gpt/README.md`, `life/docs/SPEC.md`, `life/docs/EVENTS.md`, `life/docs/FUTURE.md`, `life/data/future_tech.json`, `life/data/jobs.json`, `life/data/jobs_extra.json`(있으면).

## 할 일
- **기술 등장 사건 60개**: `future_tech.json`의 기술 노드마다 1~2개. "{company}가 CFET 양산을 발표했어요" 같은 뉴스형 + 내 직업에 닿는 선택형. 조건은 FUTURE.md가 정한 방식(기술 등장 flag 등)을 따름.
- **미래 일상 사건 60개**: 생애 단계별(어린이~노년). AI 선생님, 자율주행 통학, 로봇 동료, 초고령 사회, 인구 감소한 지방 도시 등. 연도 범위로 시대 구분.
- **미래 일터 사건 60개**: 무인 팹, 로봇 정비, AI 설계 도구, 양자칩 라인, 사라지는 직업과 재교육.
- 2060년 이후 사건은 FUTURE.md의 시나리오별로 나눠 쓰고, 지나친 SF(외계인, 순간이동 등)는 피함. "말이 되는 미래"가 기준.

## 저장 위치
`life/data/events/gpt/future_tech.json`, `future_life.json`, `future_work.json`

## 검사
`node life/tools/validate.mjs` 오류 0개.
