// 체험용(가상) 학급 데이터. 실제 운영 데이터와 구분되도록 학급 이름에 '체험용'을 붙이고 is_demo=1로 저장합니다.
// 기상자료(폭염일수)는 실제 값을 지어내지 않도록 체험 데이터에 넣지 않습니다.
import { topicById } from '../public/shared/topics.js';
import { DEFAULT_SETTINGS } from './api.js';
import { computeStats } from '../public/shared/stats.js';

const NAMES = ['체험학생', '김하늘', '이도윤', '박서연', '최지호', '정하은', '강민준', '조수아', '윤시우', '장예린',
  '임주원', '한지안', '오서준', '서다인', '신우진', '권나연', '황준서', '안채원', '송유찬', '전소율'];

function rng(seed) { let s = seed; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; }

export async function seedDemo({ db, sec, code = 'DEMO26', teacherUser = 'demo', teacherPw = 'demo1234', pin = '1234' }) {
  if (db.get('SELECT id FROM classes WHERE code = ?', [code])) return false;
  const t = new Date().toISOString();
  let teacher = db.get('SELECT id FROM teachers WHERE username = ?', [teacherUser]);
  if (!teacher) {
    const r = db.run('INSERT INTO teachers(username, name, pw_hash, created_at) VALUES (?,?,?,?)', [teacherUser, '체험 선생님', await sec.hash(teacherPw), t]);
    teacher = { id: Number(r.lastInsertRowid) };
  }
  const settings = { ...DEFAULT_SETTINGS, activeTopics: [3, 7, 10, 19], notice: '체험용 가상 학급입니다. 친구들의 자료와 작품은 예시로 만든 가상 데이터예요.' };
  const c = db.run('INSERT INTO classes(teacher_id, name, code, settings, is_demo, created_at) VALUES (?,?,?,?,1,?)', [teacher.id, '체험용 4학년 1반', code, JSON.stringify(settings), t]);
  const classId = Number(c.lastInsertRowid);
  const hash = await sec.hash(pin);
  const R = rng(20261122);
  const ids = [];
  for (let i = 0; i < NAMES.length; i++) {
    const r = db.run('INSERT INTO students(class_id, number, name, nickname, pin_hash, created_at) VALUES (?,?,?,?,?,?)', [classId, i + 1, NAMES[i], '', hash, t]);
    ids.push(Number(r.lastInsertRowid));
  }
  const base = {
    3: [6, 8, 10, 12, 14, 12, 9, 5, 11, 12, 13],
    7: [8, 9, 14, 17, 20, 18, 12, 10, 18, 19, 15],
    10: [3, 4, 6, 8, 10, 12, 12, 13, 16, 19, 22],
    19: [3000, 2000, 2500, 3000, 4000, 2000, 1500, 5000, 3000, 3500, 4000],
  };
  const topicsVote = [3, 7, 7, 10, 6, 1, 3, 7, 21, 24, 10, 7, 3, 19, 11, 7, 3, 10, 16];
  const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30];
  for (let k = 1; k < ids.length; k++) {
    const sid = ids[k];
    db.run('INSERT INTO votes(class_id, student_id, topic_id, updated_at) VALUES (?,?,?,?)', [classId, sid, topicsVote[k - 1], t]);
    for (const tid of [3, 7, 10, 19]) {
      if (tid === 10 && k % 4 === 0) continue; // 일부 학생은 이 주제 미응답
      const topic = topicById(tid);
      for (let m = 1; m <= 11; m++) {
        let status = 'value'; let v = base[tid][m - 1] + Math.round((R() - 0.5) * base[tid][m - 1] * 0.8);
        if (tid === 19) v = Math.max(0, Math.round(v / 500) * 500);
        if (topic.kind === 'days') v = Math.min(days[m - 1], Math.max(0, v));
        v = Math.max(0, v);
        if (R() < 0.04) { status = 'unknown'; v = null; }
        db.run('INSERT INTO responses(class_id, student_id, topic_id, month, status, value, source, updated_at) VALUES (?,?,?,?,?,?,?,?)',
          [classId, sid, tid, m, status, v, R() < 0.5 ? 'record' : 'memory', t]);
      }
      db.run('INSERT INTO submissions(class_id, student_id, topic_id, submitted_at) VALUES (?,?,?,?)', [classId, sid, tid, t]);
    }
    db.run('INSERT INTO student_state(student_id, class_id, state, updated_at) VALUES (?,?,?,?)', [sid, classId, JSON.stringify({ weatherDone: true, research: { topicId: [3, 7, 10][k % 3] } }), t]);
  }
  // 승인된 예시 작품(학급 집계값으로 그림)
  const agg = (tid) => {
    const topic = topicById(tid);
    const out = [];
    for (let m = 1; m <= 11; m++) {
      const rows = db.all("SELECT value FROM responses WHERE class_id = ? AND topic_id = ? AND month = ? AND status = 'value'", [classId, tid, m]);
      const sum = rows.reduce((a, r) => a + Number(r.value), 0);
      out.push(rows.length ? (topic.agg === 'avg' ? Math.round((sum / rows.length) * 10) / 10 : sum) : null);
    }
    return out;
  };
  const labels = Array.from({ length: 11 }, (_, i) => `${i + 1}월`);
  const samples = [
    { k: 2, tid: 3, title: '우리 반 월별 감정 글쓰기를 한 날수', scale: 20, sentence: '5월에 감정 글쓰기를 가장 많이 했고 8월 방학에는 많이 줄었어요. 9월에 다시 크게 늘어났어요.' },
    { k: 3, tid: 7, title: '우리 반이 운동한 날수의 변화', scale: 50, sentence: '봄이 되면서 운동한 날수가 점점 늘어났어요. 여름 방학인 8월에 가장 많이 줄었어요.' },
    { k: 4, tid: 10, title: '배구 언더 서브 연속 성공 평균 기록', scale: 2, sentence: '연습을 할수록 평균 기록이 꾸준히 늘어났어요. 9월부터 늘어나는 폭이 더 커졌어요.' },
    { k: 6, tid: 7, title: '월별 운동한 날수', scale: 50, sentence: '날씨가 따뜻한 5월에 운동을 가장 많이 했어요. 1월과 2월에는 운동한 날이 적었어요.' },
    { k: 7, tid: 3, title: '감정 글쓰기 날수 변화', scale: 20, sentence: '학기 중에는 감정 글쓰기를 꾸준히 했지만 방학에는 줄었어요.' },
    { k: 9, tid: 10, title: '서브 연속 성공 기록은 어떻게 변했을까?', scale: 2, sentence: '1월보다 11월의 평균 기록이 훨씬 높아졌어요. 꾸준히 연습한 결과라고 생각해요.' },
  ];
  for (const s of samples) {
    const values = agg(s.tid);
    const topic = topicById(s.tid);
    const points = {}; values.forEach((v, i) => { if (v !== null) points[i] = v; });
    const segments = []; for (let i = 1; i < values.length; i++) segments.push([i - 1, i]);
    const st = computeStats(labels, values);
    const data = {
      title: s.title, xName: '월', xUnit: '월', yName: topic.unit === '일' ? '날수' : '횟수', yUnit: topic.unit, scale: s.scale, yStart: 0,
      points, segments, labels, values, checked: true,
      interp: { maxLabel: st.maxLabels[0], minLabel: st.minLabels[0], changeLabel: st.changeLabels[0], sentence: s.sentence },
    };
    db.run("INSERT INTO works(class_id, student_id, kind, topic_id, data, status, updated_at, submitted_at) VALUES (?,?,?,?,?,'approved',?,?)",
      [classId, ids[s.k], 'topic', s.tid, JSON.stringify(data), t, t]);
    const state = JSON.parse(db.get('SELECT state FROM student_state WHERE student_id = ?', [ids[s.k]]).state);
    state.research = { topicId: s.tid };
    state.tables = { [s.tid]: { values, verified: true } };
    db.run('UPDATE student_state SET state = ? WHERE student_id = ?', [JSON.stringify(state), ids[s.k]]);
  }
  return true;
}
