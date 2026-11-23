// 꺾은선그래프 모눈종이: 정적 그리기 + 학생이 직접 점 찍고 선 잇는 편집기
import { s, h } from './ui.js?v=mwt4rdkx';
import { snapStep, MAJOR, MAX_CELLS, SCALE_OPTIONS, koNum } from '../shared/topics.js?v=mwt4rdkx';

// scale = 작은 눈금 한 칸(점선 한 칸)의 크기. 작은 칸 MAJOR(5)개가 모여 큰 눈금(실선) 한 칸이 되고, 큰 눈금마다 수를 적어요.
export function layout({ labels, scale, yStart = 0, maxV = 0, title = '' }) {
  const n = labels.length;
  const hasScale = !!scale;
  let cells = hasScale ? Math.ceil((Math.ceil((Math.max(maxV, yStart) - yStart) / scale - 1e-9) + 1) / MAJOR) * MAJOR : 10;
  const tooMany = cells > MAX_CELLS;
  cells = Math.min(MAX_CELLS, Math.max(MAJOR, cells));
  const rowH = cells <= 10 ? 30 : cells <= 20 ? 20 : cells <= 30 ? 15 : cells <= 45 ? 11 : 9;
  const wave = yStart > 0 ? 1 : 0;
  const waveH = wave ? Math.max(22, rowH * 2) : 0;
  const topVal = hasScale ? yStart + cells * scale : 0;
  const labelChars = hasScale ? Math.max(String(topVal.toLocaleString()).length, 2) : 2;
  const ml = 46 + labelChars * 9;
  const colW = n > 8 ? 54 : 84;
  const mt = title ? 72 : 46; const mb = 70; const mr = 52;
  const plotW = colW * n;
  const plotH = rowH * cells + waveH;
  const W = ml + plotW + mr; const H = mt + plotH + mb;
  const x = (i) => ml + colW * (i + 0.5);
  const baseY = mt + plotH;
  const y = (v) => baseY - waveH - ((v - yStart) / scale) * rowH;
  const v = (py) => yStart + ((baseY - waveH - py) / rowH) * scale;
  return { n, cells, rowH, colW, ml, mt, mb, mr, plotW, plotH, W, H, x, y, v, baseY, wave, waveH, hasScale, tooMany, scale, yStart, topVal };
}

