# 장식 소품: 붓, 벼루, 청사초롱, 소나무, 매화, 학, 정자, 산수, 옛 책, 구름 — 모두 직접 그린 투명 배경 그림
import math, random
from defs import *


def rng(seed):
    r = random.Random(seed)
    return r.random


# ───────── 붓 ─────────
def brush_big(w=760, h=260):
    u = 'pb'
    body = f'''
  <linearGradient id="bam{u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9b072"/><stop offset=".5" stop-color="#b58447"/><stop offset="1" stop-color="#7d5428"/></linearGradient>
  <linearGradient id="hair{u}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#14100c"/><stop offset=".45" stop-color="#3a2f26"/><stop offset=".62" stop-color="#e9dfc8"/><stop offset="1" stop-color="#fbf6ea"/></linearGradient>
  <g transform="rotate(-14 380 130)" filter="url(#shadow{u})">
    <path d="M708 118 q 30 -8 34 12 q -4 20 -34 12" fill="none" stroke="{RED}" stroke-width="4"/>
    <rect x="300" y="112" width="410" height="34" rx="16" fill="url(#bam{u})" stroke="{INK}" stroke-width="3"/>
    <path d="M410 112 v34 M540 112 v34 M650 112 v34" stroke="#6b4520" stroke-width="3"/>
    <path d="M410 118 q 6 11 0 22 M540 118 q 6 11 0 22" stroke="#e8c88e" stroke-width="2" fill="none" opacity=".7"/>
    <rect x="262" y="108" width="46" height="42" rx="8" fill="#2a1a10" stroke="{INK}" stroke-width="3"/>
    <rect x="270" y="112" width="6" height="34" fill="{GOLD}" opacity=".8"/>
    <path d="M264 110 C 200 96, 120 104, 30 130 C 120 154, 200 162, 264 148 Z" fill="url(#hair{u})" stroke="{INK}" stroke-width="3" filter="url(#brush{u})"/>
    <path d="M150 112 C 110 118, 70 124, 30 130 C 70 136, 110 142, 150 146 C 130 136, 130 122, 150 112Z" fill="#0f0b08" filter="url(#brush{u})"/>
    <path d="M250 120 C 200 116, 160 120, 120 126" stroke="#fff" stroke-width="2" opacity=".55" fill="none"/>
  </g>
  <path d="M30 196 q 26 -6 40 4 q 18 10 44 2" fill="none" stroke="{INK}" stroke-width="5" stroke-linecap="round" filter="url(#dry{u})" opacity=".55"/>'''
    return svg(w, h, body, u)


# ───────── 벼루 + 먹 ─────────
def inkstone(w=560, h=360):
    u = 'pi'
    body = f'''
  <linearGradient id="st{u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a4440"/><stop offset="1" stop-color="#211d1a"/></linearGradient>
  <linearGradient id="side{u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b2623"/><stop offset="1" stop-color="#141110"/></linearGradient>
  <radialGradient id="pool{u}" cx=".42" cy=".38" r=".7"><stop offset="0" stop-color="#3c3a3a"/><stop offset=".55" stop-color="#121010"/><stop offset="1" stop-color="#050404"/></radialGradient>
  <ellipse cx="290" cy="300" rx="250" ry="44" fill="#000" opacity=".35" filter="url(#soft{u})"/>
  <path d="M60 170 Q60 120 120 116 H470 Q520 120 520 170 V230 Q520 286 460 290 H120 Q60 286 60 230Z" fill="url(#side{u})" stroke="{INK}" stroke-width="3"/>
  <path d="M60 170 Q60 120 120 116 H470 Q520 120 520 170 Q520 214 460 218 H120 Q60 214 60 170Z" fill="url(#st{u})" stroke="{INK}" stroke-width="3" filter="url(#grain{u})"/>
  <path d="M96 170 Q96 140 134 138 H446 Q484 140 484 170 Q484 196 446 198 H134 Q96 196 96 170Z" fill="none" stroke="#6b625a" stroke-width="2"/>
  <ellipse cx="200" cy="168" rx="86" ry="24" fill="url(#pool{u})" stroke="#0a0807" stroke-width="2"/>
  <path d="M150 158 q 40 -12 86 -4" stroke="#fff" stroke-width="2.5" opacity=".35" fill="none" stroke-linecap="round"/>
  <path d="M300 182 Q 360 150 440 160" stroke="#5c544d" stroke-width="2" fill="none"/>
  {ruyi(440, 132, 18, '#5c544d', '#1a1715', 2, rot=0)}
  <g transform="rotate(-22 380 120)" filter="url(#shadow{u})">
    <rect x="330" y="30" width="60" height="170" rx="6" fill="#151110" stroke="#000" stroke-width="2"/>
    <rect x="342" y="48" width="36" height="94" fill="none" stroke="{GOLD}" stroke-width="2"/>
    <path d="M360 62 v66 M352 80 h16 M352 106 h16" stroke="{GOLD}" stroke-width="3"/>
    <path d="M330 186 h60 v14 h-60z" fill="#0b0908"/>
  </g>'''
    return svg(w, h, body, u)


