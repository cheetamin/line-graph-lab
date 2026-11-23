// 교사 관리실 — 학생 화면과 같은 고서 배경 장면(왼쪽 판 6개 = 메뉴, 펼친 책 두 쪽 = 내용)
import { h, A, btn, toast, modal, confirmBox, fmt, iconSrc, sealImg } from '../ui.js';
import { api, isDemo } from '../api.js';
import { S } from '../store.js';
import { logout } from '../main.js';
import { TOPICS, CATEGORIES, topicById } from '../../shared/topics.js';
import { renderStatic } from '../graph.js';
import { makeHeader, scene, lanternImg, deskProps } from '../shell.js';
import { Book } from '../book.js';
import { PageTurner } from '../pageturn.js';
import { surveyForm } from './survey.js';
import { SCALE_LABELS } from '../../shared/survey.js';
import { buildLifeSources, normalizeRegion, hasTourData, regionFromAddress } from '../../shared/life.js';
import { qrSvg, joinUrl, getBase, setBase, defaultBase } from '../qr.js';
import { OFFICES } from '../../shared/neis.js';

const SECTIONS = [
  { key: 'class', label: '학급·명단', icon: 'home', subs: [['roster', '학생 명단'], ['qr', '학급 정보·QR']] },
  { key: 'progress', label: '진행 현황', icon: 'search', subs: [['progress', '진행 현황'], ['picker', '학생 뽑기']] },
  { key: 'assign', label: '학생 주제', icon: 'vote', subs: [['mine', '학생별 주제'], ['topics', '주제 묶음·방식']] },
  { key: 'works', label: '작품 승인', icon: 'gallery', subs: [['works', '작품 승인']] },
  { key: 'data', label: '기록·내려받기', icon: 'table', subs: [['records', '기록 모아보기'], ['survey', '만족도 조사'], ['export', '자료 내려받기']] },
  { key: 'settings', label: '설정', icon: 'scroll', subs: [['settings', '단계·조사 설정'], ['life', '3차 우리 고장 자료'], ['account', '계정']] },
];
let classes = []; let cur = null; let section = 'class'; let sub = 'roster';
let book; let tabsEl; let whoEl; let first = true;
const lottery = () => cur?.settings.topicMode === 'lottery';
const ownMode = () => cur?.settings.topicMode === 'own';
const personal = () => cur?.settings.topicMode !== 'class';

export async function mountTeacher(root) {
  whoEl = h('div', { class: 'teacher-who' });
  tabsEl = h('nav', { class: 'side-tabs', 'aria-label': '관리 메뉴' });
  book = new Book({ onPrev: () => flip(-1), onNext: () => flip(1) });
  book.wrap.classList.add('teacher-book');
  const sceneEl = scene(makeHeader({ sub: '교사 관리실', right: whoEl }), h('main', { class: 'stage' }, h('div', { class: 'side-col' }, tabsEl, lanternImg()), book.wrap));
  root.append(sceneEl);
  book.turner = new PageTurner(sceneEl);
  deskProps(root);
  await loadClasses();
}
// 책장 화살표: 모든 쪽을 차례대로(학급·명단 → … → 설정)
const FLAT = SECTIONS.flatMap((sc) => sc.subs.map(([k]) => [sc.key, k]));
function flip(d) {
  if (!cur || book.busy) return;
  const i = FLAT.findIndex(([, k]) => k === sub) + d;
  if (i < 0 || i >= FLAT.length) return;
  [section, sub] = FLAT[i]; drawTabs(); show(d > 0 ? 'next' : 'prev');
}

async function loadClasses(selectId) {
  classes = (await api('GET', '/api/teacher/classes')).classes;
  cur = classes.find((c) => c.id === (selectId ?? cur?.id)) || classes[0] || null;
  drawWho(); drawTabs();
  await show(first ? null : 'jump'); first = false;
}

function drawWho() {
  const sel = h('select', { class: 'class-select', 'aria-label': '학급 고르기', onChange: async (e) => {
    if (e.target.value === 'new') { e.target.value = cur ? cur.id : ''; openClassWizard(); return; }
    cur = classes.find((c) => c.id === +e.target.value); drawTabs(); await show('jump');
  } }, classes.map((c) => h('option', { value: c.id, selected: c.id === cur?.id ? true : undefined }, `${c.name}${c.isDemo ? ' (체험)' : ''}`)), h('option', { value: 'new' }, '＋ 새 학급 만들기…'));
  whoEl.replaceChildren(
    h('div', { class: 'row', style: { gap: '6px', justifyContent: 'center' } }, h('b', null, S.me.teacher.name), h('button', { class: 'top-btn', type: 'button', onClick: () => logout() }, '나가기')),
    classes.length ? sel : h('span', { class: 'small' }, '학급을 만들어 주세요'));
}

function drawTabs() {
  tabsEl.replaceChildren(...SECTIONS.map((sc) => h('button', { type: 'button', class: 'side-tab', 'aria-current': sc.key === section ? 'page' : undefined,
    onClick: () => { if (sc.key === section) return; section = sc.key; sub = sc.subs[0][0]; drawTabs(); show('jump'); } },
  h('img', { src: iconSrc(sc.icon), alt: '' }), h('span', null, sc.label),
  sc.key === 'works' && cur?.pending ? h('span', { class: 'tab-count' }, cur.pending) : null)));
}

// 지금 고른 메뉴의 두 쪽을 그림(자료를 먼저 불러온 뒤 책에 그려서 빈 쪽이 깜빡이지 않게)
async function show(dir = null) {
  const sc = SECTIONS.find((x) => x.key === section);
  const label = sc.subs.find((x) => x[0] === sub)?.[1] || '';
  let view;
  try { view = cur ? await VIEWS[sub]() : welcomeView(); } catch (e) { view = { left: (L) => L.append(h('p', { class: 'err-text' }, e.message)), right: () => {} }; }
  const sL = dir ? 0 : book.leftScroll?.scrollTop || 0; const sR = dir ? 0 : book.rightScroll?.scrollTop || 0;
  await book.show({
    folio: [sc.label, label],
    left: (L) => {
      L.append(h('div', { class: 'page-head' }, h('img', { class: 'ico', src: iconSrc(sc.icon), alt: '', width: 46, height: 46 }),
        h('div', null, h('div', { class: 'kicker' }, cur ? `${cur.name} · 코드 ${cur.code}` : '교사 관리실'), h('h2', null, cur ? label : '교사 관리실'))));
      if (cur && sc.subs.length > 1) {
        L.append(h('div', { class: 'cat-tabs', role: 'tablist' }, sc.subs.map(([k, l]) => h('button', { type: 'button', role: 'tab', class: 'chip-btn', 'aria-pressed': String(k === sub), onClick: () => { if (k !== sub) { sub = k; show('jump'); } } }, l))));
      }
      L.append(h('div', { class: 'divider' }));
      view.left(L);
    },
    right: (R) => view.right(R),
    ...(() => { const i = FLAT.findIndex(([, k]) => k === sub); const lab = (j) => { const [sk, k] = FLAT[j] || []; return SECTIONS.find((x) => x.key === sk)?.subs.find((x) => x[0] === k)?.[1]; };
      return cur ? { canPrev: i > 0, canNext: i < FLAT.length - 1, prevText: lab(i - 1), nextText: lab(i + 1) } : { canPrev: false, canNext: false }; })(),
  }, dir);
  if (!dir) { book.leftScroll.scrollTop = sL; book.rightScroll.scrollTop = sR; }
}
const refresh = async () => { for (let i = 0; book.busy && i < 60; i++) await new Promise((r) => setTimeout(r, 50)); return show(null); };

function welcomeView() {
  return {
    left: (L) => L.append(h('p', null, '학교를 찾아 학급을 만들고, 학급 코드와 QR을 학생들에게 나누어 주세요.'),
      h('ol', { class: 'steps-list' }, h('li', null, h('span', null, '학교 검색')), h('li', null, h('span', null, '학년·반 정하기')), h('li', null, h('span', null, '학급 코드 정하기')), h('li', null, h('span', null, 'QR로 학생 입장')))),
    right: (R) => R.append(h('div', { class: 'lock-page' }, h('div', null, sealImg('待'), h('h3', null, '아직 학급이 없어요'), btn('＋ 새 학급 만들기', () => openClassWizard(), { variant: 'gold' })))),
  };
}

async function saveSettings(patch, msg = '저장했어요.') {
  try { const r = await api('PUT', `/api/teacher/classes/${cur.id}`, { settings: patch }); cur.settings = r.settings; if (msg) toast(msg, 'ok'); return true; } catch (e) { toast(e.message, 'bad'); return false; }
}
const sheet = (...kids) => h('div', { class: 'sheet' }, ...kids);
const toggle = (label, checked, on) => h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked, onChange: (e) => on(e.target.checked) }), label);
const tName = (id) => topicById(id)?.name.replace(/^월별 /, '') || '—';