export function drawFrame(svg, L, d, { labels }) {
  svg.setAttribute('viewBox', `0 0 ${L.W} ${L.H}`);
  const g = s('g');
  const left = L.ml; const right = L.ml + L.plotW; const top = L.mt; const bottom = L.baseY;
  g.append(s('rect', { x: left, y: top, width: L.plotW, height: L.plotH, fill: '#fffdf6' }));
  // 가로 눈금: 작은 눈금(점선)마다, 큰 눈금(실선·수)은 작은 칸 5개마다
  for (let k = 0; k <= L.cells; k++) {
    const yy = L.hasScale ? L.y(L.yStart + k * L.scale) : bottom - L.waveH - k * L.rowH;
    const major = k % MAJOR === 0;
    g.append(s('line', { x1: left, x2: right, y1: yy, y2: yy, class: major ? 'g-grid' : 'g-grid minor' }));
    if (L.hasScale && major) {
      const val = L.yStart + k * L.scale;
      g.append(s('text', { x: left - 8, y: yy + 5, 'text-anchor': 'end', class: 'g-label' }, Number(val.toFixed(2)).toLocaleString()));
      if (val >= 10000) g.append(s('text', { x: left - 8, y: yy + 19, 'text-anchor': 'end', class: 'g-label g-label-ko' }, `(${koNum(Math.round(val))})`));
    }
  }
  for (let i = 0; i < L.n; i++) {
    g.append(s('line', { x1: L.x(i), x2: L.x(i), y1: top, y2: bottom, class: 'g-grid col' }));
    g.append(s('text', { x: L.x(i), y: bottom + 24, 'text-anchor': 'middle', class: 'g-label' }, labels[i]));
  }
  // 물결선
  if (L.wave && L.hasScale) {
    const y0 = bottom; const y1 = bottom - L.waveH;
    g.append(s('text', { x: left - 8, y: y0 + 5, 'text-anchor': 'end', class: 'g-label' }, '0'));
    const mid = (y0 + y1) / 2;
    g.append(s('path', { d: `M${left - 10} ${mid + 3} q 5 -8 10 0 t 10 0`, stroke: '#2a1c12', 'stroke-width': 2, fill: 'none' }));
    g.append(s('path', { d: `M${left - 10} ${mid + 9} q 5 -8 10 0 t 10 0`, stroke: '#2a1c12', 'stroke-width': 2, fill: 'none' }));
    g.append(s('rect', { x: left - 2, y: mid + 3, width: 4, height: 6, fill: '#fffdf6' }));
  }
  // 축
  g.append(s('line', { x1: left, x2: left, y1: top - 12, y2: bottom, class: 'g-axis' }));
  g.append(s('line', { x1: left, x2: right + 18, y1: bottom, y2: bottom, class: 'g-axis' }));
  // 단위·이름
  if (d.yUnit) g.append(s('text', { x: left - 6, y: top - 18, 'text-anchor': 'end', class: 'g-name' }, `(${d.yUnit})`));
  if (d.xUnit) g.append(s('text', { x: right + 22, y: bottom + 24, 'text-anchor': 'start', class: 'g-name' }, `(${d.xUnit})`));
  if (d.yName) g.append(s('text', { x: 16, y: top + L.plotH / 2, 'text-anchor': 'middle', class: 'g-name', transform: `rotate(-90 16 ${top + L.plotH / 2})` }, d.yName));
  if (d.xName) g.append(s('text', { x: left + L.plotW / 2, y: bottom + 54, 'text-anchor': 'middle', class: 'g-name' }, d.xName));
  if (d.title) g.append(s('text', { x: left + L.plotW / 2, y: 30, 'text-anchor': 'middle', class: 'g-title' }, d.title));
  svg.append(g);
  return g;
}

function maxOf(values, points) {
  const vs = [...(values || []), ...Object.values(points || {})].filter((x) => x !== null && x !== undefined && x !== '').map(Number);
  return vs.length ? Math.max(...vs) : 0;
}

// 정적 그래프(전시관, 검토용)
export function renderStatic(d, { showValues = false, answer = null, mini = false } = {}) {
  const labels = d.labels || [];
  const svg = s('svg', { role: 'img', 'aria-label': d.title || '꺾은선그래프', preserveAspectRatio: 'xMidYMid meet' });
  if (mini) {
    const vals = labels.map((_, i) => (d.points?.[i] ?? d.values?.[i] ?? null));
    const fin = vals.filter((v) => v !== null).map(Number);
    const mx = Math.max(1, ...fin); const mn = Math.min(0, ...fin);
    svg.setAttribute('viewBox', '0 0 200 60');
    const px = (i) => 8 + (i * 184) / Math.max(1, labels.length - 1);
    const py = (v) => 54 - ((v - mn) / (mx - mn || 1)) * 46;
    svg.append(s('line', { x1: 6, y1: 56, x2: 196, y2: 56, stroke: '#8f6f47' }));
    let dd = '';
    vals.forEach((v, i) => { if (v !== null) dd += `${dd ? 'L' : 'M'}${px(i)} ${py(v)} `; });
    svg.append(s('path', { d: dd, stroke: '#7b2620', 'stroke-width': 2.5, fill: 'none' }));
    vals.forEach((v, i) => { if (v !== null) svg.append(s('circle', { cx: px(i), cy: py(v), r: 3, fill: '#7b2620' })); });
    return svg;
  }
  const L = layout({ labels, scale: d.scale || autoScale(maxOf(d.values, d.points)), yStart: d.yStart || 0, maxV: maxOf(d.values, d.points), title: d.title });
  drawFrame(svg, L, d, { labels });
  const pts = d.points || {};
  for (const [a, b] of d.segments || []) {
    if (pts[a] === undefined || pts[b] === undefined) continue;
    svg.append(s('line', { x1: L.x(a), y1: L.y(pts[a]), x2: L.x(b), y2: L.y(pts[b]), class: 'g-seg' }));
  }
  for (const [k, v] of Object.entries(pts)) {
    svg.append(s('circle', { cx: L.x(+k), cy: L.y(v), r: 6, class: 'g-point' }));
    if (showValues) svg.append(s('text', { x: L.x(+k), y: L.y(v) - 12, 'text-anchor': 'middle', class: 'g-value' }, Number(v).toLocaleString()));
  }
  if (answer) drawAnswer(svg, L, answer);
  svg.style.width = '100%';
  svg.style.height = 'auto';
  return svg;
}

