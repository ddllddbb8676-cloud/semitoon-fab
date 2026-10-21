# 공통 규격 (SPEC)

모든 기획 문서와 데이터가 같이 쓰는 이름과 형식입니다. **이름을 바꾸거나 지우려면 먼저 PLAN.md 결정 기록에 올리고 합의**합니다. 새로 추가하는 건 자유지만 이 문서와 `life/tools/validate.mjs`에도 넣습니다. 규칙의 자세한 뜻은 `SYSTEMS.md`(생애·커리어), `ECONOMY.md`(돈), `FUTURE.md`(2027년 이후)에 있습니다.

## 시간
- 1배속 = 1년 60초. 배속 1·2·4·8배, 일시정지. **기본은 4배속(1년 15초)**, 1~6세는 ×2, 은퇴 후 ×1.5 빠르게 → 한 인생 약 20분.
- 한 해에 사건 0~3개. **큰 사건**(`big`)은 게임을 멈추고 기다림. **작은 사건**은 15초(실제 시간) 안에 안 고르면 `default`.
- 연말 결산 순서는 `ECONOMY.md` 0.1절.

## 생애 단계
| id | 이름 | 나이 |
|---|---|---|
| `infant` | 유아 | 1~6 |
| `child` | 어린이 | 7~12 |
| `teen` | 청소년 | 13~19 |
| `young` | 청년 | 20~34 |
| `middle` | 중년 | 35~59 |
| `senior` | 노년 | 60~ |

## 캐릭터 상태
```text
profile    name, gender(m|f), birth_year, region, area(권역), family{father_job, mother_job, wealth(1~5), harmony, siblings}
stats      health, intelligence, dexterity, sociability, mental, looks   (0~100)
talent     숨은 재능 id (발견 전엔 숨김)
traits     성향 축 7개 (-100~100)          traits_years {특징 이름: 연수}
happiness  행복 (0~100)
condition  질병·부상 목록                  habits [exercise, smoking, drinking, checkup]
education  level(무관~박사), school_tier(1~5, 5가 최상위), major, specialty("<축>.<값>", 예 "process.litho" = 포토 전공),
           track(고교 유형), in_school, grade, retries
military   status, type, start_year, end_year
career     status(student|military|employed|owner|unemployed|homemaker|retired), job, company, client(협력사의 원청),
           employment, region, ladder, rank(정수), years(현 회사 근속), total_years, exp{job_id: 연수}, salary, salary_mod,
           reputation(0~100), side_jobs[], business{score, stage}, skills[], skill_points, plateau, leave{type, months_left}
money      cash, coins{btc, alt, meme}, coin_invested, stocks{company_id: {shares, cost}}, index_units, margin_debt,
           houses[{region, bought_year, price, value, size, quality, loan_id, primary}],
           housing{tenure(own|jeonse|monthly|parents|dorm|army), region, deposit, rent, renew_year},
           loans[{id, type(mortgage|jeonse|credit|card|student|loan_shark|margin), balance, rate, fixed, years_left}],
           credit(ok|late|default), pension{years, rel_sum, special}, last{income, spend, networth}
relations  partner{name, gender, birth_year, job, semi, met_year, met_at, love, married},
           children[{name, gender, birth_year, intelligence, dexterity, health, edu, major_group, job, company, semi, encouraged, alive}],
           parents[{role, birth_year, alive, job, semi}], grandchildren, friends(0~100)
flags      기록 플래그 (지우지 않음) + 상태 플래그 `is_*` (엔진이 붙이고 뗌)
semi       semi_moments[{year, age, text, kind, event_id}]
titles     {칭호 이름: 진행 카운터}
log        [{year, age, text, importance, kind, event_id}]
lineage    [{name, birth_year, death_year, title, score}]   (자녀로 이어 살기)
world      seed, market{year: {cycle, memory, logic_foundry, equipment, korea}}, companies{...}, timeline[], overrides{}
```

## 성향 축 (선택이 쌓여 "특징"이 됨)
선택지 `effects`가 축을 움직이고, 절댓값이 50을 넘으면 그쪽 특징 이름이 붙습니다.

