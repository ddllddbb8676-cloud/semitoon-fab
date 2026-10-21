# 공통 규격 (SPEC)

모든 기획 문서와 데이터가 같이 쓰는 이름과 형식입니다. **이름을 바꾸거나 지우려면 먼저 PLAN.md 결정 기록에 올리고 합의**합니다. 새로 추가하는 건 자유지만 이 문서에도 적습니다.

## 시간
- 1년 = 60초 (1배속). 배속 1·2·4·8배, 일시정지.
- 한 해에 사건 0~3개. **큰 사건**은 게임을 멈추고 선택을 기다림. **작은 사건**은 15초(실제 시간) 안에 안 고르면 `default` 선택.
- 생일마다 나이 +1, 연말에 결산(연봉·이자·집값·주가 반영, 연표 기록).

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
profile    name, gender, birth_year, region, family{father_job, mother_job, wealth, harmony, siblings}
stats      health, intelligence, dexterity, sociability, mental, looks   (0~100)
talent     숨은 재능 id (발견 전엔 숨김)
traits     성향 축 7개 (-100~100)
happiness  행복 (0~100)
condition  건강 상태 목록 (질병, 부상)
education  level(무관~박사), school_tier(1~5), major, specialty(대학원 전공 "<축>.<값>", 예: "process.litho" = 포토)
career     job, company, employment, years, rank, salary, reputation(0~100)
money      cash, debt, stocks{company_id: 주식 수}, houses[{region, bought_year, price}]
relations  partner, children[], parents_alive, friends(0~100)
flags      분기 기록 문자열 집합 (예: "imf_laid_off", "chose_meister_school")
semi       semi_moments[] 반도체 접점 기록 (되돌아보기 카드용)
log        연도별 연표 항목
```

## 성향 축 (선택이 쌓여 "특징"이 됨)
선택지 `effects`가 축을 조금씩 움직이고, 절댓값이 50을 넘으면 그쪽 특징 이름이 붙습니다 (연표·되돌아보기에 표시, 사건 확률과 결과에 영향).

| 축 id | -쪽 특징 | +쪽 특징 |
|---|---|---|
| `diligence` | 느긋함 | 성실함 |
| `risk` | 안정 추구 | 모험가 |
| `thrift` | 큰손 | 짠돌이 |
| `work_life` | 가정적 | 워커홀릭 |
| `social` | 혼자가 편함 | 인싸 |
| `outlook` | 걱정 많음 | 낙천적 |
| `conform` | 반골 | 순응형 |

## effects 키
| 키 | 예 | 뜻 |
|---|---|---|
| 능력치 id | `"mental": -5` | 능력치 증감 |
| `trait.<축>` | `"trait.risk": 10` | 성향 축 이동 |
| `happiness` | `5` | 행복 |
| `cash` / `debt` | `-3000000` | 원 단위. 시대 물가는 `@salary` 같은 상대값 권장 (아래) |
| `reputation` | `3` | 직장 평판 |
| `friends` | `2` | 인간관계 |
| `flag` | `"imf_laid_off"` | 분기 기록 추가 |
| `semi` | `"첫 클린룸 출근"` | 반도체 접점 기록 |
| `goto` | `"job_search"` | 다른 사건으로 이어짐 |
| `title_progress` | `"소신 엔지니어"` | 칭호 진행 |

**돈 상대값**: 시대마다 물가가 달라 고정 금액 대신 `"cash": "@salary*0.5"` (연봉의 절반), `"@house_local*0.1"` (그 지역 집값의 10%)처럼 씁니다. 기준값은 `life/data/economy_history.json`.

## 사건 조건 키 (`when`)
`stage`, `age`, `year`, `job`, `job_group`, `sector`, `employment`, `region`, `stat_min{}`, `trait_min{}`, `trait_max{}`, `wealth_min`, `cash_min`, `has_partner`, `has_children`, `has_house`, `flag`, `not_flag`, `company_state` (내 회사 실적 -2~2), `market{}` (market_history의 그 해 점수 범위), `near_fab` (사는 지역의 `fab_since` ≤ 올해), `parents_alive`, `semi_max` (반도체 접점 기록이 이 개수 이하)

- 값이 배열이면 "그중 하나". `age`, `year`, `company_state`, `market.*`는 `[최소, 최대]` (`null`은 제한 없음).
- `"job": "none"`은 무직. `job`에는 기본 직업 id(`jobs.json`, 그 아래 세부 직업 전부 포함)나 세부 직업 id(`fab_pe.dram.euv`)를 쓸 수 있음.
- `job_role`: 세부 직무 id (`job_matrix.json`의 roles, 예: `fab_pe`). `job_dim`: 직업 축 값 (예: `{ "process": ["litho", "euv"] }`, `{ "product": ["hbm"] }`). 축별 사건을 쓰면 그 축의 모든 세부 직업에 뜸.
- `market`은 사건 맨 위에 둬도 되고 `when` 안에 둬도 됨.
- 음수 금액은 `"@salary*-0.1"`처럼 씀.
- `parent_semi` flag는 엔진이 출생 때 부모 직업이 반도체(`semi: true`)면 붙임.

## 데이터 파일
| 파일 | 담당 역할 |
|---|---|
| `life/data/market_history.json` | 업계 역사 고증 |
| `life/data/economy_history.json` | 업계 역사 고증 |
| `life/data/companies.json`, `jobs.json`, `character.json` | 시스템 설계 |
| `life/data/job_matrix.json` | 세부 직업 조합표 (직무 × 축). 펼치기: `node life/tools/jobs_expand.mjs` |
| `life/data/events/<stage>.json`, `events/major.json` | 이벤트 작가 |
