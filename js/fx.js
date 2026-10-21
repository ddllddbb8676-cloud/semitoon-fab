// 시각 효과 (담당: GPT)
// 게임 로직은 건드리지 않고, 엔진이 보내는 fab:* 이벤트를 듣고 연출만 합니다.
// 이벤트 목록과 detail 내용은 docs/UI_CONTRACT.md 참고.

document.addEventListener('fab:golden', () => {
  document.body.classList.add('fx-golden');
  setTimeout(() => document.body.classList.remove('fx-golden'), 800);
});

document.addEventListener('fab:scrap', () => {
  document.body.classList.add('fx-scrap');
  setTimeout(() => document.body.classList.remove('fx-scrap'), 500);
});
