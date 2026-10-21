# UI 계약서 (life/) — 로직(Claude) ↔ 디자인(GPT)

`life/js/ui.js`가 아래 요소를 찾아 **글자와 data-속성, CSS 변수만** 바꿉니다. 모양은 전부 CSS 몫입니다.
여기 적힌 id·class·data-속성은 지우거나 이름을 바꾸지 마세요. 감싸는 div나 장식 요소 추가는 자유입니다.
바꾸고 싶으면 `life/docs/REQUESTS.md`에 적어 주세요.

- 지금 스타일 `life/css/proto.css`는 **임시**입니다. GPT가 `life/css/tokens.css` + `life/css/style.css`를 만들면 `index.html`의 `<link>`를 바꾸고 proto.css는 지웁니다.
- CSS 맨 위의 `[hidden] { display: none !important; }`는 꼭 남겨 주세요.
- 연출 파일 `life/js/fx.js`(GPT)를 만들면 `index.html` `<head>`의 주석 자리에 `<script type="module" src="js/fx.js"></script>`를 넣습니다. fx.js는 아래 `life:*` 이벤트를 **듣기만** 합니다 (엔진·저장에 손대지 않음).
- 외부 리소스는 Google Fonts만 (지금 Jua, Gowun Dodum).

## body 상태값 (CSS 선택자로 쓰세요)
| 속성 | 값 | 뜻 |
|---|---|---|
| `body[data-screen]` | `loading` `title` `create` `main` `ending` | 지금 화면 |
| `body[data-stage]` | `infant` `child` `teen` `young` `middle` `senior` | 생애 단계 (SPEC) |
| `body[data-speed]` | `0` `1` `2` `4` `8` | 배속 (0 = 멈춤) |
| `body[data-paused]` | `true` `false` | 시계가 멈췄는지 (멈춤 버튼 또는 큰 사건) |
| `body[data-event]` | `small` `big` 빈 값 | 열린 사건 카드 |

## 화면 (`section.screen`, 한 번에 하나만 보임)
| id | 화면 |
|---|---|
| `#screen-loading` | 데이터 불러오는 중 |
| `#screen-title` | 타이틀 |
| `#screen-create` | 캐릭터 만들기 (1단계 `#create-step1`, 2단계 `#create-step2`) |
| `#screen-main` | 인생 진행 |
| `#screen-ending` | 엔딩·되돌아보기 |

### 타이틀
`#continue-info` (이어 하기 가능할 때 "이름 · 나이 · 연도"), `#btn-continue`, `#btn-new`, `#title-error`.

### 캐릭터 만들기
- 1단계: `#input-name`, `#input-year`(range 1940~2026), `#year-value`, `#create-headline`(그 해 업계 뉴스, 패러디 이름), `#create-world`(같은 세계로 시작할 때만), `#btn-roll`, `#btn-create-back`
- 2단계: `#candidate-list`, `#btn-reroll` 안의 `#reroll-left`, `#btn-start`, `#btn-back`
- 후보 카드 (JS가 만듦, 최대 4장):
```html
<li class="candidate" data-index="1" data-selected="true" role="button" tabindex="0">
  <div class="candidate__head"><span>남 · 수원·성남</span><span class="semi-mark">공장 동네</span></div>
  <p class="candidate__line">아버지 <b>회사원</b> · 어머니 <b>반도체 생산직</b><span class="semi-mark"> ★반도체</span></p>
  <p class="candidate__line">형편 <b>여유</b> · 화목 <b>77</b> · 형제 <b>4명</b> · 재능 <b>???</b></p>
  <div class="candidate__stats"><span>체력 65</span> … 6개</div>
</li>
```

### 메인
| id / class | 내용 |
|---|---|
| `#hud` | 위쪽 고정 영역 |
| `#life-name` `#life-age` `#life-year` `#life-stage` | 이름 · `34세` · `2013년` · `청년` |
| `#year-progress` | 그 해 진행 막대. `style="--p: 0.42"` (0~1). 안에 `.progress__bar` |
| `#speed-controls` › `.speed-btn[data-speed]` | `0 1 2 4 8`. 지금 배속 버튼은 `data-active="true"` |
| `#headline` | 그 해 업계 헤드라인 1줄 (`뉴스 · …`, 없으면 빈 칸) |
| `#status-line` | 지금 상태 한 줄 (학교·학년 / 회사 · 직종 · 직급 (고용형태) / 은퇴 …) |
| `#money-line` | 현금 · 빚 · 집 · 주식 · 회사 실적 (어린이는 안내 문구) |
| `#stat-list` › `li.stat[data-stat]` | `health intelligence dexterity sociability mental looks happiness`. `.stat__bar`에 `--v`(0~100), `.stat__value`에 숫자 |
| `#tabs` › `.tab[data-tab]` | `feed me work family industry`, 고른 탭은 `aria-selected="true"` |
| `#panel-feed` › `#feed` | 연표 피드. 새 항목이 위에 붙음 (최대 200개) |
| `#panel-me` `#panel-work` `#panel-family` `#panel-industry` | 탭 내용 (JS가 통째로 다시 그림, 아래 클래스 사용) |

피드 항목:
```html
<li class="feed-item" data-importance="0~3" data-kind="life|school|work|family|money|health|trait|semi|event|choice|company|military|achievement|quiet|death" data-new="true">
  <span class="feed-item__when">2013 · 34세</span>본문
</li>
```
- `data-importance`: 3 = 출생·첫 직장·결혼·출산·은퇴·사망·갈림길 선택, 2 = 입학·졸업·이직·승진(3단계↑)·집·질병·회사 운명, 1 = 작은 사건, 0 = 조용한 해 (SYSTEMS 11.2)
- `data-kind="semi"`는 사건 밖에서 생긴 반도체 순간 (첫 출근 등 자동 기록)