// ───────── 학생 명단: 표로 입력 ─────────
async function rosterView() {
  const list = (await api('GET', `/api/teacher/classes/${cur.id}/students`)).students;
  const existing = new Set(list.map((x) => x.number));
  let nextNo = list.length ? Math.max(...list.map((x) => x.number)) + 1 : 1;
  const rows = [];
  const tbody = h('tbody');
  const msg = h('div', { role: 'status' });
  const mkRow = (d = {}) => ({ number: d.number ?? '', name: d.name ?? '', nickname: d.nickname ?? '' });
  const autoNo = (i) => { const used = new Set([...existing, ...rows.map((r) => +r.number).filter(Boolean)]); let n = nextNo; while (used.has(n)) n++; return n; };
  const addRows = (k) => { for (let i = 0; i < k; i++) { const r = mkRow(); r.number = autoNo(); rows.push(r); } draw(); };
  const validate = () => {
    const seen = {};
    rows.forEach((r, i) => { if (r.name.trim()) { const n = +r.number; seen[n] = (seen[n] || 0) + 1; } });
    return rows.map((r) => {
      if (!r.name.trim()) return null;
      const n = +r.number;
      if (!(n >= 1 && n <= 99) || !Number.isInteger(n)) return '번호를 1~99로 적어요';
      if (existing.has(n)) return `${n}번은 이미 등록돼 있어요`;
      if (seen[n] > 1) return `${n}번이 두 번 있어요`;
      return null;
    });
  };
  const fillFrom = (start, text) => {
    const lines = text.replace(/\r/g, '').split('\n').map((l) => l.trim()).filter(Boolean);
    lines.forEach((line, k) => {
      const cells = line.includes('\t') ? line.split('\t').map((c) => c.trim()) : (() => { const m = line.match(/^(\d+)[\s.,)번]*\s*(.+)$/); return m ? [m[1], m[2]] : [line]; })();
      let number; let name; let nick = '';
      if (/^\d+$/.test(cells[0] || '')) { number = +cells[0]; name = cells[1] || ''; nick = cells[2] || ''; } else { name = cells[0]; nick = cells[1] || ''; }
      const i = start + k;
      while (rows.length <= i) rows.push(mkRow());
      rows[i].name = name; rows[i].nickname = nick; rows[i].number = number ?? (rows[i].number || autoNo());
    });
    draw();
    toast(`${lines.length}명을 표에 붙여 넣었어요.`, 'ok');
  };
  function draw() {
    const errs = validate();
    tbody.replaceChildren(...rows.map((r, i) => {
      const cell = (key, attrs) => {
        const inp = h('input', { ...attrs, value: r[key], 'data-row': i, 'data-key': key, onInput: (e) => { r[key] = e.target.value; }, onChange: () => draw(),
          onPaste: (e) => { const t = e.clipboardData?.getData('text') || ''; if (/[\n\t]/.test(t.trim())) { e.preventDefault(); fillFrom(i, t); } },
          onKeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); if (i === rows.length - 1) addRows(1); setTimeout(() => tbody.querySelector(`input[data-row="${i + 1}"][data-key="${key}"]`)?.focus(), 0); } } });
        return inp;
      };
      return h('tr', { class: errs[i] ? 'bad' : '' },
        h('td', null, cell('number', { type: 'number', min: 1, max: 99, inputmode: 'numeric', 'aria-label': `${i + 1}째 줄 번호`, class: 'no-in' })),
        h('td', null, cell('name', { type: 'text', maxlength: 30, placeholder: '이름', 'aria-label': `${i + 1}째 줄 이름` })),
        h('td', null, cell('nickname', { type: 'text', maxlength: 20, placeholder: '선택', 'aria-label': `${i + 1}째 줄 별명` })),
        h('td', null, h('button', { type: 'button', class: 'row-del', 'aria-label': `${i + 1}째 줄 지우기`, onClick: () => { rows.splice(i, 1); if (!rows.length) addRows(1); else draw(); } }, '×')),
        errs[i] ? h('td', { class: 'row-err' }, errs[i]) : null);
    }));
    const filled = rows.filter((r) => r.name.trim()).length;
    msg.textContent = filled ? `이름을 적은 학생 ${filled}명` : '';
  }
  for (let i = 0; i < 5; i++) { const r = mkRow(); r.number = autoNo(); rows.push(r); }
  draw();
  const submit = async () => {
    const errs = validate();
    if (errs.some(Boolean)) return toast('빨간 줄을 먼저 고쳐 주세요.', 'bad');
    const students = rows.filter((r) => r.name.trim()).map((r) => ({ number: +r.number, name: r.name.trim(), nickname: r.nickname.trim() }));
    if (!students.length) return toast('이름을 한 명 이상 적어 주세요.', 'bad');
    try { const res = await api('POST', `/api/teacher/classes/${cur.id}/students`, { students }); toast(`${res.created.length}명을 등록했어요.`, 'ok'); await loadClasses(); } catch (e) { toast(e.message, 'bad'); }
  };
  return {
    left: (L) => L.append(
      h('p', { class: 'small' }, '표에 번호와 이름을 적어요. 엑셀·한글 표나 명렬표를 복사해 ', h('b', null, '이름 칸에 붙여 넣으면'), ' 여러 명이 한꺼번에 들어가요.'),
      h('div', { class: 'roster-table-wrap' }, h('table', { class: 'data roster-table' },
        h('thead', null, h('tr', null, h('th', null, '번호'), h('th', null, '이름'), h('th', null, '별명(전시용)'), h('th', null, ''))), tbody)),
      h('div', { class: 'row', style: { marginTop: '8px' } }, btn('＋ 한 줄', () => addRows(1), { variant: 'small green' }), btn('＋ 다섯 줄', () => addRows(5), { variant: 'small green' }), msg),
      h('div', { class: 'row', style: { marginTop: '10px' } }, btn('명단 등록하기', submit, { variant: 'gold' })),
      h('p', { class: 'small muted' }, '학생은 학급 코드를 적고 명단에서 자기 이름을 눌러 들어와요(PIN 없음). 학급 정보·QR 쪽에서 QR을 나눠 줄 수 있어요.')),
    right: (R) => {
      R.append(h('h3', null, `등록한 학생 (${list.length}명)`),
        list.length ? h('div', { class: 'table-scroll' }, h('table', { class: 'admin-table compact' },
          h('thead', null, h('tr', null, ['번호', '이름', '별명', '관리'].map((x) => h('th', null, x)))),
          h('tbody', null, list.map((st) => {
            const nm = h('input', { type: 'text', value: st.name, 'aria-label': '이름' });
            const nick = h('input', { type: 'text', value: st.nickname, 'aria-label': '별명' });
            return h('tr', null, h('td', null, st.number), h('td', null, nm), h('td', null, nick),
              h('td', null, h('div', { class: 'row', style: { justifyContent: 'center', gap: '3px', flexWrap: 'nowrap' } },
                btn('저장', async () => { try { await api('PUT', `/api/teacher/students/${st.id}`, { name: nm.value, nickname: nick.value }); toast('저장했어요.', 'ok'); } catch (e) { toast(e.message, 'bad'); } }, { variant: 'small green' }),
                btn('삭제', async () => { if (!(await confirmBox('학생 삭제', `${st.number}번 ${st.name} 학생과 그 학생의 모든 자료를 지울까요? 되돌릴 수 없어요.`, '삭제'))) return; await api('DELETE', `/api/teacher/students/${st.id}`); toast('삭제했어요.'); loadClasses(); }, { variant: 'small' }))));
          })))) : h('p', { class: 'muted' }, '아직 등록된 학생이 없어요. 왼쪽 표에 적어 주세요.'));
    },
  };
}

// ───────── 학급 정보·QR ─────────
async function qrView() {
  const notice = h('input', { type: 'text', value: cur.settings.notice, maxlength: 300, placeholder: '학생 목차 쪽에 보이는 알림' });
  const cname = h('input', { type: 'text', value: cur.name, maxlength: 40 });
  return {
    left: (L) => L.append(schoolSheet(), codeSheet(),
      sheet(h('h3', null, '학급 이름·알림'),
        h('label', { class: 'field' }, h('span', null, '학급 이름'), cname),
        h('label', { class: 'field' }, h('span', null, '학생 알림'), notice),
        h('div', { class: 'row', style: { marginTop: '8px' } },
          btn('저장', async () => { try { await api('PUT', `/api/teacher/classes/${cur.id}`, { name: cname.value, settings: { notice: notice.value } }); toast('저장했어요.', 'ok'); loadClasses(); } catch (e) { toast(e.message, 'bad'); } }, { variant: 'green small' }),
          btn('학급 삭제', async () => { if (!(await confirmBox('학급 삭제', `${cur.name}과 학생·응답·작품을 모두 지울까요? 되돌릴 수 없어요.`, '삭제'))) return; await api('DELETE', `/api/teacher/classes/${cur.id}`); cur = null; loadClasses(); }, { variant: 'small' })))),
    right: (R) => R.append(h('div', { class: 'center' }, h('h2', { class: 'plaque' }, '학생 접속 QR')), qrCard(cur)),
  };
}

// ───────── 진행 현황 ─────────
async function progressView() {
  const rows = (await api('GET', `/api/teacher/classes/${cur.id}/progress`)).rows;
  const count = (f) => rows.filter(f).length;
  const lot = lottery();
  return {
    left: (L) => L.append(
      h('div', { class: 'glance' },
        h('div', { class: 'glance-row' }, h('span', { class: 'k' }, '기상자료 완료'), h('span', { class: 'v' }, `${count((x) => x.weatherDone)} / ${rows.length}명`)),
        ownMode() ? h('div', { class: 'glance-row' }, h('span', { class: 'k' }, `그래프 ${cur.settings.minWorks}개 이상 제출`), h('span', { class: 'v' }, `${count((x) => x.worksDone >= x.minWorks)} / ${rows.length}명`))
          : lot ? h('div', { class: 'glance-row' }, h('span', { class: 'k' }, '주제 받음'), h('span', { class: 'v' }, `${count((x) => x.research)} / ${rows.length}명`))
          : h('div', { class: 'glance-row' }, h('span', { class: 'k' }, '추천 투표'), h('span', { class: 'v' }, `${count((x) => x.vote)} / ${rows.length}명`)),
        h('div', { class: 'glance-row' }, h('span', { class: 'k' }, '내 기록 제출'), h('span', { class: 'v' }, `${count((x) => x.research && x.surveys.includes(x.research))} / ${rows.length}명`)),
        h('div', { class: 'glance-row' }, h('span', { class: 'k' }, '3차 우리 고장 그래프 제출'), h('span', { class: 'v' }, `${count((x) => /승인/.test(x.life))} / ${rows.length}명`)),
        ownMode() ? h('div', { class: 'glance-row' }, h('span', { class: 'k' }, '제출한 그래프 모두'), h('span', { class: 'v chg' }, `${rows.reduce((a, x) => a + x.worksDone, 0)}개`))
          : h('div', { class: 'glance-row' }, h('span', { class: 'k' }, '그래프 제출'), h('span', { class: 'v chg' }, `${count((x) => /승인/.test(x.graph))} / ${rows.length}명`))),
      h('p', { class: 'small', style: { marginTop: '12px' } }, '오른쪽 표의 [보기]를 누르면 그 학생의 기상자료, 월별 기록, 작품을 볼 수 있고, 기상자료 단계를 예외로 열어 주거나 다시 하게 할 수 있어요.'),
      btn('새로고침', () => refresh(), { variant: 'small green' })),
    right: (R) => R.append(rows.length ? h('div', { class: 'table-scroll' }, h('table', { class: 'admin-table compact' },
      h('thead', null, h('tr', null, ['번호', '이름', '1차', ownMode() ? '2차 지금 주제' : '연구 주제', '자료표', ownMode() ? '2차 제출' : '그래프', '3차 우리 고장', ''].map((x) => h('th', null, x)))),
      h('tbody', null, rows.map((p) => h('tr', null,
        h('td', null, p.number), h('td', { class: 'l' }, p.name),
        h('td', null, h('span', { class: `badge ${p.weatherDone ? 'ok' : ''}` }, p.weather)),
        h('td', { class: 'l small' }, p.research ? tName(p.research) : lot ? '제비 전' : '—'),
        h('td', null, p.table), ownMode() ? h('td', null, h('span', { class: `badge ${p.worksDone >= p.minWorks ? 'ok' : ''}` }, `${p.worksDone}/${p.minWorks}`)) : h('td', { class: 'small' }, p.graph),
        h('td', { class: 'small', title: p.lifeSubject }, h('span', { class: `badge ${/승인/.test(p.life) ? 'ok' : ''}` }, p.life)),
        h('td', null, h('button', { class: 'link-btn', type: 'button', onClick: () => studentDetail(p.id) }, '보기'))))))) : h('p', null, '학생 명단을 먼저 등록해 주세요.')),
  };
}

