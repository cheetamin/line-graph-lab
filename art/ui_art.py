# 버튼·책갈피·편액(큰 버튼) — 단청·한지·금박 느낌, 가로로 늘려도 양 끝 장식이 유지되도록(9칸 자르기) 설계
from defs import *


def plate(name, fill_top, fill_bot, line, deco, w=600, h=160, text_dark=False, pattern=True, band=True):
    """명패 모양 버튼: 그림 전체가 버튼 크기와 같고, 장식(단청 띠·여의두)은 양 끝 70px 안에만 있음.
    가운데(70~530)는 무늬 없는 글자 자리 → 9칸 자르기: 위아래 36, 좌우 70"""
    uid = name
    x0, x1, y0, y1, c = 6, w - 6, 8, h - 10, 18
    shape = lambda i: (f"M{x0+c+i} {y0+i} H{x1-c-i} A{c} {c} 0 0 0 {x1-i} {y0+c+i} V{y1-c-i} A{c} {c} 0 0 0 {x1-c-i} {y1-i} "
                       f"H{x0+c+i} A{c} {c} 0 0 0 {x0+i} {y1-c-i} V{y0+c+i} A{c} {c} 0 0 0 {x0+c+i} {y0+i}Z")
    ends = ''
    for side in (0, 1):
        if band:
            bx = 22 if side == 0 else w - 22 - 25
            for i, col in enumerate(['#2f6f62', GOLD, '#b8402f', GOLD, '#2f6f62']):
                ends += f'<rect x="{bx + i*5}" y="{y0+12}" width="5" height="{y1-y0-24}" fill="{col}"/>'
            ends += f'<rect x="{bx}" y="{y0+12}" width="25" height="{y1-y0-24}" fill="none" stroke="{INK}" stroke-width="1.6"/>'
        cx = 58 if side == 0 else w - 58
        ends += f'<path d="M{cx} {h/2-16} l9 16 l-9 16 l-9 -16z" fill="{deco}" stroke="{INK}" stroke-width="1.6"/>'
    body = f'''
  <linearGradient id="g{uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{fill_top}"/><stop offset=".6" stop-color="{fill_bot}"/><stop offset="1" stop-color="{fill_bot}"/></linearGradient>
  <linearGradient id="hl{uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <path d="{shape(0)}" transform="translate(0 2)" fill="#1a0d06" opacity=".35"/>
  <path d="{shape(0)}" fill="url(#g{uid})" stroke="{INK}" stroke-width="3.4" filter="url(#grain{uid})"/>
  <path d="{shape(8)}" fill="none" stroke="{deco}" stroke-width="2.4"/>
  <path d="{shape(0)}" fill="url(#hl{uid})"/>
  {ends}
'''
    return svg(w, h, body, uid)


def hyeonpan(w=900, h=230):
    """편액(현판) 모양 큰 버튼: 짙은 나무 틀 + 금빛 구름 모서리 + 한지 판"""
    uid = 'hp'
    body = f'''
  <linearGradient id="wood{uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6b3a1f"/><stop offset=".5" stop-color="#4a2512"/><stop offset="1" stop-color="#2f170a"/></linearGradient>
  <linearGradient id="paper{uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f8ecd0"/><stop offset="1" stop-color="#e6cf9f"/></linearGradient>
  <g filter="url(#shadow{uid})">
    <path d="M70 14 H{w-70} L{w-14} 60 V{h-60} L{w-70} {h-14} H70 L14 {h-60} V60 Z" fill="url(#wood{uid})" stroke="{INK}" stroke-width="4" filter="url(#grain{uid})"/>
  </g>
  <path d="M74 26 H{w-74} L{w-26} 64 V{h-64} L{w-74} {h-26} H74 L26 {h-64} V64 Z" fill="none" stroke="{GOLD}" stroke-width="3"/>
  <rect x="62" y="44" width="{w-124}" height="{h-88}" rx="6" fill="url(#paper{uid})" stroke="{RED_D}" stroke-width="4" filter="url(#grain{uid})"/>
  <rect x="72" y="54" width="{w-144}" height="{h-108}" rx="3" fill="none" stroke="{RED}" stroke-width="1.6" opacity=".7"/>
  {cloud_scroll(44, 44, 22, GOLD, INK, 2.4)}
  {cloud_scroll(w-44, 44, 22, GOLD, INK, 2.4, flip=True)}
  <g transform="translate(0 {h}) scale(1 -1)">{cloud_scroll(44, 44, 22, GOLD, INK, 2.4)}{cloud_scroll(w-44, 44, 22, GOLD, INK, 2.4, flip=True)}</g>
  <path d="M{w/2-60} 30 h120" stroke="{GOLD}" stroke-width="3" stroke-linecap="round"/>
  <path d="M{w/2-60} {h-30} h120" stroke="{GOLD}" stroke-width="3" stroke-linecap="round"/>
'''
    return svg(w, h, body, uid)


