// 고서 책 틀과 책장 넘김 애니메이션
import { h, ART, reducedMotion, isNarrow } from './ui.js';

function clonePage(el) {
  const c = el.cloneNode(true);
  c.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
  c.removeAttribute('id');
  c.setAttribute('aria-hidden', 'true');
  c.inert = true;
  // 입력값 복사(복제본에서도 같은 글자가 보이도록)
  const src = el.querySelectorAll('input, textarea, select');
  const dst = c.querySelectorAll('input, textarea, select');
  src.forEach((n, i) => { if (dst[i]) { if (n.type === 'checkbox' || n.type === 'radio') dst[i].checked = n.checked; else dst[i].value = n.value; } });
  return c;
}

export class Book {
  constructor({ onPrev, onNext }) {
    this.onPrev = onPrev; this.onNext = onNext;
    this.left = h('section', { class: 'page left', 'aria-label': '왼쪽 쪽' });
    this.right = h('section', { class: 'page right', 'aria-label': '오른쪽 쪽' });
    this.prevBtn = h('button', { class: 'flip-btn prev', type: 'button', 'aria-label': '이전 쪽으로 넘기기', onClick: () => this.onPrev() }, h('img', { src: ART('arrow_prev'), alt: '' }));
    this.nextBtn = h('button', { class: 'flip-btn next', type: 'button', 'aria-label': '다음 쪽으로 넘기기', onClick: () => this.onNext() }, h('img', { src: ART('arrow_next'), alt: '' }));
    this.prevLabel = h('div', { class: 'flip-label prev' });
    this.nextLabel = h('div', { class: 'flip-label next' });
    this.dots = h('div', { class: 'dots', role: 'tablist', 'aria-label': '쪽 표시' });
    this.el = h('div', { class: 'book', id: 'book' }, this.left, this.right, this.dots);
    this.wrap = h('div', { class: 'book-wrap' }, this.el, this.prevBtn, this.nextBtn, this.prevLabel, this.nextLabel);
    this.busy = false;
    document.addEventListener('keydown', (e) => {
      if (e.target.closest('input, textarea, select, [role=application]') || document.querySelector('.modal-back')) return;
      if (e.key === 'PageDown' || (e.altKey && e.key === 'ArrowRight')) { e.preventDefault(); this.onNext(); }
      if (e.key === 'PageUp' || (e.altKey && e.key === 'ArrowLeft')) { e.preventDefault(); this.onPrev(); }
    });
  }

  // 한 쪽의 내용 묶음(스크롤 영역 + 모서리 장식 + 쪽수)을 만듭니다. 실제 쪽에 붙이거나, 넘김이 끝날 때까지 따로 보관합니다.
  buildSide(fn, folio, side) {
    const inner = h('div', { class: 'page-inner' });
    const scroll = h('div', { class: 'page-scroll' }, inner);
    const body = h('div', { class: 'page-body' }, scroll,
      h('img', { class: 'corner tl', src: ART('frame_corner'), alt: '' }),
      h('img', { class: 'corner br', src: ART('frame_corner'), alt: '' }),
      folio ? h('div', { class: `folio ${side === 'left' ? 'l' : 'r'}` }, folio) : null);
    return { body, scroll, inner, fn };
  }

  setChrome(spread) {
    this.prevBtn.disabled = !spread.canPrev; this.nextBtn.disabled = !spread.canNext;
    this.prevLabel.textContent = spread.canPrev ? spread.prevText || '이전' : '';
    this.nextLabel.textContent = spread.canNext ? spread.nextText || '다음' : '';
    this.dots.replaceChildren();
    if (spread.dots && spread.dots.count > 1) {
      for (let i = 0; i < spread.dots.count; i++) {
        this.dots.append(h('button', { type: 'button', role: 'tab', 'aria-label': `${i + 1}쪽`, 'aria-current': String(i === spread.dots.index), onClick: () => spread.dots.onPick(i) }));
      }
    }
  }

  // defer: 'left' | 'right' | null — 그 쪽은 실제 쪽에 바로 붙이지 않고, 같은 크기의 숨은 보관함에서 그려 둡니다.
  fill(spread, defer = null) {
    const L = this.buildSide(spread.left, spread.folio?.[0], 'left');
    const R = this.buildSide(spread.right, spread.folio?.[1], 'right');
    const holders = [];
    const place = (side, part) => {
      const page = side === 'left' ? this.left : this.right;
      if (defer === side) {
        const holder = h('div', { class: `page-holder ${side}`, 'aria-hidden': 'true' }, part.body);
        Object.assign(holder.style, this.rectPct(page));
        this.el.append(holder); holders.push({ holder, page, part });
      } else page.replaceChildren(part.body);
    };
    place('left', L); place('right', R);
    L.fn?.(L.inner); R.fn?.(R.inner);
    this.leftScroll = L.scroll; this.rightScroll = R.scroll;
    this.setChrome(spread);
    return { L, R, holders };
  }

