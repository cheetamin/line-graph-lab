// 학생용 책: 상단 막대 + 장(章) 책갈피 + 책장 넘김 탐색
import { sealImg, h, A, icon, toast, iconSrc } from '../ui.js';
import { Book } from '../book.js';
import { S, loadStudent, saveUi } from '../store.js';
import { logout } from '../main.js';
import { makeHeader, deskProps, lanternImg, scene } from '../shell.js';
import { PageTurner } from '../pageturn.js';
import * as home from './home.js';
import * as weather from './weather.js';
import * as topics from './topics.js';
import * as table from './table.js';
import * as graphCh from './graphpage.js';
import * as gallery from './gallery.js';

export const CHAPTERS = [
  { key: 'home', label: '목차', icon: 'home', mod: home },
  { key: 'weather', label: '기상자료 탐험실', icon: 'weather', mod: weather },
  { key: 'topics', label: '주제 선택·투표', icon: 'vote', mod: topics },
  { key: 'table', label: '자료표 만들기', icon: 'table', mod: table },
  { key: 'graph', label: '꺾은선그래프 그리기', icon: 'graph', mod: graphCh },
  { key: 'gallery', label: '작품 전시관', icon: 'gallery', mod: gallery },
];

export function chapterDone(key) {
  const d = S.data; if (!d) return false;
  const g = d.gates;
  const topicWork = d.works.find((w) => w.kind === 'topic');
  if (key === 'weather') return g.weatherDone;
  if (key === 'topics') return d.vote !== null && g.research && g.submittedTopics.includes(g.research);
  if (key === 'table') return !!(g.research && d.state.tables?.[g.research]?.verified);
  if (key === 'graph') return !!topicWork && ['submitted', 'approved'].includes(topicWork.status);
  return false;
}
export const lockReason = (key) => (key === 'home' ? null : S.data.gates[key] || null);

export function lockedSpread(ch, reason, app) {
  return {
    left: (el) => el.append(h('div', { class: 'page-head' }, icon(ch.icon), h('h2', null, ch.label)), h('div', { class: 'divider' }), h('p', null, '이 장은 아직 열리지 않았어요.')),
    right: (el) => el.append(h('div', { class: 'lock-page' }, h('div', null,
      sealImg('封'),
      h('h3', null, '아직 봉인된 장이에요'), h('p', null, reason),
      h('button', { class: 'btn green', type: 'button', onClick: () => app.go('home', 0, 'prev') }, '목차로 돌아가기')))),
  };
}

