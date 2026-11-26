// 학생 접속용 QR: 학급 코드가 들어간 주소(…#join-학급코드)를 QR로 만듭니다.
import { h, s as svgEl } from './ui.js?v=mwx2tiv2';

const BASE_KEY = 'kgl-join-base';

export function defaultBase() {
  const o = location.origin;
  if (!o || o === 'null' || !/^https?:/.test(o)) return '';
  return o + location.pathname.replace(/index\.html$/, '');
}
export function getBase() {
  try { return localStorage.getItem(BASE_KEY) || defaultBase(); } catch { return defaultBase(); }
}
export function setBase(v) {
  try { if (v) localStorage.setItem(BASE_KEY, v); else localStorage.removeItem(BASE_KEY); } catch { /* */ }
}
export const joinUrl = (code, base = getBase()) => (base ? `${base.replace(/#.*$/, '')}#join-${code}` : '');

// 오류 정정 M, 흰 여백 4칸. 크기는 CSS로 조절(벡터라서 인쇄해도 선명)
export function qrSvg(text, { label = 'QR 코드' } = {}) {
  const make = window.qrcode;
  if (!make || !text) return h('div', { class: 'qr-missing' }, 'QR을 만들 수 없어요.');
  const q = make(0, 'M'); q.addData(text); q.make();
  const n = q.getModuleCount(); const m = 4; const size = n + m * 2;
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + m} ${r + m}h1v1h-1z`;
  return svgEl('svg', { viewBox: `0 0 ${size} ${size}`, class: 'qr-svg', role: 'img', 'aria-label': label, 'shape-rendering': 'crispEdges' },
    svgEl('rect', { width: size, height: size, fill: '#fffdf6' }),
    svgEl('path', { d, fill: '#1e140c' }));
}
