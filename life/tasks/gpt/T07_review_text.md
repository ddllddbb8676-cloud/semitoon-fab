# T07 되돌아보기·묘비명·인생 요약 문구

## 목적
인생이 끝나면 "되돌아보기" 화면에서 그 사람의 일생을 몇 문장으로 보여 주고, 인스타에 공유할 카드가 나옵니다. 매번 같은 문장이면 재미가 없으니 조합할 문구 조각이 많이 필요합니다.

## 읽을 파일
`life/tasks/gpt/README.md`, `life/docs/SPEC.md`(상태 필드, 성향 축 7개와 특징 이름), `life/docs/GAME_DESIGN.md`(되돌아보기), `life/data/jobs.json`.

## 할 일
1. **한 줄 인생 요약 템플릿 60개**: 자리표시로 조합. 예: `"{birth_year}년 {region}에서 태어나 {main_job}(으)로 {career_years}년을 보낸 {trait_top}의 삶"`. 자리표시는 아래 목록만 사용.
2. **특징별 문장**: 성향 축 7개 × 양쪽 특징(14개)마다 3문장씩.
3. **반도체 순간 카드 문구 40개**: 접점 종류(어린 시절 공장 불빛, 첫 출근, 첫 성과급, 구조조정, 이직, 경비원, 자녀가 엔지니어 등)별 카드 제목과 한 줄.
4. **묘비명 80개**: 직업 그룹(현장·사무·기능직·서비스·생태계)과 특징 조합으로 웃프게. 품위는 지키기.
5. **사망 원인 문구 20개**: 노환, 질병, 사고 등. 담담하고 존중하게.

자리표시: `{name}`, `{birth_year}`, `{death_year}`, `{age}`, `{region}`, `{main_job}`, `{main_company}`, `{career_years}`, `{trait_top}`, `{trait_second}`, `{children}`, `{semi_count}`, `{best_year}`, `{worst_year}`, `{title}`

## 형식
```json
{ "_note": "...", "summary_templates": ["..."], "trait_lines": { "diligence+": ["..."], "diligence-": ["..."] }, "semi_cards": [ { "kind": "first_cleanroom", "title": "...", "line": "..." } ], "epitaphs": [ { "group": "현장", "trait": "work_life+", "text": "..." } ], "death_causes": [ { "kind": "old_age", "text": "..." } ] }
```

## 저장 위치
`life/data/review_text.json`

## 검사
`node life/tools/validate.mjs` 오류 0개 (자리표시가 목록 밖이면 오류).
