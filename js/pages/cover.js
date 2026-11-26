// 첫 화면(고서 표지)과 입장(로그인)
import { h, A, icon, btn, toast, reducedMotion } from '../ui.js?v=mwx3qfi5';
import { api, isDemo } from '../api.js?v=mwx3qfi5';
import { Book } from '../book.js?v=mwx3qfi5';
import { makeHeader, deskProps, scene } from '../shell.js?v=mwx3qfi5';
import { iconSrc } from '../ui.js?v=mwx3qfi5';
import { boot } from '../main.js?v=mwx3qfi5';

const ss = { get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* */ } }, del: (k) => { try { sessionStorage.removeItem(k); } catch { /* */ } } };

const CHAPTERS = [
  ['weather', '1차 기상자료 탐험실'],
  ['vote', '2차 나의 주제·기록'],
  ['graph', '2차 자료표·그래프'],
  ['town', '3차 우리 고장 그래프'],
  ['gallery', '작품 전시관'],
];

const D = (n) => `assets/art/${n}.webp`;
const deco = (n, style, cls = '') => h('img', { class: `deco ${cls}`, src: D(n), alt: '', style, draggable: 'false' });

export function mountCover(root, opts = {}) {
  if (opts.skipCover || ss.get('kgl-opened') === '1') return mountLogin(root, opts.tab, opts.joinCode);
  const pages = h('div', { class: 'ib-pages' },
    h('div', { class: 'ib-page l' }), h('div', { class: 'ib-page r' }), h('div', { class: 'ib-fold' }), h('div', { class: 'ib-edge' }));
  const leaf = h('div', { class: 'ib-leaf' }, h('div', { class: 'ib-leaf-face front' }), h('div', { class: 'ib-leaf-face back' }));
  const book = h('div', { class: 'ibook' },
    h('div', { class: 'ib-cover' }),
    pages,
    deco('prop_mountains', { left: '0', bottom: '2.4%', width: '100%', height: '36%' }, 'd-mtn'),
    deco('prop_pine', { left: '4.6%', top: '-1%', width: '35%' }, 'd-pine'),
    deco('prop_crane', { left: '53%', top: '1%', width: '19%' }, 'd-crane'),
    deco('prop_cloud', { left: '7.5%', top: '36%', width: '11%' }, 'd-cloud'),
    deco('prop_cloud_gold', { left: '61%', top: '61%', width: '12%' }, 'd-cloud'),
    deco('prop_pavilion', { left: '5.5%', top: '55%', width: '19%' }, 'd-pav'),
    deco('prop_books', { left: '0.4%', bottom: '0', width: '17%' }, 'd-books'),
    deco('prop_brush', { right: '1.5%', bottom: '17%', width: '23%' }, 'd-brush'),
    deco('prop_inkstone', { right: '0.8%', bottom: '0.5%', width: '17%' }, 'd-ink'),
    deco('prop_binding', { left: '0', top: '0', height: '100%', width: 'auto' }, 'd-bind'),
    h('div', { class: 'ib-content' },
      h('div', { class: 'ib-main' },
        h('div', { class: 'ib-eyebrow' }, '우리 반 데이터 탐구서'),
        h('h1', { class: 'sr-only' }, '꺾은선그래프 연구소'),
        h('img', { class: 'ib-title', src: A('title'), alt: '꺾은선그래프 연구소', width: 1400, height: 597 }),
        h('p', { class: 'ib-sub' }, '— 우리의 경험을 숫자로 기록하고, 변화를 읽어요 —'),
        h('button', { class: 'ib-cta', type: 'button', onClick: () => openBook() }, h('span', null, '탐험 시작하기'), h('b', { 'aria-hidden': 'true' }, '›'))),
      h('nav', { class: 'ib-toc', 'aria-label': '탐구 순서' }, CHAPTERS.map(([k, t]) => h('div', { class: 'ib-slip' }, icon(k), h('span', null, t))))),
    h('button', { class: 'ib-teacher', type: 'button', onClick: () => openBook('teacher') }, '교사 관리실'),
    leaf);
  // 넓은 화면: 사용자가 보낸 표지 그림을 배경으로 한 장면
  const cs = h('div', { class: 'cover-scene' },
    h('div', { class: 'cs-titlebox' }, h('h1', { class: 'sr-only' }, '꺾은선그래프 연구소'), h('img', { class: 'cs-title', src: A('title'), alt: '꺾은선그래프 연구소' })),
    h('p', { class: 'cs-sub' }, '우리의 경험을 숫자로 기록하고, 변화를 읽어요'),
    h('nav', { class: 'cs-toc', 'aria-label': '탐구 순서' }, CHAPTERS.map(([k, t]) => h('div', { class: 'cs-slip' }, h('img', { src: iconSrc(k), alt: '' }), h('span', null, t)))),
    h('button', { class: 'cs-cta', type: 'button', onClick: () => openBook() }, '탐험 시작하기 ›'),
    h('button', { class: 'cs-teacher', type: 'button', onClick: () => openBook('teacher') }, '교사 관리실'),
    h('div', { class: 'cs-leaf' }, h('div', { class: 'cs-leaf-face front' }), h('div', { class: 'cs-leaf-face back' })));
  root.append(h('main', { class: 'intro-screen' }, book, cs));
  function openBook(tab) {
    ss.set('kgl-opened', '1');
    if (reducedMotion()) { root.replaceChildren(); mountLogin(root, tab); return; }
    book.classList.add('turning'); cs.classList.add('turning');
    setTimeout(() => { root.replaceChildren(); mountLogin(root, tab); }, 1000);
  }
}

