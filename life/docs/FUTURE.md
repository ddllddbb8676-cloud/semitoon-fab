# 미래 설계 (FUTURE) — 2027~2150

세미툰 라이프의 2027년 이후 세계를 정하는 문서입니다. 2026년까지는 실제 역사(`market_history.json`, `economy_history.json`)를 따르고, 2027년부터는 이 문서의 **업계 테크트리 + 사이클 + 충격 시나리오** 모델이 시황·경제·사회 값을 만듭니다. 목표는 "예상치이지만 말이 되게": 2060년까지는 연구 근거로, 그 뒤 2150년까지는 근거의 끝점을 이어 붙인 **가상**(✦ 표시)입니다.

| 파일 | 내용 |
|---|---|
| `life/data/future_tech.json` | 기술 노드 110개 (근거 89 + 가상 21), R&D 스킬 25개와 스킬 규칙 |
| `life/data/future_scenarios.json` | 시황 모델 상수(`model`), 세계 경로 4개, 시황 헤드라인 틀, 한국 사회 기준표, 시나리오 23개 |
| `life/tools/future_sim.mjs` | 데이터 검사기 + **규칙의 기준 구현**. 게임 엔진(`life/js/`)은 이 파일과 같은 순서로 옮깁니다 |
| `life/research/future/F1~F4` | 근거 조사 (출처 URL은 모두 여기서 가져옴) |

```
node life/tools/future_sim.mjs 7              한 판(시드 7) 2027~2150을 한 해 한 줄로
node life/tools/future_sim.mjs 7 --headlines  + 헤드라인      --econ  + ECONOMY 행      --json  market_history 형식 JSON
node life/tools/future_sim.mjs --stats 1000   몬테카를로 요약 (--nodes 붙이면 노드별 등장 분포)
node life/tools/future_sim.mjs --median       중앙 경로: 노드 연표, 직업 수요 배율, 스킬 가치
```
데이터 오류(선행 노드 누락, 연도 순서, 선행 중앙값 역전, 없는 직업·스킬·플래그, 실제 회사 이름)가 있으면 종료 코드 1입니다.

**큰 원칙**
- 세계는 판의 시드 하나로 **새 판을 시작할 때 2027~2150 전체를 미리 만듭니다** (2ms 안팎). 플레이어 선택은 세계를 바꾸지 않습니다. 회사 운명만 SYSTEMS 6장이 해마다 따로 굴립니다. 자녀로 이어 살기(SYSTEMS 11.8)도 같은 세계를 이어 씁니다.
- 실제 회사 이름은 쓰지 않습니다. 회사가 나오는 문장은 `{company}` + `company_sector`(분야 id)로 쓰고 엔진이 그 판의 회사로 채웁니다. 국가 이름(미국·중국·대만·일본)은 씁니다. 검사기가 실제 회사·제품 이름을 막습니다.
- 2150년 연말이 세계의 끝입니다 ('시대의 끝' 엔딩, SYSTEMS 11.8). 그 뒤는 만들지 않습니다.

---

## 1. 근거 구간

| 구간 | 신뢰 | 무엇에 기대나 | 게임 표시 |
|---|---|---|---|
| **2027~2040 로드맵** | 높음~중간 | 기업·imec·JEDEC·KAIST 로드맵, WSTS 2027 전망, McKinsey·Gartner 2030 전망, 정부 계획(용인·서남권·11차 전력계획·연금개혁), Epoch·METR AI 추세 | 보통 뉴스 |
| **2040~2060 전망** | 중간~낮음 | imec 장기표(A2 2043, sub-A2 2046), KAIST HBM8(2038), 통계청 장래인구(~2072), AI 전문가 설문(HLMI 50% 2047), McKinsey 업무 자동화(중간값 2045) | 보통 뉴스 (노드 `confidence`로 문장 톤 조절 가능) |
| **2060~2150 가상 ✦** | 표시 | 근거의 끝점을 이어 붙인 외삽. 노드·시나리오의 `basis_ko`에 어느 끝점에서 이었는지 적음 | `fiction: true`. 연표·되돌아보기·뉴스 카드에 "✦ 가상 시나리오" 배지 |

- 노드 `confidence`는 **연도 범위**에 대한 신뢰도입니다 (F1 정의를 따름). 같은 기술이라도 연도가 불확실하면 low.
- 2060년 이후 시황 행(`market` 행)은 `fiction: true`, 세계 경로·가상 노드·가상 시나리오도 모두 `fiction: true`입니다.
- 2060년 전에도 연구 파일 밖 상식에 기대는 항목은 없습니다. 가상 시나리오 가운데 `ai_incident_regulation`(2045~)과 `robot_tax_ubi`(2050~)만 2060년 전에 열리며 둘 다 ✦입니다.

---

## 2. 테크트리 데이터

### 2.1 노드 필드
| 필드 | 뜻 |
|---|---|
| `id`, `name_ko`, `desc_ko` | id, 이름, 한 줄 설명(해요체) |
| `category` | `logic_process` `lithography` `memory` `packaging` `materials` `computing` `ai` `automation` `energy` `industry` `society` |
| `earliest_year`, `median_year`, `late_year` | 등장 연도 분포 (3.1) |
| `prereqs` | 선행 노드 id. 모두 존재해야 하고, 선행의 중앙값 ≤ 이 노드의 중앙값 (검사기 오류) |
| `confidence`, `fiction` | high/medium/low, 가상 여부 |
| `effects.market` | `{분야: {delta, years, lag?}}` — delta는 점수 단위(1 = 한 칸), 등장 해부터 years년 (lag년 뒤 시작) |
| `effects.jobs` | `{job_id: 배율}` 영구(ramp에 걸쳐 서서히) 또는 `{job_id: {mult, years}}` 일시 (8장) |
| `effects.new_jobs_ko` | 새로 생기는 직함 (8.4) |
| `effects.flag` | `tech_<id>` (세계 플래그) |
| 선택 효과 | `jobs_ramp`(연), `skills{스킬: ±가치}`, `trend{pct, years}`, `world_path{경로: 가중치}`, `region{지역 id: 1}`, `medical{life_d, cure_mult}`, `new_sector{id, name_ko, market_mix}` |
| `rnd_skill` | 연결 R&D 스킬 (9장). 기술이 아닌 사회·시장 이정표는 `null` |
| `headline_ko` | 등장하는 해의 뉴스 문장. `{company}`는 `company_sector` 분야 회사 |
| `sources` | F1~F4의 URL. 가상 노드만 빈 배열, 대신 `basis_ko` |
| 선택 필드 | `company_sector`, `trigger{sales_busd_min}`, `requires_flags[]`, `p_never`, `path_year_shift{경로: ±연}`, `basis_ko` |

### 2.2 104개 후보를 110개로 합친 기록
- **중복 합침**: CFET(F1·F2), 2D 채널(F1·F2, CNT 로직을 설명에 흡수), HBM 하이브리드 본딩(F1·F2), 기가와트 AI 캠퍼스(F3·F4 + 빅테크 설비투자 1조 달러), CPO 스위치 + 광 인터커넥트(F2·F4), 포크시트 → 1nm급 공정, HBM 1000억 달러 → HBM5, SiC 200mm + GaN 300mm → 전력반도체 주류화, 열역학 컴퓨팅 → 가역 컴퓨팅, 미국 첨단로직 28% + 일본 2nm 파운드리 → 미·일 첨단 파운드리, 데이터센터 전력 병목(F4) → 시나리오 `energy_crunch` + 노드 `dc_power_1000twh`.
- **빼거나 옮김**: 추론 중심 컴퓨팅(2026년에 이미 진행, 역사 구간), 변혁적 AI(HLMI) → 확률 분포가 필요해 **시나리오 `agi_arrival`**로, AI 주도 폭발 성장 → 시나리오 `explosive_growth`로.
- **이정표로 바꿈**: 세계 시장 2조·5조·20조 달러는 연도를 뽑지 않고 **시황 모델 매출이 넘는 해**에 등장 (`trigger`).
- **회사 이름 제거**: "SK하이닉스 용인 1기" → `yongin_first_fab` + `{company}`, "CXMT 17%" → 중국 D램 점유율 17%, "Rapidus" → 일본 신생 파운드리.
- **연도 정리**: 선행보다 이른 `earliest_year` 4건(초인적 AI 코더, 모놀리식 3D, Q-데이, 차세대 광원)을 선행 + 1년으로 올림. 용인 국가산단 1호 팹(중앙값 2029)이 3GW 발전(원래 2030)을 선행으로 두므로 발전을 2029로.
- **가상 노드 21개 추가** (2.4): F1·F2·F4의 `beyond_2060_ko`가 짚은 실마리(층수 시대, 원자 정밀 제조, 에너지 노드, 이종 타일, 메모리-연산 융합, 리퍼브 팹, 극저온 데이터센터, 생체-실리콘, 달·궤도 소재 등)만 이었습니다. 외계·순간이동 같은 것은 없습니다.

### 2.3 근거 노드 89개 (2026~2060, 일부 2060 이후 꼬리)
연도는 earliest·median·late, 시황 효과는 `분야±delta×년`(노드 가중 0.5가 곱해지기 전 값).

**로직 공정** (9)

| id | 이름 | 연도 e·m·l | 선행 | 신뢰 | 스킬 | 시황 효과 |
|---|---|---|---|---|---|---|
| `gaa_nanosheet` | GAA 나노시트 트랜지스터(2nm급) | 2025·2025·2026 | — | 높음 | device_physics | — |
| `backside_power` | 후면 전력 공급(BSPDN) | 2025·2027·2029 | gaa_nanosheet | 높음 | process_integration | 로직+0.5×2, 장비+0.5×2 |
| `node_a14` | 1.4nm급 공정 | 2028·2028·2030 | gaa_nanosheet | 높음 | process_integration | 로직+0.5×2, 장비+0.5×2 |
| `node_a10` | 1nm급 공정(포크시트) | 2029·2031·2034 | node_a14, backside_power, high_na_euv | 중간 | device_physics | 장비+0.5×2, 로직+0.5×2 |
| `cfet` | CFET(상보형 적층 트랜지스터) | 2032·2035·2039 | node_a10, backside_power | 중간 | device_physics | 로직+0.5×2, 장비+0.5×2 |
| `monolithic_3d_logic` | 모놀리식 3D 다층 로직 | 2033·2037·2045 | cfet, cmos20_functional_tiers | 낮음 | process_integration | 장비+0.5×2 |
| `node_a3` | 0.3nm급 공정(성숙 CFET) | 2037·2040·2045 | cfet, hyper_na_euv | 낮음 | process_integration | 로직+0.5×2, 장비+0.5×2 |
| `atomic_2d_cfet` | 원자층 2D CFET(A2 미만) | 2044·2048·2056 | channel_2d_fet, node_a3 | 낮음 | novel_channel | 로직+0.5×2 |
| `scaling_end_atomic_limit` | 치수 축소의 원자 한계 | 2045·2052·2060 | atomic_2d_cfet | 낮음 | chip_architecture | 장비-1×3 |

**리소그래피** (3)

| id | 이름 | 연도 e·m·l | 선행 | 신뢰 | 스킬 | 시황 효과 |
|---|---|---|---|---|---|---|
| `high_na_euv` | High-NA EUV 양산 적용 | 2027·2028·2030 | — | 높음 | litho_process | 장비+0.5×2 |
| `hyper_na_euv` | Hyper-NA EUV(NA 0.75) | 2033·2036·2040 | high_na_euv | 중간 | litho_optics | 장비+0.5×2 |
| `beyond_euv_litho` | 차세대 광원 리소그래피 (안 나옴 25%) | 2034·2045·2058 | hyper_na_euv | 낮음 | litho_optics | 장비+0.5×2 |

**메모리** (14)

| id | 이름 | 연도 e·m·l | 선행 | 신뢰 | 스킬 | 시황 효과 |
|---|---|---|---|---|---|---|
| `hbm4e_custom` | HBM4E·커스텀 HBM | 2026·2027·2028 | — | 높음 | hbm_design | 메모리+0.5×2 |
| `nand_400l_bonded` | 400단급 본딩 낸드 | 2026·2027·2030 | — | 중간 | nand_3d | 메모리+0.5×1 |
| `emram_advanced` | 첨단 임베디드 MRAM | 2026·2027·2029 | — | 중간 | emerging_memory | — |
| `pim_mainstream` | PIM(메모리 내 연산) 보급 | 2026·2028·2031 | — | 중간 | hbm_design | 메모리+0.5×1 |
| `hbm5` | HBM5 | 2028·2029·2031 | hbm4e_custom | 중간 | hbm_design | 메모리+0.5×2, 한국+0.5×2 |
| `dram_4f2_vertical` | 4F² 수직채널 D램 | 2027·2029·2032 | — | 중간 | dram_cell | 메모리-0.5×2, 장비+0.5×2 |
| `nand_1000l` | 1,000단 낸드 | 2030·2031·2035 | nand_400l_bonded | 중간 | nand_3d | 장비+0.5×2 |
| `hbm6` | HBM6 | 2031·2032·2035 | hbm5, hbm_hybrid_bonding | 중간 | hbm_design | 메모리+0.5×2 |
| `sot_mram_cache` | SOT-MRAM 캐시 (안 나옴 20%) | 2028·2032·2038 | emram_advanced | 낮음 | emerging_memory | — |
| `dram_3d` | 3D 적층 D램 | 2030·2033·2038 | dram_4f2_vertical | 낮음 | dram_cell | 장비+0.5×2, 메모리-0.5×2 |
| `hbm7` | HBM7(칩 내장 냉각) | 2034·2035·2039 | hbm6 | 낮음 | hbm_design | 메모리+0.5×2 |
| `fefet_fenand` | 강유전체 FeFET·3D FeNAND (안 나옴 30%) | 2030·2035·2045 | — | 낮음 | emerging_memory | — |
| `hbm8` | HBM8 | 2037·2038·2043 | hbm7 | 낮음 | hbm_design | 메모리+0.5×2, 한국+0.5×1 |
| `dna_storage` | DNA 아카이브 저장 (안 나옴 30%) | 2030·2042·2065 | — | 낮음 | emerging_memory | — |

**패키징** (9)

| id | 이름 | 연도 e·m·l | 선행 | 신뢰 | 스킬 | 시황 효과 |
|---|---|---|---|---|---|---|
| `cpo_optics` | 공동 패키징 광학(CPO) 스위치 | 2026·2026·2028 | — | 높음 | silicon_photonics | — |
| `cowos_mega_interposer` | 초대형 2.5D 인터포저 패키지 | 2026·2027·2029 | — | 높음 | adv_substrate | — |
| `logic_3d_soic` | 로직 3D 적층(로직-온-로직) | 2026·2028·2032 | — | 중간 | hybrid_bonding | — |
| `glass_core_substrate` | 유리 코어 기판 | 2026·2028·2031 | — | 중간 | adv_substrate | 한국+0.5×2 |
| `panel_level_packaging` | 패널 레벨 패키징 | 2027·2029·2032 | cowos_mega_interposer | 중간 | adv_substrate | — |
| `optical_io_scaleup` | 패키지 내 광 I/O | 2028·2029·2033 | cpo_optics | 중간 | silicon_photonics | 로직+0.5×2 |
| `hbm_hybrid_bonding` | HBM 하이브리드 본딩 | 2027·2030·2033 | hbm4e_custom | 중간 | hybrid_bonding | 장비+0.5×2 |
| `ucie_open_chiplet` | 개방형 칩렛 생태계 | 2027·2030·2036 | — | 중간 | chip_architecture | 로직+0.5×1 |
| `cmos20_functional_tiers` | CMOS 2.0 기능별 웨이퍼 적층 | 2028·2031·2035 | backside_power | 중간 | hybrid_bonding | 장비+0.5×2 |

