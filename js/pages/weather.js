// 제1장 기상자료 탐험실 (교과서 118~121쪽): 포털 조사 → 표 → 직접 그래프
import { sealImg, h, icon, btn, toast, debounce } from '../ui.js?v=mwt4rdkx';
import { api } from '../api.js?v=mwt4rdkx';
import { S, saveState } from '../store.js?v=mwt4rdkx';
import { graphSpread, celebrate } from './graphwork.js?v=mwt4rdkx';

function W() { return S.data.state.weather || { years: ['', '', '', '', ''], values: ['', '', '', '', ''] }; }

export function spreads(app) {
  const w = W();
  const done = S.data.state.weatherDone;
  const list = [guideSpread(app, w, done), tableSpread(app, w, done)];
  if (w.tableChecked) {
    list.push(graphSpread(app, {
      kind: 'weather',
      labels: w.years.map((y) => `${y}년`), values: w.values.map(Number), unit: '일', xUnit: '년',
      heading: { kicker: '기상자료 탐험실 ③', title: '폭염일수 꺾은선그래프' },
      intro: `${w.region || ''} 지역의 연도별 폭염일수를 꺾은선그래프로 나타내요.`,
      onSubmitted: async () => {
        await app.reload(false);
        await celebrate('기상자료 탐험실 완료!', '폭염일수 그래프를 완성했어요. 이제 2차 「나의 주제 꺾은선그래프」와 3차 「우리 고장 꺾은선그래프」의 봉인이 풀렸어요.');
        app.go('topics', 0, 'next');
      },
    }));
  } else {
    list.push({
      left: (el) => el.append(h('h2', null, '폭염일수 꺾은선그래프'), h('div', { class: 'divider' }), h('p', null, '표를 먼저 완성하면 이 쪽에서 모눈종이에 그래프를 그릴 수 있어요.')),
      right: (el) => el.append(h('div', { class: 'lock-page' }, h('div', null, sealImg('表'), h('p', null, '앞쪽의 표를 완성하고 [표 확인하기]를 눌러 주세요.'), btn('표 만들러 가기', () => app.go('weather', 1, 'prev'), { variant: 'green' })))),
    });
  }
  return list;
}

let pending = {};
const flushWeather = debounce(() => { const p = pending; pending = {}; saveState({ weather: p }).catch((e) => toast(e.message, 'bad')); }, 700);
const saveWeather = (patch) => { pending = { ...pending, ...patch }; flushWeather(); };

function guideSpread(app, w, done) {
  return {
    folio: ['118쪽 탐험', '포털 조사'],
    left: (el) => el.append(
      h('div', { class: 'page-head' }, icon('weather', 'ico'), h('div', null, h('div', { class: 'kicker' }, '1차 활동 · 꼭 먼저 하는 탐험'), h('h2', null, '기상자료 탐험실'))),
      h('div', { class: 'divider' }),
      h('p', null, '우리 고장의 여름은 해마다 얼마나 더웠을까요? 기상청 자료를 직접 찾아 연도별 ', h('b', null, '폭염일수'), '를 조사해 봐요.'),
      h('div', { class: 'def-box' }, h('b', null, '폭염일수 '), '하루 중 가장 높은 기온이 33 ℃ 이상인 날의 수예요.'),
      h('h3', { style: { marginTop: '16px' } }, '탐험 순서'),
      h('ol', { class: 'steps-list' },
        h('li', null, h('span', null, '조사할 지역을 정해요.')),
        h('li', null, h('span', null, '기상자료개방포털에서 연도별 폭염일수를 찾아요.')),
        h('li', null, h('span', null, '찾은 자료를 표로 정리해요.')),
        h('li', null, h('span', null, '가로축·세로축과 눈금 한 칸의 크기를 정해 꺾은선그래프를 그려요.')),
        h('li', null, h('span', null, '그래프를 보고 알 수 있는 내용을 써요.'))),
      h('div', { class: 'note gold', style: { marginTop: '14px' } }, h('b', null, '생각해 보기 '), '모둠 친구들이 서로 다른 지역을 조사하면, 지역마다 폭염일수의 변화가 어떻게 다른지 비교할 수 있어요.'),
      done ? h('div', { class: 'note green', style: { marginTop: '10px' } }, '✔ 이 탐험을 이미 완료했어요.') : null),
    right: (el) => {
      const s = S.data.cls.settings;
      const region = h('input', { type: 'text', maxlength: 40, value: w.region || '', placeholder: '예: 서울, 부산, 대전', disabled: done, onInput: (e) => saveWeather({ region: e.target.value }) });
      const station = h('input', { type: 'text', maxlength: 40, value: w.station || '', placeholder: '지점 이름(선택)', disabled: done, onInput: (e) => saveWeather({ station: e.target.value }) });
      const source = h('input', { type: 'text', maxlength: 80, value: w.source || '기상청 기상자료개방포털', disabled: done, onInput: (e) => saveWeather({ source: e.target.value }) });
      const thisYear = new Date().getFullYear();
      const startSel = h('select', { disabled: done, onChange: async (e) => {
        const y0 = Number(e.target.value); if (!y0) return;
        const years = [0, 1, 2, 3, 4].map((k) => y0 + k);
        try { await saveState({ weather: { years, values: W().values?.length === 5 ? W().values : ['', '', '', '', ''] } }); toast(`${years[0]}년부터 ${years[4]}년까지 5년을 조사해요.`, 'ok'); } catch (ex) { toast(ex.message, 'bad'); }
      } }, h('option', { value: '' }, '시작 연도 고르기'), Array.from({ length: thisYear - 1973 - 3 }, (_, i) => thisYear - 4 - i).map((y) => h('option', { value: y, selected: w.years?.[0] === y ? true : undefined }, `${y}년 ~ ${y + 4}년`)));
      if (!w.source && !done) saveWeather({ source: '기상청 기상자료개방포털' });
      el.append(
        h('div', { class: 'center' }, h('h2', { class: 'plaque green' }, '기상자료개방포털 탐험')),
        h('div', { class: 'panel stack' },
          h('a', { class: 'btn gold', href: s.kmaUrl, target: '_blank', rel: 'noopener', onClick: () => saveWeather({ visited: true }) }, '기상자료개방포털 열기 ↗'),
          h('p', { class: 'small muted center' }, '새 창(탭)에서 열려요. 자료를 찾은 뒤 이 탭으로 돌아와 적어요.'),
          h('div', { class: 'path-chips', 'aria-label': '메뉴 경로' }, h('span', null, '기후통계분석'), h('i', null, '›'), h('span', null, '기상현상일수'), h('i', null, '›'), h('span', null, '폭염일수')),
          h('div', { class: 'small', style: { whiteSpace: 'pre-line' } }, s.kmaGuide)),
        h('div', { class: 'stack', style: { marginTop: '12px' } },
          h('label', { class: 'field' }, h('span', null, '조사할 지역'), region),
          h('label', { class: 'field' }, h('span', null, '관측 지점(선택)'), station),
          h('label', { class: 'field' }, h('span', null, '조사 기간(연속된 5년)'), startSel),
          h('label', { class: 'field' }, h('span', null, '자료 출처'), source),
          btn('표 만들기로 넘기기 ›', () => app.go('weather', 1, 'next'), { variant: '' })));
    },
  };
}