def tab(name, on=False, w=360, h=96):
    """왼쪽 메뉴 책갈피판: 한지 판 + 먹 테두리 + 매듭 끈 / 고른 것은 주칠 + 금테"""
    uid = name
    top, bot, edge, line = ('#b8402f', '#7a2017', INK, GOLD) if on else ('#f8ecd0', '#e3c993', INK2, '#9a6c3c')
    body = f'''
  <linearGradient id="g{uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{top}"/><stop offset="1" stop-color="{bot}"/></linearGradient>
  <g filter="url(#shadow{uid})">
    <path d="M18 12 H{w-40} L{w-14} {h/2} L{w-40} {h-12} H18 Q10 {h-12} 10 {h-20} V20 Q10 12 18 12Z" fill="url(#g{uid})" stroke="{edge}" stroke-width="3" filter="url(#grain{uid})"/>
  </g>
  <path d="M24 20 H{w-46} L{w-26} {h/2} L{w-46} {h-20} H24 Q19 {h-20} 19 {h-25} V25 Q19 20 24 20Z" fill="none" stroke="{line}" stroke-width="2"/>
  <path d="M{w-60} 24 q 10 {h/2-24} 0 {h-48}" fill="none" stroke="{line}" stroke-width="1.4" opacity=".7"/>
  {'<circle cx="%d" cy="%d" r="6" fill="%s" stroke="%s" stroke-width="2"/>' % (w-40, h/2, GOLD if on else RED, INK)}
'''
    return svg(w, h, body, uid)


def frame_corner(w=160, h=160):
    """책 쪽 모서리 장식: 금빛 꺾쇠 + 구름"""
    uid = 'fc'
    body = f'''
  <path d="M10 150 V30 Q10 10 30 10 H150" fill="none" stroke="{GOLD_D}" stroke-width="5" stroke-linecap="round"/>
  <path d="M24 150 V40 Q24 24 40 24 H150" fill="none" stroke="{GOLD}" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M38 120 V52 Q38 38 52 38 H120" fill="none" stroke="{RED}" stroke-width="2" opacity=".7"/>
  {cloud_scroll(40, 40, 16, GOLD, INK, 2)}
'''
    return svg(w, h, body, uid)


def divider(w=900, h=40):
    uid = 'dv'
    body = f'''
  <path d="M20 20 H{w/2-70}" stroke="{INK2}" stroke-width="2" filter="url(#brush{uid})"/>
  <path d="M{w/2+70} 20 H{w-20}" stroke="{INK2}" stroke-width="2" filter="url(#brush{uid})"/>
  <circle cx="20" cy="20" r="4" fill="{RED}"/><circle cx="{w-20}" cy="20" r="4" fill="{RED}"/>
  {cloud_scroll(w/2-34, 20, 13, GOLD, INK, 1.8, flip=True)}
  {cloud_scroll(w/2+34, 20, 13, GOLD, INK, 1.8)}
  <path d="M{w/2} 8 l9 12 l-9 12 l-9 -12z" fill="{RED}" stroke="{INK}" stroke-width="1.6"/>
'''
    return svg(w, h, body, uid)