function drawAnswer(svg, L, values) {
  let dd = '';
  values.forEach((v, i) => { if (v !== null) dd += `${dd ? 'L' : 'M'}${L.x(i)} ${L.y(v)} `; });
  svg.append(s('path', { d: dd, class: 'g-answer' }));
  values.forEach((v, i) => { if (v !== null) svg.append(s('rect', { x: L.x(i) - 4, y: L.y(v) - 4, width: 8, height: 8, class: 'g-answer-pt' })); });
}

export function autoScale(maxV) {
  return SCALE_OPTIONS.find((o) => maxV / o <= 25) || SCALE_OPTIONS[SCALE_OPTIONS.length - 1];
}

const ICON = {
  point: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" fill="currentColor"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5" stroke="currentColor" stroke-width="2"/></svg>',
  line: '<svg viewBox="0 0 24 24"><circle cx="5" cy="17" r="3" fill="currentColor"/><circle cx="19" cy="7" r="3" fill="currentColor"/><path d="M5 17L19 7" stroke="currentColor" stroke-width="2.5"/></svg>',
  erase: '<svg viewBox="0 0 24 24"><path d="M4 16l8-8 6 6-5 5H8z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 20h10" stroke="currentColor" stroke-width="2"/></svg>',
  move: '<svg viewBox="0 0 24 24"><path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3" stroke="currentColor" stroke-width="1.8" fill="none"/></svg>',
  undo: '<svg viewBox="0 0 24 24"><path d="M9 7L4 12l5 5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 12h10a6 6 0 010 12" fill="none" stroke="currentColor" stroke-width="2" transform="translate(0 -6)"/></svg>',
  redo: '<svg viewBox="0 0 24 24" style="transform:scaleX(-1)"><path d="M9 7L4 12l5 5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 12h10a6 6 0 010 12" fill="none" stroke="currentColor" stroke-width="2" transform="translate(0 -6)"/></svg>',
  zin: '<svg viewBox="0 0 24 24"><circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15 15l6 6M7 10h6M10 7v6" stroke="currentColor" stroke-width="2"/></svg>',
  zout: '<svg viewBox="0 0 24 24"><circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15 15l6 6M7 10h6" stroke="currentColor" stroke-width="2"/></svg>',
  clear: '<svg viewBox="0 0 24 24"><path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
};
const toolBtn = (key, label, onClick, pressed) => h('button', { type: 'button', class: 'tool-btn', 'aria-pressed': pressed === undefined ? undefined : String(pressed), onClick, html: `${ICON[key]}<span>${label}</span>`, title: label });

// 직접 그리기 편집기
export class GraphEditor {
  constructor({ labels, getData, onChange, readOnly = false }) {
    this.labels = labels;
    this.getData = getData; // () => 현재 작품 데이터(제목, 축, 눈금, 점, 선)
    this.onChange = onChange;
    this.readOnly = readOnly;
    this.mode = 'point';
    this.sel = null;
    this.undoStack = []; this.redoStack = [];
    this.wrongLabels = [];
    this.answer = null;
    this.zoom = 1;
    this.pointers = new Map();
    this.el = this.build();
    window.__editor = this; // 자동 검증용 연결
  }
  get d() { return this.getData(); }

