// 제1장 기상자료 탐험실 (교과서 118~121쪽): 포털 조사 → 표 → 직접 그래프
import { sealImg, h, icon, btn, toast, debounce } from '../ui.js?v=mwx3qfi5';
import { api } from '../api.js?v=mwx3qfi5';
import { S, saveState } from '../store.js?v=mwx3qfi5';
import { graphSpread, celebrate } from './graphwork.js?v=mwx3qfi5';
import { DECADE_SOURCE, ARTICLE_SOURCE_NAME, DECADES, DECADE_HEAT, isDecadeMode, yearLabel } from '../../shared/weather-sources.js?v=mwx3qfi5';

function W() { return S.data.state.weather || { years: ['', '', '', '', ''], values: ['', '', '', '', ''] }; }

export function spreads(app) {
  const w = W();
  const done = S.data.state.weatherDone;
  const list = [guideSpread(app, w, done), tableSpread(app, w, done)];
  if (w.tableChecked) {
    list.push(graphSpread(app, {
      kind: 'weather',
      labels: w.years.map((y) => yearLabel(w, y)), values: w.values.map(Number), unit: '일', xUnit: isDecadeMode(w) ? '년대' : '년',
      heading: { kicker: '기상자료 탐험실 ③', title: '폭염일수 꺾은선그래프' },
      intro: `${w.region === '전국' ? '전국의' : `${w.region || ''} 지역의`} ${isDecadeMode(w) ? '연대별' : '연도별'} 폭염일수를 꺾은선그래프로 나타내요.`,
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
const flushWeather = debounce(() => { const p = pending; pending = {}; saveState({ weather: p }).catch((e) => toast(e.message, 'bad')); }, 2000);
const saveWeather = (patch) => { pending = { ...pending, ...patch }; flushWeather(); };

function guideSpread(app, w, done) {
  return {
    folio: ['118쪽 탐험', '포털 조사'],
    left: (el) => el.append(
      h('div', { class: 'page-head' }, icon('weather', 'ico'), h('div', null, h('div', { class: 'kicker' }, '1차 활동 · 꼭 먼저 하는 탐험'), h('h2', null, '기상자료 탐험실'))),
      h('div', { class: 'divider' }),
      h('p', null, '100년 전과 비교하면 우리나라 여름은 얼마나 더워졌을까요? 기상청 보고서에서 10년 단위(연대별) ', h('b', null, '폭염일수'), '를 직접 찾아 조사해 봐요.'),
      h('div', { class: 'def-box' }, h('b', null, '폭염일수 '), '하루 중 가장 높은 기온이 33 ℃ 이상인 날의 수예요.'),
      h('h3', { style: { marginTop: '16px' } }, '탐험 순서'),
      h('ol', { class: 'steps-list' },
        h('li', null, h('span', null, '조사할 연속된 5개 연대를 정해요. (추천: 1980년대~2020년대)')),
        h('li', null, h('span', null, '오른쪽 기상청 보고서의 【표 2】에서 연대별 폭염일수를 찾아요.')),
        h('li', null, h('span', null, '찾은 자료를 표로 정리해요.')),
        h('li', null, h('span', null, '가로축·세로축과 눈금 한 칸의 크기를 정해 꺾은선그래프를 그려요.')),
        h('li', null, h('span', null, '그래프를 보고 알 수 있는 내용을 써요.'))),
      h('div', { class: 'def-box', style: { marginTop: '10px' } }, h('b', null, '연대 '), '10년을 한 묶음으로 부르는 말이에요. 1980년대는 1980년부터 1989년까지예요. 표의 값은 그 10년 동안의 한 해 평균 폭염일수예요.'),
      h('div', { class: 'note gold', style: { marginTop: '14px' } }, h('b', null, '생각해 보기 '), '친구마다 다른 연대를 골라 그리면, 옛날과 요즘의 폭염일수 변화가 어떻게 보이는지 비교할 수 있어요.'),
      done ? h('div', { class: 'note green', style: { marginTop: '10px' } }, '✔ 이 탐험을 이미 완료했어요.') : null),
    right: (el) => {
      const s = S.data.cls.settings;
      const dec = isDecadeMode(w);
      const source = h('input', { type: 'text', maxlength: 80, value: w.source || ARTICLE_SOURCE_NAME, disabled: done, onInput: (e) => saveWeather({ source: e.target.value }) });
      const setDecades = async (d0, msg) => {
        const years = [0, 1, 2, 3, 4].map((k) => d0 + k * 10);
        try {
          await saveState({ weather: { unit: 'decade', region: '전국', source: ARTICLE_SOURCE_NAME, years, values: dec && W().values?.length === 5 ? W().values : ['', '', '', '', ''] } });
          toast(msg || `${years[0]}년대부터 ${years[4]}년대까지 조사해요.`, 'ok');
          app.go('weather', 0);
        } catch (ex) { toast(ex.message, 'bad'); }
      };
      const startSel = h('select', { disabled: done, onChange: (e) => { const d0 = Number(e.target.value); if (d0) setDecades(d0); } },
        h('option', { value: '' }, '시작 연대 고르기'),
        DECADES.slice(0, DECADES.length - 4).reverse().map((d) => h('option', { value: d, selected: dec && w.years?.[0] === d ? true : undefined }, `${d}년대 ~ ${d + 40}년대`)));
      // 처음 시작하는 학생은 연대별로(이미 연도별로 적은 학생은 그대로)
      const empty = !(w.years || []).some((y) => y !== '' && y !== null && y !== undefined);
      if (!done && !w.unit && empty) saveWeather({ unit: 'decade', region: w.region || '전국', source: w.source || ARTICLE_SOURCE_NAME });
      else if (!w.source && !done) saveWeather({ source: ARTICLE_SOURCE_NAME });
      el.append(
        h('div', { class: 'center' }, h('h2', { class: 'plaque green' }, '기상청 보고서 탐험')),
        decadeTable(dec ? w : {}),
        h('div', { class: 'panel stack', style: { marginTop: '10px' } },
          h('div', { class: 'note gold small' }, h('b', null, '알림 '), '기상자료개방포털 자료가 잠시 내려가서, 위 표(기상청 보고서 【표 2】)로 조사해요. 보고서 원문에서 직접 확인해 볼 수도 있어요.'),
          h('a', { class: 'btn gold', href: DECADE_SOURCE.url, target: '_blank', rel: 'noopener', onClick: () => saveWeather({ visited: true }) }, '기상청 보고서 열기 ↗'),
          h('div', { class: 'small' }, h('b', null, DECADE_SOURCE.title), ` (${DECADE_SOURCE.date})`),
          h('div', { class: 'path-chips', 'aria-label': '찾는 곳' }, h('span', null, '아래쪽 [붙임 1]'), h('i', null, '›'), h('span', null, '【표 2】'), h('i', null, '›'), h('span', null, '폭염일수(일) 줄')),
          h('p', { class: 'small muted' }, '새 창(탭)에서 열려요. Ctrl+F(휴대폰은 「페이지에서 찾기」)로 「표 2」를 찾으면 빨라요. 숫자를 찾은 뒤 이 탭으로 돌아와 다음 쪽 표에 적어요.'),
          h('details', { class: 'small' }, h('summary', null, '기상자료개방포털로 찾기 (자료가 다시 열리면)'),
            h('a', { href: s.kmaUrl, target: '_blank', rel: 'noopener' }, '기상자료개방포털 열기 ↗'),
            h('div', { style: { whiteSpace: 'pre-line', marginTop: '6px' } }, s.kmaGuide))),
        h('div', { class: 'stack', style: { marginTop: '12px' } },
          done ? null : btn('추천: 1980년대 ~ 2020년대로 바로 정하기', () => setDecades(1980, '1980년대~2020년대로 정했어요. 보고서 【표 2】에서 폭염일수를 찾아 표에 적어요.'), { variant: 'green small' }),
          h('label', { class: 'field' }, h('span', null, '조사할 연대(연속된 5개)'), startSel),
          h('label', { class: 'field' }, h('span', null, '자료 출처'), source),
          btn('표 만들기로 넘기기 ›', () => app.go('weather', 1, 'next'), { variant: '' })));
    },
  };
}

// 보고서 【표 2】의 폭염일수 줄을 그대로 보여 줘요(내가 고른 연대는 색칠). 6개씩 두 줄로 나눠 보여요.
function decadeTable(w) {
  const picked = new Set((w.years || []).map(Number));
  const half = (list) => h('table', { class: 'data compact dec-table' },
    h('tr', null, h('th', null, '연대'), list.map((d) => h('th', { class: picked.has(d) ? 'on' : '' }, `${d}년대`))),
    h('tr', null, h('th', null, '폭염일수(일)'), list.map((d) => h('td', { class: picked.has(d) ? 'on' : '' }, DECADE_HEAT[d].toFixed(1)))));
  return h('div', { class: 'pub-data' },
    h('div', { class: 'small', style: { fontWeight: 700, marginBottom: '6px' } }, '【표 2】 연대별 폭염일수 (기상청 「우리나라 113년 기후변화 분석 보고서」)'),
    half(DECADES.slice(0, 6)), h('div', { style: { height: '6px' } }), half(DECADES.slice(6)),
    h('div', { class: 'small muted', style: { marginTop: '4px' } }, '색칠된 칸이 내가 고른 연대예요.'));
}

function tableSpread(app, w, done) {
  return {
    folio: ['119쪽 표', '표 만들기'],
    left: (el) => el.append(
      h('div', { class: 'page-head' }, icon('table', 'ico'), h('div', null, h('div', { class: 'kicker' }, '기상자료 탐험실 ②'), h('h2', null, '조사한 자료를 표로'))),
      h('div', { class: 'divider' }),
      h('p', null, isDecadeMode(w) ? '아래 보고서 【표 2】에서 내가 고른 연대(색칠된 칸)의 폭염일수를 찾아 오른쪽 표에 옮겨 적어요.' : '찾은 연도별 폭염일수를 오른쪽 표에 옮겨 적어요.'),
      isDecadeMode(w) ? decadeTable(w) : null,
      h('ul', { style: { marginTop: '10px' } },
        h('li', null, isDecadeMode(w) ? '연대는 1980, 1990, 2000처럼 왼쪽부터 10년씩 차례대로 적어요.' : '연도는 왼쪽부터 차례대로(작은 연도부터) 적어요.'),
        h('li', null, '10년 동안의 평균이라 7.9일처럼 소수가 나와요. 소수 첫째 자리까지 그대로 적어요.')),
      h('div', { class: 'note gold' }, h('b', null, '생각해 보기 '), '꺾은선그래프로 나타내면 표보다 무엇을 더 쉽게 알 수 있을까요?'),
      h('p', { class: 'small muted', style: { marginTop: '10px' } }, '지역: ', w.region || '(앞쪽에서 적어 주세요)', ' · 출처: ', isDecadeMode(w) ? ARTICLE_SOURCE_NAME : (w.source || ARTICLE_SOURCE_NAME))),
    right: (el) => {
      const years = (w.years?.length === 5 ? w.years : ['', '', '', '', '']).slice();
      const vals = (w.values?.length === 5 ? w.values : ['', '', '', '', '']).slice();
      const msg = h('div', { role: 'status' });
      const push = debounce(() => saveState({ weather: { years: years.map((y) => (y === '' ? '' : Number(y))), values: vals.map((v) => (v === '' ? '' : Number(v))) } }).catch((e) => toast(e.message, 'bad')), 2000);
      const yIn = years.map((y, i) => h('input', { type: 'number', inputmode: 'numeric', 'aria-label': `${i + 1}번째 ${isDecadeMode(w) ? '연대' : '연도'}`, value: y, disabled: done, onInput: (e) => { years[i] = e.target.value; push(); } }));
      const vIn = vals.map((v, i) => h('input', { type: 'number', inputmode: 'decimal', step: 'any', min: 0, max: 366, 'aria-label': `${i + 1}번째 폭염일수`, value: v, disabled: done, onInput: (e) => { vals[i] = e.target.value; push(); } }));
      el.append(
        h('div', { class: 'center' }, h('h2', { class: 'plaque' }, `${w.region || '우리 지역'}의 ${isDecadeMode(w) ? '연대별' : '연도별'} 폭염일수`)),
        h('div', { class: 'table-frame' }, h('table', { class: 'data htable' },
          h('tr', null, h('th', null, isDecadeMode(w) ? '연대 (년대)' : '연도 (년)'), yIn.map((x) => h('td', null, x))),
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
