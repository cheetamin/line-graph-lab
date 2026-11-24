// 그래프 그리기 공용 펼침(기상자료·조사 주제 모두 사용): 왼쪽 단계 안내, 오른쪽 모눈종이
import { sealImg, h, btn, toast, modal, debounce, fmt, confirmBox } from '../ui.js?v=mwulaa5m';
import { api } from '../api.js?v=mwulaa5m';
import { S, setSave, backup, clearBackup, getBackup } from '../store.js?v=mwulaa5m';
import { GraphEditor } from '../graph.js?v=mwulaa5m';
import { SCALE_OPTIONS, MAJOR, MAX_CELLS, MIN_CELLS, cellsNeeded, approxUnit, approxValue, koNum, PLACE_NAME } from '../../shared/topics.js?v=mwulaa5m';

const UNITS = ['월', '년', '일', '회', '권', '편', '개', '시간', '원', '명', '만 명', '곳'];
const STATUS = { draft: ['그리는 중', 'warn'], submitted: ['제출함 · 선생님 확인 중', 'ok'], approved: ['승인됨 · 전시 중', 'green'], rejected: ['다시 그려 보세요', 'red'] };

export function graphSpread(app, { kind, topicId = null, labels, values, unit, xUnit, heading, intro, onSubmitted, submitText }) {
  const match = (w) => w.kind === kind && (kind !== 'topic' || w.topicId === topicId);
  const BK = kind === 'topic' ? `work-topic-${topicId}` : `work-${kind}`;
  const existing = S.data.works.find(match);
  const bk = getBackup(BK);
  const W = {
    title: '', xName: '', xUnit: '', yName: '', yUnit: '', scale: null, yStart: 0, points: {}, segments: [], interp: { maxLabel: '', minLabel: '', changeLabel: '', sentence: '' },
    ...(existing?.data || {}), ...(bk && (!existing || bk.savedAt > Date.parse(existing.updatedAt)) ? bk.data : {}),
  };
  W.interp = { maxLabel: '', minLabel: '', changeLabel: '', sentence: '', ...(W.interp || {}) };
  let status = existing?.status || 'draft';
  let feedback = existing?.feedback || '';
  let lastIssues = [];
  const finite = values.filter((v) => v !== null && v !== '' && v !== undefined).map(Number);
  const maxValue = finite.length ? Math.max(...finite) : 0;
  const lockedForever = kind === 'weather' && S.data.gates.weatherDone && S.data.state.weatherDone;

  let editor; let stepEls = {}; let statusEl; let submitBtn; let checkBox; let answerToggle;

  const save = debounce(async () => {
    setSave('저장 중…');
    backup(BK, { data: W, savedAt: Date.now() });
    try {
      const r = await api('PUT', '/api/student/work', { kind, data: W });
      status = r.work.status; W.checked = r.work.data.checked;
      const i = S.data.works.findIndex(match);
      if (i >= 0) S.data.works[i] = r.work; else S.data.works.push(r.work);
      clearBackup(BK);
      setSave('저장됨 ✓');
      updateMarks();
    } catch (e) {
      setSave('저장 실패 · 기기에 보관', true);
      toast(e.message, 'bad');
    }
  }, 900);

  function change(patch, opts = {}) {
    if (lockedForever) return;
    if ((status === 'submitted' || status === 'approved') && !opts.silent) {
      toast('작품을 고치면 다시 확인하고 제출해야 해요.', '');
      status = 'draft';
    }
    Object.assign(W, patch);
    W.checked = false;
    if (answerToggle) { editor.answer = null; answerToggle.checked = false; answerToggle.closest('label').classList.add('hidden'); }
    save();
    updateMarks();
  }

  const steps = () => {
    const n = labels.length;
    const pts = Object.keys(W.points || {}).length;
    const need = values.filter((v) => v !== null && v !== '').length;
    const adj = (W.segments || []).filter(([a, b]) => b - a === 1).length;
    return {
      title: !!W.title,
      axis: !!(W.xName && W.xUnit && W.yName && W.yUnit),
      scale: !!W.scale,
      points: pts >= need && need > 0,
      lines: adj >= Math.max(0, need - 1) && (W.segments || []).length === adj && need > 1,
      interp: !!(W.interp.maxLabel && W.interp.minLabel && W.interp.changeLabel && (W.interp.sentence || '').length >= 10),
      check: !!W.checked,
      submit: status === 'submitted' || status === 'approved',
      n,
    };
  };

  function updateMarks() {
    const st = steps();
    const badSteps = new Set(lastIssues.map((i) => i.step));
    for (const [k, el] of Object.entries(stepEls)) {
      el.classList.toggle('done', !!st[k] && !badSteps.has(k));
      el.classList.toggle('bad', badSteps.has(k) && !st.check);
    }
    if (statusEl) {
      const [t, c] = STATUS[status] || STATUS.draft;
      statusEl.replaceChildren(h('span', { class: `badge ${c}` }, t), status === 'rejected' && feedback ? h('span', { class: 'small' }, ` 선생님 말씀: ${feedback}`) : null);
    }
    if (submitBtn) submitBtn.disabled = !W.checked || st.submit || lockedForever;
  }

  function step(key, n, title, ...body) {
    const el = h('details', { class: 'step', open: key === firstOpen() ? true : undefined }, h('summary', null, h('span', { class: 'n' }, n), h('span', null, title), h('span', { class: 'small muted' }, '')), h('div', { class: 'body' }, ...body));
    stepEls[key] = el;
    return el;
  }
  function firstOpen() {
    const st = steps();
    return ['title', 'axis', 'scale', 'points', 'lines', 'interp', 'check'].find((k) => !st[k]) || 'check';
  }

  let tableRef = null; // 크게 그리기 화면에 함께 보여 줄 표
  const left = (el) => {
    stepEls = {};
    const titleIn = h('input', { type: 'text', maxlength: 60, value: W.title, placeholder: kind === 'weather' ? '예: ○○ 지역의 연도별 폭염일수' : '예: 우리 반 월별 운동한 날수', onInput: (e) => change({ title: e.target.value.trim() }) });
    const sel = (val, key, ph) => h('select', { onChange: (e) => change({ [key]: e.target.value }) }, h('option', { value: '' }, ph), [...new Set([...UNITS, unit, xUnit].filter(Boolean))].map((u) => h('option', { value: u, selected: val === u ? true : undefined }, u)));
    const xName = h('input', { type: 'text', maxlength: 20, value: W.xName, placeholder: kind === 'weather' ? '예: 연도' : '예: 월', onInput: (e) => change({ xName: e.target.value.trim() }) });
    const yName = h('input', { type: 'text', maxlength: 20, value: W.yName, placeholder: kind === 'weather' ? '예: 폭염일수' : '예: 날수, 횟수', onInput: (e) => change({ yName: e.target.value.trim() }) });
    const scaleInfo = h('p', { class: 'small' });
    const dataTable = h('div', { class: 'table-frame', style: { padding: '8px' } });
    tableRef = dataTable;
    const big = maxValue >= 10000;
    const renderTable = () => {
      const u = approxUnit(maxValue);
      dataTable.replaceChildren(
        h('table', { class: 'data compact' },
          h('caption', { class: 'small muted' }, u ? '그래프로 옮길 자료 (어림값)' : '내가 완성한 표 (그래프로 옮길 자료)'),
          h('tr', null, h('th', null, xUnit === '년' ? '연도' : '월'), labels.map((l) => h('th', null, l))),
          u ? h('tr', { class: 'approx-row' }, h('th', null, `어림값(${unit})`), values.map((v) => {
            const a = approxValue(v, maxValue);
            return h('td', null, a === null ? '—' : h('b', null, `약 ${koNum(a)}`));
          }))
            : h('tr', null, h('th', null, `(${unit})`), values.map((v) => h('td', null, v === null || v === '' ? '—' : fmt(v))))),
        u ? h('p', { class: 'small approx-note' }, '📍 수가 커서 ', h('b', null, `${PLACE_NAME[u]}의 자리까지 반올림한 어림값`), '으로 바꾸었어요. 이 어림값에 맞게 점을 찍어요.') : null);
    };
    renderTable();
    const showScaleInfo = () => {
      renderTable();
      const u = unit ? ` ${unit}` : '';
      if (!W.scale) { scaleInfo.textContent = `가장 큰 값은 ${approxUnit(maxValue) ? `약 ${koNum(approxValue(maxValue, maxValue))}(${fmt(approxValue(maxValue, maxValue))})` : fmt(maxValue)}${u}예요. 작은 눈금 한 칸을 몇으로 하면 알맞을까요?`; return; }
      const cells = cellsNeeded(maxValue, W.yStart, W.scale);
      scaleInfo.replaceChildren(
        h('b', null, `작은 눈금 한 칸 = ${fmt(W.scale)}${u}`), ` → 큰 눈금 한 칸(작은 칸 ${MAJOR}개) = ${fmt(W.scale * MAJOR)}${u}`, h('br'),
        `가장 큰 값 ${approxUnit(maxValue) ? `약 ${koNum(approxValue(maxValue, maxValue))}` : fmt(maxValue)}${u}까지 작은 칸 약 ${cells}칸이 필요해요. `,
        cells > MAX_CELLS ? h('b', { class: 'warn-text' }, '칸이 너무 많아요. 더 큰 수를 골라 보세요.') : cells < MIN_CELLS ? h('b', { class: 'warn-text' }, '칸이 너무 적어 변화가 잘 보이지 않아요. 더 작은 수를 골라 보세요.') : '');
    };
    showScaleInfo();
    const scaleOpts = SCALE_OPTIONS.filter((o) => { const c = Math.ceil(maxValue / o); return c <= MAX_CELLS * 1.5 && c >= 2 && (o >= 1 || values.some((v) => v !== null && !Number.isInteger(Number(v)))); });
    const scaleBtns = h('div', { class: 'row' }, scaleOpts.map((o) => h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': String(W.scale === o), onClick: (e) => {
      change({ scale: o });
      e.target.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === e.target)));
      showScaleInfo(); editor.render();
    } }, `${fmt(o)}`)));
    const yStart = h('input', { type: 'number', min: 0, value: W.yStart || 0, style: { maxWidth: '140px' }, onChange: (e) => { change({ yStart: Math.max(0, Number(e.target.value) || 0) }); showScaleInfo(); editor.render(); } });
    const pairOpts = labels.slice(1).map((l, i) => `${labels[i]}~${l}`);
    const pick = (key, opts, ph) => h('select', { onChange: (e) => change({ interp: { ...W.interp, [key]: e.target.value } }) }, h('option', { value: '' }, ph), opts.map((o) => h('option', { value: o, selected: W.interp[key] === o ? true : undefined }, o)));
    const sentence = h('textarea', { maxlength: 600, placeholder: '예: ○월부터 ○월까지 점점 늘어났어요. 가장 많이 줄어든 때는 ○월~○월이에요. 그 까닭은 … 라고 생각해요.', onInput: (e) => change({ interp: { ...W.interp, sentence: e.target.value } }) });
    sentence.value = W.interp.sentence || '';
    checkBox = h('div', { class: 'stack' });
    submitBtn = btn('작품 제출하기', () => submit(), { variant: 'gold' });
    statusEl = h('div', { class: 'row' });

    el.append(
      h('div', { class: 'page-head' }, h('div', null, h('div', { class: 'kicker' }, heading.kicker), h('h2', null, heading.title))),
      intro ? h('p', { class: 'small' }, intro) : null,
      statusEl,
      lockedForever ? h('div', { class: 'note green' }, '기상자료 탐험을 완료했어요! 이 그래프는 기록으로 남아 있어요.') : null,
      dataTable,
      h('div', { class: 'stepper', style: { marginTop: '10px' } },
        step('title', 1, '그래프 제목 정하기', h('label', { class: 'field' }, h('span', null, '제목'), titleIn), h('p', { class: 'small muted' }, '무엇을, 언제 조사했는지 알 수 있게 지어요.')),
        step('axis', 2, '가로축·세로축 이름과 단위',
          h('div', { class: 'row' }, h('label', { class: 'field grow' }, h('span', null, '가로축 이름'), xName), h('label', { class: 'field', style: { width: '120px' } }, h('span', null, '가로 단위'), sel(W.xUnit, 'xUnit', '고르기'))),
          h('div', { class: 'row' }, h('label', { class: 'field grow' }, h('span', null, '세로축 이름'), yName), h('label', { class: 'field', style: { width: '120px' } }, h('span', null, '세로 단위'), sel(W.yUnit, 'yUnit', '고르기'))),
          h('p', { class: 'small muted' }, '가로에는 변화하는 때(연도, 월)를, 세로에는 조사한 수량을 나타내요.')),
        step('scale', 3, '세로 작은 눈금 한 칸의 크기',
          h('div', { class: 'tick-guide' }, tickDiagram(),
            h('p', { class: 'small', style: { margin: 0 } }, h('b', null, '점선 한 칸'), '이 작은 눈금 한 칸이에요. 작은 눈금 ', h('b', null, `${MAJOR}칸`), '이 모이면 ', h('b', null, '실선 한 칸(큰 눈금)'), '이 되고, 실선마다 수를 적어요. 작은 눈금 한 칸을 몇으로 할지 골라요.')),
          scaleInfo, scaleBtns,
          h('details', null, h('summary', { class: 'small' }, '물결선으로 필요 없는 부분 줄이기(선택)'),
            h('div', { class: 'row', style: { marginTop: '6px' } }, h('span', { class: 'small' }, '세로축 시작 값'), yStart, h('span', { class: 'small muted' }, '0이면 물결선 없이 그려요.')))),
        step('points', 4, '자료값에 맞게 점 찍기', h('p', { class: 'small' }, approxUnit(maxValue) ? '위 표의 어림값(예: 약 40만)을 보고 찍어요. ' : '', '오른쪽 모눈종이에서 [점 찍기]를 고르고, 표의 수에 맞는 곳을 눌러요. 누른 채 움직이면 위치와 값이 말풍선으로 보여요. 손을 떼면 점이 찍혀요.')),
        step('lines', 5, '점들을 선분으로 잇기', h('p', { class: 'small' }, '[선 잇기]를 고르고 첫 점, 다음 점을 차례대로 눌러요. 잘못 이었으면 [지우개]로 선분을 눌러 지우거나 [되돌리기]를 눌러요.')),
        step('interp', 6, '그래프에서 알 수 있는 내용',
          h('label', { class: 'field' }, h('span', null, '가장 큰 값이 나타난 때'), pick('maxLabel', labels, '고르기')),
          h('label', { class: 'field' }, h('span', null, '가장 작은 값이 나타난 때'), pick('minLabel', labels, '고르기')),
          h('label', { class: 'field' }, h('span', null, '변화가 가장 큰 시기 (선분이 가장 많이 기울어진 곳)'), pick('changeLabel', pairOpts, '고르기')),
          h('label', { class: 'field' }, h('span', null, '알게 된 내용과 그 까닭 (10자 이상)'), sentence)),
        step('check', 7, '확인하기',
          h('p', { class: 'small' }, '제목, 축, 눈금, 점의 위치, 선분, 해석을 한꺼번에 확인해요. 틀린 곳은 알려 주지만 정답 수는 알려 주지 않아요.'),
          h('div', { class: 'row' }, btn('중간 저장', () => save.flush(), { variant: 'green small' }), btn('확인하기', () => check(), { variant: 'small' })),
          checkBox),
        step('submit', 8, '작품 제출하기', h('p', { class: 'small' }, kind === 'weather' ? '확인을 통과하면 제출할 수 있어요. 제출하면 기상자료 탐험실이 완료되고 다음 장이 열려요.' : (submitText || '확인을 통과하면 제출할 수 있어요. 선생님이 승인하면 작품 전시관에 걸려요.')), submitBtn)),
    );
    updateMarks();
  };

  const right = (el) => {
    editor = new GraphEditor({
      labels,
      getData: () => ({ ...W, maxValue }),
      onChange: (p) => change(p),
      readOnly: lockedForever,
      bigHeader: () => (tableRef ? tableRef.cloneNode(true) : null),
    });
    answerToggle = h('input', { type: 'checkbox', onChange: (e) => { editor.answer = e.target.checked ? values.map((v) => (v === '' || v === null ? null : (approxUnit(maxValue) ? approxValue(v, maxValue) : v))) : null; editor.render(); } });
    el.append(
      h('div', { class: 'row between' }, h('h2', { class: 'plaque' }, '모눈종이'), h('label', { class: `toggle small ${W.checked ? '' : 'hidden'}` }, answerToggle, '정답 비교 그래프 겹쳐 보기')),
      editor.el);
    editor.render();
    editor.setHint(lockedForever ? '완료한 그래프예요.' : W.scale ? '[점 찍기]로 자료값에 맞는 곳에 점을 찍어요.' : '왼쪽 3단계에서 세로 눈금 한 칸의 크기를 먼저 정해요.');
  };

  async function check() {
    await save.flush();
    try {
      const r = await api('POST', '/api/student/work/check', { kind });
      lastIssues = r.issues || [];
      W.checked = r.ok;
      const pi = lastIssues.find((i) => i.step === 'points' && i.labels);
      editor.wrongLabels = pi ? pi.labels : [];
      editor.render();
      checkBox.replaceChildren(r.ok
        ? h('div', { class: 'note green' }, h('b', null, '훌륭해요! '), '모든 확인을 통과했어요. 오른쪽 위의 [정답 비교 그래프]로 내 그래프와 겹쳐 볼 수 있어요. 이제 작품을 제출해요.')
        : h('div', { class: 'note' }, h('b', null, '다시 살펴볼 곳이 있어요'), h('ul', { class: 'issue-list' }, lastIssues.map((i) => h('li', null, i.msg)))));
      if (r.ok) { answerToggle.closest('label').classList.remove('hidden'); toast('확인을 통과했어요!', 'ok'); } else toast('다시 살펴볼 곳이 있어요.', 'bad');
      updateMarks();
      if (!r.ok) {
        const first = lastIssues[0]?.step;
        if (stepEls[first]) { stepEls[first].open = true; stepEls[first].scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
      }
    } catch (e) { toast(e.message, 'bad'); }
  }

  async function submit() {
    if (!(await confirmBox('작품 제출', kind === 'weather' ? '기상자료 그래프를 제출할까요? 제출하면 기상자료 탐험실이 완료돼요.' : '작품을 제출할까요? 선생님이 확인한 뒤 전시관에 걸려요.', '제출하기'))) return;
    try {
      const r = await api('POST', '/api/student/work/submit', { kind });
      status = r.work.status;
      const i = S.data.works.findIndex(match);
      if (i >= 0) S.data.works[i] = r.work; else S.data.works.push(r.work);
      updateMarks();
      await onSubmitted?.();
    } catch (e) { toast(e.message, 'bad'); }
  }

  return { left, right, folio: [heading.kicker, '모눈종이'] };
}

