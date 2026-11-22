// 교사 관리실
import { h, A, btn, toast, modal, confirmBox, fmt } from '../ui.js';
import { api, isDemo } from '../api.js';
import { S } from '../store.js';
import { logout } from '../main.js';
import { TOPICS, CATEGORIES, topicById } from '../../shared/topics.js';
import { renderStatic } from '../graph.js';
import { makeHeader } from '../shell.js';

const TABS = [['progress', '진행 현황'], ['picker', '학생 뽑기'], ['roster', '학생 명단'], ['topics', '주제·투표'], ['settings', '단계·조사 설정'], ['aggregate', '학급 집계'], ['works', '작품 승인'], ['export', '자료 내려받기'], ['account', '계정']];
let classes = []; let cur = null; let tab = 'progress';

export async function mountTeacher(root) {
  const t = S.me.teacher;
  root.append(
    makeHeader({ sub: '교사 관리실', right: [h('b', null, t.name), h('button', { class: 'top-btn', type: 'button', onClick: () => logout() }, '나가기')] }),
    h('main', { class: 'admin' }, h('div', { class: 'admin-grid' }, h('aside', { class: 'admin-side', id: 'side' }), h('section', { class: 'admin-main', id: 'main' }))));
  await loadClasses();
}

async function loadClasses(selectId) {
  classes = (await api('GET', '/api/teacher/classes')).classes;
  cur = classes.find((c) => c.id === (selectId ?? cur?.id)) || classes[0] || null;
  drawSide(); drawMain();
}

function drawSide() {
  const side = document.getElementById('side');
  const name = h('input', { type: 'text', placeholder: '예: 4학년 2반', maxlength: 40, 'aria-label': '새 학급 이름' });
  side.replaceChildren(
    h('div', { class: 'sheet', style: { padding: '14px' } },
      h('h3', null, '나의 학급'),
      h('div', { class: 'stack', style: { gap: '6px' } }, classes.length ? classes.map((c) => h('button', { type: 'button', class: 'class-pill', 'aria-current': String(c.id === cur?.id), onClick: () => { cur = c; drawSide(); drawMain(); } },
        h('b', null, c.name, c.isDemo ? ' (체험용)' : ''), h('span', { class: 'code' }, `코드 ${c.code}`), h('span', { class: 'small' }, `학생 ${c.students}명`, c.pending ? ` · 승인 대기 ${c.pending}` : ''))) : h('p', { class: 'small' }, '아직 학급이 없어요. 아래에서 만들어 주세요.')),
      h('form', { class: 'stack', style: { marginTop: '12px', gap: '6px' }, onSubmit: async (e) => {
        e.preventDefault();
        try { const r = await api('POST', '/api/teacher/classes', { name: name.value }); toast(`학급을 만들었어요. 학급 코드: ${r.code}`, 'ok'); tab = 'roster'; await loadClasses(r.id); } catch (ex) { toast(ex.message, 'bad'); }
      } }, h('label', { class: 'field' }, h('span', null, '새 학급 만들기'), name), btn('학급 만들기', null, { variant: 'green small', type: 'submit' }))));
}

function drawMain() {
  const main = document.getElementById('main');
  if (!cur) { main.replaceChildren(h('div', { class: 'sheet' }, h('h2', null, '교사 관리실에 오신 것을 환영합니다'), h('p', null, '왼쪽에서 학급을 먼저 만들어 주세요. 학급을 만들면 학생 명단을 등록하고 학생별 PIN을 나누어 줄 수 있어요.'))); return; }
  const body = h('div');
  main.replaceChildren(
    h('div', { class: 'sheet', style: { paddingBottom: '12px' } },
      h('div', { class: 'row between' }, h('h2', { style: { margin: 0 } }, cur.name), h('div', { class: 'row' }, h('span', null, '학급 코드 '), h('b', { style: { fontFamily: 'monospace', fontSize: '1.5rem', letterSpacing: '.15em' } }, cur.code))),
      h('div', { class: 'admin-tabs', role: 'tablist', style: { marginTop: '12px', marginBottom: 0 } }, TABS.map(([k, l]) => h('button', { type: 'button', role: 'tab', class: 'admin-tab', 'aria-selected': String(tab === k), onClick: () => { tab = k; drawMain(); } }, l)))),
    body);
  const fn = { progress, picker, roster, topics, settings, aggregate, works, exporter, account }[tab === 'export' ? 'exporter' : tab];
  fn(body).catch?.((e) => body.replaceChildren(h('div', { class: 'sheet' }, h('p', { class: 'err-text' }, e.message))));
}

