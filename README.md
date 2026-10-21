# 세미툰 FAB

웨이퍼가 끝없이 흘러가는 귀여운 반도체 팹 키우기 게임. [@semi.toon](https://www.instagram.com/semi.toon/)

**플레이:** https://ddllddbb8676-cloud.github.io/semitoon-fab/

**새 퍼즐 플레이 테스트:** [칩나라 FOUP 잼 — 휴대폰용](https://chipnara-foup-jam.ddllddbb8676.chatgpt.site) · [규칙과 실행 방법](prototypes/foup-jam/README.md). 오너 전용 테스트이며 같은 ChatGPT 계정으로 로그인해 열 수 있습니다.

## 어떻게 노나요
1. **웨이퍼 투입**을 톡톡 눌러 첫 돈을 벌어요
2. 다음 공정을 **오픈**하면 Lot 가치가 올라가요
3. 주황 테두리 **병목** 공정을 증설하면 라인 전체가 빨라져요
4. 장비가 다운되면 빨리 **살리기**! 골든 Lot이 뜨면 대박
5. 8공정을 다 모으면 **다음 노드**로 전환. 처음부터지만 칩값이 훨씬 비싸요

## 만드는 사람
- 기획·오너: 이유정 (세미툰)
- 게임 로직: Claude
- 디자인: GPT

협업 규칙은 [AGENTS.md](AGENTS.md), 화면 약속은 [docs/UI_CONTRACT.md](docs/UI_CONTRACT.md), 기획은 [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md).

## 로컬 실행
```
python3 -m http.server 8000
```
http://localhost:8000