  build() {
    this.svg = s('svg', { role: 'application', 'aria-label': '꺾은선그래프 모눈종이. 점 찍기 모드에서 누르면 점이 찍혀요.', tabindex: '0' });
    this.scroll = h('div', { class: 'graph-scroll' }, this.svg);
    this.hint = h('div', { class: 'graph-hint', 'aria-live': 'polite' });
    this.btns = {
      point: toolBtn('point', '점 찍기', () => this.setMode('point'), true),
      line: toolBtn('line', '선 잇기', () => this.setMode('line'), false),
      erase: toolBtn('erase', '지우개', () => this.setMode('erase'), false),
      move: toolBtn('move', '화면 이동', () => this.setMode('move'), false),
      undo: toolBtn('undo', '되돌리기', () => this.undo()),
      redo: toolBtn('redo', '다시하기', () => this.redo()),
      zin: toolBtn('zin', '확대', () => this.setZoom(this.zoom * 1.25)),
      zout: toolBtn('zout', '축소', () => this.setZoom(this.zoom / 1.25)),
      fit: toolBtn('move', '화면 맞춤', () => { this.fitted = false; this.render(); }),
      clear: toolBtn('clear', '모두 지우기', () => this.clearAll()),
    };
    const bar = h('div', { class: 'toolbar', role: 'toolbar', 'aria-label': '그리기 도구' },
      this.btns.point, this.btns.line, this.btns.erase, this.btns.move, h('span', { class: 'sep' }),
      this.btns.undo, this.btns.redo, h('span', { class: 'sep' }), this.btns.zout, this.btns.zin, this.btns.fit, this.btns.clear);
    if (this.readOnly) bar.classList.add('hidden');
    this.svg.addEventListener('pointerdown', (e) => this.down(e));
    this.svg.addEventListener('pointermove', (e) => this.move(e));
    this.svg.addEventListener('pointerup', (e) => this.up(e));
    this.svg.addEventListener('pointercancel', (e) => this.cancel(e));
    this.svg.addEventListener('keydown', (e) => this.key(e));
    this.scroll.addEventListener('wheel', (e) => { if (e.ctrlKey) { e.preventDefault(); this.setZoom(this.zoom * (e.deltaY < 0 ? 1.1 : 0.9)); } }, { passive: false });
    this.kbIndex = 0;
    return h('div', { class: 'graph-shell' }, bar, h('div', { class: 'graph-frame' }, this.scroll), this.hint);
  }

  setMode(m) {
    this.mode = m; this.sel = null;
    for (const k of ['point', 'line', 'erase', 'move']) this.btns[k].setAttribute('aria-pressed', String(k === m));
    this.scroll.classList.toggle('pan', m === 'move');
    this.setHint({
      point: '모눈종이를 눌러 자료값에 맞는 곳에 점을 찍어요. 누른 채로 움직이면 위치를 고칠 수 있어요.',
      line: '점을 하나 누르고, 이어질 다음 점을 눌러 선분으로 이어요. (점에서 점으로 끌어도 돼요.)',
      erase: '지울 점이나 선분을 눌러요.',
      move: '손가락이나 마우스로 모눈종이를 움직여 볼 수 있어요.',
    }[m]);
    this.render();
  }
  setHint(t) { this.hint.textContent = t; }
  setZoom(z) {
    this.zoom = Math.min(3, Math.max(0.45, z));
    this.render();
  }

  snapshot() { const d = this.d; return JSON.stringify({ points: d.points || {}, segments: d.segments || [] }); }
  push() { this.undoStack.push(this.snapshot()); if (this.undoStack.length > 100) this.undoStack.shift(); this.redoStack = []; }
  restore(snap) { const o = JSON.parse(snap); this.onChange({ points: o.points, segments: o.segments }); this.render(); }
  undo() { if (!this.undoStack.length) return; this.redoStack.push(this.snapshot()); this.restore(this.undoStack.pop()); }
  redo() { if (!this.redoStack.length) return; this.undoStack.push(this.snapshot()); this.restore(this.redoStack.pop()); }
  async clearAll() {
    const { confirmBox } = await import('./ui.js?v=mwt4rdkx');
    if (!(await confirmBox('모두 지우기', '찍은 점과 선분을 모두 지울까요? (되돌리기로 다시 살릴 수 있어요)', '모두 지우기'))) return;
    this.push(); this.onChange({ points: {}, segments: [] }); this.render();
  }

