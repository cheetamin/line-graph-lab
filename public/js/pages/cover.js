// 첫 화면(고서 표지)과 입장(로그인)
import { h, A, icon, btn, toast, reducedMotion } from '../ui.js';
import { api, isDemo } from '../api.js';
import { Book } from '../book.js';
import { makeHeader, deskProps, scene } from '../shell.js';
import { iconSrc } from '../ui.js';
import { boot } from '../main.js';

const ss = { get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* */ } }, del: (k) => { try { sessionStorage.removeItem(k); } catch { /* */ } } };
const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };

const CHAPTERS = [
  ['weather', '1. 기상자료 탐험실'],
  ['vote', '2. 주제 선택·투표'],
  ['table', '3. 자료표 만들기'],
  ['graph', '4. 꺾은선그래프 그리기'],
  ['gallery', '5. 작품 전시관'],
];

const D = (n) => `assets/art/${n}.png`;
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

function demoHint(kind, fill) {
  if (!isDemo()) return null;
  return h('div', { class: 'note gold small' },
    kind === 'student' ? '체험판: 학급 코드 DEMO26 · 번호 1 · PIN 1234' : '체험판: 아이디 demo · 비밀번호 demo1234',
    ' ', h('button', { class: 'link-btn', type: 'button', onClick: fill }, '자동으로 채우기'));
}

export function mountLogin(root, tab = 'student', joinCode = null) {
  const header = makeHeader({ onLogo: () => { ss.del('kgl-opened'); root.replaceChildren(); mountCover(root); }, right: h('b', null, '연구소 입구') });
  const book = new Book({ onPrev: () => { ss.del('kgl-opened'); root.replaceChildren(); mountCover(root); }, onNext: () => {} });
  const tabsRO = h('nav', { class: 'side-tabs login-tabs', 'aria-label': '탐구 순서(입장 후 열려요)' },
    [['home', '목차'], ['weather', '기상자료 탐험실'], ['vote', '주제 선택·투표'], ['table', '자료표 만들기'], ['graph', '꺾은선그래프 그리기'], ['gallery', '작품 전시관']].map(([k, t]) =>
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
        h('li', null, h('span', null, h('b', null, '기상자료 탐험실'), ' — 우리 지역의 연도별 폭염일수를 찾아 표와 그래프로 나타내요.')),
        h('li', null, h('span', null, h('b', null, '주제 선택·투표'), ' — 25가지 주제 중 조사하고 싶은 주제에 투표하고, 2026년 내 경험을 월별로 적어요.')),
        h('li', null, h('span', null, h('b', null, '자료표 만들기'), ' — 우리 반 친구들의 응답을 모아 직접 표를 완성해요.')),
        h('li', null, h('span', null, h('b', null, '꺾은선그래프 그리기'), ' — 눈금을 정하고, 점을 찍고, 선분으로 이어요.')),
        h('li', null, h('span', null, h('b', null, '작품 전시관'), ' — 선생님이 승인한 친구들의 작품을 책장을 넘기며 감상해요.'))),
      h('div', { class: 'note green', style: { marginTop: '14px' } }, '학급 코드와 비밀번호(PIN)는 선생님께 받아요. 다른 사람에게 알려 주지 않아요.'),
    );
  };
  const right = (el) => {
    const body = h('div');
    const tabs = h('div', { class: 'row', role: 'tablist', style: { justifyContent: 'center', marginBottom: '10px' } });
    const show = (t) => {
      tabs.replaceChildren(
        h('button', { class: `chip-btn ${t === 'student' ? 'on' : ''}`, role: 'tab', 'aria-selected': String(t === 'student'), type: 'button', onClick: () => show('student') }, '학생 입장'),
        h('button', { class: `chip-btn ${t === 'teacher' ? 'on' : ''}`, role: 'tab', 'aria-selected': String(t === 'teacher'), type: 'button', onClick: () => show('teacher') }, '교사 관리실'));
      body.replaceChildren(t === 'student' ? studentForm(joinCode) : teacherForm());
    };
    el.append(h('div', { class: 'center' }, h('h2', { class: 'plaque' }, '연구소 입장')), tabs, body);
    show(tab);
  };
  book.fill({ left, right, folio: ['一', '二'], canPrev: true, prevText: '표지로' });
}

function studentForm(joinCode = null) {
  const code = h('input', { type: 'text', name: 'classCode', autocomplete: 'off', autocapitalize: 'characters', maxlength: 8, required: true, placeholder: '예: AB12CD', value: joinCode || lsGet('kgl-code') || '' });
  const num = h('input', { type: 'number', name: 'number', inputmode: 'numeric', min: 1, max: 99, required: true, placeholder: '번호' });
  const pin = h('input', { type: 'password', name: 'pin', class: 'pin-input', inputmode: 'numeric', maxlength: 4, autocomplete: 'off', required: true, placeholder: '••••' });
  const err = h('p', { class: 'err-text', role: 'alert' });
  const form = h('form', { class: 'login-card', onSubmit: async (e) => {
    e.preventDefault(); err.textContent = '';
    try {
      await api('POST', '/api/student/login', { classCode: code.value, number: num.value, pin: pin.value });
      try { localStorage.setItem('kgl-code', code.value.toUpperCase()); } catch { /* */ }
      toast('연구소에 들어왔어요!', 'ok');
      boot();
    } catch (ex) { err.textContent = ex.message; pin.value = ''; pin.focus(); }
  } },
  joinCode ? h('div', { class: 'note green small join-note' }, h('b', null, 'QR로 들어왔어요 '), `학급 코드 ${joinCode}가 입력되었어요. 내 번호와 PIN만 적으면 돼요.`) : null,
  h('label', { class: 'field' }, h('span', null, '학급 코드'), code),
  h('label', { class: 'field' }, h('span', null, '내 번호'), num),
  h('label', { class: 'field' }, h('span', null, '비밀번호(PIN 4자리)'), pin),
  err,
  btn('연구소 들어가기', null, { variant: 'gold', type: 'submit' }),
  joinCode ? null : demoHint('student', () => { code.value = 'DEMO26'; num.value = 1; pin.value = '1234'; }));
  if (joinCode) setTimeout(() => num.focus(), 400);
  return form;
}

function teacherForm() {
  let signup = false;
  const wrap = h('div');
  const render = () => {
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
    h('h3', { class: 'center' }, signup ? '교사 계정 만들기' : '교사 관리실 로그인'),
    h('label', { class: 'field' }, h('span', null, '아이디'), user),
    h('label', { class: 'field' }, h('span', null, '비밀번호'), pw),
    signup ? h('label', { class: 'field' }, h('span', null, '선생님 이름'), name) : null,
    signup ? h('label', { class: 'field' }, h('span', null, '교사 가입 코드(선택)'), scode) : null,
    err,
    btn(signup ? '계정 만들고 들어가기' : '관리실 들어가기', null, { variant: 'green', type: 'submit' }),
    h('button', { class: 'link-btn', type: 'button', onClick: () => { signup = !signup; render(); } }, signup ? '이미 계정이 있어요 → 로그인' : '처음이에요 → 교사 계정 만들기'),
    !signup ? h('p', { class: 'small muted center' }, '비밀번호를 잊었다면 서버 관리자가 npm run reset-teacher 명령으로 바꿀 수 있어요.') : null,
    !signup ? demoHint('teacher', () => { user.value = 'demo'; pw.value = 'demo1234'; }) : null);
    wrap.replaceChildren(form);
  };
  render();
  return wrap;
}