// 체험판 안내: 교사 탭에서만 보여요(학생용 체험·교사용 체험 둘 다)
function demoGuide(goStudent, fillTeacher) {
  if (!isDemo()) return null;
  return h('div', { class: 'demo-guide' },
    h('div', { class: 'demo-guide-head' }, '체험판 안내 ', h('span', { class: 'small muted' }, '· 자료는 이 브라우저에만 저장돼요')),
    h('div', { class: 'demo-guide-row' },
      h('div', null, h('b', null, '학생으로 체험'), h('br'),
        h('span', { class: 'small' }, '학급 코드 DEMO26 → 내 이름 누르기 → 들어가기'), h('br'),
        h('span', { class: 'small muted' }, '1번 체험학생: 2차 그래프·3차 우리 고장 직접 해 보기 · 3번 이도윤: 만족도 조사 해 보기')),
      h('div', { class: 'demo-guide-btns' },
        btn('1번으로', () => goStudent(1), { variant: 'small green' }), btn('3번으로', () => goStudent(3), { variant: 'small' }))),
    h('div', { class: 'demo-guide-row' },
      h('div', null, h('b', null, '교사로 체험'), h('br'), h('span', { class: 'small' }, '아이디 demo · 비밀번호 demo1234'), h('br'),
        h('span', { class: 'small muted' }, '학급 만들기, 명단, 작품 승인, 3차 우리 고장 바꾸기, 만족도 결과')),
      h('div', { class: 'demo-guide-btns' }, btn('채워 주기', fillTeacher, { variant: 'small green' }))));
}

