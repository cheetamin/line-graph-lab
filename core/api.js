// 「꺾은선그래프 연구소」 서버 핵심 로직
// - 모든 권한 검증과 학급 격리는 이 파일에서 수행합니다.
// - db 어댑터: { all(sql, params), get(sql, params), run(sql, params), exec(sql), tx(fn) }
// - sec 어댑터: { hash(secret), verify(secret, stored), token(), sha256(text) }  (모두 Promise 가능)
import { SCHEMA } from './schema.js?v=mwswbgmk';
import { DEFAULT_LIFE_SOURCES, DEFAULT_LIFE_REGION, cleanLifeSources, buildLifeSources, normalizeRegion, regionFromAddress, hasTourData } from '../shared/life.js?v=mwswbgmk';
import { STUDENT_SURVEY, TEACHER_SURVEY, cleanSurvey, summarize } from '../shared/survey.js?v=mwswbgmk';
import { TOPICS, topicById, validateEntry, SCALE_OPTIONS, snapStep, MONTH_DAYS, MAX_CELLS, MIN_CELLS, cellsNeeded } from '../shared/topics.js?v=mwswbgmk';
import { computeStats, round1 } from '../shared/stats.js?v=mwswbgmk';

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
  stages: { weather: true, topics: true, table: true, graph: true, life: true, gallery: true, survey: true },
  lifeRegion: DEFAULT_LIFE_REGION, // 3차 활동(생활 속 꺾은선그래프) 고장 이름
  lifeSources: DEFAULT_LIFE_SOURCES,
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
  picked: [], // 학생 뽑기에서 이미 뽑힌 학생 id(학급마다)
  topicMode: 'own', // own(학생이 25개 중 직접 골라 내 기록으로, 여러 개) | lottery(제비뽑기로 1개) | class(학급 공동 조사)
  minWorks: 3, // own: 한 사람이 꼭 제출할 그래프 수(나머지는 시간 남는 학생이 더)
  assign: {}, // 학생 id → 주제 id
  assignPool: TOPICS.filter((t) => !t.private).map((t) => t.id), // 제비뽑기 주제 묶음(저축 금액은 개인 정보라 기본 제외)
  pickNoRepeat: true,
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
  if (raw?.school === undefined) s.school = null;
  s.picked = Array.isArray(s.picked) ? s.picked.map(Number) : [];
  s.topicMode = ['own', 'lottery', 'class'].includes(s.topicMode) ? s.topicMode : 'own';
  s.minWorks = Math.min(10, Math.max(1, int(s.minWorks) || 3));
  s.lifeSources = cleanLifeSources(raw?.lifeSources);
  s.lifeRegion = str(s.lifeRegion, 20) || DEFAULT_LIFE_REGION;
  s.assign = s.assign && typeof s.assign === 'object' ? Object.fromEntries(Object.entries(s.assign).filter(([, t]) => topicById(t)).map(([k, t]) => [String(k), Number(t)])) : {};
  s.assignPool = Array.isArray(s.assignPool) ? s.assignPool.map(Number).filter((id) => topicById(id)) : DEFAULT_SETTINGS.assignPool.slice();
  s.activeTopics = Array.isArray(s.activeTopics) ? s.activeTopics.filter((id) => topicById(id)).map(Number) : [];
  return s;
}