**소재** (5)

| id | 이름 | 연도 e·m·l | 선행 | 신뢰 | 스킬 | 시황 효과 |
|---|---|---|---|---|---|---|
| `wbg_power_mainstream` | SiC·GaN 전력반도체 주류화 | 2025·2028·2031 | — | 중간 | power_semis | — |
| `ga2o3_power` | 산화갈륨 전력소자 (안 나옴 20%) | 2027·2030·2036 | — | 낮음 | power_semis | — |
| `diamond_power` | 다이아몬드 반도체 (안 나옴 20%) | 2028·2036·2048 | — | 낮음 | power_semis | — |
| `space_crystal_fab` | 우주 결정 성장 기판 (안 나옴 30%) | 2030·2040·2060 | — | 낮음 | power_semis | — |
| `channel_2d_fet` | 2D 채널 트랜지스터 | 2037·2043·2051 | cfet | 낮음 | novel_channel | 장비+0.5×2 |

**컴퓨팅** (13)

| id | 이름 | 연도 e·m·l | 선행 | 신뢰 | 스킬 | 시황 효과 |
|---|---|---|---|---|---|---|
| `cxl_pooling` | CXL 메모리 풀링 | 2025·2027·2030 | — | 중간 | hbm_design | — |
| `on_device_ai` | 온디바이스 AI 보편화 | 2025·2028·2030 | — | 중간 | chip_architecture | 메모리+0.5×1 |
| `rack_600kw_3d_accelerator` | 600kW 랙·3D 적층 AI 가속기 | 2027·2028·2030 | gigawatt_ai_campus | 중간 | chip_architecture | 메모리+0.5×1 |
| `cryo_quantum_supply_chain` | 양자칩 파운드리·극저온 공급망 | 2026·2029·2034 | — | 중간 | quantum_hw | — |
| `fault_tolerant_qc` | 오류 보정 양자컴퓨터 | 2028·2031·2036 | cryo_quantum_supply_chain | 중간 | quantum_hw | — |
| `analog_imc` | 아날로그 인메모리 AI 칩 (안 나옴 20%) | 2027·2032·2040 | — | 낮음 | novel_compute | — |
| `neuromorphic_scale` | 대규모 뉴로모픽 시스템 | 2027·2033·2042 | — | 낮음 | novel_compute | — |
| `utility_scale_qc` | 유틸리티급 양자컴퓨터 | 2031·2035·2045 | fault_tolerant_qc | 낮음 | quantum_hw | — |
| `photonic_compute` | 광 연산 가속기 (안 나옴 20%) | 2029·2036·2048 | optical_io_scaleup | 낮음 | silicon_photonics | 로직+0.5×2 |
| `crqc_qday` | 암호해독급 양자컴퓨터(Q-데이) | 2032·2039·2055 | utility_scale_qc | 낮음 | pqc_security | 업계-0.5×1, 로직+0.5×2 |
| `reversible_computing` | 가역·열역학 컴퓨팅 칩 (안 나옴 30%) | 2027·2040·2065 | — | 낮음 | novel_compute | 로직+0.5×1 |
| `superconducting_digital` | 초전도 디지털 AI 컴퓨터 (안 나옴 30%) | 2033·2042·2060 | cryo_quantum_supply_chain | 낮음 | quantum_hw | 장비+0.5×1 |
| `biocomputing_wetware` | 생체 뉴런 컴퓨팅 (안 나옴 40%) | 2035·2055·2085 | neuromorphic_scale | 낮음 | novel_compute | — |

**AI** (5)

| id | 이름 | 연도 e·m·l | 선행 | 신뢰 | 스킬 | 시황 효과 |
|---|---|---|---|---|---|---|
| `data_wall` | 인간 텍스트 데이터 고갈 | 2026·2028·2032 | — | 중간 | ai_systems | — |
| `agentic_eda` | 자율 AI 칩 설계 에이전트 | 2026·2029·2034 | — | 중간 | eda_ai | 로직+0.5×2 |
| `training_2e29` | 초대형 AI 학습(10²⁹ FLOP급) | 2028·2030·2034 | gigawatt_ai_campus | 중간 | ai_systems | 업계+0.5×2, 메모리+0.5×1 |
| `robotaxi_korea` | 한국 레벨4 자율주행 상용화 | 2027·2030·2035 | — | 중간 | chip_architecture | — |
| `superhuman_coder` | 초인적 AI 코더·연구 자동화 | 2029·2031·2040 | training_2e29 | 중간 | ai_systems | 업계+0.5×2 |

**자동화** (8)

| id | 이름 | 연도 e·m·l | 선행 | 신뢰 | 스킬 | 시황 효과 |
|---|---|---|---|---|---|---|
| `humanoid_pilot` | 휴머노이드·서비스 로봇 시범 투입 | 2025·2027·2030 | — | 중간 | robotics | — |
| `ai_fab_digital_twin` | AI 팹 디지털 트윈·예지정비 | 2025·2028·2032 | — | 중간 | fab_ai | 장비+0.5×1 |
| `autonomous_fab_l4` | AI 자율 운영 팹 | 2030·2034·2042 | ai_fab_digital_twin | 중간 | fab_ai | 한국+0.5×2, 장비+0.5×2 |
| `humanoid_mass` | 산업용 휴머노이드 대량 보급 | 2032·2038·2048 | humanoid_pilot | 낮음 | robotics | 업계+0.5×3, 메모리+0.5×2 |
| `lights_out_fab` | 무인 팹(라이트아웃) | 2035·2045·2060 | autonomous_fab_l4, humanoid_mass | 낮음 | robotics | 장비+0.5×2, 한국+0.5×2 |
| `household_robot` | 가정·돌봄 로봇 보급 | 2035·2045·2060 | humanoid_mass | 낮음 | robotics | 업계+0.5×2 |
| `half_work_automated` | 업무 시간 절반 자동화 | 2030·2045·2060 | superhuman_coder | 중간 | ai_systems | — |
| `full_labor_automation` | 모든 직업 자동화 가능 (조건 scen_agi_arrival) | 2045·2100·2150 | half_work_automated, humanoid_mass | 낮음 | ai_systems | — |

**에너지** (3)

| id | 이름 | 연도 e·m·l | 선행 | 신뢰 | 스킬 | 시황 효과 |
|---|---|---|---|---|---|---|
| `yongin_power_lng_3gw` | 용인 클러스터 3GW 발전·송전 1단계 | 2027·2029·2033 | — | 중간 | power_cooling | 한국+0.5×1 |
| `dc_power_1000twh` | 데이터센터 전력 1,000TWh | 2029·2031·2035 | gigawatt_ai_campus | 높음 | power_cooling | — |
| `korea_smr_first` | 국내 첫 SMR 상업운전 | 2035·2038·2043 | — | 중간 | power_cooling | 한국+0.5×1 |

**산업·시장** (12)

| id | 이름 | 연도 e·m·l | 선행 | 신뢰 | 스킬 | 시황 효과 |
|---|---|---|---|---|---|---|
| `gigawatt_ai_campus` | 기가와트급 AI 캠퍼스 | 2026·2027·2030 | — | 중간 | power_cooling | 업계+0.5×1, 메모리+0.5×1 |
| `market_2t` | 세계 반도체 시장 2조 달러 (매출≥2000) | 2027·2027·2031 | — | 높음 | — | — |
| `yongin_first_fab` | 용인 클러스터 첫 메모리 팹 | 2027·2027·2028 | — | 중간 | uhp_piping | 한국+0.5×2 |
| `china_dram_share_17` | 중국 D램 점유율 17% | 2027·2028·2031 | — | 중간 | — | 메모리-0.5×2, 한국-0.5×2 |
| `yongin_national_fab1` | 용인 국가산단 1호 팹 | 2028·2029·2031 | yongin_power_lng_3gw | 중간 | uhp_piping | 한국+0.5×2 |
| `pqc_migration` | 양자내성암호(PQC) 전환 의무화 | 2027·2030·2035 | — | 높음 | pqc_security | 로직+0.5×2 |
| `us_japan_advanced_logic` | 미·일 첨단 파운드리 생산 확대 | 2027·2031·2036 | — | 중간 | — | 장비+0.5×2, 한국-0.5×1 |
| `yongin_general_full` | 용인 일반산단 팹 4기 완공 | 2033·2036·2046 | yongin_first_fab, yongin_power_lng_3gw | 중간 | uhp_piping | 한국+0.5×2 |
| `southwest_cluster_fab1` | 서남권 반도체 클러스터 첫 팹 (안 나옴 35%) | 2032·2036·2042 | — | 낮음 | uhp_piping | 한국+0.5×2 |
| `china_chip_selfsufficiency_80` | 중국 반도체 자급률 80% | 2030·2036·2045 | — | 중간 | — | 한국-0.5×3, 장비-0.5×2 |
| `yongin_cluster_full` | 용인 메가클러스터 완공 | 2040·2047·2052 | yongin_national_fab1, yongin_general_full | 낮음 | fab_ai | 한국+1×2 |
| `market_5t` | 세계 반도체 시장 5조 달러 (매출≥5000) | 2040·2050·2065 | market_2t | 낮음 | — | — |

**사회** (8)

| id | 이름 | 연도 e·m·l | 선행 | 신뢰 | 스킬 | 시황 효과 |
|---|---|---|---|---|---|---|
| `ai_regulation_regime` | 고위험 AI 규제 본격 시행 | 2026·2027·2029 | — | 높음 | ai_systems | — |
| `ai_tutor_mainstream` | AI 튜터 일상화 | 2026·2030·2036 | — | 중간 | ai_systems | — |
| `ai_drug_approval` | AI 발견 신약 첫 허가 | 2028·2030·2034 | — | 중간 | ai_systems | — |
| `korea_retirement_65` | 법정 정년 65세 | 2033·2037·2041 | — | 중간 | — | — |
| `korea_aged_40pct` | 고령인구 40% | 2046·2050·2055 | — | 높음 | — | — |
| `ai_longevity_claims` | AI 가속 수명 연장 논란 (조건 scen_agi_arrival) | 2040·2060·2100 | ai_drug_approval | 낮음 | ai_systems | — |
| `pension_fund_depletion` | 국민연금 기금 소진 | 2058·2064·2071 | — | 중간 | — | 한국-0.5×2 |
| `korea_workforce_half` | 생산연령인구 절반으로 | 2062·2068·2075 | — | 중간 | — | 한국-0.5×3 |

### 2.4 가상 노드 21개 ✦ (2060~2150)

| id | 이름 | 연도 e·m·l | 선행 | 스킬 | 시황 효과 | 근거 실마리 |
|---|---|---|---|---|---|---|
| `refurb_fab_industry` | 리퍼브 팹 산업 | 2056·2064·2078 | scaling_end_atomic_limit | equipment_maint | 장비-0.5×3 | F1 beyond_2060 (f) '장비 교체 수요 둔화로 팹 수명 30년+ 리퍼브 팹 산업' 외삽 |
| `tier_era_logic` | 층수 시대 로직(100층 적층) (안 나옴 10%) | 2058·2066·2085 | monolithic_3d_logic, scaling_end_atomic_limit | process_integration | 로직+1×2, 장비+1×2 | F1 beyond_2060 (a) '층수 시대: 로직이 10→100 tier로 쌓이며 층 수가 새 노드 이름이 됨' 외삽 |
| `ai_designed_arch` | AI가 설계한 아키텍처 주류화 (조건 scen_agi_arrival) | 2058·2066·2085 | agentic_eda | eda_ai | 로직+0.5×2 | F4 job_outlook '설계 엔지니어 2050: 사람은 사양 정의·책임 서명 위주' 외삽 |
| `self_repair_tools` | 자가 수리 장비 | 2058·2067·2085 | lights_out_fab, humanoid_mass | robotics | — | F4 lights_out_fab R&D 스킬 '장비 자가 진단·자가 교체 모듈' 외삽 |
| `dark_fab_network` | 무인 팹 네트워크 | 2058·2068·2090 | lights_out_fab | fab_ai | 한국+0.5×1 | F3 korea_society '2060년 이후 무인 팹과 해외 생산이 표준' + F4 lights_out_fab 외삽 |
| `hetero_tile_chip` | 이종 타일 하이브리드 칩 | 2058·2068·2090 | cmos20_functional_tiers, photonic_compute, neuromorphic_scale | chip_architecture | 로직+1×2 | F1 beyond_2060 (d) '스핀·광·뉴로모픽 이종 타일을 CMOS 2.0 층에 끼워 넣는 하이브리드 칩' 외삽 |
| `climate_adapted_fab` | 기후 적응형 팹 | 2058·2070·2090 | — | specialty_chem | 한국+0.5×2 | F3 findings(iScience 물 스트레스, S&P 용수 리스크, 2050년 이후 가뭄 빈도 1.5배 제안) 외삽 |
| `memory_compute_fusion` | 메모리-연산 융합 소자 | 2060·2072·2095 | pim_mainstream, analog_imc, dram_3d | hbm_design | 메모리+1×2, 한국+1×2 | F1 beyond_2060 (e) 'PIM의 극한인 메모리-연산 융합 소자로 메모리·파운드리 산업 합병' 외삽 |
| `energy_node_race` | 에너지 노드 경쟁 (안 나옴 20%) | 2060·2074·2100 | reversible_computing, superconducting_digital | novel_compute | 로직+0.5×2 | F1 beyond_2060 (c) '가역·단열 컴퓨팅과 극저온 CMOS로 란다우어 한계에 접근하는 에너지 노드 경쟁' 외삽 |
| `cryo_dc_standard` | 극저온 데이터센터 표준화 | 2060·2075·2100 | superconducting_digital, utility_scale_qc | quantum_hw | 장비+0.5×2 | F2 beyond_2060 (2) '극저온 데이터센터와 양자-고전 하이브리드가 표준 인프라화' 외삽 |
| `atomic_precision_mfg` | 원자 정밀 제조 (안 나옴 20%) | 2062·2078·2105 | scaling_end_atomic_limit, beyond_euv_litho | process_integration | 장비+1×3 | F1 beyond_2060 (b) '원자 정밀 제조(선택적 ALD/ALE, 자기조립, 탐침 기반 조립)로 노광 의존 탈피' 외삽 |
| `fusion_grid` | 핵융합 전력 상용 보급 (안 나옴 35%) | 2058·2080·2120 | korea_smr_first | power_cooling | 업계+0.5×3 | F3·F4 전력 전망(IEA 2035, 한국 전력계획 2038에서 끝남) 이후 무탄소 전원 확대 추세 외삽 |
| `photonic_quantum_hybrid` | 광-양자 하이브리드 컴퓨터 (안 나옴 25%) | 2065·2082·2115 | photonic_compute, utility_scale_qc | quantum_hw | 로직+0.5×2 | F2 beyond_2060 광 연산·양자 로드맵 끝점(2035~2045) 외삽 |
| `medical_bci` | 의료용 뇌-컴퓨터 인터페이스 보편화 | 2062·2085·2120 | neuromorphic_scale, ai_drug_approval | novel_compute | 업계+0.5×2 | F2 뉴로모픽·생체 뉴런 인터페이스(MEA 칩) + F4 의료 AI 확산 추세 외삽 |
| `compute_dividend` | 연산 배당·기본소득 (조건 scen_agi_arrival) | 2062·2088·2135 | half_work_automated | — | — | F4 full_labor_automation '노동 소득 급감, 기본소득·로봇세 정책 이벤트' 외삽 |
| `orbital_materials` | 달·궤도 소재 공급 (안 나옴 30%) | 2068·2090·2125 | space_crystal_fab | specialty_chem | — | F2 beyond_2060 '헬륨-3 달 채굴 공급 계약(2028~2037)' 신호와 우주 결정 성장 외삽 |
| `bio_silicon_learning` | 생체-실리콘 하이브리드 학습기 (안 나옴 30%) | 2068·2092·2130 | biocomputing_wetware | novel_compute | — | F2 beyond_2060 (4) '생체-실리콘 하이브리드 학습 기계와 윤리 규제' 외삽 |
| `personal_microfab` | 주문형 미니팹 (안 나옴 30%) | 2075·2095·2135 | atomic_precision_mfg | process_integration | 장비+0.5×2, 로직-0.5×2 | F2 개방형 칩렛·F4 에이전트 EDA의 소량 다품종 수요 + 원자 정밀 제조 외삽 |
| `market_20t` | 세계 반도체 시장 20조 달러 (매출≥20000) | 2080·2100·2140 | market_5t | — | — | F3 cycle_model 추세(2060년 이후 명목 연 2.5%) 외삽 |
| `molecular_switch` | 분자 스위치 소자 (안 나옴 30%) | 2080·2105·2145 | atomic_precision_mfg, channel_2d_fet | novel_channel | 장비+0.5×2 | F2 beyond_2060 '원자 단위 소자, 분자 트랜지스터' 언급 외삽 |
| `post_silicon_mainstream` | 실리콘 이후 주류 소자 | 2085·2110·2148 | molecular_switch, hetero_tile_chip | novel_channel | 장비+1×3, 로직+1×2 | F1·F2 beyond_2060 실리콘 이후 주류 스위치 후보(2D·스핀·광·분자) 외삽 |