export function mountLogin(root, tab = 'student', joinCode = null) {
  const header = makeHeader({ onLogo: () => { ss.del('kgl-opened'); root.replaceChildren(); mountCover(root); }, right: h('b', null, '연구소 입구') });
  const book = new Book({ onPrev: () => { ss.del('kgl-opened'); root.replaceChildren(); mountCover(root); }, onNext: () => {} });
  const tabsRO = h('nav', { class: 'side-tabs login-tabs', 'aria-label': '탐구 순서(입장 후 열려요)' },
    [['home', '목차'], ['weather', '1차 기상자료 탐험실'], ['vote', '2차 나의 주제·기록'], ['graph', '2차 자료표·그래프'], ['town', '3차 우리 고장 그래프'], ['gallery', '작품 전시관']].map(([k, t]) =>
      h('button', { class: 'side-tab', type: 'button', 'aria-disabled': 'true', onClick: () => toast('먼저 오른쪽에서 연구소에 들어가요.') }, h('img', { src: iconSrc(k), alt: '' }), h('span', null, t))));
  const wrap = h('div', { class: 'stage login-stage' }, h('div', { class: 'side-col' }, tabsRO), book.wrap);
  root.append(scene(header, wrap));
  deskProps(root);

  const left = (el) => {
    el.append(
      h('div', { class: 'page-head' }, icon('scroll'), h('div', null, h('div', { class: 'kicker' }, '연구소 입장 안내'), h('h2', null, '어서 오세요, 연구원!'))),
      h('div', { class: 'divider' }),
      h('p', null, '이 책은 우리 반이 함께 쓰는 ', h('b', null, '데이터 탐구서'), '예요. 실제 자료를 조사하고, 표로 정리하고, 모눈종이에 꺾은선그래프를 직접 그려요.'),
      h('ol', { class: 'steps-list' },
        h('li', null, h('span', null, h('b', null, '1차 기상자료 탐험실'), ' — 우리 지역의 연도별 폭염일수를 찾아 표와 그래프로 나타내요.')),
        h('li', null, h('span', null, h('b', null, '2차 나의 주제 그래프'), ' — 25가지 주제 중 골라 2026년 내 기록으로 표와 그래프를 만들어요.')),
        h('li', null, h('span', null, h('b', null, '3차 우리 고장 그래프'), ' — 우리 고장 자료를 공공데이터·누리집에서 찾아 그래프로 나타내고 앞날을 예상해요.')),
        h('li', null, h('span', null, h('b', null, '작품 전시관'), ' — 선생님이 승인한 친구들의 작품을 책장을 넘기며 감상해요.'))),
      h('div', { class: 'note green', style: { marginTop: '14px' } }, '학급 코드는 선생님께 받아요. 학급 코드를 적고 명단에서 내 이름을 누르면 들어가요. 꼭 내 이름을 눌러요! 한 일은 저절로 저장되어 다음 시간에 이어서 할 수 있어요.'),
    );
  };
  const right = (el) => {
    const body = h('div');
    const tabs = h('div', { class: 'row', role: 'tablist', style: { justifyContent: 'center', marginBottom: '10px' } });
    const show = (t, preset = null) => {
      tabs.replaceChildren(
        h('button', { class: `chip-btn ${t === 'student' ? 'on' : ''}`, role: 'tab', 'aria-selected': String(t === 'student'), type: 'button', onClick: () => show('student') }, '학생 입장'),
        h('button', { class: `chip-btn ${t === 'teacher' ? 'on' : ''}`, role: 'tab', 'aria-selected': String(t === 'teacher'), type: 'button', onClick: () => show('teacher') }, '교사 관리실'));
      body.replaceChildren(t === 'student' ? studentForm(joinCode, preset) : teacherForm((n) => show('student', { code: 'DEMO26', number: n })));
    };
    el.append(h('div', { class: 'center' }, h('h2', { class: 'plaque' }, '연구소 입장')), tabs, body);
    show(tab);
  };
  book.fill({ left, right, folio: ['一', '二'], canPrev: true, prevText: '표지로' });
}

