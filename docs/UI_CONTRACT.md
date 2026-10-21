# UI 계약서 — 로직(Claude) ↔ 디자인(GPT)

`js/ui.js`가 아래 요소를 찾아 **텍스트와 data-속성만** 바꿉니다. 모양은 전부 CSS 몫입니다.
여기 적힌 id·class는 지우거나 이름을 바꾸지 마세요. 감싸는 div나 장식 요소 추가는 자유입니다.
바꾸고 싶으면 `docs/REQUESTS.md`에 적어주세요.

## 고정 id

| id | 내용 | 예 |
|---|---|---|
| `#node-name` | 현재 공정 노드 | `3D NAND 24단` |
| `#money` | 보유 자금 | `123.4억원` |
| `#rate` | 초당 매출 | `5.2만원/초` |
| `#yield-avg` | 최근 평균 수율 | `86.2%` |
| `#throughput` | 라인 처리량 | `1.5 Lot/초`, `정지` |
| `#lot-value` | Lot 1개 가치(수율 적용 전) | `3.2만원` |
| `#conveyor` | 웨이퍼가 흐르는 띠 (`.wafer` 6개 포함, 개수 바꿔도 됨) | |
| `#tap-btn` | 웨이퍼 수동 투입 버튼 | |
| `#lot-feed` | 최근 Lot 목록 (`li.lot`이 위로 쌓임, 최대 6개) | |
| `#station-list` | 공정 스테이션 목록 (`li.station` 8개를 JS가 생성) | |
| `#event-banner` `#event-title` `#event-desc` `#event-timer` `#event-action` | 돌발 이벤트 | |
| `#prestige` `#prestige-info` `#prestige-btn` `#tech-points` | 노드 전환 | |
| `#achievement-list` `#achievement-count` | 칭호 | |
| `#toast-stack` | 토스트가 쌓이는 곳 | |
| `#modal` `#modal-title` `#modal-body` `#modal-close` | 알림창 | |
| `#reset-btn` | 처음부터 다시 | |

## 상태값 (CSS 선택자로 쓰세요)

### body
- `body[data-event="down|particle|rush|"]` — 진행 중인 이벤트
- `body[data-full-line="true"]` — 8공정이 모두 열림 (완성 칩 생산 중)
- `body.fx-golden`, `body.fx-scrap` — `js/fx.js`가 잠깐 붙이는 연출용 클래스 (GPT가 자유롭게 바꿔도 됨)

### 스테이션 `li.station`
JS가 만드는 구조:
```html
<li class="station" data-id="photo" data-index="2" data-state="running" data-affordable="true" style="--cycle: 2.00s">
  <div class="station__icon">2</div>          <!-- 숫자는 임시. 그림으로 바꾸려면 data-id별 배경이미지 추천 -->
  <div class="station__body">
    <div class="station__head"><span class="station__name">포토</span><span class="station__level">Lv.3</span></div>
    <div class="station__equip">Scanner</div>
    <div class="station__rate">1.0 Lot/초 · Lv.10에 속도 2배</div>
    <div class="station__bar"><span></span></div>
  </div>
  <button class="station__action"><span class="station__action-label">증설</span><span class="station__cost">4.0만원</span></button>
</li>
```
- `data-id`: `clean` `photo` `etch` `diff` `imp` `depo` `metal` `cmp`
- `data-state`:
  - `hidden` — 아직 멀리 있는 잠긴 공정
  - `locked` — 바로 다음에 열 수 있는 공정 (버튼 = 오픈)
  - `running` — 가동 중
  - `bottleneck` — 가동 중이고 라인에서 제일 느린 곳 (여기를 증설해야 함을 강조)
  - `down` — 장비 다운. 버튼 = 살리기
- `data-affordable="true|false"` — 버튼 비용을 낼 수 있는지
- `--cycle` — 이 스테이션이 Lot 하나 처리하는 시간. 진행바·장비 애니메이션 속도에 쓰세요

### 기타
- `#conveyor[data-running="true|false"]`, `--lot-interval` (Lot 나오는 간격, 초)
- `li.lot[data-kind="normal|golden|scrap"]` 안에 `.lot__tag` `.lot__yield` `.lot__value`
- `#event-banner[data-type="down|particle|rush"]`, `--time-left` (남은 시간 비율 0~1)
- `#prestige[data-ready="true|false"]`, `--progress` (0~1)
- `#prestige-btn[data-confirm="true"]` — 한 번 눌러 확인 대기 중
- `li.achievement[data-id][data-unlocked="true|false"]`
- `.toast[data-kind="info|good|bad|achievement"]`
- `#reset-btn[data-confirm="true"]`

## `fab:*` 이벤트 (js/fx.js에서 듣기)

```js
document.addEventListener('fab:golden', e => { /* e.detail = { kind, yield, value, source } */ });
```

| 이벤트 | detail | 언제 |
|---|---|---|
| `fab:lot` | `{ kind, yield, value, source: 'tap'｜'line' }` | Lot 하나 완성 (빠른 라인에선 초당 수십 번 — 무거운 연출 금지) |
| `fab:golden` | 위와 같음 | 골든 Lot (수율 99.9%, 가치 ×10) |
| `fab:scrap` | 위와 같음 | 스크랩 Lot (가치 0) |
| `fab:unlock` | `{ id }` | 공정 오픈 |
| `fab:upgrade` | `{ id, level }` | 증설 |
| `fab:milestone` | `{ id, level }` | 레벨 10·25·50·100·200 도달 (속도 2배) |
| `fab:eventStart` | `{ type, stationId?, tapsLeft?, target?, reward?, timeLeft }` | 돌발 이벤트 시작 |
| `fab:eventEnd` | `{ type, result: 'solved'｜'expired'｜'failed' }` | 이벤트 종료 |
| `fab:achievement` | `{ id, name, desc }` | 칭호 획득 |
| `fab:prestige` | `{ node: { id, name, short }, gain }` | 노드 전환 |
