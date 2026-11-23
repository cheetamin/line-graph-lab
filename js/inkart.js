// 수묵 산수·매화 가지를 코드로 그립니다(외부 그림 복제 없이 직접 생성).
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

function ridge(R, w, base, amp, rough, n = 9) {
  // 중간점 변위로 산등성이 만들기
  let pts = [[0, base - R() * amp * 0.4], [w, base - R() * amp * 0.4]];
  let a = amp;
  for (let k = 0; k < n; k++) {
    const next = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const [x1, y1] = pts[i - 1]; const [x2, y2] = pts[i];
      next.push([(x1 + x2) / 2 + (R() - 0.5) * (x2 - x1) * 0.2, (y1 + y2) / 2 - (R() - 0.35) * a], pts[i]);
    }
    pts = next; a *= rough;
  }
  return pts;
}

export function inkLandscape({ w = 1200, h = 360, seed = 7, layers = 4, pavilion = true, sun = true, birds = true } = {}) {
  const R = rng(seed);
  const id = `ink${seed}`;
  let out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
  <defs>
    <filter id="${id}b" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.018 0.06" numOctaves="3" seed="${seed}"/><feDisplacementMap in="SourceGraphic" scale="9"/></filter>
    <filter id="${id}s"><feGaussianBlur stdDeviation="2.2"/></filter>
    <filter id="${id}t"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${seed + 3}" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.6 1.25" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in"/></filter>`;
  for (let i = 0; i < layers; i++) {
    const dark = 0.28 + (i / (layers - 1)) * 0.6;
    out += `<linearGradient id="${id}g${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b2420" stop-opacity="${dark}"/><stop offset="0.55" stop-color="#4a423a" stop-opacity="${dark * 0.45}"/><stop offset="1" stop-color="#6d6455" stop-opacity="0"/></linearGradient>`;
  }
  out += `<radialGradient id="${id}sun"><stop offset="0" stop-color="#e8b65a" stop-opacity=".85"/><stop offset=".7" stop-color="#e8b65a" stop-opacity=".55"/><stop offset="1" stop-color="#e8b65a" stop-opacity="0"/></radialGradient></defs>`;
  if (sun) out += `<circle cx="${w * 0.8}" cy="${h * 0.22}" r="${h * 0.12}" fill="url(#${id}sun)" class="wash"/>`;
  for (let i = 0; i < layers; i++) {
    const t = i / (layers - 1);
    const base = h * (0.42 + t * 0.4);
    const amp = h * (0.55 - t * 0.25);
    const pts = ridge(R, w, base, amp, 0.55 + R() * 0.08);
    const d = `M0 ${h} L` + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L') + ` L${w} ${h} Z`;
    const filt = i === 0 ? `filter="url(#${id}s)"` : `filter="url(#${id}b)"`;
    out += `<path d="${d}" fill="url(#${id}g${i})" ${filt} class="wash" style="animation-delay:${0.3 * i}s"/>`;
    // 산 주름(준법) 몇 획
    if (i >= 1) {
      for (let k = 0; k < 6 + i * 2; k++) {
        const p = pts[Math.floor(R() * (pts.length - 2)) + 1];
        const len = 20 + R() * 40;
        out += `<path d="M${p[0].toFixed(1)} ${(p[1] + 4).toFixed(1)} q ${(R() - 0.5) * 16} ${len / 2} ${(R() - 0.5) * 10} ${len}" stroke="#2b2420" stroke-opacity="${0.12 + t * 0.2}" stroke-width="${1 + R() * 1.6}" fill="none" stroke-linecap="round" filter="url(#${id}t)"/>`;
      }
    }
    // 안개 띠

  }
  if (pavilion) {
    const px = w * 0.16; const py = h * 0.7;
    out += `<g fill="#2b2420" opacity=".78" transform="translate(${px} ${py})">
      <path d="M-60 0 Q-30 -6 0 -26 Q30 -6 60 0 Q30 -4 0 -18 Q-30 -4 -60 0Z"/>
      <rect x="-38" y="-2" width="76" height="4"/>
      <rect x="-30" y="2" width="3" height="26"/><rect x="27" y="2" width="3" height="26"/><rect x="-10" y="2" width="2.5" height="26"/><rect x="8" y="2" width="2.5" height="26"/>
      <rect x="-44" y="26" width="88" height="5"/>
      <path d="M-80 31 Q-40 24 0 33 Q50 26 96 34 L96 60 L-80 60Z" opacity=".55"/>
    </g>`;
    // 소나무
    out += `<g stroke="#2b2420" stroke-linecap="round" fill="none" opacity=".75" transform="translate(${px + 70} ${py + 28})">
      <path d="M0 0 C 4 -30, -6 -50, 6 -84" stroke-width="5"/><path d="M4 -50 C 20 -56, 34 -54, 46 -62" stroke-width="2.5"/><path d="M2 -70 C -14 -76, -28 -74, -40 -82" stroke-width="2.5"/>
    </g>`;
    for (const [cx, cy, r] of [[px + 116, py - 36, 16], [px + 30, py - 56, 15], [px + 78, py - 62, 18]]) {
      out += `<ellipse cx="${cx}" cy="${cy}" rx="${r * 1.6}" ry="${r * 0.55}" fill="#2b2420" opacity=".6" filter="url(#${id}b)"/>`;
    }
  }
  if (birds) {
    for (let k = 0; k < 3; k++) {
      const bx = w * (0.55 + k * 0.035); const by = h * (0.18 + (k % 2) * 0.05);
      out += `<path d="M${bx} ${by} q6 -6 12 0 q6 -6 12 0" stroke="#2b2420" stroke-width="1.6" fill="none" opacity=".6"/>`;
    }
  }
  return out + '</svg>';
}