function studentForm(joinCode = null, preset = null) {
  const code = h('input', { type: 'text', name: 'classCode', autocomplete: 'off', autocapitalize: 'characters', maxlength: 8, required: true, placeholder: '예: AB12CD', value: joinCode || '' }); // 처음엔 비워 둠(QR로 들어온 경우만 채움)
  const num = h('input', { type: 'hidden', name: 'number' });
  const err = h('p', { class: 'err-text', role: 'alert' });
  const classBox = h('div', { class: 'class-find', 'aria-live': 'polite' });
  let found = null; let lastCode = '';
  const pick = (n) => {
    num.value = n;
    classBox.querySelectorAll('.name-chip').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.n) === Number(n))));
    const st = found?.students.find((x) => x.number === Number(n));
    whoEl.textContent = st ? `${st.number}번 ${st.name} 연구원, 맞으면 아래 버튼을 눌러요.` : '';
  };
  const whoEl = h('b', { class: 'who-picked' });
  const lookup = async (force = false) => {
    const c = code.value.trim().toUpperCase();
    if (c.length < 4 || (!force && c === lastCode)) return;
    lastCode = c;
    classBox.replaceChildren(h('p', { class: 'small muted' }, '우리 반을 찾는 중…'));
    try {
      found = await api('GET', `/api/student/class-lookup?code=${encodeURIComponent(c)}`);
      const title = [found.school, found.grade && found.classNo ? `${found.grade}학년 ${found.classNo}반` : found.name].filter(Boolean).join(' ');
      classBox.replaceChildren(
        h('div', { class: 'class-title' }, h('span', { class: 'small' }, '우리 반'), h('b', null, title || found.name), found.nickname ? h('span', { class: 'small' }, ` · ${found.nickname}`) : null),
        found.students.length ? h('div', null, h('div', { class: 'small', style: { margin: '4px 0' } }, '내 이름을 눌러요'),
          h('div', { class: 'name-grid' }, found.students.map((x) => h('button', { type: 'button', class: 'name-chip', 'data-n': x.number, 'aria-pressed': 'false', onClick: () => pick(x.number) }, h('small', null, x.number), x.name))))
          : h('p', { class: 'small' }, '아직 선생님이 학생 명단을 등록하지 않았어요.'));
    } catch (ex) { found = null; classBox.replaceChildren(h('p', { class: 'err-text' }, ex.message)); }
  };
  let t = null;
  code.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => lookup(), 450); });
  const form = h('form', { class: 'login-card', onSubmit: async (e) => {
    e.preventDefault(); err.textContent = '';
    if (!num.value) { err.textContent = found ? '명단에서 내 이름을 먼저 눌러요.' : '학급 코드를 먼저 적어요.'; return; }
    try {
      await api('POST', '/api/student/login', { classCode: code.value, number: num.value });
      const c = code.value.toUpperCase();
      try { localStorage.removeItem('kgl-code'); localStorage.removeItem(`kgl-num-${c}`); } catch { /* 예전에 저장한 값 지우기 */ }
      const st = found?.students.find((x) => x.number === Number(num.value));
      toast(st ? `${st.name} 연구원의 기록을 불러왔어요!` : '연구소에 들어왔어요!', 'ok');
      boot();
    } catch (ex) { err.textContent = ex.message; }
  } },
  joinCode ? h('div', { class: 'note green small join-note' }, h('b', null, 'QR로 들어왔어요 '), `학급 코드 ${joinCode}가 입력되었어요. 내 이름을 누르고 들어가기를 누르면 돼요.`) : null,
  h('label', { class: 'field' }, h('span', null, '① 학급 코드'), code),
  classBox,
  num,
  h('div', { class: 'row login-who' }, whoEl),
  err,
  btn('연구소 들어가기', null, { variant: 'gold', type: 'submit' }),
  h('p', { class: 'small muted center', style: { margin: '4px 0 0' } }, '내가 한 활동은 저절로 저장돼요. 다음 시간에 같은 이름으로 들어오면 이어서 할 수 있어요.'),
  null);
  if (preset) { code.value = preset.code; setTimeout(async () => { await lookup(true); pick(preset.number); }, 50); }
  else if (code.value) setTimeout(() => lookup(), 200);
  return form;
}

function teacherForm(goStudent) {
  let signup = false; let admin = location.hash === '#admin';
  const wrap = h('div');
  const render = () => {
    if (admin) { wrap.replaceChildren(adminForm(() => { admin = false; render(); })); return; }
    const user = h('input', { type: 'text', name: 'username', autocomplete: 'username', required: true, placeholder: '영문 소문자·숫자' });
    const pw = h('input', { type: 'password', name: 'password', autocomplete: signup ? 'new-password' : 'current-password', required: true, placeholder: signup ? '8자 이상' : '' });
    const name = h('input', { type: 'text', name: 'name', placeholder: '예: 김OO 선생님' });
    const scode = h('input', { type: 'text', name: 'signupCode', placeholder: '서버에 정해 둔 경우에만' });
    const err = h('p', { class: 'err-text', role: 'alert' });
    const form = h('form', { class: 'login-card', onSubmit: async (e) => {
      e.preventDefault(); err.textContent = '';
      try {
        if (signup) await api('POST', '/api/teacher/signup', { username: user.value, password: pw.value, name: name.value, signupCode: scode.value });
        else await api('POST', '/api/teacher/login', { username: user.value, password: pw.value });
        boot();
      } catch (ex) { err.textContent = ex.message; }
    } },
    !signup ? demoGuide(goStudent, () => { user.value = 'demo'; pw.value = 'demo1234'; pw.focus(); }) : null,
    !isDemo() && !signup ? h('div', { class: 'note small' }, '처음 오셨나요? 수업 전에 ', h('a', { href: 'https://cheetamin.github.io/line-graph-lab/', target: '_blank', rel: 'noopener' }, '체험판 ↗'), '에서 예시 학급(학생 20명 자료)으로 학생 화면과 교사 화면을 먼저 둘러보실 수 있어요. 아래 [처음이에요]로 계정을 만들면 우리 반을 만들 수 있어요.') : null,
    h('h3', { class: 'center' }, signup ? '교사 계정 만들기' : '교사 관리실 로그인'),
    h('label', { class: 'field' }, h('span', null, '아이디'), user),
    h('label', { class: 'field' }, h('span', null, '비밀번호'), pw),
    signup ? h('label', { class: 'field' }, h('span', null, '선생님 이름'), name) : null,
    signup ? h('label', { class: 'field' }, h('span', null, '교사 가입 코드(선택)'), scode) : null,
    err,
    btn(signup ? '계정 만들고 들어가기' : '관리실 들어가기', null, { variant: 'green', type: 'submit' }),
    h('button', { class: 'link-btn', type: 'button', onClick: () => { signup = !signup; render(); } }, signup ? '이미 계정이 있어요 → 로그인' : '처음이에요 → 교사 계정 만들기'),
    !signup ? h('button', { class: 'link-btn admin-link', type: 'button', onClick: () => { admin = true; render(); } }, '전체 관리자 들어가기') : null);
    wrap.replaceChildren(form);
  };
  render();
  return wrap;
}

