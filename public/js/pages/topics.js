// 제2장 주제 선택·투표 + 2026년 월별 경험 조사
import { sealImg, h, icon, btn, toast, fmt, iconSrc } from '../ui.js';
import { api } from '../api.js';
import { S, saveState, backup, getBackup, clearBackup } from '../store.js';
import { TOPICS, CATEGORIES, topicById, monthMax, validateEntry, YEAR } from '../../shared/topics.js';

let selTopic = null; let cat = 'all'; let query = ''; let surveyTopic = null;

export function spreads(app) {
  return [voteSpread(app), surveySpread(app)];
}

function voteSpread(app) {
  const d = S.data; const s = d.cls.settings;
  if (!selTopic) selTopic = d.vote || s.activeTopics[0] || 1;
  let rightEl;
  const drawRight = () => {
    const t = topicById(selTopic);
    const c = CATEGORIES.find((x) => x.id === t.cat);
    const active = s.activeTopics.includes(t.id);
    const voted = d.vote === t.id;
    const res = h('div', { class: 'vote-bars' }, h('p', { class: 'small muted' }, '투표 결과를 불러오는 중…'));
    rightEl.replaceChildren(
      h('div', { class: 'center' }, h('h2', { class: 'plaque green' }, '주제 살펴보기')),
      h('div', { class: 'panel stack' },
        h('div', { class: 'row' }, h('span', { class: 'label-tag' }, c.name), active ? h('span', { class: 'badge green' }, '우리 반 조사 중') : null, voted ? h('span', { class: 'badge ok' }, '내가 추천한 주제') : null),
        h('h3', { style: { margin: 0 } }, `${t.id}. ${t.name}`),
        t.sub ? h('p', { class: 'small', style: { margin: 0 } }, `(${t.sub})`) : null,
        h('p', { style: { margin: 0 } }, '단위: ', h('b', null, t.unit), ' · ', t.kind === 'days' ? '한 달의 날수까지 적을 수 있어요.' : `한 달에 ${fmt(t.max)}${t.unit}까지 적을 수 있어요.`),
        t.hint ? h('div', { class: 'note gold small' }, t.hint) : null,
        h('p', { class: 'small muted', style: { margin: 0 } }, '예시: 2026년 1월부터 11월까지 매달 ', t.name.replace('월별 ', ''), '을(를) 떠올려 적어요.'),
        s.voteOpen
          ? btn(voted ? '✔ 추천 투표함 (다시 누르면 유지)' : '이 주제를 추천해요', async () => {
            try { await api('POST', '/api/student/vote', { topicId: t.id }); d.vote = t.id; toast('추천 투표를 했어요! (다른 주제로 바꿀 수 있어요)', 'ok'); drawRight(); app.renderTabs(); } catch (e) { toast(e.message, 'bad'); }
          }, { variant: voted ? 'green' : 'gold' })
          : h('div', { class: 'note' }, '지금은 추천 투표 기간이 아니에요.')),
      h('h3', { style: { marginTop: '14px' } }, '우리 반 추천 순위'), res,
      h('div', { class: 'row', style: { marginTop: '12px', justifyContent: 'flex-end' } }, btn('월별 조사하러 가기 ›', () => app.go('topics', 1, 'next'), { variant: 'small' })));
    api('GET', '/api/student/votes').then((r) => {
      const top = Object.entries(r.counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
      const total = Object.values(r.counts).reduce((a, b) => a + b, 0);
      res.replaceChildren(
        h('p', { class: 'small muted' }, `${r.total}명 중 ${total}명이 투표했어요.`),
        ...(top.length ? top.map(([id, n]) => h('div', { class: 'vote-bar' }, h('span', null, topicById(id).name), h('b', null, `${n}표`), h('div', { class: 'bar' }, h('i', { style: { width: `${(n / Math.max(1, top[0][1])) * 100}%` } })))) : [h('p', null, '아직 투표한 친구가 없어요.')]));
    }).catch(() => res.replaceChildren(h('p', { class: 'small' }, '투표 결과를 불러오지 못했어요.')));
  };
  return {
    folio: ['주제 고르기', '주제 살펴보기'],
    left: (el) => {
      const grid = h('div', { class: 'topic-grid' });
      const drawGrid = () => {
        const list = TOPICS.filter((t) => (cat === 'all' || t.cat === cat) && (!query || t.name.includes(query)));
        grid.replaceChildren(...list.map((t) => h('button', { class: 'topic-card', type: 'button', 'aria-pressed': String(t.id === selTopic), onClick: (e) => {
          selTopic = t.id; grid.querySelectorAll('.topic-card').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); drawRight();
          if (window.matchMedia('(max-width: 900px)').matches) rightEl.scrollIntoView({ behavior: 'smooth' });
        } },
        h('span', { class: 'flags' }, s.activeTopics.includes(t.id) ? h('span', { class: 'badge green' }, '조사 중') : null, d.vote === t.id ? h('span', { class: 'badge ok' }, '내 추천') : null),
        h('span', { class: 'no' }, `${t.id}번`), h('span', null, t.name), h('span', { class: 'unit' }, `단위: ${t.unit}`))));
        if (!list.length) grid.append(h('p', null, '찾는 주제가 없어요.'));
      };
      const tabs = h('div', { class: 'cat-tabs', role: 'tablist' });
      const drawTabs = () => tabs.replaceChildren(...[{ id: 'all', name: '전체 25' }, ...CATEGORIES].map((c) => h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': String(cat === c.id), onClick: () => { cat = c.id; drawTabs(); drawGrid(); } }, c.name)));
      drawTabs(); drawGrid();
      el.append(
        h('div', { class: 'page-head' }, icon('vote'), h('div', null, h('div', { class: 'kicker' }, '제2장 ①'), h('h2', null, '조사 주제 추천 투표'))),
        h('p', { class: 'small' }, '우리 반이 함께 조사하면 좋을 주제에 한 표를 던져요. 투표는 주제를 ', h('b', null, '추천'), '하는 활동이고, 실제로 조사할 주제는 선생님이 열어 줘요.'),
        h('input', { type: 'search', placeholder: '주제 찾기 (예: 운동)', value: query, 'aria-label': '주제 찾기', onInput: (e) => { query = e.target.value.trim(); drawGrid(); } }),
        tabs, grid);
    },
    right: (el) => { rightEl = el; drawRight(); },
  };
}

function surveySpread(app) {
  const d = S.data; const s = d.cls.settings;
  const active = s.activeTopics.map(topicById).filter(Boolean);
  if (!surveyTopic || !s.activeTopics.includes(surveyTopic)) surveyTopic = d.gates.research || active[0]?.id || null;
  let rightEl;
  const months = []; for (let m = s.monthFrom; m <= s.monthTo; m++) months.push(m);

  const drawRight = () => {
    const t = topicById(surveyTopic);
    if (!t) { rightEl.replaceChildren(h('div', { class: 'lock-page' }, h('div', null, sealImg('待'), h('p', null, '선생님이 우리 반 조사 주제를 열면 여기에서 월별 경험을 적을 수 있어요.')))); return; }
    const submitted = d.gates.submittedTopics.includes(t.id);
    const canEdit = s.surveyOpen && (!submitted || s.allowEdit);
    const saved = {}; d.responses.filter((r) => r.topic_id === t.id).forEach((r) => { saved[r.month] = { status: r.status, value: r.value, source: r.source }; });
    const draft = getBackup(`resp-${t.id}`);
    const E = {}; months.forEach((m) => { E[m] = { ...(saved[m] || { status: 'blank', value: '', source: 'memory' }), ...(draft?.[m] || {}) }; });
    const rows = h('div', { class: 'month-list' });
    const errBox = h('div', { role: 'alert' });
    const keep = () => backup(`resp-${t.id}`, E);
    const rowFor = (m) => {
      const e = E[m]; const mx = monthMax(t, m);
      const input = h('input', { type: 'number', inputmode: t.step < 1 ? 'decimal' : 'numeric', min: 0, max: mx, step: t.step, value: e.status === 'value' ? e.value : '', disabled: !canEdit || e.status === 'unknown', 'aria-label': `${m}월 ${t.unit}` });
      const msg = h('div', { class: 'msg err-text small' });
      const row = h('div', { class: `month-row ${e.status === 'unknown' ? 'unknown' : ''}` });
      const validate = () => {
        const err = e.status === 'value' ? validateEntry(t, m, e.value) : null;
        msg.textContent = err || ''; row.classList.toggle('bad', !!err); input.classList.toggle('err', !!err);
      };
      input.addEventListener('input', () => { e.value = input.value; e.status = input.value === '' ? 'blank' : 'value'; validate(); keep(); });
      const bump = (dv) => { if (!canEdit || e.status === 'unknown') return; const v = Math.max(0, Math.min(mx, Math.round(((Number(input.value) || 0) + dv) * 100) / 100)); input.value = v; e.value = v; e.status = 'value'; validate(); keep(); };
      const unkBtn = h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': String(e.status === 'unknown'), disabled: !canEdit, onClick: () => {
        e.status = e.status === 'unknown' ? (input.value === '' ? 'blank' : 'value') : 'unknown';
        unkBtn.setAttribute('aria-pressed', String(e.status === 'unknown')); input.disabled = e.status === 'unknown'; row.classList.toggle('unknown', e.status === 'unknown'); validate(); keep();
      } }, '기억나지 않음');
      const srcBtn = (val, label) => h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': String(e.source === val), disabled: !canEdit, onClick: (ev) => { e.source = val; ev.currentTarget.parentElement.querySelectorAll('[data-src]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.src === val))); keep(); }, 'data-src': val }, label);
      row.append(h('span', { class: 'm' }, `${m}월`),
        h('div', { class: 'num-input' }, h('button', { type: 'button', 'aria-label': '1 줄이기', disabled: !canEdit, onClick: () => bump(-t.step) }, '−'), input, h('button', { type: 'button', 'aria-label': '1 늘리기', disabled: !canEdit, onClick: () => bump(t.step) }, '+')),
        h('div', { class: 'opts' }, srcBtn('record', '실제 기록'), srcBtn('memory', '기억 추정'), unkBtn), msg);
      validate();
      return row;
    };
    months.forEach((m) => rows.append(rowFor(m)));
    rightEl.replaceChildren(
      h('div', { class: 'center' }, h('h2', { class: 'plaque' }, `${YEAR}년 나의 월별 기록`)),
      h('h3', null, t.name, ' ', h('span', { class: 'small muted' }, `(단위: ${t.unit})`)),
      t.hint ? h('div', { class: 'note gold small' }, t.hint) : null,
      h('p', { class: 'small' }, '0은 "한 번도 안 했어요", ', h('b', null, '기억나지 않음'), '은 "잘 모르겠어요"예요. 둘은 달라요. 일기나 기록장을 보고 적었으면 ', h('b', null, '실제 기록'), ', 떠올려서 어림했으면 ', h('b', null, '기억 추정'), '을 골라요.'),
      submitted ? h('div', { class: 'note green small' }, '✔ 제출했어요. ', canEdit ? '고친 뒤 다시 제출할 수 있어요.' : '지금은 고칠 수 없어요.') : null,
      !s.surveyOpen ? h('div', { class: 'note' }, '지금은 월별 조사 기간이 아니에요.') : null,
      rows, errBox,
      canEdit ? h('div', { class: 'row', style: { marginTop: '12px', justifyContent: 'flex-end' } }, btn(submitted ? '고친 내용 다시 제출' : '조사 제출하기', async () => {
        const entries = months.map((m) => ({ month: m, status: E[m].status, value: E[m].value === '' ? null : Number(E[m].value), source: E[m].source }));
        try {
          await api('PUT', '/api/student/responses', { topicId: t.id, entries });
          clearBackup(`resp-${t.id}`);
          await app.reload(false);
          toast('조사를 제출했어요! 우리 반 집계에 더해졌어요.', 'ok');
          app.refresh();
        } catch (ex) {
          const errs = ex.data?.errors || {};
          errBox.replaceChildren(h('div', { class: 'note' }, h('b', null, ex.message), Object.keys(errs).length ? h('ul', { class: 'issue-list' }, Object.entries(errs).map(([m, t2]) => h('li', null, `${m}월: ${t2}`))) : null));
          toast(ex.message, 'bad');
        }
      }, { variant: 'gold' })) : null);
  };

  return {
    folio: ['조사 주제', '월별 기록'],
    left: (el) => {
      el.append(
        h('div', { class: 'page-head' }, icon('book'), h('div', null, h('div', { class: 'kicker' }, '제2장 ②'), h('h2', null, `${YEAR}년 월별 경험 조사`))),
        h('p', { class: 'small' }, `선생님이 연 주제마다 ${s.monthFrom}월부터 ${s.monthTo}월까지 나의 경험을 적어요. 모든 친구의 응답이 모여 우리 반 자료가 돼요.`),
        active.length ? null : h('div', { class: 'note' }, '아직 선생님이 연 조사 주제가 없어요.'),
        h('div', { class: 'stack' }, active.map((t) => {
          const sub = d.gates.submittedTopics.includes(t.id);
          return h('button', { type: 'button', class: 'chapter-item', 'aria-pressed': String(t.id === surveyTopic), style: t.id === surveyTopic ? { boxShadow: '0 0 0 3px rgba(162,58,44,.45)', borderRadius: '6px' } : null, onClick: () => { surveyTopic = t.id; app.refresh(); } },
            h('img', { src: iconSrc(CATEGORIES.find((c) => c.id === t.cat).icon), alt: '' }),
            h('span', null, h('span', { class: 't', style: { fontSize: '1.05rem' } }, t.name), h('br'), h('span', { class: 'small muted' }, `단위: ${t.unit}`)),
            sub ? h('span', { class: 'badge ok' }, '제출함') : h('span', { class: 'badge warn' }, '아직'));
        })),
        active.length ? researchPicker(app, active) : null);
    },
    right: (el) => { rightEl = el; drawRight(); },
  };
}