async function saveSettings(patch, msg = '저장했어요.') {
  try { const r = await api('PUT', `/api/teacher/classes/${cur.id}`, { settings: patch }); cur.settings = r.settings; if (msg) toast(msg, 'ok'); return true; } catch (e) { toast(e.message, 'bad'); return false; }
}
const sheet = (...kids) => h('div', { class: 'sheet' }, ...kids);
const toggle = (label, checked, on) => h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked, onChange: (e) => on(e.target.checked) }), label);

async function progress(el) {
  const r = await api('GET', `/api/teacher/classes/${cur.id}/progress`);
  const rows = r.rows;
  const count = (f) => rows.filter(f).length;
  el.replaceChildren(sheet(
    h('div', { class: 'row between' }, h('h3', null, '학생별 진행 현황'), btn('새로고침', () => drawMain(), { variant: 'green small' })),
    h('div', { class: 'row', style: { marginBottom: '10px' } },
      h('span', { class: 'badge ok' }, `기상자료 완료 ${count((x) => x.weatherDone)}/${rows.length}`),
      h('span', { class: 'badge' }, `투표 ${count((x) => x.vote)}/${rows.length}`),
      h('span', { class: 'badge' }, `표 완성 ${count((x) => x.table === '완성')}/${rows.length}`),
      h('span', { class: 'badge' }, `그래프 제출 ${count((x) => /승인/.test(x.graph))}/${rows.length}`)),
    rows.length ? h('div', { class: 'table-scroll' }, h('table', { class: 'admin-table' },
      h('thead', null, h('tr', null, ['번호', '이름', '기상자료', '추천 투표', '월별 조사 제출', '연구 주제', '자료표', '그래프', ''].map((x) => h('th', null, x)))),
      h('tbody', null, rows.map((p) => h('tr', null,
        h('td', null, p.number), h('td', { class: 'l' }, p.name),
        h('td', null, h('span', { class: `badge ${p.weatherDone ? 'ok' : ''}` }, p.weather)),
        h('td', { class: 'l small' }, p.vote ? topicById(p.vote).name.replace('월별 ', '') : '—'),
        h('td', null, `${p.surveys.filter((id) => cur.settings.activeTopics.includes(id)).length} / ${cur.settings.activeTopics.length}`),
        h('td', { class: 'l small' }, p.research ? topicById(p.research).name.replace('월별 ', '') : '—'),
        h('td', null, p.table), h('td', { class: 'small' }, p.graph),
        h('td', null, h('button', { class: 'link-btn', type: 'button', onClick: () => studentDetail(p.id) }, '자세히'))))))) : h('p', null, '학생 명단을 먼저 등록해 주세요.')));
}