export async function celebrate(title, text) {
  await modal({ title, body: h('div', { class: 'center' }, sealImg('完', 96), h('p', null, text)), actions: [{ label: '다음 장으로 ›', value: true, variant: 'gold' }] });
}

// 작은 눈금(점선) 5칸 = 큰 눈금(실선) 1칸 설명 그림
function tickDiagram() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 214 128'); svg.setAttribute('class', 'tick-svg'); svg.setAttribute('aria-hidden', 'true');
  const add = (tag, a, t) => { const e = document.createElementNS(ns, tag); for (const [k, v] of Object.entries(a)) e.setAttribute(k, v); if (t !== undefined) e.textContent = t; svg.append(e); };
  const x0 = 26; const x1 = 96; const y0 = 116; const step = 20;
  add('rect', { x: x0, y: y0 - step * 5, width: x1 - x0, height: step * 5, fill: '#fffdf6' });
  for (let k = 0; k <= 5; k++) {
    const y = y0 - k * step; const major = k % 5 === 0;
    add('line', { x1: x0, x2: x1, y1: y, y2: y, stroke: major ? '#4f7059' : '#9fb8a6', 'stroke-width': major ? 2 : 1.2, 'stroke-dasharray': major ? '' : '4 3' });
  }
  add('line', { x1: x0, x2: x0, y1: y0 - step * 5 - 6, y2: y0, stroke: '#2a1c12', 'stroke-width': 2 });
  add('text', { x: x0 - 5, y: y0 + 4, 'text-anchor': 'end', 'font-size': 12, fill: '#2a1c12' }, '0');
  add('text', { x: x0 - 5, y: y0 - step * 5 + 4, 'text-anchor': 'end', 'font-size': 12, fill: '#2a1c12' }, '5');
  // 작은 1칸 괄호(맨 아래 칸)
  add('path', { d: `M${x1 + 4} ${y0} h5 v${-step} h-5`, fill: 'none', stroke: '#a3302a', 'stroke-width': 1.6 });
  add('text', { x: x1 + 12, y: y0 - step / 2 + 4, 'font-size': 11, fill: '#a3302a', 'font-weight': 700 }, '작은 1칸');
  // 큰 1칸 괄호(작은 5칸 전체)
  const bx = x1 + 62;
  add('path', { d: `M${bx} ${y0 - step * 5} h6 v${step * 5} h-6`, fill: 'none', stroke: '#5a1710', 'stroke-width': 1.6 });
  add('text', { x: bx + 10, y: y0 - step * 2.5, 'font-size': 11, fill: '#5a1710', 'font-weight': 700 }, '큰 1칸');
  add('text', { x: bx + 10, y: y0 - step * 2.5 + 14, 'font-size': 10, fill: '#5a1710' }, '=작은 5칸');
  return svg;
}