# ───────── 청사초롱 ─────────
def lantern(w=280, h=520):
    u = 'pl'
    ribs = ''.join(f'<path d="M{x} 150 V360" stroke="#3a1d10" stroke-width="3"/>' for x in (90, 140, 190))
    body = f'''
  <radialGradient id="glow{u}" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffd27a" stop-opacity=".85"/><stop offset=".6" stop-color="#ffb347" stop-opacity=".25"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient>
  <linearGradient id="blue{u}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1f3f73"/><stop offset=".5" stop-color="#4f78b8"/><stop offset="1" stop-color="#1f3f73"/></linearGradient>
  <linearGradient id="red{u}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8c1f17"/><stop offset=".5" stop-color="#e2553f"/><stop offset="1" stop-color="#8c1f17"/></linearGradient>
  <ellipse cx="140" cy="260" rx="140" ry="170" fill="url(#glow{u})"/>
  <path d="M140 0 V60" stroke="#5a3418" stroke-width="8" stroke-linecap="round"/>
  <path d="M140 56 q -30 0 -30 24" fill="none" stroke="{GOLD_D}" stroke-width="5"/>
  <path d="M70 92 Q140 62 210 92 L224 112 H56Z" fill="#3a1d10" stroke="{INK}" stroke-width="3"/>
  <path d="M60 112 H220" stroke="{GOLD}" stroke-width="4"/>
  <path d="M64 116 Q140 104 216 116 V196 Q140 186 64 196Z" fill="url(#blue{u})" stroke="{INK}" stroke-width="3"/>
  <path d="M64 196 Q140 186 216 196 V352 Q140 368 64 352Z" fill="url(#red{u})" stroke="{INK}" stroke-width="3"/>
  {ribs}
  <ellipse cx="140" cy="260" rx="46" ry="70" fill="#ffe2a0" opacity=".35" filter="url(#soft{u})"/>
  <path d="M92 140 q 48 -10 96 0" stroke="{GOLD_L}" stroke-width="2" fill="none" opacity=".7"/>
  {ruyi(140, 266, 22, GOLD, '#5a1a10', 2)}
  <path d="M62 356 Q140 374 218 356 L206 380 H74Z" fill="#3a1d10" stroke="{INK}" stroke-width="3"/>
  <path d="M74 380 H206" stroke="{GOLD}" stroke-width="4"/>
  <circle cx="140" cy="398" r="10" fill="{GOLD}" stroke="{INK}" stroke-width="3"/>
  <path d="M140 408 C 128 440, 126 470, 122 510 M140 408 C 140 440, 140 476, 140 514 M140 408 C 152 440, 154 470, 158 510" stroke="#b8261d" stroke-width="5" fill="none" stroke-linecap="round"/>
  <rect x="128" y="404" width="24" height="16" rx="4" fill="#d9a94e" stroke="{INK}" stroke-width="2"/>'''
    return svg(w, h, body, u)


# ───────── 소나무 가지 ─────────
def needle_cluster(cx, cy, r, R, u, tone=INK):
    out = ''
    n = 22
    for i in range(n):
        a = math.radians(-170 + i * (160 / (n - 1)) + (R() - .5) * 8)
        rr = r * (0.7 + R() * 0.35)
        x2 = cx + math.cos(a) * rr; y2 = cy + math.sin(a) * rr * 0.75
        out += f'<path d="M{cx:.1f} {cy:.1f} L{x2:.1f} {y2:.1f}" stroke="{tone}" stroke-width="{1.4 + R()*1.2:.2f}" stroke-linecap="round"/>'
    return f'<ellipse cx="{cx}" cy="{cy - r*0.25}" rx="{r*1.05}" ry="{r*0.5}" fill="#3e4a3a" opacity=".22" filter="url(#wash{u})"/><g filter="url(#brush{u})">{out}</g>'


