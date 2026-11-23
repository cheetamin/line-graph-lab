// 책장 넘김 영상(투명 배경 WebM)을 고서 배경 위에 겹쳐 재생합니다.
// - 영상(1672×940)과 배경 그림(1672×941)은 같은 좌표라서, 둘 다 장면(.scene) 전체를 100%로 채우면
//   창 크기가 달라져도 영상 속 책등이 배경 속 책등과 겹칩니다.
// - 투명 WebM을 못 보여 주는 브라우저(Safari 등)는 같은 움직임의 프레임 그림을 캔버스에 그립니다.
// - 시점(초): 종이가 오른쪽 쪽을 덮음(cover) 0.05, 왼쪽에 완전히 내려앉음(swap) 0.52, 끝 0.66

export const CUE = { cover: 0.05, swap: 0.52, end: 0.66 };
const SRC = { next: 'assets/page-turn-overlay.webm', prev: 'assets/page-turn-overlay-rev.webm' };
const FRAMES = { count: 34, first: 3, fps: 60, dir: 'assets/page-turn-frames/' }; // f00 = 원본 4번째 프레임(0.05초)
const BOX = { x: 260, y: 120, w: 1340, h: 760, W: 1672, H: 940 };               // 프레임 그림이 차지하는 배경 속 자리
const SCENE_MQ = '(min-width: 900px) and (min-aspect-ratio: 13/10)';

function makeVideo(src) {
  const v = document.createElement('video');
  v.src = src; v.muted = true; v.playsInline = true; v.preload = 'auto';
  v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true');
  v.className = 'turn-video';
  return v;
}

export class PageTurner {
  constructor(scene) {
    this.scene = scene;
    this.layer = document.createElement('div');
    this.layer.className = 'turn-video-layer';
    this.videos = { next: makeVideo(SRC.next), prev: makeVideo(SRC.prev) };
    this.layer.append(this.videos.next, this.videos.prev);
    scene.append(this.layer);
    this.mode = 'pending';
    this.ready = this.detect();
  }

  usable() { return this.mode !== 'failed' && this.mode !== 'pending' && window.matchMedia(SCENE_MQ).matches; }

  async detect() {
    const v = this.videos.next;
    try {
      if (!v.canPlayType('video/webm; codecs="vp9"')) throw new Error('no vp9');
      await new Promise((res, rej) => {
        if (v.readyState >= 2) return res();
        const t = setTimeout(() => rej(new Error('timeout')), 6000);
        v.addEventListener('loadeddata', () => { clearTimeout(t); res(); }, { once: true });
        v.addEventListener('error', () => { clearTimeout(t); rej(new Error('error')); }, { once: true });
      });
      // 종이가 보이는 프레임에서 모서리는 투명, 가운데 오른쪽은 불투명해야 투명 영상을 제대로 지원하는 것
      await new Promise((res) => { v.addEventListener('seeked', res, { once: true }); v.currentTime = 0.12; });
      const c = document.createElement('canvas'); c.width = 64; c.height = 36;
      const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(v, 0, 0, 64, 36);
      const corner = g.getImageData(1, 1, 1, 1).data[3];
      const paper = g.getImageData(48, 18, 1, 1).data[3];
      v.currentTime = 0;
      if (corner === 0 && paper > 200) { this.mode = 'video'; return; }
      throw new Error('alpha not supported');
    } catch {
      this.mode = await this.loadFrames() ? 'frames' : 'failed';
    }
  }

  async loadFrames() {
    try {
      this.frames = await Promise.all(Array.from({ length: FRAMES.count }, (_, i) => new Promise((res, rej) => {
        const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = `${FRAMES.dir}f${String(i).padStart(2, '0')}.webp`;
      })));
      this.canvas = document.createElement('canvas');
      this.canvas.className = 'turn-canvas';
      this.canvas.width = this.frames[0].naturalWidth; this.canvas.height = this.frames[0].naturalHeight;
      Object.assign(this.canvas.style, { left: `${(BOX.x / BOX.W) * 100}%`, top: `${(BOX.y / BOX.H) * 100}%`, width: `${(BOX.w / BOX.W) * 100}%`, height: `${(BOX.h / BOX.H) * 100}%` });
      this.layer.append(this.canvas);
      return true;
    } catch { return false; }
  }

  // dir: 'next' | 'prev', cues: { cover(), swap() } — 정해진 시점에 한 번씩 불림
  play(dir, cues) {
    const fired = {};
    const fire = (t) => {
      for (const k of ['cover', 'swap']) if (!fired[k] && t >= CUE[k]) { fired[k] = true; try { cues[k]?.(); } catch (e) { console.error(e); } }
    };
    this.layer.classList.add('on');
    return (this.mode === 'video' ? this.playVideo(dir, fire) : this.playFrames(dir, fire)).finally(() => {
      fire(99); // 혹시 놓친 시점이 있으면 마지막에 실행
      this.layer.classList.remove('on');
    });
  }

  playVideo(dir, fire) {
    const v = this.videos[dir];
    const other = this.videos[dir === 'next' ? 'prev' : 'next'];
    other.classList.remove('show');
    return new Promise((resolve) => {
      let done = false;
      const finish = () => { if (done) return; done = true; v.pause(); v.classList.remove('show'); v.currentTime = 0; resolve(); };
      const safety = setTimeout(finish, (CUE.end / (v.playbackRate || 1)) * 1000 + 1500);
      const onFrame = (now, meta) => {
        if (done) return;
        fire(meta ? meta.mediaTime : v.currentTime);
        if (meta && meta.mediaTime >= CUE.end) { clearTimeout(safety); finish(); return; }
        if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(onFrame); else requestAnimationFrame(() => onFrame());
      };
      v.addEventListener('ended', () => { clearTimeout(safety); fire(99); finish(); }, { once: true });
      v.currentTime = 0;
      v.classList.add('show');
      const p = v.play();
      (p && p.catch ? p : Promise.resolve()).then(() => {
        if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(onFrame); else requestAnimationFrame(() => onFrame());
      }).catch(() => { clearTimeout(safety); finish(); });
    });
  }

  playFrames(dir, fire) {
    const g = this.canvas.getContext('2d');
    this.canvas.classList.add('show');
    return new Promise((resolve) => {
      const t0 = performance.now();
      const step = (now) => {
        const t = (now - t0) / 1000;
        // 원본 시간 기준 프레임 번호(앞으로: 그대로, 뒤로: 거꾸로)
        const tt = dir === 'next' ? t : CUE.end - t;
        const idx = Math.round(tt * FRAMES.fps) - FRAMES.first;
        g.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (idx >= 0 && idx < FRAMES.count) g.drawImage(this.frames[idx], 0, 0);
        fire(t);
        if (t < CUE.end) requestAnimationFrame(step);
        else { g.clearRect(0, 0, this.canvas.width, this.canvas.height); this.canvas.classList.remove('show'); resolve(); }
      };
      requestAnimationFrame(step);
    });
  }
}
