// 3차 활동: 꺾은선그래프를 생활에 활용해 볼까요? (교과서 122~123쪽, 수학익힘 78~79쪽)
// 우리 고장(선생님이 정한 시·군) 자료를 누리집·뉴스에서 직접 찾아 → 표 → 꺾은선그래프 → 다음 해 예상하기
import { sealImg, h, icon, btn, toast, debounce, fmt, confirmBox } from '../ui.js?v=mwt6yfks';
import { api } from '../api.js?v=mwt6yfks';
import { S, saveState } from '../store.js?v=mwt6yfks';
import { graphSpread, celebrate } from './graphwork.js?v=mwt6yfks';
import { renderStatic } from '../graph.js?v=mwt6yfks';
import { approxValue, koNum } from '../../shared/topics.js?v=mwt6yfks';

const N = 8; // 표 칸 수(3~8개 사용)
const L = () => S.data.state.life || {};
const sources = () => S.data.cls.settings.lifeSources || [];
const region = () => S.data.cls.settings.lifeRegion || '우리 고장';

let pending = {};
const flush = debounce(() => { const p = pending; pending = {}; if (!Object.keys(p).length) return Promise.resolve(); return saveState({ life: p }).catch((e) => toast(e.message, 'bad')); }, 600);
const saveLife = (patch) => { pending = { ...pending, ...patch }; Object.assign(S.data.state.life = S.data.state.life || {}, patch); flush(); };

export function spreads(app) {
  const l = L();
  const list = [introSpread(app, l), tableSpread(app, l)];
  if (l.tableChecked) {
    list.push(graphSpread(app, {
      kind: 'life',
      labels: l.years.map((y) => `${y}년`), values: l.values.map(Number), unit: l.unit || '', xUnit: '년',
      heading: { kicker: '3차 활동 ③ · 직접 그리기', title: l.subject || '우리 고장 자료' },
      intro: `${region()}의 ${l.subject || '자료'}를 연도별 꺾은선그래프로 나타내요.`,
      submitText: '확인을 통과하면 제출해요. 선생님이 승인하면 작품 전시관에 걸려요.',
      onSubmitted: async () => {
        await app.reload(false);
        await celebrate('우리 고장 그래프를 제출했어요!', S.data.gates.survey ? '이제 그래프를 보고 다음 해를 예상해 봐요.' : '세 활동을 모두 마쳤어요! 다음 해를 예상해 보고, 만족도 조사에도 참여해 주세요.');
        app.go('life', 3, 'next');
      },
    }));
  } else {
    list.push({
      left: (el) => el.append(h('h2', null, '우리 고장 꺾은선그래프'), h('div', { class: 'divider' }), h('p', null, '자료를 표로 정리하고 [표 확인하기]를 누르면 이 쪽에서 모눈종이에 그래프를 그릴 수 있어요.')),
      right: (el) => el.append(h('div', { class: 'lock-page' }, h('div', null, sealImg('表'), h('p', null, '앞쪽의 표를 먼저 완성해 주세요.'), btn('표 만들러 가기', () => app.go('life', 1, 'prev'), { variant: 'green' })))),
    });
  }
  list.push(thinkSpread(app, l));
  return list;
}