def pine(w=760, h=320, seed=11):
    u = 'pp'
    R = rng(seed)
    trunk = f'''
  <g filter="url(#brush{u})" stroke-linecap="round" fill="none">
    <path d="M0 250 C 90 240, 140 200, 230 196 S 360 150, 460 160 S 620 120, 740 96" stroke="{INK}" stroke-width="20"/>
    <path d="M0 250 C 90 240, 140 200, 230 196 S 360 150, 460 160 S 620 120, 740 96" stroke="#5a4636" stroke-width="9" opacity=".7"/>
    <path d="M230 196 C 250 150, 290 120, 330 96" stroke="{INK}" stroke-width="9"/>
    <path d="M460 160 C 470 200, 520 222, 580 228" stroke="{INK}" stroke-width="8"/>
    <path d="M120 230 C 140 270, 190 286, 240 290" stroke="{INK}" stroke-width="7"/>
    <path d="M600 130 C 620 90, 650 70, 690 58" stroke="{INK}" stroke-width="6"/>
  </g>
  <g filter="url(#dry{u})" opacity=".55"><path d="M10 248 C 90 238, 150 204, 230 198" stroke="{INK}" stroke-width="5" fill="none"/></g>'''
    clusters = ''
    for (x, y, r) in [(330, 92, 56), (250, 140, 46), (420, 128, 52), (520, 104, 58), (590, 226, 50), (690, 56, 46), (240, 286, 42), (150, 210, 40), (660, 132, 44), (380, 70, 40)]:
        clusters += needle_cluster(x, y, r, R, u)
    return svg(w, h, trunk + clusters, u, seed)


# ───────── 매화 가지 ─────────
def blossom(x, y, r, R, rot):
    out = f'<g transform="translate({x:.1f} {y:.1f}) rotate({rot:.0f})">'
    for p in range(5):
        a = math.radians(p * 72)
        out += f'<circle cx="{math.cos(a)*r*.55:.1f}" cy="{math.sin(a)*r*.55:.1f}" r="{r*.52:.1f}" fill="#f2b2ad" stroke="#c45d57" stroke-width="1.1" opacity=".95"/>'
    out += f'<circle r="{r*.28:.1f}" fill="#e57f73"/>'
    for p in range(7):
        a = math.radians(p * 51)
        out += f'<path d="M0 0 L{math.cos(a)*r*.62:.1f} {math.sin(a)*r*.62:.1f}" stroke="#7a2a20" stroke-width=".9"/><circle cx="{math.cos(a)*r*.62:.1f}" cy="{math.sin(a)*r*.62:.1f}" r="1.3" fill="#e9b949"/>'
    return out + '</g>'


def plum(w=640, h=300, seed=5):
    u = 'pm'
    R = rng(seed)
    br = f'''
  <g filter="url(#brush{u})" stroke-linecap="round" fill="none">
    <path d="M0 60 C 90 70, 160 40, 240 82 S 380 132, 520 100 S 610 70, 640 60" stroke="{INK}" stroke-width="15"/>
    <path d="M0 60 C 90 70, 160 40, 240 82" stroke="#6a4a36" stroke-width="5" opacity=".7"/>
    <path d="M150 58 C 190 20, 240 12, 300 4" stroke="{INK}" stroke-width="7"/>
    <path d="M240 82 C 260 140, 300 180, 340 240" stroke="{INK}" stroke-width="7"/>
    <path d="M400 116 C 430 160, 470 190, 520 206" stroke="{INK}" stroke-width="5"/>
    <path d="M90 64 C 100 110, 120 140, 150 170" stroke="{INK}" stroke-width="5"/>
    <path d="M520 100 C 540 60, 570 40, 610 26" stroke="{INK}" stroke-width="4"/>
  </g>'''
    pts = [(190, 28, 15), (250, 12, 13), (300, 6, 11), (232, 78, 16), (268, 150, 14), (310, 200, 15), (338, 238, 12), (410, 122, 13), (466, 186, 15),
           (515, 204, 12), (560, 52, 14), (606, 28, 11), (110, 110, 14), (148, 166, 12), (60, 62, 12), (470, 112, 11)]
    fl = ''.join(blossom(x, y, r, R, R() * 72) for x, y, r in pts)
    buds = ''.join(f'<circle cx="{40 + R()*560:.0f}" cy="{20 + R()*200:.0f}" r="{3 + R()*3:.1f}" fill="#8a2a22"/>' for _ in range(10))
    return svg(w, h, br + fl + buds, u, seed)


