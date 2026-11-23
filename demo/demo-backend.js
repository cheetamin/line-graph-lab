// 체험판 전용: 서버와 같은 핵심 로직(core/api.js)을 브라우저 안의 SQLite(sql.js)로 실행합니다.
// 자료는 이 브라우저에만 저장됩니다. 실제 수업에서는 server/server.js로 운영하세요.
import { createApi } from '../core/api.js?v=mwsxb00z';
import { seedDemo } from '../core/seed.js?v=mwsxb00z';
import { neisSearch } from '../shared/neis.js?v=mwsxb00z';

const KEY = 'kgl-demo-db-v7'; // 제비뽑기 방식 체험 자료(v2)
const TKEY = 'kgl-demo-token';
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return memory[k] ?? null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { memory[k] = v; } },
  del(k) { try { localStorage.removeItem(k); } catch { delete memory[k]; } },
};
const memory = {};
const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const unhex = (h) => new Uint8Array(h.match(/../g).map((x) => parseInt(x, 16)));
const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function pbkdf2(secret, salt) {
  const key = await crypto.subtle.importKey('raw', enc.encode(String(secret)), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 30000 }, key, 256);
}
const sec = {
  async hash(secret) { const salt = crypto.getRandomValues(new Uint8Array(16)); return `pbkdf2$${hex(salt)}$${hex(await pbkdf2(secret, salt))}`; },
  async verify(secret, stored) { const [a, s, k] = String(stored).split('$'); if (a !== 'pbkdf2') return false; return hex(await pbkdf2(secret, unhex(s))) === k; },
  token() { return hex(crypto.getRandomValues(new Uint8Array(32))); },
  async sha256(t) { return hex(await crypto.subtle.digest('SHA-256', enc.encode(String(t)))); },
};

window.__KGL_READY__ = (async () => {
  const SQL = await window.initSqlJs({ locateFile: (f) => `demo/${f}` });
  const saved = store.get(KEY);
  let sdb;
  try { sdb = saved ? new SQL.Database(unb64(saved)) : new SQL.Database(); } catch { sdb = new SQL.Database(); }
  const rows = (sql, p = []) => { const st = sdb.prepare(sql); st.bind(p.map((x) => (x === undefined ? null : x))); const out = []; while (st.step()) out.push(st.getAsObject()); st.free(); return out; };
  const db = {
    all: rows,
    get: (sql, p) => rows(sql, p)[0],
    run: (sql, p = []) => { sdb.run(sql, p.map((x) => (x === undefined ? null : x))); return { changes: sdb.getRowsModified(), lastInsertRowid: rows('SELECT last_insert_rowid() AS id')[0].id }; },
    exec: (sql) => sdb.exec(sql),
    tx(fn) { sdb.exec('BEGIN'); try { const r = fn(); sdb.exec('COMMIT'); return r; } catch (e) { sdb.exec('ROLLBACK'); throw e; } },
  };
  const api = createApi({ db, sec, options: { searchSchools: (q, f) => neisSearch(q, f) } });
  api.init();
  await seedDemo({ db, sec });
  const persist = () => { try { store.set(KEY, b64(sdb.export())); } catch { /* 저장 공간 부족 */ } };
  persist();
  window.__KGL_DEMO__ = async (method, path, body) => {
    const u = new URL(path, 'http://demo.local');
    const out = await api.handle({ method, path: u.pathname, query: Object.fromEntries(u.searchParams), body: body ? JSON.parse(JSON.stringify(body)) : {}, token: store.get(TKEY) });
    if (out.token) store.set(TKEY, out.token);
    if (out.clearToken) store.del(TKEY);
    if (method !== 'GET' || out.token) persist();
    return out;
  };
  window.__KGL_RESET_DEMO__ = () => { store.del(KEY); store.del(TKEY); location.reload(); };
})();