---

## 3. 테크트리 규칙

### 3.1 등장 연도 뽑기 — 2조각 삼각분포
판을 만들 때 노드마다 (파일 순서대로) 난수 `u`, `v` 두 개를 뽑습니다. 파일 순서는 위상 순서(선행이 앞)입니다.
```
a = earliest_year, m = median_year, b = late_year
plan = round( u < 0.5 ? a + (m − a)·√(2u)  :  b − (b − m)·√(2(1 − u)) )      // P(plan ≤ m) = 0.5, 최빈값 = m
never = (p_never 있음) and v < p_never                                      // 이 판에서는 끝내 안 나옴
```
- "중앙값"을 정말 중앙값으로 쓰려고 왼쪽·오른쪽 반을 따로 그린 삼각분포입니다. 반올림 때문에 중앙값 연도에 조금 몰립니다.
- `p_never`는 F1~F4가 "실패하면 ~"이라고 적은 저신뢰 기술(광 연산, 가역 컴퓨팅, 초전도 디지털, 다이아몬드, 우주 결정, 서남권 클러스터 등)에만 붙였습니다. 끝내 안 나온 노드를 선행으로 둔 노드도 안 나옵니다.

### 3.2 선행 보정과 조건
연도 t에 노드 n이 등장하는 조건 (2027년부터 해마다 파일 순서로 검사):
```
t ≥ plan(n) + delay(n) + path_shift(n)        // delay: 시나리오 delay_nodes 누적, path_shift: 2060년 이후 가상 노드만
모든 선행 p가 t − 1년까지 등장                 // 선행 등장 "다음 해 이후"로 보정
requires_flags가 모두 t − 1년까지 켜짐         // 예: agi_arrival 뒤에만 나오는 노드
never가 아님
trigger 노드: 위 대신 "그 해 매출 ≥ sales_busd_min 이고 t ≥ earliest_year" (그 해 매출 계산 뒤 판정)
```
- **2026년 전 등장**: `plan ≤ 2026`이고 선행도 모두 2026년 전이면 게임 시작 전에 이미 있던 기술로 봅니다. 플래그만 켜고 효과·뉴스는 없습니다 (GAA는 늘, CPO·HBM4E·온디바이스 AI 등은 판에 따라).
- 같은 해에 여러 노드가 나오면 모두 처리하고, 뉴스는 4.9의 우선순위로 하나만 그 해 헤드라인이 됩니다 (나머지는 기술 뉴스 카드로).

### 3.3 등장했을 때 하는 일
1. 세계 플래그 `tech_<id>` 켬, `world.future.arrivals[id] = t`.
2. `effects.market` 구간을 활성 목록에 넣음 (노드 가중 **0.5**, 4.7).
3. 직업 수요(8장), 스킬 가치(9.4), 세계 경로 기울기(6.2), 의료(7.2), 새 분야(10장), 지역(7.4) 반영.
4. 뉴스 카드: `headline_ko` (`{company}` 채움) → 업계 연표 `world.timeline` kind `future`.
5. SYSTEMS 6.4 **세대 경쟁**을 엶: 분야 = `company_sector`, 없으면 분류 기본값 (logic_process→foundry, lithography→equipment_global, memory→memory, packaging→packaging, materials→materials, computing·ai→fabless, automation→equipment_korea, energy→construction, industry·society→없음).
6. **내 연구 상용화** 판정 (9.6).

### 3.4 난수와 재현
- 생성기: **mulberry32**. 스트림 3개: 노드 연도 `seedN = (imul(seed, 0x9E3779B1) + 1) >>> 0`, 연도 진행 `+2`, 거시(ECONOMY 행) `+3`.
- 정규난수: Box–Muller `z = √(−2 ln max(u1, 1e−12)) · cos(2π u2)`.
- **노드 스트림**: 노드마다 `u`, `v` 2개 (3.1).
- **연도 스트림**: 해마다 ① 시나리오마다 1개(파일 순서, 판정을 안 해도 뽑음) ② 시황용 18개 `u[0..17]`: 0 하강 전환, 1 하강 길이, 2 하강 깊이 등급, 3 초과성장 값, 4 상승 종류, 5 슈퍼사이클, 6~7 메모리 잡음, 8~9 로직 잡음, 10~11 장비 잡음, 12~13 한국 잡음, 14 헤드라인 틀 고르기, 15 세계 경로 판정, 16~17 2027년 기준점.
- **거시 스트림**: 해마다 정규난수 8개 (물가, 실질임금, 금리, 최저임금, 서울 집, 지방 집, 코스피, 주담대 가산).
- 난수 개수가 분기와 상관없이 늘 같으므로, 데이터의 한 시나리오 확률을 바꿔도 다른 해의 시황 난수는 밀리지 않습니다.

---

## 4. 2027~2150 시황 모델

F3의 제안 `시장(t) = 추세(t) × 사이클(t) × 충격(t)`을 그대로 쓰되, 역사 점수 분포(1984~2026)에 맞도록 상수를 맞췄습니다.

### 4.1 한 해 계산 순서
| 순서 | 일 |
|---|---|
| a | 2060·2100년이면 세계 경로 판정 (6장) |
| b | 시나리오 판정 (5장) → 효과 등록 |
| c | 노드 등장 (3장, trigger 노드 제외) → 효과 등록 |
| d | 분야별 효과 합 D_s (4.7) |
| e | 사이클 국면과 초과성장 x (4.4) |
| f | 추세 g_T, 매출 S, 편차 d (4.3, 4.5) |
| g | 분야 점수 (4.6) |
| h | 매출 이정표 노드 (trigger) |
| i | 헤드라인 (4.9) |
| j | ECONOMY 행 (7.3) |

### 4.2 내보내는 행 — `market_history.json`과 같은 형식
```json
{ "year": 2031, "global_sales_busd": 2925, "sales_basis": "model", "yoy_pct": 27.4,
  "cycle": 2, "memory": 2, "logic_foundry": 2, "equipment": 2, "korea": 1,
  "events_world": ["가뭄·용수 위기", "초대형 AI 학습(10²⁹ FLOP급)", "한국 레벨4 자율주행 상용화", "1,000단 낸드", "…"], "events_korea": [],
  "headline_ko": "없어서 못 판다…메모리·파운드리 동반 품귀, 시장 27% 성장",
  "confidence": "model", "fiction": false, "sources": [] }
```
- 점수는 역사와 같은 정수 −2~2. 회사 모델이 실수를 원하면 기준 구현의 `raw`(반올림 전 값)를 씁니다 (`--json`에는 없음).
- `events_world`·`events_korea` = 그 해 등장 노드·발동 시나리오 이름 (사회·한국 효과·지역 효과가 있으면 korea 쪽). 2060·2100년 경로 판정도 `events_world`에 "세계 경로: …".

### 4.3 추세 T(t)
```
T(2027) = 1,700 (10억 달러)     ← WSTS 2027 전망 2.1조에 낀 거품 약 25%를 뺀 값 (F3)
g_T(t) = 6.0% (2027~2034) · 4.5% (2035~2049) · 3.5% (2050~2059) · 2.5% (2060, 경로 판정 전)
         2061년부터는 세계 경로의 trend_pct (6.1)
       + Σ 활성 trend 효과 (AGI +1.5%p×15년, 폭발 성장 +3%p×20년, 대만 전쟁 −1%p×5년, AI 정체 −0.7%p×10년 …)
T(t) = T(t−1) × (1 + g_T/100)
```

### 4.4 사이클 국면 (상태 기계)
상태: 국면(상승/하강), 상승 연수, 남은 하강 연수, 하강 깊이 등급, 마지막 슈퍼사이클 연도.

| 상황 | 그 해 초과성장 x (%p, 추세 대비) |
|---|---|
| 2027년 | 기준점 (4.8) |
| 시나리오가 국면을 강제 (`phase`) | 하강: 첫해 그 등급 범위, 이어지면 ×0.5 / 상승: 보통·강세 중 |
| 하강 2년째 | 같은 등급 범위 × **0.5** |
| 하강이 끝난 다음 해 (반등) | U(**0, 26**) |
| 상승 중 | 하강 전환 판정 → 전환이면 하강 첫해, 아니면 상승 종류 |

```
하강 전환 확률 p = 0.19
                 → 0.50  (최근 2년 연속 성장률 ≥ 15%, 과열)
               + 0.6 × max(0, d)       (매출이 추세보다 높을수록 더 잘 꺾임, d = ln(S/T))
               = 0     (상승 연수 < 2: 반등 해 다음 해까지는 꺾이지 않음)
하강 길이: 1년 80% · 2년 20%
하강 깊이: 경미 72% U(−8, −18) · 중간 20% U(−16, −24) · 심각 8% U(−22, −36)
상승 종류: 평년 47% U(−5, 4) · 보통 30% U(4, 15) · 강세 23% U(15, 27)
슈퍼사이클: 상승 해에 6% (직전 슈퍼사이클에서 8년↑), U(24, 36)
```
F3 원안(하강 1년 70%·2년 30%, 경미 −3~−12% 등)에서 바꾼 이유: 원안 그대로면 상승 해 평균이 추세보다 높아 매출이 추세 위로 떠 있고, 그만큼 평균 회귀가 매년 모든 해를 끌어내려 역성장·−2가 역사보다 훨씬 잦았습니다. 역사도 하강의 대부분이 12~15개월이라 1년형을 늘렸습니다.

### 4.5 매출과 평균 회귀
```
amp = 1 (2060년까지) · 0.85 × 경로 amp (2061년부터)
e   = amp × x  −  100 × 0.25 × d(t−1)  +  12 × D_cycle          (%p)
yoy = g_T + e   (하한 −60%)
S(t) = S(t−1) × (1 + yoy/100),   d(t) = ln(S(t)/T(t))
```
- 2027년 기준점 해에는 평균 회귀를 빼고 계산합니다.
- 평균 회귀 κ = 0.25: 매출이 추세보다 20% 높으면(d ≈ 0.18) 다음 해 −4.6%p 끌어내림. 하강 전환 확률의 `0.6 × d`와 함께 "과잉투자 → 붕괴"를 만듭니다.
- 업계 효과 `D_cycle`만 매출에 들어갑니다 (1칸 = 12%p). 다른 분야 효과는 그 분야 점수만 움직입니다.

### 4.6 분야 점수 — 분야별 진폭
`R(x)` = 0.5에서 0에서 먼 쪽으로 반올림, 그다음 −2~2로 자름. `z` = 표준정규 (분야마다 따로).
```
cycle         = R( (e + 3) / 12 )                                    // 0점 = 추세 −9%p ~ +3%p (2026년 추세 6%면 성장률 −3% ~ +9%)
memory        = R( (3.0·e + drift(t) + 10·z) / 28  +  D_memory )      // drift: 2028~2032 −6%p (메모리 비중 50% → 30% 평균회귀, F3)
logic_foundry = R( (0.7·e + 3·z) / 11  +  D_logic )
equipment     = R( (2.5·(0.5·e + 0.5·e_지난해) + 6·z) / 25  +  D_equipment )     // 설비투자는 반년~1년 늦게 따라옴. 2026년 e_지난해 = 12
korea         = R( 0.5·s_memory + 0.3·s_cycle + 0.25·z + D_korea + 경로 korea_bias )   // s_* = 반올림 전 값
```
| 분야 | 매출 진폭 β (업계 대비) | 한 칸 (%p) | 근거 |
|---|---|---|---|
| 업계 | 1 | 12 | 역사 점수 경계(성장률 −2·8·20%)를 추세 6% 기준으로 옮김 |
| 메모리 | **3.0** | 28 | 메모리 진폭이 전체의 3~4배 (2023 −31~37% vs −8%, F3) |
| 로직·파운드리 | 0.7 | 11 | F3 부문 배수 0.7 |
| 장비 | 2.5 (반은 지난해) | 25 | 하락기 평균 장비 −20% vs 반도체 −8% (Hutcheson) |
| 한국 | 메모리 0.5 + 업계 0.3 | — | 한국 반도체 수출은 메모리 비중 탓에 전체의 1.5~2배로 출렁임 (F3) |

### 4.7 효과 합산과 상한
```
D_s(t) = clamp( 0.5 × Σ(노드 delta) + 1.0 × Σ(시나리오 delta) ,  −2, +2 )    // 그 해 활성 구간만
점수 = clamp( R(...), −2, +2 )
```
- 노드 가중 0.5: 기술 진보는 이미 추세에 들어 있으므로 노드는 "몰림·공백"만 만듭니다. 0.5보다 크면 2027~2045년에 로직·장비가 +2에 붙어 있었습니다 (시뮬로 확인).
- 시나리오 `phase`(국면 강제)는 사이클 상태 기계보다 먼저 적용되고, 여러 개면 가장 나중에 발동한 것.
- 상한 덕분에 같은 해에 큰 충격이 겹쳐도 점수는 −2~2를 벗어나지 않고, 영구 효과는 `trend`와 `skills`·`jobs`로만 남깁니다 (점수 효과는 모두 기한이 있음).

### 4.8 2026 → 2027 연결
- 2026년 실제: 매출 1조 6,550억 달러(+108%), 업계·메모리·로직·한국 +2, 장비 +1.
- **2027년 기준점**: 성장률 = clamp(N(26%, 3%), 20%, 33%) → 매출 1.99~2.20조 달러 (WSTS 2027 전망 약 2.1조, +29%). 2027년 메모리는 잡음과 비중 회귀를 빼고 계산해 2026년 슈퍼사이클과 이어집니다. 2027년 점수는 업계 +2가 93%·메모리 +2가 99%이고 나머지는 +1 (1,000판 중 불연속 0판).
- 2028년: 2026·2027이 모두 +15% 이상이라 과열 규칙으로 하강 전환 확률 50% + d 가산 → F3 기본 경로(2028 −12%, 메모리 −30%)와 같은 조정이 대략 절반의 판에서 옴. `ai_supercycle_extended`(2027년에 20%로 판정)면 2030년까지 상승 강제, `ai_overbuild_bust`(2028~2034)면 심각 하강 2년.
- 결과: 2030년 매출 10·50·90% = **1.72 / 2.34 / 3.03조 달러** — McKinsey 2030 기본 2.3조(범위 1.7~2.6조), BofA 3.2조와 겹칩니다.

