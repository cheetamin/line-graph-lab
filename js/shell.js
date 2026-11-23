// 공통 머리띠(참고 화면: 매화·산수·정자 + 제목판)와 책상 소품
import { h, A } from './ui.js?v=mwsxb00z';

const D = (n) => `assets/art/${n}.png`;

export function makeHeader({ right, onLogo, sub = '우리의 2026년을 자료로 만들고, 변화로 읽어요!' } = {}) {
  return h('header', { class: 'hdr topbar' },
    h('img', { class: 'hdr-mtn', src: D('prop_mountains_small'), alt: '' }),
    h('img', { class: 'hdr-plum', src: D('prop_plum'), alt: '' }),
    h('img', { class: 'hdr-pav', src: D('prop_crane'), alt: '' }),
    h('img', { class: 'hdr-cloud', src: D('prop_cloud_gold'), alt: '' }),
    h('div', { class: 'hdr-center' },
      h('img', { class: 'hdr-title logo', src: A('title'), alt: '꺾은선그래프 연구소', onClick: onLogo, style: onLogo ? { cursor: 'pointer' } : null }),
      h('div', { class: 'hdr-title-text', onClick: onLogo, role: onLogo ? 'button' : undefined, tabindex: onLogo ? '0' : undefined }, '꺾은선그래프 연구소'),
      sub ? h('div', { class: 'hdr-ribbon' }, sub) : null),
    h('div', { class: 'hdr-card who' }, right));
}

export function deskProps(root) {
  root.append(
    h('img', { class: 'desk-prop desk-ink', src: D('prop_inkstone'), alt: '' }),
  );
}

export function lanternImg() { return h('div', { class: 'side-lantern-wrap' }, h('img', { class: 'side-lantern', src: D('prop_lantern'), alt: '' }), h('img', { class: 'side-books', src: D('prop_books'), alt: '' })); }
export function pageScenery() { return h('img', { class: 'page-scenery', src: D('prop_mountains_small'), alt: '' }); }

// 배경 그림(장면) 틀: 머리띠·메뉴·책을 한 장면 안에 담습니다.
export function scene(...kids) { return h('div', { class: 'scene' }, ...kids); }
