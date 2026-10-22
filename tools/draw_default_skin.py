#!/usr/bin/env python3
"""Genera la skin de serie («Noa») como capas SVG alineadas:
base.svg, eyes_closed.svg, mouth_half.svg, mouth_open.svg y skin.json con el rig.
Personaje original: pelo negro con puntas magenta, cascos con orejas de gato, sudadera oscura.
"""
import json
import math
import os
import sys

W, H = 800, 1000
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..', 'assets', 'skins', 'default')
os.makedirs(OUT, exist_ok=True)

# ---------------------------------------------------------------- paleta
SKIN = '#ffe8de'
SKIN_SH = '#f7cdbf'
SKIN_SH2 = '#eeb7a8'
LINE = '#22141f'
HAIR = '#231a31'
HAIR_2 = '#33264a'
HAIR_HI = '#5d4a82'
HAIR_TIP = '#d0468a'
HOOD = '#2a2434'
HOOD_2 = '#211c2a'
HOOD_HI = '#3a3348'
NEON = '#ff4f9a'
LILAC = '#b69cff'
PHONES = '#1b1724'
PHONES_HI = '#3a3149'

EYE_L = (326, 404)
EYE_R = (474, 404)
EYE_W, EYE_H = 98, 108
MOUTH = (400, 512)
NECK = (400, 575)


def mirror_path(pts):
    return [(W - x, y) for x, y in pts]


def p(cmds):
    return ' '.join(cmds)


def fmt(x, y):
    return f'{x:.1f} {y:.1f}'


# ---------------------------------------------------------------- formas
FACE = (
    'M 238 384 C 236 252 306 186 400 186 C 494 186 564 252 562 384 '
    'C 560 458 528 518 470 552 C 442 568 421 574 400 574 C 379 574 358 568 330 552 '
    'C 272 518 240 458 238 384 Z'
)

HAIR_BACK = (
    'M 400 98 C 248 98 156 204 150 368 C 144 528 168 664 132 820 '
    'L 176 798 L 186 880 L 228 812 L 262 896 L 300 800 L 500 800 L 538 896 L 572 812 '
    'L 614 880 L 624 798 L 668 820 C 632 664 656 528 650 368 C 644 204 552 98 400 98 Z'
)


def bangs_path():
    """Flequillo: contorno superior + mechones en forma de hoja con curvas."""
    left = (234, 384)
    right = (566, 384)
    cmds = [f'M {fmt(*left)} C 222 236 302 150 400 148 C 498 150 578 236 {fmt(*right)}']
    # de derecha a izquierda: valle, punta, valle, punta...
    seq = [(556, 300), (538, 352), (514, 262), (488, 336), (462, 256), (432, 344),
           (410, 262), (386, 334), (360, 256), (334, 340), (306, 266), (278, 330), (258, 292)]
    prev = right
    for i, pt in enumerate(seq):
        is_tip = i % 2 == 1
        px, py = prev
        x, y = pt
        if is_tip:  # de valle a punta: hoja que se curva
            cmds.append(f'C {fmt(px - 3, py + 30)} {fmt(x + 9, y - 24)} {fmt(x, y)}')
        else:  # de punta (o sien) a valle
            cmds.append(f'C {fmt(px - 5, py - 26)} {fmt(x + 7, y + 24)} {fmt(x, y)}')
        prev = pt
    cmds.append(f'C {fmt(prev[0] - 6, prev[1] + 30)} {fmt(238, 350)} {fmt(*left)} Z')
    return ' '.join(cmds)


BANGS = bangs_path()

SIDE_LOCK_L = 'M 262 248 C 234 320 228 430 236 520 C 242 590 234 650 210 714 C 252 664 268 600 270 530 C 270 450 256 372 274 290 Z'
SIDE_LOCK_L2 = 'M 256 330 C 246 420 250 520 246 600 C 244 640 236 670 226 694'


def mirror_d(d):
    out = []
    toks = d.replace(',', ' ').split()
    i = 0
    nums = []
    res = []
    for t in toks:
        try:
            nums.append(float(t))
        except ValueError:
            if nums:
                res.append(nums)
                nums = []
            res.append(t)
    if nums:
        res.append(nums)
    for item in res:
        if isinstance(item, list):
            pts = []
            for j in range(0, len(item), 2):
                pts.append(f'{W - item[j]:.1f} {item[j + 1]:.1f}')
            out.append(' '.join(pts))
        else:
            out.append(item)
    return ' '.join(out)


SIDE_LOCK_R = mirror_d(SIDE_LOCK_L)
SIDE_LOCK_R2 = mirror_d(SIDE_LOCK_L2)

