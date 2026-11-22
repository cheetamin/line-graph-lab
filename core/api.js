// 「꺾은선그래프 연구소」 서버 핵심 로직
// - 모든 권한 검증과 학급 격리는 이 파일에서 수행합니다.
// - db 어댑터: { all(sql, params), get(sql, params), run(sql, params), exec(sql), tx(fn) }
// - sec 어댑터: { hash(secret), verify(secret, stored), token(), sha256(text) }  (모두 Promise 가능)
import { SCHEMA } from './schema.js';
import { TOPICS, topicById, validateEntry, SCALE_OPTIONS, snapStep, MONTH_DAYS } from '../public/shared/topics.js';
import { computeStats, round1 } from '../public/shared/stats.js';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DAY = 86400000;
const now = () => new Date().toISOString();

export const DEFAULT_KMA_GUIDE = [
  '① 기상자료개방포털에 접속해요.',
  '② 위쪽 메뉴에서 [기후통계분석] → [기상현상일수]를 누르고, 왼쪽에서 [폭염일수]를 골라요.',
  '③ 검색 조건의 기간에서 조사할 연도 5개(연속된 5년)를 정해요.',
  '④ 지점의 [선택]을 누르고, 시·도의 ⊞를 눌러 조사할 지역을 고른 다음 [선택완료]를 눌러요.',
  '⑤ [검색]을 누르고 표의 ‘연합계’ 칸에서 연도별 폭염일수를 찾아 적어요.',
  '※ 누리집 메뉴 위치는 바뀔 수 있어요. 찾기 어려우면 선생님께 물어보세요.',
].join('\n');

export const DEFAULT_SETTINGS = {
  stages: { weather: true, topics: true, table: true, graph: true, gallery: true },
  voteOpen: true,
  surveyOpen: true,
  allowEdit: true,
  activeTopics: [],
  monthFrom: 1,
  monthTo: 11,
  displayName: 'name', // name | number | nickname
  savingsMode: 'total', // total | average | hidden
  tableRefMode: 'list', // list(응답 목록을 보고 직접 더하기) | total(학급 합계 옮겨 쓰기)
  tableRefVisible: true,
  kmaUrl: 'https://data.kma.go.kr/',
  kmaGuide: DEFAULT_KMA_GUIDE,
  notice: '',
};

class HttpError extends Error {
  constructor(status, message, extra) { super(message); this.status = status; this.extra = extra; }
}
const fail = (status, message, extra) => { throw new HttpError(status, message, extra); };

const parse = (s, d = {}) => { try { return s ? JSON.parse(s) : d; } catch { return d; } };
const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const int = (v) => (Number.isInteger(Number(v)) ? Number(v) : NaN);

function mergeSettings(raw) {
  const s = { ...DEFAULT_SETTINGS, ...raw };
  s.stages = { ...DEFAULT_SETTINGS.stages, ...(raw?.stages || {}) };
  s.activeTopics = Array.isArray(s.activeTopics) ? s.activeTopics.filter((id) => topicById(id)).map(Number) : [];
  return s;
}