  L() {
    const d = this.d;
    const vals = Object.values(d.points || {}).map(Number);
    const maxV = Math.max(d.maxValue ?? 0, ...vals, 0);
    return layout({ labels: this.labels, scale: d.scale, yStart: d.yStart || 0, maxV, title: d.title });
  }

  render() {
    const d = this.d;
    const L = this.L();
    const key = `${L.W}x${L.H}`;
    if (this.lastKey && this.lastKey !== key) this.fitted = false;
    this.lastKey = key;
    this.Lc = L;
    this.svg.replaceChildren();
    drawFrame(this.svg, L, d, { labels: this.labels });
    if (!this.fitted && this.scroll.clientWidth > 0) {
      this.fitted = true;
      const mh = parseFloat(getComputedStyle(this.scroll).maxHeight) || Infinity;
      this.zoom = Math.min(1.4, Math.max(0.45, Math.min((this.scroll.clientWidth - 4) / L.W, (mh - 4) / L.H)));
    }
    this.svg.style.width = `${L.W * this.zoom}px`;
    this.svg.style.height = `${L.H * this.zoom}px`;
    if (!L.hasScale) {
      this.svg.append(s('text', { x: L.ml + L.plotW / 2, y: L.mt + L.plotH / 2, 'text-anchor': 'middle', class: 'g-name' }, '먼저 세로 눈금 한 칸의 크기를 정해요.'));
      return;
    }
    const pts = d.points || {};
    const segLayer = s('g'); const ptLayer = s('g');
    for (const [a, b] of d.segments || []) {
      if (pts[a] === undefined || pts[b] === undefined) continue;
      const bad = Math.abs(a - b) !== 1;
      segLayer.append(s('line', { x1: L.x(a), y1: L.y(pts[a]), x2: L.x(b), y2: L.y(pts[b]), class: `g-seg ${bad ? 'wrong' : ''}`, 'data-seg': `${a}-${b}` }));
    }
    for (const [k, v] of Object.entries(pts)) {
      const i = +k;
      const wrong = this.wrongLabels.includes(this.labels[i]);
      ptLayer.append(s('circle', { cx: L.x(i), cy: L.y(v), r: 15, fill: 'transparent', 'data-pt': i }));
      ptLayer.append(s('circle', { cx: L.x(i), cy: L.y(v), r: this.sel === i ? 9 : 7, class: `g-point ${this.sel === i ? 'sel' : ''} ${wrong ? 'wrong' : ''}`, 'data-pt': i, 'pointer-events': 'none' }));
    }
    this.svg.append(segLayer, ptLayer);
    if (this.answer) drawAnswer(this.svg, L, this.answer);
    if (this.ghost) this.drawGhost(L);
    if (this.rubber) {
      this.svg.append(s('line', { x1: L.x(this.rubber.from), y1: L.y(pts[this.rubber.from]), x2: this.rubber.x, y2: this.rubber.y, class: 'g-seg', opacity: 0.5, 'stroke-dasharray': '6 4' }));
    }
    if (this.kbFocus && !this.readOnly) {
      this.svg.append(s('rect', { x: L.x(this.kbIndex) - 12, y: L.mt, width: 24, height: L.plotH, fill: 'rgba(231,164,60,.15)', stroke: '#e7a43c', 'stroke-dasharray': '4 3' }));
    }
  }

  drawGhost(L) {
    const { i, v } = this.ghost;
    const gx = L.x(i); const gy = L.y(v);
    this.svg.append(s('line', { x1: L.ml, y1: gy, x2: gx, y2: gy, class: 'g-guide' }));
    this.svg.append(s('line', { x1: gx, y1: gy, x2: gx, y2: L.baseY, class: 'g-guide' }));
    this.svg.append(s('circle', { cx: gx, cy: gy, r: 9, class: 'g-ghost' }));
    const label = `${this.labels[i]} · ${Number(v.toFixed(2)).toLocaleString()}${this.d.yUnit || ''}${v >= 10000 ? ` (${koNum(Math.round(v))})` : ''}`;
    const w = label.length * 9 + 20;
    const bx = Math.min(Math.max(gx - w / 2, 4), L.W - w - 4);
    const by = Math.max(gy - 62, 4);
    this.svg.append(s('g', { class: 'g-bubble' }, s('rect', { x: bx, y: by, width: w, height: 30, rx: 6 }), s('text', { x: bx + w / 2, y: by + 20, 'text-anchor': 'middle' }, label)));
  }