async function studentDetail(id) {
  const r = await api('GET', `/api/teacher/students/${id}`);
  const w = r.state.weather || {};
  const works = r.works.map((x) => h('div', { style: { marginTop: '8px' } }, h('b', null, x.kind === 'weather' ? '폭염일수 그래프' : topicById(x.topicId)?.name), ` (${x.status})`, x.data.labels ? renderStatic(x.data) : null));
  const resp = {};
  r.responses.forEach((x) => { (resp[x.topic_id] = resp[x.topic_id] || []).push(x); });
  await modal({
    wide: true, title: `${r.student.number}번 ${r.student.name}`,
    body: h('div', { class: 'stack' },
      h('div', null, h('b', null, '기상자료: '), w.region ? `${w.region} / ${(w.years || []).map((y, i) => `${y}년 ${w.values?.[i] ?? ''}일`).join(', ')}` : '아직 없음', ` · 출처: ${w.source || '-'}`),
      h('div', { class: 'row' },
        toggle('기상자료 단계 예외 허용(다음 장 열어 주기)', r.student.weatherOverride, async (v) => { await api('PUT', `/api/teacher/students/${id}`, { weatherOverride: v }); toast('바꾸었어요.', 'ok'); }),
        btn('기상자료 다시 하게 하기', async () => { if (await confirmBox('기상자료 다시 하기', '이 학생의 기상자료 완료를 취소하고 다시 고칠 수 있게 할까요?')) { await api('PUT', `/api/teacher/students/${id}`, { resetWeather: true }); toast('다시 할 수 있게 했어요.', 'ok'); } }, { variant: 'small green' })),
      ...Object.entries(resp).map(([tid, list]) => h('div', null, h('b', null, topicById(tid).name), ': ', list.map((x) => `${x.month}월 ${x.status === 'unknown' ? '모름' : fmt(x.value)}${x.source === 'record' ? '(기록)' : ''}`).join(', '))),
      ...works),
  });
}

async function roster(el) {
  const r = await api('GET', `/api/teacher/classes/${cur.id}/students`);
  const ta = h('textarea', { placeholder: '한 줄에 한 명씩 "번호 이름" 형식으로 적어요.\n1 김하늘\n2 이도윤\n3 박서연', rows: 8 });
  const pinBox = h('div');
  const showPins = (list, title) => {
    pinBox.replaceChildren(sheet(h('div', { class: 'row between' }, h('h3', null, title), btn('인쇄하기', () => window.print(), { variant: 'small green' })),
      h('p', { class: 'small' }, '⚠ PIN은 지금 한 번만 보여요. 인쇄하거나 적어 두세요. 잊어버리면 [PIN 새로 만들기]를 누르면 돼요.'),
      h('div', { class: 'pin-cards' }, list.map((c) => h('div', { class: 'pin-card' }, h('div', null, `학급 코드 ${cur.code}`), h('div', null, `${c.number}번 ${c.name}`), h('b', null, c.pin))))));
    pinBox.scrollIntoView({ behavior: 'smooth' });
  };
  el.replaceChildren(
    sheet(h('h3', null, `학생 명단 (${r.students.length}명)`),
      r.students.length ? h('div', { class: 'table-scroll' }, h('table', { class: 'admin-table' },
        h('thead', null, h('tr', null, ['번호', '이름', '별명(전시용)', '관리'].map((x) => h('th', null, x)))),
        h('tbody', null, r.students.map((st) => {
          const nm = h('input', { type: 'text', value: st.name, 'aria-label': '이름', style: { minHeight: '38px' } });
          const nick = h('input', { type: 'text', value: st.nickname, 'aria-label': '별명', style: { minHeight: '38px' } });
          return h('tr', null, h('td', null, st.number), h('td', null, nm), h('td', null, nick),
            h('td', null, h('div', { class: 'row', style: { justifyContent: 'center', gap: '4px' } },
              btn('저장', async () => { try { await api('PUT', `/api/teacher/students/${st.id}`, { name: nm.value, nickname: nick.value }); toast('저장했어요.', 'ok'); } catch (e) { toast(e.message, 'bad'); } }, { variant: 'small green' }),
              btn('PIN 새로 만들기', async () => { if (!(await confirmBox('PIN 새로 만들기', `${st.number}번 ${st.name} 학생의 PIN을 새로 만들까요? 예전 PIN으로는 들어올 수 없어요.`))) return; const p = await api('POST', `/api/teacher/students/${st.id}/pin`); showPins([{ number: st.number, name: st.name, pin: p.pin }], '새 PIN'); }, { variant: 'small' }),
              btn('삭제', async () => { if (!(await confirmBox('학생 삭제', `${st.number}번 ${st.name} 학생과 그 학생의 모든 자료를 지울까요? 되돌릴 수 없어요.`, '삭제'))) return; await api('DELETE', `/api/teacher/students/${st.id}`); toast('삭제했어요.'); loadClasses(); }, { variant: 'small' }))));
        })))) : h('p', null, '아직 등록된 학생이 없어요.')),
    sheet(h('h3', null, '학생 여러 명 한꺼번에 등록'), ta,
      h('div', { class: 'row', style: { marginTop: '8px' } }, btn('등록하고 PIN 만들기', async () => {
        const list = ta.value.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const m = l.match(/^(\d+)[\s.,)번]*\s*(.+)$/); return m ? { number: +m[1], name: m[2].trim() } : { number: NaN, name: l }; });
        if (!list.length) return toast('명단을 적어 주세요.', 'bad');
        try { const res = await api('POST', `/api/teacher/classes/${cur.id}/students`, { students: list }); ta.value = ''; pendingPins = res.created; tab = 'roster'; await loadClasses(); } catch (e) { toast(e.message, 'bad'); }
      }, { variant: 'gold' }), h('span', { class: 'small muted' }, '학생은 학급 코드 + 번호 + PIN 4자리로 들어와요.'))),
    pinBox);
  if (pendingPins) { const list = pendingPins; pendingPins = null; showPins(list, `새로 등록한 학생 PIN (${list.length}명)`); }
}
let pendingPins = null;