# ───────── 학 ─────────
def wing(ox, oy, length, ang, spread, n, fill, tip, u, scale=1.0):
    """학 날개: 깃 끝 쪽 1/3은 검은 칼깃, 끝은 몇 가닥으로 갈라짐"""
    a0 = math.radians(ang)
    ux, uy = math.cos(a0), math.sin(a0)
    px, py = -uy, ux  # 날개 뒤쪽(꼬리 방향) 법선
    w = length * 0.44
    P = lambda t, k: (ox + ux * length * t + px * w * k, oy + uy * length * t + py * w * k)
    lead = [P(0, -.15), P(.35, -.35), P(.75, -.25), P(1.0, 0)]
    trail = [P(.92, .55), P(.6, 1.0), P(.25, .95), P(0, .5)]
    f = lambda p: f'{p[0]:.1f} {p[1]:.1f}'
    base = (f'M{f(lead[0])} C {f(lead[1])}, {f(lead[2])}, {f(lead[3])} '
            f'C {f(P(1.02, .3))}, {f(trail[0])}, {f(trail[0])} C {f(trail[1])}, {f(trail[2])}, {f(trail[3])} Z')
    out = f'<path d="{base}" fill="{fill}" stroke="{INK}" stroke-width="3"/>'
    # 검은 칼깃: 날개 바깥쪽 영역
    tipzone = (f'M{f(P(.62, -.3))} C {f(P(.8, -.24))}, {f(P(.95, -.08))}, {f(lead[3])} '
               f'C {f(P(1.02, .3))}, {f(trail[0])}, {f(trail[0])} C {f(P(.8, .7))}, {f(P(.66, .5))}, {f(P(.62, -.3))} Z')
    out += f'<path d="{tipzone}" fill="{tip}"/>'
    for i in range(n):
        t = i / max(1, n - 1)
        sx, sy = P(.9 - t * .25, .1 + t * .75)
        L = length * (.22 - t * .06)
        aa = a0 + math.radians(spread * (t - .2))
        ex, ey = sx + math.cos(aa) * L, sy + math.sin(aa) * L
        qx, qy = -math.sin(aa) * 5, math.cos(aa) * 5
        out += f'<path d="M{sx - qx:.1f} {sy - qy:.1f} Q{(sx+ex)/2:.1f} {(sy+ey)/2:.1f} {ex:.1f} {ey:.1f} Q{(sx+ex)/2 + qx:.1f} {(sy+ey)/2 + qy:.1f} {sx + qx:.1f} {sy + qy:.1f}Z" fill="{tip}" stroke="{INK}" stroke-width="1.2"/>'
    for k in range(3):
        a, b = P(.18 + k * .14, .35), P(.3 + k * .14, .85)
        out += f'<path d="M{f(a)} Q {f(P(.3 + k*.14, .5))} {f(b)}" stroke="#9b9488" stroke-width="1.6" fill="none"/>'
    return out


def crane(w=560, h=430):
    u = 'pc'
    body = f'''
  <g filter="url(#brush{u})" stroke-linejoin="round" stroke-linecap="round" transform="translate(0 92)">
    {wing(262, 168, 180, -118, 25, 4, '#e6e2d8', '#2a221c', u)}
    <path d="M200 176 C 230 150, 330 146, 372 166 C 392 176, 392 192, 360 198 C 310 206, 240 204, 200 176Z" fill="#fbfaf6" stroke="{INK}" stroke-width="3.5"/>
    <path d="M356 168 C 384 160, 410 166, 432 182 C 406 182, 398 190, 412 206 C 386 198, 372 196, 356 196Z" fill="{INK}"/>
    {wing(292, 164, 220, -58, 25, 5, '#fdfcf8', INK, u)}
    <path d="M208 172 C 176 160, 150 150, 124 146" stroke="{INK}" stroke-width="11" fill="none"/>
    <ellipse cx="116" cy="145" rx="13" ry="9" fill="{INK}"/>
    <circle cx="114" cy="138" r="6" fill="#d23a2c"/>
    <path d="M104 143 L54 150 L104 150Z" fill="#9c8f6e" stroke="{INK}" stroke-width="2"/>
    <circle cx="112" cy="144" r="1.8" fill="#fff"/>
    <path d="M362 192 L470 214 M366 196 L474 222" stroke="#3a312a" stroke-width="3.5" fill="none"/>
    <path d="M470 214 l14 -6 M470 214 l16 2 M474 222 l14 0 M474 222 l12 8" stroke="#3a312a" stroke-width="2.5"/>
  </g>'''
    return svg(w, h, body, u)


