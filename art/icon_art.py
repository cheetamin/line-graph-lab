# 먹으로 그린 듯한 아이콘(160×160, 투명 배경) — 먹선 + 주홍 낙관 + 금빛 포인트
from defs import *

S = 160


def ink(d, w=7, color=INK, uid='x', extra=''):
    return f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round" filter="url(#brush{uid})" {extra}/>'


def wrap(uid, body):
    return svg(S, S, body, uid, seed=len(uid) * 7)


def home():
    u = 'ih'
    return wrap(u, f'''
  <path d="M14 66 Q40 60 80 30 Q120 60 146 66 Q120 62 80 42 Q40 62 14 66Z" fill="{INK}" filter="url(#brush{u})"/>
  <path d="M30 70 Q56 66 80 50 Q104 66 130 70" fill="none" stroke="{RED}" stroke-width="4" filter="url(#brush{u})"/>
  {ink('M40 74 V128 M120 74 V128 M28 130 H132', 7, INK, u)}
  <rect x="64" y="90" width="32" height="38" fill="{RED}" stroke="{INK}" stroke-width="4" filter="url(#brush{u})"/>
  {ink('M80 92 V126', 2.5, GOLD, u)}''')


def weather():
    u = 'iw'
    return wrap(u, f'''
  <circle cx="98" cy="56" r="30" fill="{RED}" filter="url(#brush{u})"/>
  <circle cx="98" cy="56" r="30" fill="none" stroke="{INK}" stroke-width="3" filter="url(#brush{u})" opacity=".6"/>
  {ink('M98 14 V20 M136 56 H142 M127 27 l4 -4 M127 85 l4 4', 5, RED, u)}
  <g transform="translate(64 100)">
    <path d="M-50 22 Q-58 4 -38 -2 Q-36 -24 -12 -20 Q0 -38 22 -26 Q44 -30 46 -8 Q64 -2 56 18 Q50 26 36 24 H-40 Q-48 26 -50 22Z" fill="{HANJI}" stroke="{INK}" stroke-width="5.5" stroke-linejoin="round" filter="url(#brush{u})"/>
    {ink('M-26 6 q 10 -12 22 -2 q 8 6 18 -4', 4, INK2, u)}
  </g>''')


def vote():
    u = 'iv'
    return wrap(u, f'''
  <path d="M38 34 L84 22 L96 74 L50 86Z" fill="{HANJI}" stroke="{INK}" stroke-width="4.5" filter="url(#brush{u})"/>
  {ink('M50 44 l30 -8 M54 56 l30 -8 M58 68 l18 -5', 3, INK2, u)}
  <circle cx="82" cy="66" r="9" fill="{RED}" filter="url(#brush{u})"/>
  <path d="M22 80 H138 V138 H22Z" fill="#7a4524" stroke="{INK}" stroke-width="5" filter="url(#brush{u})"/>
  <path d="M22 80 H138 V94 H22Z" fill="#5a3018" stroke="{INK}" stroke-width="3" filter="url(#brush{u})"/>
  {ink('M54 87 H106', 6, INK, u)}
  <path d="M62 104 h36 v22 h-36z" fill="none" stroke="{GOLD}" stroke-width="3" filter="url(#brush{u})"/>
  {cloud_scroll(80, 115, 7, GOLD, INK, 1.4)}''')


def table():
    u = 'it'
    return wrap(u, f'''
  <path d="M22 26 H138 V136 H22Z" fill="{HANJI}" stroke="{INK}" stroke-width="5" filter="url(#brush{u})"/>
  <path d="M22 26 H138 V52 H22Z" fill="#e7cf9b" stroke="none"/>
  {ink('M22 52 H138 M22 80 H138 M22 108 H138 M58 26 V136 M98 26 V136', 3.4, INK2, u)}
  {ink('M30 40 h18 M66 40 h22 M106 40 h22', 3, INK, u)}
  {ink('M70 94 h16 M108 66 h18 M66 122 h22', 3, RED, u)}
  <rect x="112" y="112" width="22" height="22" rx="3" fill="{RED}" filter="url(#brush{u})"/>''')


def graph():
    u = 'ig'
    return wrap(u, f'''
  <path d="M20 22 H140 V140 H20Z" fill="{HANJI}" stroke="{INK}" stroke-width="4.5" filter="url(#brush{u})"/>
  {ink('M36 34 V124 H130', 5, INK, u)}
  {ink('M36 58 H130 M36 82 H130 M36 106 H130', 1.4, '#a68b63', u)}
  {ink('M46 110 L68 78 L88 92 L112 50 L126 62', 6, RED, u)}
  <g fill="{RED}" stroke="{INK}" stroke-width="2.4">
    <circle cx="46" cy="110" r="6"/><circle cx="68" cy="78" r="6"/><circle cx="88" cy="92" r="6"/><circle cx="112" cy="50" r="6"/><circle cx="126" cy="62" r="6"/>
  </g>''')


def gallery():
    u = 'ig2'
    panels = ''
    for i in range(4):
        x = 18 + i * 32
        skew = 6 if i % 2 == 0 else -6
        panels += f'<path d="M{x} {34+skew} L{x+32} {34-skew} L{x+32} {126-skew} L{x} {126+skew}Z" fill="{HANJI}" stroke="{INK}" stroke-width="4" filter="url(#brush{u})"/>'
    return wrap(u, f'''
  {panels}
  <path d="M26 104 Q44 70 58 92 Q70 62 90 88 Q104 70 118 92 Q130 78 142 100" fill="none" stroke="{INK2}" stroke-width="4" filter="url(#brush{u})"/>
  <path d="M26 110 Q60 96 90 106 Q120 96 142 108 L142 120 L26 126Z" fill="{INK}" opacity=".18" filter="url(#wash{u})"/>
  <circle cx="112" cy="58" r="9" fill="{RED}" filter="url(#brush{u})"/>
  {ink('M18 140 H146', 5, '#6b3a1f', u)}''')


def search():
    u = 'is'
    return wrap(u, f'''
  <circle cx="66" cy="66" r="38" fill="{HANJI}" fill-opacity=".55" stroke="{INK}" stroke-width="8" filter="url(#brush{u})"/>
  <circle cx="66" cy="66" r="30" fill="none" stroke="{GOLD}" stroke-width="2.5"/>
  {ink('M52 50 q 10 -8 22 -4', 4, '#fff', u, 'opacity=".8"')}
  <path d="M94 94 L132 132" stroke="#6b3a1f" stroke-width="16" stroke-linecap="round" filter="url(#brush{u})"/>
  <path d="M94 94 L132 132" stroke="{INK}" stroke-width="16" stroke-linecap="round" fill="none" opacity=".25"/>
  <circle cx="102" cy="102" r="7" fill="{GOLD}" stroke="{INK}" stroke-width="2.5"/>''')


def book():
    u = 'ib'
    return wrap(u, f'''
  <path d="M30 22 H128 Q136 22 136 30 V134 Q136 140 128 140 H30Z" fill="#3e5a52" stroke="{INK}" stroke-width="5" filter="url(#brush{u})"/>
  <path d="M30 128 H134 V140 H30Z" fill="{HANJI_D}" stroke="{INK}" stroke-width="3"/>
  {ink('M44 22 V140', 3, HANJI, u)}
  <g fill="{HANJI}"><circle cx="38" cy="36" r="3"/><circle cx="38" cy="60" r="3"/><circle cx="38" cy="84" r="3"/><circle cx="38" cy="108" r="3"/><circle cx="38" cy="124" r="3"/></g>
  <rect x="94" y="34" width="26" height="72" fill="{HANJI}" stroke="{INK}" stroke-width="3"/>
  {ink('M107 44 V96', 3.5, INK, u)}
  <rect x="98" y="88" width="18" height="14" fill="{RED}"/>''')


def scroll():
    u = 'isc'
    return wrap(u, f'''
  <rect x="34" y="34" width="92" height="92" fill="{HANJI}" stroke="{INK}" stroke-width="4" filter="url(#brush{u})"/>
  {ink('M50 56 H110 M50 74 H110 M50 92 H96', 4, INK2, u)}
  <rect x="98" y="100" width="18" height="18" rx="2" fill="{RED}"/>
  <rect x="20" y="22" width="120" height="16" rx="8" fill="#7a4524" stroke="{INK}" stroke-width="4"/>
  <rect x="20" y="122" width="120" height="16" rx="8" fill="#7a4524" stroke="{INK}" stroke-width="4"/>
  <circle cx="18" cy="30" r="7" fill="{GOLD}" stroke="{INK}" stroke-width="3"/><circle cx="142" cy="30" r="7" fill="{GOLD}" stroke="{INK}" stroke-width="3"/>
  <circle cx="18" cy="130" r="7" fill="{GOLD}" stroke="{INK}" stroke-width="3"/><circle cx="142" cy="130" r="7" fill="{GOLD}" stroke="{INK}" stroke-width="3"/>''')


def brush_icon():
    u = 'ibr'
    return wrap(u, f'''
  <g transform="rotate(40 80 80)">
    <path d="M80 4 V8" stroke="{RED}" stroke-width="3"/>
    <path d="M76 2 q 4 -6 8 0" fill="none" stroke="{RED}" stroke-width="2.5"/>
    <rect x="73" y="8" width="14" height="78" rx="6" fill="#b98a4a" stroke="{INK}" stroke-width="3"/>
    <path d="M73 30 h14 M73 56 h14" stroke="#7a5426" stroke-width="2.5"/>
    <rect x="71" y="84" width="18" height="14" rx="3" fill="{INK}"/>
    <path d="M71 98 Q66 118 80 156 Q94 118 89 98Z" fill="#f4ecd9" stroke="{INK}" stroke-width="3" filter="url(#brush{u})"/>
    <path d="M74 126 Q76 142 80 156 Q85 142 86 126 Q80 132 74 126Z" fill="{INK}" filter="url(#brush{u})"/>
  </g>''')


def town():
    # 우리 고장: 성문 누각 + 유등(등불) — 3차 생활 활동
    u = 'it'
    return wrap(u, f'''
  <path d="M24 58 Q52 52 80 30 Q108 52 136 58 Q108 56 80 40 Q52 56 24 58Z" fill="{INK}" filter="url(#brush{u})"/>
  {ink('M36 62 H124', 5, RED, u)}
  {ink('M44 64 V96 M116 64 V96', 6, INK, u)}
  <path d="M18 98 H142 V134 H18Z" fill="{HANJI}" stroke="{INK}" stroke-width="5" stroke-linejoin="round" filter="url(#brush{u})"/>
  <path d="M64 134 V116 Q80 100 96 116 V134" fill="{INK2}" stroke="{INK}" stroke-width="4" filter="url(#brush{u})"/>
  {ink('M26 110 H54 M106 110 H134 M26 122 H54 M106 122 H134', 2.5, INK2, u)}
  <g transform="translate(128 26)">
    {ink('M0 -12 V-4', 2.5, INK, u)}
    <ellipse cx="0" cy="8" rx="11" ry="13" fill="{RED}" stroke="{INK}" stroke-width="3" filter="url(#brush{u})"/>
    <ellipse cx="0" cy="8" rx="4" ry="6" fill="{GOLD}" opacity=".85"/>
  </g>''')


def seal(ch, bg=RED):
    u = 'isl' + ch
    return wrap(u, f'''
  <rect x="24" y="24" width="112" height="112" rx="14" fill="{bg}" filter="url(#rough{u})" transform="rotate(-4 80 80)"/>
  <rect x="36" y="36" width="88" height="88" rx="6" fill="none" stroke="#f6dcc4" stroke-width="4" filter="url(#rough{u})" transform="rotate(-4 80 80)"/>
  <text x="80" y="104" text-anchor="middle" font-size="66" font-family="serif" fill="#f8e4cc" transform="rotate(-4 80 80)" filter="url(#rough{u})">{ch}</text>''')


ASSETS = {
    'icon_home': home, 'icon_weather': weather, 'icon_vote': vote, 'icon_table': table, 'icon_graph': graph,
    'icon_gallery': gallery, 'icon_search': search, 'icon_book': book, 'icon_scroll': scroll, 'icon_brush': brush_icon, 'icon_town': town,
    'seal_lock': lambda: seal('封'), 'seal_done': lambda: seal('完'), 'seal_show': lambda: seal('展'), 'seal_wait': lambda: seal('待'), 'seal_table': lambda: seal('表'),
}
