// 제5장 작품 전시관: 왼쪽 작품 목록, 오른쪽 선택한 작품 — 작품마다 한 펼침, 책장을 넘기며 감상
import { sealImg, h, icon, btn, fmt } from '../ui.js?v=mwt6l81r';
import { api } from '../api.js?v=mwt6l81r';
import { renderStatic } from '../graph.js?v=mwt6l81r';

let cache = null; let filter = 'all'; let who = null; // who: 한 연구원(학생)의 작품만 보기
const PER = 6;

export function spreads(app) {
  if (!cache) {
    // 처음 열 때 불러온 뒤 다시 그립니다.
    api('GET', '/api/gallery').then((r) => { cache = r.items; app.refresh(); }).catch((e) => { cache = []; cache.error = e.message; app.refresh(); });
    return [{ left: (el) => el.append(h('h2', null, '작품 전시관'), h('p', null, '작품을 불러오는 중…')), right: () => {} }];
  }
  if (who !== null && !cache.some((x) => x.sid === who)) who = null;
  const items = cache.filter((x) => (who === null || x.sid === who) && (filter === 'all' || x.kind === filter));
  if (!items.length) {
    return [{
      left: (el) => header(el, app, items),
      right: (el) => el.append(h('div', { class: 'lock-page' }, h('div', null, sealImg('展'), h('h3', null, '아직 걸린 작품이 없어요'), h('p', null, cache.error || '선생님이 승인한 작품이 이곳에 전시돼요.'), btn('새로 불러오기', () => { cache = null; app.refresh(); }, { variant: 'green small' })))),
    }];
  }
  return items.map((w, i) => ({
    folio: [`작품 목록 ${Math.floor(i / PER) + 1}`, `${i + 1} / ${items.length}`],
    left: (el) => {
      header(el, app, items);
      const page = Math.floor(i / PER);
      el.append(h('div', { class: 'gallery-list' }, items.slice(page * PER, page * PER + PER).map((x) => {
        const j = items.indexOf(x);
        return h('button', { type: 'button', class: 'work-card', 'aria-pressed': String(j === i), onClick: () => j !== i && app.go('gallery', j, j > i ? 'next' : 'prev') },
          renderStatic(x.data, { mini: true }), h('span', { class: 't' }, x.topicName), h('span', { class: 'a' }, x.author, x.mine ? ' (나)' : ''));
      })));
      const pages = Math.ceil(items.length / PER);
      if (pages > 1) el.append(h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '10px' } }, h('span', { class: 'small muted' }, `목록 ${page + 1} / ${pages}`),
        page > 0 ? btn('‹ 앞 목록', () => app.go('gallery', (page - 1) * PER, 'prev'), { variant: 'small green' }) : null,
        page < pages - 1 ? btn('다음 목록 ›', () => app.go('gallery', (page + 1) * PER, 'next'), { variant: 'small green' }) : null));
    },
    right: (el) => {
      const st = w.stats;
      const u = w.data.yUnit || '';
      const fmtL = (labels) => labels.join(', ');
      el.append(
        h('div', { class: 'center' }, (() => {
          const n = cache.filter((x) => x.sid === w.sid).length;
          return who === null && n > 1
            ? h('button', { type: 'button', class: 'author-plaque as-btn', title: `${w.author}의 작품 ${n}개 모두 보기`, onClick: () => { who = w.sid; filter = 'all'; app.go('gallery', 0, 'jump'); } }, `${w.author}의 그래프`, h('span', { class: 'plaque-more' }, `작품 ${n}개 모두 보기 ›`))
            : h('div', { class: 'author-plaque' }, `${w.author}의 그래프`);
        })()),
        h('div', { class: 'row', style: { margin: '10px 0' } }, h('span', { class: 'label-tag' }, '주제'), h('b', { style: { fontFamily: 'var(--f-title)', fontSize: '1.2rem' } }, w.topicName)),
        h('div', { class: 'graph-frame' }, renderStatic(w.data, { showValues: true })),
        st ? h('div', { class: 'panel', style: { marginTop: '10px' } },
          h('h3', { class: 'center' }, '한눈에 보면!'),
          h('div', { class: 'glance' },
            h('div', { class: 'glance-row' }, h('span', { class: 'k' }, '❖ 가장 큰 값'), h('span', { class: 'v' }, `${fmtL(st.maxLabels)} · ${fmt(st.max)}${u}`)),
            h('div', { class: 'glance-row' }, h('span', { class: 'k' }, '❖ 가장 작은 값'), h('span', { class: 'v min' }, `${fmtL(st.minLabels)} · ${fmt(st.min)}${u}`)),
            st.change !== null ? h('div', { class: 'glance-row' }, h('span', { class: 'k' }, '❖ 변화가 가장 큰 시기'), h('span', { class: 'v chg' }, `${fmtL(st.changeLabels)} (${fmt(st.change)}${u} ${st.changeDir[0]})`)) : null),
          w.data.interp?.sentence ? h('div', { class: 'note green', style: { marginTop: '10px' } }, h('b', null, '연구원의 해석 '), w.data.interp.sentence) : null) : null);
    },
  }));
}

function header(el, app, items) {
  const authors = [...new Map(cache.map((x) => [x.sid, x])).values()].sort((a, b) => (a.mine ? -1 : b.mine ? 1 : 0) || a.author.localeCompare(b.author, 'ko', { numeric: true }));
  const sel = h('select', { class: 'who-select', 'aria-label': '연구원 이름으로 보기', onChange: (e) => { who = e.target.value === '' ? null : Number(e.target.value); app.go('gallery', 0, 'jump'); } },
    h('option', { value: '' }, '모든 연구원'), authors.map((a) => h('option', { value: a.sid, selected: a.sid === who ? true : undefined }, `${a.author}${a.mine ? ' (나)' : ''} · ${cache.filter((x) => x.sid === a.sid).length}개`)));
  el.append(
    h('div', { class: 'page-head' }, icon('gallery'), h('div', null, h('div', { class: 'kicker' }, '1차·2차·3차 작품'), h('h2', null, '작품 전시관')), h('span', { class: 'badge', style: { marginLeft: 'auto' } }, `우리 반 작품 ${cache.length}개`)),
    h('p', { class: 'small' }, '친구들이 만든 꺾은선그래프를 책장을 넘기며 감상해요. 선생님이 승인한 우리 반 작품만 보여요.'),
    h('div', { class: 'cat-tabs' }, [['all', '전체'], ['weather', '1차 폭염일수'], ['topic', '2차 나의 주제'], ['life', '3차 우리 고장']].map(([k, l]) => h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': String(filter === k), onClick: () => { filter = k; app.go('gallery', 0, null); } }, l)),
      h('button', { type: 'button', class: 'link-btn', onClick: () => { cache = null; app.go('gallery', 0, null); } }, '새로고침')),
    h('div', { class: 'row who-row' }, h('span', { class: 'small' }, '연구원 이름으로 보기'), sel,
      who !== null ? h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': 'true', onClick: () => { who = null; app.go('gallery', 0, 'jump'); } }, `${items[0]?.author || ''}의 작품만 보는 중 ✕`) : null));
}