### 4.9 헤드라인 규칙
우선순위: ① 드문 시나리오(`max_occurrences ≤ 2`) ② 세계 경로 판정 ③ 잦은 시나리오(헬륨·가뭄·관세 등, **업계 점수가 ±1 이내인 해만**) ④ 시황 효과가 큰 노드(가중 합 ≥ 0.5, 업계 ±1 이내인 해만) ⑤ 시황 틀. 같은 순위 안에서는 효과 크기순.

시황 틀(`cycle_headlines`)은 `{sales_t}`(조 달러)와 `{yoy}`(성장률 절댓값 %)를 채웁니다: 업계 −2 → `bust`, −1 → `down`, 반등 해 → `recovery`, +2 → `super`, 메모리만 +2 → `memory_boom`, 메모리 ≤ −1 → `memory_weak`, +1이고 2년 과열 → `peak_warning`, +1 → `up`, 그 밖 → `flat`. GPT가 틀을 더 써도 됩니다(같은 키에 문장 추가).

### 4.10 보정 결과 (1,000판)
| 점수 분포 | −2 | −1 | 0 | +1 | +2 |
|---|---|---|---|---|---|
| 업계 1984~2026 실제 | 7% | 16% | 33% | 21% | 23% |
| 업계 2027~2060 | 10% | 15% | 27% | 24% | 24% |
| 업계 2061~2150 | 6% | 16% | 34% | 29% | 16% |
| 메모리 실제 / 2027~2060 | 19% / 19% | 21% / 15% | 16% / 20% | 16% / 18% | 28% / 29% |
| 로직 실제 / 2027~2060 | 5% / 7% | 12% / 17% | 40% / 30% | 30% / 28% | 14% / 17% |
| 장비 실제 / 2027~2060 | 14% / 6% | 16% / 17% | 21% / 31% | 33% / 27% | 16% / 19% |
| 한국 실제 / 2027~2060 | 12% / 16% | 16% / 18% | 19% / 24% | 33% / 22% | 21% / 20% |

| 지표 | 값 |
|---|---|
| 하강(업계 ≤ −1) 해 비율 | 2027~2060 25% · 2061~ 22% (실제 23%) |
| 역성장 해 비율 | 2027~2060 33% · 2061~ 39% (실제 23%) — 추세가 6% → 2.5%로 낮아져 0점 해 일부가 −1~−3% 소폭 역성장. 점수 기준 하강 빈도는 역사와 같음 |
| 하강 시작 간격 | 평균 3.9년 (역성장 연속 구간 기준, 실제 4.4년) |
| ±2 최장 연속 | 판별 최댓값의 중앙값 2년, 최악 판 장비 8년. ±2가 5년 넘게 이어지는 판 2% |
| 매출 10/50/90% (10억 달러) | 2040 3,061/3,935/4,959 · 2050 4,974/6,441/8,176 · 2060 6,969/9,322/11,990 · 2100 13,814/24,503/43,820 · 2150 27,959/89,166/221,177 |

### 4.11 세 판 요약 (`node life/tools/future_sim.mjs 1|2|3`)
| 시드 | +2 (2060년까지) | −2 | 주요 충격 | AGI | 세계 경로 | 매출 2060 / 2150 |
|---|---|---|---|---|---|---|
| 1 | 2027 31 39 46 51 54 60 | 2052 55 80 | 에너지 위기 2036, 대만 봉쇄 2045, 한국 장기 저성장 2047, 기술 블록 분리 2066, 연산 포화 2080 | 2059 (늦음) | 정체 | 9.9조 / 20.7조 달러 |
| 2 | 2027 29 44 52 57 | 2033 46 58 (+2060년 뒤 9번) | 대만 봉쇄 2031, 에너지 위기 2034, 폭발 성장 2084, 연산 포화 2096·2121 | 2043 | 전환 | 9.2조 / 164조 |
| 3 | 2027 31 32 34 37 41 42 45 53 59 | 2033 43 80 | 대만 전쟁 2033(−2, 이후 장비 특수), 중국 메모리 공세 2036, 팬데믹 2044·2060 | 2037 (이른) | 전환 | 8.6조 / 124조 |

세 판 모두 2027년은 +2로 2026년과 이어지고, 2028~2029년 조정 뒤 2030년대 반등, 3~6년마다 호황·불황이 번갈아 옵니다. 시드 3처럼 AGI가 이르면 2030~2040년대가 호황 위주가 되고, 시드 1처럼 늦으면 2050년대가 거칩니다. 2060년 뒤는 경로에 따라 정체(작은 진폭, 성장 1%대)와 전환(진폭 큼, 후반 가속)이 뚜렷이 갈립니다.

---

## 5. 충격·분기 시나리오

### 5.1 판정 규칙
해마다 파일 순서로, 시나리오마다 난수 하나 `u`:
```
후보 조건: window 안 · 발동 횟수 < max_occurrences · 지난 발동에서 cooldown_years(기본 1) 지남
          · requires_flags 모두 지난해까지 켜짐 · not_flags 하나도 안 켜짐 · excludes_active 시나리오가 효과 기간 중이 아님
p = yearly_probability(그 해; {시작연도: 확률} 계단표면 그 해에 해당하는 칸)
    × Π prob_mult_flags(켜진 플래그)  × prob_mult_path[현재 경로]
발동 = u < p
```
발동하면 플래그 `scen_<id>`(첫 발동 해), 효과 등록(가중 1.0), `phase`(국면 강제), `trend`, `econ`(ECONOMY 가감, 7.3), `delay_nodes`(아직 안 나온 노드를 n년 미룸), `world_path`(기울기), `medical`, 뉴스.

### 5.2 목록 (23개, ✦ = 가상)
시황 효과는 `분야±delta×년(+lag)`.

| id | 이름 | 기간 | 연 확률 | 최대·쿨다운 | 시황 효과 | 그 밖 | 근거 |
|---|---|---|---|---|---|---|---|
| `ai_supercycle_extended` | AI 슈퍼사이클 장기 연장 | 2027~2027 | 0.2 | 1 | 메모리+0.5×4, 한국+0.5×4 | 국면 상승 4년 | 낮음 |
| `ai_overbuild_bust` | AI 과잉투자 붕괴 | 2028~2034 | 2028~ 0.07, 2030~ 0.05, 2032~ 0.03 | 1 | 메모리-1×2, 장비-1×2, 한국-1×2 | 국면 하강 2년(severe) · 거시 성장-1×1 · 노드 지연 yongin_national_fab1+2 yongin_general_full+2 yongin_cluster_full+2 southwest_cluster_fab1+2 · 배수 scen_ai_supercycle_extended×1.5 | 중간 |
| `china_memory_flood` | 중국 메모리 추격·가격 붕괴 | 2028~2040 | 0.02 | 1 | 메모리-1×3, 한국-1×3 | 배수 tech_china_dram_share_17×2 scen_ai_overbuild_bust×1.5 | 낮음 |
| `taiwan_blockade` | 대만 봉쇄·격리 | 2028~2060 | 0.011 | 1 | 업계-1×1, 로직-2×1 로직+1×2(+1), 메모리+1×1, 한국+1×2, 장비+1×3(+1) | 거시 물가+1.5 성장-1×1 | 낮음 |
| `taiwan_invasion` | 대만 전쟁 | 2028~2060 | 0.004 | 1 | 업계-2×1 업계-1×1(+1), 로직-2×2 로직+1×3(+2), 메모리+1×1(+1), 장비+2×3(+1), 한국-1×1 한국+1×3(+1) | 국면 하강 1년(severe) · 추세 -1%p×5 · 거시 물가+3 성장-3×2 · 배수 scen_taiwan_blockade×3 | 낮음 |
| `energy_crunch` | 전력 병목·에너지 위기 | 2027~2045 | 2027~ 0.08, 2036~ 0.04 | 2·6년 | 업계-0.5×2, 한국-0.5×2, 장비-0.5×1 | 거시 물가+0.8×2 · 노드 지연 yongin_national_fab1+1 yongin_general_full+1 · 배수 tech_dc_power_1000twh×1.5 scen_ai_supercycle_extended×1.5 tech_korea_smr_first×0.6 | 중간 |
| `trade_war_escalation` | 미중 기술전쟁·관세 확전 | 2027~2060 | 2027~ 0.25, 2031~ 0.06 | 4·3년 | 한국-1×1, 장비-0.5×1 | 거시 물가+0.3×1 | 중간 |
| `specialty_gas_shock` | 특수가스·소재 공급 충격 | 2027~2150 | 0.12 | 20·4년 | 한국-0.5×1 | — | 중간 |
| `drought_water_crisis` | 가뭄·용수 위기 | 2027~2150 | 2027~ 0.1, 2050~ 0.15 | 30·3년 | 메모리+0.5×1, 한국-0.5×1 | — | 중간 |
| `pandemic_supply_shock` | 팬데믹·물류 마비 | 2028~2150 | 0.02 | 3·15년 | 업계-1×1 업계+1×1(+1), 메모리-1×1 메모리+1×2(+1) 메모리-1×1(+3), 로직-1×1 로직+2×1(+1) 로직-1×1(+3), 한국-1×1 한국+1×1(+1) 한국-1×1(+3) | 거시 성장-2×1 | 중간 |
| `korea_talent_cliff` | 반도체 인력 절벽 | 2030~2060 | 0.15 | 1 | 한국-0.5×3 | 거시 반도체임금+2×10 | 높음 |
| `korea_secular_stagnation` | 한국 장기 저성장 진입 | 2045~2075 | 0.05 | 1 | 한국-1×3 | 거시 성장-1×15 · 배수 scen_demographic_rebound×0.3 | 중간 |
| `agi_arrival` | 변혁적 AI 도래 | 2029~2150 | 2029~ 0.04, 2032~ 0.07, 2038~ 0.09, 2046~ 0.09, 2052~ 0.05, 2061~ 0.025, 2076~ 0.01 | 1 | 업계+1×2, 메모리+1×2, 로직+1×2, 장비+1×2 | 추세 +1.5%p×15 · 거시 성장+0.8×15 · 조건 tech_superhuman_coder · 배수 scen_ai_plateau×0.3 | 낮음 |
| `ai_plateau` | AI 발전 정체 | 2032~2060 | 0.02 | 1 | 업계-1×1, 메모리-1×2, 장비-1×2 | 추세 -0.7%p×10 | 낮음 |
| `explosive_growth` | AI 주도 폭발적 성장 | 2045~2150 | 0.004 | 1 | 업계+2×2, 메모리+1×3, 로직+1×3, 장비+1×3, 한국+1×3 | 추세 +3%p×20 · 거시 성장+2 물가+0.5×20 · 조건 scen_agi_arrival,tech_humanoid_mass | 낮음 |
| `demographic_rebound` | 출산율 반등 정착 | 2035~2100 | 0.015 | 1 | 한국+0.5×5 | 거시 성장+0.3×30 · 배수 scen_korea_secular_stagnation×0.5 | 낮음 |
| `ai_incident_regulation` ✦ | 대형 AI 사고와 공동 규제 | 2045~2150 | 0.01 | 1 | 업계-1×1, 메모리-0.5×2 | 추세 -0.5%p×10 · 조건 scen_agi_arrival | 가상 |
| `robot_tax_ubi` ✦ | 로봇세·기본소득 도입 | 2050~2150 | 0.015 | 1 | 한국-0.5×1 | 거시 성장-0.3×3 · 조건 tech_half_work_automated · 경로 abundance×2 stagnation×0.5 | 가상 |
| `compute_glut` ✦ | 연산 수요 포화 | 2060~2150 | 0.012 | 2·20년 | 업계-1×2, 메모리-1×3, 장비-1×3 | 추세 -0.8%p×10 · 경로 abundance×1.5 stagnation×1.5 | 가상 |
| `bloc_split` ✦ | 기술 블록 완전 분리 | 2060~2150 | 0.008 | 1 | 업계-1×1, 장비+1×3(+1), 한국+1×2 | 추세 -0.5%p×10 · 거시 물가+1×3 · 경로 fragmentation×3 abundance×0.5 | 가상 |
| `climate_relocation` ✦ | 기후 재난과 팹 이전 | 2060~2150 | 0.012 | 3·15년 | 장비+1×2, 한국-0.5×2 | 경로 transition×2 | 가상 |
| `solar_superstorm` ✦ | 초대형 태양폭풍 | 2060~2150 | 0.006 | 2·30년 | 업계-1×1, 로직+1×2(+1), 한국-0.5×1 | — | 가상 |
| `orbital_debris_cascade` ✦ | 궤도 파편 연쇄 충돌 | 2060~2150 | 0.01 | 1 | 업계-0.5×1 | 노드 지연 orbital_materials+15 · 조건 tech_space_crystal_fab | 가상 |

- F3 12개: `ai_overbuild_bust` `ai_supercycle_extended` `china_memory_flood` `taiwan_blockade` `taiwan_invasion` `energy_crunch` `trade_war_escalation` `specialty_gas_shock` `drought_water_crisis` `pandemic_supply_shock`(= 팬데믹) `korea_talent_cliff` `korea_secular_stagnation`. 확률은 F3가 제안한 설계 추정값을 그대로 옮겼습니다 (예: 봉쇄 연 1.1% → 2027~2060 누적 약 30%, 침공 연 0.4% → 약 13%, 봉쇄가 있었으면 ×3).
- AI 분기 3개: `agi_arrival`, `ai_plateau`, `explosive_growth`. 인구 1개: `demographic_rebound` (2025년 출산율 0.80 반등이 근거, 신뢰 낮음).
- 가상 7개 ✦: `ai_incident_regulation` `robot_tax_ubi` `compute_glut` `bloc_split` `climate_relocation` `solar_superstorm` `orbital_debris_cascade`.

### 5.3 변혁적 AI(AGI) 도래 — 한 해가 아니라 분포
- 정의: "대부분의 인지 업무를 사람보다 잘하고 싸게 하는 AI가 공식 확인" (AI Impacts의 HLMI에 가까움. 물리 노동까지 포함한 FAOL은 별도 노드 `full_labor_automation`, 중앙값 2100).
- 조건: `tech_superhuman_coder`(초인적 AI 코더, 중앙값 2031)가 켜진 뒤. `ai_plateau`가 먼저 오면 확률 ×0.3.
- 연 확률 계단: 2029~ 4% · 2032~ 7% · 2038~ 9% · 2046~ 9% · 2052~ 5% · 2061~ 2.5% · 2076~ 1%.
- 결과(1,000판): **10% 2034 · 25% 2037 · 50% 2042 · 75% 2053**, 2050년 전 72%, 2150년까지 없음 12%, 2030년 전 0% (선행 노드 때문). F4가 권한 "2030~2050년 분포, 중앙값 약 2040, 이른 도래와 정체 둘 다 허용"에 맞춤.
- 효과: 추세 +1.5%p×15년, 업계·메모리·로직·장비 +1×2년, 사무·설계·애널리스트 수요 영구 감소, 스킬 `ai_systems` +0.3·`eda_ai` +0.2, 한국 성장 +0.8%p×15년, 기대수명 D +1, 세계 경로 풍요 +0.3. 뒤따를 수 있는 것: `explosive_growth`(휴머노이드 대량 보급도 필요, 연 0.4%), `ai_incident_regulation`, 조건부 노드 `full_labor_automation`·`ai_longevity_claims`·`ai_designed_arch`·`compute_dividend`.

