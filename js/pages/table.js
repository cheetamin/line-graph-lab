// 제3장 자료표 만들기: 우리 반 응답을 보고 학생이 직접 표를 완성
import { h, icon, btn, toast, fmt, debounce } from '../ui.js?v=mwt79o7p';
import { api } from '../api.js?v=mwt79o7p';
import { S, saveState } from '../store.js?v=mwt79o7p';
import { topicById } from '../../shared/topics.js?v=mwt79o7p';

export function spreads(app) {
  const d = S.data; const s = d.cls.settings;
  const t = topicById(d.gates.research);
  const months = []; for (let m = s.monthFrom; m <= s.monthTo; m++) months.push(m);
  const saved = d.state.tables?.[t.id];
  const vals = months.map((_, i) => (saved?.values?.[i] ?? ''));
  let verified = !!saved?.verified;
  let ref = null;
  const marks = [];
  let refEl;

  const drawRef = () => {
    if (!ref) { refEl.replaceChildren(h('p', { class: 'muted' }, '우리 반 자료를 불러오는 중…')); return; }
    if (!ref.visible) { refEl.replaceChildren(h('div', { class: 'note' }, '선생님이 아직 우리 반 집계 자료를 공개하지 않았어요.')); return; }
    const avg = ref.mode === 'avg';
    if (ref.mode === 'own') {
      refEl.replaceChildren(
        h('p', { class: 'small' }, '내가 2장에서 적은 월별 기록이에요. 오른쪽 표에 옮겨 적어 자료표를 완성해요.'),
        h('div', { class: 'ref-list' }, ref.rows.map((r) => h('div', { class: 'ref-row' }, h('b', null, `${r.month}월`),
          r.status === 'value' ? h('b', null, `${fmt(r.value)} ${t.unit}`) : h('span', { class: 'muted' }, r.status === 'unknown' ? '기억나지 않음' : '적지 않음'),
          h('span', { class: 'small muted' }, r.source === 'record' ? '실제 기록' : r.status === 'value' ? '기억 추정' : '')))),
        h('p', { class: 'small muted', style: { marginTop: '8px' } }, '‘기억나지 않음’인 달은 표에서 칸을 비워 둬요. 그래프에서도 그 달은 점을 찍지 않아요.'));
      return;
    }
    refEl.replaceChildren(
      ref.list
        ? h('p', { class: 'small' }, `친구들이 적은 수예요(이름 없이, 작은 수부터). 달마다 모두 더해 우리 반 합계를 구해 보세요. 우리 반 ${ref.students}명.`)
        : h('p', { class: 'small' }, avg ? '이 주제는 친구들 기록의 평균(고르게 나눈 값)으로 그래프를 그려요. 아래 값을 표에 옮겨 적어요.' : t.private ? '저축 금액은 개인 정보라서 친구 한 명 한 명의 금액은 보이지 않고 우리 반 결과만 보여요.' : '선생님이 정리해 준 우리 반 합계예요. 표에 옮겨 적어요.'),
      h('div', { class: 'ref-list' }, ref.rows.map((r) => h('div', { class: 'ref-row' },
        h('b', null, `${r.month}월`),
        ref.list ? h('div', { class: 'num-chips' }, r.values.length ? r.values.map((v) => h('span', null, fmt(v))) : h('span', { class: 'muted' }, '응답 없음')) : h('div', null, r.value === null ? h('span', { class: 'muted' }, '응답 없음') : h('b', null, `${fmt(r.value)} ${t.unit}`)),
        h('span', { class: 'small muted' }, `응답 ${r.responders}명`, r.unknown ? ` · 모름 ${r.unknown}` : '')))),
      h('p', { class: 'small muted', style: { marginTop: '8px' } }, '‘기억나지 않음’은 0으로 세지 않고 빼고 계산해요.'));
  };

  const persist = debounce(() => saveState({ tableDraft: { topicId: t.id, values: vals } }).catch(() => {}), 800);

  return [{
    folio: ['우리 반 자료', '자료표'],
    left: (el) => {
      el.append(
        h('div', { class: 'page-head' }, icon('search'), h('div', null, h('div', { class: 'kicker' }, '2차 활동 ③'), h('h2', null, s.topicMode !== 'class' ? '나의 기록 살펴보기' : '우리 반 조사 자료 모으기'))),
        h('div', { class: 'row' }, h('span', { class: 'label-tag' }, t.name)),
        h('div', { class: 'divider' }));
      refEl = h('div'); el.append(refEl); drawRef();
      api('GET', `/api/student/table-ref?topicId=${t.id}`).then((r) => { ref = r; drawRef(); }).catch((e) => refEl.replaceChildren(h('div', { class: 'note' }, e.message)));
    },
    right: (el) => {
      const msg = h('div', { role: 'status' });
      const inputs = months.map((m, i) => h('input', { type: 'number', inputmode: 'decimal', min: 0, value: vals[i], 'aria-label': `${m}월 우리 반 값`, onInput: (e) => { vals[i] = e.target.value === '' ? '' : Number(e.target.value); verified = false; marks[i].textContent = ''; e.target.classList.remove('ok', 'err'); persist(); } }));
      months.forEach((_, i) => { marks[i] = h('td', { class: 'mark', 'aria-live': 'polite' }, verified ? '✔' : ''); });
      const title = h('input', { type: 'text', value: s.topicMode !== 'class' ? `나의 ${t.name}` : `우리 반 ${t.name}`, 'aria-label': '표 제목' });
      el.append(
        h('div', { class: 'center' }, h('h2', { class: 'plaque' }, '자료표 완성하기')),
        h('label', { class: 'field' }, h('span', null, '표 제목'), title),
        h('div', { class: 'table-frame', style: { marginTop: '8px' } }, h('table', { class: 'data' },
          h('thead', null, h('tr', null, h('th', null, '월'), h('th', null, `${s.topicMode !== 'class' ? '나의 기록' : t.agg === 'avg' || (t.private && s.savingsMode === 'average') ? '평균' : '합계'} (${t.unit})`), h('th', null, '확인'))),
          h('tbody', null, months.map((m, i) => h('tr', null, h('th', null, `${m}월`), h('td', null, inputs[i]), marks[i]))))),
        h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '12px' } },
          btn('표 확인하기', async () => {
            await persist.flush();
            try {
              const r = await api('POST', '/api/student/table-check', { topicId: t.id, values: vals });
              r.result.forEach((x, i) => { marks[i].textContent = x.ok ? '✔' : '✗'; marks[i].style.color = x.ok ? 'var(--ok)' : 'var(--bad)'; inputs[i].classList.toggle('ok', x.ok); inputs[i].classList.toggle('err', !x.ok); });
              if (r.ok) {
                verified = true;
                await app.reload(false);
                msg.replaceChildren(h('div', { class: 'note green' }, h('b', null, '표 완성! '), s.topicMode !== 'class' ? '내 기록과 모두 같아요.' : '우리 반 자료와 모두 같아요. 이제 이 표로 꺾은선그래프를 그려요.', h('div', { style: { marginTop: '8px' } }, btn('꺾은선그래프 그리러 가기 ›', () => app.go('graph', 0, 'next'), { variant: 'gold small' }))));
                app.renderTabs();
              } else {
                const wrong = r.result.filter((x) => !x.ok).map((x) => `${x.month}월`);
                msg.replaceChildren(h('div', { class: 'note' }, h('b', null, '다시 확인해 보세요 '), s.topicMode !== 'class' ? `${wrong.join(', ')}의 값이 내 기록과 달라요. 왼쪽 기록을 다시 보고 옮겨 적어요(기억나지 않는 달은 비워요).` : `${wrong.join(', ')}의 값이 우리 반 자료와 달라요. 왼쪽 자료를 다시 더하거나 옮겨 적어 보세요.`));
              }
            } catch (e) { toast(e.message, 'bad'); }
          }, { variant: 'gold' })),
        msg,
        verified ? h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '8px' } }, btn('꺾은선그래프 그리러 가기 ›', () => app.go('graph', 0, 'next'), { variant: 'green small' })) : null);
    },
  }];
}