  toSvg(e) {
    const pt = this.svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(this.svg.getScreenCTM().inverse());
  }
  hitPoint(p, radius = 22) {
    const L = this.Lc; const pts = this.d.points || {};
    let best = null; let bd = Infinity;
    for (const [k, v] of Object.entries(pts)) {
      const dx = L.x(+k) - p.x; const dy = L.y(v) - p.y; const dist = Math.hypot(dx, dy);
      if (dist < bd) { bd = dist; best = +k; }
    }
    return bd <= radius / Math.min(1, this.zoom) ? best : null;
  }
  hitSegment(p) {
    const L = this.Lc; const pts = this.d.points || {};
    for (const [a, b] of this.d.segments || []) {
      if (pts[a] === undefined || pts[b] === undefined) continue;
      const x1 = L.x(a); const y1 = L.y(pts[a]); const x2 = L.x(b); const y2 = L.y(pts[b]);
      const t = Math.max(0, Math.min(1, ((p.x - x1) * (x2 - x1) + (p.y - y1) * (y2 - y1)) / ((x2 - x1) ** 2 + (y2 - y1) ** 2)));
      if (Math.hypot(p.x - (x1 + t * (x2 - x1)), p.y - (y1 + t * (y2 - y1))) < 12) return [a, b];
    }
    return null;
  }
  locate(p) {
    const L = this.Lc;
    const i = Math.round((p.x - L.ml) / L.colW - 0.5);
    if (i < 0 || i >= L.n) return null;
    if (p.y < L.mt - 10 || p.y > L.baseY + 10) return null;
    const step = snapStep(L.scale);
    let v = Math.round(L.v(p.y) / step) * step;
    const maxV = L.yStart + L.cells * L.scale;
    v = Math.max(L.yStart, Math.min(maxV, v));
    if (L.wave && L.v(p.y) < L.yStart - L.scale * 0.5) return null;
    return { i, v: Math.round(v * 100) / 100 };
  }