async function studentDetail(id) {
  const r = await api('GET', `/api/teacher/students/${id}`);
  const w = r.state.weather || {};
  const works = r.works.map((x) => h('div', { style: { marginTop: '8px' } }, h('b', null, x.kind === 'weather' ? '1차 폭염일수 그래프' : x.kind === 'life' ? `3차 우리 고장: ${x.data.subject || ''}` : topicById(x.topicId)?.name), ` (${x.status})`, x.data.labels ? renderStatic(x.data) : null));
  const resp = {};
  r.responses.forEach((x) => { (resp[x.topic_id] = resp[x.topic_id] || []).push(x); });
  await modal({
    wide: true, title: `${r.student.number}번 ${r.student.name}`,
    body: h('div', { class: 'stack' },
      h('div', null, h('b', null, '기상자료: '), w.region ? `${w.region} / ${(w.years || []).map((y, i) => `${y}년 ${w.values?.[i] ?? ''}일`).join(', ')}` : '아직 없음', ` · 출처: ${w.source || '-'}`),
      h('div', { class: 'row' },
        toggle('기상자료 단계 예외 허용(다음 장 열어 주기)', r.student.weatherOverride, async (v) => { await api('PUT', `/api/teacher/students/${id}`, { weatherOverride: v }); toast('바꾸었어요.', 'ok'); }),
        btn('기상자료 다시 하게 하기', async () => { if (await confirmBox('기상자료 다시 하기', '이 학생의 기상자료 완료를 취소하고 다시 고칠 수 있게 할까요?')) { await api('PUT', `/api/teacher/students/${id}`, { resetWeather: true }); toast('다시 할 수 있게 했어요.', 'ok'); } }, { variant: 'small green' })),
      r.state.life?.subject ? h('div', null, h('b', null, '3차 우리 고장: '), `${r.state.life.subject} (${r.state.life.unit || ''}) / ${(r.state.life.years || []).map((y, i) => `${y}년 ${r.state.life.values?.[i] ?? ''}`).join(', ')} · 출처: ${r.state.life.source || '-'}`,
        r.state.life.predict ? h('div', { class: 'small' }, '다음 해 예상: ', r.state.life.predict) : null) : null,
      ...Object.entries(resp).map(([tid, list]) => h('div', null, h('b', null, topicById(tid).name), ': ', list.map((x) => `${x.month}월 ${x.status === 'unknown' ? '모름' : fmt(x.value)}${x.source === 'record' ? '(기록)' : ''}`).join(', '))),
      ...works),
  });
}

// ───────── 학생 뽑기 ─────────
async function pickerView() {
  const list = (await api('GET', `/api/teacher/classes/${cur.id}/students`)).students;
  if (!list.length) return { left: (L) => L.append(h('p', null, '학생 명단을 먼저 등록해 주세요.'), btn('학생 명단으로', () => { section = 'class'; sub = 'roster'; drawTabs(); show('jump'); }, { variant: 'small green' })), right: () => {} };
  const st = cur.settings;
  let picked = (st.picked || []).filter((id) => list.some((x) => x.id === id));
  let noRepeat = st.pickNoRepeat !== false;
  let rolling = false;
  const label = (x) => `${x.number}번 ${x.name}`;
  const nameEl = h('div', { class: 'pick-name', 'aria-live': 'assertive' }, '?');
  const subEl = h('div', { class: 'pick-sub' }, '버튼을 눌러 한 명을 뽑아요');
  const stage = h('div', { class: 'pick-stage' }, h('img', { class: 'pick-seal', src: 'assets/art/seal_wait.png', alt: '' }), nameEl, subEl);
  const left = h('span', { class: 'badge pick-left' });
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
    const steps = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 22;
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
  const wrap = h('div', { class: 'pick-sheet' });
  draw();
  return {
    left: (L) => { wrap.append(
      h('p', { class: 'small muted' }, '학생 명단에 등록한 학생 중에서 버튼을 누를 때마다 한 명씩 무작위로 뽑아요. 발표·순서 정하기에 써요.'),
      stage, h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '14px' } }, pickBtn),
      h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '8px' } }, left)); L.append(wrap); },
    right: (R) => R.append(
      h('div', { class: 'stack' },
        h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: noRepeat, onChange: (e) => { noRepeat = e.target.checked; draw(); save(); } }), '한 번 뽑힌 학생은 다시 뽑지 않기'),
        h('div', { class: 'row' },
          btn('전체 화면으로 보기', () => { (wrap.requestFullscreen?.() || Promise.reject()).catch(() => toast('이 화면에서는 전체 화면을 쓸 수 없어요.')); }, { variant: 'small green' }),
          btn('처음부터 다시', async () => { if (picked.length && !(await confirmBox('처음부터 다시', '뽑힌 학생 기록을 지우고 처음부터 다시 뽑을까요?', '다시 시작'))) return; picked = []; nameEl.textContent = '?'; subEl.textContent = '버튼을 눌러 한 명을 뽑아요'; stage.classList.remove('done'); draw(); save(); }, { variant: 'small' }))),
      h('h3', { style: { marginTop: '16px' } }, '뽑힌 순서'), hist),
  };
}

// ───────── 학생별 주제 ─────────
async function mineView() {
  if (lottery()) return lotteryView();
  if (!ownMode()) return lotteryView();
  const rows = (await api('GET', `/api/teacher/classes/${cur.id}/progress`)).rows;
  const need = cur.settings.minWorks;
  const counts = {};
  rows.forEach((r) => r.topics.forEach((t) => { counts[t] = (counts[t] || 0) + 1; }));
  const popular = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  return {
    left: (L) => L.append(
      h('p', { class: 'small' }, `학생들이 25가지 주제 중에서 직접 골라요. 한 사람이 꼭 낼 그래프는 `, h('b', null, `${need}개`), '이고, 시간이 남는 학생은 더 만들 수 있어요. 친구와 같은 주제를 골라도 각자 자기 기록으로 그려요.'),
      h('div', { class: 'glance' },
        h('div', { class: 'glance-row' }, h('span', { class: 'k' }, `${need}개 이상 제출`), h('span', { class: 'v' }, `${rows.filter((r) => r.worksDone >= need).length} / ${rows.length}명`)),
        h('div', { class: 'glance-row' }, h('span', { class: 'k' }, '1개 이상 제출'), h('span', { class: 'v' }, `${rows.filter((r) => r.worksDone >= 1).length} / ${rows.length}명`)),
        h('div', { class: 'glance-row' }, h('span', { class: 'k' }, '아직 주제를 안 고름'), h('span', { class: 'v min' }, `${rows.filter((r) => !r.topics.length && !r.research).length}명`))),
      h('h3', { style: { marginTop: '14px' } }, '많이 고른 주제'),
      popular.length ? h('div', { class: 'vote-bars' }, popular.map(([id, n]) => h('div', { class: 'vote-bar' }, h('span', null, `${id}. ${tName(id)}`), h('b', null, `${n}명`), h('div', { class: 'bar' }, h('i', { style: { width: `${(n / popular[0][1]) * 100}%` } }))))) : h('p', { class: 'muted small' }, '아직 고른 학생이 없어요.'),
      h('div', { class: 'row', style: { marginTop: '10px' } }, btn('꼭 낼 개수·주제 묶음 바꾸기', () => { sub = 'topics'; show('jump'); }, { variant: 'small green' }))),
    right: (R) => R.append(rows.length ? h('div', { class: 'table-scroll' }, h('table', { class: 'admin-table compact' },
      h('thead', null, h('tr', null, ['번호', '이름', '고른 주제', '제출', ''].map((x) => h('th', null, x)))),
      h('tbody', null, rows.map((r) => h('tr', null, h('td', null, r.number), h('td', { class: 'l' }, r.name),
        h('td', { class: 'l small wrap' }, r.topics.length ? r.topics.map((t) => h('span', { class: `topic-chip ${r.doneTopics.includes(t) ? 'mine' : ''}`, style: { margin: '1px 3px 1px 0', display: 'inline-block' } }, tName(t))) : r.research ? `${tName(r.research)}(기록 전)` : '—'),
        h('td', null, h('span', { class: `badge ${r.worksDone >= need ? 'ok' : ''}` }, `${r.worksDone}/${need}`)),
        h('td', null, h('button', { class: 'link-btn', type: 'button', onClick: () => studentDetail(r.id) }, '보기'))))))) : h('p', null, '학생 명단을 먼저 등록해 주세요.')),
  };
}

// ───────── 주제 제비뽑기: 학생 한 명당 주제 한 개, 겹치지 않게 ─────────
async function lotteryView() {
  if (!lottery()) {
    return {
      left: (L) => L.append(h('div', { class: 'note' }, '지금은 ', h('b', null, '학급 공동 조사'), ' 방식이에요. 학생이 직접 주제를 고르게 하려면 [주제 묶음·방식]에서 방식을 바꿔 주세요.'), btn('주제 묶음·방식으로', () => { sub = 'topics'; show('jump'); }, { variant: 'small green' })),
      right: () => {},
    };
  }
  const v = await api('GET', `/api/teacher/classes/${cur.id}/assign`);
  const next = v.rows.find((x) => !x.topicId);
  const nameEl = h('div', { class: 'lot-who' }, next ? `${next.number}번 ${next.name}` : '모두 뽑았어요');
  const topicEl = h('div', { class: 'lot-topic', 'aria-live': 'assertive' }, next ? '?' : '');
  const box = h('div', { class: 'lot-box' }, h('img', { class: 'pick-seal', src: 'assets/art/seal_wait.png', alt: '' }), nameEl, topicEl);
  let rolling = false;
  const call = async (path, body) => {
    try { return await api('POST', `/api/teacher/classes/${cur.id}/assign/${path}`, body); } catch (e) {
      if (e.data?.needForce && (await confirmBox('주제 바꾸기', `${e.message} 그래도 바꿀까요?`, '바꾸기'))) return api('POST', `/api/teacher/classes/${cur.id}/assign/${path}`, { ...body, force: true });
      toast(e.message, 'bad'); return null;
    }
  };
  const animateTo = async (topicId, pool) => {
    box.classList.add('rolling'); box.classList.remove('done');
    const steps = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 18;
    for (let i = 0; i < steps; i++) {
      const tid = i === steps - 1 ? topicId : pool[Math.floor(Math.random() * pool.length)];
      topicEl.textContent = topicById(tid).name;
      topicEl.animate([{ transform: 'translateY(-25%)', opacity: 0.2 }, { transform: 'none', opacity: 1 }], { duration: 70 });
      await new Promise((r) => setTimeout(r, 35 + i * i * 0.35));
    }
    box.classList.remove('rolling'); box.classList.add('done');
    topicEl.animate([{ transform: 'scale(.8)', opacity: 0 }, { transform: 'scale(1.08)', opacity: 1, offset: 0.6 }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.3,1.4,.5,1)' });
  };
  const drawOne = async (studentId, label) => {
    if (rolling) return; rolling = true;
    nameEl.textContent = label;
    const pool = v.remaining.length ? v.remaining : v.pool;
    const r = await call('draw', { studentId });
    if (r) { await animateTo(r.drawn[0].topicId, pool); await new Promise((res) => setTimeout(res, 700)); }
    rolling = false; if (r) refresh();
  };
  const drawBtn = btn(next ? `${next.number}번 ${next.name} 제비 뽑기` : '모두 뽑았어요', () => next && drawOne(next.id, `${next.number}번 ${next.name}`), { variant: 'gold', disabled: !next });
  const notEnough = v.rows.filter((x) => !x.topicId).length > v.remaining.length;
  return {
    left: (L) => L.append(
      h('p', { class: 'small' }, '번호 순서대로 한 명씩 제비를 뽑아 주제를 정해요. 이미 나온 주제는 다시 나오지 않아요. 학생은 받은 주제의 ', h('b', null, '자기 1~11월 기록'), '으로 자료표와 그래프를 만들어요.'),
      box,
      h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '12px' } }, drawBtn),
      h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '8px' } },
        btn('남은 학생 모두 뽑기', async () => { if (rolling) return; const r = await call('draw', { all: true }); if (r) { toast(`${r.drawn.length}명의 주제를 정했어요.`, 'ok'); refresh(); } }, { variant: 'small green', disabled: !next }),
        btn('처음부터 다시', async () => { if (!(await confirmBox('제비뽑기 처음부터', '모든 학생의 주제를 비우고 처음부터 다시 뽑을까요? 이미 낸 기록과 작품은 남아 있지만, 새 주제로 다시 해야 해요.', '처음부터'))) return; await call('reset', {}); refresh(); }, { variant: 'small' })),
      h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '10px' } }, h('span', { class: 'badge' }, `남은 주제 ${v.remaining.length}개 · 주제를 받은 학생 ${v.rows.filter((x) => x.topicId).length}/${v.rows.length}명`)),
      notEnough ? h('div', { class: 'note small', style: { marginTop: '8px' } }, '남은 주제보다 남은 학생이 많아요. [주제 묶음·방식]에서 주제를 더 넣어 주세요.') : null),
    right: (R) => {
      if (!v.rows.length) { R.append(h('p', null, '학생 명단을 먼저 등록해 주세요.')); return; }
      R.append(h('h3', null, '주제 배정표'), h('div', { class: 'table-scroll' }, h('table', { class: 'admin-table compact' },
        h('thead', null, h('tr', null, ['번호', '이름', '주제', '상태', ''].map((x) => h('th', null, x)))),
        h('tbody', null, v.rows.map((x) => {
          const opts = [...new Set([...(x.topicId ? [x.topicId] : []), ...v.remaining])].sort((a, b) => a - b);
          const sel = h('select', { 'aria-label': `${x.number}번 주제`, onChange: async (e) => { const r = await call('set', { studentId: x.id, topicId: e.target.value ? +e.target.value : null }); if (r) refresh(); else e.target.value = x.topicId || ''; } },
            h('option', { value: '' }, '— 비움 —'), opts.map((id) => h('option', { value: id, selected: id === x.topicId ? true : undefined }, `${id}. ${tName(id)}`)));
          return h('tr', null, h('td', null, x.number), h('td', { class: 'l' }, x.name), h('td', { class: 'l' }, sel),
            h('td', { class: 'small' }, x.work ? { draft: '그리는 중', submitted: '작품 제출', approved: '전시 중', rejected: '다시 그리기' }[x.work] : x.surveyed ? '기록 제출' : x.topicId ? '주제 받음' : '—'),
            h('td', null, h('button', { type: 'button', class: 'link-btn', onClick: () => drawOne(x.id, `${x.number}번 ${x.name}`) }, x.topicId ? '다시 뽑기' : '뽑기')));
        })))));
    },
  };
}