async function topics(el) {
  const ag = await api('GET', `/api/teacher/classes/${cur.id}/aggregate`);
  const s = cur.settings;
  const active = new Set(s.activeTopics);
  const totalVotes = Object.values(ag.votes).reduce((a, b) => a + b, 0);
  el.replaceChildren(
    sheet(h('h3', null, '추천 투표'),
      h('div', { class: 'row' }, toggle('추천 투표 받기', s.voteOpen, (v) => saveSettings({ voteOpen: v }, v ? '투표를 시작했어요.' : '투표를 마감했어요.')), h('span', { class: 'small muted' }, `${ag.students}명 중 ${totalVotes}명 투표`)),
      h('div', { class: 'vote-bars', style: { marginTop: '10px' } }, Object.entries(ag.votes).sort((a, b) => b[1] - a[1]).map(([id, n]) => h('div', { class: 'vote-bar' }, h('span', null, `${id}. ${topicById(id).name}`), h('b', null, `${n}표`), h('div', { class: 'bar' }, h('i', { style: { width: `${(n / Math.max(...Object.values(ag.votes))) * 100}%` } })))))),
    sheet(h('h3', null, '우리 반 조사 주제 열기'), h('p', { class: 'small' }, '체크한 주제만 학생들이 월별 경험을 입력할 수 있어요. 학생은 연 주제 중 하나를 연구 주제로 골라요.'),
      ...CATEGORIES.map((c) => h('div', { style: { marginBottom: '10px' } }, h('b', null, c.name), h('div', { class: 'topic-toggle-grid', style: { marginTop: '4px' } },
        TOPICS.filter((t) => t.cat === c.id).map((t) => h('label', { class: 'topic-toggle' }, h('input', { type: 'checkbox', checked: active.has(t.id), onChange: (e) => { if (e.target.checked) active.add(t.id); else active.delete(t.id); } }), h('span', null, `${t.id}. ${t.name}`), h('span', { class: 'badge' }, `${ag.votes[t.id] || 0}표`)))))),
      btn('조사 주제 저장', () => saveSettings({ activeTopics: [...active] }, '조사 주제를 저장했어요.'), { variant: 'gold' })));
}

