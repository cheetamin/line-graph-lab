// 화면 도우미: 요소 만들기, 알림, 대화상자, 아이콘
// append/replaceChildren에 null·undefined·false가 들어가면 건너뛰도록(글자 'null'이 찍히지 않게)
for (const fn of ['append', 'replaceChildren', 'prepend']) {
  const orig = Element.prototype[fn];
  Element.prototype[fn] = function (...nodes) { return orig.apply(this, nodes.filter((n) => n !== null && n !== undefined && n !== false)); };
}
export const A = (name) => `assets/${name}.webp`;
export const ICONS = {
  book: '25_icon_book', graph: '26_icon_graph', table: '27_icon_table', vote: '28_icon_vote', weather: '29_icon_weather',
  search: '30_icon_search', gallery: '31_icon_gallery', scroll: '32_icon_scroll', brush: '33_icon_brush',
};
export const iconSrc = (k) => A(ICONS[k] || k);

export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = !!v;
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
  }
  append(el, kids);
  return el;
}
function append(el, kids) {
  for (const k of kids) {
    if (k === null || k === undefined || k === false) continue;
    if (Array.isArray(k)) append(el, k);
    else el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}
export const svgNS = 'http://www.w3.org/2000/svg';
export function s(tag, attrs = {}, ...kids) {
  const el = document.createElementNS(svgNS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) el.setAttribute(k, v);
  for (const k of kids.flat()) if (k !== null && k !== undefined) el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return el;
}

export function icon(k, cls = 'ico', alt = '') { return h('img', { class: cls, src: iconSrc(k), alt, width: 40, height: 40 }); }

export function btn(label, onClick, { variant = '', icon: ic, type = 'button', disabled, title, cls = '' } = {}) {
  return h('button', { class: `btn ${variant} ${cls}`.trim(), type, onClick, disabled, title }, ic ? icon(ic) : null, label);
}

export function plaque(text, variant = '') { return h('h2', { class: `plaque ${variant}` }, text); }

let toastWrap;
export function toast(msg, type = '') {
  if (!toastWrap) { toastWrap = h('div', { class: 'toast-wrap', role: 'status', 'aria-live': 'polite' }); document.body.append(toastWrap); }
  const t = h('div', { class: `toast ${type}` }, msg);
  toastWrap.append(t);
  setTimeout(() => t.remove(), type === 'bad' ? 5200 : 3200);
}

export function modal({ title, body, actions = [{ label: '닫기', value: null }], wide = false }) {
  return new Promise((resolve) => {
    const prev = document.activeElement;
    const close = (v) => { back.remove(); document.removeEventListener('keydown', onKey); prev?.focus?.(); resolve(v); };
    const onKey = (e) => { if (e.key === 'Escape') close(null); };
    const box = h('div', { class: `modal ${wide ? 'wide' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      title ? h('h3', null, title) : null,
      typeof body === 'string' ? h('p', null, body) : body,
      h('div', { class: 'actions' }, actions.map((a) => btn(a.label, () => close(typeof a.value === 'function' ? a.value() : a.value), { variant: a.variant || '' }))));
    const back = h('div', { class: 'modal-back', onClick: (e) => { if (e.target === back) close(null); } }, box);
    document.body.append(back);
    document.addEventListener('keydown', onKey);
    setTimeout(() => (box.querySelector('input,textarea,select') || box.querySelector('.actions .btn:last-child'))?.focus(), 30);
  });
}
export const confirmBox = (title, text, okLabel = '네') => modal({ title, body: text, actions: [{ label: '아니요', value: false, variant: 'green' }, { label: okLabel, value: true }] });

export function debounce(fn, ms) {
  let t; const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  d.flush = (...a) => { clearTimeout(t); return fn(...a); };
  return d;
}
export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const isNarrow = () => window.matchMedia('(max-width: 900px)').matches;
export const fmt = (v) => (v === null || v === undefined || v === '' ? '' : Number(v).toLocaleString('ko-KR'));
