// 브라우저 안에서만 동작하는 판 만들기
//  npm run build:demo  → dist-demo/  (Claude 아티팩트용: 글꼴은 Google Fonts)
//  npm run build:pages → dist-pages/ (GitHub Pages용: 글꼴 파일 포함, 학교망에서도 글꼴 유지)
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
//  npm run build:server → dist-server/ (Cloudflare Worker가 보여 주는 화면: 체험판 없이 학급 서버에 연결)
const SERVER = process.argv.includes('--server');
const PAGES = SERVER || process.argv.includes('--pages');
const out = path.join(root, SERVER ? 'dist-server' : PAGES ? 'dist-pages' : 'dist-demo');
fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(path.join(root, 'public'), out, { recursive: true });
if (!SERVER) fs.mkdirSync(path.join(out, 'core'), { recursive: true });
for (const f of SERVER ? [] : fs.readdirSync(path.join(root, 'core'))) {
  const src = fs.readFileSync(path.join(root, 'core', f), 'utf8').replaceAll("'../public/shared/", "'../shared/");
  fs.writeFileSync(path.join(out, 'core', f), src);
}
if (!SERVER) {
  fs.mkdirSync(path.join(out, 'demo'), { recursive: true });
  fs.copyFileSync(path.join(root, 'demo', 'demo-backend.js'), path.join(out, 'demo', 'demo-backend.js'));
  for (const f of ['sql-wasm.js', 'sql-wasm.wasm']) fs.copyFileSync(path.join(root, 'node_modules', 'sql.js', 'dist', f), path.join(out, 'demo', f));
}
const idx = path.join(out, 'index.html');
let html = fs.readFileSync(idx, 'utf8');
if (!SERVER) html = html.replace('<script type="module" src="js/main.js"></script>', '<script src="demo/sql-wasm.js"></script>\n  <script type="module" src="demo/demo-backend.js"></script>\n  <script type="module" src="js/main.js"></script>');
// 체험판은 글꼴 파일 수를 줄이려고 Google Fonts에서 같은 글꼴을 불러옵니다.
if (!PAGES) {
  html = html.replace('<link rel="stylesheet" href="css/fonts.css">', '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Gowun+Dodum&family=Song+Myung&display=swap">');
  fs.rmSync(path.join(out, 'fonts'), { recursive: true, force: true });
  fs.rmSync(path.join(out, 'css', 'fonts.css'), { force: true });
} else if (!SERVER) fs.writeFileSync(path.join(out, '.nojekyll'), '');
if (SERVER) {
  // 배포 번호: Worker와 자료 저장소가 같은 코드인지 확인하는 데 써요
  fs.writeFileSync(path.join(root, 'server', 'build-id.js'), `// 배포할 때마다 새로 적혀요\nexport const BUILD = '${Date.now().toString(36)}';\n`);
  // Cloudflare 정적 파일 머리글: 보안 + 코드 파일은 매번 확인, 그림은 일주일 보관
  fs.writeFileSync(path.join(out, '_headers'), [
    '/*',
    '  X-Content-Type-Options: nosniff',
    '  Referrer-Policy: same-origin',
    '  X-Frame-Options: SAMEORIGIN',
    "  Content-Security-Policy: default-src 'self'; media-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self'; frame-ancestors 'self'",
    '/assets/*',
    '  Cache-Control: public, max-age=604800',
    '/fonts/*',
    '  Cache-Control: public, max-age=2592000',
    '',
  ].join('\n'));
}
for (const f of ['03_open_book_blank_1600x960.webp', '38_mountain_overlay.webp']) fs.rmSync(path.join(out, 'assets', f), { force: true });
if (!PAGES) html = html.replace('<title>꺾은선그래프 연구소</title>', '<title>꺾은선그래프 연구소 (체험판)</title>');
// GitHub Pages: 새로 올릴 때마다 코드 파일 주소에 판 번호(?v=)를 붙여, 브라우저가 옛 파일을 다시 쓰지 않게 함
if (PAGES) {
  const V = Date.now().toString(36);
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  const re = /((?:from|import)\s*\(?\s*)(['"])(\.{1,2}\/[^'"?]+?\.js)\2/g;
  for (const f of walk(out).filter((x) => x.endsWith('.js') && !/[\\/](vendor|demo[\\/]sql-wasm)/.test(x))) {
    const src = fs.readFileSync(f, 'utf8');
    const next = src.replace(re, (m, pre, q, spec) => `${pre}${q}${spec}?v=${V}${q}`);
    if (next !== src) fs.writeFileSync(f, next);
  }
  html = html.replace(/(src|href)="((?:js|demo|css)\/[^"?]+\.(?:js|css))"/g, (m, a, u) => `${a}="${u}?v=${V}"`);
}
fs.writeFileSync(idx, html);
console.log(`${path.basename(out)}/ 완성`);