async function settings(el) {
  const s = cur.settings;
  const stageNames = { weather: '1. 기상자료 탐험실', topics: '2. 주제 선택·투표·월별 조사', table: '3. 자료표 만들기', graph: '4. 꺾은선그래프 그리기', gallery: '5. 작품 전시관' };
  const guide = h('textarea', { rows: 7 }); guide.value = s.kmaGuide;
  const url = h('input', { type: 'text', value: s.kmaUrl });
  const notice = h('input', { type: 'text', value: s.notice, maxlength: 300, placeholder: '학생 목차 쪽에 보이는 알림' });
  const cname = h('input', { type: 'text', value: cur.name });
  const sel = (key, opts) => h('select', { onChange: (e) => saveSettings({ [key]: e.target.value }) }, opts.map(([v, l]) => h('option', { value: v, selected: s[key] === v ? true : undefined }, l)));
  const mf = h('select', null, Array.from({ length: 12 }, (_, i) => h('option', { value: i + 1, selected: s.monthFrom === i + 1 ? true : undefined }, `${i + 1}월`)));
  const mt = h('select', null, Array.from({ length: 12 }, (_, i) => h('option', { value: i + 1, selected: s.monthTo === i + 1 ? true : undefined }, `${i + 1}월`)));
  el.replaceChildren(
    sheet(h('h3', null, '학습 단계 열기·잠그기'), h('p', { class: 'small' }, '잠근 단계는 학생에게 봉인되어 보여요. 열어도 앞 단계를 마쳐야 들어갈 수 있어요(기상자료 탐험은 필수).'),
      h('div', { class: 'stack', style: { gap: '6px' } }, Object.entries(stageNames).map(([k, l]) => toggle(l, s.stages[k], (v) => saveSettings({ stages: { [k]: v } }))))),
    sheet(h('h3', null, '월별 조사'),
      h('div', { class: 'stack', style: { gap: '6px' } },
        toggle('월별 조사 받기', s.surveyOpen, (v) => saveSettings({ surveyOpen: v }, v ? '조사를 열었어요.' : '조사를 마감했어요.')),
        toggle('제출한 뒤에도 고칠 수 있게 하기', s.allowEdit, (v) => saveSettings({ allowEdit: v })),
        h('div', { class: 'row' }, h('span', null, '조사 기간'), mf, h('span', null, '~'), mt, btn('기간 저장', () => saveSettings({ monthFrom: +mf.value, monthTo: +mt.value }), { variant: 'small green' })))),
    sheet(h('h3', null, '자료표·전시·개인정보'),
      h('div', { class: 'stack' },
        toggle('자료표 만들기에서 우리 반 참고 자료 보여 주기', s.tableRefVisible, (v) => saveSettings({ tableRefVisible: v })),
        h('label', { class: 'field' }, h('span', null, '참고 자료 형태'), sel('tableRefMode', [['list', '친구들 응답 목록(이름 없이) — 학생이 직접 더하기'], ['total', '학급 합계 — 학생이 옮겨 적기']])),
        h('label', { class: 'field' }, h('span', null, '19번 용돈 저축 금액 공개 방식'), sel('savingsMode', [['total', '학급 합계만 공개'], ['average', '학급 평균만 공개'], ['hidden', '공개하지 않음(연구 주제로 고를 수 없음)']])),
        h('label', { class: 'field' }, h('span', null, '전시관 이름 표시'), sel('displayName', [['name', '이름'], ['number', '번호(○번 연구원)'], ['nickname', '별명']])))),
    sheet(h('h3', null, '기상자료 조사 안내'),
      h('label', { class: 'field' }, h('span', null, '포털 주소'), url),
      h('label', { class: 'field' }, h('span', null, '학생에게 보여 줄 찾는 방법(누리집이 바뀌면 고쳐 주세요)'), guide),
      btn('안내 저장', () => saveSettings({ kmaUrl: url.value, kmaGuide: guide.value }), { variant: 'green small' })),
    sheet(h('h3', null, '학급 정보'),
      h('label', { class: 'field' }, h('span', null, '학급 이름'), cname),
      h('label', { class: 'field' }, h('span', null, '학생 알림'), notice),
      h('div', { class: 'row', style: { marginTop: '8px' } },
        btn('저장', async () => { try { await api('PUT', `/api/teacher/classes/${cur.id}`, { name: cname.value, settings: { notice: notice.value } }); toast('저장했어요.', 'ok'); loadClasses(); } catch (e) { toast(e.message, 'bad'); } }, { variant: 'green small' }),
        btn('학급 코드 새로 만들기', async () => { if (!(await confirmBox('학급 코드 바꾸기', '새 코드를 만들면 예전 코드로는 들어올 수 없어요. 바꿀까요?'))) return; await api('POST', `/api/teacher/classes/${cur.id}/code`); loadClasses(); }, { variant: 'small' }),
        btn('학급 삭제', async () => { if (!(await confirmBox('학급 삭제', `${cur.name}과 학생·응답·작품을 모두 지울까요? 되돌릴 수 없어요.`, '삭제'))) return; await api('DELETE', `/api/teacher/classes/${cur.id}`); cur = null; loadClasses(); }, { variant: 'small' }))));
}