| 축 id | -쪽 특징 | +쪽 특징 |
|---|---|---|
| `diligence` | 느긋함 | 성실함 |
| `risk` | 안정 추구 | 모험가 |
| `thrift` | 큰손 | 짠돌이 |
| `work_life` | 가정적 | 워커홀릭 |
| `social` | 혼자가 편함 | 인싸 |
| `outlook` | 걱정 많음 | 낙천적 |
| `conform` | 반골 | 순응형 |

## 사건 형식
```json
{ "id": "...", "age": [20, 30], "year": [1974, null], "when": {}, "market": {}, "weight": 3, "once": false,
  "big": false, "forced": false, "trigger": "job_search", "priority": 5, "tags": [], "bias": {},
  "text": "...", "choices": [ { "label": "...", "when": {}, "check": { "stat": "mental", "dc": 60 }, "fail": { "effects": {}, "result": "" }, "effects": {}, "result": "..." } ],
  "default": 0 }
```
| 사건 필드 | 뜻 |
|---|---|
| `age`, `year` | `[최소, 최대]`, `null`은 제한 없음 |
| `when` | 조건 (아래 표) |
| `market` | 그 해 시황 점수 범위. 사건 맨 위나 `when` 안 둘 다 가능 |
| `weight` | 추첨 가중치. 0이면 `goto`로만 |
| `once` | 한 인생에 한 번 |
| `big` | 큰 사건 (멈춤, 시간 제한 없음) |
| `forced` | 조건이 맞으면 추첨 없이 반드시 |
| `trigger` | 이 시스템 트리거가 생긴 해에만 후보 (목록은 `SYSTEMS.md` 1.5, `"goto"`면 goto로만) |
| `priority` | 1~9, 같은 해 강제·트리거 사건 순서 |
| `tags` | 특징 가중치용 태그 (`SYSTEMS.md` 3.4) |
| `bias` | {성향 축·능력치: 계수} 가중치 보정 |

| 선택지 필드 | 뜻 |
|---|---|
| `when` | 이 선택지를 보여 줄 조건 |
| `check` | `{ "stat": id }` 또는 `{ "trait": 축 }` + `"dc": 0~100` 판정 |
| `fail` | 판정 실패 때 `{ effects, result }` |

## effects 키
| 키 | 예 | 뜻 |
|---|---|---|
| 능력치 id | `"mental": -5` | 능력치 증감 |
| `trait.<축>` | `"trait.risk": 10` | 성향 축 이동 |
| `happiness`, `reputation`, `friends` | `5` | 행복 / 직장 평판 / 인간관계 |
| `cash`, `debt` | `"@salary*0.5"` | 돈. **상대값만** (아래) |
| `flag` | `"imf_laid_off"` 또는 배열 | 기록 플래그 |
| `semi` | `"첫 클린룸 출근"` 또는 `{ "text": "...", "kind": "core" }` | 반도체 순간 |
| `goto` | `"job_search"` | 다른 사건으로 이어짐 |
| `title_progress` | `"소신 엔지니어"` | 칭호 진행 |
| `do` | `"job:quit"` 또는 배열 | 시스템 동작 (아래) |

