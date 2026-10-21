// 버스 잼 프로토타입 빌드: node tools/bus-jam/build.mjs
// core.js + levels.json + game.js 를 app.src.html 한 파일로 합칩니다.
//  - prototypes/bus-jam/index.html      : GitHub Pages용 완전한 HTML
//  - prototypes/bus-jam/dist/artifact.html : claude.ai 아티팩트용 (doctype/head/body 없는 조각)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const dir = new URL('../../prototypes/bus-jam/', import.meta.url);
const read = f => readFileSync(new URL(f, dir), 'utf8');
const core = read('core.js').replace(/^export /gm, '');
const levels = JSON.parse(read('levels.json')).map(({ solution, ...l }) => l);
const game = read('game.js');
const frag = read('app.src.html')
  .replace('/*CORE*/', () => core)
  .replace('/*LEVELS*/', () => JSON.stringify(levels))
  .replace('/*GAME*/', () => game);
mkdirSync(new URL('dist/', dir), { recursive: true });
writeFileSync(new URL('dist/artifact.html', dir), frag);
const cut = frag.indexOf('</style>') + '</style>'.length;
const full = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${frag.slice(0, cut)}
</head>
<body>
${frag.slice(cut)}
</body>
</html>
`;
writeFileSync(new URL('index.html', dir), full);
console.log('빌드 완료', (full.length / 1024).toFixed(1) + 'KB');