BODY = (
    'M 222 712 C 252 662 316 640 366 632 L 434 632 C 484 640 548 662 578 712 '
    'C 606 770 622 880 632 1000 L 168 1000 C 178 880 194 770 222 712 Z'
)
ARM_L = 'M 222 712 C 198 770 186 870 180 1000 L 238 1000 C 240 900 246 818 262 752 C 252 736 238 722 222 712 Z'
ARM_R = mirror_d(ARM_L)
HOOD_BACK = 'M 306 664 C 310 616 354 596 400 596 C 446 596 490 616 494 664 C 466 646 434 638 400 638 C 366 638 334 646 306 664 Z'
NECK_SHAPE = 'M 368 540 L 432 540 L 438 640 Q 400 668 362 640 Z'
COLLAR_V = 'M 356 634 Q 400 700 444 634 Z'


def eye(cx, cy, side, gid):
    """Ojo grande estilo anime. side=-1 izquierda (exterior a la izquierda), +1 derecha."""
    s = side
    w, h = EYE_W, EYE_H
    hw = w / 2
    # forma del ojo (zona visible bajo el párpado)
    ox = cx + s * hw * 0.98   # esquina exterior
    ix = cx - s * hw * 0.92   # esquina interior
    shape = (
        f'M {fmt(ix, cy - 10)} '
        f'C {fmt(ix + s * 22, cy - 46)} {fmt(ox - s * 28, cy - 52)} {fmt(ox, cy - 22)} '
        f'C {fmt(ox + s * 4, cy + 24)} {fmt(cx + s * 26, cy + 56)} {fmt(cx, cy + 56)} '
        f'C {fmt(cx - s * 30, cy + 56)} {fmt(ix - s * 4, cy + 26)} {fmt(ix, cy - 10)} Z'
    )
    lash = (
        f'M {fmt(ix - s * 6, cy - 6)} '
        f'C {fmt(ix + s * 18, cy - 54)} {fmt(ox - s * 26, cy - 62)} {fmt(ox + s * 10, cy - 30)} '
        f'L {fmt(ox + s * 15, cy - 40)} L {fmt(ox + s * 9, cy - 20)} '
        f'C {fmt(ox - s * 10, cy - 40)} {fmt(ix + s * 22, cy - 40)} {fmt(ix - s * 2, cy - 2)} Z'
    )
    lower = f'M {fmt(cx - s * 18, cy + 55)} Q {fmt(cx + s * 8, cy + 60)} {fmt(cx + s * 30, cy + 46)}'
    iris_cx, iris_cy = cx + s * 2, cy + 8
    g = f'''
  <g id="{gid}">
    <clipPath id="{gid}-clip"><path d="{shape}"/></clipPath>
    <path d="{shape}" fill="#fff6fa"/>
    <g clip-path="url(#{gid}-clip)">
      <ellipse cx="{iris_cx}" cy="{iris_cy}" rx="35" ry="45" fill="url(#iris)" stroke="#2a1445" stroke-width="3.5"/>
      <ellipse cx="{iris_cx}" cy="{iris_cy + 4}" rx="15" ry="22" fill="#2a1038" opacity="0.88"/>
      <ellipse cx="{iris_cx}" cy="{iris_cy + 26}" rx="24" ry="13" fill="#ffc2e4" opacity="0.45"/>
      <path d="M {fmt(cx - 50, cy - 40)} L {fmt(cx + 50, cy - 40)} L {fmt(cx + 50, cy - 18)} Q {fmt(cx, cy - 4)} {fmt(cx - 50, cy - 18)} Z" fill="#7a5e8e" opacity="0.28"/>
      <circle cx="{iris_cx - 13}" cy="{iris_cy - 17}" r="11" fill="#ffffff"/>
      <circle cx="{iris_cx + 13}" cy="{iris_cy + 20}" r="5" fill="#ffffff" opacity="0.95"/>
      <circle cx="{iris_cx - 16}" cy="{iris_cy + 10}" r="2.6" fill="#ffffff" opacity="0.8"/>
    </g>
    <path d="{lash}" fill="{LINE}"/>
    <path d="{lower}" fill="none" stroke="#7b4062" stroke-width="3.2" stroke-linecap="round"/>
  </g>'''
    return g, shape


