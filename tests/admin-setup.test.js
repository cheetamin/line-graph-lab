// 전체 관리자: 서버판에서 처음 한 번 비밀번호를 직접 정하고, 그 뒤로는 그 비밀번호로만 들어와요
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 4600 + Math.floor(Math.random() * 80);
const BASE = `http://localhost:${PORT}`;
const DB = path.join(os.tmpdir(), `kgl-admin-${Date.now()}.sqlite`);
let proc;
before(async () => {
  const env = { ...process.env, PORT: String(PORT), DATABASE_PATH: DB }; delete env.ADMIN_PASSWORD;
  proc = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server/server.js'], { env, stdio: 'pipe' });
  for (let i = 0; i < 50; i++) { try { await fetch(BASE + '/healthz'); return; } catch { await new Promise((r) => setTimeout(r, 100)); } }
});
after(() => { proc.kill(); for (const f of [DB, DB + '-wal', DB + '-shm']) fs.rmSync(f, { force: true }); });
function client() {
  let cookie = '';
  return async (method, p, body) => {
    const r = await fetch(BASE + p, { method, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'graph-lab', ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    return { status: r.status, body: await r.json() };
  };
}

test('처음 한 번 비밀번호 정하기 → 그 비밀번호로 로그인', async () => {
  const A = client();
  let r = await A('GET', '/api/admin/status');
  assert.deepEqual(r.body, { enabled: false, canSetup: true });
  r = await A('POST', '/api/admin/setup', { password: 'short' });
  assert.equal(r.status, 400);
  r = await A('POST', '/api/admin/setup', { password: 'my-admin-pass-1' });
  assert.equal(r.status, 200);
  r = await A('GET', '/api/admin/overview');
  assert.equal(r.status, 200, '정하자마자 관리자 화면');
  r = await A('GET', '/api/admin/status');
  assert.deepEqual(r.body, { enabled: true, canSetup: false });

  const B = client();
  r = await B('POST', '/api/admin/setup', { password: 'someone-else-9' });
  assert.equal(r.status, 403, '두 번째로 정하기는 막힘');
  r = await B('POST', '/api/admin/login', { password: 'wrong-pass-00' });
  assert.equal(r.status, 401);
  r = await B('POST', '/api/admin/login', { password: 'my-admin-pass-1' });
  assert.equal(r.status, 200);
  r = await B('GET', '/api/admin/overview');
  assert.equal(r.status, 200);
});