# ───────── 정자와 절벽 ─────────
def pavilion(w=620, h=440, seed=21):
    u = 'pv'
    R = rng(seed)
    strokes = ''.join(f'<path d="M{150 + R()*300:.0f} {250 + R()*150:.0f} q {(R()-.5)*30:.0f} {20 + R()*30:.0f} {(R()-.5)*16:.0f} {40 + R()*40:.0f}" stroke="{INK}" stroke-width="{1.5 + R()*2.5:.1f}" fill="none" opacity="{.25 + R()*.4:.2f}"/>' for _ in range(40))
    body = f'''
  <path d="M120 440 C 140 360, 170 300, 190 262 C 210 240, 250 236, 300 240 C 360 244, 420 236, 450 260 C 480 290, 470 360, 500 440Z" fill="#5c5348" opacity=".55" filter="url(#wash{u})"/>
  <path d="M150 440 C 170 370, 190 310, 210 270 C 260 252, 330 256, 400 254 C 430 262, 440 300, 450 440Z" fill="#2c2520" opacity=".45" filter="url(#wash{u})"/>
  <path d="M190 268 C 176 320, 168 380, 160 440 M452 262 C 470 320, 474 380, 486 440" stroke="{INK}" stroke-width="7" fill="none" opacity=".55" filter="url(#dry{u})"/>
  <path d="M200 300 C 230 330, 260 320, 290 350 M330 290 C 360 320, 400 310, 430 340 M220 380 C 260 400, 300 390, 340 420" stroke="{INK}" stroke-width="4" fill="none" opacity=".35" filter="url(#dry{u})"/>
  <g filter="url(#dry{u})">{strokes}</g>
  {''.join(f'<circle cx="{200 + R()*240:.0f}" cy="{262 + R()*30:.0f}" r="{1.5 + R()*2:.1f}" fill="{INK}" opacity=".6"/>' for _ in range(26))}
  <path d="M190 262 C 250 246, 360 246, 452 260" stroke="{INK}" stroke-width="6" fill="none" filter="url(#brush{u})"/>
  <g transform="translate(320 250)">
    <path d="M-120 -96 Q-60 -104 0 -150 Q60 -104 120 -96 Q100 -92 92 -80 Q40 -96 0 -128 Q-40 -96 -92 -80 Q-100 -92 -120 -96Z" fill="#3a2c24" stroke="{INK}" stroke-width="3" filter="url(#brush{u})"/>
    <path d="M-92 -80 H92 V-70 H-92Z" fill="#7a2a20" stroke="{INK}" stroke-width="2"/>
    <path d="M-92 -74 H92" stroke="{GOLD}" stroke-width="2"/>
    <path d="M0 -150 V-166" stroke="{INK}" stroke-width="4"/><circle cx="0" cy="-168" r="5" fill="{GOLD}" stroke="{INK}" stroke-width="2"/>
    <g fill="#9c3428" stroke="{INK}" stroke-width="2"><rect x="-80" y="-70" width="8" height="62"/><rect x="-28" y="-70" width="7" height="62"/><rect x="21" y="-70" width="7" height="62"/><rect x="72" y="-70" width="8" height="62"/></g>
    <path d="M-90 -30 H90 M-90 -18 H90" stroke="#5a2a18" stroke-width="3"/>
    <path d="M-80 -30 V-18 M-60 -30 V-18 M-40 -30 V-18 M-20 -30 V-18 M0 -30 V-18 M20 -30 V-18 M40 -30 V-18 M60 -30 V-18 M80 -30 V-18" stroke="#5a2a18" stroke-width="2"/>
    <path d="M-104 -8 H104 V4 H-104Z" fill="#6a5a4a" stroke="{INK}" stroke-width="2"/>
  </g>
  {needle_cluster(500, 170, 44, R, u)}{needle_cluster(540, 200, 36, R, u)}{needle_cluster(466, 214, 30, R, u)}
  <path d="M470 258 C 480 220, 476 200, 500 172 M490 210 C 510 204, 530 204, 540 200" stroke="{INK}" stroke-width="7" fill="none" stroke-linecap="round" filter="url(#brush{u})"/>'''
    return svg(w, h, body, u, seed)


