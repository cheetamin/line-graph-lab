// 첫 화면(고서 표지)과 입장(로그인)
import { h, A, icon, btn, toast, reducedMotion } from '../ui.js';
import { api, isDemo } from '../api.js';
import { inkLandscape, plumBranch } from '../inkart.js';
import { Book } from '../book.js';
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

export function mountCover(root, opts = {}) {
  if (opts.skipCover || ss.get('kgl-opened') === '1') return mountLogin(root, opts.tab);
  const art = h('div', { class: 'cover-art' });
  art.innerHTML = `
    <div style="position:absolute;left:0;right:0;bottom:0;height:62%;">${inkLandscape({ w: 1400, h: 520, seed: 11 })}</div>
    <div style="position:absolute;right:0;top:0;width:36%;max-width:440px;height:34%;">${plumBranch({ seed: 5, flip: true })}</div>`;
  art.querySelectorAll('svg').forEach((s) => { s.style.width = '100%'; s.style.height = '100%'; });
  const cover = h('div', { class: 'cover' },
    h('div', { class: 'cover-face' },
      art,
      h('div', { class: 'binding' }, h('div', { class: 'thread', style: { top: '8%' } }), h('div', { class: 'thread', style: { bottom: '8%' } }), h('div', { class: 'thread v' })),
      h('div', { class: 'cover-content' },
        h('div', { class: 'cover-main' },
          h('div', { class: 'eyebrow' }, '우리 반 데이터 탐구서'),
          h('h1', { class: 'sr-only' }, '꺾은선그래프 연구소'),
          h('img', { class: 'cover-title', src: A('title'), alt: '꺾은선그래프 연구소', width: 1400, height: 597 }),
          h('p', { class: 'cover-sub' }, '우리의 경험을 숫자로 기록하고, 변화를 읽어요'),
          h('div', { class: 'cover-cta' }, btn('탐험 시작하기 ›', () => openCover(), { variant: 'gold big' }))),
        h('nav', { class: 'cover-toc', 'aria-label': '탐구 순서' },
          CHAPTERS.map(([k, t]) => h('div', { class: 'toc-slip' }, icon(k), h('span', null, t))))),
      h('div', { class: 'cover-meta' }, '초등 4학년 2학기 수학 · 5. 꺾은선그래프'),
      h('div', { class: 'cover-foot' }, h('button', { class: 'teacher-door', type: 'button', onClick: () => openCover('teacher') }, '🔑 교사 관리실'))),
    h('div', { class: 'cover-back' }));
  const book = h('div', { class: 'cover-book' }, h('div', { class: 'cover-under' }), cover);
  const screen = h('main', { class: 'cover-screen' }, book);
  root.append(screen);
  if (!reducedMotion()) {
    for (let i = 0; i < 7; i++) {
      screen.append(h('span', { class: 'petal', style: { left: `${10 + Math.random() * 85}%`, animationDuration: `${12 + Math.random() * 10}s`, animationDelay: `${Math.random() * 10}s`, transform: `scale(${0.7 + Math.random() * 0.6})` } }));
    }
  }
  function openCover(tab) {
    ss.set('kgl-opened', '1');
    if (reducedMotion()) { root.replaceChildren(); mountLogin(root, tab); return; }
    cover.classList.add('open');
    setTimeout(() => { root.replaceChildren(); mountLogin(root, tab); }, 1150);
  }
}

function demoHint(kind, fill) {
  if (!isDemo()) return null;
  return h('div', { class: 'note gold small' },
    kind === 'student' ? '체험판: 학급 코드 DEMO26 · 번호 1 · PIN 1234' : '체험판: 아이디 demo · 비밀번호 demo1234',
    ' ', h('button', { class: 'link-btn', type: 'button', onClick: fill }, '자동으로 채우기'));
}

export function mountLogin(root, tab = 'student') {
  const header = h('header', { class: 'topbar' },
    h('img', { class: 'logo', src: A('title'), alt: '꺾은선그래프 연구소', onClick: () => { ss.del('kgl-opened'); root.replaceChildren(); mountCover(root); } }),
    h('div', { class: 'who' }, h('span', null, '연구소 입구')));
  const book = new Book({ onPrev: () => { ss.del('kgl-opened'); root.replaceChildren(); mountCover(root); }, onNext: () => {} });
  const wrap = h('div', { class: 'stage', style: { gridTemplateColumns: '1fr', maxWidth: '1280px', margin: '0 auto' } }, book.wrap);
  root.append(header, wrap);

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
      body.replaceChildren(t === 'student' ? studentForm() : teacherForm());
    };
    el.append(h('div', { class: 'center' }, h('h2', { class: 'plaque' }, '연구소 입장')), tabs, body);
    show(tab);
  };
  book.fill({ left, right, folio: ['一', '二'], canPrev: true, prevText: '표지로' });
}

function studentForm() {
  const code = h('input', { type: 'text', name: 'classCode', autocomplete: 'off', autocapitalize: 'characters', maxlength: 8, required: true, placeholder: '예: AB12CD', value: lsGet('kgl-code') || '' });
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
  h('label', { class: 'field' }, h('span', null, '학급 코드'), code),
  h('label', { class: 'field' }, h('span', null, '내 번호'), num),
  h('label', { class: 'field' }, h('span', null, '비밀번호(PIN 4자리)'), pin),
  err,
  btn('연구소 들어가기', null, { variant: 'gold', type: 'submit' }),
  demoHint('student', () => { code.value = 'DEMO26'; num.value = 1; pin.value = '1234'; }));
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
