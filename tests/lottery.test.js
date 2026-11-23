// 주제 제비뽑기(학생마다 다른 주제, 내 기록으로 표·그래프) 테스트
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 4300 + Math.floor(Math.random() * 80);
const BASE = process.env.TEST_BASE || `http://localhost:${PORT}`; // TEST_BASE: 이미 떠 있는 서버(예: wrangler dev)로 시험
const DB = path.join(os.tmpdir(), `kgl-lot-${Date.now()}.sqlite`);
let proc;
before(async () => {
  if (process.env.TEST_BASE) return;
  proc = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server/server.js'], { env: { ...process.env, PORT: String(PORT), DATABASE_PATH: DB }, stdio: 'pipe' });
  for (let i = 0; i < 50; i++) { try { await fetch(BASE + '/healthz'); return; } catch { await new Promise((r) => setTimeout(r, 100)); } }
});
after(() => { if (!proc) return; proc.kill(); for (const f of [DB, DB + '-wal', DB + '-shm']) fs.rmSync(f, { force: true }); });
function client() {
  let cookie = '';
  return async (method, p, body) => {
    const r = await fetch(BASE + p, { method, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'graph-lab', ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    return { status: r.status, body: await r.json() };
  };
}
const T = client(); const ctx = {};

test('제비뽑기 방식으로 바꾸면 저축 금액은 기본 주제 묶음에서 빠짐', async () => {
  await T('POST', '/api/teacher/signup', { username: 'lot', password: 'password1', name: '제비선생' });
  let r = await T('POST', '/api/teacher/classes', { name: '4학년 3반' });
  ctx.cid = r.body.id; ctx.code = r.body.code;
  r = await T('POST', `/api/teacher/classes/${ctx.cid}/students`, { students: Array.from({ length: 6 }, (_, i) => ({ number: i + 1, name: `학생${i + 1}` })) });
  ctx.pins = r.body.created.map((x) => x.pin);
  await T('PUT', `/api/teacher/classes/${ctx.cid}`, { settings: { topicMode: 'lottery' } });
  r = await T('GET', `/api/teacher/classes/${ctx.cid}/assign`);
  assert.equal(r.body.topicMode, 'lottery');
  assert.equal(r.body.pool.length, 24); assert.equal(r.body.pool.includes(19), false);
  ctx.ids = r.body.rows.map((x) => x.id);
});

test('한 명 뽑기 → 남은 학생 모두 뽑기: 주제가 겹치지 않음', async () => {
  let r = await T('POST', `/api/teacher/classes/${ctx.cid}/assign/draw`, { studentId: ctx.ids[0] });
  assert.equal(r.body.drawn.length, 1);
  r = await T('POST', `/api/teacher/classes/${ctx.cid}/assign/draw`, { all: true });
  assert.equal(r.body.drawn.length, 5);
  const topics = r.body.rows.map((x) => x.topicId);
  assert.equal(new Set(topics).size, 6, '모두 다른 주제');
  assert.equal(r.body.remaining.length, 18);
});

test('직접 바꾸기: 다른 학생 주제와 겹치면 거절', async () => {
  const r0 = await T('GET', `/api/teacher/classes/${ctx.cid}/assign`);
  const other = r0.body.rows[1].topicId;
  let r = await T('POST', `/api/teacher/classes/${ctx.cid}/assign/set`, { studentId: ctx.ids[0], topicId: other });
  assert.equal(r.status, 409);
  const free = r0.body.remaining[0];
  r = await T('POST', `/api/teacher/classes/${ctx.cid}/assign/set`, { studentId: ctx.ids[0], topicId: free });
  assert.equal(r.body.rows[0].topicId, free);
});

test('주제 묶음이 학생 수보다 적으면 남은 주제 없음 안내', async () => {
  await T('POST', `/api/teacher/classes/${ctx.cid}/assign/reset`);
  await T('PUT', `/api/teacher/classes/${ctx.cid}`, { settings: { assignPool: [1, 2, 3] } });
  const r = await T('POST', `/api/teacher/classes/${ctx.cid}/assign/draw`, { all: true });
  assert.equal(r.status, 409);
  const v = await T('GET', `/api/teacher/classes/${ctx.cid}/assign`);
  assert.equal(v.body.rows.filter((x) => x.topicId).length, 0, '실패하면 저장하지 않음');
  await T('PUT', `/api/teacher/classes/${ctx.cid}`, { settings: { assignPool: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] } });
  await T('POST', `/api/teacher/classes/${ctx.cid}/assign/draw`, { all: true });
});

test('학생: 배정된 주제만 기록, 연구 주제 직접 선택 불가, 내 기록으로 표·그래프', async () => {
  const S = client();
  let r = await S('POST', '/api/student/login', { classCode: ctx.code, number: 1, pin: ctx.pins[0] });
  await T('PUT', `/api/teacher/students/${ctx.ids[0]}`, { weatherOverride: true });
  r = await S('GET', '/api/student/state');
  const mine = r.body.gates.research;
  assert.ok(mine); assert.equal(r.body.cls.settings.topicMode, 'lottery');
  r = await S('PUT', '/api/student/state', { research: { topicId: mine } });
  assert.equal(r.status, 403);
  const other = (await T('GET', `/api/teacher/classes/${ctx.cid}/assign`)).body.rows[1].topicId;
  const entries = (vals) => vals.map((v, i) => (v === null ? { month: i + 1, status: 'unknown' } : { month: i + 1, status: 'value', value: v, source: 'record' }));
  r = await S('PUT', '/api/student/responses', { topicId: other, entries: entries([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]) });
  assert.equal(r.status, 400, '다른 학생 주제는 기록 불가');
  const vals = [2, 4, null, 6, 8, 7, 5, 3, 6, 9, 10];
  r = await S('PUT', '/api/student/responses', { topicId: mine, entries: entries(vals) });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  r = await S('GET', `/api/student/table-ref?topicId=${mine}`);
  assert.equal(r.body.mode, 'own'); assert.equal(r.body.rows[1].value, 4); assert.equal(r.body.rows[2].status, 'unknown');
  r = await S('POST', '/api/student/table-check', { topicId: mine, values: vals.map((v) => (v === null ? 3 : v)) });
  assert.equal(r.body.ok, false, '모름 칸은 비워야 함');
  r = await S('POST', '/api/student/table-check', { topicId: mine, values: vals.map((v) => (v === null ? '' : v)) });
  assert.equal(r.body.ok, true);
  const points = {}; vals.forEach((v, i) => { if (v !== null) points[i] = v; });
  const segs = [[0, 1], [1, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10]];
  const labels = vals.map((_, i) => `${i + 1}월`);
  await S('PUT', '/api/student/work', { kind: 'topic', data: { title: '나의 기록', xName: '월', xUnit: '월', yName: '횟수', yUnit: r.body ? undefined : '', scale: 1, points, segments: segs, interp: {} } });
  r = await S('POST', '/api/student/work/check', { kind: 'topic' });
  assert.equal(r.body.ok, false);
  assert.ok(r.body.issues.every((i) => i.step !== 'points'), '점 위치는 내 기록과 맞음: ' + JSON.stringify(r.body.issues));
  assert.deepEqual(r.body.work.data.values, vals);
  ctx.S = S; ctx.mine = mine; ctx.labels = labels;
});

test('기록을 낸 학생의 주제를 바꿀 때는 확인 필요', async () => {
  let r = await T('POST', `/api/teacher/classes/${ctx.cid}/assign/draw`, { studentId: ctx.ids[0] });
  assert.equal(r.status, 409); assert.equal(r.body.needForce, true);
  r = await T('POST', `/api/teacher/classes/${ctx.cid}/assign/draw`, { studentId: ctx.ids[0], force: true });
  assert.equal(r.status, 200); assert.notEqual(r.body.rows[0].topicId, ctx.mine);
  const s = await ctx.S('GET', '/api/student/state');
  assert.equal(s.body.gates.research, r.body.rows[0].topicId);
  assert.ok(s.body.gates.table, '새 주제는 기록 제출 전이라 자료표 잠김');
});

test('다른 교사는 제비뽑기 불가', async () => {
  const T2 = client();
  await T2('POST', '/api/teacher/signup', { username: 'lot2', password: 'password2', name: '남선생' });
  const r = await T2('POST', `/api/teacher/classes/${ctx.cid}/assign/draw`, { all: true });
  assert.equal(r.status, 404);
});
