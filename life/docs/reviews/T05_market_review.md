# T05 반도체 시황 데이터 교차 검토

검토 범위는 1947~2026년 **80개 연도**예요. 전체 사건·한국 사건·헤드라인을 읽고, 1986~2025년 **40개 완결 연도의 매출과 39개 전년 대비 변화율**을 같은 WSTS 개정판으로 계산·대조했어요. 1984~1985는 독립 원통계가 확보되지 않았고, 2026은 8개월 실제 누계와 연간 전망을 분리했어요. 모든 세부 사건·개별 기업 실적의 독립 원문 검증을 마친 것은 아니며 아래 미확인 범위를 남겼어요.

확정한 명백한 시점 오류는 **1건**(1997년 지원 요청 월)이에요. 별도로 집계 계열 수정 3건, 결측 보완 3건, 범위·표현 보완 7건, 보류 3건, 유지 확인 3건, 점수 판단 4건, 빠진 사건 제안 5건을 구분했어요. 개정 통계 차이와 설계 의견을 사실 오류 개수에 합치지 않았어요.

가장 먼저 볼 다섯 가지는 다음과 같아요.

1. 1997년 IMF 지원 요청을 11월 21일로 바로잡고 12월 협약·승인과 나눠요.
2. 1987년 세계 매출을 동일 WSTS 계열의 32.530452로 맞추고 빈 성장률을 보완해요.
3. 1989년 WSTS 매출과 Dataquest 성장률의 혼용을 풀어요.
4. 1992년 매출·성장률과 1993년 성장률 결측을 공식 역사표로 채워요.
5. 2025년 초기 발표와 개정값을 구분하고, 2026년 전망은 같은 기준 연도·계산 성격으로 연결해요.

검토일: 2026-10-21. 기준 커밋: `6a27458`. 원본 SHA-256: `52c366d8d957178e7a144b2cd60200725e4fb155a842949f84cf575820a1dacb`. 이 작업은 `market_history.json`과 `MARKET_HISTORY.md`를 수정하지 않아요.

## 사건·통계·점수별 검토