async function aggregate(el) {
  const ag = await api('GET', `/api/teacher/classes/${cur.id}/aggregate`);
  el.replaceChildren(...(ag.topics.length ? ag.topics.map((t) => {
    const topic = topicById(t.topicId);
    const labels = t.rows.map((r) => `${r.month}월`); const values = t.rows.map((r) => r.value);
    const finite = values.filter((v) => v !== null);
    return sheet(
      h('div', { class: 'row between' }, h('h3', null, topic.name), h('span', { class: 'badge' }, `제출 ${t.submitted}/${ag.students}명 · ${t.mode === 'avg' ? '평균' : '합계'}`)),
      h('div', { class: 'table-scroll' }, h('table', { class: 'admin-table' },
        h('tr', null, h('th', null, '월'), labels.map((l) => h('th', null, l))),
        h('tr', null, h('th', null, `${t.mode === 'avg' ? '평균' : '합계'}(${topic.unit})`), values.map((v) => h('td', null, v === null ? '—' : fmt(v)))),
        h('tr', null, h('th', null, '응답 수'), t.rows.map((r) => h('td', null, r.responders))),
        h('tr', null, h('th', null, '모름'), t.rows.map((r) => h('td', null, r.unknown))))),
      finite.length ? h('div', { style: { maxWidth: '760px', marginTop: '10px' } }, renderStatic({ title: `우리 반 ${topic.name}`, labels, values, points: Object.fromEntries(values.map((v, i) => [i, v]).filter(([, v]) => v !== null)), segments: values.slice(1).map((_, i) => [i, i + 1]).filter(([a, b]) => values[a] !== null && values[b] !== null), xUnit: '월', yUnit: topic.unit, yName: topic.unit === '일' ? '날수' : '수량', xName: '월' }, { showValues: true })) : null);
  }) : [sheet(h('p', null, '조사 주제를 열고 학생들이 응답하면 여기에 집계가 나타나요.'))]));
}

async function works(el) {
  const r = await api('GET', `/api/teacher/classes/${cur.id}/works`);
  const label = { submitted: ['승인 대기', 'warn'], approved: ['승인됨', 'ok'], rejected: ['다시 그리기 요청', 'red'] };
  el.replaceChildren(sheet(h('h3', null, `제출된 작품 (${r.works.length})`), h('p', { class: 'small' }, '승인한 작품만 같은 학급 학생들의 전시관에 보여요.'),
    r.works.length ? null : h('p', null, '아직 제출된 작품이 없어요.'),
    ...r.works.map((w) => {
      const fb = h('input', { type: 'text', placeholder: '한마디(선택)', value: w.feedback || '' });
      const act = async (action) => { try { await api('POST', `/api/teacher/works/${w.id}/review`, { action, feedback: fb.value }); toast('처리했어요.', 'ok'); loadClasses(); } catch (e) { toast(e.message, 'bad'); } };
      const st = w.stats;
      return h('div', { class: 'work-review' },
        h('div', null, renderStatic(w.data, { showValues: true })),
        h('div', { class: 'stack' },
          h('div', { class: 'row' }, h('b', null, `${w.number}번 ${w.name}`), h('span', { class: `badge ${label[w.status]?.[1] || ''}` }, label[w.status]?.[0] || w.status)),
          h('div', null, w.topicName),
          st ? h('div', { class: 'small' }, `가장 큰 값 ${st.maxLabels.join(', ')} · 가장 작은 값 ${st.minLabels.join(', ')} · 변화가 가장 큰 시기 ${st.changeLabels.join(', ')}`) : null,
          h('div', { class: 'note green small' }, w.data.interp?.sentence || '(해석 없음)'),
          fb,
          h('div', { class: 'row' },
            w.status !== 'approved' ? btn('승인(전시)', () => act('approve'), { variant: 'gold small' }) : btn('전시 내리기', () => act('unpublish'), { variant: 'small green' }),
            w.status !== 'rejected' ? btn('다시 그리기 요청', () => act('reject'), { variant: 'small' }) : null,
            btn('삭제', async () => { if (!(await confirmBox('작품 삭제', '이 작품을 지울까요? 학생은 처음부터 다시 그려야 해요.', '삭제'))) return; await api('DELETE', `/api/teacher/works/${w.id}`); loadClasses(); }, { variant: 'small' }))));
    })));
}