def nav_arrow(direction='next', s=140):
    uid = 'ar' + direction
    flip = 'scale(-1 1) translate(-140 0)' if direction == 'prev' else ''
    body = f'''
  <radialGradient id="rg{uid}" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#c0503a"/><stop offset="1" stop-color="#6a1a12"/></radialGradient>
  <g filter="url(#shadow{uid})"><circle cx="70" cy="70" r="56" fill="url(#rg{uid})" stroke="{INK}" stroke-width="3"/></g>
  <circle cx="70" cy="70" r="47" fill="none" stroke="{GOLD}" stroke-width="3"/>
  <circle cx="70" cy="70" r="41" fill="none" stroke="{GOLD}" stroke-width="1" opacity=".7"/>
  <g transform="{flip}">
    <path d="M58 44 L84 70 L58 96" fill="none" stroke="{GOLD_L}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" filter="url(#brush{uid})"/>
  </g>
'''
    return svg(s, s, body, uid)


def dot(on, s=40):
    uid = 'dt' + ('1' if on else '0')
    body = f'<path d="M20 4 L36 20 L20 36 L4 20Z" fill="{RED if on else HANJI_D}" stroke="{INK}" stroke-width="2.4"/>' + (f'<path d="M20 11 L29 20 L20 29 L11 20Z" fill="{GOLD}"/>' if on else '')
    return svg(s, s, body, uid)


ASSETS = {
    'btn_red': lambda: plate('btnr', '#c24a35', '#821f16', INK, GOLD),
    'btn_jade': lambda: plate('btnj', '#3d8576', '#1d4c42', INK, GOLD),
    'btn_hanji': lambda: plate('btnh', '#fbf0d6', '#e2c891', INK, RED, text_dark=True),
    'btn_gold': lambda: plate('btng', '#f6d98c', '#c8973c', INK, RED_D),
    'btn_off': lambda: plate('btno', '#bdb5a6', '#8b8476', INK, '#efe8da', pattern=False, band=False),
    'btn_hyeonpan': hyeonpan,
    'tab_off': lambda: tab('tabo', False),
    'tab_on': lambda: tab('tabn', True),
    'frame_corner': frame_corner,
    'divider': divider,
    'arrow_next': lambda: nav_arrow('next'),
    'arrow_prev': lambda: nav_arrow('prev'),
    'dot_on': lambda: dot(True),
    'dot_off': lambda: dot(False),
}


def tile(name, on=False, s=120):
    uid = name
    top, bot, line = ('#3d8576', '#1d4c42', GOLD) if on else ('#fbf1d8', '#e6cf9c', '#9a6c3c')
    body = f'''
  <linearGradient id="g{uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{top}"/><stop offset="1" stop-color="{bot}"/></linearGradient>
  <g filter="url(#shadow{uid})"><rect x="8" y="8" width="{s-16}" height="{s-16}" rx="10" fill="url(#g{uid})" stroke="{INK}" stroke-width="3" filter="url(#grain{uid})"/></g>
  <rect x="16" y="16" width="{s-32}" height="{s-32}" rx="5" fill="none" stroke="{line}" stroke-width="2"/>
  <circle cx="16" cy="16" r="4" fill="{RED if not on else GOLD}" stroke="{INK}" stroke-width="1.5"/><circle cx="{s-16}" cy="16" r="4" fill="{RED if not on else GOLD}" stroke="{INK}" stroke-width="1.5"/>
  <circle cx="16" cy="{s-16}" r="4" fill="{RED if not on else GOLD}" stroke="{INK}" stroke-width="1.5"/><circle cx="{s-16}" cy="{s-16}" r="4" fill="{RED if not on else GOLD}" stroke="{INK}" stroke-width="1.5"/>
'''
    return svg(s, s, body, uid)


ASSETS['tile_off'] = lambda: tile('tlo', False)
ASSETS['tile_on'] = lambda: tile('tln', True)
