// 서버 전체 흐름 테스트: npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 3900 + Math.floor(Math.random() * 90);
const BASE = process.env.TEST_BASE || `http://localhost:${PORT}`; // TEST_BASE: 이미 떠 있는 서버(예: wrangler dev)로 시험
const DB = path.join(os.tmpdir(), `kgl-test-${Date.now()}.sqlite`);
let proc;

before(async () => {
  if (process.env.TEST_BASE) return;
  proc = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server/server.js'], { env: { ...process.env, PORT: String(PORT), DATABASE_PATH: DB, DEMO_SEED: '0' }, stdio: 'pipe' });
  for (let i = 0; i < 50; i++) { try { await fetch(BASE + '/healthz'); return; } catch { await new Promise((r) => setTimeout(r, 100)); } }
});
after(() => { if (!proc) return; proc.kill(); for (const f of [DB, DB + '-wal', DB + '-shm']) fs.rmSync(f, { force: true }); });

function client() {
  let cookie = '';
  return async (method, p, body) => {
    const r = await fetch(BASE + p, {
      method, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'graph-lab', ...(cookie ? { Cookie: cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    const ct = r.headers.get('content-type') || '';
    return { status: r.status, body: ct.includes('json') ? await r.json() : await r.text() };
  };
}

const ctx = {};

test('교사 가입·학급·학생 등록', async () => {
  const T = client(); ctx.T = T;
  let r = await T('POST', '/api/teacher/signup', { username: 'kim', password: 'password1', name: '김선생' });
  assert.equal(r.status, 200);
  r = await T('POST', '/api/teacher/classes', { name: '4학년 2반' });
  ctx.classId = r.body.id; ctx.code = r.body.code;
  await T('PUT', `/api/teacher/classes/${ctx.classId}`, { settings: { topicMode: 'class' } }); // 이 테스트는 학급 공동 조사 방식
  r = await T('POST', `/api/teacher/classes/${ctx.classId}/students`, { students: [{ number: 1, name: '가람' }, { number: 2, name: '나래' }, { number: 3, name: '다솜' }] });
  assert.equal(r.body.created.length, 3);
  ctx.pins = Object.fromEntries(r.body.created.map((c) => [c.number, c.pin]));
  r = await T('POST', `/api/teacher/classes/${ctx.classId}/students`, { students: [{ number: 1, name: '중복' }] });
  assert.equal(r.status, 409);
  // 다른 교사·다른 학급
  const T2 = client(); ctx.T2 = T2;
  await T2('POST', '/api/teacher/signup', { username: 'lee', password: 'password2', name: '이선생' });
  r = await T2('POST', '/api/teacher/classes', { name: '다른 반' });
  ctx.class2 = r.body.id; ctx.code2 = r.body.code;
  r = await T2('POST', `/api/teacher/classes/${ctx.class2}/students`, { students: [{ number: 1, name: '라온' }] });
  ctx.pin2 = r.body.created[0].pin;
  r = await T2('GET', `/api/teacher/classes/${ctx.classId}/students`);
  assert.equal(r.status, 404, '다른 교사의 학급은 볼 수 없음');
});

test('학생 로그인: 학급 코드 + 명단의 내 번호(PIN 없음)', async () => {
  const S = client(); ctx.S = S;
  let r = await S('POST', '/api/student/login', { classCode: ctx.code, number: 77 });
  assert.equal(r.status, 401, '명단에 없는 번호는 불가');
  r = await S('POST', '/api/student/login', { classCode: 'NOPE99', number: 1 });
  assert.equal(r.status, 401, '없는 학급 코드는 불가');
  r = await S('POST', '/api/student/login', { classCode: ctx.code.toLowerCase(), number: 1 });
  assert.equal(r.status, 200);
  r = await S('GET', '/api/me');
  assert.equal(r.body.role, 'student');
  const anon = client();
  r = await anon('GET', '/api/student/state');
  assert.equal(r.status, 401);
  r = await anon('GET', '/api/gallery');
  assert.equal(r.status, 401);
});

test('기상자료 단계 전에는 투표·조사 불가', async () => {
  const { S } = ctx;
  let r = await S('POST', '/api/student/vote', { topicId: 3 });
  assert.equal(r.status, 403);
  r = await S('GET', '/api/student/state');
  assert.ok(r.body.gates.topics);
  assert.equal(r.body.gates.weather, null);
});

test('기상자료 표 검증과 직접 그린 그래프 검사·제출', async () => {
  const { S } = ctx;
  await S('PUT', '/api/student/state', { weather: { region: '진주', source: '기상청 기상자료개방포털', years: [2021, 2022, 2023, 2024, 2025], values: [10, 15, 9, 30, 22] } });
  let r = await S('POST', '/api/student/weather/check-table');
  assert.equal(r.body.ok, true);
  // 틀린 그래프
  const base = { title: '진주의 연도별 폭염일수', xName: '연도', xUnit: '년', yName: '폭염일수', yUnit: '일', scale: 2, yStart: 0,
    points: { 0: 10, 1: 15, 2: 9, 3: 30, 4: 20 }, segments: [[0, 1], [1, 2], [2, 3]],
    interp: { maxLabel: '2024년', minLabel: '2023년', changeLabel: '2023년~2024년', sentence: '2024년에 폭염일수가 가장 많았어요.' } };
  await S('PUT', '/api/student/work', { kind: 'weather', data: base });
  r = await S('POST', '/api/student/work/check', { kind: 'weather' });
  assert.equal(r.body.ok, false);
  const msgs = r.body.issues.map((i) => i.step);
  assert.ok(msgs.includes('points') && msgs.includes('lines'));
  // 바른 그래프
  await S('PUT', '/api/student/work', { kind: 'weather', data: { ...base, points: { ...base.points, 4: 22 }, segments: [[0, 1], [1, 2], [2, 3], [3, 4]] } });
  r = await S('POST', '/api/student/work/check', { kind: 'weather' });
  assert.equal(r.body.ok, true, JSON.stringify(r.body.issues));
  r = await S('POST', '/api/student/work/submit', { kind: 'weather' });
  assert.equal(r.body.work.status, 'submitted');
  assert.deepEqual(r.body.work.data.autoIssues, []);
  r = await S('GET', '/api/student/state');
  assert.equal(r.body.gates.weatherDone, true);
  assert.equal(r.body.gates.topics, null);
});

test('주제 투표(중복 없음)와 월별 조사 검증', async () => {
  const { S, T } = ctx;
  let r = await S('POST', '/api/student/vote', { topicId: 3 });
  assert.equal(r.status, 200);
  r = await S('POST', '/api/student/vote', { topicId: 7 });
  r = await S('GET', '/api/student/votes');
  assert.equal(r.body.counts[7], 1); assert.equal(r.body.counts[3], undefined);
  // 아직 주제 미활성
  r = await S('PUT', '/api/student/responses', { topicId: 3, entries: [] });
  assert.equal(r.status, 400);
  await T('PUT', `/api/teacher/classes/${ctx.classId}`, { settings: { activeTopics: [3, 10, 19] } });
  const entries = Array.from({ length: 11 }, (_, i) => ({ month: i + 1, status: 'value', value: i + 1, source: 'memory' }));
  entries[1] = { month: 2, status: 'value', value: 29 }; // 2월은 28일까지
  r = await S('PUT', '/api/student/responses', { topicId: 3, entries });
  assert.equal(r.status, 400); assert.ok(r.body.errors[2]);
  entries[1] = { month: 2, status: 'unknown' };
  entries[2] = { month: 3, status: 'value', value: 0, source: 'record' };
  r = await S('PUT', '/api/student/responses', { topicId: 3, entries });
  assert.equal(r.status, 200);
  // 다른 학생 2
  const S2 = client(); ctx.S2 = S2;
  await S2('POST', '/api/student/login', { classCode: ctx.code, number: 2, pin: ctx.pins[2] });
  await T('PUT', `/api/teacher/students/${(await T('GET', `/api/teacher/classes/${ctx.classId}/students`)).body.students[1].id}`, { weatherOverride: true });
  const e2 = Array.from({ length: 11 }, (_, i) => ({ month: i + 1, status: 'value', value: 2 }));
  r = await S2('PUT', '/api/student/responses', { topicId: 3, entries: e2 });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  // 저축(개인정보)
  const money = Array.from({ length: 11 }, (_, i) => ({ month: i + 1, status: 'value', value: 1000 * (i + 1) }));
  r = await S2('PUT', '/api/student/responses', { topicId: 19, entries: money });
  assert.equal(r.status, 200);
  r = await S('PUT', '/api/student/responses', { topicId: 19, entries: money.map((m) => ({ ...m, value: 500 })) });
  assert.equal(r.status, 200);
});

test('학급 집계: 미응답은 0이 아님, 응답 수 표시', async () => {
  const { T } = ctx;
  const r = await T('GET', `/api/teacher/classes/${ctx.classId}/aggregate`);
  const t3 = r.body.topics.find((t) => t.topicId === 3);
  assert.equal(t3.rows[0].value, 3); // 1 + 2
  assert.equal(t3.rows[1].value, 2); assert.equal(t3.rows[1].responders, 1); assert.equal(t3.rows[1].unknown, 1);
  assert.equal(t3.rows[2].value, 2); // 0 + 2
});

test('자료표: 참고 자료는 익명, 저축은 집계만, 학생이 직접 입력', async () => {
  const { S } = ctx;
  let r = await S('PUT', '/api/student/state', { research: { topicId: 3 } });
  r = await S('GET', '/api/student/table-ref?topicId=3');
  assert.equal(r.body.list, true);
  assert.deepEqual(r.body.rows[0].values, [1, 2]);
  assert.equal(JSON.stringify(r.body).includes('나래'), false);
  r = await S('GET', '/api/student/table-ref?topicId=19');
  assert.equal(r.body.list, false); assert.equal(r.body.rows[0].values, undefined); assert.equal(r.body.rows[0].value, 1500);
  const wrong = [3, 2, 2, 6, 7, 8, 9, 10, 11, 12, 12];
  r = await S('POST', '/api/student/table-check', { topicId: 3, values: wrong });
  assert.equal(r.body.ok, false);
  assert.equal(r.body.result[10].ok, false);
  assert.equal(r.body.result[10].value, undefined, '정답을 알려주지 않음');
  r = await S('POST', '/api/student/table-check', { topicId: 3, values: [3, 2, 2, 6, 7, 8, 9, 10, 11, 12, 13] });
  assert.equal(r.body.ok, true);
});

test('주제 그래프 그리기·제출·교사 승인·전시관·학급 격리', async () => {
  const { S, T, T2 } = ctx;
  const values = [3, 2, 2, 6, 7, 8, 9, 10, 11, 12, 13];
  const points = Object.fromEntries(values.map((v, i) => [i, v]));
  const segments = values.slice(1).map((_, i) => [i, i + 1]);
  let r = await S('PUT', '/api/student/work', { kind: 'topic', data: { title: '우리 반 감정 글쓰기 날수', xName: '월', xUnit: '월', yName: '날수', yUnit: '일', scale: 1, points, segments,
    interp: { maxLabel: '11월', minLabel: '2월', changeLabel: '3월~4월', sentence: '감정 글쓰기를 한 날수가 점점 늘어났어요.' } } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  r = await S('POST', '/api/student/work/check', { kind: 'topic' });
  assert.equal(r.body.ok, true, JSON.stringify(r.body.issues));
  assert.deepEqual(r.body.answer.values, values);
  r = await S('POST', '/api/student/work/submit', { kind: 'topic' });
  assert.equal(r.body.work.status, 'submitted');
  r = await S('GET', '/api/gallery');
  assert.equal(r.body.items.length, 0, '승인 전에는 전시되지 않음');
  r = await T('GET', `/api/teacher/classes/${ctx.classId}/works`);
  const w = r.body.works.find((x) => x.kind === 'topic');
  r = await T2('POST', `/api/teacher/works/${w.id}/review`, { action: 'approve' });
  assert.equal(r.status, 404, '다른 교사는 승인 불가');
  r = await T('POST', `/api/teacher/works/${w.id}/review`, { action: 'approve' });
  r = await S('GET', '/api/gallery');
  assert.equal(r.body.items.length, 1);
  assert.equal(r.body.items[0].stats.maxLabels[0], '11월');
  // 다른 학급 학생은 이 작품을 볼 수 없음
  const O = client();
  await O('POST', '/api/student/login', { classCode: ctx.code2, number: 1, pin: ctx.pin2 });
  r = await O('GET', '/api/gallery');
  assert.equal(r.status, 200); assert.equal(r.body.items.length, 0);
  r = await O('GET', `/api/student/table-ref?topicId=3`);
  assert.notEqual(r.status, 200);
});

test('교사 진행 현황과 CSV 내려받기', async () => {
  const { T } = ctx;
  let r = await T('GET', `/api/teacher/classes/${ctx.classId}/progress`);
  const p1 = r.body.rows.find((x) => x.number === 1);
  assert.equal(p1.weather, '완료'); assert.equal(p1.vote, 7); assert.equal(p1.table, '완성'); assert.equal(p1.graph, '승인됨');
  r = await T('GET', `/api/teacher/classes/${ctx.classId}/export?type=responses`);
  assert.ok(r.body.includes('감정 글쓰기'));
  assert.ok(r.body.includes('기억나지 않음'));
});

test('CSRF 헤더 없는 쓰기 요청 차단', async () => {
  const r = await fetch(BASE + '/api/teacher/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(r.status, 403);
});
