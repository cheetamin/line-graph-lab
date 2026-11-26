// 「꺾은선그래프 연구소」 웹 서버 — 의존성 없음 (Node.js 22.13 이상, 내장 node:sqlite 사용)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { createApi } from '../core/api.js';
import { neisSearch } from '../public/shared/neis.js';
import { seedDemo } from '../core/seed.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT || 3000);
const DB_PATH = process.env.DATABASE_PATH || path.join(ROOT, 'data', 'graph-lab.sqlite');
const COOKIE = 'kgl_session';
const SECURE = process.env.COOKIE_SECURE === '1' || process.env.NODE_ENV === 'production';

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const sqlite = new DatabaseSync(DB_PATH);
sqlite.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');

export const db = {
  all: (sql, p = []) => sqlite.prepare(sql).all(...p),
  get: (sql, p = []) => sqlite.prepare(sql).get(...p),
  run: (sql, p = []) => sqlite.prepare(sql).run(...p),
  exec: (sql) => sqlite.exec(sql),
  tx(fn) {
    sqlite.exec('BEGIN IMMEDIATE');
    try { const r = fn(); sqlite.exec('COMMIT'); return r; } catch (e) { sqlite.exec('ROLLBACK'); throw e; }
  },
};

export const sec = {
  hash: (secret) => new Promise((res, rej) => {
    const salt = crypto.randomBytes(16);
    crypto.scrypt(String(secret), salt, 32, { N: 16384, r: 8, p: 1 }, (err, key) => (err ? rej(err) : res(`scrypt$${salt.toString('hex')}$${key.toString('hex')}`)));
  }),
  verify: (secret, stored) => new Promise((res) => {
    const [alg, saltHex, keyHex] = String(stored).split('$');
    if (alg !== 'scrypt') return res(false);
    crypto.scrypt(String(secret), Buffer.from(saltHex, 'hex'), 32, { N: 16384, r: 8, p: 1 }, (err, key) => {
      if (err) return res(false);
      const want = Buffer.from(keyHex, 'hex');
      res(want.length === key.length && crypto.timingSafeEqual(want, key));
    });
  }),
  token: () => crypto.randomBytes(32).toString('base64url'),
  sha256: async (text) => crypto.createHash('sha256').update(String(text)).digest('hex'),
};

// 나이스 학교 검색(인증키 NEIS_API_KEY는 선택). 같은 검색어는 6시간 동안 기억
const schoolCache = new Map();
async function searchSchools(q, filter = {}) {
  const ck = `${q}|${filter.office || ''}|${filter.kind || ''}`;
  const hit = schoolCache.get(ck);
  if (hit && Date.now() - hit.at < 6 * 3600 * 1000) return hit.list;
  const list = await neisSearch(q, { key: process.env.NEIS_API_KEY || '', base: process.env.NEIS_BASE || undefined, office: filter.office, kind: filter.kind });
  schoolCache.set(ck, { at: Date.now(), list });
  return list;
}

const api = createApi({ db, sec, options: { signupCode: process.env.TEACHER_SIGNUP_CODE || '', searchSchools, allowAdminSetup: true, adminPassword: process.env.ADMIN_PASSWORD || '' } });
api.init();
if (process.env.DEMO_SEED === '1') {
  seedDemo({ db, sec }).then((made) => made && console.log('체험용 학급(DEMO26)을 만들었습니다.'));
}

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.wasm': 'application/wasm', '.webm': 'video/webm', '.mp4': 'video/mp4',
};
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'SAMEORIGIN',
  'Content-Security-Policy': "default-src 'self'; media-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self'; frame-ancestors 'self'",
};

function getCookie(req, name) {
  const h = req.headers.cookie || '';
  for (const part of h.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > 512 * 1024) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res, urlPath) {
  let p = decodeURIComponent(urlPath);
  if (p === '/' || !path.extname(p)) p = '/index.html';
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('없는 파일이에요.'); }
    const ext = path.extname(file);
    const cache = ext === '.html' || ext === '.js' || ext === '.css' ? 'no-cache' : 'public, max-age=604800';
    res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': cache, ...SECURITY_HEADERS });
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/healthz') { res.writeHead(200); return res.end('ok'); }
  if (!url.pathname.startsWith('/api/')) return serveStatic(req, res, url.pathname);

  // 다른 사이트에서 보내는 쓰기 요청 차단(CSRF)
  if (req.method !== 'GET' && req.headers['x-requested-with'] !== 'graph-lab') {
    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ error: '잘못된 요청이에요.' }));
  }
  let body = {};
  try { body = req.method === 'GET' ? {} : await readBody(req); } catch { res.writeHead(413); return res.end(); }
  const out = await api.handle({
    method: req.method, path: url.pathname, query: Object.fromEntries(url.searchParams), body, token: getCookie(req, COOKIE),
  });
  const headers = { 'Cache-Control': 'no-store', ...SECURITY_HEADERS };
  const cookieAttr = `Path=/; HttpOnly; SameSite=Lax${SECURE ? '; Secure' : ''}`;
  if (out.token) headers['Set-Cookie'] = `${COOKIE}=${encodeURIComponent(out.token)}; ${cookieAttr}; Max-Age=${30 * 86400}`;
  if (out.clearToken) headers['Set-Cookie'] = `${COOKIE}=; ${cookieAttr}; Max-Age=0`;
  if (out.csv) {
    headers['Content-Type'] = 'text/csv; charset=utf-8';
    headers['Content-Disposition'] = `attachment; filename="${out.filename}"`;
    res.writeHead(out.status, headers);
    return res.end(out.csv);
  }
  headers['Content-Type'] = 'application/json; charset=utf-8';
  res.writeHead(out.status, headers);
  res.end(JSON.stringify(out.body ?? {}));
});

server.listen(PORT, () => console.log(`꺾은선그래프 연구소: http://localhost:${PORT}  (DB: ${DB_PATH})`));