export function plumBranch({ w = 420, h = 300, seed = 3, flip = false } = {}) {
  const R = rng(seed);
  let out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" aria-hidden="true" ${flip ? 'style="transform:scaleX(-1)"' : ''}>
  <defs><filter id="pb${seed}"><feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="${seed}"/><feDisplacementMap in="SourceGraphic" scale="3"/></filter></defs>
  <g stroke="#3a2418" stroke-linecap="round" fill="none" filter="url(#pb${seed})">
    <path d="M0 40 C 80 50, 140 30, 210 70 S 330 110, ${w - 20} 90" stroke-width="9"/>
    <path d="M120 44 C 150 10, 190 8, 230 -2" stroke-width="5"/>
    <path d="M210 70 C 230 120, 270 150, 300 200" stroke-width="5"/>
    <path d="M300 100 C 330 70, 360 60, 400 40" stroke-width="3.5"/>
    <path d="M60 46 C 70 90, 100 110, 120 150" stroke-width="4"/>
  </g>`;
  const spots = [[150, 30], [190, 12], [228, 4], [215, 66], [245, 120], [278, 160], [300, 198], [330, 76], [370, 56], [96, 106], [118, 146], [260, 86], [395, 42], [62, 48]];
  for (const [x, y] of spots) {
    const r = 9 + R() * 6;
    const rot = R() * 72;
    out += `<g transform="translate(${x} ${y}) rotate(${rot})">`;
    for (let p = 0; p < 5; p++) {
      const a = (p * 72 * Math.PI) / 180;
      out += `<circle cx="${(Math.cos(a) * r * 0.55).toFixed(1)}" cy="${(Math.sin(a) * r * 0.55).toFixed(1)}" r="${(r * 0.52).toFixed(1)}" fill="#e8a2a0" stroke="#c4615d" stroke-width=".8" opacity=".92"/>`;
    }
    out += `<circle r="${r * 0.22}" fill="#f2d27a"/>`;
    for (let p = 0; p < 6; p++) {
      const a = (p * 60 * Math.PI) / 180;
      out += `<line x1="0" y1="0" x2="${(Math.cos(a) * r * 0.5).toFixed(1)}" y2="${(Math.sin(a) * r * 0.5).toFixed(1)}" stroke="#b5463f" stroke-width=".7"/>`;
    }
    out += '</g>';
  }
  for (let k = 0; k < 8; k++) out += `<circle cx="${40 + R() * (w - 60)}" cy="${20 + R() * 120}" r="${2 + R() * 2.5}" fill="#7a2620" opacity=".85"/>`;
  return out + '</svg>';
}

export function sealStamp(text = '數學') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60" aria-hidden="true"><rect x="3" y="3" width="54" height="54" rx="6" fill="#9e2a22"/><rect x="7" y="7" width="46" height="46" rx="4" fill="none" stroke="#f3d9c0" stroke-width="1.5"/><text x="30" y="26" text-anchor="middle" font-size="17" fill="#f7e3cb" font-family="serif">${text[0]}</text><text x="30" y="46" text-anchor="middle" font-size="17" fill="#f7e3cb" font-family="serif">${text[1]}</text></svg>`;
}