const normCode = (v) => (typeof v === 'string' ? v : '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
function codeError(code) {
  if (code.length < 4 || code.length > 8) return '학급 코드는 영문 대문자와 숫자로 4~8자리로 정해 주세요.';
  if (!/[A-Z]/.test(code) && code.length < 6) return '숫자만 쓸 때는 6자리 이상으로 정해 주세요.';
  return null;
}
function cleanSchool(v) {
  if (!v || typeof v !== 'object') return null;
  const name = str(v.name, 40); if (!name) return null;
  return { name, code: str(v.code, 12), officeCode: str(v.officeCode, 6), office: str(v.office, 30), kind: str(v.kind, 12), region: str(v.region, 20), address: str(v.address, 120), manual: !!v.manual };
}

export function createApi({ db, sec, options = {} }) {
  const attempts = new Map(); // 로그인 시도 제한(메모리)

  function init() {
    db.exec(SCHEMA);
    // 예전 자료: 학생당 주제 작품 1개(kind='topic') → 주제마다 따로(kind='topic:번호')
    db.run("UPDATE works SET kind = 'topic:' || topic_id WHERE kind = 'topic' AND topic_id IS NOT NULL");
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
    if (s.role === 'admin') return { role: 'admin', tokenHash: h };
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

  const isLottery = (s) => s.topicMode === 'lottery';
  const isOwn = (s) => s.topicMode === 'own';
  const isPersonal = (s) => s.topicMode !== 'class'; // 내 기록으로 표·그래프
  const tkind = (topicId) => `topic:${topicId}`;
  // 이 학생이 지금 만드는 주제: 제비뽑기=배정 주제, 직접 고르기=고른 주제(주제 묶음 안), 학급 공동=연 주제
  function researchOf(student, s, state) {
    if (isLottery(s)) { const t = s.assign[String(student.id)]; return t ? Number(t) : null; }
    const t = Number(state.research?.topicId);
    return t && (isOwn(s) ? s.assignPool : s.activeTopics).includes(t) ? t : null;
  }
  function canSurvey(student, s, topicId, state) {
    if (isLottery(s)) return researchOf(student, s, state) === topicId;
    return (isOwn(s) ? s.assignPool : s.activeTopics).includes(topicId);
  }
  // 제출(승인 대기·승인)한 주제 그래프 수
  function doneWorks(studentId) {
    return db.all("SELECT topic_id, status FROM works WHERE student_id = ? AND kind LIKE 'topic:%' AND status IN ('submitted','approved')", [studentId]);
  }
  function ownSeries(studentId, topic, s) {
    const rows = db.all('SELECT month, status, value, source FROM responses WHERE student_id = ? AND topic_id = ?', [studentId, topic.id]);
    return months(s).map((m) => { const r = rows.find((x) => x.month === m); return { month: m, status: r?.status || 'blank', value: r && r.status === 'value' ? Number(r.value) : null, source: r?.source || null }; });
  }
  // 그래프·자료표의 정답 값: 제비뽑기면 내 기록, 아니면 학급 집계
  function targetValues(classId, studentId, topic, s) {
    if (isPersonal(s)) return ownSeries(studentId, topic, s).map((r) => ({ month: r.month, value: r.value }));
    return aggregate(classId, topic, s).map((a) => ({ month: a.month, value: a.value }));
  }

  // 세 활동 모두 제출: 1차(기상자료 완료) + 2차 주제 그래프 1개 이상 + 3차 우리 고장 그래프
  function allThree(studentId, wd) {
    if (!wd) return false;
    const done = (kindLike) => !!db.get(`SELECT 1 AS x FROM works WHERE student_id = ? AND kind LIKE ? AND status IN ('submitted','approved') LIMIT 1`, [studentId, kindLike]);
    return done('topic:%') && done('life');
  }
  function surveyRow(classId, role, userId) {
    const r = db.get('SELECT answers, updated_at FROM surveys WHERE class_id = ? AND role = ? AND user_id = ?', [classId, role, userId]);
    return r ? { answers: parse(r.answers), at: r.updated_at } : null;
  }
  function saveSurvey(classId, role, userId, items, raw) {
    const { answers, missing } = cleanSurvey(items, raw);
    if (missing.length) fail(400, `${missing.join(', ')}번 문항에 답해 주세요.`, { missing });
    db.run(`INSERT INTO surveys(class_id, role, user_id, answers, updated_at) VALUES (?,?,?,?,?)
      ON CONFLICT(class_id, role, user_id) DO UPDATE SET answers = excluded.answers, updated_at = excluded.updated_at`, [classId, role, userId, JSON.stringify(answers), now()]);
    return surveyRow(classId, role, userId);
  }
  const approvedCount = (classId) => db.get("SELECT COUNT(*) AS n FROM works WHERE class_id = ? AND status = 'approved'", [classId]).n;

  function weatherDone(student, state) { return !!(state.weatherDone || student.weather_override); }

  function gates(student, cls, state) {
    const s = cls.settings;
    const wd = weatherDone(student, state);
    const research = researchOf(student, s, state);
    const submitted = db.all('SELECT topic_id FROM submissions WHERE student_id = ?', [student.id]).map((r) => r.topic_id);
    const tableOk = research ? !!state.tables?.[research]?.verified : false;
    const lock = (open, ok, why) => (!open ? '선생님이 아직 열지 않은 단계예요.' : !ok ? why : null);
    return {
      weatherDone: wd,
      research,
      submittedTopics: submitted,
      weather: lock(s.stages.weather, true, null),
      topics: lock(s.stages.topics, wd, '기상자료 탐험실을 먼저 완료해야 들어갈 수 있어요.'),
      table: lock(s.stages.table, wd && research && submitted.includes(research), !wd ? '기상자료 탐험실을 먼저 완료해야 해요.' : !research && isLottery(s) ? '선생님이 제비뽑기로 연구 주제를 정해 주면 열려요.' : !research && isOwn(s) ? '2장에서 주제를 고르고 내 기록을 먼저 제출해야 해요.' : isPersonal(s) ? '내 주제의 월별 기록을 먼저 제출해야 해요.' : '연구 주제를 고르고 그 주제의 월별 조사를 제출해야 해요.'),
      graph: lock(s.stages.graph, wd && tableOk, !wd ? '기상자료 탐험실을 먼저 완료해야 해요.' : '자료표 만들기를 먼저 완성해야 해요.'),
      life: lock(s.stages.life, wd, '기상자료 탐험실을 먼저 완료해야 들어갈 수 있어요.'),
      survey: lock(s.stages.survey, allThree(student.id, wd), '1차·2차·3차 꺾은선그래프를 모두 제출하면 만족도 조사가 열려요.'),
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
    if (kind === 'life') {
      const L = state.life || {};
      if (!L.tableChecked) fail(400, '우리 고장 자료 표를 먼저 완성해 주세요.');
      return { labels: L.years.map((y) => `${y}년`), values: L.values.map(Number), xUnit: '년', yUnit: L.unit || '', topicId: null };
    }
    const topic = topicById(researchOf(ctx.student, s, state));
    if (!topic) fail(400, '연구 주제를 먼저 정해야 해요.');
    const t = state.tables?.[topic.id];
    if (!t?.verified) fail(400, '자료표를 먼저 완성해 주세요.');
    const tv = targetValues(ctx.cls.id, ctx.student.id, topic, s);
    return { labels: tv.map((a) => `${a.month}월`), values: tv.map((a) => a.value), xUnit: '월', yUnit: topic.unit, topicId: topic.id, topic };
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
    if (!data.scale) issues.push({ step: 'scale', msg: '세로 작은 눈금 한 칸의 크기를 정해 주세요.' });
    else {
      const cells = cellsNeeded(maxV, data.yStart, data.scale);
      if (cells > MAX_CELLS) issues.push({ step: 'scale', msg: '작은 눈금 한 칸의 크기가 너무 작아 칸이 너무 많아요. 더 큰 수를 골라 보세요.' });
      else if (cells < MIN_CELLS && maxV > 0) issues.push({ step: 'scale', msg: '작은 눈금 한 칸의 크기가 너무 커서 변화가 잘 보이지 않아요. 더 작은 수를 골라 보세요.' });
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

  function workName(r, d) {
    if (r.kind === 'weather') return '연도별 폭염일수';
    if (r.kind === 'life') return d?.subject ? `우리 고장: ${d.subject}` : '우리 고장 자료';
    return topicById(r.topic_id)?.name;
  }
  function workRow(studentId, kind) {
    return db.get('SELECT * FROM works WHERE student_id = ? AND kind = ?', [studentId, kind]);
  }
  function publicWork(w) {
    if (!w) return null;
    return { id: w.id, kind: w.kind === 'weather' || w.kind === 'life' ? w.kind : 'topic', topicId: w.topic_id, data: parse(w.data), status: w.status, feedback: w.feedback, updatedAt: w.updated_at, submittedAt: w.submitted_at };
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

  // ── 만족도 조사 ──
  route('GET', '/api/student/survey', 'student', async ({ ctx }) => {
    const g = gates(ctx.student, ctx.cls, getState(ctx.student.id));
    return { body: { open: !g.survey, reason: g.survey, items: STUDENT_SURVEY, mine: surveyRow(ctx.cls.id, 'student', ctx.student.id) } };
  });
  route('PUT', '/api/student/survey', 'student', async ({ ctx, body }) => {
    requireGate(ctx, 'survey');
    return { body: { ok: true, mine: saveSurvey(ctx.cls.id, 'student', ctx.student.id, STUDENT_SURVEY, body.answers) } };
  });
  route('GET', '/api/teacher/classes/:id/survey', 'teacher', async ({ ctx, params }) => {
    const c = teacherClass(ctx.teacher, params.id);
    const list = db.all("SELECT answers FROM surveys WHERE class_id = ? AND role = 'student' ORDER BY updated_at", [c.id]).map((r) => parse(r.answers));
    const total = db.get('SELECT COUNT(*) AS n FROM students WHERE class_id = ?', [c.id]).n;
    const n = approvedCount(c.id);
    return { body: {
      students: { total, responded: list.length, summary: summarize(STUDENT_SURVEY, list) },
      teacher: { open: n > 0, reason: n > 0 ? null : '학생 작품을 한 개 이상 승인(전시)하면 선생님 만족도 조사가 열려요.', items: TEACHER_SURVEY, mine: surveyRow(c.id, 'teacher', ctx.teacher.id) },
    } };
  });
  route('PUT', '/api/teacher/classes/:id/survey', 'teacher', async ({ ctx, params, body }) => {
    const c = teacherClass(ctx.teacher, params.id);
    if (!approvedCount(c.id)) fail(403, '학생 작품을 한 개 이상 승인(전시)하면 선생님 만족도 조사를 할 수 있어요.');
    return { body: { ok: true, mine: saveSurvey(c.id, 'teacher', ctx.teacher.id, TEACHER_SURVEY, body.answers) } };
  });

  // 학생 입장 1단계: 학급 코드로 학교·학년·반과 이름 목록 보기(내 이름을 눌러 들어가기)
  route('GET', '/api/student/class-lookup', null, async ({ query }) => {
    const code = str(query.code, 10).toUpperCase().replace(/\s/g, '');
    limit('lookup:all', 400);
    limit(`lookup:${code}`, 40);
    const cls = code.length >= 4 ? db.get('SELECT * FROM classes WHERE code = ?', [code]) : null;
    if (!cls) fail(404, '학급 코드를 다시 확인해 주세요.');
    const s = mergeSettings(parse(cls.settings));
    const students = db.all('SELECT number, name FROM students WHERE class_id = ? ORDER BY number', [cls.id]);
    return { body: { name: cls.name, school: s.school?.name || '', grade: s.grade || null, classNo: s.classNo || null, nickname: s.nickname || '', isDemo: !!cls.is_demo, students } };
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
    if (ctx.role === 'admin') return { body: { role: 'admin' } };
    if (ctx.role === 'teacher') return { body: { role: 'teacher', teacher: ctx.teacher } };
    return { body: { role: 'student', student: { id: ctx.student.id, number: ctx.student.number, name: ctx.student.name }, className: ctx.cls.name } };
  });

  // ── 전체 관리자: 모든 학급의 운영 현황과 만족도 조사 결과 ──
  // 관리자 비밀번호는 서버 환경 변수(ADMIN_PASSWORD)로만 정해요. 코드나 공개 저장소에는 두지 않아요.
  const adminEnabled = () => !!options.adminPassword;
  async function checkAdmin(password) {
    const pw = String(password || '');
    if (!adminEnabled() || !pw || pw.length > 100) return false;
    return (await sec.sha256(pw)) === (await sec.sha256(options.adminPassword));
  }
  route('GET', '/api/admin/status', null, async () => ({ body: { enabled: adminEnabled() } }));
  route('POST', '/api/admin/login', null, async ({ body }) => {
    if (!adminEnabled()) fail(403, '전체 관리자는 서버 판에서 쓸 수 있어요. 서버에 ADMIN_PASSWORD를 정해 주세요.');
    limit('admin-login', 10);
    if (!(await checkAdmin(body.password))) fail(401, '관리자 비밀번호가 맞지 않아요.');
    clearLimit('admin-login');
    const token = await newSession('admin', 0, null, 1);
    return { body: { ok: true }, token };
  });
  route('GET', '/api/admin/overview', 'admin', async ({ query }) => {
    const withDemo = query.demo === '1';
    const classes = db.all(`SELECT c.id, c.name, c.code, c.is_demo, c.created_at, c.settings, t.name AS teacher, t.username
      FROM classes c JOIN teachers t ON t.id = c.teacher_id ORDER BY c.created_at DESC`).filter((c) => withDemo || !c.is_demo);
    const ids = classes.map((c) => c.id);
    const count = (sql, id) => db.get(sql, [id]).n;
    const rows = classes.map((c) => {
      const st = mergeSettings(parse(c.settings));
      return {
        id: c.id, name: c.name, code: c.code, isDemo: !!c.is_demo, createdAt: c.created_at, teacher: c.teacher || c.username,
        school: st.school?.name || '', region: st.lifeRegion || '',
        students: count('SELECT COUNT(*) AS n FROM students WHERE class_id = ?', c.id),
        works: count("SELECT COUNT(*) AS n FROM works WHERE class_id = ? AND status IN ('submitted','approved')", c.id),
        approved: count("SELECT COUNT(*) AS n FROM works WHERE class_id = ? AND status = 'approved'", c.id),
        studentSurveys: count("SELECT COUNT(*) AS n FROM surveys WHERE class_id = ? AND role = 'student'", c.id),
        teacherSurvey: count("SELECT COUNT(*) AS n FROM surveys WHERE class_id = ? AND role = 'teacher'", c.id) > 0,
      };
    });
    const answers = (role) => db.all(`SELECT class_id, answers FROM surveys WHERE role = ?`, [role]).filter((r) => ids.includes(r.class_id)).map((r) => parse(r.answers));
    const sAns = answers('student'); const tAns = answers('teacher');
    const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
    return { body: {
      withDemo,
      totals: {
        teachers: new Set(rows.map((r) => r.teacher)).size, classes: rows.length, students: sum('students'),
        works: sum('works'), approved: sum('approved'), studentSurveys: sAns.length, teacherSurveys: tAns.length,
        demoClasses: db.get('SELECT COUNT(*) AS n FROM classes WHERE is_demo = 1').n,
      },
      classes: rows,
      surveys: { students: summarize(STUDENT_SURVEY, sAns), teachers: summarize(TEACHER_SURVEY, tAns) },
    } };
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
            kmaUrl: s.kmaUrl, kmaGuide: s.kmaGuide, notice: s.notice, displayName: s.displayName, schoolName: s.school?.name || '', nickname: s.nickname || '', topicMode: s.topicMode, minWorks: s.minWorks, topicPool: s.assignPool, lifeRegion: s.lifeRegion, lifeSources: s.lifeSources,
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
    if (p.life && typeof p.life === 'object') {
      const L = state.life || {};
      const yrs = Array.isArray(p.life.years) ? p.life.years.slice(0, 8).map((y) => (y === '' || y === null ? '' : int(y))) : L.years;
      const vals = Array.isArray(p.life.values) ? p.life.values.slice(0, 8).map((v) => (v === '' || v === null ? '' : Number(v))) : L.values;
      const next = {
        ...L,
        sourceId: p.life.sourceId !== undefined ? str(p.life.sourceId, 20) : L.sourceId,
        subject: p.life.subject !== undefined ? str(p.life.subject, 40) : L.subject,
        unit: p.life.unit !== undefined ? str(p.life.unit, 10) : L.unit,
        source: p.life.source !== undefined ? str(p.life.source, 120) : L.source,
        visited: p.life.visited !== undefined ? !!p.life.visited : L.visited,
        predict: p.life.predict !== undefined ? str(p.life.predict, 300) : L.predict,
        relation: p.life.relation !== undefined ? str(p.life.relation, 300) : L.relation,
        years: yrs, values: vals,
      };
      const changed = ['subject', 'unit'].some((k) => next[k] !== L[k]) || JSON.stringify(yrs) !== JSON.stringify(L.years) || JSON.stringify(vals) !== JSON.stringify(L.values);
      next.tableChecked = changed ? false : !!L.tableChecked;
      state.life = next;
    }
    if (p.research && p.research.topicId !== undefined) {
      const tid = int(p.research.topicId);
      if (isLottery(ctx.cls.settings)) fail(403, '연구 주제는 선생님이 제비뽑기로 정해 줘요.');
      if (isOwn(ctx.cls.settings)) {
        if (!ctx.cls.settings.assignPool.includes(tid)) fail(400, '선생님이 열어 둔 주제 중에서 골라 주세요.');
      } else {
        if (!ctx.cls.settings.activeTopics.includes(tid)) fail(400, '선생님이 연 조사 주제 중에서 골라 주세요.');
        const t = topicById(tid);
        if (t.private && ctx.cls.settings.savingsMode === 'hidden') fail(400, '이 주제는 선생님이 결과를 공개하지 않아 연구 주제로 고를 수 없어요.');
      }
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

  route('POST', '/api/student/life/check-table', 'student', async ({ ctx }) => {
    requireGate(ctx, 'life');
    const state = getState(ctx.student.id);
    const L = state.life || {};
    const issues = [];
    if (!L.subject) issues.push('무엇을 조사했는지(자료 이름)를 적어 주세요.');
    if (!L.unit) issues.push('자료의 단위(명, 만 명, 곳 등)를 적어 주세요.');
    if (!L.source) issues.push('자료를 찾은 곳(누리집·기사 이름)을 출처에 적어 주세요.');
    const thisYear = new Date().getFullYear();
    const pairs = (L.years || []).map((y, i) => [y, (L.values || [])[i]]).filter(([y, v]) => y !== '' || (v !== '' && v !== undefined));
    if (pairs.length < 3) issues.push('연도와 값을 3개 이상 적어 주세요(최대 8개).');
    else {
      const ys = pairs.map(([y]) => y);
      if (ys.some((y) => !Number.isInteger(y))) issues.push('연도를 모두 적어 주세요.');
      else {
        if (ys.some((y) => y < 1950 || y > thisYear)) issues.push(`연도는 1950년부터 ${thisYear}년 사이로 적어 주세요.`);
        for (let i = 1; i < ys.length; i++) if (ys[i] <= ys[i - 1]) { issues.push('연도는 왼쪽부터 차례대로(작은 연도부터) 적어 주세요.'); break; }
      }
      const vs = pairs.map(([, v]) => v);
      if (vs.some((v) => v === '' || v === undefined || !Number.isFinite(Number(v)))) issues.push('값을 모두 숫자로 적어 주세요.');
      else if (vs.some((v) => v < 0 || v > 100000000)) issues.push('값은 0보다 크거나 같고 1억보다 작아야 해요.');
      else if (vs.some((v) => Math.abs(Math.round(v * 10) - v * 10) > 1e-6)) issues.push('값은 소수 첫째 자리까지만 적어요. 큰 수는 ‘만 명’처럼 단위를 바꾸어 어림해도 돼요.');
    }
    if (issues.length) return { body: { ok: false, issues } };
    L.years = pairs.map(([y]) => y); L.values = pairs.map(([, v]) => Number(v));
    L.tableChecked = true;
    state.life = L;
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
    if (!topic || !canSurvey(ctx.student, s, topic.id, getState(ctx.student.id))) fail(400, isLottery(s) ? '제비뽑기로 받은 내 주제만 기록할 수 있어요.' : isOwn(s) ? '선생님이 열어 둔 주제가 아니에요.' : '선생님이 연 조사 주제가 아니에요.');
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
    if (!topic || !canSurvey(ctx.student, s, topic.id, getState(ctx.student.id))) fail(400, '조사 주제를 다시 골라 주세요.');
    if (isPersonal(s)) return { body: { visible: true, mode: 'own', list: false, rows: ownSeries(ctx.student.id, topic, s) } };
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
    if (!topic || !canSurvey(ctx.student, s, topic.id, getState(ctx.student.id))) fail(400, '조사 주제를 다시 골라 주세요.');
    const agg = targetValues(ctx.cls.id, ctx.student.id, topic, s);
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
    const kind = ['weather', 'life'].includes(body.kind) ? body.kind : 'topic';
    const { state } = requireGate(ctx, kind === 'topic' ? 'graph' : kind);
    const key = kind === 'topic' ? tkind(researchOf(ctx.student, ctx.cls.settings, state)) : kind;
    const target = workTarget(ctx, kind, state);
    const existing = workRow(ctx.student.id, key);
    const data = sanitizeWork(body.data, target.labels.length);
    const prev = existing ? parse(existing.data) : {};
    data.checked = false;
    data.labels = target.labels;
    data.values = target.values;
    if (kind === 'life') data.subject = state.life?.subject || '';
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
        [ctx.cls.id, ctx.student.id, key, target.topicId, JSON.stringify(data), status, now()]);
    }
    return { body: { ok: true, work: publicWork(workRow(ctx.student.id, key)) } };
  });

  route('POST', '/api/student/work/check', 'student', async ({ ctx, body }) => {
    const kind = ['weather', 'life'].includes(body.kind) ? body.kind : 'topic';
    const { state } = requireGate(ctx, kind === 'topic' ? 'graph' : kind);
    const key = kind === 'topic' ? tkind(researchOf(ctx.student, ctx.cls.settings, state)) : kind;
    const target = workTarget(ctx, kind, state);
    const w = workRow(ctx.student.id, key);
    if (!w) fail(400, '먼저 그래프를 그려 주세요.');
    const data = parse(w.data);
    const issues = checkWork(data, target);
    data.labels = target.labels; data.values = target.values;
    data.checked = issues.length === 0;
    data.checkedAt = data.checked ? now() : null;
    db.run('UPDATE works SET data = ?, updated_at = ? WHERE id = ?', [JSON.stringify(data), now(), w.id]);
    return { body: { ok: issues.length === 0, issues, answer: issues.length === 0 ? { labels: target.labels, values: target.values } : null, work: publicWork(workRow(ctx.student.id, key)) } };
  });

  route('POST', '/api/student/work/submit', 'student', async ({ ctx, body }) => {
    const kind = ['weather', 'life'].includes(body.kind) ? body.kind : 'topic';
    const { state } = requireGate(ctx, kind === 'topic' ? 'graph' : kind);
    const key = kind === 'topic' ? tkind(researchOf(ctx.student, ctx.cls.settings, state)) : kind;
    const w = workRow(ctx.student.id, key);
    const data = parse(w?.data);
    if (!w || !data.checked) fail(400, '[확인하기]를 통과한 뒤에 제출할 수 있어요.');
    if (['submitted', 'approved'].includes(w.status)) return { body: { ok: true, work: publicWork(w) } };
    db.run("UPDATE works SET status = 'submitted', feedback = '', submitted_at = ?, updated_at = ? WHERE id = ?", [now(), now(), w.id]);
    if (kind === 'weather') {
      state.weatherDone = true;
      putState(ctx.student.id, ctx.cls.id, state);
    }
    return { body: { ok: true, work: publicWork(workRow(ctx.student.id, key)) } };
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
        id: r.id, kind: r.kind === 'weather' || r.kind === 'life' ? r.kind : 'topic', topicId: r.topic_id, sid: r.student_id,
        topicName: workName(r, d),
        author: displayName(r, settings),
        mine: ctx.role === 'student' && r.student_id === ctx.student.id,
        data: {
          title: d.title, xName: d.xName, xUnit: d.xUnit, yName: d.yName, yUnit: d.yUnit, scale: d.scale, yStart: d.yStart,
          labels: d.labels, values: d.values, points: d.points, segments: d.segments, interp: { sentence: d.interp?.sentence || '' }, subject: d.subject || '',
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

  // 학교 검색(나이스 학교기본정보) — 서버가 searchSchools를 넘겨준 경우에만 동작
  route('GET', '/api/teacher/schools', 'teacher', async ({ query }) => {
    const q = str(query.q, 30);
    if (q.length < 2) fail(400, '학교 이름을 두 글자 이상 적어 주세요.');
    if (!options.searchSchools) return { body: { available: false, schools: [] } };
    try {
      const schools = await options.searchSchools(q, { office: str(query.office, 4), kind: str(query.kind, 10) });
      return { body: { available: true, schools } };
    } catch (e) {
      return { body: { available: false, error: '지금은 학교 검색을 할 수 없어요. 학교 이름을 직접 적어 주세요.', schools: [] } };
    }
  });

  route('GET', '/api/teacher/code-check', 'teacher', async ({ query }) => {
    const code = normCode(query.code);
    const err = codeError(code);
    if (err) return { body: { available: false, error: err } };
    const used = db.get('SELECT id FROM classes WHERE code = ?', [code]);
    return { body: { available: !used || (!!query.classId && used.id === int(query.classId)), code } };
  });

  route('POST', '/api/teacher/classes', 'teacher', async ({ ctx, body }) => {
    const school = cleanSchool(body.school);
    const grade = int(body.grade); const classNo = int(body.classNo);
    let name = str(body.name, 40);
    if (!name && school && grade >= 1 && grade <= 6 && classNo >= 1) name = `${school.name} ${grade}학년 ${classNo}반`;
    if (!name) fail(400, '학급 이름을 적어 주세요.');
    let code;
    if (body.code) {
      code = normCode(body.code);
      const err = codeError(code); if (err) fail(400, err);
      if (db.get('SELECT id FROM classes WHERE code = ?', [code])) fail(409, '이미 다른 학급이 쓰고 있는 코드예요. 다른 코드를 정해 주세요.');
    } else code = genCode();
    const settings = { ...DEFAULT_SETTINGS, school, grade: grade >= 1 && grade <= 6 ? grade : null, classNo: classNo >= 1 && classNo <= 30 ? classNo : null, nickname: str(body.nickname, 20) };
    // 3차 우리 고장: 학교 주소(또는 직접 적은 지역)로 그 시·군 자료를 미리 채움
    const region = normalizeRegion(str(body.lifeRegion, 20)) || regionFromAddress(school?.address) || regionFromAddress(school?.region) || (hasTourData(school?.region) ? normalizeRegion(school.region) : '');
    if (region) { settings.lifeRegion = region; settings.lifeSources = buildLifeSources(region); }
    const r = db.run('INSERT INTO classes(teacher_id, name, code, settings, created_at) VALUES (?,?,?,?,?)', [ctx.teacher.id, name, code, JSON.stringify(settings), now()]);
    return { body: { id: Number(r.lastInsertRowid), code, name } };
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
    if (p.lifeSources !== undefined) s.lifeSources = cleanLifeSources(p.lifeSources);
    if (p.lifeRegion !== undefined) s.lifeRegion = normalizeRegion(str(p.lifeRegion, 20)) || DEFAULT_LIFE_REGION;
    if (p.kmaGuide !== undefined) s.kmaGuide = str(p.kmaGuide, 2000) || DEFAULT_KMA_GUIDE;
    if (p.notice !== undefined) s.notice = str(p.notice, 300);
    if (p.school !== undefined) s.school = cleanSchool(p.school);
    if (p.grade !== undefined) { const g = int(p.grade); s.grade = g >= 1 && g <= 6 ? g : null; }
    if (p.classNo !== undefined) { const n = int(p.classNo); s.classNo = n >= 1 && n <= 30 ? n : null; }
    if (p.nickname !== undefined) s.nickname = str(p.nickname, 20);
    if (p.pickNoRepeat !== undefined) s.pickNoRepeat = !!p.pickNoRepeat;
    if (['own', 'lottery', 'class'].includes(p.topicMode)) s.topicMode = p.topicMode;
    if (p.minWorks !== undefined) { const n = int(p.minWorks); if (!(n >= 1 && n <= 10)) fail(400, '꼭 낼 그래프 수는 1~10개로 정해 주세요.'); s.minWorks = n; }
    if (p.assignPool !== undefined) { const pool = (Array.isArray(p.assignPool) ? p.assignPool : []).map(Number).filter((id) => topicById(id)); if (!pool.length) fail(400, '주제를 한 개 이상 골라 주세요.'); s.assignPool = [...new Set(pool)]; }
    if (p.picked !== undefined) {
      const ids = new Set(db.all('SELECT id FROM students WHERE class_id = ?', [c.id]).map((r) => r.id));
      s.picked = [...new Set((Array.isArray(p.picked) ? p.picked : []).map(Number))].filter((id) => ids.has(id)).slice(0, 100);
    }
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

  route('POST', '/api/teacher/classes/:id/code', 'teacher', async ({ ctx, params, body }) => {
    const c = teacherClass(ctx.teacher, params.id);
    let code;
    if (body.code) {
      code = normCode(body.code);
      const err = codeError(code); if (err) fail(400, err);
      const used = db.get('SELECT id FROM classes WHERE code = ?', [code]);
      if (used && used.id !== c.id) fail(409, '이미 다른 학급이 쓰고 있는 코드예요. 다른 코드를 정해 주세요.');
    } else code = genCode();
    db.run('UPDATE classes SET code = ? WHERE id = ?', [code, c.id]);
    return { body: { code } };
  });

  // ───────── 주제 제비뽑기: 학생 한 명당 주제 한 개, 서로 겹치지 않게 ─────────
  function assignView(c) {
    const st = db.all('SELECT id, number, name FROM students WHERE class_id = ? ORDER BY number', [c.id]);
    const s = c.settings;
    const taken = new Set(Object.values(s.assign).map(Number));
    return {
      topicMode: s.topicMode, pool: s.assignPool,
      remaining: s.assignPool.filter((id) => !taken.has(id)),
      rows: st.map((x) => {
        const tid = s.assign[String(x.id)] || null;
        const w = tid ? workRow(x.id, tkind(tid)) : null;
        const subs = tid ? !!db.get('SELECT 1 AS x FROM submissions WHERE student_id = ? AND topic_id = ?', [x.id, tid]) : false;
        return { id: x.id, number: x.number, name: x.name, topicId: tid, surveyed: subs, work: w && w.topic_id === tid ? w.status : null };
      }),
    };
  }
  function saveAssign(c, assign) {
    c.settings.assign = assign;
    db.run('UPDATE classes SET settings = ? WHERE id = ?', [JSON.stringify(c.settings), c.id]);
  }
  function checkChange(c, studentId, force) {
    const cur = c.settings.assign[String(studentId)];
    if (!cur || force) return;
    const w = workRow(studentId, tkind(cur));
    const has = (w && w.topic_id === cur && w.status !== 'draft') || db.get('SELECT 1 AS x FROM submissions WHERE student_id = ? AND topic_id = ?', [studentId, cur]);
    if (has) fail(409, '이 학생은 지금 주제로 이미 기록이나 작품을 냈어요. 바꾸면 그 학생은 새 주제로 다시 해야 해요.', { needForce: true });
  }

  route('GET', '/api/teacher/classes/:id/assign', 'teacher', async ({ ctx, params }) => {
    const c = teacherClass(ctx.teacher, params.id);
    return { body: assignView(c) };
  });

  route('POST', '/api/teacher/classes/:id/assign/draw', 'teacher', async ({ ctx, params, body }) => {
    const c = teacherClass(ctx.teacher, params.id);
    const assign = { ...c.settings.assign };
    let targets;
    if (body.all) targets = db.all('SELECT id FROM students WHERE class_id = ? ORDER BY number', [c.id]).map((r) => r.id).filter((id) => !assign[String(id)]);
    else {
      const st = db.get('SELECT id FROM students WHERE id = ? AND class_id = ?', [int(body.studentId), c.id]);
      if (!st) fail(404, '학생을 찾을 수 없어요.');
      checkChange(c, st.id, body.force);
      targets = [st.id];
    }
    const drawn = [];
    for (const sid of targets) {
      const prev = assign[String(sid)];
      delete assign[String(sid)];
      const taken = new Set(Object.values(assign).map(Number));
      let pool = c.settings.assignPool.filter((id) => !taken.has(id) && id !== prev);
      if (!pool.length) pool = c.settings.assignPool.filter((id) => !taken.has(id));
      if (!pool.length) { if (prev) assign[String(sid)] = prev; fail(409, '남은 주제가 없어요. 주제 묶음을 늘리거나 다른 학생의 주제를 비워 주세요.', { drawn }); }
      const pick = pool[Math.floor(Math.random() * pool.length)];
      assign[String(sid)] = pick; drawn.push({ studentId: sid, topicId: pick });
    }
    saveAssign(c, assign);
    return { body: { drawn, ...assignView(c) } };
  });

  route('POST', '/api/teacher/classes/:id/assign/set', 'teacher', async ({ ctx, params, body }) => {
    const c = teacherClass(ctx.teacher, params.id);
    const st = db.get('SELECT id FROM students WHERE id = ? AND class_id = ?', [int(body.studentId), c.id]);
    if (!st) fail(404, '학생을 찾을 수 없어요.');
    const assign = { ...c.settings.assign };
    if (body.topicId === null || body.topicId === '' || body.topicId === undefined) {
      checkChange(c, st.id, body.force); delete assign[String(st.id)];
    } else {
      const tid = int(body.topicId);
      if (!topicById(tid)) fail(400, '주제를 다시 골라 주세요.');
      if (assign[String(st.id)] === tid) return { body: assignView(c) };
      const other = Object.entries(assign).find(([k, t]) => Number(t) === tid && k !== String(st.id));
      if (other) fail(409, '이미 다른 학생이 받은 주제예요. 주제는 학생마다 하나씩 겹치지 않게 정해요.');
      checkChange(c, st.id, body.force);
      assign[String(st.id)] = tid;
    }
    saveAssign(c, assign);
    return { body: assignView(c) };
  });

  route('POST', '/api/teacher/classes/:id/assign/reset', 'teacher', async ({ ctx, params }) => {
    const c = teacherClass(ctx.teacher, params.id);
    saveAssign(c, {});
    return { body: assignView(c) };
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
      const c = db.get('SELECT * FROM classes WHERE id = ?', [st.class_id]);
      if (c) { const cs = mergeSettings(parse(c.settings)); delete cs.assign[String(st.id)]; db.run('UPDATE classes SET settings = ? WHERE id = ?', [JSON.stringify(cs), c.id]); }
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
      const rt = researchOf(st, c.settings, state);
      const wW = workRow(st.id, 'weather'); const wT = rt ? workRow(st.id, tkind(rt)) : null;
      const done = doneWorks(st.id);
      const topicsTouched = [...new Set([...subs, ...db.all("SELECT topic_id FROM works WHERE student_id = ? AND kind LIKE 'topic:%'", [st.id]).map((r) => r.topic_id)])];
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
        life: (() => { const L = state.life || {}; const wL = workRow(st.id, 'life'); return wL ? { draft: '그리는 중', submitted: '승인 대기', approved: '승인됨', rejected: '다시 그리기' }[wL.status] : L.tableChecked ? '표 완성' : L.subject ? '자료 찾는 중' : '시작 전'; })(),
        lifeSubject: state.life?.subject || '',
        surveyed: !!surveyRow(c.id, 'student', st.id),
        worksDone: done.length, worksApproved: done.filter((x) => x.status === 'approved').length, minWorks: c.settings.minWorks,
        doneTopics: done.map((x) => x.topic_id), topics: topicsTouched,
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
          return { ...pw, number: r.number, name: r.name, topicName: workName(r, pw.data), stats: computeStats(pw.data.labels || [], pw.data.values || []) };
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
    } else if (type === 'survey') {
      name = 'survey';
      rows = [['구분', ...STUDENT_SURVEY.map((it, i) => `${i + 1}. ${it.q}`), '응답 시각']];
      for (const r of db.all("SELECT answers, updated_at FROM surveys WHERE class_id = ? AND role = 'student' ORDER BY updated_at", [c.id])) {
        const a = parse(r.answers); rows.push(['학생', ...STUDENT_SURVEY.map((it) => a[it.id] ?? ''), r.updated_at]);
      }
      rows.push([]);
      rows.push(['구분', ...TEACHER_SURVEY.map((it, i) => `${i + 1}. ${it.q}`), '응답 시각']);
      for (const r of db.all("SELECT answers, updated_at FROM surveys WHERE class_id = ? AND role = 'teacher'", [c.id])) {
        const a = parse(r.answers); rows.push(['교사', ...TEACHER_SURVEY.map((it) => a[it.id] ?? ''), r.updated_at]);
      }
    } else if (type === 'life') {
      name = 'life';
      rows = [['번호', '이름', '조사한 자료', '단위', '출처', '연도1', '값1', '연도2', '값2', '연도3', '값3', '연도4', '값4', '연도5', '값5', '연도6', '값6', '연도7', '값7', '연도8', '값8', '다음 해 예상', '그래프']];
      for (const st of db.all('SELECT * FROM students WHERE class_id = ? ORDER BY number', [c.id])) {
        const L = getState(st.id).life || {}; const wL = workRow(st.id, 'life');
        const yv = []; for (let i = 0; i < 8; i++) yv.push(L.years?.[i] ?? '', L.values?.[i] ?? '');
        rows.push([st.number, st.name, L.subject || '', L.unit || '', L.source || '', ...yv, L.predict || '', wL?.status || '']);
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
        if (r.role === 'admin' && ctx?.role !== 'admin') fail(401, '전체 관리자 로그인이 필요해요.');
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
