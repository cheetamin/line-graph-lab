// 전체 관리자: 모든 학급의 운영 현황(학급 수·학생 수·작품 수)과 학생·교사 만족도 조사 결과
import { h, btn, toast, iconSrc } from '../ui.js?v=mwy8rmum';
import { api } from '../api.js?v=mwy8rmum';
import { logout } from '../main.js?v=mwy8rmum';
import { makeHeader, scene, lanternImg, deskProps } from '../shell.js?v=mwy8rmum';
import { Book } from '../book.js?v=mwy8rmum';
import { SCALE_LABELS } from '../../shared/survey.js?v=mwy8rmum';

const SECTIONS = [
  { key: 'overview', label: '운영 현황', icon: 'home' },
  { key: 'classes', label: '학급 목록', icon: 'table' },
  { key: 'students', label: '학생 만족도', icon: 'vote' },
  { key: 'teachers', label: '교사 만족도', icon: 'brush' },
  { key: 'regions', label: '지역·학교별', icon: 'town' },
  { key: 'export', label: '내려받기', icon: 'scroll' },
];
const COLORS = ['#c8b89a', '#d9c08a', '#c9a24e', '#a8732f', '#7b2620'];
let section = 'overview'; let withDemo = false; let data = null; let book; let tabsEl;

export async function mountAdmin(root) {
  tabsEl = h('nav', { class: 'side-tabs', 'aria-label': '관리자 메뉴' });
  book = new Book({ onPrev: () => flip(-1), onNext: () => flip(1) });
  book.wrap.classList.add('teacher-book');
  const right = h('div', { class: 'teacher-who' }, h('b', null, '전체 관리자'), h('button', { class: 'top-btn', type: 'button', onClick: () => logout() }, '나가기'));
  root.append(scene(makeHeader({ sub: '전체 관리자', right }), h('main', { class: 'stage' }, h('div', { class: 'side-col' }, tabsEl, lanternImg()), book.wrap)));
  deskProps(root);
  await load(); draw(null);
}

async function load() {
  try { data = await api('GET', `/api/admin/overview${withDemo ? '?demo=1' : ''}`); } catch (e) { toast(e.message, 'bad'); data = null; }
}
function flip(d) {
  const i = SECTIONS.findIndex((x) => x.key === section) + d;
  if (i < 0 || i >= SECTIONS.length || book.busy) return;
  section = SECTIONS[i].key; draw(d > 0 ? 'next' : 'prev');
}
function drawTabs() {
  tabsEl.replaceChildren(...SECTIONS.map((sc) => h('button', { type: 'button', class: 'side-tab', 'aria-current': sc.key === section ? 'page' : undefined,
    onClick: () => { if (sc.key !== section) { section = sc.key; draw('jump'); } } }, h('img', { src: iconSrc(sc.icon), alt: '' }), h('span', null, sc.label))));
}

function draw(dir) {
  drawTabs();
  const sc = SECTIONS.find((x) => x.key === section);
  const i = SECTIONS.indexOf(sc);
  const view = data ? VIEWS[section]() : { left: (L) => L.append(h('p', { class: 'err-text' }, '자료를 불러오지 못했어요.')), right: () => {} };
  book.show({
    folio: ['전체 관리자', sc.label],
    left: (L) => {
      L.append(h('div', { class: 'page-head' }, h('img', { class: 'ico', src: iconSrc(sc.icon), alt: '', width: 46, height: 46 }),
        h('div', null, h('div', { class: 'kicker' }, '꺾은선그래프 연구소 · 전체 관리자'), h('h2', null, sc.label))),
      h('div', { class: 'row', style: { gap: '8px' } },
        h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: withDemo, onChange: async (e) => { withDemo = e.target.checked; await load(); draw(null); } }), '체험 학급도 넣어서 보기'),
        btn('새로고침', async () => { await load(); draw(null); }, { variant: 'small green' })),
      h('div', { class: 'divider' }));
      view.left(L);
    },
    right: (R) => view.right(R),
    canPrev: i > 0, canNext: i < SECTIONS.length - 1, prevText: SECTIONS[i - 1]?.label, nextText: SECTIONS[i + 1]?.label,
  }, dir);
}

const row = (k, v, cls = '') => h('div', { class: 'glance-row' }, h('span', { class: 'k' }, k), h('span', { class: `v ${cls}` }, v));