export function createApi({ db, sec, options = {} }) {
  const attempts = new Map(); // 로그인 시도 제한(메모리)

  function init() {
    db.exec(SCHEMA);
  }

  // ───────────── 공통 도우미 ─────────────
  function limit(key, max = 8, windowMs = 5 * 60000) {
    const t = Date.now();
    const list = (attempts.get(key) || []).filter((x) => t - x < windowMs);
    if (list.length >= max) fail(429, '입력을 여러 번 틀렸어요. 5분 뒤에 다시 시도하거나 선생님께 도움을 요청하세요.');
    list.push(t); attempts.set(key, list);
  }
  const clearLimit = (key) => attempts.delete(key);

  async function newSession(role, userId, classId, days) {
    const token = sec.token();
    const h = await sec.sha256(token);
    db.run('INSERT INTO sessions(token_hash, role, user_id, class_id, expires_at) VALUES (?,?,?,?,?)',
      [h, role, userId, classId ?? null, Date.now() + days * DAY]);
    db.run('DELETE FROM sessions WHERE expires_at < ?', [Date.now()]);
    return token;
  }

  async function auth(token) {
    if (!token || typeof token !== 'string' || token.length > 200) return null;
    const h = await sec.sha256(token);
    const s = db.get('SELECT * FROM sessions WHERE token_hash = ?', [h]);
    if (!s || s.expires_at < Date.now()) return null;
    if (s.role === 'teacher') {
      const t = db.get('SELECT id, username, name FROM teachers WHERE id = ?', [s.user_id]);
      return t ? { role: 'teacher', teacher: t, tokenHash: h } : null;
    }
    const st = db.get('SELECT id, class_id, number, name, nickname, weather_override FROM students WHERE id = ? AND class_id = ?', [s.user_id, s.class_id]);
    if (!st) return null;
    const cls = db.get('SELECT * FROM classes WHERE id = ?', [st.class_id]);
    if (!cls) return null;
    return { role: 'student', student: st, cls: { ...cls, settings: mergeSettings(parse(cls.settings)) }, tokenHash: h };
  }

  function genCode() {
    for (let k = 0; k < 50; k++) {
      let c = '';
      for (let i = 0; i < 6; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
      if (!db.get('SELECT id FROM classes WHERE code = ?', [c])) return c;
    }
    fail(500, '학급 코드를 만들지 못했어요.');
  }
  function genPin() { return String(Math.floor(Math.random() * 10000)).padStart(4, '0'); }

  function teacherClass(teacher, classId) {
    const c = db.get('SELECT * FROM classes WHERE id = ? AND teacher_id = ?', [int(classId), teacher.id]);
    if (!c) fail(404, '학급을 찾을 수 없어요.');
    return { ...c, settings: mergeSettings(parse(c.settings)) };
  }
  function teacherStudent(teacher, studentId) {
    const s = db.get(`SELECT s.* FROM students s JOIN classes c ON c.id = s.class_id WHERE s.id = ? AND c.teacher_id = ?`, [int(studentId), teacher.id]);
    if (!s) fail(404, '학생을 찾을 수 없어요.');
    return s;
  }

  function months(settings) {
    const out = [];
    for (let m = settings.monthFrom; m <= settings.monthTo; m++) out.push(m);
    return out;
  }

  function getState(studentId) {
    const r = db.get('SELECT state FROM student_state WHERE student_id = ?', [studentId]);
    return parse(r?.state);
  }
  function putState(studentId, classId, state) {
    db.run(`INSERT INTO student_state(student_id, class_id, state, updated_at) VALUES (?,?,?,?)
      ON CONFLICT(student_id) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at`,
    [studentId, classId, JSON.stringify(state), now()]);
  }

  // 학급 집계: 미응답은 0으로 보지 않고, 응답한 학생 수를 함께 돌려줍니다.
  function aggregate(classId, topic, settings) {
    const ms = months(settings);
    const rows = db.all('SELECT month, status, value FROM responses WHERE class_id = ? AND topic_id = ?', [classId, topic.id]);
    const useAvg = topic.agg === 'avg' || (topic.private && settings.savingsMode === 'average');
    return ms.map((m) => {
      const r = rows.filter((x) => x.month === m);
      const vals = r.filter((x) => x.status === 'value').map((x) => Number(x.value));
      const sum = vals.reduce((a, b) => a + b, 0);
      const avg = vals.length ? round1(sum / vals.length) : null;
      return {
        month: m,
        responders: vals.length,
        unknown: r.filter((x) => x.status === 'unknown').length,
        sum: round1(sum),
        avg,
        value: vals.length ? (useAvg ? avg : round1(sum)) : null,
      };
    });
  }
  const aggMode = (topic, settings) => (topic.agg === 'avg' || (topic.private && settings.savingsMode === 'average') ? 'avg' : 'sum');

  function displayName(st, settings) {
    if (settings.displayName === 'number') return `${st.number}번 연구원`;
    if (settings.displayName === 'nickname') return st.nickname || `${st.number}번 연구원`;
    return st.name;
  }

  function weatherDone(student, state) { return !!(state.weatherDone || student.weather_override); }

  function gates(student, cls, state) {
    const s = cls.settings;
    const wd = weatherDone(student, state);
    const research = state.research?.topicId && s.activeTopics.includes(Number(state.research.topicId)) ? Number(state.research.topicId) : null;
    const submitted = db.all('SELECT topic_id FROM submissions WHERE student_id = ?', [student.id]).map((r) => r.topic_id);
    const tableOk = research ? !!state.tables?.[research]?.verified : false;
    const lock = (open, ok, why) => (!open ? '선생님이 아직 열지 않은 단계예요.' : !ok ? why : null);
    return {
      weatherDone: wd,
      research,
      submittedTopics: submitted,
      weather: lock(s.stages.weather, true, null),
      topics: lock(s.stages.topics, wd, '기상자료 탐험실을 먼저 완료해야 들어갈 수 있어요.'),
      table: lock(s.stages.table, wd && research && submitted.includes(research), !wd ? '기상자료 탐험실을 먼저 완료해야 해요.' : '연구 주제를 고르고 그 주제의 월별 조사를 제출해야 해요.'),
      graph: lock(s.stages.graph, wd && tableOk, !wd ? '기상자료 탐험실을 먼저 완료해야 해요.' : '자료표 만들기를 먼저 완성해야 해요.'),
      gallery: lock(s.stages.gallery, true, null),
    };
  }
  function requireGate(ctx, key) {
    const state = getState(ctx.student.id);
    const g = gates(ctx.student, ctx.cls, state);
    if (g[key]) fail(403, g[key]);
    return { state, g };
  }

  // ───────────── 그래프 작품 검증 ─────────────
  function workTarget(ctx, kind, state) {
    const s = ctx.cls.settings;
    if (kind === 'weather') {
      const w = state.weather || {};
      if (!w.tableChecked) fail(400, '기상자료 표를 먼저 완성해 주세요.');
      return { labels: w.years.map((y) => `${y}년`), values: w.values.map(Number), xUnit: '년', yUnit: '일', topicId: null };
    }
    const topicId = state.research?.topicId;
    const topic = topicById(topicId);
    if (!topic) fail(400, '연구 주제를 먼저 골라 주세요.');
    const t = state.tables?.[topic.id];
    if (!t?.verified) fail(400, '자료표를 먼저 완성해 주세요.');
    const agg = aggregate(ctx.cls.id, topic, s);
    return { labels: agg.map((a) => `${a.month}월`), values: agg.map((a) => a.value), xUnit: '월', yUnit: topic.unit, topicId: topic.id, topic };
  }

  function sanitizeWork(data, n) {
    const d = data && typeof data === 'object' ? data : {};
    const points = {};
    if (d.points && typeof d.points === 'object') {
      for (const [k, v] of Object.entries(d.points)) {
        const i = int(k);
        if (i >= 0 && i < n && Number.isFinite(Number(v))) points[i] = Math.round(Number(v) * 100) / 100;
      }
    }
    const segs = [];
    if (Array.isArray(d.segments)) {
      for (const s of d.segments.slice(0, 60)) {
        if (Array.isArray(s) && s.length === 2) {
          const a = int(s[0]); const b = int(s[1]);
          if (a >= 0 && b >= 0 && a < n && b < n && a !== b) {
            const key = [Math.min(a, b), Math.max(a, b)];
            if (!segs.some((x) => x[0] === key[0] && x[1] === key[1])) segs.push(key);
          }
        }
      }
    }
    const interp = d.interp && typeof d.interp === 'object' ? d.interp : {};
    return {
      title: str(d.title, 60),
      xName: str(d.xName, 20), xUnit: str(d.xUnit, 10),
      yName: str(d.yName, 20), yUnit: str(d.yUnit, 10),
      scale: SCALE_OPTIONS.includes(Number(d.scale)) ? Number(d.scale) : null,
      yStart: Number.isFinite(Number(d.yStart)) && Number(d.yStart) >= 0 ? Number(d.yStart) : 0,
      points, segments: segs,
      interp: {
        maxLabel: str(interp.maxLabel, 20), minLabel: str(interp.minLabel, 20),
        changeLabel: str(interp.changeLabel, 30), sentence: str(interp.sentence, 600),
      },
      zoom: Number.isFinite(Number(d.zoom)) ? Math.min(3, Math.max(0.6, Number(d.zoom))) : 1,
    };
  }

  function checkWork(data, target) {
    const issues = [];
    const { labels, values } = target;
    const n = labels.length;
    if (!data.title) issues.push({ step: 'title', msg: '그래프 제목을 적어 주세요.' });
    if (!data.xName) issues.push({ step: 'axis', msg: '가로축 이름을 적어 주세요.' });
    if (!data.yName) issues.push({ step: 'axis', msg: '세로축 이름을 적어 주세요.' });
    if (data.xUnit !== target.xUnit) issues.push({ step: 'axis', msg: `가로축 단위를 다시 생각해 보세요. 가로에는 무엇이 놓여 있나요?` });
    if (data.yUnit !== target.yUnit) issues.push({ step: 'axis', msg: `세로축 단위가 조사한 자료의 단위와 같은지 확인해 보세요.` });
    const finite = values.filter((v) => v !== null);
    const maxV = finite.length ? Math.max(...finite) : 0;
    if (!data.scale) issues.push({ step: 'scale', msg: '세로 눈금 한 칸의 크기를 정해 주세요.' });
    else {
      const cells = Math.ceil((maxV - data.yStart) / data.scale);
      if (cells > 40) issues.push({ step: 'scale', msg: '눈금 한 칸의 크기가 너무 작아 칸이 너무 많아요. 더 큰 크기를 골라 보세요.' });
      if (data.yStart > 0 && finite.some((v) => v < data.yStart)) issues.push({ step: 'scale', msg: '물결선 위 시작 값이 가장 작은 값보다 커요. 시작 값을 낮춰 주세요.' });
    }
    const tol = data.scale ? snapStep(data.scale) / 2 + 1e-6 : 0.5;
    const wrong = [];
    const missing = [];
    for (let i = 0; i < n; i++) {
      if (values[i] === null) continue;
      if (data.points[i] === undefined) missing.push(labels[i]);
      else if (Math.abs(Number(data.points[i]) - Number(values[i])) > tol) wrong.push(labels[i]);
    }
    if (missing.length) issues.push({ step: 'points', msg: `점을 찍지 않은 곳이 있어요: ${missing.join(', ')}` });
    if (wrong.length) issues.push({ step: 'points', msg: `자료값과 위치가 다른 점이 있어요: ${wrong.join(', ')}. 표의 수와 세로 눈금을 다시 읽어 보세요.`, labels: wrong });
    const need = [];
    const present = [];
    for (let i = 0; i < n; i++) if (values[i] !== null) present.push(i);
    for (let k = 1; k < present.length; k++) need.push([present[k - 1], present[k]]);
    const has = (a, b) => data.segments.some((s) => s[0] === a && s[1] === b);
    const missSeg = need.filter(([a, b]) => !has(a, b));
    const extra = data.segments.filter((s) => !need.some(([a, b]) => a === s[0] && b === s[1]));
    if (missSeg.length) issues.push({ step: 'lines', msg: `이어지지 않은 점이 있어요: ${missSeg.map(([a, b]) => `${labels[a]}–${labels[b]}`).join(', ')}` });
    if (extra.length) issues.push({ step: 'lines', msg: `이웃하지 않은 점끼리 이은 선분이 있어요: ${extra.map(([a, b]) => `${labels[a]}–${labels[b]}`).join(', ')}. 점은 순서대로 이웃한 점끼리 이어요.` });
    const st = computeStats(labels, values);
    if (st) {
      if (!data.interp.maxLabel) issues.push({ step: 'interp', msg: '가장 큰 값이 나타난 때를 골라 주세요.' });
      else if (!st.maxLabels.includes(data.interp.maxLabel)) issues.push({ step: 'interp', msg: '가장 큰 값이 나타난 때를 그래프에서 다시 찾아보세요.' });
      if (!data.interp.minLabel) issues.push({ step: 'interp', msg: '가장 작은 값이 나타난 때를 골라 주세요.' });
      else if (!st.minLabels.includes(data.interp.minLabel)) issues.push({ step: 'interp', msg: '가장 작은 값이 나타난 때를 그래프에서 다시 찾아보세요.' });
      if (!data.interp.changeLabel) issues.push({ step: 'interp', msg: '변화가 가장 큰 시기를 골라 주세요.' });
      else if (!st.changeLabels.includes(data.interp.changeLabel)) issues.push({ step: 'interp', msg: '선분이 가장 많이 기울어진 곳을 다시 찾아보세요.' });
    }
    if ((data.interp.sentence || '').length < 10) issues.push({ step: 'interp', msg: '그래프에서 알 수 있는 내용을 10자 이상 써 주세요.' });
    return issues;
  }

  function workRow(studentId, kind) {
    return db.get('SELECT * FROM works WHERE student_id = ? AND kind = ?', [studentId, kind]);
  }
  function publicWork(w) {
    if (!w) return null;
    return { id: w.id, kind: w.kind, topicId: w.topic_id, data: parse(w.data), status: w.status, feedback: w.feedback, updatedAt: w.updated_at, submittedAt: w.submitted_at };
  }

  // ───────────── 라우트 ─────────────
  const routes = [];
  const route = (method, pattern, role, fn) => {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
    routes.push({ method, re, keys, role, fn });
  };

  // ── 인증 ──
  route('POST', '/api/teacher/signup', null, async ({ body }) => {
    if (options.signupCode && str(body.signupCode) !== options.signupCode) fail(403, '교사 가입 코드가 맞지 않아요.');
    const username = str(body.username, 40).toLowerCase();
    const name = str(body.name, 40);
    const password = typeof body.password === 'string' ? body.password : '';
    if (!/^[a-z0-9_.-]{3,40}$/.test(username)) fail(400, '아이디는 영문 소문자·숫자 3자 이상으로 정해 주세요.');
    if (password.length < 8) fail(400, '비밀번호는 8자 이상으로 정해 주세요.');
    if (!name) fail(400, '선생님 이름을 적어 주세요.');
    if (db.get('SELECT id FROM teachers WHERE username = ?', [username])) fail(409, '이미 사용 중인 아이디예요.');
    const pw = await sec.hash(password);
    const r = db.run('INSERT INTO teachers(username, name, pw_hash, created_at) VALUES (?,?,?,?)', [username, name, pw, now()]);
    const token = await newSession('teacher', Number(r.lastInsertRowid), null, 7);
    return { token, body: { ok: true } };
  });

  route('POST', '/api/teacher/login', null, async ({ body }) => {
    const username = str(body.username, 40).toLowerCase();
    limit('t:' + username);
    const t = db.get('SELECT * FROM teachers WHERE username = ?', [username]);
    if (!t || !(await sec.verify(String(body.password || ''), t.pw_hash))) fail(401, '아이디 또는 비밀번호가 맞지 않아요.');
    clearLimit('t:' + username);
    const token = await newSession('teacher', t.id, null, 7);
    return { token, body: { ok: true } };
  });

  route('POST', '/api/student/login', null, async ({ body }) => {
    const code = str(body.classCode, 10).toUpperCase().replace(/\s/g, '');
    const number = int(body.number);
    const key = `s:${code}:${number}`;
    limit(key, 6);
    const cls = db.get('SELECT * FROM classes WHERE code = ?', [code]);
    if (!cls) fail(401, '학급 코드, 번호, 비밀번호(PIN)를 다시 확인해 주세요.');
    const st = db.get('SELECT * FROM students WHERE class_id = ? AND number = ?', [cls.id, number]);
    if (!st || !(await sec.verify(String(body.pin || ''), st.pin_hash))) fail(401, '학급 코드, 번호, 비밀번호(PIN)를 다시 확인해 주세요.');
    clearLimit(key);
    const token = await newSession('student', st.id, cls.id, 30);
    return { token, body: { ok: true } };
  });

  route('POST', '/api/logout', 'any', async ({ ctx }) => {
    db.run('DELETE FROM sessions WHERE token_hash = ?', [ctx.tokenHash]);
    return { clearToken: true, body: { ok: true } };
  });

  route('GET', '/api/me', null, async ({ ctx }) => {
    if (!ctx) return { body: { role: null } };
    if (ctx.role === 'teacher') return { body: { role: 'teacher', teacher: ctx.teacher } };
    return { body: { role: 'student', student: { id: ctx.student.id, number: ctx.student.number, name: ctx.student.name }, className: ctx.cls.name } };
  });

  route('POST', '/api/teacher/password', 'teacher', async ({ ctx, body }) => {
    const t = db.get('SELECT * FROM teachers WHERE id = ?', [ctx.teacher.id]);
    if (!(await sec.verify(String(body.current || ''), t.pw_hash))) fail(400, '현재 비밀번호가 맞지 않아요.');
    if (typeof body.next !== 'string' || body.next.length < 8) fail(400, '새 비밀번호는 8자 이상이어야 해요.');
    db.run('UPDATE teachers SET pw_hash = ? WHERE id = ?', [await sec.hash(body.next), t.id]);
    db.run("DELETE FROM sessions WHERE role = 'teacher' AND user_id = ? AND token_hash <> ?", [t.id, ctx.tokenHash]);
    return { body: { ok: true } };
  });

  // ── 학생 ──
  route('GET', '/api/student/state', 'student', async ({ ctx }) => {
    const { student, cls } = ctx;
    const s = cls.settings;
    const state = getState(student.id);
    const g = gates(student, cls, state);
    const vote = db.get('SELECT topic_id FROM votes WHERE student_id = ?', [student.id]);
    const responses = db.all('SELECT topic_id, month, status, value, source FROM responses WHERE student_id = ?', [student.id]);
    const works = db.all('SELECT * FROM works WHERE student_id = ?', [student.id]).map(publicWork);
    return {
      body: {
        student: { id: student.id, number: student.number, name: student.name, nickname: student.nickname, weatherOverride: !!student.weather_override },
        cls: {
          name: cls.name, isDemo: !!cls.is_demo,
          settings: {
            stages: s.stages, voteOpen: s.voteOpen, surveyOpen: s.surveyOpen, allowEdit: s.allowEdit,
            activeTopics: s.activeTopics, monthFrom: s.monthFrom, monthTo: s.monthTo,
            savingsMode: s.savingsMode, tableRefMode: s.tableRefMode, tableRefVisible: s.tableRefVisible,
            kmaUrl: s.kmaUrl, kmaGuide: s.kmaGuide, notice: s.notice, displayName: s.displayName,
          },
        },
        state, gates: g, vote: vote?.topic_id ?? null, responses, works,
      },
    };
  });

  // 학생이 저장할 수 있는 상태(검증 표시는 서버만 설정)
  route('PUT', '/api/student/state', 'student', async ({ ctx, body }) => {
    const state = getState(ctx.student.id);
    const p = body || {};
    if (p.weather && typeof p.weather === 'object') {
      const w = state.weather || {};
      const years = Array.isArray(p.weather.years) ? p.weather.years.slice(0, 5).map((y) => (y === '' || y === null ? '' : int(y))) : w.years;
      const values = Array.isArray(p.weather.values) ? p.weather.values.slice(0, 5).map((v) => (v === '' || v === null ? '' : Number(v))) : w.values;
      const changed = JSON.stringify(years) !== JSON.stringify(w.years) || JSON.stringify(values) !== JSON.stringify(w.values);
      if (state.weatherDone && changed) fail(409, '기상자료 탐험을 이미 완료했어요. 고치려면 선생님께 요청하세요.');
      state.weather = {
        ...w,
        region: p.weather.region !== undefined ? str(p.weather.region, 40) : w.region,
        station: p.weather.station !== undefined ? str(p.weather.station, 40) : w.station,
        source: p.weather.source !== undefined ? str(p.weather.source, 80) : w.source,
        visited: p.weather.visited !== undefined ? !!p.weather.visited : w.visited,
        years, values,
        tableChecked: changed ? false : !!w.tableChecked,
      };
    }
    if (p.research && p.research.topicId !== undefined) {
      const tid = int(p.research.topicId);
      if (!ctx.cls.settings.activeTopics.includes(tid)) fail(400, '선생님이 연 조사 주제 중에서 골라 주세요.');
      const t = topicById(tid);
      if (t.private && ctx.cls.settings.savingsMode === 'hidden') fail(400, '이 주제는 선생님이 결과를 공개하지 않아 연구 주제로 고를 수 없어요.');
      const work = workRow(ctx.student.id, 'topic');
      if (work && ['submitted', 'approved'].includes(work.status) && work.topic_id !== tid) fail(409, '이미 제출한 작품이 있어요. 주제를 바꾸려면 선생님께 요청하세요.');
      state.research = { topicId: tid };
    }
    if (p.tableDraft && typeof p.tableDraft === 'object') {
      const tid = int(p.tableDraft.topicId);
      if (topicById(tid) && Array.isArray(p.tableDraft.values)) {
        state.tables = state.tables || {};
        const prev = state.tables[tid] || {};
        const vals = p.tableDraft.values.slice(0, 12).map((v) => (v === '' || v === null ? '' : Number(v)));
        state.tables[tid] = { ...prev, values: vals, verified: prev.verified && JSON.stringify(prev.values) === JSON.stringify(vals) };
      }
    }
    if (p.ui && typeof p.ui === 'object') state.ui = { chapter: str(p.ui.chapter, 20), spread: int(p.ui.spread) || 0 };
    putState(ctx.student.id, ctx.cls.id, state);
    return { body: { ok: true, state } };
  });

  route('POST', '/api/student/weather/check-table', 'student', async ({ ctx }) => {
    requireGate(ctx, 'weather');
    const state = getState(ctx.student.id);
    const w = state.weather || {};
    const issues = [];
    if (!w.region) issues.push('조사한 지역을 적어 주세요.');
    if (!w.source) issues.push('자료 출처를 적어 주세요.');
    const years = w.years || []; const values = w.values || [];
    const thisYear = new Date().getFullYear();
    if (years.length !== 5 || years.some((y) => !Number.isInteger(y))) issues.push('연도 5개를 모두 적어 주세요.');
    else {
      if (years.some((y) => y < 1973 || y > thisYear)) issues.push(`연도는 1973년부터 ${thisYear}년 사이로 적어 주세요.`);
      if (new Set(years).size !== 5) issues.push('같은 연도가 두 번 적혀 있어요.');
      for (let i = 1; i < 5; i++) if (years[i] <= years[i - 1]) { issues.push('연도는 왼쪽부터 차례대로(작은 연도부터) 적어 주세요.'); break; }
    }
    if (values.length !== 5 || values.some((v) => v === '' || !Number.isInteger(Number(v)))) issues.push('폭염일수 5개를 모두 자연수(또는 0)로 적어 주세요.');
    else if (values.some((v) => v < 0 || v > 366)) issues.push('폭염일수는 0일부터 366일 사이여야 해요. 다시 확인해 보세요.');
    if (issues.length) return { body: { ok: false, issues } };
    state.weather.tableChecked = true;
    putState(ctx.student.id, ctx.cls.id, state);
    return { body: { ok: true, state } };
  });

  route('POST', '/api/student/vote', 'student', async ({ ctx, body }) => {
    requireGate(ctx, 'topics');
    if (!ctx.cls.settings.voteOpen) fail(403, '지금은 주제 추천 투표 기간이 아니에요.');
    const tid = int(body.topicId);
    if (!topicById(tid)) fail(400, '주제를 다시 골라 주세요.');
    db.run(`INSERT INTO votes(class_id, student_id, topic_id, updated_at) VALUES (?,?,?,?)
      ON CONFLICT(class_id, student_id) DO UPDATE SET topic_id = excluded.topic_id, updated_at = excluded.updated_at`,
    [ctx.cls.id, ctx.student.id, tid, now()]);
    return { body: { ok: true, vote: tid } };
  });

  route('GET', '/api/student/votes', 'student', async ({ ctx }) => {
    requireGate(ctx, 'topics');
    const rows = db.all('SELECT topic_id, COUNT(*) AS n FROM votes WHERE class_id = ? GROUP BY topic_id', [ctx.cls.id]);
    const total = db.get('SELECT COUNT(*) AS n FROM students WHERE class_id = ?', [ctx.cls.id]).n;
    return { body: { counts: Object.fromEntries(rows.map((r) => [r.topic_id, r.n])), total } };
  });

  route('PUT', '/api/student/responses', 'student', async ({ ctx, body }) => {
    requireGate(ctx, 'topics');
    const s = ctx.cls.settings;
    if (!s.surveyOpen) fail(403, '지금은 월별 조사 기간이 아니에요.');
    const topic = topicById(body.topicId);
    if (!topic || !s.activeTopics.includes(topic.id)) fail(400, '선생님이 연 조사 주제가 아니에요.');
    const already = db.get('SELECT 1 AS x FROM submissions WHERE student_id = ? AND topic_id = ?', [ctx.student.id, topic.id]);
    if (already && !s.allowEdit) fail(403, '이미 제출했어요. 지금은 수정할 수 없어요.');
    const ms = months(s);
    const entries = Array.isArray(body.entries) ? body.entries : [];
    const errors = {};
    const clean = [];
    for (const m of ms) {
      const e = entries.find((x) => int(x.month) === m) || { status: 'blank' };
      if (e.status === 'unknown') clean.push({ m, status: 'unknown', value: null, source: 'memory' });
      else if (e.status === 'value') {
        const err = validateEntry(topic, m, e.value);
        if (err) errors[m] = err;
        clean.push({ m, status: 'value', value: Number(e.value), source: e.source === 'record' ? 'record' : 'memory' });
      } else errors[m] = '숫자를 적거나 ‘기억나지 않음’을 골라 주세요.';
    }
    if (Object.keys(errors).length) return { status: 400, body: { error: '확인이 필요한 칸이 있어요.', errors } };
    db.tx(() => {
      db.run('DELETE FROM responses WHERE student_id = ? AND topic_id = ?', [ctx.student.id, topic.id]);
      const t = now();
      for (const c of clean) {
        db.run('INSERT INTO responses(class_id, student_id, topic_id, month, status, value, source, updated_at) VALUES (?,?,?,?,?,?,?,?)',
          [ctx.cls.id, ctx.student.id, topic.id, c.m, c.status, c.value, c.source, t]);
      }
      db.run(`INSERT INTO submissions(class_id, student_id, topic_id, submitted_at) VALUES (?,?,?,?)
        ON CONFLICT(student_id, topic_id) DO UPDATE SET submitted_at = excluded.submitted_at`, [ctx.cls.id, ctx.student.id, topic.id, t]);
    });
    return { body: { ok: true } };
  });

  // 자료표 만들기 참고 자료: 학생 이름 없이, 저축 금액은 집계만
  route('GET', '/api/student/table-ref', 'student', async ({ ctx, query }) => {
    requireGate(ctx, 'table');
    const s = ctx.cls.settings;
    const topic = topicById(query.topicId);
    if (!topic || !s.activeTopics.includes(topic.id)) fail(400, '조사 주제를 다시 골라 주세요.');
    if (!s.tableRefVisible) return { body: { visible: false } };
    const agg = aggregate(ctx.cls.id, topic, s);
    const mode = aggMode(topic, s);
    const showList = s.tableRefMode === 'list' && !topic.private && mode === 'sum';
    const out = agg.map((a) => {
      const row = { month: a.month, responders: a.responders, unknown: a.unknown };
      if (showList) {
        row.values = db.all("SELECT value FROM responses WHERE class_id = ? AND topic_id = ? AND month = ? AND status = 'value' ORDER BY value", [ctx.cls.id, topic.id, a.month]).map((r) => Number(r.value));
      } else row.value = a.value;
      return row;
    });
    const students = db.get('SELECT COUNT(*) AS n FROM students WHERE class_id = ?', [ctx.cls.id]).n;
    return { body: { visible: true, mode, list: showList, rows: out, students } };
  });

  route('POST', '/api/student/table-check', 'student', async ({ ctx, body }) => {
    requireGate(ctx, 'table');
    const s = ctx.cls.settings;
    const topic = topicById(body.topicId);
    if (!topic || !s.activeTopics.includes(topic.id)) fail(400, '조사 주제를 다시 골라 주세요.');
    const agg = aggregate(ctx.cls.id, topic, s);
    const vals = Array.isArray(body.values) ? body.values : [];
    const result = agg.map((a, i) => {
      const v = vals[i];
      if (a.value === null) return { month: a.month, ok: v === '' || v === null || v === undefined, empty: true };
      if (v === '' || v === null || v === undefined) return { month: a.month, ok: false, blank: true };
      return { month: a.month, ok: Math.abs(Number(v) - a.value) < 0.051 };
    });
    const ok = result.every((r) => r.ok);
    const state = getState(ctx.student.id);
    state.tables = state.tables || {};
    state.tables[topic.id] = { values: vals.slice(0, 12).map((v) => (v === '' || v === null ? '' : Number(v))), verified: ok, checkedAt: now() };
    putState(ctx.student.id, ctx.cls.id, state);
    return { body: { ok, result } };
  });

  route('PUT', '/api/student/work', 'student', async ({ ctx, body }) => {
    const kind = body.kind === 'weather' ? 'weather' : 'topic';
    const { state } = requireGate(ctx, kind === 'weather' ? 'weather' : 'graph');
    const target = workTarget(ctx, kind, state);
    const existing = workRow(ctx.student.id, kind);
    const data = sanitizeWork(body.data, target.labels.length);
    const prev = existing ? parse(existing.data) : {};
    data.checked = false;
    data.labels = target.labels;
    data.values = target.values;
    const sig = (x) => JSON.stringify(['title', 'xName', 'xUnit', 'yName', 'yUnit', 'scale', 'yStart', 'points', 'segments', 'interp', 'labels', 'values'].map((k) => x?.[k] ?? null));
    const same = !!prev.checked && sig(prev) === sig(data);
    if (same) { data.checked = true; data.checkedAt = prev.checkedAt; }
    let status = existing?.status || 'draft';
    if (!same && ['submitted', 'approved', 'rejected'].includes(status)) {
      if (kind === 'weather' && state.weatherDone) fail(409, '기상자료 탐험을 이미 완료했어요.');
      status = 'draft';
    }
    if (existing) {
      db.run('UPDATE works SET data = ?, status = ?, topic_id = ?, updated_at = ? WHERE id = ?', [JSON.stringify(data), status, target.topicId, now(), existing.id]);
    } else {
      db.run('INSERT INTO works(class_id, student_id, kind, topic_id, data, status, updated_at) VALUES (?,?,?,?,?,?,?)',
        [ctx.cls.id, ctx.student.id, kind, target.topicId, JSON.stringify(data), status, now()]);
    }
    return { body: { ok: true, work: publicWork(workRow(ctx.student.id, kind)) } };
  });

  route('POST', '/api/student/work/check', 'student', async ({ ctx, body }) => {
    const kind = body.kind === 'weather' ? 'weather' : 'topic';
    const { state } = requireGate(ctx, kind === 'weather' ? 'weather' : 'graph');
    const target = workTarget(ctx, kind, state);
    const w = workRow(ctx.student.id, kind);
    if (!w) fail(400, '먼저 그래프를 그려 주세요.');
    const data = parse(w.data);
    const issues = checkWork(data, target);
    data.labels = target.labels; data.values = target.values;
    data.checked = issues.length === 0;
    data.checkedAt = data.checked ? now() : null;
    db.run('UPDATE works SET data = ?, updated_at = ? WHERE id = ?', [JSON.stringify(data), now(), w.id]);
    return { body: { ok: issues.length === 0, issues, answer: issues.length === 0 ? { labels: target.labels, values: target.values } : null, work: publicWork(workRow(ctx.student.id, kind)) } };
  });

  route('POST', '/api/student/work/submit', 'student', async ({ ctx, body }) => {
    const kind = body.kind === 'weather' ? 'weather' : 'topic';
    const { state } = requireGate(ctx, kind === 'weather' ? 'weather' : 'graph');
    const w = workRow(ctx.student.id, kind);
    const data = parse(w?.data);
    if (!w || !data.checked) fail(400, '[확인하기]를 통과한 뒤에 제출할 수 있어요.');
    if (['submitted', 'approved'].includes(w.status)) return { body: { ok: true, work: publicWork(w) } };
    db.run("UPDATE works SET status = 'submitted', feedback = '', submitted_at = ?, updated_at = ? WHERE id = ?", [now(), now(), w.id]);
    if (kind === 'weather') {
      state.weatherDone = true;
      putState(ctx.student.id, ctx.cls.id, state);
    }
    return { body: { ok: true, work: publicWork(workRow(ctx.student.id, kind)) } };
  });

  route('GET', '/api/gallery', 'any', async ({ ctx, query }) => {
    let classId; let settings;
    if (ctx.role === 'student') {
      requireGate(ctx, 'gallery');
      classId = ctx.cls.id; settings = ctx.cls.settings;
    } else {
      const c = teacherClass(ctx.teacher, query.classId);
      classId = c.id; settings = c.settings;
    }
    const rows = db.all(`SELECT w.*, s.number, s.name, s.nickname FROM works w JOIN students s ON s.id = w.student_id
      WHERE w.class_id = ? AND w.status = 'approved' ORDER BY w.kind DESC, s.number`, [classId]);
    const items = rows.map((r) => {
      const d = parse(r.data);
      const topic = topicById(r.topic_id);
      return {
        id: r.id, kind: r.kind, topicId: r.topic_id,
        topicName: r.kind === 'weather' ? '연도별 폭염일수' : topic?.name,
        author: displayName(r, settings),
        mine: ctx.role === 'student' && r.student_id === ctx.student.id,
        data: {
          title: d.title, xName: d.xName, xUnit: d.xUnit, yName: d.yName, yUnit: d.yUnit, scale: d.scale, yStart: d.yStart,
          labels: d.labels, values: d.values, points: d.points, segments: d.segments, interp: { sentence: d.interp?.sentence || '' },
        },
        stats: computeStats(d.labels || [], d.values || []),
      };
    });
    return { body: { items } };
  });

  // ── 교사 ──
  route('GET', '/api/teacher/classes', 'teacher', async ({ ctx }) => {
    const rows = db.all(`SELECT c.*, (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id) AS students,
      (SELECT COUNT(*) FROM works w WHERE w.class_id = c.id AND w.status = 'submitted') AS pending
      FROM classes c WHERE c.teacher_id = ? ORDER BY c.id`, [ctx.teacher.id]);
    return { body: { classes: rows.map((c) => ({ id: c.id, name: c.name, code: c.code, students: c.students, pending: c.pending, isDemo: !!c.is_demo, settings: mergeSettings(parse(c.settings)) })) } };
  });

  route('POST', '/api/teacher/classes', 'teacher', async ({ ctx, body }) => {
    const name = str(body.name, 40);
    if (!name) fail(400, '학급 이름을 적어 주세요.');
    const code = genCode();
    const r = db.run('INSERT INTO classes(teacher_id, name, code, settings, created_at) VALUES (?,?,?,?,?)', [ctx.teacher.id, name, code, JSON.stringify(DEFAULT_SETTINGS), now()]);
    return { body: { id: Number(r.lastInsertRowid), code } };
  });

  route('PUT', '/api/teacher/classes/:id', 'teacher', async ({ ctx, params, body }) => {
    const c = teacherClass(ctx.teacher, params.id);
    const s = c.settings;
    const p = body.settings || {};
    if (body.name !== undefined) {
      const name = str(body.name, 40);
      if (!name) fail(400, '학급 이름을 적어 주세요.');
      db.run('UPDATE classes SET name = ? WHERE id = ?', [name, c.id]);
    }
    if (p.stages) for (const k of Object.keys(DEFAULT_SETTINGS.stages)) if (p.stages[k] !== undefined) s.stages[k] = !!p.stages[k];
    for (const k of ['voteOpen', 'surveyOpen', 'allowEdit', 'tableRefVisible']) if (p[k] !== undefined) s[k] = !!p[k];
    if (p.activeTopics !== undefined) s.activeTopics = (Array.isArray(p.activeTopics) ? p.activeTopics : []).map(Number).filter((id) => topicById(id));
    if (p.monthFrom !== undefined || p.monthTo !== undefined) {
      const f = int(p.monthFrom ?? s.monthFrom); const t = int(p.monthTo ?? s.monthTo);
      if (!(f >= 1 && t <= 12 && f < t)) fail(400, '조사 기간을 다시 확인해 주세요.');
      s.monthFrom = f; s.monthTo = t;
    }
    if (['name', 'number', 'nickname'].includes(p.displayName)) s.displayName = p.displayName;
    if (['total', 'average', 'hidden'].includes(p.savingsMode)) s.savingsMode = p.savingsMode;
    if (['list', 'total'].includes(p.tableRefMode)) s.tableRefMode = p.tableRefMode;
    if (p.kmaUrl !== undefined) { const u = str(p.kmaUrl, 300); if (u && !/^https?:\/\//.test(u)) fail(400, '주소는 http:// 또는 https://로 시작해야 해요.'); s.kmaUrl = u || DEFAULT_SETTINGS.kmaUrl; }
    if (p.kmaGuide !== undefined) s.kmaGuide = str(p.kmaGuide, 2000) || DEFAULT_KMA_GUIDE;
    if (p.notice !== undefined) s.notice = str(p.notice, 300);
    db.run('UPDATE classes SET settings = ? WHERE id = ?', [JSON.stringify(s), c.id]);
    return { body: { ok: true, settings: s } };
  });

  route('DELETE', '/api/teacher/classes/:id', 'teacher', async ({ ctx, params }) => {
    const c = teacherClass(ctx.teacher, params.id);
    db.tx(() => {
      db.run('DELETE FROM sessions WHERE class_id = ?', [c.id]);
      db.run('DELETE FROM classes WHERE id = ?', [c.id]);
    });
    return { body: { ok: true } };
  });

  route('POST', '/api/teacher/classes/:id/code', 'teacher', async ({ ctx, params }) => {
    const c = teacherClass(ctx.teacher, params.id);
    const code = genCode();
    db.run('UPDATE classes SET code = ? WHERE id = ?', [code, c.id]);
    return { body: { code } };
  });

  route('GET', '/api/teacher/classes/:id/students', 'teacher', async ({ ctx, params }) => {
    const c = teacherClass(ctx.teacher, params.id);
    const rows = db.all('SELECT id, number, name, nickname, weather_override FROM students WHERE class_id = ? ORDER BY number', [c.id]);
    return { body: { students: rows.map((r) => ({ ...r, weatherOverride: !!r.weather_override })) } };
  });

  route('POST', '/api/teacher/classes/:id/students', 'teacher', async ({ ctx, params, body }) => {
    const c = teacherClass(ctx.teacher, params.id);
    const list = Array.isArray(body.students) ? body.students.slice(0, 60) : [];
    const count = db.get('SELECT COUNT(*) AS n FROM students WHERE class_id = ?', [c.id]).n;
    if (count + list.length > 60) fail(400, '한 학급에는 학생을 60명까지 등록할 수 있어요.');
    const created = [];
    const prepared = [];
    for (const s of list) {
      const number = int(s.number); const name = str(s.name, 30);
      if (!(number >= 1 && number <= 99) || !name) fail(400, `번호와 이름을 확인해 주세요: ${s.number ?? ''} ${s.name ?? ''}`);
      if (db.get('SELECT id FROM students WHERE class_id = ? AND number = ?', [c.id, number]) || prepared.some((p) => p.number === number)) fail(409, `${number}번 학생이 이미 있어요.`);
      const pin = genPin();
      prepared.push({ number, name, nickname: str(s.nickname, 20), pin, hash: await sec.hash(pin) });
    }
    db.tx(() => {
      for (const p of prepared) {
        db.run('INSERT INTO students(class_id, number, name, nickname, pin_hash, created_at) VALUES (?,?,?,?,?,?)', [c.id, p.number, p.name, p.nickname, p.hash, now()]);
        created.push({ number: p.number, name: p.name, pin: p.pin });
      }
    });
    return { body: { created } };
  });

  route('PUT', '/api/teacher/students/:sid', 'teacher', async ({ ctx, params, body }) => {
    const st = teacherStudent(ctx.teacher, params.sid);
    const name = body.name !== undefined ? str(body.name, 30) : st.name;
    const nickname = body.nickname !== undefined ? str(body.nickname, 20) : st.nickname;
    const number = body.number !== undefined ? int(body.number) : st.number;
    if (!name || !(number >= 1 && number <= 99)) fail(400, '번호와 이름을 확인해 주세요.');
    if (number !== st.number && db.get('SELECT id FROM students WHERE class_id = ? AND number = ?', [st.class_id, number])) fail(409, `${number}번 학생이 이미 있어요.`);
    const wo = body.weatherOverride !== undefined ? (body.weatherOverride ? 1 : 0) : st.weather_override;
    db.run('UPDATE students SET name = ?, nickname = ?, number = ?, weather_override = ? WHERE id = ?', [name, nickname, number, wo, st.id]);
    if (body.resetWeather) {
      const state = getState(st.id);
      state.weatherDone = false;
      if (state.weather) state.weather.tableChecked = false;
      putState(st.id, st.class_id, state);
      db.run("UPDATE works SET status = 'draft' WHERE student_id = ? AND kind = 'weather'", [st.id]);
    }
    return { body: { ok: true } };
  });

  route('POST', '/api/teacher/students/:sid/pin', 'teacher', async ({ ctx, params }) => {
    const st = teacherStudent(ctx.teacher, params.sid);
    const pin = genPin();
    db.run('UPDATE students SET pin_hash = ? WHERE id = ?', [await sec.hash(pin), st.id]);
    db.run("DELETE FROM sessions WHERE role = 'student' AND user_id = ?", [st.id]);
    return { body: { pin } };
  });

  route('DELETE', '/api/teacher/students/:sid', 'teacher', async ({ ctx, params }) => {
    const st = teacherStudent(ctx.teacher, params.sid);
    db.tx(() => {
      db.run("DELETE FROM sessions WHERE role = 'student' AND user_id = ?", [st.id]);
      db.run('DELETE FROM students WHERE id = ?', [st.id]);
    });
    return { body: { ok: true } };
  });

  route('GET', '/api/teacher/students/:sid', 'teacher', async ({ ctx, params }) => {
    const st = teacherStudent(ctx.teacher, params.sid);
    const state = getState(st.id);
    const responses = db.all('SELECT topic_id, month, status, value, source FROM responses WHERE student_id = ? ORDER BY topic_id, month', [st.id]);
    const works = db.all('SELECT * FROM works WHERE student_id = ?', [st.id]).map(publicWork);
    const vote = db.get('SELECT topic_id FROM votes WHERE student_id = ?', [st.id]);
    return { body: { student: { id: st.id, number: st.number, name: st.name, nickname: st.nickname, weatherOverride: !!st.weather_override }, state, responses, works, vote: vote?.topic_id ?? null } };
  });

  function progressRows(c) {
    const students = db.all('SELECT * FROM students WHERE class_id = ? ORDER BY number', [c.id]);
    return students.map((st) => {
      const state = getState(st.id);
      const vote = db.get('SELECT topic_id FROM votes WHERE student_id = ?', [st.id]);
      const subs = db.all('SELECT topic_id FROM submissions WHERE student_id = ?', [st.id]).map((r) => r.topic_id);
      const wW = workRow(st.id, 'weather'); const wT = workRow(st.id, 'topic');
      const rt = state.research?.topicId ? Number(state.research.topicId) : null;
      const w = state.weather || {};
      return {
        id: st.id, number: st.number, name: st.name,
        weather: weatherDone(st, state) ? (st.weather_override && !state.weatherDone ? '예외 허용' : '완료') : w.tableChecked ? '그래프 중' : (w.years || []).some((y) => y) ? '표 작성 중' : '시작 전',
        weatherDone: weatherDone(st, state),
        vote: vote?.topic_id ?? null,
        surveys: subs,
        research: rt,
        table: rt ? (state.tables?.[rt]?.verified ? '완성' : state.tables?.[rt] ? '작성 중' : '시작 전') : '—',
        graph: wT ? { draft: '그리는 중', submitted: '승인 대기', approved: '승인됨', rejected: '다시 그리기' }[wT.status] + (parse(wT.data).checked && wT.status === 'draft' ? '(확인 통과)' : '') : '시작 전',
        weatherWork: wW?.status || null,
      };
    });
  }

  route('GET', '/api/teacher/classes/:id/progress', 'teacher', async ({ ctx, params }) => {
    const c = teacherClass(ctx.teacher, params.id);
    return { body: { rows: progressRows(c) } };
  });

  route('GET', '/api/teacher/classes/:id/aggregate', 'teacher', async ({ ctx, params }) => {
    const c = teacherClass(ctx.teacher, params.id);
    const votes = db.all('SELECT topic_id, COUNT(*) AS n FROM votes WHERE class_id = ? GROUP BY topic_id', [c.id]);
    const students = db.get('SELECT COUNT(*) AS n FROM students WHERE class_id = ?', [c.id]).n;
    const topics = TOPICS.filter((t) => c.settings.activeTopics.includes(t.id) || db.get('SELECT 1 AS x FROM responses WHERE class_id = ? AND topic_id = ? LIMIT 1', [c.id, t.id]))
      .map((t) => ({
        topicId: t.id, mode: aggMode(t, c.settings), rows: aggregate(c.id, t, c.settings),
        submitted: db.get('SELECT COUNT(*) AS n FROM submissions WHERE class_id = ? AND topic_id = ?', [c.id, t.id]).n,
      }));
    return { body: { students, votes: Object.fromEntries(votes.map((v) => [v.topic_id, v.n])), topics } };
  });

  route('GET', '/api/teacher/classes/:id/works', 'teacher', async ({ ctx, params }) => {
    const c = teacherClass(ctx.teacher, params.id);
    const rows = db.all(`SELECT w.*, s.number, s.name FROM works w JOIN students s ON s.id = w.student_id WHERE w.class_id = ? AND w.status <> 'draft' ORDER BY w.status = 'submitted' DESC, s.number`, [c.id]);
    return {
      body: {
        works: rows.map((r) => {
          const pw = publicWork(r);
          return { ...pw, number: r.number, name: r.name, topicName: r.kind === 'weather' ? '연도별 폭염일수' : topicById(r.topic_id)?.name, stats: computeStats(pw.data.labels || [], pw.data.values || []) };
        }),
      },
    };
  });

  route('POST', '/api/teacher/works/:wid/review', 'teacher', async ({ ctx, params, body }) => {
    const w = db.get('SELECT w.* FROM works w JOIN classes c ON c.id = w.class_id WHERE w.id = ? AND c.teacher_id = ?', [int(params.wid), ctx.teacher.id]);
    if (!w) fail(404, '작품을 찾을 수 없어요.');
    const action = body.action;
    if (action === 'approve') db.run("UPDATE works SET status = 'approved', feedback = ?, updated_at = ? WHERE id = ?", [str(body.feedback, 300), now(), w.id]);
    else if (action === 'reject') {
      db.run("UPDATE works SET status = 'rejected', feedback = ?, updated_at = ? WHERE id = ?", [str(body.feedback, 300) || '다시 확인해 보세요.', now(), w.id]);
    } else if (action === 'unpublish') db.run("UPDATE works SET status = 'submitted', updated_at = ? WHERE id = ?", [now(), w.id]);
    else fail(400, '알 수 없는 처리예요.');
    return { body: { ok: true } };
  });

  route('DELETE', '/api/teacher/works/:wid', 'teacher', async ({ ctx, params }) => {
    const w = db.get('SELECT w.* FROM works w JOIN classes c ON c.id = w.class_id WHERE w.id = ? AND c.teacher_id = ?', [int(params.wid), ctx.teacher.id]);
    if (!w) fail(404, '작품을 찾을 수 없어요.');
    db.run('DELETE FROM works WHERE id = ?', [w.id]);
    return { body: { ok: true } };
  });

  const csvCell = (v) => {
    let s = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@]/.test(s)) s = "'" + s; // 수식 주입 방지
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = (rows) => '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');

  route('GET', '/api/teacher/classes/:id/export', 'teacher', async ({ ctx, params, query }) => {
    const c = teacherClass(ctx.teacher, params.id);
    const type = query.type;
    let rows; let name;
    if (type === 'responses') {
      name = 'responses';
      rows = [['번호', '이름', '주제번호', '주제', '월', '응답', '값', '단위', '근거']];
      const r = db.all('SELECT r.*, s.number, s.name FROM responses r JOIN students s ON s.id = r.student_id WHERE r.class_id = ? ORDER BY r.topic_id, s.number, r.month', [c.id]);
      for (const x of r) {
        const t = topicById(x.topic_id);
        rows.push([x.number, x.name, x.topic_id, t?.name, x.month, x.status === 'value' ? '응답' : '기억나지 않음', x.value, t?.unit, x.source === 'record' ? '실제 기록' : '기억 추정']);
      }
    } else if (type === 'aggregate') {
      name = 'aggregate';
      rows = [['주제번호', '주제', '집계 방법', '월', '학급 값', '합계', '평균', '응답 학생 수', '기억나지 않음']];
      for (const id of c.settings.activeTopics) {
        const t = topicById(id);
        const mode = aggMode(t, c.settings);
        for (const a of aggregate(c.id, t, c.settings)) rows.push([t.id, t.name, mode === 'avg' ? '평균' : '합계', a.month, a.value, a.sum, a.avg, a.responders, a.unknown]);
      }
    } else if (type === 'progress') {
      name = 'progress';
      rows = [['번호', '이름', '기상자료', '투표한 주제', '월별 조사 제출 주제', '연구 주제', '자료표', '그래프']];
      for (const p of progressRows(c)) rows.push([p.number, p.name, p.weather, p.vote ? topicById(p.vote)?.name : '', p.surveys.map((id) => topicById(id)?.name).join(' / '), p.research ? topicById(p.research)?.name : '', p.table, p.graph]);
    } else if (type === 'weather') {
      name = 'weather';
      rows = [['번호', '이름', '지역', '출처', '연도1', '값1', '연도2', '값2', '연도3', '값3', '연도4', '값4', '연도5', '값5', '완료']];
      for (const st of db.all('SELECT * FROM students WHERE class_id = ? ORDER BY number', [c.id])) {
        const s = getState(st.id); const w = s.weather || {};
        const yv = []; for (let i = 0; i < 5; i++) yv.push(w.years?.[i] ?? '', w.values?.[i] ?? '');
        rows.push([st.number, st.name, w.region || '', w.source || '', ...yv, weatherDone(st, s) ? 'O' : '']);
      }
    } else fail(400, '내려받을 자료 종류를 골라 주세요.');
    return { csv: csv(rows), filename: `${c.code}_${name}.csv` };
  });

  // ───────────── 요청 처리 ─────────────
  async function handle({ method, path, query = {}, body = {}, token }) {
    try {
      const ctx = await auth(token);
      for (const r of routes) {
        if (r.method !== method) continue;
        const m = path.match(r.re);
        if (!m) continue;
        const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
        if (r.role === 'any' && !ctx) fail(401, '다시 로그인해 주세요.');
        if (r.role === 'teacher' && ctx?.role !== 'teacher') fail(401, '교사 로그인이 필요해요.');
        if (r.role === 'student' && ctx?.role !== 'student') fail(401, '학생 로그인이 필요해요.');
        const out = await r.fn({ ctx, params, query, body: body || {} });
        return { status: out.status || 200, body: out.body, token: out.token, clearToken: out.clearToken, csv: out.csv, filename: out.filename };
      }
      return { status: 404, body: { error: '없는 주소예요.' } };
    } catch (e) {
      if (e instanceof HttpError) return { status: e.status, body: { error: e.message, ...(e.extra || {}) } };
      console.error(e);
      return { status: 500, body: { error: '서버에서 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요.' } };
    }
  }

  return { init, handle, _internal: { aggregate, getState, putState, months, DEFAULT_SETTINGS } };
}

export { MONTH_DAYS };