### 5.4 판당 발동 (1,000판)
| 시나리오 | 한 번 이상 | 판당 횟수 | 시나리오 | 한 번 이상 | 판당 횟수 |
|---|---|---|---|---|---|
| `ai_supercycle_extended` | 19% | 0.19 | `agi_arrival` | 88% | 0.88 |
| `ai_overbuild_bust` | 28% | 0.28 | `ai_plateau` | 19% | 0.19 |
| `china_memory_flood` | 40% | 0.40 | `explosive_growth` | 30% | 0.29 |
| `taiwan_blockade` | 30% | 0.30 | `demographic_rebound` | 51% | 0.51 |
| `taiwan_invasion` | 14% | 0.14 | `ai_incident_regulation` | 56% | 0.56 |
| `energy_crunch` | 76% | 1.00 | `robot_tax_ubi` | 78% | 0.78 |
| `trade_war_escalation` | 95% | 2.27 | `compute_glut` | 75% | 1.05 |
| `specialty_gas_shock` | 100% | 10.97 | `bloc_split` | 53% | 0.53 |
| `drought_water_crisis` | 100% | 13.63 | `climate_relocation` | 72% | 1.11 |
| `pandemic_supply_shock` | 93% | 1.90 | `solar_superstorm` | 41% | 0.45 |
| `korea_talent_cliff` | 100% | 1.00 | `orbital_debris_cascade` | 45% | 0.45 |
| `korea_secular_stagnation` | 66% | 0.66 |  |  |  |

---

## 6. 2060~2150 세계 경로 ✦

### 6.1 네 경로
| 경로 | 한 줄 | 기본 가중 | 추세 성장 | 진폭 | 한국 실질성장 | 물가 | 중립금리 r* | 실질임금 | 한국 점수 보정 | 자동화 배수 | 2150 인구 배수 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `abundance` 풍요 | AI·로봇이 일을 나눠 맡고 연산·에너지가 싸짐. 일은 선택, 분배가 정치의 중심 | 0.25 | 3.5% | 0.9 | +1.2% | 1.5% | 0.5 | +1.4% | +0.1 | 1.25 | ×1.15 |
| `stagnation` 정체 | 규제·인구 감소·축소 한계. AI는 도구에 머물고 고용은 천천히 재편 | 0.30 | 1.2% | 0.8 | −0.3% | 1.0% | −0.5 | +0.2% | −0.25 | 0.6 | ×0.9 |
| `fragmentation` 분열 | 기술 블록으로 갈라져 같은 칩을 두 번 만듦. 팹 건설은 많지만 물가·시황이 거침 | 0.20 | 2.0% | 1.35 | +0.4% | 3.0% | 0.5 | +0.5% | +0.15 | 0.9 | ×0.95 |
| `transition` 전환 | 기후·에너지가 상한. 전력·물·소재를 아끼는 기술이 이끔. 초반 느리고 뒤로 갈수록 빠름 | 0.25 | 2.0% → 2085년부터 3.0% | 1.1 | +0.6% | 2.5% | 0 | +0.9% | 0 | 1.0 | ×1.1 |

추세 성장의 가중 평균은 약 2.3%로 F3 권고(2060년 이후 명목 2~3%)에 맞습니다. 근거 실마리: F4 `beyond_2060_ko`의 (a) 풍요 자동화 (b) 규제·정체 (c) 에너지·자원 제약 + F3의 지정학 시나리오 외삽(분열).

### 6.2 판정 규칙
```
기울기 tilt[경로] = Σ 등장 노드·발동 시나리오의 effects.world_path (경로마다 최대 0.6)
가중치 w[경로] = max(0.01, base_weight + tilt)
2060년: u[15]로 가중 추첨 → 경로 확정, 그 해 헤드라인 = 경로 headline_ko
2100년: u[15] < 0.6이면 유지, 아니면 (u[15] − 0.6)/0.4로 다시 가중 추첨 (그동안 쌓인 기울기 포함)
```
결과(1,000판): 2060년 풍요 27% · 전환 26% · 정체 24% · 분열 23%, 2100년에도 비슷한 비율 (재판정으로 약 40%의 판이 경로를 다시 뽑고 그중 일부가 바뀜).

### 6.3 무엇이 어느 경로로 기울게 하나
| 경로 | 기울게 하는 노드·시나리오 (+가중치, 시나리오는 발동할 때마다) |
|---|---|
| 전환 | dc_power_1000twh +0.05, southwest_cluster_fab1 +0.05, korea_smr_first +0.05, reversible_computing +0.05, climate_adapted_fab +0.05, energy_node_race +0.05, fusion_grid +0.1, energy_crunch +0.1, drought_water_crisis +0.03, demographic_rebound +0.05, climate_relocation +0.1 |
| 분열 | us_japan_advanced_logic +0.05, china_chip_selfsufficiency_80 +0.1, taiwan_blockade +0.15, taiwan_invasion +0.3, trade_war_escalation +0.05, bloc_split +0.3 |
| 풍요 | superconducting_digital +0.05, lights_out_fab +0.1, half_work_automated +0.1, fusion_grid +0.1, compute_dividend +0.1, full_labor_automation +0.2, agi_arrival +0.3, explosive_growth +0.4, demographic_rebound +0.05 |
| 정체 | scaling_end_atomic_limit +0.1, pension_fund_depletion +0.1, korea_workforce_half +0.1, ai_overbuild_bust +0.05, korea_secular_stagnation +0.2, ai_plateau +0.25, ai_incident_regulation +0.2, compute_glut +0.1 |

### 6.4 경로가 바꾸는 것
| 항목 | 규칙 |
|---|---|
| 추세 | `g_T` = 경로 trend_pct (전환은 계단표) + 활성 trend 효과 |
| 사이클 진폭 | `amp = 0.85 × 경로 amp` |
| 한국 점수 | `korea`에 경로 `korea_bias` 더함 |
| 시나리오 | `prob_mult_path`: 로봇세(풍요 ×2, 정체 ×0.5), 연산 포화(풍요·정체 ×1.5), 블록 분리(분열 ×3, 풍요 ×0.5), 기후 이전(전환 ×2) |
| 가상 노드 연도 | `path_year_shift`: 핵융합(풍요 −10, 전환 −8, 정체 +15), 원자 정밀 제조(풍요 −8, 정체 +12), 연산 배당(풍요 −15, 정체 +20), 달·궤도 소재(풍요 −10, 분열 +10, 정체 +20) 등 9개 |
| 일자리 | 2061년부터 노드의 감소 배율 m < 1을 `1 − 자동화 배수 × (1 − m)`로 다시 계산 (풍요는 더 줄고, 정체는 덜 줄음) + 경로 `jobs` 배율을 10년에 걸쳐 (8.1) |
| 거시 | 한국 실질성장·물가·r*·실질임금·코스피 가산이 경로 값으로 (7.3) |
| 인구 | 2072→2150년에 걸쳐 인구 지수 × 경로 배수 (7.2) |

### 6.5 서사 뼈대 (GPT T09가 살을 붙임)
| 경로 | 일터 | 일상 | 반도체 |
|---|---|---|---|
| 풍요 | 사람은 감독·책임 서명·대면 돌봄. 주 3~4일. 무인 팹 네트워크 | 연산 배당, 가사 로봇, 수명 연장 논쟁 | 연산이 싸져 칩 수요는 계속 늘지만 '연산 포화' 공포도 |
| 정체 | 고령 기술자 재고용, 정년 70, 자동화는 느림 | 인구 2천만대 한국, 빈 지방 도시, 연금 갈등 | 리퍼브 팹, 경쟁사 합병, 작은 진폭의 긴 사이클 |
| 분열 | 같은 공정을 두 블록에 각각 셋업하는 파견 인생, 보안 심사 | 물가 3%, 진영별 표준 기기 | 장비·건설 특수, 시황이 거칠게 흔들림 |
| 전환 | 전력·냉각·용수 기술자가 주역 | 폭염·가뭄, 내륙 이전 신도시 | 와트당 성능 경쟁, 기후 적응형 팹, 핵융합 전력 |

---

## 7. 한국 사회 변수 (SYSTEMS·ECONOMY가 읽음)

### 7.1 기준표 (`future_scenarios.json` → `korea_society`)
통계청 2022~2072 중위추계(F3)를 뼈대로, 사이 연도는 보간(중간 연도 수치는 기억 기반 근사라 F3도 '중간'), 2100년은 UN(OWID) 약 2,200만, 그 밖의 2072년 이후는 추세 연장 ✦입니다. 사이 연도는 선형 보간.

| 연도 | 인구(백만) | 65세+ % | 생산연령(백만) | 합계출산율 | 정년 | 연금 개시 | 연금 보험료 % | 소멸위험 시군구(/228) | 수도권 % | 근거 |
|---|---|---|---|---|---|---|---|---|---|---|
| 2022 | 51.67 | 17.4 | 36.74 | 0.78 | 60 | 63 | 9 | — | 50.5 | 통계청 |
| 2026 | 51.6 | 21.5 | 35.5 | 0.82 | 60 | 63 | 9.5 | 135 | 50.9 | 보간 |
| 2030 | 51.3 | 25.3 | 34.2 | 0.85 | 61 | 64 | 11.5 | 148 | 51.3 | 보간 |
| 2035 | 50.8 | 29.9 | 31.7 | 0.9 | 64 | 65 | 13 | 160 | 51.8 | 보간 |
| 2040 | 50.1 | 34.3 | 29 | 0.95 | 65 | 65 | 13 | 170 | 52.3 | 보간 |
| 2045 | 48.8 | 37.5 | 26.6 | 1 | 65 | 65 | 15 | 178 | 52.8 | 보간 |
| 2050 | 47.1 | 40.1 | 24.2 | 1.02 | 66 | 66 | 15 | 185 | 53.3 | 보간 |
| 2055 | 44.8 | 42.5 | 22.4 | 1.04 | 66 | 67 | 15 | 190 | 53.8 | 보간 |
| 2060 | 42.3 | 44.2 | 20.7 | 1.05 | 67 | 67 | 16 | 195 | 54.2 | 보간 |
| 2065 | 39.9 | 45.8 | 19 | 1.06 | 67 | 68 | 22 | 198 | 54.6 | 보간 |
| 2072 | 36.22 | 47.7 | 16.58 | 1.08 | 68 | 68 | 22 | 200 | 55 | 통계청 |
| 2080 | 32.5 | 48 | 14.6 | 1.1 | 68 | 68 | 22 | 202 | 55.3 | 연장✦ |
| 2090 | 27.5 | 48 | 12.3 | 1.1 | 70 | 70 | 22 | 203 | 55.6 | 연장✦ |
| 2100 | 22 | 47.5 | 10 | 1.1 | 70 | 70 | 22 | 205 | 56 | UN |
| 2125 | 16 | 47 | 7.4 | 1.15 | 70 | 70 | 22 | 205 | 56 | 연장✦ |
| 2150 | 12 | 46 | 5.6 | 1.2 | 70 | 70 | 22 | 205 | 56 | 연장✦ |

- 실제 출산율은 2023 0.72 → 2024 0.75 → 2025 0.80으로 중위 가정(2025년 0.65)보다 높습니다. 인구 숫자는 중위추계를 그대로 두고, 합계출산율 칸만 실제 반등을 반영했습니다 (모순은 작고, `demographic_rebound` 시나리오가 위쪽 경로를 맡음).
- 정년·연금 개시 나이·연금 보험료의 2045년 이후 값, 소멸위험 시군구 수, 수도권 비중은 **설계 연장값**입니다 (F3는 2037년 65세 정년 여당안, 2033년 연금 65세, 2033년 보험료 13%, 2024년 소멸위험 130곳까지만 제시).

### 7.2 해마다 계산하는 값
```
population_index(y) = 인구(y) / 인구(2026)
                      × (y > 2072 ? 1 + (경로 population_2150_mult − 1) × (y − 2072)/78 : 1)
                      × (demographic_rebound 발동 F년 ? 1 + 0.15 × min(1, (y − F)/40) : 1)
retire_age(y)       = 60 (y < 2029)
                      · min(64, 61 + floor((y − 2029)/2))      ← korea_retirement_65 노드 전
                      · max(65, 표의 2045년 이후 정년 값 중 y 이전 최댓값)   ← 노드 뒤 (2050 66 · 2060 67 · 2072 68 · 2090 70)
pension_start_age(y)= max(65, 표의 2035년 이후 연금 개시 값 중 y 이전 최댓값)   (2050 66 · 2055 67 · 2065 68 · 2090 70)
                      2033년까지는 ECONOMY 10.1의 출생 연도 표가 우선 (그 표의 끝값이 65)
tfr(y)              = 표 보간 → SYSTEMS 8.5 f(y) = clamp(tfr/2, 0.3, 1.5)
medical(y)          = 기대수명 D 가산 = min(4, Σ medical.life_d)   · 치료 배수 = min(1.5, Π medical.cure_mult)
                      (AI 신약 +0.5·×1.1, AGI +1·×1.1, 폭발 성장 +1, AI 수명 연장 +2, 의료 BCI +0.5·×1.05) → SYSTEMS 9.1 D(y) 최대 97 + 가산
semi_child_base(y)  = clamp(0.07 × 현장(core) 직업 평균 수요 배율, 0.03, 0.10)      → SYSTEMS 8.6 base
```
- 그대로 두는 것 (SYSTEMS 기본값 유지 제안): 진학률(2026년 값), 초혼 나이(남 34·여 32), 병역 18개월. 인구 감소로 생기는 병역·진학 논쟁은 사건 문장(GPT)으로만 다룹니다.

### 7.3 ECONOMY 11.1 행 만들기
ECONOMY.md 11.1의 대체 분포와 **같은 식**에 미래 기준선만 꽂습니다. 시작값은 `economy_history.json` 2026년 행, 2026년 물가상승률은 CPI 2025→2026.
```
pathOn = 2061년 이후이고 경로가 있음
g      = (pathOn ? 경로 korea_real_growth : 표[2027 1.9 · 2031 1.6 · 2036 1.3 · 2041 0.9 · 2046 0.4 · 2051 0.0 · 2056 −0.2])
         + 0.3 × korea 점수 + Σ 시나리오 econ.korea_growth_pct
macro_score = clamp(R(0.5 × korea + (g − 기준선)), −2, 2)
π*     = (pathOn ? 경로 inflation : 2.0) + Σ 시나리오 econ.inflation_pct
infl_pct      = clamp(π* + 0.5 × (지난해 − π*) + 0.8·z, −1, 8)
real_wage_pct = clamp(기준선[2027 1.3 · 2041 1.0 · 2051 0.6 | 경로 real_wage] + 자동화 감쇠 + 0.3 × macro + 0.8·z, −4, 5)
                자동화 감쇠 = −0.4 (half_work_automated 등장 뒤 25년)        ← 노동소득 비중 하락 (F4)
r*            = 0.8 → 0.0 (2027→2060 선형) | 경로 r*
base_rate_pct = clamp(지난해 + 0.5 × (r* + infl − 지난해) + 0.3·z, 0.25, 8)
mortgage_spread = 1.4 + 0.2·z,  deposit_spread = 0.3
min_wage_growth_pct = 명목임금 상승률 + 0.3 + 0.8·z, 최저임금 월액 ÷ 평균임금 월액을 0.40~0.65로 묶음
house_*_chg_pct: ln 변동 = ln(1+infl) + real_wage + 0.15·ln(PIR*/PIR) − 0.8·Δ금리/100 + 인구계수 × 인구증가율 + σ·z
                 PIR* 서울 25·지방 6, σ 서울 0.06·지방 0.04, 인구계수 서울 0.2·지방 0.6, PIR 울타리 서울 6~45·지방 2.5~12
kospi_ret_pct = exp(ln(1+infl) + 0.045 + 경로 kospi_adj + 0.08 × macro + 0.04 × korea + 0.2·z) − 1,  −60~+90%
dividend_yield_pct 2.0 · jeonse_ratio 0.55 · ltv_capital 0.60 · ltv_local 0.70
retire_age, pension_start_age, population_index = 7.2
semis_wage_extra_pct (참고) = 1.5 × korea + Σ 시나리오 econ.semis_wage_pct   ← 인력 절벽 때 반도체 직군 임금 가산
```
- 추가로 ECONOMY에 제안: `m_rural(y) = max(0.15, 0.35 × population_index(y)^1.5)` (농어촌 집값 배율), 지역 효과(`region`)가 있는 노드가 나오면 그 지역 집값 변동 +1.5%p × 5년, 원룸 공실 −10%.
- 디노미네이션: 1,000판 중 가장 큰 금액이 서울 집 약 1.7×10^11원(분열 경로 2150년)이라 ECONOMY 11.2의 10^14원 기준에 닿지 않습니다. 규칙은 그대로 두되 시뮬상 발동하지 않습니다.
- 시드 1, 정체 경로 예: 2027 물가 2.6%·금리 3.3% → 2060 물가 1.4%·금리 2.0% → 2120년대 물가 1~2%·금리 0.3~1.4%, 인구 지수 2150년 0.24.