function overview() {
  const t = data.totals;
  return {
    left: (L) => L.append(
      h('div', { class: 'glance' },
        row('운영 중인 학급', `${t.classes}개`), row('선생님', `${t.teachers}명`), row('학생', `${t.students}명`),
        row('제출된 작품', `${t.works}개`), row('전시(승인)된 작품', `${t.approved}개`, 'chg'),
        row('학생 만족도 응답', `${t.studentSurveys}명`), row('교사 만족도 응답', `${t.teacherSurveys}명`)),
      h('p', { class: 'small muted', style: { marginTop: '10px' } }, withDemo ? '체험 학급을 넣어서 센 수예요.' : `체험 학급(${t.demoClasses}개)은 빼고 센 수예요.`)),
    right: (R) => {
      R.append(h('div', { class: 'center' }, h('h2', { class: 'plaque green' }, '만족도 한눈에')));
      const avg = (list) => { const xs = list.filter((x) => x.type === 'scale' && x.avg !== null); return xs.length ? Math.round((xs.reduce((a, x) => a + x.avg, 0) / xs.length) * 10) / 10 : null; };
      const sa = avg(data.surveys.students); const ta = avg(data.surveys.teachers);
      R.append(h('div', { class: 'glance' },
        row('학생 만족도 평균(5점)', sa === null ? '—' : `${sa}점`, 'chg'),
        row('교사 만족도 평균(5점)', ta === null ? '—' : `${ta}점`, 'chg')),
      h('p', { class: 'small muted', style: { marginTop: '8px' } }, '문항별 결과는 [학생 만족도]·[교사 만족도] 쪽에서 볼 수 있어요. 학생 응답은 이름 없이 모아 보여요.'));
    },
  };
}

function classes() {
  const list = data.classes;
  return {
    left: (L) => L.append(h('p', { class: 'small' }, `학급 ${list.length}개 · 학생 ${data.totals.students}명. 최근에 만든 학급이 위에 있어요.`),
      h('p', { class: 'small muted' }, '학생 이름과 작품 내용은 각 학급 선생님만 볼 수 있어요. 여기에서는 수만 보여요.')),
    right: (R) => R.append(list.length ? h('div', { class: 'table-scroll' }, h('table', { class: 'admin-table compact' },
      h('thead', null, h('tr', null, ['학교·학급', '선생님', '학생', '작품(전시)', '만족도', '지역'].map((x) => h('th', null, x)))),
      h('tbody', null, list.map((c) => h('tr', null,
        h('td', { class: 'l' }, h('b', null, c.name), c.isDemo ? h('span', { class: 'badge', style: { marginLeft: '4px' } }, '체험') : null, h('br'), h('span', { class: 'small muted' }, `${c.school || '학교 미입력'} · 코드 ${c.code}`)),
        h('td', null, c.teacher), h('td', null, `${c.students}명`), h('td', null, `${c.works}(${c.approved})`),
        h('td', { class: 'small' }, `학생 ${c.studentSurveys}명`, h('br'), c.teacherSurvey ? '교사 응답 ✓' : '교사 —'),
        h('td', { class: 'small' }, c.region || '—')))))) : h('p', { class: 'muted' }, '아직 만든 학급이 없어요.')),
  };
}

function summaryNodes(list) {
  const out = [h('div', { class: 'small muted', style: { margin: '0 0 6px' } }, SCALE_LABELS.map((l, i) => `${i + 1} ${l}`).join(' · '))];
  list.forEach((it, i) => {
    if (it.type === 'scale') {
      out.push(h('div', { class: 'sv-bar' }, h('span', { class: 'q' }, `${i + 1}. ${it.q}`), h('span', { class: 'avg' }, it.avg === null ? '—' : `평균 ${it.avg}`),
        h('div', { class: 'sv-dist', title: it.dist.map((n, k) => `${k + 1}: ${n}명`).join(', ') }, it.dist.map((n, k) => (n ? h('i', { style: { width: `${(n / it.n) * 100}%`, background: COLORS[k] } }) : null)))));
    } else if (it.type === 'choice') {
      out.push(h('div', { class: 'sv-bar' }, h('span', { class: 'q' }, `${i + 1}. ${it.q}`), h('span', null, ''),
        h('div', { style: { gridColumn: '1 / -1' } }, it.counts.map((c) => h('span', { class: 'badge', style: { marginRight: '4px' } }, `${c.option} ${c.n}명`)))));
    } else {
      out.push(h('div', { class: 'sv-bar' }, h('span', { class: 'q' }, `${i + 1}. ${it.q} (${it.n}명)`)), it.texts.length ? h('ul', { class: 'sv-texts' }, it.texts.map((t) => h('li', null, t))) : h('p', { class: 'small muted' }, '쓴 글이 없어요.'));
    }
  });
  return out;
}
function surveyView(kind) {
  const list = data.surveys[kind];
  const n = kind === 'students' ? data.totals.studentSurveys : data.totals.teacherSurveys;
  const scales = list.filter((x) => x.type !== 'text'); const texts = list.filter((x) => x.type === 'text');
  return {
    left: (L) => { L.append(h('p', { class: 'small' }, `응답 ${n}명 · ${kind === 'students' ? '세 활동(1·2·3차)을 모두 제출한 학생이 응답해요. 이름 없이 모아 보여요.' : '작품을 한 개 이상 승인한 선생님이 응답해요.'}`)); if (n) L.append(...summaryNodes(scales)); else L.append(h('p', { class: 'muted' }, '아직 응답이 없어요.')); },
    right: (R) => { R.append(h('div', { class: 'center' }, h('h2', { class: 'plaque green' }, kind === 'students' ? '학생들이 쓴 글' : '선생님들이 쓴 글'))); if (n) R.append(...summaryNodes(texts).slice(1)); },
  };
}