# ───────── 먼 산 (수묵 번짐) ─────────
def ridge(R, w, base, amp, rough, n=8):
    pts = [[0, base - R() * amp * .4], [w, base - R() * amp * .4]]
    a = amp
    for _ in range(n):
        nxt = [pts[0]]
        for i in range(1, len(pts)):
            x1, y1 = pts[i - 1]; x2, y2 = pts[i]
            nxt += [[(x1 + x2) / 2 + (R() - .5) * (x2 - x1) * .2, (y1 + y2) / 2 - (R() - .35) * a], pts[i]]
        pts = nxt; a *= rough
    return pts


def mountains(w=1600, h=420, seed=7, layers=4, sun=True, alpha=1.0):
    u = 'mt%d' % seed
    R = rng(seed)
    grads = ''; paths = ''
    for i in range(layers):
        t = i / (layers - 1)
        dark = .2 + t * .55
        grads += f'<linearGradient id="g{u}{i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2e2a26" stop-opacity="{dark}"/><stop offset=".5" stop-color="#4a443c" stop-opacity="{dark*.5}"/><stop offset="1" stop-color="#6d6455" stop-opacity="0"/></linearGradient>'
        base = h * (.42 + t * .38); amp = h * (.5 - t * .22)
        pts = ridge(R, w, base, amp, .56)
        d = f'M0 {h} L' + ' L'.join(f'{x:.1f} {y:.1f}' for x, y in pts) + f' L{w} {h}Z'
        paths += f'<path d="{d}" fill="url(#g{u}{i})" filter="url(#wash{u})"/>'
        if i:
            for _ in range(5 + i * 3):
                x, y = pts[int(R() * (len(pts) - 2)) + 1]
                paths += f'<path d="M{x:.1f} {y+4:.1f} q {(R()-.5)*14:.1f} {14+R()*18:.1f} {(R()-.5)*8:.1f} {28+R()*26:.1f}" stroke="#2e2a26" stroke-opacity="{.15+t*.2:.2f}" stroke-width="{1.2+R()*1.5:.1f}" fill="none" filter="url(#dry{u})"/>'
    s = f'<circle cx="{w*.8}" cy="{h*.22}" r="{h*.11}" fill="#e2a54a" opacity=".55" filter="url(#soft{u})"/>' if sun else ''
    birds = ''.join(f'<path d="M{w*(.56+k*.03):.0f} {h*(.16+(k%2)*.04):.0f} q6 -6 12 0 q6 -6 12 0" stroke="#2e2a26" stroke-width="1.8" fill="none" opacity=".6"/>' for k in range(3))
    return svg(w, h, f'<defs>{grads}</defs><g opacity="{alpha}">{s}{paths}{birds}</g>', u, seed)


# ───────── 쌓인 옛 책(선장본) ─────────
def book_box(x, y, bw, bh, d, cover, title, u):
    top = f'M{x} {y} L{x+bw} {y} L{x+bw+d} {y-d*.6} L{x+d} {y-d*.6}Z'
    stitches = ''.join(f'<circle cx="{x+14}" cy="{y-d*.3 + 0:.0f}" r="0"/>' for _ in range(1))
    return f'''
  <path d="{top}" fill="{cover}" stroke="{INK}" stroke-width="2.5" filter="url(#grain{u})"/>
  <path d="M{x} {y} H{x+bw} V{y+bh} H{x}Z" fill="#efe1c0" stroke="{INK}" stroke-width="2.5"/>
  {''.join(f'<path d="M{x+4} {y+3+i*3.2:.1f} H{x+bw-4}" stroke="#c9b083" stroke-width="1"/>' for i in range(int(bh/3.2)-1))}
  <path d="M{x+bw} {y} L{x+bw+d} {y-d*.6} V{y+bh-d*.6} L{x+bw} {y+bh}Z" fill="{cover}" stroke="{INK}" stroke-width="2.5"/>
  <path d="M{x+bw+4} {y-2} L{x+bw+4} {y+bh-3} M{x+bw+d*.5} {y-d*.3} V{y+bh-d*.3}" stroke="{HANJI}" stroke-width="1.6" opacity=".8"/>
  <path d="M{x+bw*.12+d*.4} {y-d*.22} l{bw*.28} 0 l{d*.25} {-d*.25} l{-bw*.28} 0z" fill="{HANJI}" stroke="{INK}" stroke-width="1.4"/>
  {stitches}'''