// ───────── 주제 묶음·방식 ─────────
async function topicsView() {
  const s = cur.settings;
  const ag = await api('GET', `/api/teacher/classes/${cur.id}/aggregate`);
  const pool = new Set(s.assignPool); const active = new Set(s.activeTopics);
  const mode = (val, title, desc) => h('label', { class: `mode-card ${s.topicMode === val ? 'on' : ''}` },
    h('input', { type: 'radio', name: 'topicMode', value: val, checked: s.topicMode === val, onChange: async () => { if (await saveSettings({ topicMode: val }, '주제 정하는 방식을 바꾸었어요.')) { loadClasses(); } } }),
    h('span', null, h('b', null, title), h('br'), h('span', { class: 'small' }, desc)));
  const totalVotes = Object.values(ag.votes).reduce((a, b) => a + b, 0);
  const grid = (set, extra) => CATEGORIES.map((c) => h('div', { style: { marginBottom: '8px' } }, h('b', { class: 'small' }, c.name), h('div', { class: 'topic-toggle-grid', style: { marginTop: '3px' } },
    TOPICS.filter((t) => t.cat === c.id).map((t) => h('label', { class: 'topic-toggle' }, h('input', { type: 'checkbox', checked: set.has(t.id), onChange: (e) => { if (e.target.checked) set.add(t.id); else set.delete(t.id); } }), h('span', null, `${t.id}. ${t.name.replace(/^월별 /, '')}`), extra ? extra(t) : null)))));
  return {
    left: (L) => {
      L.append(h('h3', null, '주제 정하는 방식'),
        h('div', { class: 'stack', style: { gap: '8px' } },
          mode('own', '직접 고르기 (추천)', '학생이 25가지 주제 중 골라 자기 1~11월 기록으로 표·그래프를 만들어요. 꼭 낼 개수 이상, 시간이 남으면 더 만들어요.'),
          mode('lottery', '제비뽑기', '선생님이 제비뽑기로 한 명에게 주제 하나씩 정해 줘요. 주제가 겹치지 않아요.'),
          mode('class', '학급 공동 조사', '반 전체가 같은 주제에 응답하고 학급 합계로 그려요. 모르는 친구 자료가 섞일 수 있어요.')));
      if (s.topicMode === 'own') {
        const nSel = h('select', { 'aria-label': '꼭 낼 그래프 수', onChange: (e) => saveSettings({ minWorks: +e.target.value }, `한 사람이 꼭 낼 그래프를 ${e.target.value}개로 정했어요.`) },
          Array.from({ length: 10 }, (_, i) => h('option', { value: i + 1, selected: s.minWorks === i + 1 ? true : undefined }, `${i + 1}개`)));
        L.append(h('h3', { style: { marginTop: '16px' } }, '한 사람이 꼭 낼 그래프'), h('div', { class: 'row' }, nSel, h('span', { class: 'small muted' }, '이보다 더 만드는 것은 자유예요.')));
      }
      if (s.topicMode === 'class') {
        L.append(h('h3', { style: { marginTop: '16px' } }, '추천 투표'),
          h('div', { class: 'row' }, toggle('추천 투표 받기', s.voteOpen, (v) => saveSettings({ voteOpen: v }, v ? '투표를 시작했어요.' : '투표를 마감했어요.')), h('span', { class: 'small muted' }, `${ag.students}명 중 ${totalVotes}명 투표`)),
          h('div', { class: 'vote-bars', style: { marginTop: '8px' } }, Object.entries(ag.votes).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, n]) => h('div', { class: 'vote-bar' }, h('span', null, `${id}. ${tName(id)}`), h('b', null, `${n}표`), h('div', { class: 'bar' }, h('i', { style: { width: `${(n / Math.max(...Object.values(ag.votes))) * 100}%` } }))))));
      }
    },
    right: (R) => {
      if (s.topicMode !== 'class') {
        R.append(h('h3', null, `${s.topicMode === 'own' ? '학생이 고를 수 있는 주제' : '제비뽑기 주제 묶음'} (${pool.size}개)`), h('p', { class: 'small' }, s.topicMode === 'own' ? '체크한 주제만 학생이 고를 수 있어요. 19번 용돈 저축 금액은 개인 정보라 기본으로 빼 두었어요(넣으면 그 학생의 금액이 작품 전시관에 보여요).' : '체크한 주제만 제비로 나와요. 학생 수보다 주제가 많아야 겹치지 않아요. 19번 용돈 저축 금액은 개인 정보라 기본으로 빼 두었어요.'),
          ...grid(pool), btn('주제 묶음 저장', () => saveSettings({ assignPool: [...pool] }, '주제 묶음을 저장했어요.'), { variant: 'gold small' }));
      } else {
        R.append(h('h3', null, '우리 반 조사 주제 열기'), h('p', { class: 'small' }, '체크한 주제만 학생들이 월별 경험을 입력할 수 있어요. 학생은 연 주제 중 하나를 연구 주제로 골라요.'),
          ...grid(active, (t) => h('span', { class: 'badge' }, `${ag.votes[t.id] || 0}표`)), btn('조사 주제 저장', () => saveSettings({ activeTopics: [...active] }, '조사 주제를 저장했어요.'), { variant: 'gold small' }));
      }
    },
  };
}

// ───────── 작품 승인: 왼쪽 목록, 오른쪽 크게 ─────────
let workSel = null;
async function worksView() {
  const r = await api('GET', `/api/teacher/classes/${cur.id}/works`);
  const label = { submitted: ['승인 대기', 'warn'], approved: ['승인됨', 'ok'], rejected: ['다시 그리기 요청', 'red'] };
  const w = r.works.find((x) => x.id === workSel) || r.works[0];
  workSel = w?.id ?? null;
  return {
    left: (L) => L.append(h('p', { class: 'small' }, `제출된 작품 ${r.works.length}개 · 승인한 작품만 같은 학급 전시관에 걸려요.`),
      r.works.length ? h('div', { class: 'gallery-list' }, r.works.map((x) => h('button', { type: 'button', class: 'work-card', 'aria-pressed': String(x.id === workSel), onClick: () => { workSel = x.id; refresh(); } },
        renderStatic(x.data, { mini: true }), h('span', { class: 't' }, `${x.number}번 ${x.name}`), h('span', { class: 'a' }, x.topicName?.replace(/^월별 /, '')), h('span', { class: `badge ${label[x.status]?.[1] || ''}` }, label[x.status]?.[0] || x.status)))) : h('p', { class: 'muted' }, '아직 제출된 작품이 없어요.')),
    right: (R) => {
      if (!w) { R.append(h('div', { class: 'lock-page' }, h('div', null, sealImg('待'), h('p', null, '학생이 작품을 제출하면 여기에서 크게 보고 승인해요.')))); return; }
      const fb = h('input', { type: 'text', placeholder: '학생에게 한마디(선택)', value: w.feedback || '' });
      const act = async (action) => { try { await api('POST', `/api/teacher/works/${w.id}/review`, { action, feedback: fb.value }); toast('처리했어요.', 'ok'); loadClasses(); } catch (e) { toast(e.message, 'bad'); } };
      const st = w.stats;
      R.append(h('div', { class: 'row between' }, h('b', { style: { fontFamily: 'var(--f-title)', fontSize: '1.2rem' } }, `${w.number}번 ${w.name}`), h('span', { class: `badge ${label[w.status]?.[1] || ''}` }, label[w.status]?.[0] || w.status)),
        h('div', { class: 'small' }, w.topicName),
        h('div', { class: 'graph-frame', style: { marginTop: '6px' } }, renderStatic(w.data, { showValues: true })),
        st ? h('div', { class: 'small', style: { marginTop: '6px' } }, `가장 큰 값 ${st.maxLabels.join(', ')} · 가장 작은 값 ${st.minLabels.join(', ')} · 변화가 가장 큰 시기 ${st.changeLabels.join(', ')}`) : null,
        h('div', { class: 'note green small', style: { marginTop: '6px' } }, w.data.interp?.sentence || '(해석 없음)'),
        h('div', { style: { marginTop: '8px' } }, fb),
        h('div', { class: 'row', style: { marginTop: '8px' } },
          w.status !== 'approved' ? btn('승인(전시)', () => act('approve'), { variant: 'gold small' }) : btn('전시 내리기', () => act('unpublish'), { variant: 'small green' }),
          w.status !== 'rejected' ? btn('다시 그리기 요청', () => act('reject'), { variant: 'small' }) : null,
          btn('삭제', async () => { if (!(await confirmBox('작품 삭제', '이 작품을 지울까요? 학생은 처음부터 다시 그려야 해요.', '삭제'))) return; await api('DELETE', `/api/teacher/works/${w.id}`); workSel = null; loadClasses(); }, { variant: 'small' })));
    },
  };
}