  commit(holders) {
    for (const { holder, page, part } of holders) { page.replaceChildren(part.body); holder.remove(); }
  }

  // 책(.book) 상자 기준 백분율 위치 — 창 크기가 바뀌어도 그림 속 책에 붙어 있도록
  rectPct(el) {
    const b = this.el.getBoundingClientRect(); const r = el.getBoundingClientRect();
    return { left: `${((r.left - b.left) / b.width) * 100}%`, top: `${((r.top - b.top) / b.height) * 100}%`, width: `${(r.width / b.width) * 100}%`, height: `${(r.height / b.height) * 100}%` };
  }

  async show(spread, dir = null) {
    if (this.busy) return false;
    if (!dir || reducedMotion() || !this.el.isConnected) { this.fill(spread); this.focusTop(); return true; }
    this.busy = true;
    try {
      if (dir === 'jump') await this.jump(spread);
      else if (isNarrow()) await this.flipNarrow(spread, dir);
      else await this.flipWide(spread, dir);
    } finally { this.busy = false; }
    this.focusTop();
    return true;
  }

  focusTop() {
    const hd = this.el.querySelector('.page h2, .page h3');
    if (hd) { hd.setAttribute('tabindex', '-1'); hd.focus({ preventScroll: true }); }
  }

  // 메뉴로 여러 장을 건너뛸 때: 글만 짧게 바뀜(배경 그대로)
  async jump(spread) {
    const olds = [this.left.firstElementChild, this.right.firstElementChild].filter(Boolean);
    await Promise.all(olds.map((n) => n.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 110, easing: 'ease-in', fill: 'forwards' }).finished.catch(() => {})));
    this.fill(spread);
    const news = [this.left.firstElementChild, this.right.firstElementChild].filter(Boolean);
    await Promise.all(news.map((n) => n.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 170, easing: 'ease-out' }).finished.catch(() => {})));
  }

  // 펼친 책: 한 장(앞면·뒷면)이 책등 접힌 선을 축으로 넘어감
  async flipWide(spread, dir) {
    const next = dir === 'next';
    const b = this.el.getBoundingClientRect();
    const lr = this.left.getBoundingClientRect(); const rr = this.right.getBoundingClientRect();
    if (!lr.width || !rr.width) { this.fill(spread); return; }
    const spine = (lr.right + rr.left) / 2;               // 그림 속 책등(두 쪽 사이) 위치
    const top = Math.min(lr.top, rr.top); const bottom = Math.max(lr.bottom, rr.bottom);
    const wFrom = next ? rr.right - spine : spine - lr.left;   // 넘어가는 종이 폭
    const wTo = next ? spine - lr.left : rr.right - spine;     // 내려앉을 쪽 폭
    const sc = wTo / wFrom;                                    // 내려앉으면서 맞출 가로 비율
    const pct = (v, total) => `${(v / total) * 100}%`;

    // ① 지금 보이는 '넘어가는 쪽' 내용을 그대로 떠서 앞면에 붙임(실제 쪽은 아직 안 바뀜)
    const fromPage = next ? this.right : this.left;
    const frontClone = clonePage(fromPage.firstElementChild || h('div'));
    const fromScroll = (next ? this.rightScroll : this.leftScroll)?.scrollTop || 0;

    // ② 새 내용 그리기: 드러날 쪽은 실제 쪽에 바로(종이 아래), 내려앉을 쪽은 숨은 보관함에
    const { holders } = this.fill(spread, next ? 'left' : 'right');
    const landing = holders[0].part.body;
    const backClone = clonePage(landing);

    // ③ 움직이는 층
    const layer = h('div', { class: 'turn-layer' });
    layer.style.perspective = `${Math.round(b.width * 5)}px`;
    layer.style.perspectiveOrigin = `${pct(spine - b.left, b.width)} 50%`;
    const leafLeft = next ? spine : lr.left;
    const leaf = h('div', { class: `turn-leaf ${next ? 'to-left' : 'to-right'}` });
    Object.assign(leaf.style, { left: pct(leafLeft - b.left, b.width), top: pct(top - b.top, b.height), width: pct(wFrom, b.width), height: pct(bottom - top, b.height), transformOrigin: next ? 'left center' : 'right center' });

    // 앞면: 현재 쪽의 내용(넘어가는 쪽 실제 위치·크기 그대로)
    const fromRect = next ? rr : lr;
    const frontBox = h('div', { class: 'turn-content' }, frontClone);
    Object.assign(frontBox.style, { left: pct(fromRect.left - leafLeft, wFrom), top: pct(fromRect.top - top, bottom - top), width: pct(fromRect.width, wFrom), height: pct(fromRect.height, bottom - top) });
    const front = h('div', { class: 'turn-face front' }, frontBox, h('div', { class: 'turn-shade' }), h('div', { class: 'turn-gloss' }));

    // 뒷면: 다음 쪽 내용(거울 반전 없이). 내려앉은 뒤 실제 쪽과 정확히 겹치도록 위치·비율 계산
    const toRect = next ? lr : rr;
    const u0 = next ? wFrom - (spine - toRect.left) / sc : (toRect.left - spine) / sc;
    const backBox = h('div', { class: 'turn-content' }, backClone);
    Object.assign(backBox.style, { left: pct(u0, wFrom), top: pct(toRect.top - top, bottom - top), width: pct(toRect.width, wFrom), height: pct(toRect.height, bottom - top), transform: `scaleX(${1 / sc})`, transformOrigin: 'left center' });
    const back = h('div', { class: 'turn-face back' }, backBox, h('div', { class: 'turn-shade' }));
    leaf.append(front, back);

    // 종이 아래 그림자: 드러나는 쪽(책등 쪽)과 내려앉을 쪽
    const revealRect = next ? rr : lr; const landRect = next ? lr : rr;
    const shadeBox = (r, cls) => { const d = h('div', { class: `turn-cast ${cls}` }); Object.assign(d.style, { left: pct(r.left - b.left, b.width), top: pct(r.top - b.top, b.height), width: pct(r.width, b.width), height: pct(r.height, b.height) }); return d; };
    const castReveal = shadeBox(revealRect, next ? 'from-left' : 'from-right');
    const castLand = shadeBox(landRect, next ? 'from-right' : 'from-left');
    layer.append(castReveal, castLand, leaf);
    this.el.append(layer);
    const fsc = frontBox.querySelector('.page-scroll'); if (fsc) fsc.scrollTop = fromScroll;

    // ④ 움직임: 바깥쪽이 먼저 들리고(빠른 출발), 넘어간 뒤 부드럽게 내려앉음
    const D = 500; const sign = next ? -1 : 1;
    const anim = leaf.animate([
      { transform: 'rotateY(0deg) scaleX(1)', easing: 'cubic-bezier(.3,.0,.6,1)' },
      { transform: `rotateY(${sign * 24}deg) translateZ(6px) scaleX(1)`, offset: 0.18, easing: 'cubic-bezier(.35,.15,.55,1)' },
      { transform: `rotateY(${sign * 90}deg) translateZ(8px) scaleX(1)`, offset: 0.52, easing: 'cubic-bezier(.3,.3,.4,1)' },
      { transform: `rotateY(${sign * 180}deg) scaleX(${sc})` },
    ], { duration: D, fill: 'forwards' });
    front.querySelector('.turn-shade').animate([{ opacity: 0 }, { opacity: 0.12, offset: 0.18 }, { opacity: 0.42, offset: 0.52 }, { opacity: 0.42 }], { duration: D, fill: 'forwards' });
    front.querySelector('.turn-gloss').animate([{ opacity: 0 }, { opacity: 0.55, offset: 0.2 }, { opacity: 0, offset: 0.52 }, { opacity: 0 }], { duration: D, fill: 'forwards' });
    back.querySelector('.turn-shade').animate([{ opacity: 0.42 }, { opacity: 0.42, offset: 0.52 }, { opacity: 0.08, offset: 0.85 }, { opacity: 0 }], { duration: D, fill: 'forwards' });
    castReveal.animate([{ opacity: 0.55 }, { opacity: 0.35, offset: 0.4 }, { opacity: 0 }], { duration: D, fill: 'forwards' });
    castLand.animate([{ opacity: 0 }, { opacity: 0, offset: 0.5 }, { opacity: 0.45, offset: 0.88 }, { opacity: 0 }], { duration: D, fill: 'forwards' });
    await anim.finished.catch(() => {});
    // ⑤ 같은 프레임에서: 보관해 둔 쪽을 실제 쪽에 붙이고 움직이는 층을 걷음 → 깜빡임 없음
    this.commit(holders);
    layer.remove();
  }

  async flipNarrow(spread, dir) {
    const rect = this.el.getBoundingClientRect();
    const snap = this.el.cloneNode(true);
    snap.removeAttribute('id'); snap.inert = true;
    snap.style.position = 'absolute'; snap.style.left = `${rect.left}px`; snap.style.top = `${rect.top}px`; snap.style.width = `${rect.width}px`; snap.style.margin = 0;
    const layer = h('div', { style: { position: 'fixed', inset: 0, zIndex: 40, pointerEvents: 'none', perspective: '1600px', overflow: 'hidden' } }, snap);
    snap.style.transformOrigin = dir === 'next' ? 'left center' : 'right center';
    document.body.append(layer);
    this.fill(spread);
    const top = this.wrap.getBoundingClientRect().top + window.scrollY - 70;
    window.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
    const anim = snap.animate([
      { transform: 'rotateY(0deg)', opacity: 1, filter: 'brightness(1)' },
      { transform: `rotateY(${dir === 'next' ? -100 : 100}deg)`, opacity: 0.2, filter: 'brightness(.7)' },
    ], { duration: 560, easing: 'cubic-bezier(.5,.05,.4,1)' });
    await anim.finished.catch(() => {});
    layer.remove();
  }
}