def defs():
    return f'''
  <defs>
    <linearGradient id="hairBack" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{HAIR}"/>
      <stop offset="0.55" stop-color="{HAIR_2}"/>
      <stop offset="0.78" stop-color="#5a2a62"/>
      <stop offset="1" stop-color="{HAIR_TIP}"/>
    </linearGradient>
    <linearGradient id="lock" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{HAIR}"/>
      <stop offset="0.6" stop-color="{HAIR_2}"/>
      <stop offset="1" stop-color="{HAIR_TIP}"/>
    </linearGradient>
    <linearGradient id="bangs" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2b2140"/>
      <stop offset="1" stop-color="{HAIR}"/>
    </linearGradient>
    <linearGradient id="iris" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3a1e6e"/>
      <stop offset="0.45" stop-color="#8f45d6"/>
      <stop offset="0.8" stop-color="#e46cc8"/>
      <stop offset="1" stop-color="#ffa3d6"/>
    </linearGradient>
    <linearGradient id="hood" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{HOOD_HI}"/>
      <stop offset="0.35" stop-color="{HOOD}"/>
      <stop offset="1" stop-color="{HOOD_2}"/>
    </linearGradient>
    <radialGradient id="blush" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#ff8fb3" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#ff8fb3" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="neckShade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{SKIN_SH2}"/>
      <stop offset="0.45" stop-color="{SKIN_SH}"/>
      <stop offset="1" stop-color="{SKIN}"/>
    </linearGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5"/></filter>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
    <clipPath id="faceClip"><path d="{FACE}"/></clipPath>
  </defs>'''


def face_group():
    return f'''
  <g id="face">
    <path d="{FACE}" fill="{SKIN}"/>
    <g clip-path="url(#faceClip)">
      <path d="{BANGS}" fill="{SKIN_SH}" transform="translate(0 10)" filter="url(#soft)" opacity="0.9"/>
      <ellipse cx="300" cy="470" rx="44" ry="20" fill="url(#blush)"/>
      <ellipse cx="500" cy="470" rx="44" ry="20" fill="url(#blush)"/>
      <path d="M 288 462 l 8 -8 M 304 464 l 8 -8 M 488 462 l 8 -8 M 504 464 l 8 -8" stroke="#f08aa8" stroke-width="2.4" stroke-linecap="round" opacity="0.7"/>
    </g>
    <path d="{FACE}" fill="none" stroke="{LINE}" stroke-width="3.2" stroke-linejoin="round"/>
    <path d="M 398 468 q 4 4 8 1" fill="none" stroke="#d79a8c" stroke-width="2.6" stroke-linecap="round"/>
  </g>'''


def bangs_group():
    return f'''
  <g id="bangs">
    <path d="{BANGS}" fill="url(#bangs)" stroke="{LINE}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M 300 226 Q 330 206 356 218 M 372 210 Q 400 196 428 210 M 444 218 Q 470 206 500 226" fill="none" stroke="{HAIR_HI}" stroke-width="9" stroke-linecap="round" opacity="0.75"/>
    <path d="M 320 262 Q 336 300 334 322 M 408 252 Q 414 300 410 330 M 478 262 Q 470 300 474 320" fill="none" stroke="{HAIR_2}" stroke-width="3" stroke-linecap="round" opacity="0.9"/>
  </g>'''


def brows():
    return f'''
  <g id="brows" opacity="0.6">
    <path d="M 290 326 Q 318 312 350 320" fill="none" stroke="#3b2640" stroke-width="5" stroke-linecap="round"/>
    <path d="M 450 320 Q 482 312 510 326" fill="none" stroke="#3b2640" stroke-width="5" stroke-linecap="round"/>
  </g>'''


def mouth_closed():
    mx, my = MOUTH
    return f'''
  <g id="mouth">
    <path d="M {mx - 17} {my - 3} Q {mx} {my + 10} {mx + 17} {my - 4}" fill="none" stroke="#9a4a5a" stroke-width="3.4" stroke-linecap="round"/>
  </g>'''


def mouth_open(level):
    mx, my = MOUTH
    if level == 'half':
        hw, top, bot = 15, my - 5, my + 12
    else:
        hw, top, bot = 18, my - 7, my + 22
    shape = (
        f'M {mx - hw - 2} {top + 1} Q {mx} {top + 4} {mx + hw + 2} {top} '
        f'C {mx + hw + 1} {bot - 6} {mx + 8} {bot} {mx} {bot} '
        f'C {mx - 8} {bot} {mx - hw - 1} {bot - 6} {mx - hw - 2} {top + 1} Z'
    )
    tongue_y = bot - (5 if level == 'half' else 9)
    return f'''
  <g id="mouth-{level}">
    <clipPath id="mclip-{level}"><path d="{shape}"/></clipPath>
    <path d="{shape}" fill="#5a1a2c"/>
    <g clip-path="url(#mclip-{level})">
      <ellipse cx="{mx}" cy="{bot + 2}" rx="{hw - 2}" ry="{bot - tongue_y + 2}" fill="#e2788c"/>
      <rect x="{mx - hw}" y="{top - 2}" width="{hw * 2}" height="{4 if level == 'half' else 6}" fill="#fff6fa" opacity="0.95"/>
    </g>
    <path d="{shape}" fill="none" stroke="#7a2d3e" stroke-width="2.6" stroke-linejoin="round"/>
  </g>'''


