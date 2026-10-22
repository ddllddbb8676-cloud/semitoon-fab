# T16 직업·미래 사건을 "인생이 갈리는 순간"으로 (T01·T09 고쳐 쓰기)

## 목적
오너 결정(v0.3): **인생에 영향 없는 소소한 질문은 뺍니다.** 영향 검사 도구(`life/tools/curate.mjs`)로 재 보니 아래 사건이 "영향 낮음"이라 지금 게임에서 꺼져 있어요 (`life/data/event_curation.json`, 지우지 않고 끈 목록).

| 파일 | 전체 | 꺼짐 |
|---|---|---|
| `events/gpt/jobs_*.json` 5개 (직업 40개) | 280 | 280 |
| `events/gpt/future_life.json` | 60 | 60 |
| `events/gpt/future_work.json` | 60 | 40 |

문장은 좋아졌는데(T14·T15) 효과가 "평판 +2, 멘탈 −2" 수준이라 해도 안 해도 인생이 같아요. 직업마다 **그 일을 하는 사람이라서 인생이 갈리는 순간**을 3~4개씩 남기고, 나머지는 지웁니다.

## 읽을 파일
`life/tasks/gpt/README.md`, **`life/docs/WRITING_GUIDE.md`(필수)**, `life/docs/SPEC.md`(`do` 동작, 돈 상대값, `later`), `life/docs/EVENTS.md`의 "인생에 남는 사건만 (v0.3)", `life/tools/curate.mjs` 맨 위 주석(영향 규칙). 좋은 예: `life/data/events/milestones.json`, `life/data/events/drama.json` — 선택이 돈·직장·건강·관계를 바꾸고 몇 년 뒤 결과가 돌아옵니다.

## 할 일
1. **직업 사건** (`life/data/events/gpt/jobs_eco.json`, `jobs_field.json`, `jobs_office.json`, `jobs_service.json`, `jobs_trade.json`)
   - 직업마다 3~4개, 모두 120~160개. 이 직업이라서 겪는 갈림길: 사고와 책임, 승진·이직·스카우트, 몸이 상함(허리·손목·야간 근무), 큰돈(성과급·보상금·빚), 일과 가족 사이, 업황에 따라 감원·특근(`market` 조건).
   - **선택지 하나는 꼭 인생에 흔적**을 남깁니다. 아래 중 하나 이상:
     - `do`: `job:look`·`job:quit`·`job:transfer`·`job:rival`, `salary_mod:0.05`(연봉 보정 누적, ±0.03~0.1), `salary_mult:0.7:1`(일시 배율:년), `bonus:@salary*0.2`, 질병 `cond:+back_pain`·`cond:+injury`·`cond:+depression`·`cond:+hypertension`, 습관 `habit:+drinking`·`habit:+smoking`·`habit:+exercise`, `leave:parental`, `move:<region_id>`
     - `later`: 1~5년 뒤 돌아오는 결과 사건 (`{ "event": "<id>", "years": [1, 3], "chance": 0.7 }`)
     - 돈 `@salary*0.05` 이상, 능력치 ±5, 성향 ±15, 평판 ±5, 행복·친구 ±8
   - **얻는 것과 잃는 것이 함께**: 승진 대신 건강, 보상금 대신 평판, 가족 대신 연봉. 정답이 보이면 안 돼요.
   - 직업마다 1개 이상은 `later`로 이어지게 합니다. 돌아오는 결과 사건은 같은 파일에 `"weight": 0`으로 둡니다 (그래야 혼자 뜨지 않아요).
   - `once: true`(한 인생에 한 번), `recap`(연표에 남는 2~6글자 제목)을 넣습니다.
   - 나머지 소소한 사건은 **지웁니다**. 지운 id가 꺼진 목록에 남아 경고가 떠도 괜찮아요 (Claude가 머지할 때 목록을 다시 만듭니다).
