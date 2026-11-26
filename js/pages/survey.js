// 만족도 조사(학생): 1차·2차·3차 꺾은선그래프를 모두 제출하면 열려요
import { sealImg, h, icon, btn, toast } from '../ui.js?v=mwx3mel6';
import { api } from '../api.js?v=mwx3mel6';
import { S } from '../store.js?v=mwx3mel6';
import { SCALE_LABELS } from '../../shared/survey.js?v=mwx3mel6';
import { celebrate } from './graphwork.js?v=mwx3mel6';

let cache = null;

// 문항 그리기(학생·교사가 함께 씀)
export function surveyForm(items, initial, onSubmit, { submitLabel = '제출하기', done = false } = {}) {
  const ans = { ...(initial || {}) };
  const msg = h('div', { role: 'status' });
  const rows = items.map((it, i) => {
    let ctrl;
    if (it.type === 'scale') {
      const btns = SCALE_LABELS.map((lab, k) => h('button', { type: 'button', class: 'sv-scale', 'aria-pressed': String(ans[it.id] === k + 1), title: lab,
        onClick: (e) => { ans[it.id] = k + 1; e.currentTarget.parentElement.querySelectorAll('button').forEach((b, j) => b.setAttribute('aria-pressed', String(j === k))); } },
      h('b', null, k + 1), h('small', null, lab)));
      ctrl = h('div', { class: 'sv-scales', role: 'group', 'aria-label': it.q }, btns);
    } else if (it.type === 'choice') {
      ctrl = h('div', { class: 'sv-choices', role: 'group', 'aria-label': it.q }, it.options.map((o) => h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': String(ans[it.id] === o),
        onClick: (e) => { ans[it.id] = o; e.currentTarget.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); } }, o)));
    } else {
      ctrl = h('textarea', { rows: 2, maxlength: 500, onInput: (e) => { ans[it.id] = e.target.value; } });
      ctrl.value = ans[it.id] || '';
    }
    return h('div', { class: 'sv-item', 'data-i': i + 1 }, h('div', { class: 'sv-q' }, h('span', { class: 'sv-no' }, i + 1), it.q), ctrl);
  });
  return h('div', { class: 'sv-form' }, ...rows, msg,
    h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '10px' } }, btn(done ? '고쳐서 다시 제출하기' : submitLabel, async () => {
      msg.replaceChildren();
      try { await onSubmit(ans); } catch (e) {
        msg.replaceChildren(h('div', { class: 'note small' }, e.message));
        (e.data?.missing || []).forEach((n) => rows[n - 1]?.classList.add('need'));
      }
    }, { variant: 'gold' })));
}

export function spreads(app) {
  if (!cache) {
    api('GET', '/api/student/survey').then((r) => { cache = r; app.refresh(); }).catch((e) => { cache = { open: false, reason: e.message, items: [] }; app.refresh(); });
    return [{ left: (el) => el.append(h('h2', null, '만족도 조사'), h('p', null, '불러오는 중…')), right: () => {} }];
  }
  const c = cache; cache = null; // 다음에 열 때 새로 불러오기
  return [{
    folio: ['만족도 조사', '마무리'],
    left: (el) => el.append(
      h('div', { class: 'page-head' }, icon('brush', 'ico'), h('div', null, h('div', { class: 'kicker' }, '연구를 마치며'), h('h2', null, '연구소 만족도 조사'))),
      h('div', { class: 'divider' }),
      h('p', null, '1차 기상자료, 2차 나의 주제, 3차 우리 고장 꺾은선그래프까지 모두 그렸어요. 연구소 활동이 어땠는지 솔직하게 알려 주세요.'),
      h('ul', { class: 'small' },
        h('li', null, '1(전혀 아니에요)부터 5(매우 그래요)까지 하나를 골라요.'),
        h('li', null, '선생님은 이름 없이 우리 반 전체 결과만 봐요.'),
        h('li', null, '제출한 뒤에도 다시 고칠 수 있어요.')),
      c.mine ? h('div', { class: 'note green' }, h('b', null, '제출했어요 '), '참여해 주어서 고마워요!') : null),
    right: (el) => {
      if (!c.open) {
        el.append(h('div', { class: 'lock-page' }, h('div', null, sealImg('封'), h('h3', null, '아직 열리지 않았어요'), h('p', null, c.reason || ''),
          btn('목차로 가기', () => app.go('home', 0, 'jump'), { variant: 'green small' }))));
        return;
      }
      el.append(h('div', { class: 'center' }, h('h2', { class: 'plaque green' }, '나의 생각')),
        surveyForm(c.items, c.mine?.answers, async (answers) => {
          await api('PUT', '/api/student/survey', { answers });
          await celebrate('고마워요!', '만족도 조사를 제출했어요. 이제 작품 전시관에서 친구들의 그래프를 더 감상해 봐요.');
          app.go('gallery', 0, 'jump');
        }, { done: !!c.mine }));
    },
  }];
}

export const surveyOpen = () => !S.data?.gates?.survey;