function introSpread(app, l) {
  return {
    folio: ['122쪽 생각 깨우기', '자료 고르기'],
    left: (el) => el.append(
      h('div', { class: 'page-head' }, icon('town', 'ico'), h('div', null, h('div', { class: 'kicker' }, '3차 활동 · 교과서 122~123쪽'), h('h2', null, '꺾은선그래프를 생활에 활용해 볼까요'))),
      h('div', { class: 'divider' }),
      h('p', null, `교과서의 힘찬시는 연도별 공원 수를 꺾은선그래프로 나타냈어요. 우리도 `, h('b', null, region()), '의 자료를 직접 찾아 꺾은선그래프로 나타내고, 앞으로 어떻게 될지 예상해 봐요.'),
      h('h3', { style: { marginTop: '12px' } }, '활동 순서'),
      h('ol', { class: 'steps-list' },
        h('li', null, h('span', null, '오른쪽에서 조사할 자료를 골라요.')),
        h('li', null, h('span', null, '공공데이터나 누리집에서 연도별 값을 찾아 표로 정리해요(3~8개 연도).')),
        h('li', null, h('span', null, '눈금 한 칸의 크기를 정해 꺾은선그래프를 그려요.')),
        h('li', null, h('span', null, '그래프를 보고 다음 해는 어떻게 될지 예상하고 이유를 써요.'))),
      h('div', { class: 'note gold', style: { marginTop: '12px' } }, h('b', null, '생각해 보기 '), '시간이 지남에 따라 늘어나는지, 줄어드는지, 오르락내리락하는지 살펴보면 다음 해를 예상할 수 있어요.'),
      l.subject ? h('p', { class: 'small', style: { marginTop: '10px' } }, '지금 고른 자료: ', h('b', null, l.subject)) : null),
    right: (el) => {
      const card = (src, compact) => {
        const on = l.sourceId === src.id;
        return h('button', { type: 'button', class: `life-card ${compact ? 'compact' : ''} ${on ? 'on' : ''}`, 'aria-pressed': String(on), onClick: async () => {
          const patch = { sourceId: src.id };
          if (!l.subject || sources().some((x) => x.title === l.subject)) patch.subject = src.id === 'free' ? '' : src.title;
          if (!l.unit || sources().some((x) => x.unit === l.unit)) patch.unit = src.unit;
          if (l.sourceId !== src.id) {
            // 다른 자료로 바꾸면: 연도만 미리 적어 주고, 수는 학생이 직접 찾아 적도록 비워요
            const hasVals = (l.values || []).some((v) => v !== '' && v !== null && v !== undefined);
            if (hasVals && l.sourceId && !(await confirmBox('자료 바꾸기', `'${src.place || src.title}'(으)로 바꾸면 표에 적은 수가 지워져요. 바꿀까요?`, '바꾸기'))) return;
            const ys = src.data ? src.data.years.filter((_, i) => src.data.values[i] !== null && src.data.values[i] !== undefined) : [];
            patch.years = ys.length ? ys : ['', '', ''];
            patch.values = patch.years.map(() => '');
            patch.subject = src.id === 'free' ? '' : src.title;
            patch.unit = src.unit || '';
          }
          try { await saveState({ life: patch }); app.go('life', 1, 'next'); } catch (e) { toast(e.message, 'bad'); }
        } },
        h('b', null, compact ? (src.place || src.title) : src.title), compact ? null : src.unit ? h('span', { class: 'badge' }, `단위: ${src.unit}`) : null,
        h('span', { class: 'small' }, src.desc));
      };
      const tour = sources().filter((x) => x.group === 'tour');
      const other = sources().filter((x) => x.group !== 'tour');
      el.append(h('div', { class: 'center' }, h('h2', { class: 'plaque green' }, `${region()} 자료 고르기`)),
        tour.length ? h('div', null, h('h3', { class: 'life-group' }, `${region()} 관광지 입장객 수 `, h('span', { class: 'small muted' }, tour.some((x) => x.data) ? '(공공데이터포털 자료가 들어 있어요)' : '(관광지식정보시스템에서 찾아요)')),
          h('div', { class: 'life-cards three' }, tour.map((x) => card(x, true)))) : null,
        other.length ? h('div', null, h('h3', { class: 'life-group' }, `다른 ${region()} 자료 `, h('span', { class: 'small muted' }, '(누리집에서 직접 찾아요)')),
          h('div', { class: 'life-cards three' }, other.map((x) => card(x, true)))) : null);
    },
  };
}