// ───────── 기록 모아보기 ─────────
let recSel = null;
async function recordsView() {
  const graphOf = (title, unit, rows) => {
    const labels = rows.map((x) => `${x.month}월`); const values = rows.map((x) => x.value);
    if (!values.some((v) => v !== null)) return h('p', { class: 'muted' }, '아직 기록이 없어요.');
    return renderStatic({ title, labels, values, points: Object.fromEntries(values.map((v, i) => [i, v]).filter(([, v]) => v !== null)), segments: values.slice(1).map((_, i) => [i, i + 1]).filter(([a, b]) => values[a] !== null && values[b] !== null), xUnit: '월', yUnit: unit, yName: unit === '일' ? '날수' : '수량', xName: '월' }, { showValues: true });
  };
  if (ownMode()) {
    const prog = (await api('GET', `/api/teacher/classes/${cur.id}/progress`)).rows;
    const selRow = prog.find((x) => x.id === recSel) || prog.find((x) => x.topics.length) || prog[0];
    recSel = selRow?.id ?? null;
    const detail = selRow ? await api('GET', `/api/teacher/students/${selRow.id}`) : null;
    const tids = selRow ? [...new Set(detail.responses.map((x) => x.topic_id))] : [];
    return {
      left: (L) => L.append(h('p', { class: 'small' }, '학생 이름을 누르면 그 학생이 고른 주제의 월별 기록을 모두 볼 수 있어요.'),
        h('div', { class: 'stack', style: { gap: '4px' } }, prog.map((x) => h('button', { type: 'button', class: 'rec-item', 'aria-pressed': String(x.id === recSel), onClick: () => { recSel = x.id; refresh(); } },
          h('b', null, `${x.number}번 ${x.name}`), h('span', { class: 'small' }, x.topics.length ? `주제 ${x.topics.length}개` : '주제 전'), h('span', { class: `badge ${x.worksDone >= x.minWorks ? 'ok' : ''}` }, `제출 ${x.worksDone}`))))),
      right: (R) => {
        if (!selRow || !tids.length) { R.append(h('p', { class: 'muted' }, '아직 낸 기록이 없어요.')); return; }
        R.append(h('h3', null, `${selRow.number}번 ${selRow.name}의 기록`));
        tids.forEach((tid) => {
          const t = topicById(tid);
          const rows = []; for (let m = cur.settings.monthFrom; m <= cur.settings.monthTo; m++) { const r = detail.responses.find((x) => x.topic_id === tid && x.month === m); rows.push({ month: m, value: r && r.status === 'value' ? Number(r.value) : null, status: r?.status, source: r?.source }); }
          R.append(h('div', { class: 'rec-block' }, h('b', null, `${t.name} (${t.unit})`), h('div', { class: 'table-scroll' }, h('table', { class: 'admin-table compact' },
            h('tr', null, rows.map((x) => h('th', null, `${x.month}월`))),
            h('tr', null, rows.map((x) => h('td', null, x.status === 'unknown' ? '모름' : x.value === null ? '—' : fmt(x.value))))))));
        });
      },
    };
  }
  if (lottery()) {
    const v = await api('GET', `/api/teacher/classes/${cur.id}/assign`);
    const withTopic = v.rows.filter((x) => x.topicId);
    const selRow = withTopic.find((x) => x.id === recSel) || withTopic[0];
    recSel = selRow?.id ?? null;
    let detail = null;
    if (selRow) detail = await api('GET', `/api/teacher/students/${selRow.id}`);
    return {
      left: (L) => L.append(h('p', { class: 'small' }, '학생마다 받은 주제와 기록 제출 여부예요. 이름을 누르면 오른쪽에서 그 학생의 월별 기록을 볼 수 있어요.'),
        h('div', { class: 'stack', style: { gap: '4px' } }, v.rows.map((x) => h('button', { type: 'button', class: 'rec-item', 'aria-pressed': String(x.id === recSel), disabled: !x.topicId, onClick: () => { recSel = x.id; refresh(); } },
          h('b', null, `${x.number}번 ${x.name}`), h('span', { class: 'small' }, x.topicId ? tName(x.topicId) : '주제 전'), h('span', { class: `badge ${x.surveyed ? 'ok' : ''}` }, x.surveyed ? '제출' : '—'))))),
      right: (R) => {
        if (!selRow) { R.append(h('p', { class: 'muted' }, '제비뽑기로 주제를 정하면 여기에 기록이 모여요.')); return; }
        const t = topicById(selRow.topicId);
        const rows = []; for (let m = cur.settings.monthFrom; m <= cur.settings.monthTo; m++) { const r = detail.responses.find((x) => x.topic_id === t.id && x.month === m); rows.push({ month: m, value: r && r.status === 'value' ? Number(r.value) : null, status: r?.status, source: r?.source }); }
        R.append(h('h3', null, `${selRow.number}번 ${selRow.name} · ${t.name}`),
          h('div', { class: 'table-scroll' }, h('table', { class: 'admin-table compact' },
            h('tr', null, h('th', null, '월'), rows.map((x) => h('th', null, `${x.month}월`))),
            h('tr', null, h('th', null, t.unit), rows.map((x) => h('td', null, x.status === 'unknown' ? '모름' : x.value === null ? '—' : fmt(x.value)))),
            h('tr', null, h('th', null, '근거'), rows.map((x) => h('td', { class: 'small' }, x.source === 'record' ? '기록' : x.status === 'value' ? '기억' : ''))))),
          h('div', { style: { marginTop: '10px' } }, graphOf(`${selRow.name}의 ${t.name}`, t.unit, rows)));
      },
    };
  }
  const ag = await api('GET', `/api/teacher/classes/${cur.id}/aggregate`);
  const t0 = ag.topics.find((x) => x.topicId === recSel) || ag.topics[0];
  recSel = t0?.topicId ?? null;
  return {
    left: (L) => L.append(h('p', { class: 'small' }, '학급 공동 조사 방식의 주제별 월별 집계예요.'),
      ag.topics.length ? h('div', { class: 'stack', style: { gap: '4px' } }, ag.topics.map((x) => h('button', { type: 'button', class: 'rec-item', 'aria-pressed': String(x.topicId === recSel), onClick: () => { recSel = x.topicId; refresh(); } },
        h('b', null, tName(x.topicId)), h('span', { class: 'small' }, x.mode === 'avg' ? '평균' : '합계'), h('span', { class: 'badge' }, `제출 ${x.submitted}/${ag.students}`)))) : h('p', { class: 'muted' }, '조사 주제를 열고 학생들이 응답하면 여기에 집계가 나타나요.')),
    right: (R) => {
      if (!t0) return;
      const topic = topicById(t0.topicId);
      R.append(h('h3', null, topic.name), h('div', { class: 'table-scroll' }, h('table', { class: 'admin-table compact' },
        h('tr', null, h('th', null, '월'), t0.rows.map((r) => h('th', null, `${r.month}월`))),
        h('tr', null, h('th', null, `${t0.mode === 'avg' ? '평균' : '합계'}`), t0.rows.map((r) => h('td', null, r.value === null ? '—' : fmt(r.value)))),
        h('tr', null, h('th', null, '응답'), t0.rows.map((r) => h('td', null, r.responders))),
        h('tr', null, h('th', null, '모름'), t0.rows.map((r) => h('td', null, r.unknown))))),
      h('div', { style: { marginTop: '10px' } }, graphOf(`우리 반 ${topic.name}`, topic.unit, t0.rows)));
    },
  };
}

// ───────── 자료 내려받기 ─────────
async function exportView() {
  const items = [['responses', '학생별 월별 기록', '실제 기록·기억 추정·모름 포함'], ['aggregate', '학급 월별 집계', '학급 공동 조사 방식일 때'], ['progress', '학생별 진행 현황', '단계별 완료 여부'], ['weather', '1차 기상자료(폭염일수) 조사 결과', '지역·연도·폭염일수'], ['life', '3차 우리 고장 자료 조사 결과', '조사한 자료·출처·연도별 값·다음 해 예상'], ['survey', '만족도 조사 결과', '학생(이름 없이)·교사 응답']];
  const get = async (type) => {
    if (isDemo()) {
      const r = await window.__KGL_DEMO__('GET', `/api/teacher/classes/${cur.id}/export?type=${type}`);
      const ta = h('textarea', { rows: 12, readonly: true }); ta.value = r.csv;
      modal({ wide: true, title: '체험판에서는 파일 내려받기 대신 내용을 보여 드려요', body: ta, actions: [{ label: '복사하기', value: () => { navigator.clipboard?.writeText(r.csv).then(() => toast('복사했어요.', 'ok')).catch(() => toast('직접 선택해 복사해 주세요.')); return null; } }, { label: '닫기', value: null }] });
      return;
    }
    location.href = `/api/teacher/classes/${cur.id}/export?type=${type}`;
  };
  return {
    left: (L) => L.append(h('p', null, '학급 자료를 CSV 파일로 내려받아요. 엑셀이나 한글 표 계산에서 바로 열려요.'), h('div', { class: 'note gold small' }, '학생 이름이 들어 있는 파일이에요. 학교 밖으로 보내지 않도록 주의해 주세요.')),
    right: (R) => R.append(h('div', { class: 'stack' }, items.map(([k, l, d]) => h('div', { class: 'row between export-row' }, h('span', null, h('b', null, l), h('br'), h('span', { class: 'small muted' }, d)), btn('내려받기', () => get(k), { variant: 'small green' }))))),
  };
}

// ───────── 단계·조사 설정 ─────────
async function settingsView() {
  const s = cur.settings;
  const stageNames = { weather: '1차 기상자료 탐험실', topics: ownMode() ? '2차 주제 고르기·기록' : lottery() ? '2차 나의 주제·기록' : '2. 주제 선택·투표·월별 조사', table: '2차 자료표 만들기', graph: '2차 꺾은선그래프 그리기', life: '3차 우리 고장 꺾은선그래프', gallery: '작품 전시관', survey: '학생 만족도 조사(세 활동을 마친 뒤)' };
  const guide = h('textarea', { rows: 6 }); guide.value = s.kmaGuide;
  const url = h('input', { type: 'text', value: s.kmaUrl });
  const sel = (key, opts) => h('select', { onChange: (e) => saveSettings({ [key]: e.target.value }) }, opts.map(([v, l]) => h('option', { value: v, selected: s[key] === v ? true : undefined }, l)));
  const mf = h('select', { 'aria-label': '조사 시작 월' }, Array.from({ length: 12 }, (_, i) => h('option', { value: i + 1, selected: s.monthFrom === i + 1 ? true : undefined }, `${i + 1}월`)));
  const mt = h('select', { 'aria-label': '조사 끝 월' }, Array.from({ length: 12 }, (_, i) => h('option', { value: i + 1, selected: s.monthTo === i + 1 ? true : undefined }, `${i + 1}월`)));
  return {
    left: (L) => L.append(
      h('h3', null, '학습 단계 열기·잠그기'), h('p', { class: 'small' }, '잠근 단계는 학생에게 봉인되어 보여요. 열어도 앞 단계를 마쳐야 들어갈 수 있어요(기상자료 탐험은 필수).'),
      h('div', { class: 'stack', style: { gap: '6px' } }, Object.entries(stageNames).map(([k, l]) => toggle(l, s.stages[k], (v) => saveSettings({ stages: { [k]: v } })))),
      h('h3', { style: { marginTop: '16px' } }, '월별 기록'),
      h('div', { class: 'stack', style: { gap: '6px' } },
        toggle('월별 기록 받기', s.surveyOpen, (v) => saveSettings({ surveyOpen: v }, v ? '기록을 받기 시작했어요.' : '기록 받기를 마감했어요.')),
        toggle('제출한 뒤에도 고칠 수 있게 하기', s.allowEdit, (v) => saveSettings({ allowEdit: v })),
        h('div', { class: 'row' }, h('span', null, '기간'), mf, h('span', null, '~'), mt, btn('기간 저장', () => saveSettings({ monthFrom: +mf.value, monthTo: +mt.value }), { variant: 'small green' })))),
    right: (R) => R.append(
      h('h3', null, '전시·개인정보'),
      h('div', { class: 'stack' },
        h('label', { class: 'field' }, h('span', null, '전시관 이름 표시'), sel('displayName', [['name', '이름'], ['number', '번호(○번 연구원)'], ['nickname', '별명']])),
        lottery() ? null : toggle('자료표 만들기에서 우리 반 참고 자료 보여 주기', s.tableRefVisible, (v) => saveSettings({ tableRefVisible: v })),
        lottery() ? null : h('label', { class: 'field' }, h('span', null, '참고 자료 형태'), sel('tableRefMode', [['list', '친구들 응답 목록(이름 없이) — 직접 더하기'], ['total', '학급 합계 — 옮겨 적기']])),
        lottery() ? null : h('label', { class: 'field' }, h('span', null, '19번 용돈 저축 금액 공개 방식'), sel('savingsMode', [['total', '학급 합계만'], ['average', '학급 평균만'], ['hidden', '공개 안 함']]))),
      h('h3', { style: { marginTop: '16px' } }, '기상자료 조사 안내'),
      h('label', { class: 'field' }, h('span', null, '포털 주소'), url),
      h('label', { class: 'field' }, h('span', null, '찾는 방법(누리집이 바뀌면 고쳐 주세요)'), guide),
      btn('안내 저장', () => saveSettings({ kmaUrl: url.value, kmaGuide: guide.value }), { variant: 'green small' })),
  };
}