### 7.4 지역
- 노드 `region` 효과: `yongin_power_lng_3gw`·`yongin_first_fab`·`yongin_national_fab1`·`yongin_general_full`·`yongin_cluster_full` → `yongin`, `southwest_cluster_fab1` → `gwangju_jn`(호남). SYSTEMS·ECONOMY 제안: 그 지역 일자리 공고 +20% × 5년, 집값 +1.5%p × 5년, `near_fab` 판정은 `character.json` `fab_since`(용인 처인 2025)를 그대로.
- 소멸위험 시군구 수와 수도권 비중(7.1)은 지방 원룸 공실·지방 집값 사건의 확률 조절용입니다.

---

## 8. 직업 수요 변화

### 8.1 규칙
```
job_demand(job, y) = Π 영구 배율 m_i(y) × (1 + min(0.6, Σ 일시 (mult − 1))) × Π 일시 감소 mult × 경로 jobs 배율
  영구 m_i(y) = 1 + (m − 1) × min(1, (y − 등장 + 1)/ramp),  ramp = jobs_ramp ?? 5
  2061년~ m < 1 이면 m ← 1 − 자동화 배수 × (1 − m)
  경로 jobs 배율은 2060년부터 10년에 걸쳐
  최종 0.05~3.0
```
- 일시 배율(공사 붐 등)은 곱하지 않고 **더해서 +60%까지**: 용인 팹·기가와트 캠퍼스·1.4nm 기가팹이 겹쳐도 2030년 용접·배관·전기 수요가 1.6배에서 멈춥니다 (F4: 2030년 건설 기능공 +30~50%).
- SYSTEMS 쓰는 법(제안): 그 직업 채용 확률·first_job 슬롯 가중 × `job_demand`, 수요가 5년 사이 0.8배 아래로 떨어지면 구조조정 확률 × `1/job_demand`. F4가 강조하듯 **감소는 신입 채용 축소가 먼저** (기존 인력 해고는 시황 −2와 겹칠 때).
- 시황 점수(SYSTEMS 6장)와는 곱하지 않고 따로 봅니다. 배율은 "구조", 점수는 "그 해 경기"입니다.

### 8.2 F4 직업 전망 → jobs.json id
| F4 직업 | jobs.json id | 주로 움직이는 노드 |
|---|---|---|
| 팹 오퍼레이터 | `operator` | 디지털 트윈 0.9 → 자율 운영 팹 0.55 → 무인 팹 0.45 |
| 설비 엔지니어 | `equipment_engineer`, `field_service` | 디지털 트윈 1.1, 자율 팹 0.88, 휴머노이드 0.92, 무인 팹 0.8 / High-NA·1.4nm 셋업(현장 서비스 ↑) |
| 공정 엔지니어 | `process_engineer`, `yield_engineer` | 디지털 트윈 0.95, 자율 팹 0.78·0.85, 업무 절반 자동화 0.85 (CFET·3D D램은 ↑) |
| 반도체 설계(회로·검증) | `circuit_designer` | 커스텀 HBM·칩렛 ↑, 에이전트 EDA 0.9, 초인적 코더 0.8, 업무 절반 0.8 |
| 소프트웨어·AI | `developer` | 초대형 학습 0.9, 초인적 코더 0.6, 업무 절반 0.75, AGI 0.8 |
| 사무직 | `office_worker`, `hr`, `purchasing`, `patent` | 온디바이스 AI, 초대형 학습, 초인적 코더, 업무 절반 0.5 |
| 품질·계측 | `quality_engineer` | 디지털 트윈 0.8, 자율 팹 0.7, 무인 팹 0.7 |
| 건설 기능공 | `electrician`, `pipefitter`, `welder`, `duct_worker`, `scaffolder`, `crane_operator`, `site_manager` | 기가와트 캠퍼스·용인 팹·서남권 일시 붐 → 휴머노이드 0.7~0.88 |
| 구내식당 조리사 | `cook`, `dietitian` | 서비스 로봇 0.95, 휴머노이드 0.7, 무인 팹 0.75 |
| 보안요원 | `security_gate` | 서비스 로봇 0.85, 휴머노이드 0.65, 무인 팹 0.7 |
| 클린룸·시설 청소 | `janitor`, `cleanroom_laundry` | 서비스 로봇 0.85, 휴머노이드 0.6, 무인 팹 0.4~0.5 |
| 투자·애널리스트 | `analyst` | 초대형 학습 0.9, 초인적 코더 0.8, 업무 절반 0.65 |
| 통근버스·택시 | `shuttle_driver`, `driver` | 레벨4 자율주행 0.5 (12년에 걸쳐), 업무 절반 0.5 |
| 교사·학원 강사 | `teacher`, `academy_teacher` | AI 튜터 0.95·0.8, 고령 40%(학령인구) 0.85 |
| 의사·간호사 | `nurse` | 고령 40% 1.3, 가정 로봇 0.9 (의사 id 없음 — jobs_extra에 생기면 AI 신약·의료 AI로 0.85) |
| 로봇 정비사·AI 운영 기술자 (신규) | 8.4 제안 id | — |

### 8.3 중앙 경로의 연대별 수요 배율
`--median`: 모든 노드가 중앙값 연도(선행 보정), AGI 2041, 다른 시나리오 없음. 1.00 = 2026년 수준. 2060년 뒤는 경로에 따라 6.4처럼 달라지므로 싣지 않았습니다.

| 직업 id | 2030 | 2040 | 2050 | 2060 |
|---|---|---|---|---|
| process_engineer | 0.99 | 0.89 | 0.74 | 0.74 |
| equipment_engineer | 1.06 | 0.92 | 0.71 | 0.71 |
| yield_engineer | 1.03 | 0.89 | 0.89 | 0.89 |
| device_researcher | 1.01 | 1.19 | 1.19 | 1.07 |
| circuit_designer | 1.03 | 0.82 | 0.52 | 0.52 |
| quality_engineer | 0.92 | 0.59 | 0.37 | 0.37 |
| operator | 0.94 | 0.49 | 0.22 | 0.22 |
| assembler | 1.04 | 0.79 | 0.63 | 0.63 |
| field_service | 1.26 | 1.13 | 1.13 | 1.13 |
| chemist | 1.00 | 1.05 | 1.05 | 1.05 |
| hr | 0.98 | 0.77 | 0.34 | 0.34 |
| purchasing | 0.93 | 0.65 | 0.26 | 0.26 |
| sales | 1.00 | 1.00 | 0.85 | 0.85 |
| patent | 0.98 | 0.81 | 0.42 | 0.42 |
| welder | 1.60 | 0.82 | 0.70 | 0.70 |
| pipefitter | 1.60 | 0.91 | 0.85 | 0.85 |
| electrician | 1.60 | 1.02 | 0.97 | 0.97 |
| duct_worker | 1.55 | 0.88 | 0.80 | 0.80 |
| scaffolder | 1.54 | 0.85 | 0.75 | 0.75 |
| crane_operator | 1.35 | 1.00 | 1.00 | 1.00 |
| site_manager | 1.20 | 1.00 | 1.00 | 1.00 |
| cook | 1.06 | 0.78 | 0.50 | 0.50 |
| dietitian | 1.00 | 1.00 | 0.75 | 0.75 |
| security_gate | 0.97 | 0.67 | 0.39 | 0.39 |
| shuttle_driver | 0.96 | 0.54 | 0.21 | 0.21 |
| cleanroom_laundry | 1.00 | 0.75 | 0.27 | 0.27 |
| janitor | 0.88 | 0.65 | 0.26 | 0.26 |
| dorm_manager | 1.00 | 1.00 | 0.60 | 0.60 |
| professor | 1.00 | 1.00 | 0.95 | 0.95 |
| journalist | 1.00 | 0.90 | 0.57 | 0.57 |
| official | 1.00 | 1.00 | 0.77 | 0.77 |
| analyst | 0.98 | 0.72 | 0.35 | 0.35 |
| landlord | 1.25 | 1.10 | 1.19 | 1.21 |
| chicken_shop | 1.10 | 1.00 | 1.08 | 1.10 |
| recruiter | 1.00 | 1.00 | 0.70 | 0.70 |
| academy_teacher | 0.96 | 0.70 | 0.45 | 0.45 |
| office_worker | 0.95 | 0.73 | 0.31 | 0.31 |
| factory_worker | 0.96 | 0.72 | 0.57 | 0.57 |
| farmer | 1.00 | 0.91 | 0.85 | 0.85 |
| shopkeeper | 1.00 | 1.00 | 0.90 | 0.90 |
| teacher | 0.99 | 0.95 | 0.92 | 0.81 |
| civil_servant | 1.00 | 1.00 | 0.85 | 0.85 |
| nurse | 1.00 | 1.00 | 0.95 | 1.17 |
| developer | 0.98 | 0.54 | 0.32 | 0.32 |
| driver | 0.96 | 0.54 | 0.25 | 0.25 |
| part_timer | 0.96 | 0.78 | 0.67 | 0.67 |

변화 없음(1.00): environment_safety, facility_manager, retail_investor, youtuber — 노드가 직접 건드리지 않는 직업. 시황·경기(SYSTEMS)로만 움직입니다.

F4와 대조: 오퍼레이터 2040 0.49(F4 −40~50%), 2050 0.22(−60~80%) · 설비 엔지니어 2030 1.06(+10%), 2050 0.71(−30~40%) · 공정 엔지니어 2040 0.89, 2050 0.74 · 사무직 2050 0.31(−70%) · 건설 기능공 2030 1.6(+30~50%보다 조금 큼 — 용인 공사가 겹친 한국 사정), 2050 0.70~0.97 · 조리사 2050 0.50(−50%) · 보안 2050 0.39(−60~70%) · 기사 2040 0.54(−50%), 2050 0.25(−70~80%).

### 8.4 미래에 생기는 직업
**jobs.json(또는 jobs_extra.json)에 넣을 후보** — 이름·등장·스킬·학력. 등장 전(`since`)에는 지원 불가, 등장 노드가 그 판에서 안 나오면 계속 막힘.
| 제안 id | 이름 | 등장 (노드, 중앙값) | 필요 스킬 | 최소 학력 | 들어오는 길 |
|---|---|---|---|---|---|
| `dc_technician` | AI 데이터센터 운영 기술자 | gigawatt_ai_campus 2027 | power_cooling | 전문대졸 | 전기공·시설관리 |
| `ai_auditor` | AI 감사·컴플라이언스 담당 | ai_regulation_regime 2027 | ai_systems | 대졸 | 인사·특허 |
| `robot_teacher` | 로봇 티칭 기술자 | humanoid_pilot 2027 | robotics | 고졸 | 조립 생산직·오퍼레이터 |
| `fab_data_engineer` | 팹 데이터 엔지니어 | ai_fab_digital_twin 2028 | fab_ai | 대졸 | 수율·공정 엔지니어 |
| `cooling_fitter` | 액체냉각 배관 기술자 | rack_600kw_3d_accelerator 2028 | uhp_piping | 무관 | 배관공·용접공 |
| `photonics_engineer` | 광 패키징·실리콘 포토닉스 엔지니어 | cpo_optics 2026 · optical_io_scaleup 2029 | silicon_photonics | 대졸 | 회로·공정 |
| `quantum_engineer` | 양자 소자 공정 엔지니어 | cryo_quantum_supply_chain 2029 | quantum_hw | 석사 | 소자 연구원 |
| `cryo_technician` | 극저온 기술자 | cryo_quantum_supply_chain 2029 | quantum_hw | 전문대졸 | 설비·장비 서비스 |
| `bonding_engineer` | 하이브리드 본딩 공정 엔지니어 | hbm_hybrid_bonding 2030 | hybrid_bonding | 대졸 | 공정·품질 (TC 본더 경력은 재교육) |
| `pqc_engineer` | PQC 하드웨어 검증 엔지니어 | pqc_migration 2030 | pqc_security | 대졸 | 회로 설계 |
| `remote_vehicle_controller` | 자율주행 원격 관제사 | robotaxi_korea 2030 | — | 고졸 | 통근버스·택시 기사 |
| `ai_agent_supervisor` | AI 에이전트 감독관 | superhuman_coder 2031 | ai_systems | 대졸 | 개발자·회로 설계 |
| `ai_fab_controller` | AI 공정 관제사 | autonomous_fab_l4 2034 | fab_ai | 전문대졸 | 오퍼레이터 (가장 중요한 기능직 전환 경로) |
| `robot_technician` | 로봇 정비사 | humanoid_mass 2038 | robotics | 고졸 | 설비 엔지니어·용접공·전기공 |
| `smr_operator` | SMR 운전원 | korea_smr_first 2038 | power_cooling | 전문대졸 | 전기공 |
| `remote_fab_operator` | 원격 팹 운영자 | lights_out_fab 2045 | fab_ai | 대졸 | AI 공정 관제사 |
| `microfab_operator` ✦ | 마이크로팹 운영자 | personal_microfab 2095 | process_integration | 전문대졸 | 공정 엔지니어 (자영업형) |
| `bioethics_reviewer` ✦ | 바이오칩 윤리 심사관 | bio_silicon_learning 2092 | novel_compute | 석사 | 교수·연구원 |

