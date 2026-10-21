# T09 2027~2150 미래 사건

**시작 조건**: `life/docs/FUTURE.md`와 `life/data/future_tech.json`이 저장소에 올라온 뒤.

## 목적
2026년생은 2100년대까지 살고, "자녀로 이어 하기"로 2150년까지 갑니다. 미래 시대의 일상과 일터 사건이 필요합니다. 근거 있는 전망(~2060)과 가상 시나리오(2060~)를 FUTURE.md가 정해 두었으니 그 위에 사건을 씁니다.

## 읽을 파일
`life/tasks/gpt/README.md`, `life/docs/SPEC.md`, `life/docs/EVENTS.md`, `life/docs/FUTURE.md`, `life/data/future_tech.json`, `life/data/jobs.json`, `life/data/jobs_extra.json`(있으면), 확인용 `node life/tools/future_sim.mjs 1`(한 판의 미래 연표 출력).

## 할 일
- **기술 등장 사건 60개**: `future_tech.json`의 기술 노드마다 1~2개. "{company}가 {tech} 양산을 발표했어요" 같은 뉴스형 + 내 직업에 닿는 선택형. 조건은 SPEC의 미래 키: `tech_since: { "<노드 id>": [0, 1] }`(등장한 해·이듬해), `skill_min`, `job_dim`, `trigger: "tech_commercialized"`(내 연구 상용화) 등.
- **미래 일상 사건 60개**: 생애 단계별(어린이~노년). AI 선생님, 자율주행 통학, 로봇 동료, 초고령 사회, 인구 감소한 지방 도시 등. 연도 범위로 시대 구분.
- **미래 일터 사건 60개**: 무인 팹, 로봇 정비, AI 설계 도구, 양자칩 라인, 사라지는 직업과 재교육.
- 시나리오 사건은 `scenario_active`, 2060년 이후는 `world_path`(경로 4개)로 나눠 씀. 지나친 SF(외계인, 순간이동 등)는 피함. "말이 되는 미래"가 기준.
- 대만 위기·전쟁·팬데믹·대량 실직 시나리오는 무겁게, 존중하며. 웃음 포인트로 쓰지 않음.
- 사라지는 직업은 `job_demand_max`, 재교육은 `do: "skill:retrain:<from>:<to>"`, 스킬 보상은 `"skill.<id>": 1` 효과.

## 저장 위치
`life/data/events/gpt/future_tech.json`, `future_life.json`, `future_work.json`

## 검사
`node life/tools/validate.mjs` 오류 0개.