2. **미래 생활·일터** (`life/data/events/gpt/future_life.json` 60 → 약 30, `future_work.json`의 꺼진 40 → 약 20)
   - 같은 규칙. 2027년 이후 사람의 인생이 갈리는 순간: 내 직무가 AI로 줄어듦(재교육·전직·버티기), 부모 돌봄과 돌봄 로봇, 공장 따라 이주, 기본소득·연금 변화, 수명 연장과 두 번째 직업.
   - 꺼진 사건 목록 보기: `node life/tools/curate.mjs --dry --list`
3. id는 그대로 써도 되고 새로 만들어도 됩니다. 조건(`when`·`year`·`age`·`market`)은 직업·시대에 맞게.

## 고치기 전후 예시
고치기 전 (꺼짐: 가장 큰 선택지도 평판 2, 멘탈 −2):
```json
{"id":"job_process_engineer_trend_note","when":{"job":"process_engineer"},"weight":1,"once":false,
 "text":"공정 측정표에 어제와 다른 점이 보여요. 교대 시간까지 변경 이력을 다 볼 수 있을까요?",
 "choices":[{"label":"이력을 끝까지 대조해요","effects":{"reputation":2,"mental":-2,"trait.diligence":5}},
            {"label":"표시를 남기고 다음 조에 넘겨요","effects":{"mental":2,"reputation":-1}}],"default":0}
```
고친 뒤 (켜짐: 연봉·평판·나중 결과가 갈림):
```json
{"id":"job_process_engineer_line_stop","year":[1974,null],"when":{"job":"process_engineer"},"weight":2,"once":true,
 "tags":["work"],"recap":"새벽의 라인 정지",
 "text":"새벽 3시, 내 구간 측정값이 관리선을 넘었어요. 라인을 세우면 하루 생산이 날아가고, 두면 이미 들어간 웨이퍼 수백 장이 위험해요.",
 "choices":[
  {"label":"라인을 세운다","effects":{"reputation":6,"mental":-6,"semi":"새벽 3시, 내 손으로 라인을 세웠어요",
    "later":{"event":"job_process_engineer_line_stop_after","years":[1,2],"chance":0.8}},
   "result":"생산팀장 전화가 열두 통 왔어요. 아침 회의에서 원인이 나오자 아무도 더 묻지 않았어요."},
  {"label":"표시만 하고 다음 조에 넘긴다","effects":{"mental":3,"reputation":-6,"do":"salary_mod:-0.03"},
   "result":"이틀 뒤 불량이 쏟아졌어요. 사고 보고서 맨 위에 우리 교대조 이름이 있었어요."}],"default":0}
{"id":"job_process_engineer_line_stop_after","year":[1974,null],"when":{"job":"process_engineer"},"weight":0,"once":true,
 "tags":["work"],"recap":"그날의 표창",
 "text":"그날 새벽 라인을 세운 일이 사내 품질 표창 후보에 올랐어요. 시상식 날짜가 아이 학예회와 겹쳐요.",
 "choices":[
  {"label":"시상식에 간다","effects":{"do":"salary_mod:0.05","reputation":5,"happiness":-4},"result":"상패를 받았어요. 학예회 영상은 밤에 혼자 봤어요."},
  {"label":"학예회에 간다","effects":{"happiness":8,"friends":3,"reputation":-2},"result":"맨 앞줄에서 손을 흔들었어요. 상패는 팀장이 대신 받아 책상에 올려 뒀어요."}],"default":0}
```

## 저장 위치
위 파일 그대로 (`life/data/events/gpt/jobs_*.json` 5개, `future_life.json`, `future_work.json`). 최신 `main`에서 `gpt/life-t16` 브랜치를 만들고 새 PR을 엽니다.

## 검사
- `node life/tools/validate.mjs` 오류 0개 (지운 사건이 꺼진 목록에 남았다는 경고는 괜찮음)
- `node life/tools/curate.mjs --dry`: `jobs_*`·`future_life`·`future_work`의 "꺼짐"이 0에 가깝게 (이 명령은 파일을 쓰지 않아요. `--dry` 없이 돌리지 마세요 — `event_curation.json`은 Claude 담당)
- PR 설명에 직업별 사건 수, 고치기 전후 예시 5개