def headphones():
    cup = lambda x: f'''
    <rect x="{x - 32}" y="330" width="64" height="112" rx="30" fill="{PHONES}" stroke="{LINE}" stroke-width="3"/>
    <rect x="{x - 21}" y="346" width="42" height="80" rx="20" fill="none" stroke="{NEON}" stroke-width="3.5"/>
    <rect x="{x - 21}" y="346" width="42" height="80" rx="20" fill="none" stroke="{NEON}" stroke-width="6" opacity="0.45" filter="url(#glow)"/>
    <circle cx="{x}" cy="386" r="5" fill="{LILAC}"/>'''
    ear_l = 'M 258 214 L 272 112 Q 278 96 292 106 L 346 172 Z'
    ear_l_in = 'M 274 196 L 284 132 L 324 176 Z'
    return f'''
  <g id="phones">
    <path d="M 214 352 C 206 92 594 92 586 352" fill="none" stroke="{LINE}" stroke-width="28" stroke-linecap="round"/>
    <path d="M 214 352 C 206 92 594 92 586 352" fill="none" stroke="{PHONES}" stroke-width="22" stroke-linecap="round"/>
    <path d="M 226 300 C 226 128 574 128 574 300" fill="none" stroke="{PHONES_HI}" stroke-width="4" stroke-linecap="round"/>
    <path d="{ear_l}" fill="{PHONES}" stroke="{LINE}" stroke-width="3" stroke-linejoin="round"/>
    <path d="{ear_l_in}" fill="{NEON}" opacity="0.9"/>
    <path d="{mirror_d(ear_l)}" fill="{PHONES}" stroke="{LINE}" stroke-width="3" stroke-linejoin="round"/>
    <path d="{mirror_d(ear_l_in)}" fill="{NEON}" opacity="0.9"/>
    {cup(206)}
    {cup(594)}
  </g>'''


def body_group():
    return f'''
  <g id="body">
    <path d="{HOOD_BACK}" fill="{HOOD_HI}" stroke="{LINE}" stroke-width="3" stroke-linejoin="round"/>
    <path d="{NECK_SHAPE}" fill="url(#neckShade)" stroke="{LINE}" stroke-width="3" stroke-linejoin="round"/>
    <rect x="362" y="590" width="76" height="16" rx="5" fill="#16121c" stroke="{LINE}" stroke-width="2"/>
    <circle cx="400" cy="614" r="8" fill="none" stroke="#dcd6ea" stroke-width="3.2"/>
    <path d="{BODY}" fill="url(#hood)" stroke="{LINE}" stroke-width="3.2" stroke-linejoin="round"/>
    <path d="{ARM_L}" fill="{HOOD_2}" stroke="{LINE}" stroke-width="3" stroke-linejoin="round"/>
    <path d="{ARM_R}" fill="{HOOD_2}" stroke="{LINE}" stroke-width="3" stroke-linejoin="round"/>
    <path d="{COLLAR_V}" fill="#17131e" stroke="{LINE}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M 334 652 Q 400 720 466 652" fill="none" stroke="{HOOD_HI}" stroke-width="10" stroke-linecap="round"/>
    <path d="M 334 652 Q 400 720 466 652" fill="none" stroke="{LINE}" stroke-width="3" stroke-linecap="round"/>
    <path d="M 378 688 C 374 730 380 770 372 812" fill="none" stroke="{NEON}" stroke-width="6" stroke-linecap="round"/>
    <path d="M 422 688 C 428 732 420 772 430 816" fill="none" stroke="{NEON}" stroke-width="6" stroke-linecap="round"/>
    <rect x="366" y="808" width="12" height="20" rx="4" fill="#e9e4f2" stroke="{LINE}" stroke-width="2"/>
    <rect x="424" y="812" width="12" height="20" rx="4" fill="#e9e4f2" stroke="{LINE}" stroke-width="2"/>
    <path d="M 500 744 a 22 22 0 1 0 14 36 a 17 17 0 1 1 -14 -36 Z" fill="{LILAC}" opacity="0.9"/>
    <path d="M 290 920 Q 400 900 510 920" fill="none" stroke="#18141f" stroke-width="3" opacity="0.8"/>
  </g>'''