  down(e) {
    if (this.readOnly || this.mode === 'move' || !this.Lc?.hasScale) return;
    this.pointers.set(e.pointerId, e);
    if (this.pointers.size > 1) { this.ghost = null; this.rubber = null; this.render(); return; } // 두 손가락: 확대
    e.preventDefault();
    this.svg.setPointerCapture?.(e.pointerId);
    const p = this.toSvg(e);
    if (this.mode === 'point') {
      const loc = this.locate(p);
      if (!loc) return;
      this.ghost = loc; this.render();
    } else if (this.mode === 'line') {
      const k = this.hitPoint(p);
      if (k === null) { this.sel = null; this.render(); this.setHint('점이 있는 곳을 눌러요. 먼저 점을 찍어야 선분으로 이을 수 있어요.'); return; }
      if (this.sel !== null && this.sel !== k) { this.connect(this.sel, k); this.sel = k; this.render(); return; }
      this.sel = k; this.rubber = { from: k, x: p.x, y: p.y }; this.render();
      this.setHint(`${this.labels[k]}의 점을 골랐어요. 이어질 점을 누르거나 그 점까지 끌어요.`);
    } else if (this.mode === 'erase') {
      const k = this.hitPoint(p, 16);
      if (k !== null) {
        this.push();
        const pts = { ...this.d.points }; delete pts[k];
        this.onChange({ points: pts, segments: (this.d.segments || []).filter(([a, b]) => a !== k && b !== k) });
        this.setHint(`${this.labels[k]}의 점과 이어진 선분을 지웠어요.`); this.render(); return;
      }
      const sg = this.hitSegment(p);
      if (sg) {
        this.push();
        this.onChange({ segments: (this.d.segments || []).filter(([a, b]) => !(a === sg[0] && b === sg[1])) });
        this.setHint(`${this.labels[sg[0]]}–${this.labels[sg[1]]} 선분을 지웠어요.`); this.render();
      }
    }
  }
  move(e) {
    if (this.pointers.has(e.pointerId)) {
      const prev = this.pointers.get(e.pointerId);
      this.pointers.set(e.pointerId, e);
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        const other = [...this.pointers.values()].find((x) => x.pointerId !== e.pointerId);
        const d0 = Math.hypot(prev.clientX - other.clientX, prev.clientY - other.clientY);
        const d1 = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        if (d0 > 0) this.setZoom(this.zoom * (d1 / d0));
        return;
      }
    }
    if (this.readOnly) return;
    if (this.ghost) {
      const loc = this.locate(this.toSvg(e));
      if (loc) { this.ghost = loc; this.render(); }
    } else if (this.rubber) {
      const p = this.toSvg(e); this.rubber.x = p.x; this.rubber.y = p.y; this.render();
    }
  }
  up(e) {
    this.pointers.delete(e.pointerId);
    if (this.ghost) {
      const { i, v } = this.ghost; this.ghost = null;
      const pts = { ...(this.d.points || {}) };
      if (pts[i] !== v) {
        this.push(); pts[i] = v; this.onChange({ points: pts });
        this.setHint(`${this.labels[i]}에 ${v.toLocaleString()}${this.d.yUnit || ''}${v >= 10000 ? `(약 ${koNum(Math.round(v))})` : ''} 위치로 점을 찍었어요.`);
      }
      this.render();
    } else if (this.rubber) {
      const from = this.rubber.from; this.rubber = null;
      const k = this.hitPoint(this.toSvg(e));
      if (k !== null && k !== from) { this.connect(from, k); this.sel = k; }
      this.render();
    }
  }
  cancel(e) { this.pointers.delete(e.pointerId); this.ghost = null; this.rubber = null; this.render(); }
  connect(a, b) {
    const key = [Math.min(a, b), Math.max(a, b)];
    const segs = this.d.segments || [];
    if (segs.some((x) => x[0] === key[0] && x[1] === key[1])) { this.setHint('이미 이어진 선분이에요.'); return; }
    this.push();
    this.onChange({ segments: [...segs, key] });
    this.setHint(Math.abs(a - b) === 1 ? `${this.labels[key[0]]}과(와) ${this.labels[key[1]]}의 점을 이었어요. 다음 점을 눌러 계속 이어요.` : '이웃하지 않은 점을 이었어요. 꺾은선그래프는 이웃한 점끼리 순서대로 이어요.');
  }

  // 키보드로도 점 찍기(접근성): ←→ 월 이동, ↑↓ 값 이동, Enter 점, Delete 지우기
  key(e) {
    if (this.readOnly || !this.Lc?.hasScale) return;
    const L = this.Lc; const step = snapStep(L.scale);
    const pts = { ...(this.d.points || {}) };
    this.kbFocus = true;
    let cur = pts[this.kbIndex] ?? L.yStart;
    if (e.key === 'ArrowRight') this.kbIndex = Math.min(L.n - 1, this.kbIndex + 1);
    else if (e.key === 'ArrowLeft') this.kbIndex = Math.max(0, this.kbIndex - 1);
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      cur = Math.max(L.yStart, Math.min(L.yStart + L.cells * L.scale, cur + (e.key === 'ArrowUp' ? step : -step)));
      this.push(); pts[this.kbIndex] = Math.round(cur * 100) / 100; this.onChange({ points: pts });
    } else if (e.key === 'Enter' && this.kbIndex > 0 && pts[this.kbIndex] !== undefined && pts[this.kbIndex - 1] !== undefined) {
      this.connect(this.kbIndex - 1, this.kbIndex);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      this.push(); delete pts[this.kbIndex];
      this.onChange({ points: pts, segments: (this.d.segments || []).filter(([a, b]) => a !== this.kbIndex && b !== this.kbIndex) });
    } else return;
    e.preventDefault();
    const v = (this.d.points || {})[this.kbIndex];
    this.setHint(`${this.labels[this.kbIndex]}: ${v === undefined ? '점 없음' : v.toLocaleString() + (this.d.yUnit || '')} (↑↓ 값, ←→ 이동, Enter 앞 점과 잇기)`);
    this.render();
  }
}