function tableSpread(app, l) {
  const src = sources().find((x) => x.id === l.sourceId) || null;
  return {
    folio: ['자료 찾기', '표로 정리'],
    left: (el) => {
      el.append(
        h('div', { class: 'page-head' }, icon('search', 'ico'), h('div', null, h('div', { class: 'kicker' }, '3차 활동 ②'), h('h2', null, src ? src.title : '자료 찾기'))),
        h('div', { class: 'divider' }));
      if (!src) { el.append(h('p', null, '앞쪽에서 조사할 자료를 먼저 골라 주세요.'), btn('‹ 자료 고르러 가기', () => app.go('life', 0, 'prev'), { variant: 'small' })); return; }
      el.append(
        h('p', null, src.desc),
        src.data ? h('div', { class: 'pub-data' },
          h('div', { class: 'pub-head' }, h('b', null, `공공데이터 자료표 · ${src.place || src.title} 입장객 수 (명)`)),
          h('div', { class: 'table-scroll' }, h('table', { class: 'data pub-table' },
            h('tr', null, h('th', null, '연도'), src.data.years.map((y) => h('th', null, `${y}`))),
            h('tr', null, h('th', null, '입장객'), src.data.values.map((v) => h('td', null, v === null ? '—' : fmt(v)))))),
          h('div', { class: 'small muted' }, src.data.note, ' · ‘—’는 자료가 없는 해예요.')) : null,
        h('div', { class: 'panel stack' },
          h('b', null, '여기에서 찾아요 (새 창에서 열려요)'),
          ...src.links.map((lk) => h('a', { class: 'src-link', href: lk.u, target: '_blank', rel: 'noopener', onClick: () => saveLife({ visited: true }) }, lk.t, ' ↗'))),
        src.tip ? h('div', { class: 'note gold small', style: { marginTop: '10px', whiteSpace: 'pre-line' } }, h('b', null, '찾는 방법 '), src.tip) : null,
        h('ul', { class: 'small', style: { marginTop: '8px' } },
          h('li', null, '찾은 수를 그대로 적어요. 모르는 값을 지어내지 않아요.'),
          h('li', null, '수가 너무 크면 단위를 바꾸어 어림해요. (예: 1,260,000명 → 126만 명)')),
        btn('‹ 다른 자료 고르기', () => app.go('life', 0, 'prev'), { variant: 'small' }));
    },
    right: (el) => {
      const years = Array.from({ length: N }, (_, i) => (l.years?.[i] ?? ''));
      const vals = Array.from({ length: N }, (_, i) => (l.values?.[i] ?? ''));
      const msg = h('div', { role: 'status' });
      const push = debounce(() => saveState({ life: { years: years.map((y) => (y === '' ? '' : Number(y))), values: vals.map((v) => (v === '' ? '' : Number(v))) } }).then(() => { S.data.state.life = { ...L(), years: years.slice(), values: vals.slice(), tableChecked: false }; }).catch((e) => toast(e.message, 'bad')), 600);
      const subject = h('input', { type: 'text', maxlength: 40, value: l.subject || '', placeholder: '예: 진양호 동물원 입장객 수', onInput: (e) => saveLife({ subject: e.target.value, tableChecked: false }) });
      const unit = h('input', { type: 'text', maxlength: 10, value: l.unit || '', placeholder: '예: 만 명', style: { maxWidth: '110px' }, onInput: (e) => { saveLife({ unit: e.target.value, tableChecked: false }); vHead.textContent = `${e.target.value ? `값 (${e.target.value})` : '값'}`; } });
      const source = h('input', { type: 'text', maxlength: 120, value: l.source || '', placeholder: '예: 공공데이터포털 경상남도 주요관광지점 입장객 현황', onInput: (e) => saveLife({ source: e.target.value }) });
      const vHead = h('th', null, l.unit ? `값 (${l.unit})` : '값');
      const yIn = years.map((y, i) => h('input', { type: 'number', inputmode: 'numeric', 'aria-label': `${i + 1}번째 연도`, value: y, onInput: (e) => { years[i] = e.target.value; push(); } }));
      const vIn = vals.map((v, i) => h('input', { type: 'number', inputmode: 'decimal', step: '0.1', min: 0, 'aria-label': `${i + 1}번째 값`, value: v, onInput: (e) => { vals[i] = e.target.value; push(); } }));
      el.append(
        h('div', { class: 'center' }, h('h2', { class: 'plaque' }, '찾은 자료를 표로')),
        h('div', { class: 'stack', style: { gap: '6px' } },
          h('label', { class: 'field' }, h('span', null, '무엇을 조사했나요?'), subject),
          h('div', { class: 'row', style: { gap: '8px', alignItems: 'flex-end' } },
            h('label', { class: 'field', style: { flex: '0 0 auto' } }, h('span', null, '단위'), unit),
            h('label', { class: 'field', style: { flex: '1 1 160px' } }, h('span', null, '출처(누리집·기사 이름)'), source))),
        h('div', { class: 'table-frame', style: { marginTop: '8px' } }, h('table', { class: 'data life-table' },
          h('thead', null, h('tr', null, h('th', null, '연도 (년)'), vHead)),
          h('tbody', null, yIn.map((x, i) => h('tr', null, h('td', null, x), h('td', null, vIn[i])))))),
        h('p', { class: 'small muted', style: { margin: '4px 0 0' } }, '연도는 위에서부터 차례대로(작은 연도부터) 3~8개를 적어요. 남는 칸은 비워 두어도 돼요.'),
        h('div', { class: 'row', style: { marginTop: '10px', justifyContent: 'center' } },
          btn('표 확인하기', async () => {
            await flush.flush(); await push.flush();
            try {
              const r = await api('POST', '/api/student/life/check-table');
              if (r.ok) { S.data.state = r.state; toast('표가 완성되었어요! 이제 그래프를 그려요.', 'ok'); app.go('life', 2, 'next'); } else msg.replaceChildren(h('div', { class: 'note' }, h('b', null, '다시 확인해 보세요'), h('ul', { class: 'issue-list' }, r.issues.map((t) => h('li', null, t)))));
            } catch (e) { toast(e.message, 'bad'); }
          }, { variant: 'gold' }),
          l.tableChecked ? h('span', { class: 'badge ok' }, '표 완성') : null),
        msg);
    },
  };
}