export async function mountStudent(root) {
  await loadStudent();
  const d = S.data;
  const saveEl = h('span', { class: 'save-state', 'aria-live': 'polite' }, '저장됨 ✓');
  S.saveEl = saveEl;
  const top = makeHeader({
    onLogo: () => app.go('home', 0, 'prev'),
    right: [h('div', { class: 'hdr-name' }, h('span', { class: 'nm' }, d.cls.name), h('b', null, `${d.student.number}번 ${d.student.name}`)), h('div', { class: 'row', style: { gap: '6px', justifyContent: 'center' } }, saveEl, h('button', { class: 'top-btn', type: 'button', onClick: () => logout() }, '나가기'))],
  });
  const tabs = h('nav', { class: 'side-tabs', 'aria-label': '장 목록' });
  const book = new Book({ onPrev: () => app.step(-1), onNext: () => app.step(1) });
  const sceneEl = scene(top, h('main', { class: 'stage' }, h('div', { class: 'side-col' }, tabs, lanternImg()), book.wrap));
  root.append(sceneEl);
  book.turner = new PageTurner(sceneEl);
  window.__kglTurner = book.turner; // 자동 검증용
  deskProps(root);

  const app = {
    book, ch: 'home', idx: 0, list: [],
    get data() { return S.data; },
    chapter(key) { return CHAPTERS.find((c) => c.key === key); },
    build(key) {
      const ch = this.chapter(key);
      const reason = lockReason(key);
      if (reason) return [lockedSpread(ch, reason, this)];
      return ch.mod.spreads(this);
    },
    renderTabs() {
      tabs.replaceChildren(...CHAPTERS.map((c) => {
        const locked = !!lockReason(c.key);
        const done = chapterDone(c.key);
        return h('button', {
          class: `side-tab ${done ? 'done' : ''}`, type: 'button', 'aria-current': c.key === this.ch ? 'page' : undefined, 'aria-disabled': locked ? 'true' : undefined,
          title: locked ? lockReason(c.key) : c.label,
          onClick: () => { const cur = CHAPTERS.findIndex((x) => x.key === this.ch); const to = CHAPTERS.findIndex((x) => x.key === c.key); if (c.key === this.ch && this.idx === 0) return; const adjacent = to === cur + 1 && this.idx === this.list.length - 1; this.go(c.key, 0, adjacent ? 'next' : 'jump'); },
        }, h('img', { src: iconSrc(c.icon), alt: '' }), h('span', null, c.label), locked ? h('span', { class: 'lock', 'aria-label': '잠김' }, '🔒') : null, done ? h('span', { class: 'tick' }, '완료') : null);
      }));
    },
    spreadMeta(i) {
      const ci = CHAPTERS.findIndex((c) => c.key === this.ch);
      const hasPrev = i > 0 || ci > 0;
      const hasNext = i < this.list.length - 1 || ci < CHAPTERS.length - 1;
      const nextName = i < this.list.length - 1 ? '다음 쪽' : CHAPTERS[ci + 1]?.label;
      const prevName = i > 0 ? '이전 쪽' : CHAPTERS[ci - 1]?.label;
      return { canPrev: hasPrev, canNext: hasNext, prevText: prevName, nextText: nextName };
    },
    async go(key, idx = 0, dir = 'next', { keepScroll = false } = {}) {
      if (book.busy) return;
      const reason = lockReason(key);
      if (reason && key !== this.ch) toast(reason, 'bad');
      this.ch = key;
      this.list = this.build(key);
      this.idx = idx < 0 ? this.list.length - 1 : Math.min(idx, this.list.length - 1);
      const sp = { ...this.list[this.idx], ...this.spreadMeta(this.idx) };
      sp.folio = sp.folio || [`${this.chapter(key).label}`, `${this.idx * 2 + 2}`];
      sp.dots = this.list.length > 1 ? { count: this.list.length, index: this.idx, onPick: (i) => i !== this.idx && this.go(key, i, Math.abs(i - this.idx) === 1 ? (i > this.idx ? 'next' : 'prev') : 'jump') } : null;
      const sL = book.leftScroll?.scrollTop || 0; const sR = book.rightScroll?.scrollTop || 0; const sW = window.scrollY;
      await book.show(sp, keepScroll ? null : dir);
      if (this.queue.length && !keepScroll) { const d = this.queue.shift(); setTimeout(() => this.stepNow(d), 0); }
      if (keepScroll) { book.leftScroll.scrollTop = sL; book.rightScroll.scrollTop = sR; window.scrollTo(0, sW); }
      this.renderTabs();
      try { history.replaceState(null, '', `#${key}-${this.idx}`); } catch { /* */ }
      saveUi(key, this.idx);
    },
    queue: [],
    step(delta) {
      // 재생 중에는 중복 클릭을 받지 않음
      if (book.busy) return;
      return this.stepNow(delta);
    },
    stepNow(delta) {
      const ci = CHAPTERS.findIndex((c) => c.key === this.ch);
      const ni = this.idx + delta;
      if (ni >= 0 && ni < this.list.length) return this.go(this.ch, ni, delta > 0 ? 'next' : 'prev');
      const nc = CHAPTERS[ci + delta];
      if (!nc) return;
      const reason = lockReason(nc.key);
      if (reason) { this.queue = []; toast(reason, 'bad'); return; }
      return this.go(nc.key, delta > 0 ? 0 : -1, delta > 0 ? 'next' : 'prev');
    },
    refresh() { return this.go(this.ch, this.idx, null, { keepScroll: true }); },
    async reload(keep = true) { await loadStudent(); if (keep) return this.refresh(); return null; },
  };

  // 이전 위치 복원: 주소(#장-쪽) → 서버에 저장된 위치 → 목차
  let start = { ch: 'home', idx: 0 };
  const m = location.hash.match(/^#([a-z]+)-(\d+)$/);
  if (m && CHAPTERS.some((c) => c.key === m[1])) start = { ch: m[1], idx: +m[2] };
  else if (d.state.ui?.chapter && CHAPTERS.some((c) => c.key === d.state.ui.chapter)) start = { ch: d.state.ui.chapter, idx: d.state.ui.spread || 0 };
  if (lockReason(start.ch)) start = { ch: 'home', idx: 0 };
  await app.go(start.ch, start.idx, null);
  if (start.ch !== 'home') toast('지난번에 하던 쪽을 펼쳤어요.', 'ok');
  window.addEventListener('hashchange', () => {
    const mm = location.hash.match(/^#([a-z]+)-(\d+)$/);
    if (mm && (mm[1] !== app.ch || +mm[2] !== app.idx) && CHAPTERS.some((c) => c.key === mm[1])) app.go(mm[1], +mm[2], 'jump');
  });
}