### `do` 동작
| 동작 | 뜻 |
|---|---|
| `school:<hs_general\|hs_vocational\|hs_meister\|hs_science\|hs_factory\|none\|college\|junior_college\|retry\|master\|phd>` | 진학·진로 |
| `major:<semi\|materials\|other_eng\|nonsci>` | 전공 계열 |
| `military:<army\|officer\|industrial\|research\|defer>` | 병역 |
| `job:<offer1\|offer2\|offer3\|rival\|stay\|quit\|rest\|search\|look\|wait\|transfer\|exec\|retire>` | 커리어 |
| `job:hire:<job_id>` · `job:owner:<job_id>` · `job:side:<job_id>` · `job:found:<sector>` | 지정 채용 / 자영업 / 부업 / 창업 |
| `salary_mod:<x>` · `salary_mult:<x>:<년>` · `bonus:<금액>` | 연봉 보정 누적 / 일시 배율 / 일회성 성과급 |
| `partner:<new\|marry\|wait\|breakup>` · `child:<add\|encourage_semi\|encourage_medic\|free>` | 관계 |
| `leave:<parental\|maternity>` | 육아휴직·출산휴가 사용 (`family_policy.json`) |
| `house:<buy\|buy_small\|sell>` · `tenure:<own\|jeonse\|monthly\|parents\|dorm>` | 집 |
| `invest:<company\|semi_index>:<현금 비율>` · `invest:sell_all` | 주식 (간단형) |
| `stock:buy:<company\|my_company>:<금액>` · `stock:sell:<company>:<비율>` · `index:buy:<금액>` · `index:sell:<금액>` | 주식 (상세형) |
| `coin:buy:<btc\|alt\|meme>:<현금 비율>` · `coin:sell_all` | 코인 (`coin_history.json`) |
| `loan:<type>:<금액>` · `repay:<type>:<금액>` · `credit:<ok\|default>` | 대출·신용 |
| `move:<region_id\|company>` · `move:overseas:<n년>` | 이사 |
| `wealth:<±n>` · `habit:<+\|->id` · `cond:<+\|->id` · `talent:reveal` · `skill_point:<n>` · `again:<n>` | 기타 |

금액 자리에는 상대값 토큰(`@salary*0.3`)을 씁니다.

## 돈 상대값
문법: `"@토큰"`, `"@토큰*k"`, `"-@토큰*k"` (k 음수 가능). 결과는 그 해 원 단위, 유효숫자 3자리.

토큰: `@avg_wage`(연평균 임금) · `@avg_wage_month` · `@salary`(내 연봉) · `@income`(지난해 총소득) · `@min_wage`(시급) · `@min_wage_month` · `@min_wage_year` · `@house_seoul` · `@house_local`(지방 기준가) · `@house`(내 지역) · `@house_mine` · `@rent_month` · `@krw26`(2026년 1원의 그 해 가치) · `@cash` · `@networth` · `@allowance` · `@living`(1년 생활비). 값이 없을 때 대체값은 `ECONOMY.md` 1절. 미성년자 사건은 `@avg_wage`, `@allowance`, `@krw26`를 씁니다.

## 조건 키 (`when`)
값이 배열이면 "그중 하나". 범위는 `[최소, 최대]`.

| 분류 | 키 |
|---|---|
| 나이·시간 | `stage`, `age`, `year` |
| 사람 | `gender`, `stat_min{}`, `trait_min{}`, `trait_max{}`, `edu_min`, `edu_max`, `wealth_min`(태어난 집 경제력) |
| 직업 | `job`(기본 직업 id면 그 아래 세부 직업 포함, 세부 id `fab_pe.dram.euv`도 가능, `"none"`은 무직, 부업 포함), `job_group`, `job_role`, `job_dim{축: [값]}`, `sector`, `employment`, `career_years_min`, `rank_min`, `company_state`(내 회사 실적 범위) |
| 장소 | `region`, `near_fab`(사는 지역 `fab_since` ≤ 올해) |
| 가족 | `has_partner`, `has_children`, `parents_alive` |
| 기록 | `flag`(전부 있어야), `not_flag`(하나도 없어야), `flag_any`(하나라도), `semi_min`, `semi_max` |
| 시황·거시 | `market{cycle\|memory\|logic_foundry\|equipment\|korea: 범위}`, `macro`(범위), `kospi_change`, `base_rate`, `house_change` |
| 돈 | `cash_min`(토큰 가능), `networth_min`, `networth_max`, `debt_min`, `asset_grade_min`, `asset_grade_max`, `credit`, `house_tenure`, `has_house`, `has_loan`, `holds_stock`(회사 id·`any`·`my_company`), `stock_ret`, `concentration_min`, `holds_coin`, `coin_ret` |

