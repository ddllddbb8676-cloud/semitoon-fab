# T01 직업별 사건 약 240개

## 목적
세미툰 라이프는 "누구든 한 번은 반도체와 만난다"가 핵심입니다. 직업마다 그 일을 해 본 사람이 "맞아, 이랬지" 할 사건이 있어야 합니다. Claude가 생애 단계별 일상 사건(`life/data/events/<stage>.json`)을 쓰고 있으니, 당신은 **직업에 붙는 사건**을 씁니다.

## 읽을 파일
`life/tasks/gpt/README.md`, `life/docs/SPEC.md`, `life/docs/EVENTS.md`(형식), `life/data/jobs.json`(직업 40개), `life/data/companies.json`, `life/data/market_history.json`(연도별 시황 점수), 이미 있으면 `life/data/events/*.json`(겹치지 않게).

## 할 일
- `jobs.json`의 직업 40개마다 **6개씩**, 총 약 240개.
- 직업 하나의 6개 구성: 첫 출근·적응 1, 일상 업무 2, 사람(상사·동료·고객·원청) 1, 시황 연동 1(`market` 조건으로 호황 또는 불황일 때만), 그 직업다운 웃픈 순간 1.
- 조건은 `when.job`으로 그 직업에만 뜨게. 교대근무 직업(`shift: true`)은 야간 사건을 꼭 넣기.
- 협력사 직업(식당·보안·건설·세탁·통근버스)은 "원청" 관계가 드러나게. 원청 이름은 `{company}` 자리표시.
- 선택지 2~3개, `default` 필수, 효과는 작게(능력치 ±1~5, 성향 축 ±5~15, 행복 ±1~10, 평판 ±1~5). 돈은 `"@salary*0.1"` 같은 상대값만.
- 반도체와 닿는 순간은 `"semi": "짧은 기록"` 효과로 남기기 (되돌아보기 카드에 씀). 직업 사건의 절반 이상에 넣기.
- id는 `job_<직업id>_<내용>` (예: `job_operator_first_night`).

## 저장 위치
`life/data/events/gpt/jobs_<그룹>.json` 다섯 파일 (그룹: `field`=현장, `office`=사무, `trade`=기능직, `service`=서비스, `eco`=생태계). 각 파일은 사건 JSON 배열.

## 검사
`node life/tools/validate.mjs` 오류 0개. PR 설명에 직업별 개수 표를 붙이기.