function thinkSpread(app, l) {
  const w = S.data.works.find((x) => x.kind === 'life');
  const vals = (l.values || []).map(Number);
  const lastYear = l.years?.length ? l.years[l.years.length - 1] : null;
  return {
    folio: ['123쪽 생각 더하기', '예상하기'],
    left: (el) => {
      el.append(
        h('div', { class: 'page-head' }, icon('brush', 'ico'), h('div', null, h('div', { class: 'kicker' }, '3차 활동 ④'), h('h2', null, '그래프로 앞날 예상하기'))),
        h('div', { class: 'divider' }));
      if (!l.tableChecked) { el.append(h('p', null, '표와 그래프를 먼저 완성하면 이 쪽에서 다음 해를 예상해요.')); return; }
      if (w?.data?.labels) {
        el.append(h('div', { class: 'graph-frame' }, renderStatic(w.data, { showValues: true })));
      } else {
        el.append(h('div', { class: 'table-frame' }, h('table', { class: 'data htable' },
          h('tr', null, h('th', null, '연도(년)'), l.years.map((y) => h('td', null, y))),
          h('tr', null, h('th', null, (approxValue(vals[0], Math.max(...vals)) !== null ? '약 ' : '') + (l.unit ? `값(${l.unit})` : '값')), vals.map((v) => { const a = approxValue(v, Math.max(...vals)); return h('td', { style: { whiteSpace: 'nowrap' } }, a === null ? fmt(v) : koNum(a)); })))));
      }
      const ups = vals.slice(1).filter((v, i) => v > vals[i]).length; const downs = vals.slice(1).filter((v, i) => v < vals[i]).length;
      el.append(h('div', { class: 'note small', style: { marginTop: '10px' } }, h('b', null, '살펴보기 '), `앞의 해보다 늘어난 때가 ${ups}번, 줄어든 때가 ${downs}번이에요. 이런 흐름이 다음 해에도 이어질까요?`));
    },
    right: (el) => {
      const pred = h('textarea', { rows: 4, maxlength: 300, placeholder: `${lastYear ? lastYear + 1 : '다음 해'}년에는 어떻게 될까요? 그렇게 생각한 이유도 써요.`, onInput: (e) => saveLife({ predict: e.target.value }) });
      pred.value = l.predict || '';
      const rel = h('textarea', { rows: 3, maxlength: 300, placeholder: '예: 관광지 입장객 수가 줄어든 2020년에 다른 관광지 입장객 수도 함께 줄었어요.', onInput: (e) => saveLife({ relation: e.target.value }) });
      rel.value = l.relation || '';
      el.append(
        h('div', { class: 'center' }, h('h2', { class: 'plaque green' }, '생각 더하기')),
        h('label', { class: 'field' }, h('span', null, `① ${lastYear ? lastYear + 1 : '다음 해'}년의 값은 어떻게 될까요? 이유는?`), pred),
        h('label', { class: 'field', style: { marginTop: '8px' } }, h('span', null, '② 친구가 조사한 다른 자료와 비교해 보고, 어떤 관계가 있는지 써 보세요. (선택)'), rel),
        h('p', { class: 'small muted' }, '쓴 내용은 저절로 저장돼요.'),
        h('div', { class: 'note gold small', style: { marginTop: '10px' } }, h('b', null, '창의+ '), '통계놀이터 누리집에서 다른 꺾은선그래프를 찾아보고 알 수 있는 내용을 이야기해 봐요. ',
          h('a', { href: 'https://kids.kostat.go.kr/', target: '_blank', rel: 'noopener' }, '통계놀이터 열기 ↗')),
        h('div', { class: 'row', style: { marginTop: '10px' } },
          !S.data.gates.survey ? btn('만족도 조사 하러 가기 ›', () => app.go('survey', 0, 'jump'), { variant: 'small gold' }) : null,
          btn('작품 전시관에서 친구 그래프 보기 ›', () => app.go('gallery', 0, 'next'), { variant: 'small green' })),
        S.data.gates.survey ? h('p', { class: 'small muted' }, S.data.gates.survey) : null);
    },
  };
}