탭 안에서 쓰는 클래스: `.kv`(dl 표: dt 이름·dd 값), `.axis[data-on="+|-|"]` › `.axis__l` `.axis__track` › `.axis__dot`(`--x` −100~100) `.axis__r`, `.trait-badges` › `.trait-badge`, `.mini-list`, `.mkt` › `span[data-score="-2~2"]`, `.share[data-mine][data-gone]` › `.share__bar`(`--s` 0~100).

### 사건 카드 (`#event-layer`)
```html
<div id="event-layer">                                  <!-- 열리면 hidden 해제 -->
  <article id="event-card" data-size="small|big" data-phase="choose|result" data-id="사건 id">
    <p id="event-kicker">인생의 갈림길</p>             <!-- 큰 사건만, 작은 사건은 빈 칸 -->
    <p id="event-text">문장</p>
    <div id="event-choices">
      <button class="choice" data-index="0" data-default="true" data-check="false">
        <span class="choice__label">선택지</span>
        <span class="choice__check">멘탈 판정 · 가능성 보통</span>   <!-- 판정 있는 선택지만 -->
      </button>
    </div>
    <div id="event-timer" style="--t: 0.6"><span></span></div>   <!-- 작은 사건 남은 시간 1→0 -->
    <div id="event-result" hidden>
      <p id="event-result-text"></p>
      <div id="event-chips"><span class="chip" data-tone="good|bad|semi">멘탈 −5</span></div>
      <button id="event-ok">확인</button>
    </div>
  </article>
</div>
```
- **작은 사건**: 시계는 계속 갑니다. 실제 시간 15초 안에 안 고르면 `data-default="true"` 선택지가 골라지고, 결과는 5초 뒤 저절로 닫힙니다.
- **큰 사건**(갈림길): 시계가 멈추고(`body[data-paused="true"]`) 시간 제한이 없습니다. 결과는 확인을 눌러야 닫힙니다.
- 칩 `data-tone`: `good` 좋아짐 · `bad` 나빠짐 · `semi` 반도체 순간 획득.

### 엔딩
`#ending-line`(마지막 한 줄), `#ending-cause`(사망 문구, 선택), `#ending-title`, `#ending-ribbons` › `.ribbon`, `#ending-summary`(선택), `#ending-score`, `#score-bars` › `li.bar[data-id]` › `.bar__fill`(`--v`), `#ending-traits` › `.trait-badge`, `#ending-trait-lines`(선택), `#ending-semi` › `li.semi-card[data-kind]` › `.semi-card__meta` `.semi-card__text`, `#ending-timeline` › `li[data-mine]` › `.timeline__year`, `#ending-industry`(같은 구조, `data-mine="true"`는 내 회사·주식), `#ending-numbers`(dl), `#ending-epitaph`(선택), `#btn-again-same`, `#btn-again-new`, `#ending-seed`.
- `semi-card[data-kind]`: `core near eco family money school place history everyday` (그림 id `semi_<kind>` 자리, SYSTEMS 11.3)
- 점수 막대 id: `happiness health wealth relations career semi`
- "(선택)" 표시는 GPT의 `review_text.json`이 있을 때만 채워짐

### 토스트
`#toast-stack` › `.toast[data-tone="semi|"]` — 3.5초 뒤 사라짐 (반도체 순간·특징·승진·재능·업적 알림).

## 연출 이벤트 (`document`에서 듣기)
`document.addEventListener('life:semi', (e) => e.detail …)`
| 이벤트 | 언제 | `detail` |
|---|---|---|
| `life:year` | 새해 (① 생일 직후) | `{ year, age, stage, headline }` |
| `life:event` | 사건 카드가 열림 | `{ id, big }` |
| `life:choice` | 선택지를 고름 | `{ id, index, failed }` (판정 실패면 `failed: true`) |
| `life:semi` | 반도체 순간 생김 | `{ year, age, text, kind, event_id }` |
| `life:trait` | 특징 생김·사라짐 | `{ axis, name, gained }` |
| `life:promo` | 승진·임원 | `{ rank, name, exec? }` |
| `life:company` | 내 회사 운명 · 입사 | `{ kind: 'hired'|'bankrupt'|'acquired'|'leader', company, acquirer?, job? }` |
| `life:family` | 결혼·출산 | `{ kind: 'married'|'child', name? }` |
| `life:talent` | 숨은 재능 발견 | `{ id, name }` |
| `life:achievement` | 업적 (GPT achievements.json이 있을 때) | `{ id, name }` |
| `life:log` | 연표에 한 줄 추가 | `{ year, age, text, importance, kind, event_id }` |
| `life:death` | 사망 (연말) | `{ year, age, cause, kind, dementia }` |

## 저장 (localStorage, SYSTEMS 12장)
| 키 | 내용 |
|---|---|
| `semilife.save.v1` | 지금 인생 전체 (해마다·큰 사건 선택 뒤·멈춤·창 숨김 때 저장) |
| `semilife.save.bak` | 직전 저장본 |
| `semilife.archive.v1` | 끝난 인생 요약 최대 30개 |
| `semilife.settings.v1` | 배속 |

저장이 막힌 환경(사생활 보호 모드 등)에서도 게임은 그대로 돌아갑니다 (이어 하기만 안 됨).

## v0에서 아직 없는 화면 (SYSTEMS 13장 중)
연간 행동 메뉴, 구직 화면(공고 6개 고르기 — 지금은 "연락 온 곳" 갈림길로 대신), 지난 인생 보관함 화면, 설정, 공유 이미지, 자녀로 이어 살기.
