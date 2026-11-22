// 목차 펼침: 장 목록과 나의 진행 상황
import { h, icon, btn, iconSrc } from '../ui.js';
import { topicById } from '../../shared/topics.js';
import { CHAPTERS, chapterDone, lockReason } from './student.js';

export function spreads(app) {
  const d = app.data;
  const chs = CHAPTERS.filter((c) => c.key !== 'home');
  const next = chs.find((c) => !chapterDone(c.key) && !lockReason(c.key)) || chs[chs.length - 1];
  return [{
    folio: ['목차', '一'],
    left: (el) => {
      el.append(
        h('div', { class: 'page-head' }, icon('scroll'), h('div', null, h('div', { class: 'kicker' }, '우리 반 데이터 탐구서'), h('h2', null, '탐험 목차'))),
        h('div', { class: 'divider' }),
        h('p', { class: 'muted' }, '차례대로 탐험해요. 앞의 장을 마쳐야 다음 장의 봉인이 풀려요.'),
        h('div', { class: 'chapter-list' }, chs.map((c, i) => {
          const reason = lockReason(c.key); const done = chapterDone(c.key);
          return h('button', { class: 'chapter-item', type: 'button', 'aria-disabled': reason ? 'true' : undefined, onClick: () => app.go(c.key, 0, 'next') },
            h('img', { src: iconSrc(c.icon), alt: '' }),
            h('span', null, h('span', { class: 't' }, `제${i + 1}장 ${c.label}`), h('br'), h('span', { class: 'small muted' }, reason || describe(c.key, d))),
            done ? h('span', { class: 'badge ok' }, '완료') : reason ? h('span', { class: 'badge' }, '🔒 잠김') : h('span', { class: 'badge warn' }, '진행 가능'));
        })));
    },
    right: (el) => {
      const done = chs.filter((c) => chapterDone(c.key)).length;
      el.append(
        h('div', { class: 'center' }, h('h2', { class: 'plaque green' }, '연구원 수첩')),
        h('div', { class: 'profile-card panel' },
          h('div', { class: 'author-plaque' }, `${d.student.number}번 ${d.student.name}`),
          h('p', { style: { marginTop: '10px' } }, d.cls.name, ' 연구원'),
          h('div', { class: 'progress-ring', 'aria-label': `다섯 장 중 ${done}장 완료` }, chs.map((c) => h('span', { class: chapterDone(c.key) ? 'on' : '' }))),
          h('p', { class: 'small muted' }, `다섯 장 중 ${done}장을 마쳤어요.`),
          btn(`이어서 하기: ${next.label} ›`, () => app.go(next.key, 0, 'next'), { variant: 'gold' })),
        d.cls.settings.notice ? h('div', { class: 'note gold', style: { marginTop: '14px' } }, h('b', null, '선생님 알림 '), d.cls.settings.notice) : null,
        h('div', { class: 'note green', style: { marginTop: '14px' } },
          h('b', null, '책 넘기는 법 '), '책 양옆의 둥근 화살표를 누르거나, 왼쪽 책갈피를 눌러 원하는 장으로 갈 수 있어요. 입력한 내용은 서버에 저장되어 다시 들어와도 이어서 할 수 있어요.'));
    },
  }];
}

function describe(key, d) {
  const g = d.gates;
  if (key === 'weather') return '폭염일수를 조사해 표와 그래프로 나타내기';
  if (key === 'topics') return d.vote ? `내 추천: ${topicById(d.vote)?.name}` : '25가지 주제 중 추천하고, 월별 경험 적기';
  if (key === 'table') return g.research ? `연구 주제: ${topicById(g.research)?.name}` : '우리 반 응답을 모아 직접 표 완성하기';
  if (key === 'graph') { const w = d.works.find((x) => x.kind === 'topic'); return w ? { draft: '그리는 중', submitted: '제출함 · 선생님 확인 기다리는 중', approved: '승인됨 · 전시관에 걸렸어요', rejected: '다시 그려 보세요' }[w.status] : '모눈종이에 점 찍고 선분 잇기'; }
  return '친구들의 작품 감상하기';
}