async function exporter(el) {
  const items = [['responses', '학생별 월별 응답 (실제 기록/기억 추정/모름 포함)'], ['aggregate', '학급 월별 집계'], ['progress', '학생별 진행 현황'], ['weather', '기상자료(폭염일수) 조사 결과']];
  const get = async (type) => {
    if (isDemo()) {
      const r = await window.__KGL_DEMO__('GET', `/api/teacher/classes/${cur.id}/export?type=${type}`);
      const ta = h('textarea', { rows: 12, readonly: true }); ta.value = r.csv;
      modal({ wide: true, title: '체험판에서는 파일 내려받기 대신 내용을 보여 드려요', body: ta, actions: [{ label: '복사하기', value: () => { navigator.clipboard?.writeText(r.csv).then(() => toast('복사했어요.', 'ok')).catch(() => toast('직접 선택해 복사해 주세요.')); return null; } }, { label: '닫기', value: null }] });
      return;
    }
    location.href = `/api/teacher/classes/${cur.id}/export?type=${type}`;
  };
  el.replaceChildren(sheet(h('h3', null, '자료 내려받기 (CSV · 엑셀에서 열림)'), h('div', { class: 'stack' }, items.map(([k, l]) => h('div', { class: 'row between' }, h('span', null, l), btn('내려받기', () => get(k), { variant: 'small green' }))))));
}

async function account(el) {
  const c = h('input', { type: 'password', autocomplete: 'current-password' });
  const n = h('input', { type: 'password', autocomplete: 'new-password', placeholder: '8자 이상' });
  el.replaceChildren(sheet(h('h3', null, '비밀번호 바꾸기'),
    h('form', { class: 'stack', style: { maxWidth: '360px' }, onSubmit: async (e) => { e.preventDefault(); try { await api('POST', '/api/teacher/password', { current: c.value, next: n.value }); toast('비밀번호를 바꾸었어요.', 'ok'); c.value = ''; n.value = ''; } catch (ex) { toast(ex.message, 'bad'); } } },
      h('label', { class: 'field' }, h('span', null, '현재 비밀번호'), c), h('label', { class: 'field' }, h('span', null, '새 비밀번호'), n), btn('바꾸기', null, { variant: 'green', type: 'submit' }))));
}