**그 밖의 직함** (노드 `new_jobs_ko` 전체, 중앙값 연도순 — 세부 직업 `job_matrix`·사건 문장용):
2026 광 패키징·정렬 엔지니어 (cpo_optics, silicon_photonics) · 2027 후면 전력망(PDN) 설계 엔지니어 (backside_power, process_integration) · 2027 웨이퍼 박막화·본딩 엔지니어 (backside_power, process_integration) · 2027 HBM 베이스 다이 설계자 (hbm4e_custom, hbm_design) · 2027 고객 공동설계 엔지니어 (hbm4e_custom, hbm_design) · 2027 패키지 휨(warpage) 관리 엔지니어 (cowos_mega_interposer, adv_substrate) · 2027 CXL 컨트롤러 설계자 (cxl_pooling, hbm_design) · 2027 로봇 티칭 기술자 (humanoid_pilot, robotics) · 2027 AI 데이터센터 운영 기술자 (gigawatt_ai_campus, power_cooling) · 2027 AI 감사·컴플라이언스 담당 (ai_regulation_regime, ai_systems) · 2028 DTCO(설계-공정 공동 최적화) 엔지니어 (node_a14, process_integration) · 2028 High-NA 장비 현장 정비 기술자 (high_na_euv, litho_process) · 2028 애너모픽 마스크 엔지니어 (high_na_euv, litho_process) · 2028 PIM 컴파일러·런타임 개발자 (pim_mainstream, hbm_design) · 2028 3D-IC 열설계 엔지니어 (logic_3d_soic, hybrid_bonding) · 2028 TGV(유리관통전극) 가공 엔지니어 (glass_core_substrate, adv_substrate) · 2028 액체냉각 배관 기술자 (rack_600kw_3d_accelerator, chip_architecture) · 2028 SiC 결정 성장 엔지니어 (wbg_power_mainstream, power_semis) · 2028 AI 학습 데이터 전문가(부업) (data_wall, ai_systems) · 2028 팹 데이터 엔지니어 (ai_fab_digital_twin, fab_ai) · 2029 수직 트랜지스터 소자 엔지니어 (dram_4f2_vertical, dram_cell) · 2029 대면적 패널 공정 엔지니어 (panel_level_packaging, adv_substrate) · 2029 광-전 공동설계 엔지니어 (optical_io_scaleup, silicon_photonics) · 2029 극저온 기술자 (cryo_quantum_supply_chain, quantum_hw) · 2029 양자 소자 공정 엔지니어 (cryo_quantum_supply_chain, quantum_hw) · 2029 AI 검증 에이전트 운영자 (agentic_eda, eda_ai) · 2030 하이브리드 본딩 공정 엔지니어 (hbm_hybrid_bonding, hybrid_bonding) · 2030 표면 활성화·CMP 엔지니어 (hbm_hybrid_bonding, hybrid_bonding) · 2030 칩렛 아키텍트 (ucie_open_chiplet, chip_architecture) · 2030 KGD(양품 다이) 테스트 엔지니어 (ucie_open_chiplet, chip_architecture) · 2030 자율주행 원격 관제사 (robotaxi_korea, chip_architecture) · 2030 PQC 하드웨어 검증 엔지니어 (pqc_migration, pqc_security) · 2031 배선 신소재(루테늄·몰리브덴) 엔지니어 (node_a10, device_physics) · 2031 다중 웨이퍼 정렬·수율 엔지니어 (nand_1000l, nand_3d) · 2031 다층 칩 분할 설계자 (cmos20_functional_tiers, hybrid_bonding) · 2031 양자 오류정정 디코더 설계자 (fault_tolerant_qc, quantum_hw) · 2031 양자 알고리즘 개발자 (fault_tolerant_qc, quantum_hw) · 2031 AI 에이전트 감독관 (superhuman_coder, ai_systems) · 2031 해외 팹 셋업 파견 엔지니어 (us_japan_advanced_logic, —) · 2032 유리 인터포저 설계 엔지니어 (hbm6, hbm_design) · 2032 MTJ 공정 엔지니어 (sot_mram_cache, emerging_memory) · 2032 혼성신호 AI 회로 설계자 (analog_imc, novel_compute) · 2033 산화물(IGZO) 반도체 엔지니어 (dram_3d, dram_cell) · 2033 3D 셀 설계자 (dram_3d, dram_cell) · 2033 스파이킹 신경망 엔지니어 (neuromorphic_scale, novel_compute) · 2034 AI 공정 관제사 (autonomous_fab_l4, fab_ai) · 2035 3D 셀 라이브러리 설계자 (cfet, device_physics) · 2035 선택적 식각 공정 엔지니어 (cfet, device_physics) · 2035 칩 내장 냉각 열유체 엔지니어 (hbm7, hbm_design) · 2035 강유전 소재·계면 엔지니어 (fefet_fenand, emerging_memory) · 2035 양자-HPC 통합 엔지니어 (utility_scale_qc, quantum_hw) · 2036 고NA 반사 미러 정밀가공 기술자 (hyper_na_euv, litho_optics) · 2036 광 신경망 엔지니어 (photonic_compute, silicon_photonics) · 2037 저온 공정 엔지니어 (monolithic_3d_logic, process_integration) · 2037 3D 열 해석 엔지니어 (monolithic_3d_logic, process_integration) · 2038 로봇 정비사 (humanoid_mass, robotics) · 2038 SMR 운전원 (korea_smr_first, power_cooling) · 2039 양자 암호분석가 (crqc_qday, pqc_security) · 2039 양자보안 감사관 (crqc_qday, pqc_security) · 2040 원자층 공정(ALD/ALE) 전문가 (node_a3, process_integration) · 2040 단열·가역 회로 설계자 (reversible_computing, novel_compute) · 2040 궤도 제조·회수 엔지니어 (space_crystal_fab, power_semis) · 2042 바이오-반도체 융합 엔지니어 (dna_storage, emerging_memory) · 2042 초전도 회로(SFQ) 설계자 (superconducting_digital, quantum_hw) · 2043 2D 소재 성장(MOCVD) 엔지니어 (channel_2d_fet, novel_channel) · 2045 가속기 광원 엔지니어 (beyond_euv_litho, litho_optics) · 2045 X선 마스크 엔지니어 (beyond_euv_litho, litho_optics) · 2045 원격 팹 운영자 (lights_out_fab, robotics) · 2045 클린룸 로봇 정비사 (lights_out_fab, robotics) · 2048 원자 단위 계측·결함 분석가 (atomic_2d_cfet, novel_channel) · 2052 시스템-기술 공동최적화(STCO) 엔지니어 (scaling_end_atomic_limit, chip_architecture) · 2055 신경-전자 인터페이스 엔지니어 (biocomputing_wetware, novel_compute) · 2055 바이오윤리 심의관 (biocomputing_wetware, novel_compute) · 2064✦ 팹 수명 연장 컨설턴트 (refurb_fab_industry, equipment_maint) · 2066✦ 층간 배선 설계자 (tier_era_logic, process_integration) · 2066✦ 칩 사양 책임자 (ai_designed_arch, eda_ai) · 2075✦ 극저온 데이터센터 운영자 (cryo_dc_standard, quantum_hw) · 2078✦ 원자 배치 공정 엔지니어 (atomic_precision_mfg, process_integration) · 2080✦ 핵융합 발전 운전원 (fusion_grid, power_cooling) · 2085✦ 신경 인터페이스 칩 설계자 (medical_bci, novel_compute) · 2090✦ 우주 소재 물류 관리자 (orbital_materials, specialty_chem) · 2092✦ 바이오칩 윤리 심사관 (bio_silicon_learning, novel_compute) · 2095✦ 마이크로팹 운영자 (personal_microfab, process_integration) · 2105✦ 분자 소자 합성 엔지니어 (molecular_switch, novel_channel)

---

## 9. R&D 스킬트리

### 9.1 대상과 포인트 (SYSTEMS 5.11을 그대로 쓰고 기능직만 넓힘)
| 항목 | 규칙 |
|---|---|
| 상태 | `career.skills = [{ id, level }]` (level 1~5), `career.skill_points` |
| 연구 대상 | SYSTEMS 5.11 그대로: research 사다리 + 현장 그룹 전문대졸↑ 엔지니어 + 교수 → 아무 스킬이나 |
| **기능 대상 (추가)** | 그 밖의 직업이라도 스킬 `jobs`에 있고 `technician: true`인 스킬(9.3 ○)만: 용접·배관·덕트·전기·시설·조립·오퍼레이터 |
| 포인트 | 대상 직업 재직 1년 +1, 석사 졸업 +2, 박사 졸업 +4, 'R&D 공부' 행동 +1, 사건 `do: "skill_point:n"` (SYSTEMS 기본값 유지) |
| 레벨 올리기 | 레벨 L로 올리는 데 L포인트 → 누적 1 · 3 · 6 · 10 · 15. 직장 1년차부터 쌓으면 대략 L3 = 5~6년, L4 = 9~10년, L5 = 14~15년 (석·박사는 그만큼 빠름) |
| 학력 상한 | 무관·고졸 3 · 전문대졸·대졸 4 · 석·박사 5. 기능직은 플래그 `master_craftsman`(기능장 사건)이 있으면 4 |
| 자동 배분 | 플레이어가 고르지 않으면 연말에 "주력 스킬"(지금 직업 목록에 있는 스킬 중 레벨 × 가치가 가장 큰 것, 없으면 그 직업 첫 스킬)에 씀 |

### 9.2 레벨의 뜻
| 레벨 | 이름 | 게임 감각 |
|---|---|---|
| 1 | 입문 | 사수 따라 하는 단계 |
| 2 | 실무 | 혼자 라인·과제를 맡음 |
| 3 | 숙련 | 팀의 그 분야 담당. **상용화 사건 자격** |
| 4 | 전문가 | 사내외에서 찾는 사람. 스카우트가 잦아짐 |
| 5 | 권위자 | 학회·특허·업계 연표에 이름 |

### 9.3 스킬 25개
연결 노드는 그 노드의 `rnd_skill`이 이 스킬인 것 (✦ 가상). 기능 ○ = 기능직도 포인트를 받는 스킬.

| id | 이름 | 그룹 | 포인트 받는 직업 | 기능직 | 인접(재교육) | 연결 노드 (중앙값 연도) |
|---|---|---|---|---|---|---|
| `device_physics` | 소자 물리·3D 트랜지스터 | 공정·소자 | device_researcher, professor |  | process_integration, novel_channel | gaa_nanosheet 2025, node_a10 2031, cfet 2035 |
| `process_integration` | 공정 통합·원자층 공정 | 공정·소자 | process_engineer, yield_engineer, device_researcher |  | device_physics, litho_process, fab_ai | backside_power 2027, node_a14 2028, monolithic_3d_logic 2037, node_a3 2040, tier_era_logic 2066✦, atomic_precision_mfg 2078✦, personal_microfab 2095✦ |
| `litho_process` | 노광 공정·계산 리소그래피 | 리소그래피 | process_engineer, equipment_engineer, field_service |  | litho_optics, process_integration | high_na_euv 2028 |
| `litho_optics` | 노광 광학·차세대 광원 | 리소그래피 | device_researcher, field_service, professor |  | litho_process, silicon_photonics | hyper_na_euv 2036, beyond_euv_litho 2045 |
| `dram_cell` | D램 셀·3D D램 | 메모리 | process_engineer, device_researcher, yield_engineer |  | nand_3d, hbm_design, emerging_memory | dram_4f2_vertical 2029, dram_3d 2033 |
| `nand_3d` | 3D 낸드 적층 | 메모리 | process_engineer, device_researcher |  | dram_cell, emerging_memory | nand_400l_bonded 2027, nand_1000l 2031 |
| `hbm_design` | HBM·메모리 인터페이스 설계 | 메모리 | circuit_designer, device_researcher |  | chip_architecture, hybrid_bonding, dram_cell | hbm4e_custom 2027, cxl_pooling 2027, pim_mainstream 2028, hbm5 2029, hbm6 2032, hbm7 2035, hbm8 2038, memory_compute_fusion 2072✦ |
| `emerging_memory` | 신메모리(MRAM·강유전체) | 메모리 | device_researcher, chemist |  | dram_cell, nand_3d, novel_compute | emram_advanced 2027, sot_mram_cache 2032, fefet_fenand 2035, dna_storage 2042 |
| `hybrid_bonding` | 하이브리드 본딩·3D 적층 | 패키징 | process_engineer, quality_engineer, assembler, equipment_engineer | ○ | adv_substrate, hbm_design | logic_3d_soic 2028, hbm_hybrid_bonding 2030, cmos20_functional_tiers 2031 |
| `adv_substrate` | 인터포저·유리기판·패널 패키징 | 패키징 | process_engineer, quality_engineer, assembler | ○ | hybrid_bonding, silicon_photonics | cowos_mega_interposer 2027, glass_core_substrate 2028, panel_level_packaging 2029 |
| `silicon_photonics` | 실리콘 포토닉스·광 I/O | 패키징 | circuit_designer, device_researcher, process_engineer |  | adv_substrate, litho_optics, chip_architecture | cpo_optics 2026, optical_io_scaleup 2029, photonic_compute 2036 |
| `chip_architecture` | 칩 아키텍처·칩렛 | 회로·설계 | circuit_designer, professor |  | eda_ai, hbm_design, novel_compute | on_device_ai 2028, rack_600kw_3d_accelerator 2028, ucie_open_chiplet 2030, robotaxi_korea 2030, scaling_end_atomic_limit 2052, hetero_tile_chip 2068✦ |
| `eda_ai` | AI 설계 자동화·검증 | 회로·설계 | circuit_designer, patent |  | chip_architecture, ai_systems | agentic_eda 2029, ai_designed_arch 2066✦ |
| `novel_compute` | 신개념 연산(뉴로모픽·인메모리·가역) | 회로·설계 | device_researcher, circuit_designer, professor |  | chip_architecture, emerging_memory, quantum_hw | analog_imc 2032, neuromorphic_scale 2033, reversible_computing 2040, biocomputing_wetware 2055, energy_node_race 2074✦, medical_bci 2085✦, bio_silicon_learning 2092✦ |
| `power_semis` | 전력반도체 소재(SiC·GaN·Ga2O3) | 소재 | chemist, device_researcher, process_engineer |  | novel_channel, power_cooling | wbg_power_mainstream 2028, ga2o3_power 2030, diamond_power 2036, space_crystal_fab 2040 |
| `novel_channel` | 2D·신소재 채널 | 소재 | chemist, device_researcher |  | device_physics, power_semis | channel_2d_fet 2043, atomic_2d_cfet 2048, molecular_switch 2105✦, post_silicon_mainstream 2110✦ |
| `specialty_chem` | 특수가스·화학·초순수 | 소재 | chemist, environment_safety, quality_engineer, pipefitter | ○ | power_semis, uhp_piping | climate_adapted_fab 2070✦, orbital_materials 2090✦ |
| `equipment_maint` | 장비 정비·예지정비 | 장비·설비 | equipment_engineer, field_service, operator, facility_manager | ○ | robotics, fab_ai, litho_process | refurb_fab_industry 2064✦ |
| `uhp_piping` | 초고순도 배관·클린룸 시공 | 장비·설비 | welder, pipefitter, duct_worker, site_manager | ○ | power_cooling, specialty_chem, robotics | yongin_first_fab 2027, yongin_national_fab1 2029, yongin_general_full 2036, southwest_cluster_fab1 2036 |
| `power_cooling` | 전력·냉각 설비 | 장비·설비 | electrician, facility_manager, equipment_engineer, site_manager, pipefitter | ○ | uhp_piping, power_semis, equipment_maint | gigawatt_ai_campus 2027, yongin_power_lng_3gw 2029, dc_power_1000twh 2031, korea_smr_first 2038, fusion_grid 2080✦ |
| `fab_ai` | 팹 데이터·수율 AI | AI | yield_engineer, process_engineer, equipment_engineer, quality_engineer, operator | ○ | equipment_maint, ai_systems, process_integration | ai_fab_digital_twin 2028, autonomous_fab_l4 2034, yongin_cluster_full 2047, dark_fab_network 2068✦ |
| `ai_systems` | AI 시스템·감독 | AI | circuit_designer, professor, patent |  | eda_ai, fab_ai | ai_regulation_regime 2027, data_wall 2028, training_2e29 2030, ai_tutor_mainstream 2030, ai_drug_approval 2030, superhuman_coder 2031, half_work_automated 2045, ai_longevity_claims 2060, full_labor_automation 2100 |
| `quantum_hw` | 양자 소자·극저온 | 양자·보안 | device_researcher, field_service, equipment_engineer |  | novel_compute, power_cooling, pqc_security | cryo_quantum_supply_chain 2029, fault_tolerant_qc 2031, utility_scale_qc 2035, superconducting_digital 2042, cryo_dc_standard 2075✦, photonic_quantum_hybrid 2082✦ |
| `pqc_security` | 보안 하드웨어·양자내성암호 | 양자·보안 | circuit_designer, patent |  | quantum_hw, chip_architecture | pqc_migration 2030, crqc_qday 2039 |
| `robotics` | 로봇 정비·티칭 | 자동화·로봇 | equipment_engineer, field_service, operator, assembler, welder, facility_manager, electrician | ○ | equipment_maint, fab_ai, power_cooling | humanoid_pilot 2027, humanoid_mass 2038, lights_out_fab 2045, household_robot 2045, self_repair_tools 2067✦ |

