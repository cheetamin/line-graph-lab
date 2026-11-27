// 체험용(가상) 학급 데이터. 실제 운영 데이터와 구분되도록 학급 이름에 '체험용'을 붙이고 is_demo=1로 저장합니다.
// 모든 단계를 둘러볼 수 있도록 기상자료·우리 고장 자료도 '예시(가상) 값'으로 채웁니다. 실제 통계가 아니에요.
import { topicById } from '../shared/topics.js?v=mwy8mt3z';
import { DEFAULT_SETTINGS } from './api.js?v=mwy8mt3z';
import { computeStats } from '../shared/stats.js?v=mwy8mt3z';
import { SCALE_OPTIONS } from '../shared/topics.js?v=mwy8mt3z';
import { DEFAULT_LIFE_SOURCES } from '../shared/life.js?v=mwy8mt3z';

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
  const settings = { ...DEFAULT_SETTINGS, topicMode: 'own', minWorks: 3, school: { name: '체험초등학교', region: '체험시', manual: true }, grade: 4, classNo: 1, nickname: '체험반',
    notice: '체험용 가상 학급입니다. 친구들의 자료와 작품은 예시로 만든 가상 데이터예요.' };
  const c = db.run('INSERT INTO classes(teacher_id, name, code, settings, is_demo, created_at) VALUES (?,?,?,?,1,?)', [teacher.id, '체험용 4학년 1반', code, JSON.stringify(settings), t]);
  const classId = Number(c.lastInsertRowid);
  const hash = await sec.hash(pin);
  const R = rng(20261123);
  const ids = [];
  for (let i = 0; i < NAMES.length; i++) {
    const r = db.run('INSERT INTO students(class_id, number, name, nickname, pin_hash, created_at) VALUES (?,?,?,?,?,?)', [classId, i + 1, NAMES[i], '', hash, t]);
    ids.push(Number(r.lastInsertRowid));
  }
  // 학생마다 스스로 고른 주제 1~4개(친구와 겹쳐도 됨). 1번(체험학생)은 아직 시작 전.
  const pick = (n) => { const p = settings.assignPool.slice(); for (let i = p.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } return p.slice(0, n); };
  // 계절 흐름(1~11월)을 주제 성격에 맞춰 크기만 바꿈
  const shape = [0.45, 0.5, 0.7, 0.8, 1, 0.85, 0.6, 0.35, 0.8, 0.9, 0.75];
  const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30];
  const own = (topic) => shape.map((f, m) => {
    let v;
    if (topic.kind === 'best') v = Math.round(3 + m * 1.8 + R() * 3);
    else if (topic.kind === 'days') v = Math.min(days[m], Math.round(f * (10 + R() * 14)));
    else if (topic.kind === 'hours') v = Math.round(f * (8 + R() * 14) * 2) / 2;
    else v = Math.max(0, Math.round(f * (3 + R() * 9)));
    return v;
  });
  const labels = Array.from({ length: 11 }, (_, i) => `${i + 1}월`);
  const sentences = [
    '봄부터 점점 늘다가 여름 방학인 8월에 가장 많이 줄었어요. 9월에 다시 늘어났어요.',
    '5월에 가장 많았어요. 날씨가 따뜻해서 더 많이 할 수 있었던 것 같아요.',
    '1월과 2월에는 적었지만 학기가 시작되면서 꾸준히 늘어났어요.',
    '8월에 크게 줄었다가 9월에 다시 늘어난 것이 가장 큰 변화예요.',
    '연습할수록 기록이 꾸준히 좋아졌어요. 가을에 늘어나는 폭이 더 커졌어요.',
    '여름보다 봄과 가을에 더 많이 했어요. 방학에는 생활 습관이 달라졌기 때문이라고 생각해요.',
  ];
  let sampleNo = 0;
  const EX = '체험용 예시 자료(실제 값 아님)';
  // 그래프 작품 자료 만들기(모든 점·선분·해석이 맞는 완성 작품)
  const workData = (lb, vals, title, unit, xUnit, yName, sentence) => {
    const mx = Math.max(...vals); const mn = Math.min(...vals);
    // 작은 눈금 한 칸(scale)은 작은 칸이 30칸 안쪽이 되게, 물결선 시작 값은 큰 눈금(작은 5칸) 단위로
    const pickScale = (lo) => SCALE_OPTIONS.filter((o) => o >= 1).find((o) => (mx - lo) / o <= 30) || SCALE_OPTIONS[SCALE_OPTIONS.length - 1];
    let scale = pickScale(0); let yStart = 0;
    if (mn > mx * 0.5) { const s0 = pickScale(mn * 0.8); yStart = Math.floor((mn * 0.8) / (s0 * 5)) * s0 * 5; scale = pickScale(yStart); }
    const points = {}; vals.forEach((v, i) => { points[i] = v; });
    const segments = []; for (let i = 1; i < vals.length; i++) segments.push([i - 1, i]);
    const st = computeStats(lb, vals);
    return { title, xName: xUnit === '년' ? '연도' : '월', xUnit, yName, yUnit: unit, scale, yStart, points, segments, labels: lb, values: vals, checked: true,
      interp: { maxLabel: st.maxLabels[0], minLabel: st.minLabels[0], changeLabel: st.changeLabels[0], sentence } };
  };
  const addWork = (sid, kind, topicId, data, status) => db.run('INSERT INTO works(class_id, student_id, kind, topic_id, data, status, updated_at, submitted_at) VALUES (?,?,?,?,?,?,?,?)',
    [classId, sid, kind, topicId, JSON.stringify(data), status, t, status === 'draft' ? null : t]);
  // 1차 기상자료(예시): 진주 2021~2025년 폭염일수
  const wYears = [2021, 2022, 2023, 2024, 2025];
  const weatherOf = () => { const base = [14, 17, 21, 33, 27]; return base.map((v) => Math.max(3, v + Math.round((R() - 0.5) * 6))); };
  // 3차 우리 고장 자료(예시)
  // 관광지 입장객 수는 공공데이터포털 실제 자료(DEFAULT_LIFE_SOURCES의 data), 공원 수·인구는 예시 값
  const real = (id, from) => { const src = DEFAULT_LIFE_SOURCES.find((x) => x.id === id); const idx = src.data.years.map((y, i) => i).filter((i) => src.data.years[i] >= from && src.data.values[i] !== null);
    return { sourceId: id, subject: src.title, unit: src.unit, years: idx.map((i) => src.data.years[i]), base: idx.map((i) => src.data.values[i]), real: true }; };
  const LIFE = [
    real('forest', 2017), real('zoo', 2017), real('wolasan', 2019), real('leesj', 2017), real('fortress', 2018), real('dino', 2020),
    { sourceId: 'park', subject: '진주시 도시공원 수', unit: '곳', years: [2020, 2021, 2022, 2023, 2024], base: [262, 268, 275, 281, 290] },
  ];
  const lifeSentences = ['2020년에 입장객이 크게 줄었다가 2022년에 다시 많이 늘었어요.', '2019년에서 2020년 사이에 가장 많이 줄었어요. 감염병 때문인 것 같아요.', '해가 갈수록 조금씩 늘어났어요.'];
  // 작품 수: 몇 명은 3개 이상, 몇 명은 1~2개 (1번 체험학생은 아래에서 따로)
  const plan = [0, 3, 4, 2, 3, 1, 3, 2, 0, 3, 1, 0, 2, 0, 1, 0, 0, 1, 0, 0];
  for (let k = 0; k < ids.length; k++) {
    const sid = ids[k];
    const me = k === 0; // 1번 체험학생: 모든 단계를 직접 둘러볼 수 있게
    const nWorks = me ? 3 : plan[k] || 0;
    const topics = pick(me ? 4 : Math.max(1, nWorks + (R() < 0.4 ? 1 : 0))).map(topicById);
    if (me) topics.splice(0, topics.length, ...[3, 7, 11, 22].map(topicById));
    const wv = weatherOf();
    const state = {
      weatherDone: true, tables: {}, research: { topicId: topics[topics.length - 1].id },
      weather: { region: '진주', station: '진주', source: EX, visited: true, years: wYears, values: wv, tableChecked: true },
    };
    if (me || k % 3 === 1) addWork(sid, 'weather', null, workData(wYears.map((y) => `${y}년`), wv, '진주의 연도별 폭염일수', '일', '년', '폭염일수', '2024년에 폭염일수가 가장 많았어요. 2023년에서 2024년 사이에 가장 많이 늘었어요.'), 'approved');
    topics.forEach((topic, ti) => {
      const vals = own(topic);
      for (let m = 1; m <= 11; m++) {
        db.run('INSERT INTO responses(class_id, student_id, topic_id, month, status, value, source, updated_at) VALUES (?,?,?,?,?,?,?,?)',
          [classId, sid, topic.id, m, 'value', vals[m - 1], R() < 0.5 ? 'record' : 'memory', t]);
      }
      db.run('INSERT INTO submissions(class_id, student_id, topic_id, submitted_at) VALUES (?,?,?,?)', [classId, sid, topic.id, t]);
      if (me && ti === topics.length - 1) { state.tables[topic.id] = { values: vals, verified: true }; return; } // 표까지 완성 → 그래프는 직접 그려 보기
      if (ti >= nWorks) return;
      state.tables[topic.id] = { values: vals, verified: true };
      const data = workData(labels, vals, `나의 ${topic.name.replace(/^월별 /, '')}`, topic.unit, '월', topic.unit === '일' ? '날수' : topic.unit === '시간' ? '시간' : '횟수', sentences[sampleNo++ % sentences.length]);
      addWork(sid, `topic:${topic.id}`, topic.id, data, me ? (ti === 2 ? 'submitted' : 'approved') : (R() < 0.8 ? 'approved' : 'submitted'));
    });
    // 3차 우리 고장
    // 1번 체험학생은 3차를 처음부터 직접 해 보도록 비워 둬요(자료 고르기 → 연도만 채워진 표에 수 옮겨 적기)
    if (!me && (k % 2 === 0 || k % 5 === 1)) {
      const ex = LIFE[k % LIFE.length];
      const vals = ex.real ? ex.base.slice() : ex.base.map((v) => v + Math.round((R() - 0.5) * 4));
      state.life = { sourceId: ex.sourceId, subject: ex.subject, unit: ex.unit, source: ex.real ? '공공데이터포털 경상남도 주요관광지점 입장객 현황' : EX, visited: true, years: ex.years, values: vals, tableChecked: true,
        predict: me ? '' : '다음 해에도 비슷하게 변할 것 같아요. 지금까지 같은 방향으로 꾸준히 변했기 때문이에요.' };
      if (!me) addWork(sid, 'life', null, { ...workData(ex.years.map((y) => `${y}년`), vals, `연도별 ${ex.subject}`, ex.unit, '년', ex.unit === '곳' ? '공원 수' : '입장객 수', lifeSentences[k % lifeSentences.length]), subject: ex.subject }, R() < 0.8 ? 'approved' : 'submitted');
    }
    db.run('INSERT INTO student_state(student_id, class_id, state, updated_at) VALUES (?,?,?,?)', [sid, classId, JSON.stringify(state), t]);
  }
  // 만족도 조사 예시: 세 활동을 다 낸 학생 중 일부(3번 이도윤은 직접 해 볼 수 있게 비워 둠)
  const comments = ['진주 자료로 그래프를 그린 게 제일 재미있었어요.', '눈금 정하는 게 처음엔 어려웠지만 이제 알겠어요.', '', '친구 그래프를 보는 게 좋았어요.', ''];
  const bests = ['1차 기상자료 탐험실', '2차 나의 주제 그래프', '3차 우리 고장 그래프', '작품 전시관 감상'];
  ids.forEach((sid, k) => {
    if (k === 2 || k === 0) return;
    const ok = (like) => db.get(`SELECT 1 AS x FROM works WHERE student_id = ? AND kind LIKE ? AND status IN ('submitted','approved')`, [sid, like]);
    if (!ok('topic:%') || !ok('life') || R() < 0.25) return;
    const sc = () => Math.min(5, Math.max(2, Math.round(3.8 + (R() - 0.4) * 2.4)));
    const ans = { fun: sc(), understand: sc(), draw: sc(), life: sc(), easy: sc(), best: bests[Math.floor(R() * bests.length)] };
    const cm = comments[k % comments.length]; if (cm) ans.comment = cm;
    db.run('INSERT INTO surveys(class_id, role, user_id, answers, updated_at) VALUES (?,?,?,?,?)', [classId, 'student', sid, JSON.stringify(ans), t]);
  });
  return true;
}