## 미래 (2027~2150, `FUTURE.md`)
| 종류 | 이름 | 뜻 |
|---|---|---|
| 상태 | `career.skills[] = {id, level}` | R&D 스킬 (id 목록은 `future_tech.json`의 `skills`) |
| 상태 | `world.future = {seed, arrivals{node: 연도}, fired[{id, year}], paths[{year, path}]}` | 미래 세계 |
| when | `tech`(모두 등장) · `tech_any` · `not_tech` · `tech_since{node: 범위}` | 그 해까지 등장한 기술 노드 |
| when | `scenario`(발동한 적 있음) · `scenario_active`(효과 기간 중) · `scenario_since{id: 범위}` | 시나리오 |
| when | `world_path` | 2060년 이후 세계 경로 |
| when | `skill_min{skill: 레벨}` · `skill_value_min{skill: v}` · `skill_value_max{skill: v}` | 스킬 레벨·가치 |
| when | `job_demand_min{job: x}` · `job_demand_max{job: x}` · `future`(bool, 2027년 이후) | 직업 수요 변화 |
| effects | `skill.<id>` | 그 스킬에 포인트 |
| do | `skill:retrain:<from>:<to>` · `skill:focus:<id>` | 재교육, 주력 스킬 |
| 트리거 | `tech_commercialized`, `skill_obsolete`, `job_shrinking`, `tech_news`, `world_path` | `FUTURE.md` 9.6 · 9.7 · 8.1 · 3.3 · 6.2 |
| 예약 플래그 | `my_research_commercialized`, `retrained`, `master_craftsman` | |

2027년 이후 시황 행은 `market_history.json`과 같은 키 + `fiction`, `sales_basis: "model"`. 확인: `node life/tools/future_sim.mjs <seed>`.

## 자리표시 (문장 안)
`{name}`, `{company}`, `{rival}`, `{acquirer}`, `{client}`, `{region}`, `{partner}`, `{child}`, `{offer1}`, `{offer2}`, `{offer3}`, `{tech}`(기술 노드 이름), `{skill}`(스킬 이름) — 되돌아보기 문구용은 `T07` 지시서 목록.

## 플래그·이름 규칙
- `is_` 접두 = 엔진이 상태에 맞춰 붙이고 떼는 플래그 (`SYSTEMS.md` 1.6). 그 밖의 플래그는 지우지 않음.
- 엔진 예약 플래그: `had_job`, `semi_touched`, `parent_semi`, `credit_default`, `personal_rehab`, `bankrupt`, `margin_call`, `delisted_loss`, `jeonse_fraud_victim`, `house_poor`, `first_house`, `my_research_commercialized`, `retrained`, `master_craftsman`.
- 반도체 순간 kind: `core` 현장 · `near` 주변 · `eco` 생태계 · `family` 가족 · `money` 돈 · `school` 학교 · `place` 동네 · `history` 뉴스 · `everyday` 일상.
- 1~5 등급은 모두 5가 최상위 (`school_tier`, 회사 특성, `wealth`).

## 데이터 파일
| 파일 | 내용 | 담당 |
|---|---|---|
| `market_history.json` | 1947~2026 반도체 시황 | Claude |
| `economy_history.json` | 1940~2026 물가·임금·집값·금리·KOSPI | Claude |
| `family_policy.json` | 출산휴가·육아휴직 제도와 사용률 | Claude |
| `coin_history.json` | 코인 시세와 투자 습관 규칙 | Claude |
| `companies.json`, `jobs.json`, `character.json` | 회사·기본 직업·캐릭터 만들기 | Claude |
| `job_matrix.json` | 세부 직업 조합표 (`node life/tools/jobs_expand.mjs`) | Claude |
| `future_tech.json`, `future_scenarios.json` | 2027~2150 기술·시나리오 (`FUTURE.md`) | Claude |
| `events/<stage>.json`, `events/major.json` | 생애 단계 사건, 갈림길 | Claude |
| `events/gpt/`, `achievements.json`, `names.json`, `news_general.json`, `jobs_extra.json`, `review_text.json`, `job_matrix_text.json`, `job_matrix_extra.json` | 콘텐츠 | GPT |
| `rules.json`, `titles.json`, `economy_rules.json` | 문서의 상수표를 데이터로 (예정) | Claude |