| 연도 | 필드 | 지금 값 | 제안 값 | 근거·출처 | 확신 |
|---|---|---|---|---|---|
| 1997 | events_korea | 12월 IMF 구제금융 신청 | 11월 21일 지원 요청 발표 / 12월 3일 의향서 / 12월 4일 승인으로 분리 | [IMF 당시 소식지](https://www.imf.org/external/pubs/ft/survey/pdf/120197.pdf) p.371에 11월 21일 요청 발표가 명시돼요. [12월 3일 의향서](https://www.imf.org/external/np/loi/120397.htm)는 4일 승인을 설명해요. PDF 본문 열람은 403이었지만 기관 검색 결과의 날짜와 의향서를 대조했어요. | high |
| 1987 | global_sales_busd / yoy_pct | 34.0 / null | 32.530452 / 23.4% | [WSTS 원본](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) Monthly Data!N16, N10. 성장률은 동일 개정판의 두 연도 연간 합계 비율로 계산해요. 34.0을 같은 WSTS 값으로 유지할 근거가 없어요. | high |
| 1989 | yoy_pct / events_world | 10.0% / Dataquest 558억 달러 | WSTS 계열은 8.4%; Dataquest 수치는 별도 집계임을 문장으로 구분 | [WSTS 원본](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) N28/N22−1=8.3505%. 현재 세계 매출 필드는 WSTS 48.8과 가깝지만 성장 설명은 다른 조사 계열이에요. 다른 기관 값 자체를 오류로 단정하진 않아요. | high |
| 2025 | global_sales_busd / yoy_pct | 791.7 / 25.6% | 현행 개정판 795.639925 / 26.2%; 최초 발표는 발행일을 붙여 별도로 설명 | [WSTS 원본](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) N244와 N238, [Spring 2026 표](https://www.wsts.org/esraCMS/extension/media/f/WST/7618/WSTS_FC-Release-2026-May.pdf)의 2025 Total World=795,640 US$M. 초기 발표와 개정값을 한 시계열에서 섞지 않아요. | high |
| 1986 | global_sales_busd / yoy_pct | null / 26.1% | 26.355359 / WSTS 성장률은 보류(null) 또는 다른 기관 집계라는 표시 | [WSTS 원본](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) N10=26,355,359(천 달러). 이 파일은 1986년부터이므로 1985년 동일 계열 값을 확보하기 전 26.1%를 WSTS 전년 대비로 재사용하지 않아요. | high |
| 1992 | global_sales_busd / yoy_pct | null / null | 59.864669 / 9.6% | [WSTS 원본](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) N46=59,864,669(천 달러), N40과의 비율로 9.6278%예요. 연중 전망 6.8%를 연간 실적으로 사용하지 않아요. | high |
| 1993 | yoy_pct | null | 29.1% | [WSTS 원본](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) N52/N46−1=29.1401%. 기존 77.3 매출은 같은 계열과 맞아요. | high |
| 2026 | events_world / _note / sales_basis | WSTS가 8월 전망을 상향했다고 요약 | Q2 실적 대입에 따른 연간 계산값이며 새로운 시나리오의 재전망은 아니라는 범위를 추가 | [WSTS Q2 설명](https://www.wsts.org/76/Global-Semiconductor-Market-records-exceptional-growth-in-Q2-2026)은 Q2만 실적으로 바꾸고 Q3 이후 성장 가정은 Spring 전망을 유지했다고 명시해요. 1,655와 약 108%는 유지할 수 있으나 연간 실적은 아니에요. | high |
| 2026 | global_sales_busd | 연간 전망 1,655.0 | 전망은 유지; 1~8월 실제 누계 1,043.025329와 별도 설명 | [WSTS 원본](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) Monthly Data!N250은 B250:I250의 8개월 합계예요. J250:M250은 비어 있어요. 이 값을 연간 실제 매출로 취급하거나 전망과 합산하지 않아요. | high |
| 2026 | events_korea / headline_ko | 3분기 잠정 영업이익 107.4조원 / 분기 이익 100조원 | 삼성전자 연결 기준 전사 잠정 영업이익임을 제목·본문 모두에서 명시 | [공식 2026-10-08 발표](https://news.samsung.com/kr/삼성전자-2026년-3분기-잠정실적-발표)에서 107.4조원은 전사 연결 잠정치예요. DS 또는 반도체 부문 확정 이익으로 바꾸면 안 돼요. 숫자가 크다는 이유만으로 삭제할 근거도 없어요. | high |
| 2011 | headline_ko / events_korea | 하이닉스 새 주인은 SK / 11월 인수 계약 | 2011년 계약 체결과 2012년 인수 완료·3월 새 사명 출범을 분리 | [공식 출범 자료](https://news.skhynix.co.kr/leap-forward-to-become-the-worlds-best-semiconductor-company/)에서 2012년 출범과 이전 회사명을 확인할 수 있어요. 현재 본문은 계약이라 적었으므로 제목의 완료처럼 읽히는 표현을 좁혀요. | high |
| 1955 | events_world / headline_ko | 쇼클리 반도체연구소 설립 | 1955년 9월 설립 합의·채용 준비 / 1956년 연구 활동 전개를 구분 | [CHM 해당 항목](https://www.computerhistory.org/siliconengine/silicon-comes-to-silicon-valley/)은 1955년 합의를 명시해요. 항목 제목이 1956이라는 이유만으로 1955 전체를 틀렸다고 하지는 않아요. | high |
| 1967 | events_korea | 3월 투자 승인과 반도체 조립공장 가동을 한 해에 기재 | 1967년 투자 승인·법인 진출, 1968년 준공·생산 기록을 따로 대조 | [전자공업 연구 항목](https://encykorea.aks.ac.kr/Article/E0049608)은 1968-01-19 모토로라코리아 공장 준공식·생산 개시를 적어요. 승인일과 실제 첫 시험가동일이 같은지 이번 조사로 확정하지 못해요. | medium |
| 1972/1974 | events_korea / sources | 1974년 1월 한국반도체 설립으로 단정 | 법인 설립·설비 구축·인수 시점을 나눠 원등기 확인 전 단정 유보 | [당사 강연을 실은 공식 보도](https://news.skhynix.co.kr/dr-kang-ki-dong-gave-a-lecture/)는 1972년 설립이라 하고, [현재 사용한 삼성 공식 사료](https://news.samsungsemiconductor.com/kr/삼성-반도체사업-40년-도전과-창조의-역사/)는 1974년 사업 시작을 설명해요. 전자는 본문 접근 403으로 검색 노출 문장만 확인했어요. 서로 다른 기준일 가능성을 배제하지 못하므로 연도를 임의 교체하지 않아요. | low |
| 1979 | events_korea | 금성반도체 설립·대한전선 사업 인수·AT&T 합작을 한 문장에 결합 | 1979년 금성반도체 설립을 우선 유지하고 합작·인수 상대 및 날짜는 별도 원문 보강 | [LG 공식 연혁](https://www.lg.co.kr/about/history/2)으로 회사 계보를 대조했어요. 현 문장의 AT&T 합작 상대·날짜를 독립적으로 확정할 1차 자료를 확보하지 못했으므로, 잘못된 연도를 새로 제시하지 않아요. | low |
| 1965 | events_korea / confidence | 고미(코미)반도체 1965년 | 핵심 연도 유지; 영문 표기는 출처별 Komy/Kommy 차이를 주석 처리 | [국사편찬위원회 연구](https://contents.history.go.kr/mobile/km/view.do?levelId=km_004_0050_0040_0010)는 1965년 합작 조립회사를 서술해요. 표기 차이를 서로 다른 창립 연도로 읽지 않아요. | high |
| 1983/1999/2001/2012 | events_korea | 현대전자 1983 / 빅딜 1999 / 하이닉스 2001 / SK 편입 2012 | 이 네 연도는 유지; 1999년 경영권 인수와 법적 합병의 월은 구분 | [공식 출범 연혁](https://news.skhynix.co.kr/leap-forward-to-become-the-worlds-best-semiconductor-company/)과 [1999-07-09 공식 경영권 인수 보도](https://news.skhynix.com/en/hyundai-electronics-hei-takes-over-lg-semicon-management/)를 대조했어요. 7월 경영권 인수 보도가 10월 법적 합병을 부정하는 것은 아니에요. | high |
| 1992 | events_korea / headline_ko | 64M D램 개발·D램 1위 | 유지; 1993년 메모리 전체 1위와 구분 | [공식 사업장 역사](https://news.samsungsemiconductor.com/kr/반도체-역사시리즈-6탄-삼성반도체-45년-사업장의-성/)에서 1992년 D램과 1993년 메모리 전체를 나눠 설명해요. 집계 분야 차이를 연도 오류로 고치지 않아요. | high |
| 1984/1985 | yoy_pct / sales_basis | 47 / -17; 매출 26.0 / 22.7 | 1984~1985 동종 원통계 확보 전 계열 연결 보류; 1985 내부 산식은 -12.7%지만 정답으로 대체하지 않기 | [WSTS 공개 범위](https://www.wsts.org/67/Historical-Billings-Report)는 1986년부터예요. 현재 데이터에 적힌 ICE 생산 추정 증가율과 WSTS 매출을 섞으면 직접 재계산할 수 없어요. 기존 MARKET_HISTORY의 주의를 유지하고 계열·발표일을 더 선명히 해요. | medium |
| 1947~1983 | global_sales_busd / events_world | 미국 매출·세계 생산액 추정·출하량 증가가 섞인 설명 | 지역·지표가 다른 수치를 하나의 성장률로 연결하지 않기 | [CHM 기술연표](https://www.computerhistory.org/siliconengine/timeline/)는 발명·공개 시점을 확인하는 자료이며 세계 매출 통계의 대체 자료가 아니에요. [WSTS 공개 표](https://www.wsts.org/67/Historical-Billings-Report)도 이 시기를 포함하지 않으므로 결측을 추정해 채우지 않아요. | high |
| 1986 | cycle / memory / korea | 0 / -1 / -1 | 일단 유지; 한국 전체 경기와 반도체 사업 손익을 구분 | [WSTS 원본](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx)은 달러 매출이지 수익성·채용 지표가 아니에요. 원자료의 엔고·누적 손실 설명만으로 점수를 기계적으로 +2로 올릴 근거는 부족해요. 점수는 설계 판단이에요. | low |
| 1997/1998 | korea | -1 / -2 | 연간 점수는 유지 가능; 1997년 말 위기 효과는 연말 사건으로 별도 적용 권고 | [IMF 당시 소식지](https://www.imf.org/external/pubs/ft/survey/pdf/120197.pdf)는 11월 지원 요청을 기록해요. 1997년 한 해 전체를 동일 강도로 -2로 만들기보다 시점 충격을 분리하자는 게임 해석이에요. | medium |
| 2018 | cycle / memory | 1 / 2 | 유지 권고; 연말 전환은 사건 설명으로 처리 | [WSTS 원본](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx)의 N202/B202:M202로 연간 증가와 월별 변화를 나눠 볼 수 있어요. 13.7% 성장만으로 연말 재고 조정까지 무시해 +2로 맞출 이유는 없어요. | medium |
| 2024 | memory | 1 | 글로벌 메모리 가중 모델이면 +2도 검토; 범용·HBM 분화 모델이면 +1 유지 | [WSTS Spring 표](https://www.wsts.org/esraCMS/extension/media/f/WST/7618/WSTS_FC-Release-2026-May.pdf)는 Memory를 큰 단일 부문으로 집계해요. HBM과 범용 메모리를 분리하지 않는 현 규격에서 회사별 체감을 같은 값으로 표현할 수 없어요. 실측 정답이 아닌 모델 대안이에요. | low |
| 1955 | events_world | 포토리소그래피 이정표 없음 | 실리콘 소자 제조에 포토리소그래피 적용을 추가 검토 | [CHM 기술연표](https://www.computerhistory.org/siliconengine/timeline/)의 1955 photolithography 항목. 연구·장비·공정기술 직무와 연결하기 좋아요. | high |
| 1968 | events_world | DRAM 셀 원리 특허 이정표 없음 | Dennard 단일 트랜지스터 DRAM 특허 등록을 상용 제품 출시와 분리해 추가 | [IBM DRAM 역사](https://www.ibm.com/history/dram)는 1968년 특허를 명시해요. 1970년 첫 상용 DRAM 서술을 소자 원리의 첫 발명으로 읽지 않도록 해요. | high |
| 1984 | events_world | 플래시 메모리 발표 이정표 없음 | 플래시 메모리의 초기 발표·개발 이정표 추가 | [원 제조사 계보의 공식 자료](https://europe.kioxia.com/content/dam/kioxia/shared/personal/support/legacy-products/asset/datasheet/USB-Flyer-THNUxxENS-June2014.pdf)는 1984년 개발을 기록해요. NAND 양산 연도와는 구분해요. | high |
| 2013 | events_world / events_korea | 초기 HBM 출시 빠짐 | 초기 HBM 출시를 추가해 2024~2026 HBM 수요와 연결 | [공식 설계 책임자 인터뷰](https://news.skhynix.com/en/hbm-design-head-myeong-jae-park/)는 2013년 12월 첫 HBM 출시를 설명해요. AI 열풍이 기술 자체의 발명 시점은 아니에요. | high |
| 2019 | events_world | EUV 양산 이정표 없음 | N7+의 EUV 대량생산 이정표를 추가 검토 | [TSMC 공식 2019 사업 보고](https://csr.tsmc.com/download/csr/2019-csr-report/english/pdf/e-4-issue-1.pdf)는 N7+의 2019년 volume production을 서술해요. 고객별 개발·첫 장비 출하와 구분해요. | high |

## WSTS 연간 전수 대조

원본 `Monthly Data`의 단위는 **천 달러**예요. `Total Year`(N열)을 1,000,000으로 나눠 게임의 10억 달러 단위로 바꿨어요. 월별 실제값 12개를 합친 값과 N열을 대조했고, 월별 천 달러 반올림으로 0~수천 달러 차이가 날 수 있어 N열의 공표 합계를 기준으로 했어요. `3MMA`의 이동평균을 합산하지 않았어요. 성장률은 `100 × (올해 N열 / 전년 N열 − 1)`의 재계산값으로, 개별 발표문에 적힌 당시 성장률과는 구분해요. 아래 제안은 현행 개정판으로 통일할 때의 값이며 사소한 반올림 차이를 모두 오류라고 부르지 않아요.

| 연도 | 필드 | 지금 값 | 제안 값 | 근거·출처 | 확신 |
|---|---|---|---|---|---|
| 1984 | global_sales_busd / yoy_pct | 26.0 / 47.0 | 현행 원표 범위 밖; 기존 추정·집계 자료 추가 대조 필요 | [공개 범위](https://www.wsts.org/67/Historical-Billings-Report) | low |
| 1985 | global_sales_busd / yoy_pct | 22.7 / -17.0 | 현행 원표 범위 밖; 기존 추정·집계 자료 추가 대조 필요 | [공개 범위](https://www.wsts.org/67/Historical-Billings-Report) | low |
| 1986 | global_sales_busd / yoy_pct | None / 26.1 | 26.355359 / 전년 동일 계열 미확보 | [WSTS](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) Monthly Data!N10 | high |
| 1987 | global_sales_busd / yoy_pct | 34.0 / None | 32.530452 / 23.430% | [WSTS](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) Monthly Data!N16 | high |
| 1988 | global_sales_busd / yoy_pct | 45.0 / 38.2 | 45.004809 / 38.347% | [WSTS](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) Monthly Data!N22 | high |
| 1989 | global_sales_busd / yoy_pct | 48.8 / 10.0 | 48.762926 / 8.350% | [WSTS](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) Monthly Data!N28 | high |
| 1990 | global_sales_busd / yoy_pct | 50.5 / 3.5 | 50.518932 / 3.601% | [WSTS](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) Monthly Data!N34 | high |
| 1991 | global_sales_busd / yoy_pct | 54.6 / 8.1 | 54.607454 / 8.093% | [WSTS](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) Monthly Data!N40 | high |
| 1992 | global_sales_busd / yoy_pct | None / None | 59.864958 / 9.628% | [WSTS](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) Monthly Data!N46 | high |
| 1993 | global_sales_busd / yoy_pct | 77.3 / None | 77.309681 / 29.140% | [WSTS](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) Monthly Data!N52 | high |
| 1994 | global_sales_busd / yoy_pct | 101.8 / 31.8 | 101.878593 / 31.780% | [WSTS](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) Monthly Data!N58 | high |
| 1995 | global_sales_busd / yoy_pct | 144.4 / 41.8 | 144.403681 / 41.741% | [WSTS](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) Monthly Data!N64 | high |
| 1996 | global_sales_busd / yoy_pct | 132.0 / -8.6 | 131.966432 / -8.613% | [WSTS](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) Monthly Data!N70 | high |
| 1997 | global_sales_busd / yoy_pct | 137.2 / 4.0 | 137.203120 / 3.968% | [WSTS](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) Monthly Data!N76 | high |
| 1998 | global_sales_busd / yoy_pct | 125.6 / -8.4 | 125.611999 / -8.448% | [WSTS](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) Monthly Data!N82 | high |
| 1999 | global_sales_busd / yoy_pct | 149.4 / 18.9 | 149.378551 / 18.921% | [WSTS](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) Monthly Data!N88 | high |
| 2000 | global_sales_busd / yoy_pct | 204.4 / 36.8 | 204.393623 / 36.829% | [WSTS](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) Monthly Data!N94 | high |
| 2001 | global_sales_busd / yoy_pct | 139.0 / -32.0 | 138.962610 / -32.012% | [WSTS](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) Monthly Data!N100 | high |
| 2002 | global_sales_busd / yoy_pct | 140.7 / 1.3 | 140.713320 / 1.260% | [WSTS](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) Monthly Data!N106 | high |
| 2003 | global_sales_busd / yoy_pct | 166.4 / 18.3 | 166.425522 / 18.273% | [WSTS](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) Monthly Data!N112 | high |
| 2004 | global_sales_busd / yoy_pct | 213.0 / 28.0 | 213.026836 / 28.001% | [WSTS](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) Monthly Data!N118 | high |
| 2005 | global_sales_busd / yoy_pct | 227.5 / 6.8 | 227.484137 / 6.787% | [WSTS](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) Monthly Data!N124 | high |
| 2006 | global_sales_busd / yoy_pct | 247.7 / 8.9 | 247.716193 / 8.894% | [WSTS](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) Monthly Data!N130 | high |
| 2007 | global_sales_busd / yoy_pct | 255.6 / 3.2 | 255.645338 / 3.201% | [WSTS](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) Monthly Data!N136 | high |
| 2008 | global_sales_busd / yoy_pct | 248.6 / -2.8 | 248.602812 / -2.755% | [WSTS](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) Monthly Data!N142 | high |
| 2009 | global_sales_busd / yoy_pct | 226.3 / -9.0 | 226.313366 / -8.966% | [WSTS](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) Monthly Data!N148 | high |
| 2010 | global_sales_busd / yoy_pct | 298.3 / 31.8 | 298.315115 / 31.815% | [WSTS](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) Monthly Data!N154 | high |
| 2011 | global_sales_busd / yoy_pct | 299.5 / 0.4 | 299.521338 / 0.404% | [WSTS](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) Monthly Data!N160 | high |
| 2012 | global_sales_busd / yoy_pct | 291.6 / -2.7 | 291.562116 / -2.657% | [WSTS](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) Monthly Data!N166 | high |
| 2013 | global_sales_busd / yoy_pct | 305.6 / 4.8 | 305.583864 / 4.809% | [WSTS](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) Monthly Data!N172 | high |
| 2014 | global_sales_busd / yoy_pct | 335.8 / 9.9 | 335.842917 / 9.902% | [WSTS](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) Monthly Data!N178 | high |
| 2015 | global_sales_busd / yoy_pct | 335.2 / -0.2 | 335.167861 / -0.201% | [WSTS](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) Monthly Data!N184 | high |
| 2016 | global_sales_busd / yoy_pct | 338.9 / 1.1 | 338.930855 / 1.123% | [WSTS](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) Monthly Data!N190 | high |
| 2017 | global_sales_busd / yoy_pct | 412.2 / 21.6 | 412.220944 / 21.624% | [WSTS](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) Monthly Data!N196 | high |
| 2018 | global_sales_busd / yoy_pct | 468.8 / 13.7 | 468.778285 / 13.720% | [WSTS](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) Monthly Data!N202 | high |
| 2019 | global_sales_busd / yoy_pct | 412.1 / -12.1 | 412.306976 / -12.046% | [WSTS](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) Monthly Data!N208 | high |
| 2020 | global_sales_busd / yoy_pct | 440.4 / 6.8 | 440.389358 / 6.811% | [WSTS](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) Monthly Data!N214 | high |
| 2021 | global_sales_busd / yoy_pct | 555.9 / 26.2 | 555.892514 / 26.228% | [WSTS](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) Monthly Data!N220 | high |
| 2022 | global_sales_busd / yoy_pct | 574.1 / 3.3 | 574.084194 / 3.273% | [WSTS](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) Monthly Data!N226 | high |
| 2023 | global_sales_busd / yoy_pct | 526.8 / -8.2 | 526.885425 / -8.222% | [WSTS](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) Monthly Data!N232 | high |
| 2024 | global_sales_busd / yoy_pct | 630.5 / 19.7 | 630.548606 / 19.675% | [WSTS](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) Monthly Data!N238 | high |
| 2025 | global_sales_busd / yoy_pct | 791.7 / 25.6 | 795.640305 / 26.182% | [WSTS](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) Monthly Data!N244 | high |
| 2026 | global_sales_busd / yoy_pct | 1655.0 / 108.1 | 1~8월 누계 1043.024817; 연간 실제값 아님 / 연간 전망은 별도 | [WSTS](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) Monthly Data!N250 | high |

## 80개 연도 검토 범위

아래 표의 원문 건수는 `events_world`·`events_korea`·`headline_ko`를 빠뜨리지 않고 읽었는지 확인하는 범위 표시예요. 근거가 불충분한 세부 수치나 서술은 기존 출처만으로 정답 처리하지 않았어요. `low`는 오류 발견이나 사실 확인 완료라는 뜻이 아니에요.

| 연도 | 필드 | 지금 값 | 제안 값 | 근거·출처 | 확신 |
|---|---|---|---|---|---|
| 1947 | events_world / events_korea / headline_ko | 원문 4건 | 전 사건·헤드라인 읽기 완료; 독립 검증 범위와 보류는 위 개별표 참고 | [기술연표](https://www.computerhistory.org/siliconengine/timeline/) | low |
| 1948 | events_world / events_korea / headline_ko | 원문 4건 | 전 사건·헤드라인 읽기 완료; 독립 검증 범위와 보류는 위 개별표 참고 | [기술연표](https://www.computerhistory.org/siliconengine/timeline/) | low |
| 1949 | events_world / events_korea / headline_ko | 원문 3건 | 전 사건·헤드라인 읽기 완료; 독립 검증 범위와 보류는 위 개별표 참고; 지정된 low 연도 우선 검토 | [기술연표](https://www.computerhistory.org/siliconengine/timeline/) | low |
| 1950 | events_world / events_korea / headline_ko | 원문 4건 | 전 사건·헤드라인 읽기 완료; 독립 검증 범위와 보류는 위 개별표 참고; 지정된 low 연도 우선 검토 | [기술연표](https://www.computerhistory.org/siliconengine/timeline/) | low |
| 1951 | events_world / events_korea / headline_ko | 원문 4건 | 전 사건·헤드라인 읽기 완료; 독립 검증 범위와 보류는 위 개별표 참고 | [기술연표](https://www.computerhistory.org/siliconengine/timeline/) | low |
| 1952 | events_world / events_korea / headline_ko | 원문 3건 | 전 사건·헤드라인 읽기 완료; 독립 검증 범위와 보류는 위 개별표 참고 | [기술연표](https://www.computerhistory.org/siliconengine/timeline/) | low |
| 1953 | events_world / events_korea / headline_ko | 원문 4건 | 전 사건·헤드라인 읽기 완료; 독립 검증 범위와 보류는 위 개별표 참고; 지정된 low 연도 우선 검토 | [기술연표](https://www.computerhistory.org/siliconengine/timeline/) | low |
| 1954 | events_world / events_korea / headline_ko | 원문 3건 | 전 사건·헤드라인 읽기 완료; 독립 검증 범위와 보류는 위 개별표 참고 | [기술연표](https://www.computerhistory.org/siliconengine/timeline/) | low |
| 1955 | events_world / events_korea / headline_ko | 원문 3건 | 전 사건·헤드라인 읽기 완료; 독립 검증 범위와 보류는 위 개별표 참고; 지정된 low 연도 우선 검토 | [기술연표](https://www.computerhistory.org/siliconengine/timeline/) | low |
| 1956 | events_world / events_korea / headline_ko | 원문 4건 | 전 사건·헤드라인 읽기 완료; 독립 검증 범위와 보류는 위 개별표 참고 | [기술연표](https://www.computerhistory.org/siliconengine/timeline/) | low |
| 1957 | events_world / events_korea / headline_ko | 원문 4건 | 전 사건·헤드라인 읽기 완료; 독립 검증 범위와 보류는 위 개별표 참고 | [기술연표](https://www.computerhistory.org/siliconengine/timeline/) | low |
| 1958 | events_world / events_korea / headline_ko | 원문 5건 | 전 사건·헤드라인 읽기 완료; 독립 검증 범위와 보류는 위 개별표 참고 | [기술연표](https://www.computerhistory.org/siliconengine/timeline/) | low |
| 1959 | events_world / events_korea / headline_ko | 원문 6건 | 전 사건·헤드라인 읽기 완료; 독립 검증 범위와 보류는 위 개별표 참고 | [기술연표](https://www.computerhistory.org/siliconengine/timeline/) | low |
| 1960 | events_world / events_korea / headline_ko | 원문 4건 | 전 사건·헤드라인 읽기 완료; 독립 검증 범위와 보류는 위 개별표 참고 | [기술연표](https://www.computerhistory.org/siliconengine/timeline/) | low |
| 1961 | events_world / events_korea / headline_ko | 원문 6건 | 전 사건·헤드라인 읽기 완료; 독립 검증 범위와 보류는 위 개별표 참고 | [기술연표](https://www.computerhistory.org/siliconengine/timeline/) | low |
| 1962 | events_world / events_korea / headline_ko | 원문 6건 | 전 사건·헤드라인 읽기 완료; 독립 검증 범위와 보류는 위 개별표 참고 | [기술연표](https://www.computerhistory.org/siliconengine/timeline/) | low |
| 1963 | events_world / events_korea / headline_ko | 원문 4건 | 전 사건·헤드라인 읽기 완료; 독립 검증 범위와 보류는 위 개별표 참고; 지정된 low 연도 우선 검토 | [기술연표](https://www.computerhistory.org/siliconengine/timeline/) | low |
| 1964 | events_world / events_korea / headline_ko | 원문 5건 | 전 사건·헤드라인 읽기 완료; 독립 검증 범위와 보류는 위 개별표 참고 | [기술연표](https://www.computerhistory.org/siliconengine/timeline/) | low |
| 1965 | events_world / events_korea / headline_ko | 원문 6건 | 전 사건·헤드라인 읽기 완료; 독립 검증 범위와 보류는 위 개별표 참고 | [기술연표](https://www.computerhistory.org/siliconengine/timeline/) | low |
| 1966 | events_world / events_korea / headline_ko | 원문 7건 | 전 사건·헤드라인 읽기 완료; 독립 검증 범위와 보류는 위 개별표 참고 | [기술연표](https://www.computerhistory.org/siliconengine/timeline/) | low |
| 1967 | events_world / events_korea / headline_ko | 원문 5건 | 전 사건·헤드라인 읽기 완료; 독립 검증 범위와 보류는 위 개별표 참고; 지정된 low 연도 우선 검토 | [기술연표](https://www.computerhistory.org/siliconengine/timeline/) | low |
| 1968 | events_world / events_korea / headline_ko | 원문 4건 | 전 사건·헤드라인 읽기 완료; 독립 검증 범위와 보류는 위 개별표 참고 | [기술연표](https://www.computerhistory.org/siliconengine/timeline/) | low |
| 1969 | events_world / events_korea / headline_ko | 원문 10건 | 전 사건·헤드라인 읽기 완료; 독립 검증 범위와 보류는 위 개별표 참고 | [기술연표](https://www.computerhistory.org/siliconengine/timeline/) | low |
| 1970 | events_world / events_korea / headline_ko | 원문 8건 | 전 사건·헤드라인 읽기 완료; 독립 검증 범위와 보류는 위 개별표 참고 | [기술연표](https://www.computerhistory.org/siliconengine/timeline/) | low |
| 1971 | events_world / events_korea / headline_ko | 원문 7건 | 전 사건·헤드라인 읽기 완료; 독립 검증 범위와 보류는 위 개별표 참고 | [기술연표](https://www.computerhistory.org/siliconengine/timeline/) | low |
| 1972 | events_world / events_korea / headline_ko | 원문 6건 | 전 사건·헤드라인 읽기 완료; 독립 검증 범위와 보류는 위 개별표 참고; 지정된 low 연도 우선 검토 | [기술연표](https://www.computerhistory.org/siliconengine/timeline/) | low |
| 1973 | events_world / events_korea / headline_ko | 원문 7건 | 전 사건·헤드라인 읽기 완료; 독립 검증 범위와 보류는 위 개별표 참고 | [기술연표](https://www.computerhistory.org/siliconengine/timeline/) | low |
| 1974 | events_world / events_korea / headline_ko | 원문 8건 | 전 사건·헤드라인 읽기 완료; 독립 검증 범위와 보류는 위 개별표 참고 | [기술연표](https://www.computerhistory.org/siliconengine/timeline/) | low |
| 1975 | events_world / events_korea / headline_ko | 원문 7건 | 전 사건·헤드라인 읽기 완료; 독립 검증 범위와 보류는 위 개별표 참고 | [기술연표](https://www.computerhistory.org/siliconengine/timeline/) | low |
| 1976 | events_world / events_korea / headline_ko | 원문 6건 | 전 사건·헤드라인 읽기 완료; 독립 검증 범위와 보류는 위 개별표 참고 | [기술연표](https://www.computerhistory.org/siliconengine/timeline/) | low |
| 1977 | events_world / events_korea / headline_ko | 원문 6건 | 전 사건·헤드라인 읽기 완료; 독립 검증 범위와 보류는 위 개별표 참고 | [기술연표](https://www.computerhistory.org/siliconengine/timeline/) | low |
| 1978 | events_world / events_korea / headline_ko | 원문 5건 | 전 사건·헤드라인 읽기 완료; 독립 검증 범위와 보류는 위 개별표 참고 | [기술연표](https://www.computerhistory.org/siliconengine/timeline/) | low |
| 1979 | events_world / events_korea / headline_ko | 원문 6건 | 전 사건·헤드라인 읽기 완료; 독립 검증 범위와 보류는 위 개별표 참고 | [기술연표](https://www.computerhistory.org/siliconengine/timeline/) | low |
| 1980 | events_world / events_korea / headline_ko | 원문 6건 | 전 사건·헤드라인 읽기 완료; 독립 검증 범위와 보류는 위 개별표 참고 | [기술연표](https://www.computerhistory.org/siliconengine/timeline/) | low |
| 1981 | events_world / events_korea / headline_ko | 원문 5건 | 전 사건·헤드라인 읽기 완료; 독립 검증 범위와 보류는 위 개별표 참고 | [기술연표](https://www.computerhistory.org/siliconengine/timeline/) | low |
| 1982 | events_world / events_korea / headline_ko | 원문 4건 | 전 사건·헤드라인 읽기 완료; 독립 검증 범위와 보류는 위 개별표 참고; 지정된 low 연도 우선 검토 | [기술연표](https://www.computerhistory.org/siliconengine/timeline/) | low |
| 1983 | events_world / events_korea / headline_ko | 원문 7건 | 전 사건·헤드라인 읽기 완료; 독립 검증 범위와 보류는 위 개별표 참고 | [기술연표](https://www.computerhistory.org/siliconengine/timeline/) | low |
| 1984 | events_world / events_korea / headline_ko | 원문 9건 | 전 사건·헤드라인 읽기 완료; 독립 검증 범위와 보류는 위 개별표 참고 | [검토 대상](../../data/market_history.json) / [WSTS 범위](https://www.wsts.org/67/Historical-Billings-Report) | low |
| 1985 | events_world / events_korea / headline_ko | 원문 8건 | 전 사건·헤드라인 읽기 완료; 독립 검증 범위와 보류는 위 개별표 참고 | [검토 대상](../../data/market_history.json) / [WSTS 범위](https://www.wsts.org/67/Historical-Billings-Report) | low |
| 1986 | events_world / events_korea / headline_ko | 원문 9건 | 전 사건·헤드라인 읽기 완료; 수치는 위 WSTS 전수표 참고. 미대조 세부 사건은 보류 | [WSTS 연간표](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) | low |
| 1987 | events_world / events_korea / headline_ko | 원문 8건 | 전 사건·헤드라인 읽기 완료; 수치는 위 WSTS 전수표 참고. 미대조 세부 사건은 보류; 지정된 low 연도 우선 검토 | [WSTS 연간표](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) | low |
| 1988 | events_world / events_korea / headline_ko | 원문 7건 | 전 사건·헤드라인 읽기 완료; 수치는 위 WSTS 전수표 참고. 미대조 세부 사건은 보류 | [WSTS 연간표](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) | low |
| 1989 | events_world / events_korea / headline_ko | 원문 7건 | 전 사건·헤드라인 읽기 완료; 수치는 위 WSTS 전수표 참고. 미대조 세부 사건은 보류 | [WSTS 연간표](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) | low |
| 1990 | events_world / events_korea / headline_ko | 원문 6건 | 전 사건·헤드라인 읽기 완료; 수치는 위 WSTS 전수표 참고. 미대조 세부 사건은 보류 | [WSTS 연간표](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) | low |
| 1991 | events_world / events_korea / headline_ko | 원문 6건 | 전 사건·헤드라인 읽기 완료; 수치는 위 WSTS 전수표 참고. 미대조 세부 사건은 보류 | [WSTS 연간표](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) | low |
| 1992 | events_world / events_korea / headline_ko | 원문 7건 | 전 사건·헤드라인 읽기 완료; 수치는 위 WSTS 전수표 참고. 미대조 세부 사건은 보류; 지정된 low 연도 우선 검토 | [WSTS 연간표](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) | low |
| 1993 | events_world / events_korea / headline_ko | 원문 9건 | 전 사건·헤드라인 읽기 완료; 수치는 위 WSTS 전수표 참고. 미대조 세부 사건은 보류 | [WSTS 연간표](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) | low |
| 1994 | events_world / events_korea / headline_ko | 원문 8건 | 전 사건·헤드라인 읽기 완료; 수치는 위 WSTS 전수표 참고. 미대조 세부 사건은 보류 | [WSTS 연간표](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) | low |
| 1995 | events_world / events_korea / headline_ko | 원문 9건 | 전 사건·헤드라인 읽기 완료; 수치는 위 WSTS 전수표 참고. 미대조 세부 사건은 보류 | [WSTS 연간표](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) | low |
| 1996 | events_world / events_korea / headline_ko | 원문 7건 | 전 사건·헤드라인 읽기 완료; 수치는 위 WSTS 전수표 참고. 미대조 세부 사건은 보류 | [WSTS 연간표](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) | low |
| 1997 | events_world / events_korea / headline_ko | 원문 7건 | 전 사건·헤드라인 읽기 완료; 수치는 위 WSTS 전수표 참고. 미대조 세부 사건은 보류 | [WSTS 연간표](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) | low |
| 1998 | events_world / events_korea / headline_ko | 원문 8건 | 전 사건·헤드라인 읽기 완료; 수치는 위 WSTS 전수표 참고. 미대조 세부 사건은 보류 | [WSTS 연간표](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) | low |
| 1999 | events_world / events_korea / headline_ko | 원문 7건 | 전 사건·헤드라인 읽기 완료; 수치는 위 WSTS 전수표 참고. 미대조 세부 사건은 보류 | [WSTS 연간표](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) | low |
| 2000 | events_world / events_korea / headline_ko | 원문 7건 | 전 사건·헤드라인 읽기 완료; 수치는 위 WSTS 전수표 참고. 미대조 세부 사건은 보류 | [WSTS 연간표](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) | low |
| 2001 | events_world / events_korea / headline_ko | 원문 9건 | 전 사건·헤드라인 읽기 완료; 수치는 위 WSTS 전수표 참고. 미대조 세부 사건은 보류 | [WSTS 연간표](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) | low |
| 2002 | events_world / events_korea / headline_ko | 원문 7건 | 전 사건·헤드라인 읽기 완료; 수치는 위 WSTS 전수표 참고. 미대조 세부 사건은 보류 | [WSTS 연간표](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) | low |
| 2003 | events_world / events_korea / headline_ko | 원문 7건 | 전 사건·헤드라인 읽기 완료; 수치는 위 WSTS 전수표 참고. 미대조 세부 사건은 보류 | [WSTS 연간표](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) | low |
| 2004 | events_world / events_korea / headline_ko | 원문 7건 | 전 사건·헤드라인 읽기 완료; 수치는 위 WSTS 전수표 참고. 미대조 세부 사건은 보류 | [WSTS 연간표](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) | low |
| 2005 | events_world / events_korea / headline_ko | 원문 6건 | 전 사건·헤드라인 읽기 완료; 수치는 위 WSTS 전수표 참고. 미대조 세부 사건은 보류 | [WSTS 연간표](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) | low |
| 2006 | events_world / events_korea / headline_ko | 원문 7건 | 전 사건·헤드라인 읽기 완료; 수치는 위 WSTS 전수표 참고. 미대조 세부 사건은 보류 | [WSTS 연간표](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) | low |
| 2007 | events_world / events_korea / headline_ko | 원문 8건 | 전 사건·헤드라인 읽기 완료; 수치는 위 WSTS 전수표 참고. 미대조 세부 사건은 보류 | [WSTS 연간표](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) | low |
| 2008 | events_world / events_korea / headline_ko | 원문 8건 | 전 사건·헤드라인 읽기 완료; 수치는 위 WSTS 전수표 참고. 미대조 세부 사건은 보류 | [WSTS 연간표](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) | low |
| 2009 | events_world / events_korea / headline_ko | 원문 9건 | 전 사건·헤드라인 읽기 완료; 수치는 위 WSTS 전수표 참고. 미대조 세부 사건은 보류 | [WSTS 연간표](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) | low |
| 2010 | events_world / events_korea / headline_ko | 원문 8건 | 전 사건·헤드라인 읽기 완료; 수치는 위 WSTS 전수표 참고. 미대조 세부 사건은 보류 | [WSTS 연간표](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) | low |
| 2011 | events_world / events_korea / headline_ko | 원문 8건 | 전 사건·헤드라인 읽기 완료; 수치는 위 WSTS 전수표 참고. 미대조 세부 사건은 보류 | [WSTS 연간표](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) | low |
| 2012 | events_world / events_korea / headline_ko | 원문 9건 | 전 사건·헤드라인 읽기 완료; 수치는 위 WSTS 전수표 참고. 미대조 세부 사건은 보류 | [WSTS 연간표](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) | low |
| 2013 | events_world / events_korea / headline_ko | 원문 8건 | 전 사건·헤드라인 읽기 완료; 수치는 위 WSTS 전수표 참고. 미대조 세부 사건은 보류 | [WSTS 연간표](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) | low |
| 2014 | events_world / events_korea / headline_ko | 원문 7건 | 전 사건·헤드라인 읽기 완료; 수치는 위 WSTS 전수표 참고. 미대조 세부 사건은 보류 | [WSTS 연간표](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) | low |
| 2015 | events_world / events_korea / headline_ko | 원문 9건 | 전 사건·헤드라인 읽기 완료; 수치는 위 WSTS 전수표 참고. 미대조 세부 사건은 보류 | [WSTS 연간표](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) | low |
| 2016 | events_world / events_korea / headline_ko | 원문 8건 | 전 사건·헤드라인 읽기 완료; 수치는 위 WSTS 전수표 참고. 미대조 세부 사건은 보류 | [WSTS 연간표](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) | low |
| 2017 | events_world / events_korea / headline_ko | 원문 9건 | 전 사건·헤드라인 읽기 완료; 수치는 위 WSTS 전수표 참고. 미대조 세부 사건은 보류 | [WSTS 연간표](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) | low |
| 2018 | events_world / events_korea / headline_ko | 원문 9건 | 전 사건·헤드라인 읽기 완료; 수치는 위 WSTS 전수표 참고. 미대조 세부 사건은 보류 | [WSTS 연간표](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) | low |
| 2019 | events_world / events_korea / headline_ko | 원문 11건 | 전 사건·헤드라인 읽기 완료; 수치는 위 WSTS 전수표 참고. 미대조 세부 사건은 보류 | [WSTS 연간표](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) | low |
| 2020 | events_world / events_korea / headline_ko | 원문 9건 | 전 사건·헤드라인 읽기 완료; 수치는 위 WSTS 전수표 참고. 미대조 세부 사건은 보류 | [WSTS 연간표](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) | low |
| 2021 | events_world / events_korea / headline_ko | 원문 9건 | 전 사건·헤드라인 읽기 완료; 수치는 위 WSTS 전수표 참고. 미대조 세부 사건은 보류 | [WSTS 연간표](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) | low |
| 2022 | events_world / events_korea / headline_ko | 원문 10건 | 전 사건·헤드라인 읽기 완료; 수치는 위 WSTS 전수표 참고. 미대조 세부 사건은 보류 | [WSTS 연간표](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) | low |
| 2023 | events_world / events_korea / headline_ko | 원문 11건 | 전 사건·헤드라인 읽기 완료; 수치는 위 WSTS 전수표 참고. 미대조 세부 사건은 보류 | [WSTS 연간표](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) | low |
| 2024 | events_world / events_korea / headline_ko | 원문 12건 | 전 사건·헤드라인 읽기 완료; 수치는 위 WSTS 전수표 참고. 미대조 세부 사건은 보류 | [WSTS 연간표](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) | low |
| 2025 | events_world / events_korea / headline_ko | 원문 14건 | 전 사건·헤드라인 읽기 완료; 수치는 위 WSTS 전수표 참고. 미대조 세부 사건은 보류 | [WSTS 연간표](https://www.wsts.org/esraCMS/extension/media/f/WST/7803/WSTS-Historical-Billings-Report-Aug_2026.xlsx) | low |
| 2026 | events_world / events_korea / headline_ko | 원문 13건 | 전 사건·헤드라인 읽기 완료; 독립 검증 범위와 보류는 위 개별표 참고 | [검토 대상](../../data/market_history.json) / [WSTS 범위](https://www.wsts.org/67/Historical-Billings-Report) | low |

남은 한계: 초기 미국·세계 시장 수치의 원본 연간표, 금성반도체 합작 상대와 시점, 한국반도체 원등기, 세부 제품 가격·개별 공장 실적은 추가 원자료가 필요해요. 이미 인용된 수치를 재인용한 검색 결과만으로 독립 검증됐다고 표시하지 않았어요. WSTS 개정값의 반영과 점수 설계·추가 사건 채택은 Claude가 결정해요.

검증: `node life/tools/validate.mjs`는 기존 Windows·한글 file-URL 경로 문제를 저장소 밖 임시 preload로만 보정해 실행해요. 검사기·원본 데이터에는 쓰지 않았어요. Git 변경 범위는 이 검토 문서와 공통 규칙의 CHANGELOG 한 줄이에요.