function tableSpread(app, w, done) {
  return {
    folio: ['119쪽 표', '표 만들기'],
    left: (el) => el.append(
      h('div', { class: 'page-head' }, icon('table', 'ico'), h('div', null, h('div', { class: 'kicker' }, '기상자료 탐험실 ②'), h('h2', null, '조사한 자료를 표로'))),
      h('div', { class: 'divider' }),
      h('p', null, '포털에서 찾은 연도별 폭염일수를 오른쪽 표에 옮겨 적어요.'),
      h('ul', null,
        h('li', null, '연도는 왼쪽부터 차례대로(작은 연도부터) 적어요.'),
        h('li', null, '폭염일수는 날수이므로 0 또는 자연수예요.'),
        h('li', null, '모르는 값을 지어내지 않아요. 포털에 나온 수를 그대로 적어요.')),
      h('div', { class: 'note gold' }, h('b', null, '생각해 보기 '), '꺾은선그래프로 나타내면 표보다 무엇을 더 쉽게 알 수 있을까요?'),
      h('p', { class: 'small muted', style: { marginTop: '10px' } }, '지역: ', w.region || '(앞쪽에서 적어 주세요)', ' · 출처: ', w.source || '기상청 기상자료개방포털')),
    right: (el) => {
      const years = (w.years?.length === 5 ? w.years : ['', '', '', '', '']).slice();
      const vals = (w.values?.length === 5 ? w.values : ['', '', '', '', '']).slice();
      const msg = h('div', { role: 'status' });
      const push = debounce(() => saveState({ weather: { years: years.map((y) => (y === '' ? '' : Number(y))), values: vals.map((v) => (v === '' ? '' : Number(v))) } }).catch((e) => toast(e.message, 'bad')), 600);
      const yIn = years.map((y, i) => h('input', { type: 'number', inputmode: 'numeric', 'aria-label': `${i + 1}번째 연도`, value: y, disabled: done, onInput: (e) => { years[i] = e.target.value; push(); } }));
      const vIn = vals.map((v, i) => h('input', { type: 'number', inputmode: 'numeric', min: 0, max: 366, 'aria-label': `${i + 1}번째 폭염일수`, value: v, disabled: done, onInput: (e) => { vals[i] = e.target.value; push(); } }));
      el.append(
        h('div', { class: 'center' }, h('h2', { class: 'plaque' }, `${w.region || '우리 지역'}의 연도별 폭염일수`)),
        h('div', { class: 'table-frame' }, h('table', { class: 'data htable' },
          h('tr', null, h('th', null, '연도 (년)'), yIn.map((x) => h('td', null, x))),
          h('tr', null, h('th', null, '폭염일수 (일)'), vIn.map((x) => h('td', null, x))))),
        h('div', { class: 'row', style: { marginTop: '12px', justifyContent: 'center' } },
          done ? h('span', { class: 'badge ok' }, '완료한 표예요') : btn('표 확인하기', async () => {
            await push.flush();
            try {
              const r = await api('POST', '/api/student/weather/check-table');
              if (r.ok) {
                S.data.state = r.state;
                toast('표가 완성되었어요! 이제 그래프를 그려요.', 'ok');
                app.go('weather', 2, 'next');
              } else msg.replaceChildren(h('div', { class: 'note' }, h('b', null, '다시 확인해 보세요'), h('ul', { class: 'issue-list' }, r.issues.map((t) => h('li', null, t)))));
            } catch (e) { toast(e.message, 'bad'); }
          }, { variant: 'gold' })),
        msg);
    },
  };
}