### 9.4 스킬 가치 v(s, y)
```
hot   = 최근 5년 안에 등장한 이 스킬 노드 수
base  = max(0.8, 1 − 0.02 × max(0, y − 마지막 등장 − 15))      // 15년 넘게 조용하면 0.8까지 서서히
v     = clamp( base + min(0.5, 0.25 × hot) + Σ 등장 노드·시나리오의 effects.skills[s] ,  0.5, 1.6 )
```
- 영구 증감 `effects.skills`가 "낡음"을 만듭니다: 원자 정밀 제조 → 노광 공정·광학 −0.3, 축소 한계 → 노광 −0.2·소자 −0.15, 메모리-연산 융합 → D램 셀 −0.2, 무인 팹 → 장비 정비 −0.15, 자가 수리 장비 → 장비 정비 −0.2, 실리콘 이후 → 소자 물리 −0.2. 반대로 무인 팹·휴머노이드 → 로봇 +0.3, 데이터센터 1,000TWh → 전력·냉각 +0.2.
- 조용한 것만으로는 0.8 아래로 안 떨어집니다 (배관·전력처럼 늘 필요한 기술 보호). 0.75 아래는 "낡은 스킬"입니다.

중앙 경로의 스킬 가치 (1.00 = 보통):

| 스킬 | 2030 | 2040 | 2050 | 2060 | 2080 | 2100 |
|---|---|---|---|---|---|---|
| device_physics | 1.25 | 1.00 | 1.00 | 0.65 | 0.65 | 0.65 |
| process_integration | 1.50 | 1.50 | 1.00 | 0.90 | 1.00 | 1.20 |
| litho_process | 1.25 | 1.00 | 0.86 | 0.60 | 0.60 | 0.50 |
| litho_optics | 1.00 | 1.25 | 1.20 | 1.20 | 1.00 | 0.70 |
| dram_cell | 1.15 | 0.90 | 0.86 | 0.70 | 0.50 | 0.50 |
| nand_3d | 1.25 | 1.00 | 0.92 | 0.80 | 0.80 | 0.80 |
| hbm_design | 1.60 | 1.35 | 1.10 | 0.96 | 1.55 | 1.20 |
| emerging_memory | 1.25 | 1.00 | 1.00 | 0.94 | 0.80 | 0.80 |
| hybrid_bonding | 1.60 | 1.20 | 1.12 | 1.00 | 1.00 | 1.00 |
| adv_substrate | 1.50 | 1.00 | 0.88 | 0.80 | 0.80 | 0.80 |
| silicon_photonics | 1.50 | 1.25 | 1.00 | 0.82 | 0.80 | 0.80 |
| chip_architecture | 1.50 | 1.00 | 0.90 | 1.20 | 1.10 | 0.90 |
| eda_ai | 1.45 | 1.20 | 1.28 | 1.20 | 1.60 | 1.40 |
| novel_compute | 1.00 | 1.25 | 1.00 | 1.00 | 1.00 | 1.00 |
| power_semis | 1.50 | 1.60 | 1.10 | 1.00 | 0.90 | 0.90 |
| novel_channel | 1.00 | 0.92 | 1.45 | 1.20 | 1.00 | 1.00 |
| specialty_chem | 1.00 | 0.92 | 0.80 | 0.80 | 1.20 | 1.00 |
| equipment_maint | 1.00 | 0.92 | 0.65 | 0.65 | 0.83 | 0.65 |
| uhp_piping | 1.50 | 1.50 | 1.00 | 0.82 | 0.80 | 0.80 |
| power_cooling | 1.50 | 1.45 | 1.20 | 1.06 | 1.00 | 1.20 |
| fab_ai | 1.45 | 1.20 | 1.45 | 1.20 | 1.45 | 1.02 |
| ai_systems | 1.50 | 1.00 | 1.30 | 1.55 | 1.20 | 1.55 |
| quantum_hw | 1.25 | 1.00 | 1.00 | 0.94 | 1.00 | 0.94 |
| pqc_security | 1.25 | 1.55 | 1.30 | 1.18 | 1.10 | 1.10 |
| robotics | 1.25 | 1.55 | 1.60 | 1.60 | 1.60 | 1.60 |

### 9.5 R&D 적합도 — SYSTEMS 5.11 `skill_fit(y)`
```
best = max over 내 스킬 k ( w_k × level_k × v(k, y) ),   w_k = 1 (지금 직업이 그 스킬 jobs에 있음) · 0.6 (아님)
skill_fit(y) = clamp(0.3 + 0.1 × best, 0, 1)            // 스킬 없음 = 0.3, 대상이 아니면 null
```
| 예 | fit | SYSTEMS 효과 (구직 z += 0.6(fit−0.5), 승진 s += 0.3(fit−0.5), 스카우트 p += 0.05 fit) |
|---|---|---|
| 신입, 스킬 없음 | 0.30 | 구직 −0.12 |
| L2, 보통 가치 | 0.50 | 영향 0 |
| L3, 뜨는 분야(1.5) | 0.75 | 구직 +0.15, 승진 +0.075 |
| L5, 뜨는 분야(1.6) | 1.00 | 구직 +0.30, 승진 +0.15, 스카우트 +0.05 |
| L5, 낡은 분야(0.5) | 0.55 | 거의 보통 — "옛 전문가" |

### 9.6 내 연구 상용화
노드 n이 등장한 해, 플레이어가 `n.rnd_skill` 레벨 ≥ 3이고 (연구 대상이거나 기능 스킬 대상이고) 재직 중이면 **트리거 `tech_commercialized`** (큰 사건, 그 해 1번만, 여러 노드면 효과 큰 것):
| 레벨 | 평판 | 성과급 | 그 해 승진 확률 가산 | 스카우트 2배 기간 |
|---|---|---|---|---|
| 3 | +8 | `@salary*0.2` | +0.15 | 2년 |
| 4 | +12 | `@salary*0.5` | +0.25 | 3년 |
| 5 | +18 | `@salary*1.0` | +0.35 | 3년 |
- 반도체 순간 `{ text: "{tech} 상용화에 내 이름이 들어갔어요", kind: "core" }`, 플래그 `my_research_commercialized`, 칭호 진행 "상용화의 주인공"(GPT T02와 맞춤).
- 기능직 버전 문장: "내가 깐 배관으로 {tech} 라인이 첫 가동했어요" (`uhp_piping`·`power_cooling`·`robotics`·`equipment_maint`).
- 교수: 성과급 대신 연구비 사건, 제자 스카우트.

### 9.7 낡은 스킬과 재교육
- 주력 스킬 가치가 0.75 아래로 2년 연속이면 **트리거 `skill_obsolete`** → 갈림길: 재교육 / 버틴다 / 관리직·영업으로 / 퇴사.
- **재교육**(55세 이하, 1년): 비용 `@salary*0.15`, 낡은 스킬 포인트의 50%를 인접 스킬(9.3 '인접') 하나로 옮기고 +1 포인트, 그해 연봉 −20%(SYSTEMS가 정함), 플래그 `retrained`. 예: 노광 공정 L4(10포인트) → 공정 통합으로 5+1 = 6포인트 = L3.
- 직업 수요 배율이 0.6 아래로 떨어진 직업(8장)의 재직자에게도 같은 갈림길을 엽니다 (예: 2045년 무렵 오퍼레이터 → `fab_ai` 재교육 → AI 공정 관제사).

---

## 10. SYSTEMS·ECONOMY 인터페이스

엔진 모듈 이름 제안 `life/js/future.js` (DOM 없음). 새 판 시작 때 `future.generate(seed)` 한 번 → `world.future`에 저장 (시드만 저장하고 불러올 때 다시 만들어도 같음).

| 함수 | 받는 쪽 | 돌려주는 값 |
|---|---|---|
| `future.market(y)` | SYSTEMS 6.1~6.2 m(s,y) | `{cycle, memory, logic_foundry, equipment, korea}` 정수 −2~2 (`marketRaw(y)`는 실수) |
| `future.row(y)` | 연표·뉴스 | 4.2 행 (`global_sales_busd`, `headline_ko`, `events_*`, `fiction`) |
| `future.econ(y)` | ECONOMY 11.1 | 7.3 행 (infl_pct … population_index) |
| `future.arrivals(y)` · `future.has(id, y)` | 사건 조건, 세대 경쟁(6.4), 연표 | 그 해 등장 노드 목록 · 등장 여부 |
| `future.fired(y)` · `future.active(id, y)` | 사건 조건 | 그 해 발동 시나리오 · 효과 기간 중인지 |
| `future.path(y)` | 사건 조건, 연표 | 세계 경로 id (2060년 전 null) |
| `future.jobDemand(job, y)` | SYSTEMS 5.2 채용, 5.7 구조조정 | 배율 (8.1) |
| `future.skillValue(skill, y)` · `future.skillFit(career, y)` | SYSTEMS 5.11 | 9.4 · 9.5 |
| `future.commercialized(y)` | SYSTEMS 1.5 트리거 | 그 해 등장 노드와 `rnd_skill` |
| `future.society(y)` | SYSTEMS 4.7·5.9·8.5·8.6, ECONOMY 10 | `{retire_age, pension_start_age, population_index, tfr, aged65_pct, working_age_m, shrinking_regions, capital_share_pct, semi_child_base}` |
| `future.medical(y)` | SYSTEMS 9.1·9.3 | `{life_d_bonus, cure_mult}` |
| `future.newSectors(y)` | SYSTEMS 6.6 설립, companies.json | 그 해 열린 분야 `{id, name_ko, market_mix}` — `quantum`(양자칩 파운드리 노드, 중앙값 2029), `robotics`(휴머노이드 대량 보급, 2038) |
| `future.raceSector(nodeId)` | SYSTEMS 6.4 | 세대 경쟁을 열 분야 (3.3) |

- **2026년까지**는 이 모듈을 부르지 않습니다 (역사 표). 프로토타입에서 모듈이 아직 없으면 SYSTEMS 6.2·ECONOMY 11.1의 대체값을 씁니다.
- 기준 구현은 `future_sim.mjs`의 `generate`, `jobMultipliers`, `skillValues`, `skillFit`, `populationIndex`, `retireAge`, `pensionAge`, `semiChildBase`, `medical` (모두 export)입니다. 엔진은 같은 난수 순서로 옮기고, `node life/tools/future_sim.mjs 7 --json`의 출력과 같은지로 검사합니다.
- 새 분야를 열 때 SYSTEMS가 할 일: `companies.json`에 분야 추가(회사 0곳으로 시작 → 6.6 설립 규칙으로 등장), `market_mix`는 위 값.

---

## 11. SPEC 추가 제안 (SPEC.md는 고치지 않았음)

| 종류 | 이름 | 뜻 |
|---|---|---|
| 상태 | `career.skills[] = {id, level}` | 지금 SPEC의 `skills[]`(id 목록)을 레벨이 있는 객체로 |
| 상태 | `world.future = {seed, arrivals{id: 연도}, fired[{id, year}], paths[{year, path}]}` | 미래 세계 (시황 행은 시드로 다시 만듦) |
| when | `tech` (id·배열: 모두 등장) · `tech_any` · `not_tech` | 그 해까지 등장한 노드 (세계 조건이라 캐릭터 `flag`와 분리) |
| when | `tech_since {id: [최소, 최대]}` | 등장 뒤 지난 햇수 — "기술 등장 사건"을 그 해·이듬해에만 |
| when | `scenario` (id·배열: 한 번이라도 발동) · `scenario_active` (효과 기간 중) · `scenario_since {id: [최소, 최대]}` | 시나리오 조건 |
| when | `world_path` (id·배열) | 2060년 이후 경로별 사건 |
| when | `skill_min {skill: level}` · `skill_value_min {skill: v}` · `skill_value_max {skill: v}` | R&D 스킬 레벨·가치 |
| when | `job_demand_max {job: x}` · `job_demand_min {job: x}` | 사라지는/뜨는 직업 사건 |
| when | `future` (bool) | 2027년 이후 |
| effects | `skill.<id>` (포인트 n을 그 스킬에 바로) | 교육·사건 보상 |
| do | `skill:retrain:<from>:<to>` · `skill:focus:<id>` | 재교육, 주력 스킬 지정 |
| 트리거 (SYSTEMS 1.5) | `tech_commercialized`, `skill_obsolete`, `job_shrinking`, `tech_news`, `world_path` | 9.6 · 9.7 · 8.1 · 3.3 · 6.2 |
| 자리표시 | `{tech}` (트리거를 부른 노드 `name_ko`) · `{skill}` (스킬 이름) | 사건 문장 |
| 예약 플래그 | `my_research_commercialized`, `retrained`, `master_craftsman` | 9.6 · 9.7 · 9.1 |
| 시황 행 | 2027년 이후 행에 `fiction`(bool), `sales_basis: "model"`, `confidence: "model"` | 4.2 |
| 검사 | `validate.mjs`가 `future_sim.mjs`의 `validate`를 불러 미래 데이터도 검사 | 지금은 JSON 문법만 검사 |
| 데이터 | `companies.json` 분야 `quantum`, `robotics` (열리는 해는 미래 모델) | 10장 |

---

## 12. 한계와 열린 질문
- **2030년 이후 시장 규모에는 1차 전망이 없습니다** (F3). 추세 6% → 4.5% → 3.5% → 2.5%와 사이클 상수는 F3 제안을 역사 분포에 맞춰 고친 설계값입니다.
- 역성장 해가 역사보다 잦습니다(33% vs 23%). 추세가 낮아진 탓이며 점수 기준 하강 빈도는 맞췄습니다. 더 줄이려면 평년 상승 범위를 좁혀야 하는데, 그러면 0점 해의 다양성이 줄어 남겨 두었습니다.
- 노드의 시황·직업 효과 크기는 판단값입니다. F4 직업 전망에 맞춰 보정했지만, F4 자체가 해석이 섞인 범위입니다. SYSTEMS의 시황 기반 채용과 겹쳐 두 번 세지 않도록 8.1의 "구조 vs 경기" 구분을 지켜 주세요.
- 한국 사회표의 중간 연도(2030~2065)는 통계청 중위추계를 기억 기반으로 보간했고(F3도 '기억 기반' 표시), 2072년 이후는 UN 2100년 한 점 외에는 연장입니다. 통계청 차기 추계(2025년 출산율 반등 반영)가 나오면 표만 바꾸면 됩니다.
- AGI 정의(HLMI 2047 vs FAOL 2116)가 70년 벌어져 있어 게임 정의를 "인지 업무"로 고정했습니다. 오너 확인이 필요합니다.
- 대만·전쟁 시나리오는 정량 확률 근거가 없습니다(F3도 설계 추정). 문장 톤은 가볍지 않게(전쟁·해고를 가볍게 다루지 않기) GPT T09에 전달 필요.
- 2060년 뒤 2030년대 같은 기술 밀도는 없습니다. 가상 노드 21개는 2060~2110년에 몰려 있고 2110~2150년은 시황·시나리오·경로가 주로 끌고 갑니다.
