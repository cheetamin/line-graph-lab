// 직접 고르기: 학생이 25개 주제 중 골라 내 기록으로 표·그래프, 주제마다 작품 따로, 최소 제출 수
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { computeStats } from '../public/shared/stats.js';
import { topicById } from '../public/shared/topics.js';

const PORT = 4400 + Math.floor(Math.random() * 80);
const BASE = `http://localhost:${PORT}`;
const DB = path.join(os.tmpdir(), `kgl-own-${Date.now()}.sqlite`);
let proc;
before(async () => {
  proc = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server/server.js'], { env: { ...process.env, PORT: String(PORT), DATABASE_PATH: DB, ADMIN_PASSWORD: 'test-admin-only' }, stdio: 'pipe' });
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
const T = client(); const ctx = {};
const entries = (vals) => vals.map((v, i) => (v === null ? { month: i + 1, status: 'unknown' } : { month: i + 1, status: 'value', value: v, source: 'memory' }));

async function makeGraph(S, topicId, vals) {
  const t = topicById(topicId);
  let r = await S('PUT', '/api/student/state', { research: { topicId } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  r = await S('PUT', '/api/student/responses', { topicId, entries: entries(vals) });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  r = await S('POST', '/api/student/table-check', { topicId, values: vals.map((v) => (v === null ? '' : v)) });
  assert.equal(r.body.ok, true);
  const labels = vals.map((_, i) => `${i + 1}월`);
  const points = {}; vals.forEach((v, i) => { if (v !== null) points[i] = v; });
  const idx = vals.map((v, i) => (v === null ? -1 : i)).filter((i) => i >= 0);
  const segments = idx.slice(1).map((b, k) => [idx[k], b]);
  const st = computeStats(labels, vals);
  r = await S('PUT', '/api/student/work', { kind: 'topic', data: { title: `나의 ${t.name}`, xName: '월', xUnit: '월', yName: '수량', yUnit: t.unit, scale: 1, points, segments,
    interp: { maxLabel: st.maxLabels[0], minLabel: st.minLabels[0], changeLabel: st.changeLabels[0], sentence: '여름에 가장 많고 겨울에 적었어요. 꾸준히 늘었어요.' } } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  r = await S('POST', '/api/student/work/check', { kind: 'topic' });
  assert.equal(r.body.ok, true, JSON.stringify(r.body.issues));
  r = await S('POST', '/api/student/work/submit', { kind: 'topic' });
  assert.equal(r.body.work.status, 'submitted');
  return r.body.work;
}

test('새 학급 기본: 직접 고르기, 최소 3개', async () => {
  await T('POST', '/api/teacher/signup', { username: 'own', password: 'password1', name: '선생' });
  let r = await T('POST', '/api/teacher/classes', { name: '4학년 2반' });
  ctx.cid = r.body.id; ctx.code = r.body.code;
  r = await T('POST', `/api/teacher/classes/${ctx.cid}/students`, { students: [{ number: 1, name: '가' }, { number: 2, name: '나' }] });
  ctx.pins = r.body.created.map((x) => x.pin); ctx.sids = r.body.created.map((x) => x.id);
  const S = client();
  await S('POST', '/api/student/login', { classCode: ctx.code, number: 1, pin: ctx.pins[0] });
  r = await S('GET', '/api/student/state');
  assert.equal(r.body.cls.settings.topicMode, 'own'); assert.equal(r.body.cls.settings.minWorks, 3);
  assert.equal(r.body.cls.settings.topicPool.includes(19), false);
  ctx.S = S; ctx.sid = r.body.student.id;
  await T('PUT', `/api/teacher/students/${ctx.sid}`, { weatherOverride: true });
});

test('주제 두 개를 차례로: 작품이 주제마다 따로 남음, 친구와 같은 주제도 가능', async () => {
  const w1 = await makeGraph(ctx.S, 3, [2, 4, null, 6, 8, 7, 5, 3, 6, 9, 10]);
  const w2 = await makeGraph(ctx.S, 7, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  assert.notEqual(w1.id, w2.id);
  let r = await ctx.S('GET', '/api/student/state');
  const topicWorks = r.body.works.filter((w) => w.kind === 'topic');
  assert.equal(topicWorks.length, 2);
  assert.deepEqual(topicWorks.map((w) => w.status), ['submitted', 'submitted']);
  // 첫 주제로 돌아가도 작품 그대로
  await ctx.S('PUT', '/api/student/state', { research: { topicId: 3 } });
  r = await ctx.S('GET', '/api/student/state');
  assert.equal(r.body.gates.research, 3); assert.equal(r.body.gates.graph, null);
  // 친구도 3번 주제 가능
  const S2 = client();
  await S2('POST', '/api/student/login', { classCode: ctx.code, number: 2, pin: ctx.pins[1] });
  r = await S2('PUT', '/api/student/state', { research: { topicId: 3 } });
  assert.equal(r.status, 200);
  // 주제 묶음 밖은 불가
  r = await S2('PUT', '/api/student/state', { research: { topicId: 19 } });
  assert.equal(r.status, 400);
});

test('교사: 진행 현황 제출 수, 승인하면 전시관에 학생별로 모임', async () => {
  let r = await T('GET', `/api/teacher/classes/${ctx.cid}/progress`);
  const me = r.body.rows.find((x) => x.number === 1);
  assert.equal(me.worksDone, 2); assert.equal(me.minWorks, 3);
  r = await T('GET', `/api/teacher/classes/${ctx.cid}/works`);
  for (const w of r.body.works) await T('POST', `/api/teacher/works/${w.id}/review`, { action: 'approve' });
  r = await ctx.S('GET', '/api/gallery');
  const mine = r.body.items.filter((x) => x.sid === ctx.sid);
  assert.equal(mine.length, 2);
  r = await T('PUT', `/api/teacher/classes/${ctx.cid}`, { settings: { minWorks: 0 } });
  assert.equal(r.status, 400);
  r = await T('PUT', `/api/teacher/classes/${ctx.cid}`, { settings: { minWorks: 2 } });
  assert.equal(r.body.settings.minWorks, 2);
});

test('학급 코드로 우리 반·이름 목록 보기', async () => {
  const P = client();
  let r = await P('GET', `/api/student/class-lookup?code=${ctx.code.toLowerCase()}`);
  assert.equal(r.status, 200); assert.deepEqual(r.body.students.map((x) => x.name), ['가', '나']);
  assert.equal(r.body.students[0].pin, undefined);
  r = await P('GET', '/api/student/class-lookup?code=ZZZZ99');
  assert.equal(r.status, 404);
});

test('3차 우리 고장: 표 검사 → 그래프 → 제출 → 전시관', async () => {
  const S = ctx.S;
  let r = await S('PUT', '/api/student/state', { life: { sourceId: 'yudeung', subject: '진주남강유등축제 방문객 수', unit: '만 명', source: '', years: [2019, 2022, '', ''], values: [98, 110, '', ''] } });
  r = await S('POST', '/api/student/life/check-table');
  assert.equal(r.body.ok, false);
  assert.ok(r.body.issues.some((x) => /출처/.test(x)) && r.body.issues.some((x) => /3개/.test(x)));
  await S('PUT', '/api/student/state', { life: { source: '○○신문', years: [2019, 2022, 2023, 2024, 2025], values: [98, 110, 126.5, 140, 160] } });
  r = await S('POST', '/api/student/life/check-table');
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  const vals = [98, 110, 126.5, 140, 160]; const lb = ['2019년', '2022년', '2023년', '2024년', '2025년'];
  const st = computeStats(lb, vals);
  const points = {}; vals.forEach((v, i) => { points[i] = v; });
  await S('PUT', '/api/student/work', { kind: 'life', data: { title: '연도별 유등축제 방문객 수', xName: '연도', xUnit: '년', yName: '사람 수', yUnit: '만 명', scale: 10, yStart: 80, points, segments: [[0, 1], [1, 2], [2, 3], [3, 4]],
    interp: { maxLabel: st.maxLabels[0], minLabel: st.minLabels[0], changeLabel: st.changeLabels[0], sentence: '해마다 방문객이 꾸준히 늘었어요.' } } });
  r = await S('POST', '/api/student/work/check', { kind: 'life' });
  assert.equal(r.body.ok, true, JSON.stringify(r.body.issues));
  r = await S('POST', '/api/student/work/submit', { kind: 'life' });
  assert.equal(r.body.work.status, 'submitted'); assert.equal(r.body.work.kind, 'life');
  // 값을 바꾸면 표를 다시 확인해야 함
  await S('PUT', '/api/student/state', { life: { predict: '2026년에는 더 늘 것 같아요.' } });
  let s = await S('GET', '/api/student/state');
  assert.equal(s.body.state.life.tableChecked, true, '예상 글만 바꾸면 표는 그대로');
  r = await T('GET', `/api/teacher/classes/${ctx.cid}/works`);
  const lw = r.body.works.find((w) => w.kind === 'life');
  assert.equal(lw.topicName, '우리 고장: 진주남강유등축제 방문객 수');
  await T('POST', `/api/teacher/works/${lw.id}/review`, { action: 'approve' });
  r = await S('GET', '/api/gallery');
  assert.ok(r.body.items.some((x) => x.kind === 'life' && x.sid === ctx.sid));
  r = await T('GET', `/api/teacher/classes/${ctx.cid}/progress`);
  assert.equal(r.body.rows.find((x) => x.number === 1).life, '승인됨');
  r = await T('PUT', `/api/teacher/classes/${ctx.cid}`, { settings: { lifeSources: [{ title: '진주시 도서관 수', unit: '곳', links: [{ t: '시청', u: 'https://www.jinju.go.kr/' }, { t: '나쁜 링크', u: 'javascript:alert(1)' }] }] } });
  assert.equal(r.body.settings.lifeSources.length, 1); assert.equal(r.body.settings.lifeSources[0].links.length, 1);
});

test('만족도 조사: 학생은 세 활동 뒤, 교사는 승인 뒤', async () => {
  const S2 = client();
  await S2('POST', '/api/student/login', { classCode: ctx.code, number: 2, pin: ctx.pins[1] });
  let r = await S2('GET', '/api/student/survey');
  assert.equal(r.body.open, false);
  r = await S2('PUT', '/api/student/survey', { answers: { fun: 5 } });
  assert.equal(r.status, 403);
  // 1번 학생: 1차(예외 허용) + 2차 + 3차 제출 완료
  r = await ctx.S('GET', '/api/student/survey');
  assert.equal(r.body.open, true, JSON.stringify(r.body));
  r = await ctx.S('PUT', '/api/student/survey', { answers: { fun: 5, understand: 4 } });
  assert.equal(r.status, 400); assert.ok(r.body.missing.includes(3));
  r = await ctx.S('PUT', '/api/student/survey', { answers: { fun: 5, understand: 4, draw: 4, life: 5, easy: 3, best: '3차 우리 고장 그래프', comment: '재미있어요' } });
  assert.equal(r.status, 200);
  r = await T('GET', `/api/teacher/classes/${ctx.cid}/survey`);
  assert.equal(r.body.students.responded, 1);
  assert.equal(r.body.students.summary[0].avg, 5);
  assert.equal(JSON.stringify(r.body).includes('"가"'), false, '학생 이름 없음');
  assert.equal(r.body.teacher.open, true);
  r = await T('PUT', `/api/teacher/classes/${ctx.cid}/survey`, { answers: { goal: 5, engage: 5, flow: 4, manage: 4, design: 5, reuse: 5, good: '좋아요' } });
  assert.equal(r.status, 200);
  // 승인 작품이 없는 학급은 교사 조사 잠김
  const c2 = await T('POST', '/api/teacher/classes', { name: '빈 반' });
  r = await T('PUT', `/api/teacher/classes/${c2.body.id}/survey`, { answers: { goal: 5 } });
  assert.equal(r.status, 403);
  const ex = await fetch(`${BASE}/api/teacher/classes/${ctx.cid}/export?type=survey`, { headers: { 'X-Requested-With': 'graph-lab' } });
  assert.ok([200, 401].includes(ex.status));
});

test('우리 고장: 학교 주소로 지역 자료, 지역 바꾸기', async () => {
  let r = await T('POST', '/api/teacher/classes', { school: { name: '행복초등학교', address: '경상남도 하동군 하동읍 1', region: '경상남도' }, grade: 4, classNo: 2 });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  r = await T('GET', '/api/teacher/classes');
  const c = r.body.classes.find((x) => x.id === r.body.classes.at(-1).id);
  assert.equal(c.settings.lifeRegion, '하동군');
  assert.ok(c.settings.lifeSources[0].data && c.settings.lifeSources.some((x) => x.title === '하동군 인구'));
  const { buildLifeSources } = await import('../public/shared/life.js');
  r = await T('PUT', `/api/teacher/classes/${c.id}`, { settings: { lifeRegion: '수원', lifeSources: buildLifeSources('수원시') } });
  assert.equal(r.body.settings.lifeRegion, '수원');
  assert.equal(r.body.settings.lifeSources[0].title, '수원시 관광지 입장객 수');
  assert.equal(r.body.settings.lifeSources[0].data, null);
});

test('전체 관리자: 비밀번호, 운영 현황, 만족도 모아 보기', async () => {
  const A = client();
  let r = await A('GET', '/api/admin/overview');
  assert.equal(r.status, 401);
  r = await A('POST', '/api/admin/login', { password: 'wrong-password' });
  assert.equal(r.status, 401);
  r = await A('POST', '/api/admin/login', { password: 'test-admin-only' });
  assert.equal(r.status, 200);
  r = await A('GET', '/api/me');
  assert.equal(r.body.role, 'admin');
  r = await A('GET', '/api/admin/overview');
  assert.equal(r.status, 200);
  assert.ok(r.body.totals.classes >= 1 && r.body.totals.students >= 2);
  assert.equal(r.body.totals.studentSurveys, 1);
  assert.equal(r.body.surveys.students[0].avg, 5);
  assert.equal(JSON.stringify(r.body).includes('"가"'), false, '학생 이름 없음');
  r = await A('GET', '/api/teacher/classes');
  assert.equal(r.status, 401);
});

test('학생 자료 지우기·학급 전체 초기화', async () => {
  let r = await T('GET', `/api/teacher/students/${ctx.sid}`);
  assert.ok(r.body.responses.some((x) => x.topic_id === 7));
  r = await T('POST', `/api/teacher/students/${ctx.sid}/reset`, { part: 'topic', topicId: 7 });
  assert.equal(r.status, 200);
  r = await T('GET', `/api/teacher/students/${ctx.sid}`);
  assert.equal(r.body.responses.some((x) => x.topic_id === 7), false);
  assert.ok(r.body.responses.some((x) => x.topic_id === 3), '다른 주제는 그대로');
  assert.equal(r.body.works.some((w) => w.kind === 'topic' && w.topicId === 7), false);
  r = await T('POST', `/api/teacher/students/${ctx.sid}/reset`, { part: 'life' });
  let s = await ctx.S('GET', '/api/student/state');
  assert.equal(s.body.state.life, undefined);
  assert.equal(s.body.works.some((w) => w.kind === 'life'), false);
  // 다른 선생님 학생은 못 지움
  const T2 = client();
  await T2('POST', '/api/teacher/signup', { username: 'other2', password: 'password1', name: '남' });
  r = await T2('POST', `/api/teacher/students/${ctx.sid}/reset`, { part: 'all' });
  assert.equal(r.status, 404);
  // 학급 전체: 코드가 틀리면 안 됨
  r = await T('POST', `/api/teacher/classes/${ctx.cid}/reset`, { confirm: 'WRONG' });
  assert.equal(r.status, 400);
  r = await T('POST', `/api/teacher/classes/${ctx.cid}/reset`, { confirm: ctx.code.toLowerCase() });
  assert.equal(r.status, 200); assert.equal(r.body.students, 2);
  r = await T('GET', `/api/teacher/students/${ctx.sid}`);
  assert.equal(r.body.responses.length, 0); assert.equal(r.body.works.length, 0);
  r = await T('GET', `/api/teacher/classes/${ctx.cid}/students`);
  assert.equal(r.body.students.length, 2, '명단은 그대로');
  r = await T('GET', `/api/teacher/classes/${ctx.cid}/survey`);
  assert.equal(r.body.students.responded, 0);
  s = await ctx.S('GET', '/api/student/state');
  assert.equal(s.status, 200, '학생은 같은 PIN으로 계속 들어올 수 있음');
});
