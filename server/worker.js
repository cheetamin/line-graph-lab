// 「꺾은선그래프 연구소」 Cloudflare Worker 학급 서버
// - 화면 파일(dist-server)은 Cloudflare가 바로 보내 주고, /api/ 요청만 이 코드가 받아요.
// - 자료는 Durable Object 안의 SQLite 한 곳에 모아 저장해요(무료 플랜에서 쓸 수 있어요).
//   이 저장소는 SQL을 바로바로(동기) 실행할 수 있어서, 내 컴퓨터 서버(node:sqlite)와 같은 core/api.js를 그대로 써요.
import { DurableObject } from 'cloudflare:workers';
import { createApi } from '../core/api.js';
import { neisSearch } from '../public/shared/neis.js';

const COOKIE = 'kgl_session';
const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const unhex = (h) => new Uint8Array(h.match(/../g).map((x) => parseInt(x, 16)));
const ITER = 60000; // 선생님 비밀번호 보관(PBKDF2). 자료 저장소(Durable Object) 안에서 계산해요

async function pbkdf2(secret, salt, iter = ITER) {
  const key = await crypto.subtle.importKey('raw', enc.encode(String(secret)), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256);
}
const sec = {
  async hash(secret) { const salt = crypto.getRandomValues(new Uint8Array(16)); return `pbkdf2$${ITER}$${hex(salt)}$${hex(await pbkdf2(secret, salt))}`; },
  async verify(secret, stored) {
    const parts = String(stored).split('$');
    if (parts[0] !== 'pbkdf2' || parts.length !== 4) return false;
    const got = hex(await pbkdf2(secret, unhex(parts[2]), Number(parts[1]) || ITER));
    if (got.length !== parts[3].length) return false;
    let diff = 0; for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ parts[3].charCodeAt(i);
    return diff === 0;
  },
  token() { const b = crypto.getRandomValues(new Uint8Array(32)); return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
  async sha256(t) { return hex(await crypto.subtle.digest('SHA-256', enc.encode(String(t)))); },
};

// SQL 여러 문장을 하나씩 실행(PRAGMA는 Durable Object가 알아서 처리하므로 건너뜀)
function splitSql(text) {
  return text.split(/;\s*(?:\r?\n|$)/).map((x) => x.replace(/^\s*--.*$/gm, '').trim()).filter((x) => x && !/^PRAGMA\b/i.test(x));
}

export class LabStore extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    const sql = ctx.storage.sql;
    const norm = (p) => (p || []).map((x) => (x === undefined ? null : typeof x === 'boolean' ? (x ? 1 : 0) : x));
    const db = {
      all: (q, p) => sql.exec(q, ...norm(p)).toArray(),
      get: (q, p) => sql.exec(q, ...norm(p)).toArray()[0],
      run: (q, p) => {
        const c = sql.exec(q, ...norm(p)); c.toArray();
        return { changes: c.rowsWritten, lastInsertRowid: sql.exec('SELECT last_insert_rowid() AS id').one().id };
      },
      exec: (text) => { for (const s of splitSql(text)) sql.exec(s); },
      tx: (fn) => ctx.storage.transactionSync(fn),
    };
    const cache = new Map();
    const searchSchools = async (q, f = {}) => {
      const ck = `${q}|${f.office || ''}|${f.kind || ''}`;
      const hit = cache.get(ck);
      if (hit && Date.now() - hit.at < 6 * 3600 * 1000) return hit.list;
      const list = await neisSearch(q, { key: env.NEIS_API_KEY || '', office: f.office, kind: f.kind });
      cache.set(ck, { at: Date.now(), list });
      return list;
    };
    this.api = createApi({ db, sec, options: { signupCode: env.TEACHER_SIGNUP_CODE || '', searchSchools, adminPassword: env.ADMIN_PASSWORD || '', allowAdminSetup: true } });
    ctx.blockConcurrencyWhile(async () => { this.api.init(); });
  }

  async handle(req) {
    return this.api.handle(req);
  }
}

function getCookie(request, name) {
  for (const part of (request.headers.get('cookie') || '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin' };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/healthz') return new Response('ok');
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

    // 다른 사이트에서 보내는 쓰기 요청 차단(CSRF)
    if (request.method !== 'GET' && request.headers.get('x-requested-with') !== 'graph-lab') {
      return new Response(JSON.stringify({ error: '잘못된 요청이에요.' }), { status: 403, headers: JSON_HEADERS });
    }
    let body = {};
    if (request.method !== 'GET') {
      const text = await request.text();
      if (text.length > 512 * 1024) return new Response('', { status: 413 });
      try { body = text ? JSON.parse(text) : {}; } catch { body = {}; }
    }
    const store = env.LAB.get(env.LAB.idFromName('main'));
    const out = await store.handle({ method: request.method, path: url.pathname, query: Object.fromEntries(url.searchParams), body, token: getCookie(request, COOKIE) });

    const headers = new Headers(JSON_HEADERS);
    const attr = 'Path=/; HttpOnly; SameSite=Lax; Secure';
    if (out.token) headers.append('Set-Cookie', `${COOKIE}=${encodeURIComponent(out.token)}; ${attr}; Max-Age=${30 * 86400}`);
    if (out.clearToken) headers.append('Set-Cookie', `${COOKIE}=; ${attr}; Max-Age=0`);
    if (out.csv) {
      headers.set('Content-Type', 'text/csv; charset=utf-8');
      headers.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(out.filename || 'data.csv')}`);
      return new Response(out.csv, { status: out.status, headers });
    }
    return new Response(JSON.stringify(out.body ?? {}), { status: out.status, headers });
  },
};