async function accountView() {
  const c = h('input', { type: 'password', autocomplete: 'current-password' });
  const n = h('input', { type: 'password', autocomplete: 'new-password', placeholder: '8자 이상' });
  return {
    left: (L) => L.append(h('h3', null, '비밀번호 바꾸기'),
      h('form', { class: 'stack', style: { maxWidth: '360px' }, onSubmit: async (e) => { e.preventDefault(); try { await api('POST', '/api/teacher/password', { current: c.value, next: n.value }); toast('비밀번호를 바꾸었어요.', 'ok'); c.value = ''; n.value = ''; } catch (ex) { toast(ex.message, 'bad'); } } },
        h('label', { class: 'field' }, h('span', null, '현재 비밀번호'), c), h('label', { class: 'field' }, h('span', null, '새 비밀번호'), n), btn('바꾸기', null, { variant: 'green', type: 'submit' }))),
    right: (R) => R.append(h('h3', null, '수업 흐름'), h('ol', { class: 'steps-list small' },
      h('li', null, h('span', null, '학급·명단: 표로 학생 등록 → QR 나눠 주기')),
      h('li', null, h('span', null, '학생: 기상자료 탐험실(폭염일수) 완료')),
      h('li', null, h('span', null, '학생: 25가지 주제 중 직접 골라 내 기록 → 자료표 → 꺾은선그래프 제출')),
      h('li', null, h('span', null, '꼭 낼 그래프(기본 3개)를 내면, 시간이 남는 학생은 다른 주제로 더 만들기')),
      h('li', null, h('span', null, '3차: 우리 고장 관광지 입장객 수(공공데이터)나 공원·인구 자료로 우리 고장 꺾은선그래프 그리기')),
      h('li', null, h('span', null, '작품 승인 → 학생들이 작품 전시관에서 감상')))),
  };
}

// ───────── 3차 우리 고장 자료(주제·링크) ─────────
async function lifeView() {
  const s = cur.settings;
  const list = (s.lifeSources || []).map((x) => ({ ...x, links: x.links.map((l) => ({ ...l })) }));
  const regionIn = h('input', { type: 'text', maxlength: 20, value: s.lifeRegion || '', style: { maxWidth: '160px' } });
  const box = h('div', { class: 'stack' });
  const draw = () => box.replaceChildren(...list.map((src, i) => {
    const f = (k, ph, max, attrs = {}) => { const el = h(attrs.area ? 'textarea' : 'input', { type: 'text', maxlength: max, placeholder: ph, rows: attrs.area ? 2 : undefined, onInput: (e) => { src[k] = e.target.value; } }); el.value = src[k] || ''; return el; };
    const linksTa = h('textarea', { rows: 3, placeholder: '한 줄에 하나: 링크 이름 | https://주소', onInput: (e) => { src.links = e.target.value.split('\n').map((l) => { const [t, u] = l.split('|').map((x) => (x || '').trim()); return { t, u }; }).filter((l) => l.t && l.u); } });
    linksTa.value = src.links.map((l) => { let u = l.u; try { u = decodeURI(u); } catch { /* */ } return `${l.t} | ${u}`; }).join('\n');
    return h('div', { class: 'sheet' },
      h('div', { class: 'row between' }, h('b', null, `자료 ${i + 1}`), h('button', { type: 'button', class: 'link-btn', onClick: () => { list.splice(i, 1); draw(); } }, '빼기')),
      h('div', { class: 'row', style: { gap: '6px' } }, h('label', { class: 'field', style: { flex: '1 1 160px' } }, h('span', null, '자료 이름'), f('title', '예: ○○ 입장객 수', 40)), h('label', { class: 'field', style: { flex: '0 0 90px' } }, h('span', null, '단위'), f('unit', '명', 10))),
      h('label', { class: 'field' }, h('span', null, '학생에게 보이는 설명'), f('desc', '', 400, { area: true })),
      h('label', { class: 'field' }, h('span', null, '찾는 방법'), f('tip', '', 500, { area: true })),
      h('label', { class: 'field' }, h('span', null, '링크(누리집·기사)'), linksTa));
  }));
  draw();
  return {
    left: (L) => L.append(
      h('p', { class: 'small' }, '3차 활동(교과서 122~123쪽)에서 학생이 고를 우리 고장 자료와, 자료를 찾을 누리집·뉴스 링크예요. 누리집 주소나 기사가 바뀌면 여기에서 고쳐 주세요.'),
      h('div', { class: 'sheet' },
        h('h3', { style: { marginTop: 0 } }, '우리 고장 바꾸기'),
        h('p', { class: 'small' }, '시·군 이름을 적고 [이 지역 자료로 바꾸기]를 누르면, 관광지 입장객 수·도시공원 수·인구 자료가 그 지역 이름과 링크로 바뀌어요.'),
        h('div', { class: 'row', style: { gap: '6px', alignItems: 'flex-end' } },
          h('label', { class: 'field', style: { flex: '1 1 140px' } }, h('span', null, '우리 고장 이름(예: 창원시, 하동군, 수원시)'), regionIn),
          btn('이 지역 자료로 바꾸기', async () => {
            const reg = normalizeRegion(regionIn.value);
            if (!reg) return toast('지역 이름을 적어 주세요.', 'bad');
            if (!(await confirmBox('우리 고장 바꾸기', `3차 자료를 ‘${reg}’ 자료로 바꿀까요? 지금 목록에서 고친 내용은 새 목록으로 바뀌어요. (이미 학생이 적은 표와 그래프는 그대로 남아요.)`, '바꾸기'))) return;
            if (await saveSettings({ lifeRegion: reg, lifeSources: buildLifeSources(reg) }, `‘${reg}’ 자료로 바꾸었어요.`)) refresh();
          }, { variant: 'gold small' })),
        s.school?.address && regionFromAddress(s.school.address) && regionFromAddress(s.school.address) !== s.lifeRegion
          ? h('p', { class: 'small' }, '학교 주소로 보면 ', h('button', { type: 'button', class: 'link-btn', onClick: () => { regionIn.value = regionFromAddress(s.school.address); } }, regionFromAddress(s.school.address)), '인 것 같아요.') : null,
        h('div', { class: 'note gold small', style: { marginTop: '6px' } }, hasTourData(s.lifeRegion)
          ? `${s.lifeRegion}은(는) 공공데이터포털 「경상남도 주요관광지점 입장객 현황」(2017~2022년)에 관광지 자료가 있어서, 입장객이 많은 관광지의 자료표가 학생 화면에 함께 보여요. 2020~2021년에 크게 줄어든 까닭도 함께 이야기해 보세요.`
          : `${s.lifeRegion}의 관광지 입장객 수는 학생이 관광지식정보시스템에서 직접 찾아요(지금 들어 있는 관광지 자료표는 경상남도 시·군 자료예요). 인구·도시공원 수도 링크에서 찾아요.`)),
      h('div', { class: 'row', style: { marginTop: '10px' } },
        btn('저장', async () => { if (await saveSettings({ lifeSources: list, lifeRegion: regionIn.value }, '3차 자료를 저장했어요.')) refresh(); }, { variant: 'gold small' }),
        btn('＋ 자료 더하기', () => { list.push({ id: `s${Date.now() % 100000}`, title: '', unit: '', desc: '', tip: '', links: [] }); draw(); }, { variant: 'small green' }),
        btn('처음 목록으로 되돌리기', async () => { if (!(await confirmBox('처음 목록으로', `‘${s.lifeRegion}’의 처음 자료 목록으로 되돌릴까요?`))) return; if (await saveSettings({ lifeSources: buildLifeSources(s.lifeRegion) }, '처음 목록으로 되돌렸어요.')) refresh(); }, { variant: 'small' }))),
    right: (R) => R.append(box),
  };
}