function regions() {
  const by = (key) => { const m = new Map(); data.classes.forEach((c) => { const k = c[key] || '(미입력)'; const v = m.get(k) || { classes: 0, students: 0, works: 0 }; v.classes++; v.students += c.students; v.works += c.works; m.set(k, v); }); return [...m.entries()].sort((a, b) => b[1].students - a[1].students); };
  const table = (rows, head) => h('div', { class: 'table-scroll' }, h('table', { class: 'admin-table compact' },
    h('thead', null, h('tr', null, [head, '학급', '학생', '작품'].map((x) => h('th', null, x)))),
    h('tbody', null, rows.map(([k, v]) => h('tr', null, h('td', { class: 'l' }, k), h('td', null, v.classes), h('td', null, v.students), h('td', null, v.works))))));
  return {
    left: (L) => { L.append(h('h3', null, '우리 고장(3차) 지역별')); L.append(data.classes.length ? table(by('region'), '지역') : h('p', { class: 'muted' }, '아직 학급이 없어요.')); },
    right: (R) => { R.append(h('h3', null, '학교별')); R.append(data.classes.length ? table(by('school'), '학교') : h('p', { class: 'muted' }, '아직 학급이 없어요.')); },
  };
}

// CSV 파일로 내려받기(엑셀·한글에서 열림)
function download(name, rows) {
  const esc = (v) => { const t = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const csv = '\ufeff' + rows.map((r) => r.map(esc).join(',')).join('\r\n');
  try {
    const a = h('a', { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })), download: name });
    document.body.append(a); a.click(); a.remove();
    toast('파일을 내려받았어요.', 'ok');
  } catch { toast('이 화면에서는 내려받기를 쓸 수 없어요.', 'bad'); }
}
function exportView() {
  const day = new Date().toISOString().slice(0, 10);
  const classRows = () => [['학교', '학급', '학급 코드', '선생님', '학생 수', '제출 작품', '전시 작품', '학생 만족도 응답', '교사 응답', '우리 고장', '만든 날', '체험'],
    ...data.classes.map((c) => [c.school, c.name, c.code, c.teacher, c.students, c.works, c.approved, c.studentSurveys, c.teacherSurvey ? 'O' : '', c.region, c.createdAt, c.isDemo ? 'O' : ''])];
  const surveyRows = (kind) => {
    const out = [['문항', '응답 수', '평균(5점)', '1', '2', '3', '4', '5', '선택·글']];
    data.surveys[kind].forEach((it, i) => {
      if (it.type === 'scale') out.push([`${i + 1}. ${it.q}`, it.n, it.avg ?? '', ...it.dist, '']);
      else if (it.type === 'choice') out.push([`${i + 1}. ${it.q}`, it.n, '', '', '', '', '', '', it.counts.map((c) => `${c.option} ${c.n}명`).join(' / ')]);
      else it.texts.forEach((t, j) => out.push([j ? '' : `${i + 1}. ${it.q}`, j ? '' : it.n, '', '', '', '', '', '', t]));
    });
    return out;
  };
  const item = (title, desc, fn) => h('div', { class: 'row between export-row' }, h('span', null, h('b', null, title), h('br'), h('span', { class: 'small muted' }, desc)), btn('내려받기', fn, { variant: 'small green' }));
  return {
    left: (L) => L.append(h('p', null, '전체 현황을 CSV 파일로 내려받아요. 엑셀이나 한글 표 계산에서 열려요.'),
      h('div', { class: 'note gold small' }, withDemo ? '지금은 체험 학급도 넣어서 내려받아요.' : '체험 학급은 빼고 내려받아요. 넣으려면 위의 [체험 학급도 넣어서 보기]를 켜요.')),
    right: (R) => R.append(h('div', { class: 'stack' },
      item('학급 목록', '학교·학급·선생님·학생 수·작품 수·만족도 응답 수', () => download(`학급목록_${day}.csv`, classRows())),
      item('학생 만족도 결과', '문항별 응답 수·평균·분포·쓴 글(이름 없음)', () => download(`학생만족도_${day}.csv`, surveyRows('students'))),
      item('교사 만족도 결과', '문항별 응답 수·평균·분포·쓴 글', () => download(`교사만족도_${day}.csv`, surveyRows('teachers'))))),
  };
}

const VIEWS = { overview, classes, students: () => surveyView('students'), teachers: () => surveyView('teachers'), regions, export: exportView };