def books(w=460, h=330):
    u = 'bk'
    body = '<ellipse cx="230" cy="300" rx="210" ry="26" fill="#000" opacity=".3" filter="url(#soft' + u + ')"/>'
    body += book_box(40, 240, 300, 46, 110, '#4a3a2c', '', u)
    body += book_box(60, 184, 280, 40, 104, '#3e5a52', '', u)
    body += book_box(48, 132, 290, 36, 100, '#6b3324', '', u)
    body += f'<path d="M330 300 C 360 290, 380 270, 392 236" stroke="{RED}" stroke-width="3" fill="none"/><circle cx="392" cy="234" r="5" fill="{RED}"/>'
    return svg(w, h, body, u)


# ───────── 구름(운문) ─────────
def cloud(w=420, h=150, color=None, stroke=None):
    u = 'cl'
    c = color or '#f6ead0'; st = stroke or '#9a7a4c'
    body = f'''
  <g filter="url(#brush{u})">
    <path d="M30 110 C 40 80, 80 76, 96 92 C 100 54, 150 44, 172 70 C 190 34, 250 34, 262 72 C 290 52, 336 62, 334 96 C 362 94, 386 110, 380 124 H40 C 30 124, 26 118, 30 110Z" fill="{c}" stroke="{st}" stroke-width="3.5"/>
    <path d="M120 96 c 0 -16 22 -18 24 -4 c 2 10 -12 12 -12 4 M200 82 c 2 -18 26 -18 26 -2 c 0 10 -14 10 -13 2 M290 98 c 0 -14 20 -14 20 -2 c 0 8 -11 8 -10 2" fill="none" stroke="{st}" stroke-width="3" stroke-linecap="round"/>
    <path d="M380 124 C 400 124, 410 132, 404 140 C 396 146, 384 140, 390 134" fill="none" stroke="{st}" stroke-width="3" stroke-linecap="round"/>
  </g>'''
    return svg(w, h, body, u)


ASSETS = {
    'prop_brush': brush_big, 'prop_inkstone': inkstone, 'prop_lantern': lantern, 'prop_pine': pine, 'prop_plum': plum,
    'prop_crane': crane, 'prop_pavilion': pavilion, 'prop_mountains': mountains,
    'prop_mountains_small': lambda: mountains(900, 300, 13, 3, False), 'prop_books': books, 'prop_cloud': cloud,
    'prop_cloud_gold': lambda: cloud(color='#f3d68d', stroke='#8a5a1c'),
}


# ───────── 책등(오침안정법 실 묶음) ─────────
def binding(w=130, h=1000):
    u = 'bd'
    holes = [0.1, 0.3, 0.5, 0.7, 0.9]
    loops = ''
    for f in holes:
        y = h * f
        loops += f'''<path d="M0 {y-9} H{w-34}" stroke="#efe3c6" stroke-width="7" stroke-linecap="round"/>
  <path d="M0 {y-9} H{w-34}" stroke="#a89470" stroke-width="7" stroke-dasharray="2 5" opacity=".6"/>
  <circle cx="{w-38}" cy="{y-9}" r="6" fill="#1a0f08"/>'''
    body = f'''
  <linearGradient id="bg{u}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2a1a10"/><stop offset=".55" stop-color="#5a3a24"/><stop offset="1" stop-color="#3a2416"/></linearGradient>
  <rect x="0" y="0" width="{w-18}" height="{h}" rx="6" fill="url(#bg{u})" filter="url(#grain{u})"/>
  <rect x="{w-22}" y="0" width="22" height="{h}" fill="#000" opacity=".25" filter="url(#soft{u})"/>
  <path d="M{w-60} 0 V{h}" stroke="#efe3c6" stroke-width="6"/>
  <path d="M{w-60} 0 V{h}" stroke="#a89470" stroke-width="6" stroke-dasharray="2 6" opacity=".6"/>
  {loops}
  <path d="M10 0 V{h}" stroke="{GOLD}" stroke-width="2" opacity=".5"/>'''
    return svg(w, h, body, u)


ASSETS['prop_binding'] = binding
ASSETS['prop_mountains_faint'] = lambda: mountains(900, 300, 13, 3, False, .45)
