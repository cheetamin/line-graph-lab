// 브라우저 안에서만 동작하는 판 만들기
//  npm run build:demo  → dist-demo/  (Claude 아티팩트용: 글꼴은 Google Fonts)
//  npm run build:pages → dist-pages/ (GitHub Pages용: 글꼴 파일 포함, 학교망에서도 글꼴 유지)
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PAGES = process.argv.includes('--pages');
const out = path.join(root, PAGES ? 'dist-pages' : 'dist-demo');
fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(path.join(root, 'public'), out, { recursive: true });
fs.mkdirSync(path.join(out, 'core'), { recursive: true });
for (const f of fs.readdirSync(path.join(root, 'core'))) {
  const src = fs.readFileSync(path.join(root, 'core', f), 'utf8').replaceAll("'../public/shared/", "'../shared/");
  fs.writeFileSync(path.join(out, 'core', f), src);
}
fs.mkdirSync(path.join(out, 'demo'), { recursive: true });
fs.copyFileSync(path.join(root, 'demo', 'demo-backend.js'), path.join(out, 'demo', 'demo-backend.js'));
for (const f of ['sql-wasm.js', 'sql-wasm.wasm']) fs.copyFileSync(path.join(root, 'node_modules', 'sql.js', 'dist', f), path.join(out, 'demo', f));
const idx = path.join(out, 'index.html');
let html = fs.readFileSync(idx, 'utf8');
html = html.replace('<script type="module" src="js/main.js"></script>', '<script src="demo/sql-wasm.js"></script>\n  <script type="module" src="demo/demo-backend.js"></script>\n  <script type="module" src="js/main.js"></script>');
// 체험판은 글꼴 파일 수를 줄이려고 Google Fonts에서 같은 글꼴을 불러옵니다.
if (!PAGES) {
  html = html.replace('<link rel="stylesheet" href="css/fonts.css">', '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Gowun+Dodum&family=Song+Myung&display=swap">');
  fs.rmSync(path.join(out, 'fonts'), { recursive: true, force: true });
  fs.rmSync(path.join(out, 'css', 'fonts.css'), { force: true });
} else fs.writeFileSync(path.join(out, '.nojekyll'), '');
for (const f of ['03_open_book_blank_1600x960.webp', '38_mountain_overlay.webp']) fs.rmSync(path.join(out, 'assets', f), { force: true });
if (!PAGES) html = html.replace('<title>꺾은선그래프 연구소</title>', '<title>꺾은선그래프 연구소 (체험판)</title>');
fs.writeFileSync(idx, html);
console.log(`${PAGES ? 'dist-pages' : 'dist-demo'}/ 완성`);
