# 공용 SVG 정의: 먹 번짐·마른 붓·한지 결 필터, 색
INK = '#231811'
INK2 = '#3b2a1e'
RED = '#a3302a'
RED_D = '#6e1a14'
GOLD = '#d9a94e'
GOLD_L = '#f3d68d'
GOLD_D = '#9a6c22'
HANJI = '#f3e6c6'
HANJI_D = '#dfc795'
JADE = '#2f6f62'
JADE_D = '#1b4a40'


def defs(uid='a', seed=3):
    return f'''<defs>
  <filter id="brush{uid}" filterUnits="userSpaceOnUse" x="-200" y="-200" width="3600" height="3600">
    <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="{seed}" result="t"/>
    <feDisplacementMap in="SourceGraphic" in2="t" scale="3.2" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <filter id="rough{uid}" filterUnits="userSpaceOnUse" x="-200" y="-200" width="3600" height="3600">
    <feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves="2" seed="{seed + 1}" result="t"/>
    <feDisplacementMap in="SourceGraphic" in2="t" scale="5" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <filter id="dry{uid}" filterUnits="userSpaceOnUse" x="-200" y="-200" width="3600" height="3600">
    <feTurbulence type="fractalNoise" baseFrequency="0.9 0.05" numOctaves="2" seed="{seed + 2}" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 1.55" result="m"/>
    <feComposite in="SourceGraphic" in2="m" operator="in" result="c"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="{seed + 3}" result="t"/>
    <feDisplacementMap in="c" in2="t" scale="3"/>
  </filter>
  <filter id="wash{uid}" filterUnits="userSpaceOnUse" x="-200" y="-200" width="3600" height="3600">
    <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="4" seed="{seed + 4}" result="t"/>
    <feDisplacementMap in="SourceGraphic" in2="t" scale="14" result="d"/>
    <feGaussianBlur in="d" stdDeviation="1.6"/>
  </filter>
  <filter id="soft{uid}"><feGaussianBlur stdDeviation="3"/></filter>
  <filter id="grain{uid}" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="3" seed="{seed + 5}" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.35  0 0 0 0 0.24  0 0 0 0 0.1  0 0 0 0.22 0" result="g"/>
    <feComposite in="g" in2="SourceGraphic" operator="in" result="gg"/>
    <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="gg"/></feMerge>
  </filter>
  <filter id="shadow{uid}" x="-20%" y="-20%" width="140%" height="160%">
    <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#1a0d06" flood-opacity=".45"/>
  </filter>
  <filter id="glow{uid}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14"/></filter>
</defs>'''


def svg(w, h, body, uid='a', seed=3):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">{defs(uid, seed)}{body}</svg>'


def ruyi(cx, cy, r, color, stroke, sw=2.5, rot=0):
    """여의두문: 세 갈래 하트 모양 구름 머리 + 안쪽 소용돌이"""
    k = r / 50
    return f'''<g transform="translate({cx} {cy}) rotate({rot}) scale({k}) translate(-50 -50)">
  <path d="M50 94 C30 82 6 72 8 48 C10 28 30 22 39 35 C34 16 44 6 50 6 C56 6 66 16 61 35 C70 22 90 28 92 48 C94 72 70 82 50 94Z" fill="{color}" stroke="{stroke}" stroke-width="{sw / k}" stroke-linejoin="round"/>
  <path d="M27 54 c-2 -9 10 -12 13 -5 c2 5 -4 8 -6 4" fill="none" stroke="{stroke}" stroke-width="{sw * .8 / k}" stroke-linecap="round"/>
  <path d="M73 54 c2 -9 -10 -12 -13 -5 c-2 5 4 8 6 4" fill="none" stroke="{stroke}" stroke-width="{sw * .8 / k}" stroke-linecap="round"/>
  <path d="M50 86 V48 c0 -8 -9 -9 -10 -3 c-1 4 4 6 6 3" fill="none" stroke="{stroke}" stroke-width="{sw * .8 / k}" stroke-linecap="round"/>
</g>'''


def cloud_scroll(cx, cy, r, color, stroke, sw=2.5, flip=False):
    """버튼 양 끝용: 바깥을 향한 여의두"""
    return ruyi(cx, cy, r * 1.15, color, stroke, sw, rot=90 if flip else -90)