function researchPicker(app, active) {
  const d = S.data; const s = d.cls.settings;
  const cur = d.gates.research;
  const choices = active.filter((t) => !(t.private && s.savingsMode === 'hidden'));
  return h('div', { class: 'panel', style: { marginTop: '14px' } },
    h('h3', null, '나의 연구 주제 정하기'),
    h('p', { class: 'small' }, '조사한 주제 중 하나를 골라 자료표와 꺾은선그래프로 나타내요. 그 주제의 월별 조사를 제출해야 다음 장이 열려요.'),
    h('select', { 'aria-label': '나의 연구 주제', onChange: async (e) => {
      if (!e.target.value) return;
      try { await saveState({ research: { topicId: Number(e.target.value) } }); await app.reload(false); toast('연구 주제를 정했어요.', 'ok'); app.refresh(); } catch (ex) { toast(ex.message, 'bad'); }
    } }, h('option', { value: '' }, '연구 주제 고르기'), choices.map((t) => h('option', { value: t.id, selected: cur === t.id ? true : undefined }, t.name))),
    cur ? h('div', { class: 'row', style: { marginTop: '10px' } }, d.gates.table ? h('span', { class: 'small muted' }, d.gates.table) : btn('자료표 만들러 가기 ›', () => app.go('table', 0, 'next'), { variant: 'small green' })) : null);
}