// ───────── 만족도 조사: 왼쪽 학생 결과(이름 없이), 오른쪽 선생님 조사 ─────────
async function surveyView() {
  const r = await api('GET', `/api/teacher/classes/${cur.id}/survey`);
  const st = r.students; const tc = r.teacher;
  const COLORS = ['#c8b89a', '#d9c08a', '#c9a24e', '#a8732f', '#7b2620'];
  return {
    left: (L) => {
      L.append(h('p', { class: 'small' }, '1차·2차·3차 그래프를 모두 낸 학생에게 만족도 조사가 열려요. 결과는 이름 없이 모아 보여요.'),
        h('div', { class: 'glance' }, h('div', { class: 'glance-row' }, h('span', { class: 'k' }, '응답한 학생'), h('span', { class: 'v' }, `${st.responded} / ${st.total}명`))));
      if (!st.responded) { L.append(h('p', { class: 'muted', style: { marginTop: '10px' } }, '아직 응답한 학생이 없어요.')); return; }
      L.append(h('div', { class: 'small muted', style: { margin: '8px 0 4px' } }, SCALE_LABELS.map((l, i) => `${i + 1} ${l}`).join(' · ')));
      st.summary.forEach((it, i) => {
        if (it.type === 'scale') {
          L.append(h('div', { class: 'sv-bar' }, h('span', { class: 'q' }, `${i + 1}. ${it.q}`), h('span', { class: 'avg' }, it.avg === null ? '—' : `평균 ${it.avg}`),
            h('div', { class: 'sv-dist', title: it.dist.map((n, k) => `${k + 1}: ${n}명`).join(', ') }, it.dist.map((n, k) => (n ? h('i', { style: { width: `${(n / it.n) * 100}%`, background: COLORS[k] } }) : null)))));
        } else if (it.type === 'choice') {
          L.append(h('div', { class: 'sv-bar' }, h('span', { class: 'q' }, `${i + 1}. ${it.q}`), h('span', null, ''),
            h('div', { style: { gridColumn: '1 / -1' } }, it.counts.map((c) => h('span', { class: 'badge', style: { marginRight: '4px' } }, `${c.option} ${c.n}명`)))));
        } else {
          L.append(h('div', { class: 'sv-bar' }, h('span', { class: 'q' }, `${i + 1}. ${it.q} (${it.n}명)`)), it.texts.length ? h('ul', { class: 'sv-texts' }, it.texts.map((t) => h('li', null, t))) : null);
        }
      });
    },
    right: (R) => {
      R.append(h('div', { class: 'center' }, h('h2', { class: 'plaque green' }, '선생님 만족도 조사')));
      if (!tc.open) { R.append(h('div', { class: 'lock-page' }, h('div', null, sealImg('待'), h('p', null, tc.reason), btn('작품 승인하러 가기', () => { section = 'works'; sub = 'works'; drawTabs(); show('jump'); }, { variant: 'small green' })))); return; }
      R.append(h('p', { class: 'small' }, '수업에 써 보신 소감을 알려 주세요. 제출한 뒤에도 고칠 수 있어요.'),
        tc.mine ? h('div', { class: 'note green small' }, '제출했어요. 고마워요!') : null,
        surveyForm(tc.items, tc.mine?.answers, async (answers) => { await api('PUT', `/api/teacher/classes/${cur.id}/survey`, { answers }); toast('만족도 조사를 제출했어요. 고마워요!', 'ok'); refresh(); }, { done: !!tc.mine }));
    },
  };
}

const VIEWS = { survey: surveyView, life: lifeView, roster: rosterView, qr: qrView, progress: progressView, picker: pickerView, mine: mineView, lottery: lotteryView, topics: topicsView, works: worksView, records: recordsView, export: exportView, settings: settingsView, account: accountView };

// ───────── 학교 찾기(나이스) — 학급 만들기와 학급 정보 고치기에서 함께 사용 ─────────
function schoolPicker(onPick, initial = null) {
  let chosen = initial;
  const q = h('input', { type: 'search', placeholder: '학교 이름 (예: 행복초)', 'aria-label': '학교 이름', maxlength: 30 });
  let savedOffice = ''; try { savedOffice = localStorage.getItem('kgl-office') || ''; } catch { /* */ }
  const office = h('select', { 'aria-label': '시·도', class: 'office-select', onChange: () => { try { localStorage.setItem('kgl-office', office.value); } catch { /* */ } if (q.value.trim().length >= 2) search(); } },
    h('option', { value: '' }, '전체 시·도'), OFFICES.map(([c, n]) => h('option', { value: c, selected: c === savedOffice ? true : undefined }, n)));
  const elemOnly = h('input', { type: 'checkbox', checked: true, onChange: () => { if (q.value.trim().length >= 2) search(); } });
  const list = h('div', { class: 'school-list', role: 'listbox', 'aria-label': '검색한 학교' });
  const note = h('div', { class: 'small', role: 'status' });
  const manualName = h('input', { type: 'text', placeholder: '예: 행복초등학교', maxlength: 40 });
  const manualRegion = h('input', { type: 'text', placeholder: '예: 경상남도 창원시 (선택)', maxlength: 20 });
  const manual = h('div', { class: 'stack hidden', style: { gap: '6px', marginTop: '8px' } },
    h('label', { class: 'field' }, h('span', null, '학교 이름 직접 적기'), manualName),
    h('label', { class: 'field' }, h('span', null, '지역(시·도와 시·군) — 3차 우리 고장 자료에 쓰여요'), manualRegion),
    btn('이 이름으로 정하기', () => {
      const name = manualName.value.trim();
      if (name.length < 2) return toast('학교 이름을 적어 주세요.', 'bad');
      pick({ name, region: manualRegion.value.trim(), manual: true });
    }, { variant: 'small green' }));
  const chosenEl = h('div', { class: 'school-chosen' });
  const pick = (sc) => { chosen = sc; showChosen(); onPick(sc); };
  const showChosen = () => {
    chosenEl.replaceChildren(chosen ? h('div', { class: 'note green' }, h('b', null, '선택한 학교 '), chosen.name, chosen.kind ? ` (${chosen.kind})` : '', chosen.region || chosen.address ? h('div', { class: 'small' }, [chosen.office || chosen.region, chosen.address].filter(Boolean).join(' · ')) : null, chosen.manual ? h('div', { class: 'small muted' }, '직접 적은 학교') : null) : '');
  };
  const search = async () => {
    const v = q.value.trim();
    if (v.length < 2) { note.textContent = '학교 이름을 두 글자 이상 적어 주세요.'; return; }
    note.textContent = '찾는 중…'; list.replaceChildren();
    try {
      const r = await api('GET', `/api/teacher/schools?q=${encodeURIComponent(v)}&office=${office.value}&kind=${elemOnly.checked ? encodeURIComponent('초등학교') : ''}`);
      if (!r.available) {
        note.replaceChildren(h('span', { class: 'err-text' }, r.error || '이 환경에서는 학교 검색을 쓸 수 없어요(체험판이거나 인터넷이 막혀 있어요). 학교 이름을 직접 적어 주세요.'));
        manual.classList.remove('hidden'); manualName.value = manualName.value || v; return;
      }
      if (!r.schools.length) { note.textContent = `찾는 학교가 없어요. ${office.value ? '시·도가 맞는지 확인하거나, ' : ''}이름을 줄여서(예: 행복초) 다시 찾거나 직접 적어 주세요.`; manual.classList.remove('hidden'); return; }
      note.textContent = `${r.schools.length}개 학교를 찾았어요.${r.schools.length >= 5 && !office.value ? ' 원하는 학교가 없으면 위에서 시·도를 골라 주세요(이름이 같은 학교가 많으면 일부만 보여요).' : ''}`;
      list.replaceChildren(...r.schools.map((sc) => h('button', { type: 'button', class: 'school-item', role: 'option', 'aria-selected': String(chosen?.code === sc.code), onClick: (e) => {
        list.querySelectorAll('.school-item').forEach((b) => b.setAttribute('aria-selected', String(b === e.currentTarget))); pick(sc);
      } }, h('b', null, sc.name), sc.kind ? h('span', { class: `badge ${sc.kind === '초등학교' ? 'green' : ''}` }, sc.kind) : null, h('span', { class: 'small muted' }, [sc.office, sc.address].filter(Boolean).join(' · ')))));
    } catch (e) { note.replaceChildren(h('span', { class: 'err-text' }, e.message)); manual.classList.remove('hidden'); }
  };
  q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); search(); } });
  showChosen();
  return h('div', { class: 'stack', style: { gap: '8px' } },
    h('div', { class: 'row', style: { flexWrap: 'nowrap', gap: '6px' } }, office, q, btn('검색', () => search(), { variant: 'small' })),
    h('label', { class: 'toggle small' }, elemOnly, '초등학교만 찾기'),
    note, list,
    h('button', { type: 'button', class: 'link-btn', style: { justifySelf: 'start' }, onClick: () => manual.classList.toggle('hidden') }, '목록에 없나요? 학교 이름 직접 적기'),
    manual, chosenEl);
}

function randomCode() {
  const C = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let c = '';
  for (let i = 0; i < 6; i++) c += C[Math.floor(Math.random() * C.length)];
  return c;
}

// 학급 코드 입력 + 사용 가능 여부 바로 확인
function codeField(initial, classId, onState) {
  const input = h('input', { type: 'text', value: initial, maxlength: 8, autocapitalize: 'characters', class: 'code-input', 'aria-label': '학급 코드', spellcheck: 'false' });
  const msg = h('div', { class: 'small', role: 'status' });
  let timer; let seq = 0;
  const check = async () => {
    const v = input.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); input.value = v;
    const my = ++seq; msg.textContent = '확인 중…'; onState(null, v);
    try {
      const r = await api('GET', `/api/teacher/code-check?code=${encodeURIComponent(v)}${classId ? `&classId=${classId}` : ''}`);
      if (my !== seq) return;
      msg.replaceChildren(r.available ? h('span', { class: 'ok-text' }, '✔ 사용할 수 있는 코드예요.') : h('span', { class: 'err-text' }, r.error || '✗ 이미 다른 학급이 쓰고 있어요.'));
      input.classList.toggle('ok', !!r.available); input.classList.toggle('err', !r.available);
      onState(!!r.available, v);
    } catch (e) { msg.replaceChildren(h('span', { class: 'err-text' }, e.message)); onState(false, v); }
  };
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(check, 350); });
  setTimeout(check, 0);
  return { el: h('div', { class: 'stack', style: { gap: '6px' } },
    h('div', { class: 'row', style: { flexWrap: 'nowrap' } }, input, btn('다시 만들기', () => { input.value = randomCode(); check(); }, { variant: 'small green' })),
    msg, h('p', { class: 'small muted', style: { margin: 0 } }, '영문 대문자와 숫자 4~8자리. 헷갈리는 O·0, I·1은 피하는 게 좋아요.')), input };
}

