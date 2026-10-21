# T02 업적·칭호 150개

## 목적
한 판이 끝나고 "다음엔 이걸 노려 볼까" 하게 만드는 수집 요소입니다. 되돌아보기 화면과 공유 이미지에 칭호가 크게 나옵니다.

## 읽을 파일
`life/tasks/gpt/README.md`, `life/docs/SPEC.md`(상태 필드, 성향 축), `life/docs/GAME_DESIGN.md`, `life/data/jobs.json`, `life/data/companies.json`, `life/data/market_history.json`.

## 할 일
- **업적 100개**: 한 인생에서 달성하는 것. 예: "1985년 D램 폭락을 버티고 살아남음", "용접공에서 설비 엔지니어로", "한 회사 정년퇴직", "파산 두 번", "반도체 순간 10개".
- **칭호 50개**: 인생 전체를 한마디로 부르는 이름. 되돌아보기에서 1개가 붙음. 예: "반도체 3대째", "공장 앞 치킨 재벌", "소신 엔지니어", "평택 원룸왕".
- 분포: 직업·커리어 35%, 시대·역사 사건 20%(실제 시황 해와 연결), 돈·투자·집 15%, 가족·관계 15%, 웃긴·희귀 15%.
- 희귀도 4단계: `common`, `rare`, `epic`, `legend` (대략 50/30/15/5%).
- 조건은 사람이 읽는 `condition_ko`로 정확하게 쓰고, SPEC 조건 키로 표현 가능하면 `when`도 함께. 판정 코드는 Claude가 만듭니다.

## 형식
```json
{ "id": "ach_survive_1985", "kind": "achievement", "name": "85년의 겨울", "desc": "D램 값이 폭락한 1985년에 메모리 회사에서 살아남았어요.", "condition_ko": "1985년 말에 sector=memory 회사 재직 중", "when": { "year": [1985, 1985], "sector": "memory" }, "rarity": "rare", "hidden": false }
```
`kind`는 `achievement` 또는 `title`. `hidden: true`면 달성 전에는 이름이 ???로 보임 (전체의 20% 정도).

## 저장 위치
`life/data/achievements.json` (`{ "_note": "...", "items": [ ... ] }`).

## 검사
`node life/tools/validate.mjs` 오류 0개.