// 전체 관리자 로그인(비밀번호만). 서버판에서 처음 한 번은 비밀번호를 직접 정해요.
const SERVER_URL = 'https://line-graph-lab.cheetamin.workers.dev/';
function adminForm(back) {
  const wrap = h('div');
  const err = h('p', { class: 'err-text', role: 'alert' });
  const backBtn = () => h('button', { class: 'link-btn', type: 'button', onClick: back }, '← 교사 로그인으로');
  const head = () => [h('h3', { class: 'center' }, '전체 관리자'), h('p', { class: 'small muted center' }, '모든 학급의 운영 수·학생 수와 만족도 조사 결과를 봐요.')];

  const loginForm = () => {
    const pw = h('input', { type: 'password', name: 'adminPassword', autocomplete: 'current-password', required: true });
    return h('form', { class: 'login-card', onSubmit: async (e) => {
      e.preventDefault(); err.textContent = '';
      try { await api('POST', '/api/admin/login', { password: pw.value }); boot(); } catch (ex) { err.textContent = ex.message; pw.value = ''; pw.focus(); }
    } }, ...head(), h('label', { class: 'field' }, h('span', null, '관리자 비밀번호'), pw), err,
    btn('관리자 들어가기', null, { variant: 'green', type: 'submit' }), backBtn());
  };
  const setupForm = () => {
    const pw = h('input', { type: 'password', name: 'newAdminPassword', autocomplete: 'new-password', required: true, minlength: 8, placeholder: '8자 이상' });
    const pw2 = h('input', { type: 'password', name: 'newAdminPassword2', autocomplete: 'new-password', required: true, placeholder: '한 번 더' });
    return h('form', { class: 'login-card', onSubmit: async (e) => {
      e.preventDefault(); err.textContent = '';
      if (pw.value.length < 8) { err.textContent = '8자 이상으로 정해 주세요.'; return; }
      if (pw.value !== pw2.value) { err.textContent = '두 비밀번호가 달라요. 다시 적어 주세요.'; pw2.value = ''; pw2.focus(); return; }
      try { await api('POST', '/api/admin/setup', { password: pw.value }); boot(); } catch (ex) { err.textContent = ex.message; }
    } }, ...head(),
    h('div', { class: 'note green small' }, h('b', null, '처음 한 번만 '), '전체 관리자 비밀번호를 정해요. 정한 뒤에는 이 비밀번호로만 들어올 수 있어요. 비밀번호는 암호화해서 저장돼요.'),
    h('label', { class: 'field' }, h('span', null, '새 관리자 비밀번호'), pw),
    h('label', { class: 'field' }, h('span', null, '비밀번호 확인'), pw2), err,
    btn('비밀번호 정하고 들어가기', null, { variant: 'green', type: 'submit' }), backBtn());
  };
  const demoNote = () => h('div', { class: 'login-card' }, ...head(),
    h('div', { class: 'note gold small' }, '이 주소는 체험판이라 자료가 각 브라우저에만 저장돼요. 모든 학급의 운영 현황과 만족도 결과는 ', h('b', null, '수업용 주소'), '에서 볼 수 있어요.'),
    h('a', { class: 'btn green', href: `${SERVER_URL}#admin`, target: '_blank', rel: 'noopener', style: { display: 'block', textAlign: 'center', textDecoration: 'none' } }, '수업용 주소에서 전체 관리자 열기 ↗'),
    backBtn());

  wrap.append(loginForm());
  api('GET', '/api/admin/status').then((r) => {
    if (r.canSetup) wrap.replaceChildren(setupForm());
    else if (!r.enabled && isDemo()) wrap.replaceChildren(demoNote());
  }).catch(() => {});
  return wrap;
}
