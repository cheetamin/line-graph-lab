// 고서 책 틀과 책장 넘김 애니메이션
import { h, ART, reducedMotion, isNarrow } from './ui.js?v=mwswbgmk';

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
      this.wrap.classList.add('turning');
      if (dir === 'jump') await this.jump(spread);
      else if (this.turner?.usable()) await this.videoTurn(spread, dir);
      else await this.motion(spread, dir);
    } finally { this.busy = false; this.wrap.classList.remove('turning'); }
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

  // 책장 넘김 영상: 종이가 넘어가는 쪽을 덮으면 그 쪽 글을 숨기고, 반대쪽에 완전히 내려앉는 순간 새 쪽으로 교체
  async videoTurn(spread, dir) {
    const side = dir === 'next' ? this.right : this.left; // 종이가 들려 올라가는 쪽(교체 뒤에는 열린 쪽)
    const old = side.firstElementChild;
    await this.turner.play(dir, {
      cover: () => { old?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 40, fill: 'forwards' }); },
      swap: () => {
        this.fill(spread); // 내려앉은 쪽은 종이 아래에서 바뀌고, 종이가 사라지며 드러남
        side.firstElementChild?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 170, easing: 'ease-out' });
      },
    });
  }

  // 모션 그래픽 전환(영상을 쓸 수 없는 좁은 화면용): 배경은 그대로, 글만 먹 번짐 속으로 사라졌다가 다음 쪽 글이 붓질 뒤를 따라 나타남
  async motion(spread, dir) {
    const next = dir === 'next'; const sx = next ? 1 : -1;
    const pages = isNarrow() ? [this.left, this.right] : (next ? [this.left, this.right] : [this.right, this.left]);
    const olds = pages.map((p) => p.firstElementChild).filter(Boolean);
    // 먹 번짐 띠
    const layer = h('div', { class: 'ink-layer' });
    const band = h('div', { class: `ink-band ${next ? 'to-left' : 'to-right'}` });
    const drops = [0, 1, 2, 3, 4].map((i) => h('span', { class: 'ink-drop', style: { top: `${14 + i * 17 + (i % 2) * 6}%`, animationDelay: `${60 + i * 35}ms` } }));
    band.append(...drops);
    layer.append(band);
    const rects = [this.left, this.right].map((p) => this.rectPct(p));
    Object.assign(layer.style, { left: rects[0].left, top: rects[0].top, right: `${100 - parseFloat(rects[1].left) - parseFloat(rects[1].width)}%`, bottom: `${100 - parseFloat(rects[0].top) - parseFloat(rects[0].height)}%` });
    this.el.append(layer);
    const D = 560;
    const bandAnim = band.animate([{ transform: `translateX(${sx * 105}%)` }, { transform: `translateX(${-sx * 105}%)` }], { duration: D, easing: 'cubic-bezier(.55,.1,.35,1)' });
    // ① 지금 글이 붓질 방향으로 흩어지며 사라짐
    await Promise.all(olds.map((n, i) => n.animate([
      { opacity: 1, transform: 'none', filter: 'blur(0)' },
      { opacity: 0, transform: `translateX(${-sx * 26}px)`, filter: 'blur(3px)' },
    ], { duration: 190, delay: i * 50, easing: 'ease-in', fill: 'forwards' }).finished.catch(() => {})));
    // ② 글이 완전히 사라진 뒤에만 새 쪽으로 교체
    this.fill(spread);
    const news = pages.map((p) => p.firstElementChild).filter(Boolean);
    news.forEach((n) => { n.style.opacity = '0'; });
    // ③ 붓질 뒤를 따라 새 글이 차례로 나타남
    await Promise.all(news.map((n, i) => n.animate([
      { opacity: 0, transform: `translateX(${sx * 30}px)`, filter: 'blur(3px)' },
      { opacity: 1, transform: 'none', filter: 'blur(0)' },
    ], { duration: 260, delay: 40 + i * 70, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'backwards' }).finished.then(() => { n.style.opacity = ''; }).catch(() => { n.style.opacity = ''; })));
    await bandAnim.finished.catch(() => {});
    layer.remove();
  }

}