// ───────── 새 학급 만들기 마법사: ① 학교 → ② 학년·반 → ③ 학급 코드 → ④ QR ─────────
function openClassWizard() {
  const W = { school: null, grade: 4, classNo: 1, nickname: '', name: '', nameEdited: false, code: randomCode(), codeOk: null };
  const STEPS = ['학교 찾기', '학년·반', '학급 코드', 'QR 완성'];
  let step = 0; let created = null;
  const bar = h('ol', { class: 'wiz-steps' });
  const body = h('div', { class: 'wiz-body' });
  const actions = h('div', { class: 'actions' });
  const box = h('div', { class: 'modal wide wizard', role: 'dialog', 'aria-modal': 'true', 'aria-label': '새 학급 만들기' }, h('h3', null, '새 학급 만들기'), bar, body, actions);
  const back = h('div', { class: 'modal-back' }, box);
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape' && !created) close(); };
  document.addEventListener('keydown', onKey);
  document.body.append(back);
  const autoName = () => (W.school ? `${W.school.name} ${W.grade}학년 ${W.classNo}반` : `${W.grade}학년 ${W.classNo}반`);

  const render = () => {
    bar.replaceChildren(...STEPS.map((t, i) => h('li', { class: i === step ? 'on' : i < step ? 'done' : '' }, h('span', { class: 'n' }, i < step ? '✓' : i + 1), t)));
    actions.replaceChildren();
    if (step === 0) {
      const nextBtn = btn('다음 ›', () => { step = 1; render(); }, { variant: 'small', disabled: !W.school });
      body.replaceChildren(h('p', null, '우리 학교를 찾아 골라 주세요. (나이스 교육정보 개방 포털의 학교 정보를 써요)'),
        schoolPicker((sc) => { W.school = sc; if (!W.nameEdited) W.name = ''; nextBtn.disabled = false; }, W.school));
      actions.append(btn('취소', close, { variant: 'small green' }), nextBtn);
    } else if (step === 1) {
      const g = h('select', { 'aria-label': '학년', onChange: (e) => { W.grade = +e.target.value; refreshName(); } }, [1, 2, 3, 4, 5, 6].map((n) => h('option', { value: n, selected: W.grade === n ? true : undefined }, `${n}학년`)));
      const c = h('input', { type: 'number', min: 1, max: 30, value: W.classNo, 'aria-label': '반', style: { maxWidth: '110px' }, onInput: (e) => { W.classNo = Math.max(1, Math.min(30, +e.target.value || 1)); refreshName(); } });
      const nick = h('input', { type: 'text', value: W.nickname, maxlength: 20, placeholder: '예: 꿈나무반 (선택)', onInput: (e) => { W.nickname = e.target.value.trim(); } });
      const name = h('input', { type: 'text', value: W.name || autoName(), maxlength: 40, onInput: (e) => { W.name = e.target.value; W.nameEdited = true; } });
      const refreshName = () => { if (!W.nameEdited) { W.name = autoName(); name.value = W.name; } };
      body.replaceChildren(
        h('div', { class: 'note green small' }, h('b', null, W.school.name), W.school.region || W.school.office ? ` · ${W.school.office || W.school.region}` : ''),
        h('div', { class: 'row', style: { marginTop: '10px', gap: '14px' } }, h('label', { class: 'field' }, h('span', null, '학년'), g), h('label', { class: 'field' }, h('span', null, '반'), c)),
        h('label', { class: 'field', style: { marginTop: '10px' } }, h('span', null, '학급 별명'), nick),
        h('label', { class: 'field', style: { marginTop: '10px' } }, h('span', null, '학급 이름 (학생 화면과 관리실에 보여요)'), name));
      W.name = W.name || autoName();
      actions.append(btn('‹ 이전', () => { step = 0; render(); }, { variant: 'small green' }), btn('다음 ›', () => { if (!W.name.trim()) return toast('학급 이름을 적어 주세요.', 'bad'); step = 2; render(); }, { variant: 'small' }));
    } else if (step === 2) {
      const next = btn('학급 만들기', () => create(), { variant: 'small gold', disabled: true });
      const f = codeField(W.code, null, (ok, v) => { W.code = v; W.codeOk = ok; next.disabled = ok !== true; });
      body.replaceChildren(h('p', null, '학생들이 들어올 때 쓰는 학급 코드예요. 그대로 써도 되고, 기억하기 쉬운 코드로 바꿔도 돼요.'), f.el,
        h('div', { class: 'note small', style: { marginTop: '10px' } }, h('b', null, '만들 학급 '), W.name, W.nickname ? ` 「${W.nickname}」` : ''));
      actions.append(btn('‹ 이전', () => { step = 1; render(); }, { variant: 'small green' }), next);
      setTimeout(() => f.input.focus(), 30);
    } else {
      body.replaceChildren(qrCard(created));
      actions.append(btn('학생 명단 등록하러 가기 ›', async () => { close(); section = 'class'; sub = 'roster'; await loadClasses(created.id); }, { variant: 'small gold' }), btn('닫기', async () => { close(); await loadClasses(created.id); }, { variant: 'small green' }));
    }
  };
  async function create() {
    try {
      const r = await api('POST', '/api/teacher/classes', { school: W.school, grade: W.grade, classNo: W.classNo, nickname: W.nickname, name: W.name.trim(), code: W.code });
      created = { id: r.id, code: r.code, name: r.name, settings: { school: W.school, nickname: W.nickname } };
      toast('학급을 만들었어요!', 'ok'); step = 3; render();
    } catch (e) { toast(e.message, 'bad'); }
  }
  render();
}

// ───────── 학생 접속 QR 카드 ─────────
function qrCard(cls) {
  const wrap = h('div', { class: 'qr-card' });
  const draw = () => {
    const url = joinUrl(cls.code);
    const baseIn = h('input', { type: 'text', value: getBase(), placeholder: 'https://우리학교서버주소/', 'aria-label': '학생 접속 주소' });
    wrap.replaceChildren(
      h('div', { class: 'qr-left' },
        url ? h('div', { class: 'qr-frame' }, qrSvg(url, { label: `${cls.name} 접속 QR` })) : h('div', { class: 'qr-frame qr-missing' }, '아래에 학생 접속 주소를 적으면 QR이 만들어져요.'),
        h('div', { class: 'qr-code-big' }, cls.code)),
      h('div', { class: 'qr-right stack' },
        h('h3', { style: { margin: 0 } }, cls.name),
        cls.settings?.school?.name && !cls.name.includes(cls.settings.school.name) ? h('div', { class: 'small' }, cls.settings.school.name) : null,
        h('ol', { class: 'steps-list small' },
          h('li', null, h('span', null, '태블릿·휴대전화 카메라로 QR을 비춰요.')),
          h('li', null, h('span', null, '학급 코드가 자동으로 들어간 입장 화면이 열려요.')),
          h('li', null, h('span', null, '명단에서 내 이름을 누르면 들어와요.'))),
        h('p', { class: 'small muted', style: { margin: 0 } }, 'QR을 못 쓰는 기기는 연구소 첫 화면에서 학급 코드를 직접 적어요.'),
        isDemo() ? h('div', { class: 'note gold small' }, '체험판은 자료가 이 브라우저에만 저장돼서, 다른 기기에서 QR로 들어와도 이 학급이 보이지 않아요. 학교 서버나 호스팅에 올리면 QR이 그대로 작동해요.') : null,
        url ? h('div', { class: 'qr-url' }, url) : null,
        h('div', { class: 'row' },
          url ? btn('주소 복사', () => navigator.clipboard?.writeText(url).then(() => toast('주소를 복사했어요.', 'ok')).catch(() => toast('주소를 직접 선택해 복사해 주세요.')), { variant: 'small green' }) : null,
          url ? btn('크게 보기', () => bigQr(cls, url), { variant: 'small green' }) : null,
          url ? btn('인쇄용 카드', () => printQr(cls, url), { variant: 'small' }) : null),
        h('details', { class: 'small' }, h('summary', null, '학생 접속 주소 바꾸기'),
          h('div', { class: 'stack', style: { gap: '6px', marginTop: '6px' } },
            h('p', { style: { margin: 0 } }, '학생들이 여는 연구소 주소예요. 보통은 지금 주소 그대로 쓰면 돼요.'),
            baseIn,
            h('div', { class: 'row' },
              btn('저장', () => { const v = baseIn.value.trim(); if (v && !/^https?:\/\//.test(v)) return toast('http:// 또는 https://로 시작하는 주소를 적어 주세요.', 'bad'); setBase(v); draw(); }, { variant: 'small green' }),
              defaultBase() ? btn('지금 주소로', () => { setBase(''); draw(); }, { variant: 'small' }) : null)))));
  };
  draw();
  return wrap;
}

function openQr(cls) {
  modal({ wide: true, title: '학생 접속 QR', body: qrCard(cls), actions: [{ label: '닫기', value: null, variant: 'green' }] });
}

function bigQr(cls, url) {
  const view = h('div', { class: 'qr-big', role: 'dialog', 'aria-modal': 'true', 'aria-label': '학생 접속 QR 크게 보기', onClick: () => close() },
    h('div', { class: 'qr-big-inner' },
      h('div', { class: 'qr-big-title' }, cls.name),
      h('div', { class: 'qr-frame' }, qrSvg(url)),
      h('div', { class: 'qr-big-code' }, '학급 코드 ', h('b', null, cls.code)),
      h('div', { class: 'small muted' }, '화면을 누르면 닫혀요')));
  const close = () => { view.remove(); document.removeEventListener('keydown', onKey); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  document.body.append(view);
  view.requestFullscreen?.().catch(() => {});
}

function printQr(cls, url) {
  const card = h('div', { class: 'qr-print' },
    h('div', { class: 'qr-print-head' }, '꺾은선그래프 연구소'),
    h('div', { class: 'qr-print-name' }, cls.name),
    h('div', { class: 'qr-frame' }, qrSvg(url)),
    h('div', { class: 'qr-print-code' }, '학급 코드 ', h('b', null, cls.code)),
    h('div', { class: 'qr-print-help' }, '카메라로 QR을 비추고, 명단에서 내 이름을 눌러요.'));
  document.body.append(card); document.body.classList.add('printing-qr');
  const done = () => { card.remove(); document.body.classList.remove('printing-qr'); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  try { window.print(); } catch { /* */ }
  setTimeout(() => { if (document.body.classList.contains('printing-qr')) { done(); toast('이 화면에서는 인쇄 창을 열 수 없어요. [크게 보기]를 화면에 띄워 주세요.'); } }, 1500);
}


// 설정 탭: 학교·학년·반 고치기
function schoolSheet() {
  const st = cur.settings;
  let picked = st.school || null;
  const g = h('select', { 'aria-label': '학년' }, h('option', { value: '' }, '학년'), [1, 2, 3, 4, 5, 6].map((n) => h('option', { value: n, selected: st.grade === n ? true : undefined }, `${n}학년`)));
  const c = h('input', { type: 'number', min: 1, max: 30, value: st.classNo || '', placeholder: '반', 'aria-label': '반', style: { maxWidth: '100px' } });
  const nick = h('input', { type: 'text', value: st.nickname || '', maxlength: 20, placeholder: '예: 꿈나무반', 'aria-label': '학급 별명' });
  return sheet(h('h3', null, '학교·학년·반'),
    h('details', null, h('summary', null, picked ? `학교: ${picked.name}${picked.kind ? ` (${picked.kind})` : ''} — 바꾸기` : '학교를 아직 정하지 않았어요 — 학교 찾기'),
      h('div', { style: { marginTop: '8px' } }, schoolPicker((sc) => { picked = sc; }, picked))),
    h('div', { class: 'row', style: { marginTop: '10px', gap: '12px' } }, g, c, h('label', { class: 'field grow' }, h('span', null, '학급 별명'), nick)),
    h('div', { class: 'row', style: { marginTop: '8px' } }, btn('학교·학년·반 저장', async () => {
      if (await saveSettings({ school: picked, grade: g.value ? +g.value : null, classNo: c.value ? +c.value : null, nickname: nick.value.trim() }, '학교 정보를 저장했어요.')) loadClasses();
    }, { variant: 'small green' })));
}

// 설정 탭: 학급 코드 직접 정하기
function codeSheet() {
  let state = { ok: null, v: cur.code };
  const save = btn('이 코드로 바꾸기', async () => {
    if (state.v === cur.code) return toast('지금 쓰는 코드와 같아요.');
    if (!(await confirmBox('학급 코드 바꾸기', `학급 코드를 ${state.v}(으)로 바꿀까요? 예전 코드와 예전 QR로는 더 이상 들어올 수 없어요. 이미 들어와 있는 학생은 그대로예요.`, '바꾸기'))) return;
    try { await api('POST', `/api/teacher/classes/${cur.id}/code`, { code: state.v }); toast('학급 코드를 바꾸었어요. 새 QR을 나누어 주세요.', 'ok'); await loadClasses(); } catch (e) { toast(e.message, 'bad'); }
  }, { variant: 'small', disabled: true });
  const f = codeField(cur.code, cur.id, (ok, v) => { state = { ok, v }; save.disabled = ok !== true || v === cur.code; });
  return sheet(h('h3', null, '학급 코드와 QR'), f.el,
    h('div', { class: 'row', style: { marginTop: '8px' } }, save, btn('학생 접속 QR 보기', () => openQr(cur), { variant: 'small green' })));
}