def svg(content, with_defs=True):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">{defs() if with_defs else ""}{content}\n</svg>\n'


eye_l_svg, eye_l_shape = eye(*EYE_L, -1, 'eyeL')
eye_r_svg, eye_r_shape = eye(*EYE_R, +1, 'eyeR')

side_locks = f'''
  <g id="locks">
    <path d="{SIDE_LOCK_L}" fill="url(#lock)" stroke="{LINE}" stroke-width="3" stroke-linejoin="round"/>
    <path d="{SIDE_LOCK_L2}" fill="none" stroke="{HAIR_HI}" stroke-width="3" stroke-linecap="round" opacity="0.7"/>
    <path d="{SIDE_LOCK_R}" fill="url(#lock)" stroke="{LINE}" stroke-width="3" stroke-linejoin="round"/>
    <path d="{SIDE_LOCK_R2}" fill="none" stroke="{HAIR_HI}" stroke-width="3" stroke-linecap="round" opacity="0.7"/>
  </g>'''

hair_back = f'''
  <g id="hairBack">
    <path d="{HAIR_BACK}" fill="url(#hairBack)" stroke="{LINE}" stroke-width="3.2" stroke-linejoin="round"/>
    <path d="M 196 520 C 196 640 186 720 170 790 M 604 520 C 604 640 614 720 630 790" fill="none" stroke="#4a3060" stroke-width="5" stroke-linecap="round" opacity="0.8"/>
  </g>'''

base = svg(
    hair_back
    + body_group()
    + face_group()
    + eye_l_svg
    + eye_r_svg
    + mouth_closed()
    + bangs_group()
    + brows()
    + side_locks
    + headphones()
)

# ---- ojos cerrados: se repinta la cara SOLO dentro de la zona de cada ojo y se dibuja la línea cerrada
def closed_eye_line(cx, cy, s):
    ox = cx + s * EYE_W * 0.5
    ix = cx - s * EYE_W * 0.46
    return (
        f'<path d="M {fmt(ix, cy + 6)} Q {fmt(cx, cy + 30)} {fmt(ox, cy + 2)}" fill="none" stroke="{LINE}" stroke-width="7" stroke-linecap="round"/>'
        f'<path d="M {fmt(ox - s * 2, cy + 3)} L {fmt(ox + s * 12, cy - 6)}" stroke="{LINE}" stroke-width="5" stroke-linecap="round"/>'
    )


patch = (
    f'<clipPath id="lidClip">'
    f'<ellipse cx="{EYE_L[0] - 2}" cy="{EYE_L[1]}" rx="{EYE_W / 2 + 16}" ry="{EYE_H / 2 + 12}"/>'
    f'<ellipse cx="{EYE_R[0] + 2}" cy="{EYE_R[1]}" rx="{EYE_W / 2 + 16}" ry="{EYE_H / 2 + 12}"/>'
    f'</clipPath>'
)
eyes_closed = svg(
    patch
    + '<g clip-path="url(#lidClip)">'
    + face_group()
    + bangs_group()
    + brows()
    + side_locks
    + '</g>'
    + closed_eye_line(*EYE_L, -1)
    + closed_eye_line(*EYE_R, +1)
)

with open(os.path.join(OUT, 'base.svg'), 'w') as f:
    f.write(base)
with open(os.path.join(OUT, 'eyes_closed.svg'), 'w') as f:
    f.write(eyes_closed)
with open(os.path.join(OUT, 'mouth_half.svg'), 'w') as f:
    f.write(svg(mouth_open('half')))
with open(os.path.join(OUT, 'mouth_open.svg'), 'w') as f:
    f.write(svg(mouth_open('open')))

manifest = {
    'id': 'default',
    'name': 'Noa (de serie)',
    'width': W,
    'height': H,
    'files': {
        'base': 'base.svg',
        'eyesClosed': 'eyes_closed.svg',
        'mouthHalf': 'mouth_half.svg',
        'mouthOpen': 'mouth_open.svg',
    },
    'rig': {
        'eyes': [
            {'x': EYE_L[0], 'y': EYE_L[1], 'w': EYE_W + 20, 'h': EYE_H + 16},
            {'x': EYE_R[0], 'y': EYE_R[1], 'w': EYE_W + 20, 'h': EYE_H + 16},
        ],
        'mouth': {'x': MOUTH[0], 'y': MOUTH[1], 'w': 40},
        'neck': {'x': NECK[0], 'y': NECK[1]},
    },
}
with open(os.path.join(OUT, 'skin.json'), 'w') as f:
    json.dump(manifest, f, indent=2)
print('ok', OUT)
