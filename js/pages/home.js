// 목차 펼침: 장 목록과 나의 진행 상황
import { h, icon, btn, iconSrc } from '../ui.js?v=mwx3qfi5';
import { topicById } from '../../shared/topics.js?v=mwx3qfi5';
import { CHAPTERS, chapterDone, lockReason, chLabel } from './student.js?v=mwx3qfi5';

// 큰 활동 세 개(1차·2차·3차) + 전시관
const ACTS = [
  { no: '1차', title: '기상자료 탐험실', page: '교과서 118~121쪽', icon: 'weather', keys: ['weather'], done: 'weather' },
  { no: '2차', title: '나의 주제 꺾은선그래프', page: '25가지 주제 중 골라 내 기록으로', icon: 'graph', keys: ['topics', 'table', 'graph'], done: 'graph' },
  { no: '3차', title: '우리 고장 꺾은선그래프', page: '교과서 122~123쪽 · 생활에 활용', icon: 'town', keys: ['life'], done: 'life' },
];

export function spreads(app) {
  const d = app.data;
  const chs = CHAPTERS.filter((c) => c.key !== 'home');
  const next = chs.find((c) => !chapterDone(c.key) && !lockReason(c.key)) || chs[chs.length - 1];
  const actDone = ACTS.filter((a) => chapterDone(a.done)).length;
  return [{
    folio: ['목차', '一'],
    left: (el) => {
      el.append(
        h('div', { class: 'page-head' }, icon('scroll'), h('div', null, h('div', { class: 'kicker' }, '우리 반 데이터 탐구서'), h('h2', null, '탐험 목차'))),
        h('div', { class: 'divider' }),
        h('p', { class: 'muted small' }, '꺾은선그래프를 세 번 그려요. 1차 기상자료 탐험을 마치면 2차·3차 활동이 열려요.'),
        h('div', { class: 'act-list' }, ACTS.map((a) => {
          const reason = lockReason(a.keys[0]); const done = chapterDone(a.done);
          return h('div', { class: `act ${done ? 'done' : ''}` },
            h('div', { class: 'act-head' }, h('img', { src: iconSrc(a.icon), alt: '' }), h('span', null, h('small', { class: 'tab-no' }, a.no), h('b', null, a.title), h('br'), h('span', { class: 'small muted' }, a.page)),
              done ? h('span', { class: 'badge ok' }, '완료') : reason ? h('span', { class: 'badge' }, '🔒 잠김') : h('span', { class: 'badge warn' }, '진행 가능')),
            h('div', { class: 'act-steps' }, a.keys.map((k) => {
              const c = CHAPTERS.find((x) => x.key === k); const r = lockReason(k); const dn = chapterDone(k);
              return h('button', { type: 'button', class: `act-step ${dn ? 'on' : ''}`, 'aria-disabled': r ? 'true' : undefined, title: r || '', onClick: () => app.go(k, 0, 'next') },
                a.keys.length > 1 ? chLabel(c) : '바로 가기', ' ', h('span', { class: 'small muted' }, r ? '🔒' : describe(k, d)));
            })));
        })),
        !lockReason('survey') ? h('button', { type: 'button', class: 'chapter-item survey-call', style: { marginTop: '8px' }, onClick: () => app.go('survey', 0, 'next') }, h('img', { src: iconSrc('brush'), alt: '' }), h('span', null, h('span', { class: 't' }, '만족도 조사'), h('br'), h('span', { class: 'small muted' }, '세 활동을 모두 마쳤어요! 연구소 활동이 어땠는지 알려 주세요.')), h('span', { class: 'badge warn' }, '참여하기')) : null,
        h('button', { type: 'button', class: 'chapter-item', style: { marginTop: '8px' }, onClick: () => app.go('gallery', 0, 'next') }, h('img', { src: iconSrc('gallery'), alt: '' }), h('span', null, h('span', { class: 't' }, '작품 전시관'), h('br'), h('span', { class: 'small muted' }, '친구들의 꺾은선그래프 감상하기'))));
    },
    right: (el) => {
      el.append(
        h('div', { class: 'center' }, h('h2', { class: 'plaque green' }, '연구원 수첩')),
        h('div', { class: 'profile-card panel' },
          h('div', { class: 'author-plaque' }, `${d.student.number}번 ${d.student.name}`),
          h('p', { style: { marginTop: '10px' } }, d.cls.name, ' 연구원'),
          h('div', { class: 'progress-ring', 'aria-label': `세 활동 중 ${actDone}개 완료` }, ACTS.map((a) => h('span', { class: chapterDone(a.done) ? 'on' : '' }))),
          h('p', { class: 'small muted' }, `세 활동 중 ${actDone}개를 마쳤어요.`),
          btn(`이어서 하기: ${chLabel(next)} ›`, () => app.go(next.key, 0, 'next'), { variant: 'gold' })),
        d.cls.settings.notice ? h('div', { class: 'note gold', style: { marginTop: '14px' } }, h('b', null, '선생님 알림 '), d.cls.settings.notice) : null,
        h('div', { class: 'note green', style: { marginTop: '14px' } },
          h('b', null, '저장과 이어하기 '), '입력한 내용은 저절로 저장돼요. 한 시간 안에 못 끝내도 괜찮아요. 다음 시간에 우리 반 학급 코드로 들어와 내 이름을 누르면, 하던 곳부터 이어서 할 수 있어요.'));
    },
  }];
}

function describe(key, d) {
  const g = d.gates;
  if (key === 'weather') return d.state.weatherDone ? '폭염일수 그래프 완성' : '폭염일수를 조사해 표와 그래프로 나타내기';
  if (key === 'topics') { if (d.cls.settings.topicMode === 'own') return g.research ? `지금 만드는 주제: ${topicById(g.research)?.name}` : '25가지 주제 중 직접 골라 내 기록 적기'; if (d.cls.settings.topicMode === 'lottery') return g.research ? `나의 주제: ${topicById(g.research)?.name}` : '선생님이 제비뽑기로 주제를 정해 줘요'; return d.vote ? `내 추천: ${topicById(d.vote)?.name}` : '25가지 주제 중 추천하고, 월별 경험 적기'; }
  if (key === 'table') return g.research ? `연구 주제: ${topicById(g.research)?.name}` : '우리 반 응답을 모아 직접 표 완성하기';
  if (key === 'graph') { if (d.cls.settings.topicMode === 'own') { const n = d.works.filter((x) => x.kind === 'topic' && ['submitted', 'approved'].includes(x.status)).length; return `제출한 그래프 ${n}개 / 꼭 낼 그래프 ${d.cls.settings.minWorks}개`; } const w = d.works.find((x) => x.kind === 'topic' && x.topicId === g.research); return w ? { draft: '그리는 중', submitted: '제출함 · 선생님 확인 기다리는 중', approved: '승인됨 · 전시관에 걸렸어요', rejected: '다시 그려 보세요' }[w.status] : '모눈종이에 점 찍고 선분 잇기'; }
  if (key === 'life') { const w = d.works.find((x) => x.kind === 'life'); const L = d.state.life || {}; return w ? { draft: '그리는 중', submitted: '제출함 · 확인 기다리는 중', approved: '승인됨 · 전시 중', rejected: '다시 그려 보세요' }[w.status] : L.tableChecked ? '표 완성 · 그래프 그리기' : L.subject ? `조사 중: ${L.subject}` : `${d.cls.settings.lifeRegion || '우리 고장'} 자료 찾아 그래프 그리기`; }
  return '친구들의 작품 감상하기';
}
