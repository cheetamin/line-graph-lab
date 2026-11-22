// 학교 검색·학급 만들기·학급 코드 테스트 (나이스 대신 가짜 서버 사용)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 4100 + Math.floor(Math.random() * 80);
const NEIS_PORT = PORT + 100;
const BASE = `http://localhost:${PORT}`;
const DB = path.join(os.tmpdir(), `kgl-class-${Date.now()}.sqlite`);
let proc; let neis; let neisMode = 'ok'; let lastNeisUrl = '';

const row = (name, kind, code) => ({ ATPT_OFCDC_SC_CODE: 'S10', ATPT_OFCDC_SC_NM: '경상남도교육청', SD_SCHUL_CODE: code, SCHUL_NM: name, SCHUL_KND_SC_NM: kind, LCTN_SC_NM: '경상남도', ORG_RDNMA: ' 경상남도 어딘가 1 ' });

before(async () => {
  neis = http.createServer((req, res) => {
    lastNeisUrl = req.url;
    res.setHeader('Content-Type', 'application/json');
    if (neisMode === 'down') { res.statusCode = 500; return res.end('{}'); }
    if (neisMode === 'none') return res.end(JSON.stringify({ RESULT: { CODE: 'INFO-200', MESSAGE: '해당하는 데이터가 없습니다.' } }));
    res.end(JSON.stringify({ schoolInfo: [{ head: [{ list_total_count: 3 }, { RESULT: { CODE: 'INFO-000', MESSAGE: '정상 처리되었습니다.' } }] },
      { row: [row('행복중학교', '중학교', '9000002'), row('행복초등학교', '초등학교', '9000001'), row('행복고등학교', '고등학교', '9000003')] }] }));
  }).listen(NEIS_PORT);
  proc = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server/server.js'], { env: { ...process.env, PORT: String(PORT), DATABASE_PATH: DB, NEIS_BASE: `http://localhost:${NEIS_PORT}/hub/schoolInfo`, NEIS_API_KEY: '' }, stdio: 'pipe' });
  for (let i = 0; i < 50; i++) { try { await fetch(BASE + '/healthz'); return; } catch { await new Promise((r) => setTimeout(r, 100)); } }
});
after(() => { proc.kill(); neis.close(); for (const f of [DB, DB + '-wal', DB + '-shm']) fs.rmSync(f, { force: true }); });

function client() {
  let cookie = '';
  return async (method, p, body) => {
    const r = await fetch(BASE + p, { method, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'graph-lab', ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    return { status: r.status, body: await r.json() };
  };
}
const T = client(); const T2 = client();
let classId;

test('학교 검색: 초등학교가 먼저, 인증키 없으면 5개 요청', async () => {
  await T('POST', '/api/teacher/signup', { username: 'park', password: 'password1', name: '박선생' });
  let r = await T('GET', '/api/teacher/schools?q=' + encodeURIComponent('행복'));
  assert.equal(r.body.available, true);
  assert.equal(r.body.schools[0].name, '행복초등학교');
  assert.equal(r.body.schools[0].code, '9000001');
  assert.equal(r.body.schools[0].address, '경상남도 어딘가 1');
  assert.match(lastNeisUrl, /pSize=5/); assert.doesNotMatch(lastNeisUrl, /KEY=/);
  r = await T('GET', '/api/teacher/schools?q=a');
  assert.equal(r.status, 400);
  const anon = client();
  r = await anon('GET', '/api/teacher/schools?q=' + encodeURIComponent('행복'));
  assert.equal(r.status, 401, '교사만 검색');
});

test('학교 검색: 결과 없음 / 나이스 장애 시 직접 입력 안내', async () => {
  neisMode = 'none';
  let r = await T('GET', '/api/teacher/schools?q=' + encodeURIComponent('없는학교'));
  assert.equal(r.body.available, true); assert.equal(r.body.schools.length, 0);
  neisMode = 'down';
  r = await T('GET', '/api/teacher/schools?q=' + encodeURIComponent('장애학교'));
  assert.equal(r.body.available, false); assert.ok(r.body.error);
  neisMode = 'ok';
});

test('학급 만들기: 학교·학년·반으로 이름 자동, 직접 정한 학급 코드', async () => {
  const school = { name: '행복초등학교', code: '9000001', officeCode: 'S10', office: '경상남도교육청', kind: '초등학교', region: '경상남도', address: '경상남도 어딘가 1' };
  let r = await T('GET', '/api/teacher/code-check?code=hb42');
  assert.equal(r.body.available, true); assert.equal(r.body.code, 'HB42');
  r = await T('POST', '/api/teacher/classes', { school, grade: 4, classNo: 2, nickname: '꿈나무반', code: 'hb-42' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.code, 'HB42'); assert.equal(r.body.name, '행복초등학교 4학년 2반');
  classId = r.body.id;
  r = await T('GET', '/api/teacher/classes');
  const c = r.body.classes.find((x) => x.id === classId);
  assert.equal(c.settings.school.code, '9000001'); assert.equal(c.settings.grade, 4); assert.equal(c.settings.classNo, 2); assert.equal(c.settings.nickname, '꿈나무반');
});

test('학급 코드: 형식 검사, 다른 학급과 중복 불가, 바꾸기', async () => {
  let r = await T('GET', '/api/teacher/code-check?code=AB');
  assert.equal(r.body.available, false);
  r = await T('GET', '/api/teacher/code-check?code=1234');
  assert.equal(r.body.available, false, '숫자만 4자리는 불가');
  await T2('POST', '/api/teacher/signup', { username: 'choi', password: 'password2', name: '최선생' });
  r = await T2('GET', '/api/teacher/code-check?code=HB42');
  assert.equal(r.body.available, false, '다른 교사 학급이 쓰는 코드');
  r = await T2('POST', '/api/teacher/classes', { name: '다른 반', code: 'HB42' });
  assert.equal(r.status, 409);
  r = await T('GET', `/api/teacher/code-check?code=HB42&classId=${classId}`);
  assert.equal(r.body.available, true, '내 학급의 지금 코드는 사용 가능으로');
  r = await T('POST', `/api/teacher/classes/${classId}/code`, { code: 'SUN77' });
  assert.equal(r.body.code, 'SUN77');
  r = await T2('POST', `/api/teacher/classes/${classId}/code`, { code: 'ZZZ99' });
  assert.equal(r.status, 404, '다른 교사는 코드 변경 불가');
  // 학생은 새 코드로 입장
  r = await T('POST', `/api/teacher/classes/${classId}/students`, { students: [{ number: 1, name: '가온' }] });
  const pin = r.body.created[0].pin;
  const S = client();
  r = await S('POST', '/api/student/login', { classCode: 'HB42', number: 1, pin });
  assert.equal(r.status, 401, '예전 코드로는 입장 불가');
  r = await S('POST', '/api/student/login', { classCode: 'sun77', number: 1, pin });
  assert.equal(r.status, 200);
});

test('학교 정보 고치기', async () => {
  const r = await T('PUT', `/api/teacher/classes/${classId}`, { settings: { school: { name: '직접적은초등학교', manual: true }, grade: 5, classNo: 3 } });
  assert.equal(r.body.settings.school.name, '직접적은초등학교'); assert.equal(r.body.settings.school.manual, true); assert.equal(r.body.settings.grade, 5);
});
