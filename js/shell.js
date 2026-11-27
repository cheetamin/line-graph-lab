// 공통 머리띠(참고 화면: 매화·산수·정자 + 제목판)와 책상 소품
import { h, A } from './ui.js?v=mwy932gn';

const D = (n) => `assets/art/${n}.webp`;

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
export function scene(...kids) {
  const el = h('div', { class: 'scene' }, ...kids);
  // 은은한 움직임: 매화 꽃잎이 천천히 흩날리고, 먹빛 안개가 흘러가요(움직임 줄이기 설정이면 꺼져요)
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const fx = h('div', { class: 'scene-fx', 'aria-hidden': 'true' });
    const P = [[5, 0, 11, 1], [12, 4, 13, .8], [18, 8, 12, 1.1], [9, 2, 14, .7], [15, 10, 12, .9], [21, 6, 15, .8]];
    P.forEach(([x, d, dur, sc]) => fx.append(h('span', { class: 'petal2', style: `left:${x}%;animation-delay:-${d}s;animation-duration:${dur}s;--s:${sc}` })));
    fx.append(h('span', { class: 'mist m1' }), h('span', { class: 'mist m2' }));
    el.append(fx);
  }
  return el;
}
