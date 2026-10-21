# T13 2027~2150 세계관 서사와 미래 뉴스

**시작 조건**: `life/docs/FUTURE.md`가 저장소에 올라온 뒤.

## 목적
`FUTURE.md`는 2060년 이후를 4개 **세계 경로**(`future_scenarios.json`의 `world_paths`)로 나누고 규칙만 정해 두었습니다. 플레이어가 그 시대를 "살아 보는" 느낌을 주려면 시대별 생활상과 뉴스가 필요합니다. 근거 있는 전망(~2060)과 가상(2060~)을 구분해서, 말이 되게 씁니다.

## 읽을 파일
`life/tasks/gpt/README.md`, `life/docs/FUTURE.md`(특히 1·5·6·7·8장), `life/data/future_tech.json`, `life/data/future_scenarios.json`, `life/research/future/*.json`(근거), `life/data/market_history.json`(헤드라인 말투). 확인용: `node life/tools/future_sim.mjs 1`, `node life/tools/future_sim.mjs 2`.

## 할 일
1. **세계관 문서**: 2027~2059(공통 전망 구간) + 경로 4개 × 2060~2150을 10년 단위로. 10년마다: 한 줄 요약, 일상(집·통근·학교·병원·여가), 일터(팹·사무실·현장), 반도체 업계 모습, 한국 사회(인구·고령화·지방), 그 시대 사람들이 쓰는 말·유행 3개. 2060년 이전은 근거 노드·조사 출처를 괄호로, 이후는 "(가상)" 표시.
2. **미래 뉴스 헤드라인**: 경로별 × 10년 단위로 헤드라인 8개씩 (2027~2059 공통 40개 + 2060~2150 경로별 각 80개 안팎). 형식은 `market_history.json`의 `headline_ko` 말투. 실제 회사 이름 금지(`{company}` 사용).
3. **미래 직업 설명**: `FUTURE.md` 8장의 "미래에 생기는 직업" 각각에 `desc_ko`, `day_ko`(하루 3줄), 필요한 스킬(스킬 id).

## 형식
```json
{ "_note": "...", "common": [ { "decade": 2030, "headlines_ko": ["..."] } ], "paths": { "<path id>": [ { "decade": 2060, "headlines_ko": ["..."] } ] }, "future_jobs": [ { "name_ko": "", "since": 2040, "desc_ko": "", "day_ko": [""], "skills": ["<skill id>"] } ] }
```

## 저장 위치
- `life/docs/FUTURE_WORLD.md` (1)
- `life/data/future_news.json` (2, 3)

## 검사
`node life/tools/validate.mjs` 오류 0개 (JSON 문법). 스킬 id는 `future_tech.json`의 `skills`에 있는 것만.