// ───────── 학생 뽑기: 등록한 학생 중 버튼을 누를 때마다 한 명씩 무작위로 ─────────
async function picker(el) {
  const list = (await api('GET', `/api/teacher/classes/${cur.id}/students`)).students;
  if (!list.length) { el.replaceChildren(sheet(h('h3', null, '학생 뽑기'), h('p', null, '학생 명단을 먼저 등록해 주세요.'), btn('학생 명단으로', () => { tab = 'roster'; drawMain(); }, { variant: 'small green' }))); return; }
  const st = cur.settings;
  let picked = (st.picked || []).filter((id) => list.some((x) => x.id === id));
  let noRepeat = st.pickNoRepeat !== false;
  let rolling = false;
  const label = (x) => `${x.number}번 ${x.name}`;
  const nameEl = h('div', { class: 'pick-name', 'aria-live': 'assertive' }, '?');
  const subEl = h('div', { class: 'pick-sub' }, '버튼을 눌러 한 명을 뽑아요');
  const stage = h('div', { class: 'pick-stage' }, h('img', { class: 'pick-seal', src: 'assets/art/seal_wait.png', alt: '' }), nameEl, subEl);
  const left = h('span', { class: 'badge' });
  const hist = h('div', { class: 'pick-history' });
  const pickBtn = btn('한 명 뽑기', () => roll(), { variant: 'gold big' });
  const save = () => saveSettings({ picked, pickNoRepeat: noRepeat }, '').catch(() => {});
  const pool = () => (noRepeat ? list.filter((x) => !picked.includes(x.id)) : list);
  const draw = () => {
    const remain = list.length - picked.length;
    left.textContent = noRepeat ? `남은 학생 ${remain}명 / 전체 ${list.length}명` : `전체 ${list.length}명 (중복 허용)`;
    hist.replaceChildren(...(picked.length ? picked.map((id, i) => { const x = list.find((y) => y.id === id); return h('span', { class: 'pick-chip' }, `${i + 1}. ${label(x)}`); }) : [h('span', { class: 'small muted' }, '아직 뽑힌 학생이 없어요.')]));
    pickBtn.disabled = rolling || (noRepeat && remain === 0);
    if (noRepeat && remain === 0 && !rolling) subEl.textContent = '모든 학생을 뽑았어요. [처음부터 다시]를 눌러요.';
  };
  async function roll() {
    const cand = pool();
    if (!cand.length || rolling) return;
    rolling = true; draw();
    const chosen = cand[Math.floor(Math.random() * cand.length)];
    stage.classList.remove('done'); stage.classList.add('rolling');
    subEl.textContent = '두근두근…';
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const steps = reduce ? 1 : 22;
    for (let i = 0; i < steps; i++) {
      const x = i === steps - 1 ? chosen : cand[Math.floor(Math.random() * cand.length)];
      nameEl.textContent = label(x);
      nameEl.animate([{ transform: 'translateY(-30%)', opacity: 0.2 }, { transform: 'none', opacity: 1 }], { duration: 70 });
      await new Promise((r) => setTimeout(r, 30 + i * i * 0.3)); // 점점 느려짐(약 1.6초)
    }
    stage.classList.remove('rolling'); stage.classList.add('done');
    nameEl.animate([{ transform: 'scale(.7)', opacity: 0 }, { transform: 'scale(1.12)', opacity: 1, offset: 0.6 }, { transform: 'scale(1)' }], { duration: 420, easing: 'cubic-bezier(.3,1.4,.5,1)' });
    subEl.textContent = '당첨!';
    picked.push(chosen.id);
    rolling = false; draw(); save();
  }
  const fullBtn = btn('전체 화면으로 보기', () => { const sh = el.querySelector('.pick-sheet'); (sh.requestFullscreen?.() || Promise.reject()).catch(() => toast('이 화면에서는 전체 화면을 쓸 수 없어요.')); }, { variant: 'small green' });
  el.replaceChildren(
    h('div', { class: 'sheet pick-sheet' },
      h('div', { class: 'row between' }, h('h3', { style: { margin: 0 } }, '학생 뽑기'), h('div', { class: 'row' }, left, fullBtn)),
      h('p', { class: 'small muted' }, '학생 명단에 등록한 학생 중에서 버튼을 누를 때마다 한 명씩 무작위로 뽑아요. 발표·순서 정하기에 써요.'),
      stage,
      h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '14px' } }, pickBtn),
      h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '10px', gap: '14px' } },
        h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: noRepeat, onChange: (e) => { noRepeat = e.target.checked; draw(); save(); } }), '한 번 뽑힌 학생은 다시 뽑지 않기'),
        btn('처음부터 다시', async () => { if (picked.length && !(await confirmBox('처음부터 다시', '뽑힌 학생 기록을 지우고 처음부터 다시 뽑을까요?', '다시 시작'))) return; picked = []; nameEl.textContent = '?'; subEl.textContent = '버튼을 눌러 한 명을 뽑아요'; stage.classList.remove('done'); draw(); save(); }, { variant: 'small' })),
      h('h3', { style: { marginTop: '18px' } }, '뽑힌 순서'), hist));
  draw();
}
