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

  decorate(pageEl, folio) {
    pageEl.append(h('img', { class: 'corner tl', src: ART('frame_corner'), alt: '' }));
    pageEl.append(h('img', { class: 'corner br', src: ART('frame_corner'), alt: '' }));
    if (folio) pageEl.append(h('div', { class: 'folio' }, folio));
  }

  fill(spread) {
    this.left.replaceChildren(); this.right.replaceChildren();
    const li = h('div', { class: 'page-inner' }); const ri = h('div', { class: 'page-inner' });
    this.leftScroll = h('div', { class: 'page-scroll' }, li); this.rightScroll = h('div', { class: 'page-scroll' }, ri);
    this.left.append(this.leftScroll); this.right.append(this.rightScroll);
    spread.left?.(li); spread.right?.(ri);
    this.decorate(this.left, spread.folio?.[0]); this.decorate(this.right, spread.folio?.[1]);
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

  async show(spread, dir = null) {
    if (this.busy) return;
    if (!dir || reducedMotion() || !this.el.isConnected) { this.fill(spread); this.focusTop(); return; }
    this.busy = true;
    try {
      if (isNarrow()) await this.flipNarrow(spread, dir);
      else await this.flipWide(spread, dir);
    } finally { this.busy = false; }
    this.focusTop();
  }

  focusTop() {
    const hd = this.el.querySelector('.page h2, .page h3');
    if (hd) { hd.setAttribute('tabindex', '-1'); hd.focus({ preventScroll: true }); }
  }

  async flipWide(spread, dir) {
    const oldL = clonePage(this.left); const oldR = clonePage(this.right);
    const sL = this.leftScroll?.scrollTop || 0; const sR = this.rightScroll?.scrollTop || 0;
    this.fill(spread);
    const newL = clonePage(this.left); const newR = clonePage(this.right);
    const layer = h('div', { class: 'flip-layer' });
    const half = (side, node, scroll) => {
      const box = h('div', { class: 'flip-static', style: side === 'left' ? { left: 0, width: '50%' } : { left: '50%', width: '50%' } }, node);
      node.style.height = '100%'; node.style.overflow = 'hidden';
      return [box, () => { const sc = node.querySelector('.page-scroll'); if (sc) sc.scrollTop = scroll; }];
    };
    const face = (node, back, scroll) => {
      node.style.height = '100%';
      const f = h('div', { class: `leaf-face ${back ? 'back' : ''}` }, node, h('div', { class: 'leaf-shade' }));
      return [f, () => { const sc = node.querySelector('.page-scroll'); if (sc) sc.scrollTop = scroll; }];
    };
    let staticBox; let leaf; const fixes = [];
    if (dir === 'next') {
      const [b, fx] = half('left', oldL, sL); staticBox = b; fixes.push(fx);
      const [f1, fx1] = face(oldR, false, sR); const [f2] = face(newL, true, 0); fixes.push(fx1);
      leaf = h('div', { class: 'leaf', style: { left: '50%', width: '50%', transformOrigin: 'left center' } }, f1, f2);
    } else {
      const [b, fx] = half('right', oldR, sR); staticBox = b; fixes.push(fx);
      const [f1, fx1] = face(oldL, false, sL); const [f2] = face(newR, true, 0); fixes.push(fx1);
      leaf = h('div', { class: 'leaf', style: { left: 0, width: '50%', transformOrigin: 'right center' } }, f1, f2);
    }
    layer.append(staticBox, leaf);
    this.el.append(layer);
    fixes.forEach((f) => f());
    const to = dir === 'next' ? -180 : 180;
    const anim = leaf.animate([
      { transform: 'rotateY(0deg)' },
      { transform: `rotateY(${to / 2}deg) translateZ(30px)`, offset: 0.5 },
      { transform: `rotateY(${to}deg)` },
    ], { duration: 820, easing: 'cubic-bezier(.45,.05,.35,1)' });
    leaf.querySelectorAll('.leaf-shade').forEach((sh) => sh.animate([{ opacity: 0 }, { opacity: 1, offset: 0.5 }, { opacity: 0 }], { duration: 820 }));
    await anim.finished.catch(() => {});
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
