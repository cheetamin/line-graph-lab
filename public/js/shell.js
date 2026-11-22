// 공통 머리띠(참고 화면: 매화·산수·정자 + 제목판)와 책상 소품
import { h, A } from './ui.js';

const D = (n) => `assets/deco/${n}.webp`;

export function makeHeader({ right, onLogo, sub = '우리의 2026년을 자료로 만들고, 변화로 읽어요!' } = {}) {
  return h('header', { class: 'hdr topbar' },
    h('img', { class: 'hdr-lattice', src: D('lattice'), alt: '' }),
    h('img', { class: 'hdr-plum', src: D('plum_top'), alt: '' }),
    h('img', { class: 'hdr-pav', src: D('pavilion_top'), alt: '' }),
    h('div', { class: 'hdr-center' },
      h('img', { class: 'hdr-title logo', src: A('title'), alt: '꺾은선그래프 연구소', onClick: onLogo, style: onLogo ? { cursor: 'pointer' } : null }),
      sub ? h('div', { class: 'hdr-ribbon' }, sub) : null),
    h('div', { class: 'hdr-card who' }, right));
}

export function deskProps(root) {
  root.append(
    h('img', { class: 'desk-prop desk-brush', src: D('brush_desk'), alt: '' }),
  );
}

export function lanternImg() { return h('img', { class: 'side-lantern', src: D('lantern_books'), alt: '' }); }
export function pageScenery() { return h('img', { class: 'page-scenery', src: D('page_landscape'), alt: '' }); }
