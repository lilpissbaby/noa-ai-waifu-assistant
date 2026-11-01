#!/usr/bin/env python3
"""Skins 2D del mercado interno de Waifu Desk.

Personajes originales, todas mujeres adultas, dibujados aquí mismo como capas SVG alineadas
(800×1000): base.svg, eyes_closed.svg, mouth_half.svg, mouth_open.svg y una cara por emoción
(emo_<nombre>.svg), más skin.json con el rig y la lista de caras.

Cada capa de cara repite la parte delantera de la cabeza (cara, rasgos, flequillo, mechones y
accesorios de delante) con otros ojos, cejas y boca, así tapa por completo la cara de la base.
Las capas de parpadeo y de boca son esa misma pila recortada a la zona de los ojos o de la boca.

Uso: python3 tools/draw_skins.py [carpeta_salida] [id ...]
"""
import json
import math
import os
import sys

W, H = 800, 1000
CX = 400
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')

# ------------------------------------------------------------------ geometría común
EYE_Y = 330
EYE_DX = 66
EYE_L = (CX - EYE_DX, EYE_Y)
EYE_R = (CX + EYE_DX, EYE_Y)
EYE_W, EYE_H = 84, 58
MOUTH = (CX, 424)
NECK = (CX, 470)
BROW_Y = 282


def f(v):
    return f'{v:.1f}'.rstrip('0').rstrip('.') if isinstance(v, float) else str(v)


def pt(x, y):
    return f'{f(float(x))} {f(float(y))}'


def mirror_d(d):
    """Refleja un path (solo comandos absolutos con pares x y) respecto al eje central."""
    out = []
    nums = []
    toks = d.replace(',', ' ').split()

    def flush():
        for j in range(0, len(nums), 2):
            out.append(pt(W - nums[j], nums[j + 1]))
        nums.clear()

    for tkn in toks:
        try:
            nums.append(float(tkn))
        except ValueError:
            flush()
            out.append(tkn)
    flush()
    return ' '.join(out)


def path(d, fill='none', stroke=None, sw=3, extra=''):
    s = f'<path d="{d}" fill="{fill}"'
    if stroke:
        s += f' stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round" stroke-linecap="round"'
    return s + (f' {extra}' if extra else '') + '/>'


def both(d, **kw):
    return path(d, **kw) + path(mirror_d(d), **kw)


def circles(x, y, r, fill='none', stroke=None, sw=2, extra=''):
    """Un círculo y su reflejo."""
    st = f' stroke="{stroke}" stroke-width="{sw}"' if stroke else ''
    return ''.join(f'<circle cx="{f(float(cx))}" cy="{f(float(y))}" r="{r}" fill="{fill}"{st} {extra}/>' for cx in (x, W - x))


# ------------------------------------------------------------------ personaje
class Char:
    def __init__(self, **kw):
        self.line = '#2a1822'
        self.skin = '#ffe6da'
        self.skin_sh = '#f5c9b9'
        self.skin_sh2 = '#e8ab98'
        self.cheek = '#ff8fa8'
        self.lips = '#d9677a'
        self.lips_dark = '#9c3a4f'
        self.iris = ('#2f1e5c', '#7a4fd0', '#d58cf0')
        self.lash = '#24141c'
        self.eyeshadow = None
        self.wing = False  # delineado en «ala»
        self.mole = False
        self.hair = '#3b2a4a'
        self.hair_sh = '#2a1d36'
        self.hair_hi = '#6a5585'
        self.hair_tip = None
        self.hair_style = 'long'
        self.bangs = 'swept'
        self.ears = 'human'
        self.outfit = 'blouse'
        self.acc = []
        self.pal = {}
        self.adult = False
        self.tags = []
        self.__dict__.update(kw)


# ------------------------------------------------------------------ defs (degradados)
def defs(c):
    i0, i1, i2 = c.iris
    tip = c.hair_tip or c.hair_sh
    return f'''<defs>
  <linearGradient id="iris" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{i0}"/><stop offset="0.5" stop-color="{i1}"/><stop offset="1" stop-color="{i2}"/></linearGradient>
  <linearGradient id="hairBack" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{c.hair}"/><stop offset="0.6" stop-color="{c.hair_sh}"/><stop offset="1" stop-color="{tip}"/></linearGradient>
  <linearGradient id="hairFront" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{c.hair_hi}"/><stop offset="0.35" stop-color="{c.hair}"/><stop offset="1" stop-color="{c.hair}"/></linearGradient>
  <linearGradient id="lock" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{c.hair}"/><stop offset="0.7" stop-color="{c.hair}"/><stop offset="1" stop-color="{tip}"/></linearGradient>
  <linearGradient id="neckSh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{c.skin_sh2}"/><stop offset="0.5" stop-color="{c.skin_sh}"/><stop offset="1" stop-color="{c.skin}"/></linearGradient>
  <radialGradient id="blush" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="{c.cheek}" stop-opacity="0.65"/><stop offset="1" stop-color="{c.cheek}" stop-opacity="0"/></radialGradient>
  <radialGradient id="blushHi" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ff5f86" stop-opacity="0.8"/><stop offset="1" stop-color="#ff5f86" stop-opacity="0"/></radialGradient>
  <radialGradient id="chestSh" cx="0.5" cy="0" r="1"><stop offset="0" stop-color="{c.skin_sh}"/><stop offset="1" stop-color="{c.skin}"/></radialGradient>
  <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5"/></filter>
  <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
  <clipPath id="faceClip"><path d="{FACE}"/></clipPath>
</defs>'''


# ------------------------------------------------------------------ cara y cuerpo
FACE = (
    'M 276 292 C 272 206 330 168 400 168 C 470 168 528 206 524 292 '
    'C 522 350 512 388 490 424 C 466 458 428 482 400 486 '
    'C 372 482 334 458 310 424 C 288 388 278 350 276 292 Z'
)
NECK_D = 'M 368 452 C 370 486 368 520 360 548 L 440 548 C 432 520 430 486 432 452 Z'
EAR_L = 'M 280 312 C 262 296 250 304 254 326 C 258 350 268 368 286 372 Z'


def face(c):
    ears = ''
    if c.ears == 'human':
        ears = both(EAR_L, fill=c.skin, stroke=c.line, sw=3) + both('M 266 320 C 262 330 266 344 274 352', stroke=c.skin_sh2, sw=2.5)
    elif c.ears == 'elf':
        elf = 'M 282 306 C 250 296 214 270 196 250 C 214 300 240 352 286 370 Z'
        ears = both(elf, fill=c.skin, stroke=c.line, sw=3) + both('M 226 282 C 244 310 262 336 282 352', stroke=c.skin_sh2, sw=2.5)
    return f'''<g id="face">{ears}
  {path(FACE, fill=c.skin)}
  <g clip-path="url(#faceClip)">
    <path d="M 270 160 L 530 160 L 530 300 C 470 250 330 250 270 300 Z" fill="{c.skin_sh}" opacity="0.85" filter="url(#soft)"/>
    <path d="M 300 420 C 340 470 460 470 500 420 L 520 500 L 280 500 Z" fill="{c.skin_sh}" opacity="0.35" filter="url(#soft)"/>
  </g>
  {path(FACE, stroke=c.line, sw=3.2)}
  {path('M 396 380 Q 401 388 405 384', stroke=c.skin_sh2, sw=2.6)}
</g>'''


def neck(c):
    return f'''<g id="neck">
  {path(NECK_D, fill='url(#neckSh)', stroke=c.line, sw=3)}
  {path('M 372 470 C 390 492 410 492 428 470 L 430 452 L 370 452 Z', fill=c.skin_sh2, extra='opacity="0.55"')}
</g>'''


# Cuerpo: tronco (hombros, pecho, cintura) y brazos aparte; entre brazo y cintura se ve el fondo.
TORSO_SKIN = (
    'M 360 540 C 330 556 280 562 240 578 C 214 590 202 616 200 650 L 250 692 '
    'C 262 760 280 840 296 920 C 300 950 300 980 298 1000 L 502 1000 C 500 980 500 950 504 920 '
    'C 520 840 538 760 550 692 L 600 650 C 598 616 586 590 560 578 C 520 562 470 556 440 540 Z'
)
ARM_L = (
    'M 240 578 C 210 590 194 620 190 662 C 186 760 184 880 180 1000 L 262 1000 '
    'C 262 900 258 800 254 702 C 252 660 252 616 240 578 Z'
)
COLLAR_L = 'M 372 560 C 352 568 320 572 292 576'
BUST_L = 'M 262 712 C 270 770 318 800 360 794 C 380 790 394 780 400 768'


def cleavage(c, top=650, depth=60):
    """Escote: sombra suave y la línea entre el pecho."""
    return (
        f'<path d="M 340 {top} C 360 {top + 30} 440 {top + 30} 460 {top} L 470 {top + depth + 60} L 330 {top + depth + 60} Z" fill="{c.skin_sh}" opacity="0.45" filter="url(#soft)"/>'
        + path(f'M 392 {top + 12} C 398 {top + 30} 400 {top + depth - 10} 396 {top + depth + 8}', stroke=c.skin_sh2, sw=3)
        + path(f'M 408 {top + 18} C 404 {top + 34} 403 {top + depth - 6} 405 {top + depth + 4}', stroke=c.skin_sh2, sw=2.2, extra='opacity="0.7"')
    )


def bust_lines(c, color, y=0):
    d = BUST_L if not y else BUST_L.replace('712', str(712 + y))
    return path(d, stroke=color, sw=3) + path(mirror_d(d), stroke=color, sw=3)


# ------------------------------------------------------------------ ojos
def eye_shape(cx, cy, s, w=EYE_W, h=EYE_H, top_drop=0.0, bottom_lift=0.0):
    """Contorno visible del ojo. s=-1 ojo izquierdo de la imagen (exterior a la izquierda)."""
    hw = w / 2
    ox = cx + s * hw
    ix = cx - s * hw * 0.92
    t = cy - h * 0.55 + top_drop
    b = cy + h * 0.5 - bottom_lift
    return (
        f'M {pt(ix, cy - h * 0.05 + top_drop * 0.4)} '
        f'C {pt(ix + s * w * 0.18, t - h * 0.08)} {pt(ox - s * w * 0.32, t - h * 0.12)} {pt(ox, cy - h * 0.28 + top_drop * 0.6)} '
        f'C {pt(ox + s * 4, cy + h * 0.2)} {pt(cx + s * w * 0.28, b)} {pt(cx, b)} '
        f'C {pt(cx - s * w * 0.3, b)} {pt(ix - s * 3, cy + h * 0.3)} {pt(ix, cy - h * 0.05 + top_drop * 0.4)} Z'
    )


def iris(c, cx, cy, gid, dx=0, dy=0, scale=1.0, pupil=1.0, sparkle='normal', heart=False, spiral=False):
    ix, iy = cx + dx, cy + 4 + dy
    rx, ry = 23 * scale, 28 * scale
    if heart:
        d = (f'M {pt(ix, iy + ry * 0.9)} C {pt(ix - rx * 1.5, iy - ry * 0.1)} {pt(ix - rx * 0.9, iy - ry * 1.2)} {pt(ix, iy - ry * 0.45)} '
             f'C {pt(ix + rx * 0.9, iy - ry * 1.2)} {pt(ix + rx * 1.5, iy - ry * 0.1)} {pt(ix, iy + ry * 0.9)} Z')
        return path(d, fill='#ff4f8b', stroke='#a3123f', sw=3) + f'<ellipse cx="{f(ix - rx * 0.45)}" cy="{f(iy - ry * 0.45)}" rx="5" ry="4" fill="#fff"/>'
    if spiral:
        pts = []
        for k in range(0, 90):
            a = k * 0.32
            r = 1.2 + k * 0.28
            pts.append(pt(ix + math.cos(a) * r, iy + math.sin(a) * r * 1.1))
        return f'<ellipse cx="{f(ix)}" cy="{f(iy)}" rx="{f(rx)}" ry="{f(ry)}" fill="#fff"/>' + path('M ' + ' L '.join(pts), stroke=c.line, sw=3)
    out = f'<ellipse cx="{f(ix)}" cy="{f(iy)}" rx="{f(rx)}" ry="{f(ry)}" fill="url(#iris)" stroke="{c.iris[0]}" stroke-width="3"/>'
    out += f'<ellipse cx="{f(ix)}" cy="{f(iy + 3)}" rx="{f(10 * scale * pupil)}" ry="{f(15 * scale * pupil)}" fill="{c.iris[0]}" opacity="0.9"/>'
    out += f'<ellipse cx="{f(ix)}" cy="{f(iy + ry * 0.55)}" rx="{f(rx * 0.65)}" ry="{f(ry * 0.28)}" fill="{c.iris[2]}" opacity="0.55"/>'
    if sparkle == 'normal':
        out += f'<circle cx="{f(ix - 9 * scale)}" cy="{f(iy - 11 * scale)}" r="{f(7 * scale)}" fill="#fff"/>'
        out += f'<circle cx="{f(ix + 8 * scale)}" cy="{f(iy + 12 * scale)}" r="{f(3.2 * scale)}" fill="#fff" opacity="0.9"/>'
    elif sparkle == 'star':
        for (sx, sy, r) in ((ix - 8, iy - 9, 10), (ix + 9, iy + 11, 5)):
            out += path(star_d(sx, sy, r, r * 0.3), fill='#fff')
    elif sparkle == 'teary':
        out += f'<circle cx="{f(ix - 9)}" cy="{f(iy - 11)}" r="8" fill="#fff"/><circle cx="{f(ix + 7)}" cy="{f(iy - 4)}" r="4" fill="#fff"/>'
        out += f'<circle cx="{f(ix + 8)}" cy="{f(iy + 12)}" r="5" fill="#fff"/><circle cx="{f(ix - 6)}" cy="{f(iy + 13)}" r="3" fill="#fff"/>'
    elif sparkle == 'dull':
        pass
    return out


def star_d(x, y, r, r2):
    pts = []
    for k in range(8):
        a = -math.pi / 2 + k * math.pi / 4
        rr = r if k % 2 == 0 else r2
        pts.append(pt(x + math.cos(a) * rr, y + math.sin(a) * rr))
    return 'M ' + ' L '.join(pts) + ' Z'


def lashes(c, cx, cy, s, w=EYE_W, h=EYE_H, top_drop=0.0, heavy=1.0):
    hw = w / 2
    ox = cx + s * hw
    ix = cx - s * hw * 0.92
    t = cy - h * 0.55 + top_drop
    th = 7 * heavy
    d = (
        f'M {pt(ix - s * 6, cy - h * 0.02 + top_drop * 0.4)} '
        f'C {pt(ix + s * w * 0.16, t - h * 0.12)} {pt(ox - s * w * 0.3, t - h * 0.18)} {pt(ox + s * 8, cy - h * 0.32 + top_drop * 0.6)} '
    )
    if c.wing:
        d += f'L {pt(ox + s * 22, cy - h * 0.55 + top_drop * 0.5)} L {pt(ox + s * 6, cy - h * 0.14 + top_drop * 0.6)} '
    else:
        d += f'L {pt(ox + s * 14, cy - h * 0.46 + top_drop * 0.5)} L {pt(ox + s * 6, cy - h * 0.18 + top_drop * 0.6)} '
    d += (
        f'C {pt(ox - s * w * 0.3, t - h * 0.18 + th)} {pt(ix + s * w * 0.18, t - h * 0.12 + th)} {pt(ix - s * 1, cy + 2 + top_drop * 0.4)} Z'
    )
    return path(d, fill=c.lash)


def eye_open(c, cx, cy, s, gid, look=(0, 0), top_drop=0.0, bottom_lift=0.0, scale=1.0, pupil=1.0, sparkle='normal', heart=False, spiral=False, w=EYE_W, h=EYE_H, heavy=1.0, lower=True):
    shape = eye_shape(cx, cy, s, w=w, h=h, top_drop=top_drop, bottom_lift=bottom_lift)
    lid = ''
    if top_drop > 4:
        lid = f'<path d="M {pt(cx - 60, cy - 60)} L {pt(cx + 60, cy - 60)} L {pt(cx + 60, cy - h * 0.3 + top_drop)} Q {pt(cx, cy - h * 0.18 + top_drop)} {pt(cx - 60, cy - h * 0.3 + top_drop)} Z" fill="{c.skin_sh}"/>'
    out = f'''<g>
    <clipPath id="{gid}"><path d="{shape}"/></clipPath>
    <path d="{shape}" fill="#fffafc"/>
    <g clip-path="url(#{gid})">
      {iris(c, cx, cy, gid, dx=look[0] * 12, dy=look[1] * 8, scale=scale, pupil=pupil, sparkle=sparkle, heart=heart, spiral=spiral)}
      <path d="M {pt(cx - 60, cy - 44)} L {pt(cx + 60, cy - 44)} L {pt(cx + 60, cy - 18)} Q {pt(cx, cy - 6)} {pt(cx - 60, cy - 18)} Z" fill="{c.iris[0]}" opacity="0.22"/>
      {lid}
    </g>
    {lashes(c, cx, cy, s, w=w, h=h, top_drop=top_drop, heavy=heavy)}'''
    if lower:
        b = cy + h * 0.5 - bottom_lift
        out += path(f'M {pt(cx - s * 14, b + 1)} Q {pt(cx + s * 10, b + 3)} {pt(cx + s * 30, b - 8)}', stroke=c.lips_dark, sw=2.6, extra='opacity="0.75"')
    if c.eyeshadow:
        out = f'<path d="M {pt(cx - s * 46, cy - 18)} Q {pt(cx, cy - 58)} {pt(cx + s * 52, cy - 26)} Q {pt(cx, cy - 36)} {pt(cx - s * 46, cy - 18)} Z" fill="{c.eyeshadow}" opacity="0.5" filter="url(#glow)"/>' + out
    return out + '</g>'


def eye_closed_line(c, cx, cy, s, kind='down'):
    """Ojo cerrado. down: arco relajado hacia abajo (parpadeo); happy: ^ ; tight: > <."""
    hw = EYE_W / 2
    ox = cx + s * hw
    ix = cx - s * hw * 0.9
    if kind == 'down':
        return (path(f'M {pt(ix, cy + 4)} Q {pt(cx, cy + 22)} {pt(ox, cy)}', stroke=c.lash, sw=6)
                + path(f'M {pt(ox - s * 2, cy + 1)} L {pt(ox + s * 12, cy - 6)}', stroke=c.lash, sw=4.5))
    if kind == 'happy':
        return path(f'M {pt(ix, cy + 12)} Q {pt(cx, cy - 22)} {pt(ox, cy + 10)}', stroke=c.lash, sw=6.5)
    if kind == 'soft':
        return (path(f'M {pt(ix, cy + 6)} Q {pt(cx, cy + 16)} {pt(ox, cy + 2)}', stroke=c.lash, sw=5.5)
                + path(f'M {pt(cx - s * 8, cy + 14)} l {pt(-s * 3, 7)} M {pt(cx + s * 10, cy + 12)} l {pt(s * 2, 7)}', stroke=c.lash, sw=3))
    if kind == 'tight':  # > <
        return path(f'M {pt(cx + s * 30, cy - 12)} L {pt(cx - s * 20, cy + 3)} L {pt(cx + s * 30, cy + 18)}', stroke=c.lash, sw=6.5)
    if kind == 'proud':
        return path(f'M {pt(ix, cy + 2)} Q {pt(cx, cy + 16)} {pt(ox + s * 6, cy - 6)}', stroke=c.lash, sw=6.5)
    return ''


def eyes(c, kind):
    """Pareja de ojos según la variante."""
    L, R = EYE_L, EYE_R
    o = lambda cx, cy, s, gid, **k: eye_open(c, cx, cy, s, gid, **k)
    if kind == 'open':
        return o(*L, -1, 'eL') + o(*R, 1, 'eR')
    if kind == 'smile':
        return o(*L, -1, 'eL', bottom_lift=14, top_drop=2) + o(*R, 1, 'eR', bottom_lift=14, top_drop=2)
    if kind == 'sparkle':
        return o(*L, -1, 'eL', sparkle='star', scale=1.05) + o(*R, 1, 'eR', sparkle='star', scale=1.05)
    if kind == 'sparkle_up':
        return o(*L, -1, 'eL', sparkle='star', look=(0.2, -0.8)) + o(*R, 1, 'eR', sparkle='star', look=(0.2, -0.8))
    if kind == 'heart':
        return o(*L, -1, 'eL', heart=True) + o(*R, 1, 'eR', heart=True)
    if kind == 'spiral':
        return o(*L, -1, 'eL', spiral=True, lower=False) + o(*R, 1, 'eR', spiral=True, lower=False)
    if kind == 'half':
        return o(*L, -1, 'eL', top_drop=18) + o(*R, 1, 'eR', top_drop=18)
    if kind == 'half_aside':
        return o(*L, -1, 'eL', top_drop=16, look=(1, 0.2)) + o(*R, 1, 'eR', top_drop=16, look=(1, 0.2))
    if kind == 'aside_down':
        return o(*L, -1, 'eL', top_drop=10, look=(-0.9, 0.8)) + o(*R, 1, 'eR', top_drop=10, look=(-0.9, 0.8))
    if kind == 'up_side':
        return o(*L, -1, 'eL', look=(0.9, -0.9)) + o(*R, 1, 'eR', look=(0.9, -0.9))
    if kind == 'sleepy':
        return o(*L, -1, 'eL', top_drop=28, look=(0, 0.6)) + o(*R, 1, 'eR', top_drop=28, look=(0, 0.6))
    if kind == 'wide':
        return o(*L, -1, 'eL', scale=0.78, pupil=0.7, h=EYE_H + 8) + o(*R, 1, 'eR', scale=0.78, pupil=0.7, h=EYE_H + 8)
    if kind == 'shock':
        return o(*L, -1, 'eL', scale=0.45, pupil=0.6, h=EYE_H + 10, sparkle='dull') + o(*R, 1, 'eR', scale=0.45, pupil=0.6, h=EYE_H + 10, sparkle='dull')
    if kind == 'teary':
        return o(*L, -1, 'eL', sparkle='teary', top_drop=4) + o(*R, 1, 'eR', sparkle='teary', top_drop=4)
    if kind == 'wide_teary':
        return o(*L, -1, 'eL', sparkle='teary', scale=0.85, h=EYE_H + 6) + o(*R, 1, 'eR', sparkle='teary', scale=0.85, h=EYE_H + 6)
    if kind == 'nervous':
        return o(*L, -1, 'eL', scale=0.8, pupil=0.75, look=(0.6, 0)) + o(*R, 1, 'eR', scale=0.8, pupil=0.75, look=(0.6, 0))
    if kind == 'sad':
        return o(*L, -1, 'eL', top_drop=12, look=(0, 0.7), sparkle='teary') + o(*R, 1, 'eR', top_drop=12, look=(0, 0.7), sparkle='teary')
    if kind == 'angry':
        return eye_angry(c, *L, -1, 'eL') + eye_angry(c, *R, 1, 'eR')
    if kind == 'determined':
        return o(*L, -1, 'eL', top_drop=8, sparkle='star') + o(*R, 1, 'eR', top_drop=8, sparkle='star')
    if kind == 'squint':
        return o(*L, -1, 'eL', top_drop=20, bottom_lift=10) + o(*R, 1, 'eR', top_drop=20, bottom_lift=10)
    if kind == 'confused':
        return o(*L, -1, 'eL', scale=0.85, pupil=0.8) + o(*R, 1, 'eR', top_drop=16, bottom_lift=6)
    if kind == 'wink':  # izquierda de la imagen cerrada
        return eye_closed_line(c, *L, -1, 'happy') + o(*R, 1, 'eR', bottom_lift=8)
    if kind == 'wink_half':
        return eye_closed_line(c, *L, -1, 'happy') + o(*R, 1, 'eR', top_drop=14)
    if kind in ('closed', 'closed_happy', 'closed_soft', 'closed_tight', 'closed_proud'):
        k = {'closed': 'down', 'closed_happy': 'happy', 'closed_soft': 'soft', 'closed_tight': 'tight', 'closed_proud': 'proud'}[kind]
        return eye_closed_line(c, *L, -1, k) + eye_closed_line(c, *R, 1, k)
    raise ValueError(kind)


def eye_angry(c, cx, cy, s, gid):
    shape = eye_shape(cx, cy, s, top_drop=6)
    hw = EYE_W / 2
    lid = (f'M {pt(cx - s * hw * 1.1, cy - 50)} L {pt(cx + s * hw * 1.2, cy - 50)} L {pt(cx + s * hw * 1.2, cy - 30)} '
           f'L {pt(cx - s * hw * 1.0, cy - 4)} Z')
    return f'''<g>
    <clipPath id="{gid}"><path d="{shape}"/></clipPath>
    <path d="{shape}" fill="#fffafc"/>
    <g clip-path="url(#{gid})">{iris(c, cx, cy, gid, scale=0.9, pupil=0.75, sparkle='dull')}<path d="{lid}" fill="{c.skin}"/></g>
    {path(f'M {pt(cx - s * hw * 1.0, cy - 4)} L {pt(cx + s * hw * 1.15, cy - 30)}', stroke=c.lash, sw=7)}
    {path(f'M {pt(cx - s * 14, cy + EYE_H * 0.5 - 1)} Q {pt(cx + s * 10, cy + EYE_H * 0.5 + 2)} {pt(cx + s * 30, cy + EYE_H * 0.5 - 8)}', stroke=c.lips_dark, sw=2.6, extra='opacity="0.75"')}
  </g>'''


# ------------------------------------------------------------------ cejas
def brows(c, kind):
    col = c.pal.get('brow', c.hair_sh)

    def one(s, inner_dy, outer_dy, arch=-8, dx=0):
        cx = CX + s * EYE_DX + dx * s
        ix, ox = cx - s * 34, cx + s * 40
        iy, oy = BROW_Y + inner_dy, BROW_Y + outer_dy
        mx = (ix + ox) / 2
        my = (iy + oy) / 2 + arch
        return path(f'M {pt(ix, iy)} Q {pt(mx, my)} {pt(ox, oy)}', stroke=col, sw=5.5)

    table = {
        'neutral': ((0, 4, -8), (0, 4, -8)),
        'up': ((-14, -10, -10), (-14, -10, -10)),
        'soft': ((-4, 2, -6), (-4, 2, -6)),
        'worried': ((-10, 8, -2), (-10, 8, -2)),
        'sad': ((-12, 12, 2), (-12, 12, 2)),
        'angry': ((12, -8, 4), (12, -8, 4)),
        'determined': ((8, -6, -2), (8, -6, -2)),
        'raised': ((0, 4, -8), (-16, -12, -10)),
        'uneven': ((-14, -6, -8), (8, 0, -2)),
        'flat': ((2, 2, 0), (2, 2, 0)),
        'low': ((6, 8, -4), (6, 8, -4)),
    }
    (a, b) = table[kind]
    return f'<g id="brows" opacity="0.92">{one(-1, *a)}{one(1, *b)}</g>'


# ------------------------------------------------------------------ bocas
def mouth(c, kind):
    mx, my = MOUTH
    L, D = c.lips, c.lips_dark

    def opened(hw, top, bot, teeth=True, tongue=True, curve=4):
        shape = (f'M {pt(mx - hw, top)} Q {pt(mx, top + curve)} {pt(mx + hw, top)} '
                 f'C {pt(mx + hw, bot - 6)} {pt(mx + 9, bot)} {pt(mx, bot)} C {pt(mx - 9, bot)} {pt(mx - hw, bot - 6)} {pt(mx - hw, top)} Z')
        inner = ''
        if tongue:
            inner += f'<ellipse cx="{mx}" cy="{f(bot + 3)}" rx="{f(hw * 0.75)}" ry="{f(max(4, (bot - top) * 0.45))}" fill="#e7798d"/>'
        if teeth:
            inner += f'<rect x="{f(mx - hw)}" y="{f(top - 3)}" width="{f(hw * 2)}" height="{f(min(8, (bot - top) * 0.3))}" fill="#fff"/>'
        return (f'<clipPath id="m{kind}"><path d="{shape}"/></clipPath>{path(shape, fill="#5e1a2d")}'
                f'<g clip-path="url(#m{kind})">{inner}</g>{path(shape, stroke=D, sw=2.6)}')

    lip = lambda d, sw=3.2: path(d, stroke=D, sw=sw)
    if kind == 'neutral':
        return lip(f'M {pt(mx - 18, my)} Q {pt(mx, my + 7)} {pt(mx + 18, my - 1)}') + path(f'M {pt(mx - 8, my + 10)} Q {pt(mx, my + 13)} {pt(mx + 8, my + 10)}', stroke=L, sw=2.4, extra='opacity="0.8"')
    if kind == 'smile_small':
        return lip(f'M {pt(mx - 20, my - 4)} Q {pt(mx, my + 10)} {pt(mx + 20, my - 4)}')
    if kind == 'smile':
        return lip(f'M {pt(mx - 26, my - 7)} Q {pt(mx, my + 14)} {pt(mx + 26, my - 7)}') + path(f'M {pt(mx - 26, my - 7)} l -4 -2 M {pt(mx + 26, my - 7)} l 4 -2', stroke=D, sw=2.4)
    if kind == 'smile_open':
        return opened(22, my - 6, my + 14, curve=3)
    if kind == 'grin_open':
        return opened(28, my - 8, my + 22, curve=2)
    if kind == 'laugh':
        return opened(30, my - 10, my + 30, curve=0)
    if kind == 'cat':
        return lip(f'M {pt(mx - 22, my - 2)} Q {pt(mx - 11, my + 10)} {pt(mx, my)} Q {pt(mx + 11, my + 10)} {pt(mx + 22, my - 2)}')
    if kind == 'smirk':
        return lip(f'M {pt(mx - 18, my + 2)} Q {pt(mx + 4, my + 8)} {pt(mx + 22, my - 8)}') + path(f'M {pt(mx + 22, my - 8)} l 4 -1', stroke=D, sw=2.4)
    if kind == 'tongue':
        return (opened(20, my - 4, my + 10, teeth=False, tongue=False, curve=3)
                + path(f'M {pt(mx - 10, my + 6)} C {pt(mx - 12, my + 26)} {pt(mx + 12, my + 26)} {pt(mx + 10, my + 6)} Z', fill='#f08aa0', stroke=D, sw=2.4)
                + path(f'M {pt(mx, my + 10)} L {pt(mx, my + 18)}', stroke='#c75a72', sw=2))
    if kind == 'kiss':  # morritos de beso
        return (path(f'M {pt(mx - 12, my)} C {pt(mx - 12, my - 9)} {pt(mx - 2, my - 9)} {pt(mx, my - 4)} C {pt(mx + 2, my - 9)} {pt(mx + 12, my - 9)} {pt(mx + 12, my)} '
                     f'C {pt(mx + 12, my + 12)} {pt(mx - 12, my + 12)} {pt(mx - 12, my)} Z', fill=L, stroke=D, sw=2.6)
                + path(f'M {pt(mx - 8, my + 1)} Q {pt(mx, my + 4)} {pt(mx + 8, my + 1)}', stroke=D, sw=2.2)
                + f'<ellipse cx="{mx - 4}" cy="{my + 6}" rx="3" ry="1.6" fill="#fff" opacity="0.7"/>')
    if kind == 'pout':
        return lip(f'M {pt(mx - 12, my + 2)} Q {pt(mx - 6, my - 4)} {pt(mx, my + 1)} Q {pt(mx + 6, my - 4)} {pt(mx + 12, my + 2)}', sw=3) + lip(f'M {pt(mx - 8, my + 7)} Q {pt(mx, my + 3)} {pt(mx + 8, my + 7)}', sw=2.4)
    if kind == 'frown':
        return lip(f'M {pt(mx - 22, my + 8)} Q {pt(mx, my - 6)} {pt(mx + 22, my + 8)}')
    if kind == 'frown_small':
        return lip(f'M {pt(mx - 14, my + 5)} Q {pt(mx, my - 2)} {pt(mx + 14, my + 5)}')
    if kind == 'flat':
        return lip(f'M {pt(mx - 18, my + 2)} L {pt(mx + 18, my + 2)}')
    if kind == 'flat_frown':
        return lip(f'M {pt(mx - 20, my + 4)} Q {pt(mx, my)} {pt(mx + 20, my + 6)}')
    if kind == 'o':
        return f'<ellipse cx="{mx}" cy="{my + 4}" rx="9" ry="12" fill="#5e1a2d" stroke="{D}" stroke-width="2.6"/>'
    if kind == 'small_o':
        return f'<ellipse cx="{mx}" cy="{my + 3}" rx="6" ry="7" fill="#5e1a2d" stroke="{D}" stroke-width="2.4"/>'
    if kind == 'scream':
        return opened(18, my - 8, my + 34, teeth=True, curve=-2)
    if kind == 'wavy':
        pts = ' '.join(f'Q {pt(mx - 20 + k * 8 + 4, my + (4 if k % 2 else -4))} {pt(mx - 20 + (k + 1) * 8, my)}' for k in range(5))
        return lip(f'M {pt(mx - 20, my)} {pts}', sw=3)
    if kind == 'wavy_open':
        top = ' '.join(f'L {pt(mx - 20 + k * 8, my - 4 + (3 if k % 2 else 0))}' for k in range(1, 6))
        return path(f'M {pt(mx - 20, my - 4)} {top} L {pt(mx + 16, my + 12)} Q {pt(mx, my + 18)} {pt(mx - 16, my + 12)} Z', fill='#5e1a2d', stroke=D, sw=2.6)
    if kind == 'grit':
        shape = f'M {pt(mx - 24, my - 6)} L {pt(mx + 24, my - 6)} L {pt(mx + 20, my + 12)} L {pt(mx - 20, my + 12)} Z'
        return path(shape, fill='#fff', stroke=D, sw=2.8) + path(f'M {pt(mx - 22, my + 3)} L {pt(mx + 22, my + 3)} M {pt(mx - 8, my - 6)} L {pt(mx - 8, my + 12)} M {pt(mx + 8, my - 6)} L {pt(mx + 8, my + 12)}', stroke='#c8b8c2', sw=2)
    if kind == 'shout':
        return opened(24, my - 8, my + 26, curve=-4)
    if kind == 'sob':
        return opened(20, my, my + 18, teeth=False, curve=-8)
    if kind == 'sigh':
        return f'<ellipse cx="{mx + 2}" cy="{my + 3}" rx="10" ry="6" fill="#5e1a2d" stroke="{D}" stroke-width="2.4"/>'
    if kind == 'hmm':
        return lip(f'M {pt(mx - 14, my + 4)} Q {pt(mx, my)} {pt(mx + 16, my - 4)}')
    if kind == 'disgust':
        return lip(f'M {pt(mx - 22, my + 6)} Q {pt(mx - 10, my - 4)} {pt(mx, my + 4)} Q {pt(mx + 10, my + 10)} {pt(mx + 22, my)}')
    if kind == 'grin_closed':
        return lip(f'M {pt(mx - 26, my - 6)} Q {pt(mx, my + 12)} {pt(mx + 26, my - 8)}') + path(f'M {pt(mx - 18, my - 2)} Q {pt(mx, my + 8)} {pt(mx + 18, my - 3)} L {pt(mx + 16, my - 4)} Q {pt(mx, my + 3)} {pt(mx - 16, my - 3)} Z', fill='#fff', stroke=D, sw=1.6)
    if kind == 'yawn':
        return opened(16, my - 6, my + 30, teeth=False, curve=-4)
    if kind == 'talk_half':
        return opened(17, my - 4, my + 12, curve=3)
    if kind == 'talk_open':
        return opened(20, my - 7, my + 22, curve=2)
    raise ValueError(kind)


def lipstick(c, kind):
    """Color de labios: un toque debajo de la línea en las bocas cerradas."""
    if kind not in ('neutral', 'smile_small', 'smile', 'smirk', 'frown_small', 'flat', 'cat', 'hmm', 'pout', 'grin_closed'):
        return ''
    mx, my = MOUTH
    return f'<ellipse cx="{mx}" cy="{my + 9}" rx="11" ry="4" fill="{c.lips}" opacity="0.55"/>'


# ------------------------------------------------------------------ extras de cara
def cheeks(c, level):
    if not level:
        return ''
    g = 'blushHi' if level >= 2 else 'blush'
    out = f'<ellipse cx="{CX - 92}" cy="378" rx="44" ry="18" fill="url(#{g})"/><ellipse cx="{CX + 92}" cy="378" rx="44" ry="18" fill="url(#{g})"/>'
    if level >= 2:
        for s in (-1, 1):
            x0 = CX + s * 92
            out += path(f'M {pt(x0 - 18, 384)} l 8 -10 M {pt(x0 - 4, 386)} l 8 -10 M {pt(x0 + 10, 384)} l 8 -10', stroke='#e0567a', sw=2.4, extra='opacity="0.8"')
    return out


def tears(c, kind):
    if kind == 'stream':
        out = ''
        for s in (-1, 1):
            x = CX + s * (EYE_DX + 14)
            out += path(f'M {pt(x - 8, 352)} C {pt(x - 12, 380)} {pt(x - 10, 420)} {pt(x - 4, 452)} L {pt(x + 8, 452)} C {pt(x + 10, 420)} {pt(x + 10, 380)} {pt(x + 8, 352)} Z', fill='#bfe6ff', stroke='#5aa7e0', sw=2.2, extra='opacity="0.9"')
        return out
    if kind == 'drop':
        x = CX + EYE_DX + 26
        return path(f'M {pt(x, 352)} C {pt(x - 9, 368)} {pt(x - 8, 380)} {pt(x, 381)} C {pt(x + 8, 380)} {pt(x + 9, 368)} {pt(x, 352)} Z', fill='#cdeeff', stroke='#5aa7e0', sw=2)
    return ''


# ------------------------------------------------------------------ pelo
HAIR_STYLES = {}


def hair_style(name):
    def deco(fn):
        HAIR_STYLES[name] = fn
        return fn
    return deco


def bangs_d(kind):
    if kind == 'swept':  # flequillo ladeado con mechones largos
        return ('M 270 300 C 258 196 318 128 404 126 C 492 126 548 190 532 300 '
                'C 520 266 512 236 494 214 C 492 252 484 286 470 312 C 466 270 456 238 440 216 '
                'C 432 252 418 282 396 300 C 402 262 396 226 380 204 C 360 240 330 272 296 288 '
                'C 312 262 322 236 326 212 C 304 236 286 266 270 300 Z')
    if kind == 'blunt':  # flequillo recto (hime)
        return ('M 272 296 C 262 190 320 124 400 124 C 480 124 538 190 528 296 '
                'L 512 272 L 500 292 L 484 270 L 470 292 L 454 270 L 438 292 L 420 270 L 404 292 '
                'L 388 270 L 372 292 L 356 270 L 340 292 L 324 270 L 308 292 L 292 272 Z')
    if kind == 'split':  # raya al medio, cortina
        return ('M 270 304 C 258 196 318 126 400 126 C 482 126 542 196 530 304 '
                'C 520 250 500 210 470 186 C 472 230 468 262 456 290 C 444 240 424 206 404 188 '
                'C 384 206 360 240 346 290 C 334 262 330 230 332 186 C 300 210 280 250 270 304 Z')
    if kind == 'side':  # flequillo largo a un lado, frente despejada al otro
        return ('M 268 300 C 254 190 316 124 404 124 C 490 124 546 190 532 296 '
                'C 520 250 500 214 470 196 C 440 186 410 190 390 204 '
                'C 360 228 336 262 330 316 C 316 290 312 262 316 236 C 296 258 278 280 268 300 Z')
    if kind == 'short':  # flequillo corto y desfilado
        return ('M 274 290 C 262 190 320 128 402 126 C 486 126 540 190 528 290 '
                'L 510 252 L 496 280 L 482 240 L 462 276 L 446 236 L 428 270 L 410 232 '
                'L 390 268 L 372 234 L 354 272 L 336 240 L 318 276 L 302 248 L 288 284 Z')
    raise ValueError(kind)


def bangs_lines(c, kind):
    hi = path('M 318 176 Q 360 150 404 152 Q 446 152 482 176', stroke=c.hair_hi, sw=10, extra='opacity="0.6"')
    if kind == 'swept':
        return hi + path('M 340 200 Q 322 246 300 280 M 420 196 Q 420 246 400 292 M 470 214 Q 480 260 470 304', stroke=c.hair_sh, sw=3)
    if kind == 'blunt':
        return hi + path('M 330 200 L 326 262 M 380 196 L 380 262 M 428 196 L 430 262 M 476 200 L 482 262', stroke=c.hair_sh, sw=3)
    if kind == 'split':
        return hi + path('M 400 132 L 404 186 M 358 200 Q 344 240 344 280 M 446 200 Q 458 240 456 282', stroke=c.hair_sh, sw=3)
    if kind == 'side':
        return hi + path('M 380 204 Q 350 240 338 296 M 430 194 Q 380 210 350 262 M 480 200 Q 506 236 520 280', stroke=c.hair_sh, sw=3)
    return hi + path('M 340 196 L 336 252 M 400 190 L 398 250 M 460 196 L 466 252', stroke=c.hair_sh, sw=3)


SIDE_LOCK = 'M 286 236 C 262 300 256 380 262 460 C 266 520 258 580 240 636 C 276 590 290 530 292 470 C 294 400 286 330 300 270 Z'
SIDE_LOCK_SHORT = 'M 284 236 C 262 290 258 350 266 420 C 270 450 266 470 256 490 C 282 470 292 440 292 404 C 294 350 290 300 302 262 Z'


def side_locks(c, kind='long'):
    d = SIDE_LOCK if kind == 'long' else SIDE_LOCK_SHORT
    return both(d, fill='url(#lock)', stroke=c.line, sw=3) + both('M 276 320 C 272 400 274 470 266 540', stroke=c.hair_hi, sw=3, extra='opacity="0.6"')


@hair_style('long')
def hair_long(c):
    back = ('M 400 104 C 248 104 178 210 176 360 C 174 520 196 700 160 900 '
            'L 214 878 L 232 960 L 278 870 L 300 900 L 500 900 L 522 870 L 568 960 L 586 878 L 640 900 '
            'C 604 700 626 520 624 360 C 622 210 552 104 400 104 Z')
    return path(back, fill='url(#hairBack)', stroke=c.line, sw=3.2) + both('M 214 520 C 210 660 200 760 186 860', stroke=c.hair_sh, sw=5, extra='opacity="0.7"'), 'long'


@hair_style('wavy')
def hair_wavy(c):
    back = ('M 400 104 C 240 104 172 214 172 360 C 172 470 150 520 168 600 C 186 680 140 740 156 820 '
            'C 168 880 140 930 170 980 C 200 940 230 960 250 920 C 268 940 290 930 300 900 L 500 900 '
            'C 510 930 532 940 550 920 C 570 960 600 940 630 980 C 660 930 632 880 644 820 '
            'C 660 740 614 680 632 600 C 650 520 628 470 628 360 C 628 214 560 104 400 104 Z')
    return path(back, fill='url(#hairBack)', stroke=c.line, sw=3.2) + both('M 200 480 C 180 560 214 640 190 720 C 172 790 200 850 186 920', stroke=c.hair_sh, sw=5, extra='opacity="0.7"'), 'long'


@hair_style('bob')
def hair_bob(c):
    back = ('M 400 108 C 252 108 192 210 194 340 C 196 420 186 480 200 540 '
            'C 240 556 270 548 300 536 L 500 536 C 530 548 560 556 600 540 '
            'C 614 480 604 420 606 340 C 608 210 548 108 400 108 Z')
    return path(back, fill='url(#hairBack)', stroke=c.line, sw=3.2), 'short'


@hair_style('ponytail')
def hair_ponytail(c):
    tail = ('M 560 200 C 640 220 680 320 664 440 C 652 540 676 640 650 760 C 640 800 620 830 600 850 '
            'C 612 790 610 740 600 700 C 590 760 570 800 548 820 C 566 720 584 620 576 520 C 570 420 600 320 540 250 Z')
    back = ('M 400 108 C 256 108 196 210 200 340 C 202 400 212 440 226 470 L 574 470 '
            'C 588 440 598 400 600 340 C 604 210 544 108 400 108 Z')
    tie = f'<ellipse cx="566" cy="214" rx="20" ry="26" fill="{c.pal.get("tie", "#e2457a")}" stroke="{c.line}" stroke-width="3" transform="rotate(30 566 214)"/>'
    return (path(tail, fill='url(#hairBack)', stroke=c.line, sw=3.2) + path('M 620 300 C 640 420 630 560 616 700', stroke=c.hair_sh, sw=5, extra='opacity="0.7"')
            + path(back, fill='url(#hairBack)', stroke=c.line, sw=3.2) + tie), 'short'


@hair_style('undercut')
def hair_undercut(c):
    back = ('M 400 110 C 260 110 206 200 210 320 C 212 380 226 420 246 440 L 554 440 '
            'C 574 420 588 380 590 320 C 594 200 540 110 400 110 Z')
    return path(back, fill='url(#hairBack)', stroke=c.line, sw=3.2), 'none'


@hair_style('hime_long')
def hair_hime(c):
    back = ('M 400 104 C 246 104 180 210 178 360 C 176 560 188 760 172 960 L 628 960 '
            'C 612 760 624 560 622 360 C 620 210 554 104 400 104 Z')
    return path(back, fill='url(#hairBack)', stroke=c.line, sw=3.2) + both('M 216 500 L 210 940', stroke=c.hair_sh, sw=5, extra='opacity="0.6"'), 'hime'


def hime_locks(c):
    d = ('M 284 238 C 270 300 266 370 268 440 C 270 480 268 510 262 540 C 278 524 288 506 292 486 '
         'C 296 504 300 520 306 532 C 304 480 298 420 298 360 C 298 320 300 286 306 262 Z')
    return both(d, fill='url(#lock)', stroke=c.line, sw=3) + both('M 282 300 C 280 380 282 460 276 520', stroke=c.hair_hi, sw=3, extra='opacity="0.6"')


# ------------------------------------------------------------------ ropa
# Cada prenda devuelve (tronco, brazos): el tronco va sobre la piel del tronco y los brazos sobre
# la piel de los brazos (así un top sin mangas no tapa los hombros).
OUTFITS = {}


def outfit(name):
    def deco(fn):
        OUTFITS[name] = fn
        return fn
    return deco


def sleeves(c, fill, stroke=None):
    return both(ARM_L, fill=fill, stroke=stroke or c.line, sw=3.2)


def torso_cloth(c, fill, neckline, stroke=None):
    """Prenda del tronco con el escote dado (tramo de path de izquierda a derecha entre x≈355 y x≈445)."""
    d = (f'M 238 578 C 270 566 320 560 {neckline} C 480 560 530 566 562 578 '
         f'C 586 590 598 616 600 650 L 550 692 C 538 760 520 840 504 920 C 500 950 500 980 502 1000 '
         f'L 298 1000 C 300 980 300 950 296 920 C 280 840 262 760 250 692 L 200 650 C 202 616 214 590 238 578 Z')
    return path(d, fill=fill, stroke=stroke or c.line, sw=3.2)


def waist_skin(c, y=860):
    """Vientre al aire bajo una prenda corta."""
    return (path(f'M 298 {y} C 360 {y + 20} 440 {y + 20} 502 {y} L 504 1000 L 296 1000 Z', fill=c.skin, stroke=c.line, sw=3)
            + path(f'M 330 {y + 76} C 380 {y + 84} 420 {y + 84} 470 {y + 76}', stroke=c.skin_sh2, sw=2.2, extra='opacity="0.7"')
            + path(f'M 396 {y + 70} q 4 8 8 0', stroke=c.skin_sh2, sw=2.6))


@outfit('office')
def outfit_office(c):
    p = c.pal
    blouse = p.get('blouse', '#f6f3fb')
    jacket = p.get('jacket', '#2c3550')
    jacket_hi = p.get('jacket_hi', '#3c4768')
    tie = p.get('tie', '#b8324f')
    t = torso_cloth(c, blouse, '358 548 C 380 600 420 600 442 548')
    t += path('M 358 548 L 372 600 L 400 584 L 428 600 L 442 548', fill=blouse, stroke=c.line, sw=3)
    t += path('M 392 590 L 408 590 L 414 700 L 400 724 L 386 700 Z', fill=tie, stroke=c.line, sw=2.8)
    jl = ('M 238 578 C 270 566 320 560 356 552 C 360 620 372 700 392 780 L 384 1000 L 298 1000 '
          'C 300 980 300 950 296 920 C 280 840 262 760 250 692 L 200 650 C 202 616 214 590 238 578 Z')
    t += both(jl, fill=jacket, stroke=c.line, sw=3.2)
    t += both('M 356 552 C 340 600 330 640 336 690 L 362 640 Z', fill=jacket_hi, stroke=c.line, sw=2.8)
    t += path('M 392 780 L 408 780', stroke=c.line, sw=3) + f'<circle cx="400" cy="860" r="7" fill="{jacket_hi}" stroke="{c.line}" stroke-width="2.4"/>'
    t += both('M 300 900 L 350 896', stroke=jacket_hi, sw=4)
    a = sleeves(c, jacket) + both('M 214 640 C 208 720 204 820 202 1000', stroke=jacket_hi, sw=4)
    return t, a


@outfit('jacket_crop')
def outfit_jacket_crop(c):
    p = c.pal
    top = p.get('top', '#1d1a24')
    jacket = p.get('jacket', '#e9e2f5')
    jacket_sh = p.get('jacket_sh', '#c9bedc')
    accent = p.get('accent', '#ff5fa2')
    t = torso_cloth(c, top, '352 552 C 376 586 424 586 448 552')
    t += path('M 350 560 C 376 594 424 594 450 560', stroke=accent, sw=4)
    t += waist_skin(c, 860)
    t += path('M 296 986 C 360 994 440 994 504 986 L 504 1000 L 296 1000 Z', fill=p.get('pants', '#2b2238'), stroke=c.line, sw=2.6)
    jl = ('M 232 576 C 262 566 300 562 330 560 C 330 640 318 740 300 860 C 296 900 298 960 300 1000 L 240 1000 '
          'C 240 900 236 800 232 700 L 200 650 C 202 616 212 590 232 576 Z')
    t += both(jl, fill=jacket, stroke=c.line, sw=3.2)
    t += both('M 330 560 C 320 640 312 700 300 760 C 290 720 284 680 282 640 Z', fill=jacket_sh, stroke=c.line, sw=2.6)
    a = sleeves(c, jacket) + both('M 206 760 C 210 840 212 920 210 1000', stroke=jacket_sh, sw=5) + both('M 212 610 L 248 620', stroke=accent, sw=6)
    return t, a


@outfit('band_tee')
def outfit_band_tee(c):
    p = c.pal
    tee = p.get('tee', '#18151d')
    print_ = p.get('print', '#d33a4a')
    net = p.get('net', '#2a2430')
    tee_d = ('M 228 584 C 264 566 316 560 352 552 C 376 592 424 592 448 552 C 484 560 536 566 572 584 '
             'C 596 604 608 650 612 700 L 556 712 C 540 780 520 860 512 930 C 508 960 508 980 510 1000 '
             'L 290 1000 C 292 980 292 960 288 930 C 280 860 260 780 244 712 L 188 700 C 192 650 204 604 228 584 Z')
    t = path(tee_d, fill=tee, stroke=c.line, sw=3.2)
    t += path('M 352 552 C 376 592 424 592 448 552', stroke='#3a3442', sw=6)
    t += path('M 400 742 C 370 742 352 762 354 790 C 356 808 366 818 372 824 L 372 840 L 428 840 L 428 824 C 434 818 444 808 446 790 C 448 762 430 742 400 742 Z', fill='#ece6f0')
    t += f'<ellipse cx="384" cy="790" rx="10" ry="12" fill="{tee}"/><ellipse cx="416" cy="790" rx="10" ry="12" fill="{tee}"/>' + path('M 396 810 L 400 802 L 404 810 Z', fill=tee)
    t += both('M 350 784 C 320 760 300 770 282 752 C 296 790 316 800 346 806 Z', fill=print_)
    t += f'<text x="400" y="890" text-anchor="middle" font-family="Impact, Arial Black, sans-serif" font-size="34" fill="{print_}" letter-spacing="2">NO SIGNAL</text>'
    # mangas de rejilla sobre los brazos y la manga corta encima
    a = f'<clipPath id="armsClip"><path d="{ARM_L}"/><path d="{mirror_d(ARM_L)}"/></clipPath><g clip-path="url(#armsClip)" opacity="0.85">'
    for k in range(-6, 20):
        x0 = 170 + k * 8
        a += path(f'M {x0} 600 L {x0 + 60} 1000', stroke=net, sw=1.6) + path(f'M {x0 + 60} 600 L {x0} 1000', stroke=net, sw=1.6)
        a += path(mirror_d(f'M {x0} 600 L {x0 + 60} 1000'), stroke=net, sw=1.6) + path(mirror_d(f'M {x0 + 60} 600 L {x0} 1000'), stroke=net, sw=1.6)
    a += '</g>' + both('M 228 584 C 204 604 192 650 188 700 L 252 712 C 250 660 248 620 238 580 Z', fill=tee, stroke=c.line, sw=3)
    return t, a


@outfit('haori')
def outfit_haori(c):
    p = c.pal
    under = p.get('under', '#f8f4f0')
    haori = p.get('haori', '#b4344a')
    haori_sh = p.get('haori_sh', '#8a2236')
    trim = p.get('trim', '#f3d27a')
    t = torso_cloth(c, under, '360 548 C 380 640 420 640 440 548')
    t += path('M 360 548 L 400 660 L 440 548', stroke=c.line, sw=3)
    t += path('M 298 820 L 502 820 L 504 880 L 296 880 Z', fill=p.get('obi', '#2d2a44'), stroke=c.line, sw=3)
    t += path('M 296 846 L 504 846', stroke=trim, sw=6)
    hl = ('M 226 578 C 262 566 304 560 340 556 C 352 640 366 740 372 820 L 364 1000 L 296 1000 '
          'C 296 900 280 800 250 692 L 200 650 C 202 616 210 594 226 578 Z')
    t += both(hl, fill=haori, stroke=c.line, sw=3.2)
    t += both('M 340 556 C 352 640 366 740 372 820 L 364 1000 L 346 1000 L 354 820 C 348 740 334 650 324 560 Z', fill=trim, stroke=c.line, sw=2.4)
    sl = 'M 226 578 C 196 592 180 630 176 680 C 170 790 166 900 160 1000 L 270 1000 C 268 900 262 800 256 700 C 254 650 250 610 236 580 Z'
    a = both(sl, fill=haori, stroke=c.line, sw=3.2) + both('M 196 760 C 194 840 192 920 188 1000', stroke=haori_sh, sw=5)
    for (x, y) in ((220, 700), (210, 880), (244, 940)):
        a += circles(x, y, 10, fill=trim, extra='opacity="0.85"')
    return t, a


@outfit('techwear')
def outfit_techwear(c):
    p = c.pal
    base = p.get('base', '#1b1f2a')
    plate = p.get('plate', '#2a3142')
    neon = p.get('neon', '#3cf2d8')
    t = torso_cloth(c, base, '366 546 C 384 560 416 560 434 546')
    t += path('M 366 520 L 434 520 L 438 556 L 362 556 Z', fill=plate, stroke=c.line, sw=3)
    jl = ('M 232 578 C 268 566 310 560 350 556 C 356 640 372 740 380 1000 L 298 1000 '
          'C 300 950 296 920 280 840 C 266 780 256 730 250 692 L 200 650 C 204 616 212 592 232 578 Z')
    t += both(jl, fill=plate, stroke=c.line, sw=3.2)
    t += both('M 350 556 C 356 640 372 740 380 1000', stroke=neon, sw=4)
    t += path('M 384 600 L 416 600 L 416 1000 L 384 1000 Z', fill=base, stroke=c.line, sw=2.6)
    for k in range(9):
        t += f'<rect x="392" y="{612 + k * 40}" width="16" height="6" rx="2" fill="{neon}" opacity="0.7"/>'
    a = sleeves(c, plate)
    a += both('M 196 640 L 248 652 L 252 690 L 196 680 Z', fill=base, stroke=c.line, sw=2.6) + both('M 200 664 L 246 674', stroke=neon, sw=3)
    a += both('M 188 780 L 252 790 L 256 880 L 186 870 Z', fill=base, stroke=c.line, sw=2.6) + both('M 194 800 L 250 808', stroke=neon, sw=3)
    return t, a


@outfit('apron')
def outfit_apron(c):
    p = c.pal
    shirt = p.get('shirt', '#f3ead8')
    apron = p.get('apron', '#5a3a2c')
    t = torso_cloth(c, shirt, '356 550 C 378 592 422 592 444 550')
    t += path('M 356 550 L 376 590 L 400 576 L 424 590 L 444 550', fill=shirt, stroke=c.line, sw=3)
    t += path('M 326 700 C 360 690 440 690 474 700 L 492 1000 L 308 1000 Z', fill=apron, stroke=c.line, sw=3.2)
    t += both('M 326 700 C 316 650 330 600 352 572', stroke=apron, sw=10)
    t += path('M 350 800 L 450 800 L 446 870 L 354 870 Z', stroke='#e9d8bd', sw=3)
    t += path('M 384 820 C 380 800 400 796 400 812 C 400 796 420 800 416 820 L 400 840 Z', fill='#e9d8bd')
    a = sleeves(c, shirt) + both('M 200 900 C 220 910 246 910 262 902', stroke='#d6c8ad', sw=4) + both('M 214 640 C 208 720 204 820 202 900', stroke='#e2d6c0', sw=4)
    return t, a


@outfit('mage')
def outfit_mage(c):
    p = c.pal
    robe = p.get('robe', '#26305e')
    robe_hi = p.get('robe_hi', '#36428a')
    gold = p.get('gold', '#e8c46a')
    t = torso_cloth(c, p.get('under', '#ece5d6'), '360 548 C 380 600 420 600 440 548')
    t += path('M 300 760 L 500 760', stroke=p.get('belt', '#6b3d2a'), sw=12)
    cape = ('M 232 572 C 270 552 330 540 400 540 C 470 540 530 552 568 572 C 600 600 616 660 620 720 '
            'L 640 1000 L 520 1000 C 520 860 500 740 472 640 C 450 610 420 600 400 600 C 380 600 350 610 328 640 '
            'C 300 740 280 860 280 1000 L 160 1000 L 180 720 C 184 660 200 600 232 572 Z')
    a = path(cape, fill=robe, stroke=c.line, sw=3.2)
    a += path('M 328 640 C 350 610 380 600 400 600 C 420 600 450 610 472 640', stroke=gold, sw=6)
    a += both('M 232 572 C 210 620 200 700 196 800', stroke=robe_hi, sw=6)
    a += f'<circle cx="400" cy="604" r="16" fill="{gold}" stroke="{c.line}" stroke-width="3"/><circle cx="400" cy="604" r="7" fill="#7fe0ff"/>'
    return t, a


# --- prendas +18: insinuantes, nunca desnudos
@outfit('bodysuit')
def outfit_bodysuit(c):
    p = c.pal
    suit = p.get('suit', '#1a1020')
    suit_hi = p.get('suit_hi', '#3a2340')
    trim = p.get('trim', '#c4245a')
    t = cleavage(c, top=640, depth=70)
    d = ('M 262 600 C 290 606 312 612 334 618 C 352 680 372 740 400 790 C 428 740 448 680 466 618 '
         'C 488 612 510 606 538 600 C 550 640 552 670 550 692 C 538 760 520 840 504 920 '
         'C 500 950 500 980 502 1000 L 298 1000 C 300 980 300 950 296 920 C 280 840 262 760 250 692 C 248 670 250 640 262 600 Z')
    t += path(d, fill=suit, stroke=c.line, sw=3.2)
    t += both('M 334 618 C 352 680 372 740 400 790', stroke=trim, sw=4)
    t += both('M 300 704 C 316 744 340 770 370 778', stroke=suit_hi, sw=4)
    t += both('M 262 760 C 274 840 286 900 298 960', stroke=suit_hi, sw=3)
    t += path('M 384 800 C 380 780 400 776 400 792 C 400 776 420 780 416 800 L 400 818 Z', fill=trim)
    glove = 'M 189 700 C 186 800 184 900 180 1000 L 262 1000 C 262 900 258 800 255 706 C 234 714 208 712 189 700 Z'
    a = both(glove, fill=suit, stroke=c.line, sw=3.2) + both('M 189 700 C 208 712 234 714 255 706', stroke=trim, sw=4)
    return t, a


@outfit('gown')
def outfit_gown(c):
    p = c.pal
    gown = p.get('gown', '#3a0d1e')
    gown_hi = p.get('gown_hi', '#5e1a32')
    lace = p.get('lace', '#1a0a12')
    t = cleavage(c, top=652, depth=56)
    d = ('M 250 670 C 280 660 314 666 338 680 C 358 704 378 722 400 716 C 422 722 442 704 462 680 '
         'C 486 666 520 660 550 670 C 554 690 554 700 550 712 C 536 790 520 860 504 920 '
         'C 500 950 500 980 502 1000 L 298 1000 C 300 980 300 950 296 920 C 280 860 264 790 250 712 C 246 700 246 690 250 670 Z')
    t += path(d, fill=gown, stroke=c.line, sw=3.2)
    t += path('M 250 670 C 280 660 314 666 338 680 C 358 704 378 722 400 716 C 422 722 442 704 462 680 C 486 666 520 660 550 670', stroke=lace, sw=8)
    for k in range(15):
        x = 256 + k * 20.5
        y = 676 + (36 if 5 <= k <= 9 else 18 if k in (4, 10) else 4)
        t += f'<circle cx="{f(x)}" cy="{f(y)}" r="5" fill="none" stroke="{lace}" stroke-width="2"/>'
    t += path('M 330 900 C 380 880 420 880 470 900', stroke=gown_hi, sw=4)
    sl = 'M 189 690 C 186 790 184 890 180 1000 L 262 1000 C 262 900 258 800 255 696 C 234 708 208 704 189 690 Z'
    a = both(sl, fill=gown, stroke=c.line, sw=3.2) + both('M 189 690 C 208 704 234 708 255 696', stroke=lace, sw=7)
    a += both('M 200 760 C 198 840 196 920 194 1000', stroke=gown_hi, sw=3)
    return t, a


@outfit('bunny')
def outfit_bunny(c):
    p = c.pal
    suit = p.get('suit', '#121018')
    suit_hi = p.get('suit_hi', '#2e2a3a')
    cuff = p.get('cuff', '#f4f2f8')
    bow = p.get('bow', '#c8204e')
    t = cleavage(c, top=668, depth=50)
    d = ('M 262 708 C 286 690 318 690 344 704 C 362 716 382 724 400 718 C 418 724 438 716 456 704 '
         'C 482 690 514 690 538 708 C 540 760 524 840 510 920 C 504 950 502 980 504 1000 L 296 1000 '
         'C 298 980 296 950 290 920 C 276 840 260 760 262 708 Z')
    t += path(d, fill=suit, stroke=c.line, sw=3.2)
    t += both('M 270 712 C 300 700 330 704 350 716', stroke=suit_hi, sw=5)
    t += both('M 280 760 C 290 840 300 900 306 980', stroke=suit_hi, sw=3)
    a = both('M 184 900 C 206 912 236 912 260 904 L 261 960 C 236 968 206 968 182 958 Z', fill=cuff, stroke=c.line, sw=2.6)
    a += circles(222, 932, 6, fill=p.get('link', '#d9b45a'), stroke=c.line, sw=2)
    return t, a


@outfit('bikini')
def outfit_bikini(c):
    p = c.pal
    top = p.get('top', '#ff6f8f')
    top_sh = p.get('top_sh', '#d94a6c')
    tie = p.get('tie', '#ffffff')
    t = cleavage(c, top=666, depth=50)
    t += path('M 330 936 C 380 944 420 944 470 936', stroke=c.skin_sh2, sw=2.2, extra='opacity="0.6"')
    t += path('M 396 920 q 4 8 8 0', stroke=c.skin_sh2, sw=2.6)
    cup = 'M 270 712 C 284 682 330 674 384 700 C 388 740 380 772 364 790 C 330 798 292 790 274 770 C 264 750 264 728 270 712 Z'
    t += both(cup, fill=top, stroke=c.line, sw=3.2)
    t += both('M 286 730 C 302 718 330 716 360 728', stroke=top_sh, sw=4)
    t += path('M 384 700 L 416 700', stroke=tie, sw=6)
    t += both('M 330 682 C 340 640 356 590 366 552', stroke=tie, sw=5)
    t += both('M 274 770 C 264 772 256 770 250 764', stroke=tie, sw=5)
    t += path('M 296 980 C 360 962 440 962 504 980 L 504 1000 L 296 1000 Z', fill=p.get('sarong', '#5fd0e0'), stroke=c.line, sw=3)
    a = both('M 182 930 C 206 940 236 940 260 934', stroke=p.get('bracelet', '#ffd45a'), sw=6)
    return t, a


@outfit('catsuit')
def outfit_catsuit(c):
    """Mono ajustado de ladrona con la cremallera algo bajada."""
    p = c.pal
    suit = p.get('suit', '#14121c')
    hi = p.get('suit_hi', '#34304a')
    zip_ = p.get('zip', '#d8d4e4')
    t = cleavage(c, top=630, depth=56)
    d = ('M 238 578 C 270 566 320 560 352 552 C 368 600 384 660 400 720 C 416 660 432 600 448 552 '
         'C 480 560 530 566 562 578 C 586 590 598 616 600 650 L 550 692 C 538 760 520 840 504 920 '
         'C 500 950 500 980 502 1000 L 298 1000 C 300 980 300 950 296 920 C 280 840 262 760 250 692 L 200 650 C 202 616 214 590 238 578 Z')
    t += path(d, fill=suit, stroke=c.line, sw=3.2)
    t += path('M 352 552 C 368 600 384 660 400 720 C 416 660 432 600 448 552', stroke=hi, sw=5)
    t += path('M 400 720 L 400 1000', stroke=zip_, sw=3)
    t += f'<rect x="393" y="716" width="14" height="22" rx="3" fill="{zip_}" stroke="{c.line}" stroke-width="2"/>'
    t += both('M 262 740 C 276 820 288 900 298 980', stroke=hi, sw=3)
    t += path('M 298 880 L 502 880 L 502 902 L 298 902 Z', fill=p.get('belt', '#2a2236'), stroke=c.line, sw=2.6)
    t += f'<rect x="384" y="878" width="32" height="26" rx="4" fill="none" stroke="{zip_}" stroke-width="3"/>'
    a = sleeves(c, suit) + both('M 214 640 C 208 720 204 820 202 1000', stroke=hi, sw=4)
    a += both('M 184 940 C 206 950 236 950 260 944 L 261 1000 L 182 1000 Z', fill=p.get('glove', '#2a2236'), stroke=c.line, sw=2.6)
    return t, a


@outfit('slip')
def outfit_slip(c):
    """Vestido lencero de satén con encaje y tirantes finos."""
    p = c.pal
    silk = p.get('silk', '#e98fb4')
    silk_hi = p.get('silk_hi', '#ffc4dc')
    silk_sh = p.get('silk_sh', '#c46a92')
    lace = p.get('lace', '#fff4fa')
    t = cleavage(c, top=660, depth=52)
    d = ('M 262 700 C 290 684 330 686 356 706 C 372 718 388 726 400 722 C 412 726 428 718 444 706 '
         'C 470 686 510 684 538 700 C 542 760 526 840 512 920 C 506 950 504 980 506 1000 L 294 1000 '
         'C 296 980 294 950 288 920 C 274 840 258 760 262 700 Z')
    t += path(d, fill=silk, stroke=c.line, sw=3.2)
    t += path('M 262 700 C 290 684 330 686 356 706 C 372 718 388 726 400 722 C 412 726 428 718 444 706 C 470 686 510 684 538 700', stroke=lace, sw=7)
    for k in range(13):
        x = 268 + k * 22
        y = 704 + (14 if 4 <= k <= 8 else 6)
        t += f'<path d="M {x - 8} {y} q 8 10 16 0" fill="none" stroke="{lace}" stroke-width="2.4"/>'
    t += both('M 300 702 C 316 640 336 590 356 552', stroke=silk_sh, sw=4)
    t += both('M 290 760 C 300 840 310 900 316 990', stroke=silk_hi, sw=6, extra='opacity="0.7"')
    t += path('M 360 900 C 380 930 420 930 440 900', stroke=silk_sh, sw=3, extra='opacity="0.8"')
    a = both('M 182 930 C 206 940 236 940 260 934', stroke=p.get('bracelet', '#e8d6a0'), sw=5)
    return t, a


def body(c):
    """Cuerpo bajo la cabeza: piel del tronco, prenda, piel de los brazos y lo que va en los brazos."""
    t, a = OUTFITS[c.outfit](c)
    skin_t = (path(TORSO_SKIN, fill=c.skin, stroke=c.line, sw=3.2)
              + path(COLLAR_L, stroke=c.skin_sh2, sw=3) + path(mirror_d(COLLAR_L), stroke=c.skin_sh2, sw=3)
              + path('M 360 548 C 380 562 420 562 440 548 L 440 560 C 420 576 380 576 360 560 Z', fill=c.skin_sh, extra='opacity="0.7"'))
    skin_a = both(ARM_L, fill=c.skin, stroke=c.line, sw=3.2) + both('M 216 640 C 210 700 206 760 204 820', stroke=c.skin_sh, sw=6, extra='opacity="0.55"')
    return f'<g id="body">{skin_t}{t}{skin_a}{a}</g>'


# ------------------------------------------------------------------ accesorios
def acc_back(c):
    """Lo que va detrás del pelo (alas, cola…)."""
    out = ''
    if 'wings' in c.acc:
        wing = ('M 250 620 C 180 560 110 500 60 420 C 100 520 90 560 70 600 C 110 590 130 610 120 650 '
                'C 160 630 180 650 180 690 C 210 670 236 670 250 680 Z')
        out += both(wing, fill=c.pal.get('wing', '#2a1630'), stroke=c.line, sw=3)
        out += both('M 250 640 C 200 580 140 520 70 430 M 230 650 C 180 620 140 610 72 600 M 230 664 C 200 660 160 650 122 648', stroke=c.pal.get('wing_hi', '#4c2a56'), sw=3)
    if 'tail_fox' in c.acc:
        tail = 'M 520 1000 C 600 940 700 900 720 800 C 740 720 700 660 660 650 C 690 720 650 800 580 860 C 540 890 510 940 500 1000 Z'
        out += path(tail, fill=c.hair, stroke=c.line, sw=3) + path('M 720 800 C 730 740 700 680 664 652 C 690 700 704 740 700 790 Z', fill='#ffffff', stroke=c.line, sw=2.4)
    return out


def acc_head_back(c):
    out = ''
    if 'bunny_ears' in c.acc:
        ear = 'M 330 160 C 300 80 290 -10 320 -30 C 350 -20 362 70 356 150 Z'
        out += path(ear, fill=c.pal.get('ears', '#121018'), stroke=c.line, sw=3)
        out += path('M 332 140 C 312 70 312 10 322 -12 C 340 10 346 80 344 140 Z', fill=c.pal.get('ears_in', '#f4b6c8'))
        ear2 = 'M 448 150 C 460 70 500 -10 532 0 C 548 30 510 100 474 166 Z'
        out += path(ear2, fill=c.pal.get('ears', '#121018'), stroke=c.line, sw=3)
        out += path('M 458 146 C 472 80 500 20 522 12 C 526 40 494 100 470 152 Z', fill=c.pal.get('ears_in', '#f4b6c8'))
    return out


def acc_front(c):
    """Accesorios encima del pelo de delante (forman parte de la «cabeza»)."""
    out = ''
    if 'horns' in c.acc:
        horn = 'M 330 170 C 316 120 290 90 250 80 C 282 104 296 140 300 186 Z'
        out += both(horn, fill=c.pal.get('horn', '#3a1a2a'), stroke=c.line, sw=3)
        out += both('M 318 160 C 306 130 290 110 268 96', stroke=c.pal.get('horn_hi', '#7a3f58'), sw=3)
    if 'fox_ears' in c.acc:
        ear = 'M 300 170 L 272 70 Q 276 58 288 62 L 362 136 Z'
        out += both(ear, fill=c.hair, stroke=c.line, sw=3) + both('M 296 150 L 282 88 L 340 140 Z', fill='#ffd9e2')
        out += both('M 272 70 Q 276 58 288 62 L 300 76 L 280 84 Z', fill=c.pal.get('ear_tip', '#ffffff'))
    if 'cat_ears' in c.acc:
        ear = 'M 296 176 L 282 92 Q 286 80 298 86 L 356 140 Z'
        out += both(ear, fill=c.hair, stroke=c.line, sw=3) + both('M 298 160 L 290 104 L 340 142 Z', fill=c.pal.get('ear_in', '#e8a0c0'))
    if 'glasses' in c.acc:
        col = c.pal.get('glasses', '#3a2a40')
        for (x, y) in (EYE_L, EYE_R):
            out += f'<rect x="{x - 52}" y="{y - 34}" width="104" height="72" rx="20" fill="#ffffff" fill-opacity="0.08" stroke="{col}" stroke-width="5"/>'
        out += path(f'M {EYE_L[0] + 52} {EYE_Y - 6} Q 400 {EYE_Y - 16} {EYE_R[0] - 52} {EYE_Y - 6}', stroke=col, sw=5)
        out += path(f'M {EYE_L[0] - 52} {EYE_Y - 14} L 278 {EYE_Y - 18} M {EYE_R[0] + 52} {EYE_Y - 14} L 522 {EYE_Y - 18}', stroke=col, sw=5)
        out += path(f'M {EYE_L[0] - 30} {EYE_Y - 24} l 20 -6 M {EYE_R[0] - 30} {EYE_Y - 24} l 20 -6', stroke='#ffffff', sw=4, extra='opacity="0.7"')
    if 'visor' in c.acc:
        col = c.pal.get('neon', '#3cf2d8')
        out += path('M 262 252 C 300 236 500 236 538 252 L 534 270 C 500 256 300 256 266 270 Z', fill='#11151e', stroke=c.line, sw=3)
        out += path('M 280 258 C 340 248 460 248 520 258', stroke=col, sw=3)
    if 'sunglasses' in c.acc:
        out += path('M 300 186 C 330 168 380 168 396 182 C 396 200 380 212 350 212 C 316 212 300 202 300 186 Z', fill='#1a1a22', stroke=c.line, sw=3)
        out += path(mirror_d('M 300 186 C 330 168 380 168 396 182 C 396 200 380 212 350 212 C 316 212 300 202 300 186 Z'), fill='#1a1a22', stroke=c.line, sw=3)
        out += path('M 396 182 Q 400 178 404 182', stroke=c.line, sw=4) + path('M 314 186 l 26 -8', stroke='#9fd8ff', sw=4, extra='opacity="0.7"')
    if 'flower' in c.acc:
        x, y = 486, 176
        for k in range(5):
            a = k * 2 * math.pi / 5
            out += f'<ellipse cx="{f(x + math.cos(a) * 14)}" cy="{f(y + math.sin(a) * 14)}" rx="12" ry="9" transform="rotate({f(math.degrees(a))} {f(x + math.cos(a) * 14)} {f(y + math.sin(a) * 14)})" fill="{c.pal.get("flower", "#ff9ec0")}" stroke="{c.line}" stroke-width="2"/>'
        out += f'<circle cx="{x}" cy="{y}" r="7" fill="#ffd45a" stroke="{c.line}" stroke-width="2"/>'
    if 'hairpin' in c.acc:
        out += path('M 300 216 L 340 200 M 304 230 L 344 214', stroke=c.pal.get('pin', '#ffd45a'), sw=6)
    if 'tiara' in c.acc:
        gold = c.pal.get('gold', '#e8c46a')
        out += path('M 330 150 L 350 116 L 370 142 L 400 100 L 430 142 L 450 116 L 470 150 C 440 140 360 140 330 150 Z', fill=gold, stroke=c.line, sw=2.8)
        out += f'<circle cx="400" cy="128" r="7" fill="{c.pal.get("gem", "#c4245a")}"/>'
    return out


def earrings(c):
    out = ''
    if 'earrings' in c.acc:
        col = c.pal.get('metal', '#d8d4e4')
        for x in (262, 538):
            out += f'<circle cx="{x}" cy="372" r="8" fill="none" stroke="{col}" stroke-width="3.5"/>'
            out += f'<circle cx="{x}" cy="352" r="3.5" fill="{col}"/>'
    if 'lip_ring' in c.acc:
        out += f'<path d="M 386 434 a 7 7 0 1 0 8 -2" fill="none" stroke="{c.pal.get("metal", "#d8d4e4")}" stroke-width="3"/>'
    return out


def neckwear(c):
    out = ''
    if 'choker' in c.acc:
        col = c.pal.get('choker', '#1a1218')
        out += path('M 366 500 C 384 510 416 510 434 500 L 435 518 C 416 528 384 528 365 518 Z', fill=col, stroke=c.line, sw=2.6)
        if 'choker_ring' in c.acc or c.adult:
            out += f'<circle cx="400" cy="532" r="9" fill="none" stroke="{c.pal.get("metal", "#d8d4e4")}" stroke-width="3.2"/>'
    if 'bowtie' in c.acc:
        cuff, bow = c.pal.get('cuff', '#f4f2f8'), c.pal.get('bow', '#c8204e')
        out += path('M 364 506 C 382 514 418 514 436 506 L 437 524 C 418 532 382 532 363 524 Z', fill=cuff, stroke=c.line, sw=2.6)
        out += path('M 400 524 L 374 512 L 374 540 Z M 400 524 L 426 512 L 426 540 Z', fill=bow, stroke=c.line, sw=2.4)
        out += f'<circle cx="400" cy="525" r="6" fill="{bow}" stroke="{c.line}" stroke-width="2.4"/>'
    if 'necklace' in c.acc:
        out += path('M 362 548 C 380 600 420 600 438 548', stroke=c.pal.get('gold', '#e8c46a'), sw=2.6)
        out += f'<path d="M 400 600 l -7 -9 a 5 5 0 0 1 7 -6 a 5 5 0 0 1 7 6 Z" fill="{c.pal.get("gem", "#c4245a")}"/>'
    return out


# ------------------------------------------------------------------ montaje
def head_front(c, eyes_kind='open', brows_kind='neutral', mouth_kind='neutral', blush=0, extra=''):
    """La parte delantera de la cabeza: igual en la base y en cada cara."""
    style = c.hair_style
    lock_kind = HAIR_STYLES[style](c)[1]
    locks = ''
    if lock_kind == 'long':
        locks = side_locks(c, 'long')
    elif lock_kind == 'short':
        locks = side_locks(c, 'short')
    elif lock_kind == 'hime':
        locks = hime_locks(c)
    mole = '<circle cx="452" cy="404" r="2.6" fill="#5a3640"/>' if c.mole else ''
    return (
        face(c)
        + cheeks(c, blush)
        + mole
        + eyes(c, eyes_kind)
        + lipstick(c, mouth_kind)
        + mouth(c, mouth_kind)
        + extra
        + path(bangs_d(c.bangs), fill='url(#hairFront)', stroke=c.line, sw=3)
        + bangs_lines(c, c.bangs)
        + brows(c, brows_kind)
        + locks
        + earrings(c)
        + acc_front(c)
    )


def base_svg(c):
    hair_back = HAIR_STYLES[c.hair_style](c)[0]
    return (acc_back(c) + acc_head_back(c) + hair_back + body(c) + neck(c) + neckwear(c) + head_front(c))


def svg(c, content):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">{defs(c)}{content}</svg>\n'


# ------------------------------------------------------------------ caras por emoción
# eyes, brows, mouth, blush (0–2) y extras dibujados en la cara. Los nombres coinciden con
# src/shared/expressions.js (EMOTIONS).
FACES = {
    'happy': dict(eyes='smile', brows='soft', mouth='smile_open', blush=1),
    'excited': dict(eyes='sparkle', brows='up', mouth='grin_open', blush=1),
    'laugh': dict(eyes='closed_happy', brows='up', mouth='laugh', blush=1),
    'love': dict(eyes='heart', brows='soft', mouth='smile', blush=2),
    'shy': dict(eyes='aside_down', brows='worried', mouth='wavy', blush=2),
    'flirty': dict(eyes='wink_half', brows='soft', mouth='kiss', blush=1),
    'smug': dict(eyes='half', brows='raised', mouth='smirk'),
    'playful': dict(eyes='wink', brows='up', mouth='tongue', blush=1),
    'proud': dict(eyes='closed_proud', brows='determined', mouth='grin_closed'),
    'grateful': dict(eyes='closed_happy', brows='worried', mouth='smile', blush=1),
    'relaxed': dict(eyes='closed_soft', brows='soft', mouth='smile_small'),
    'relieved': dict(eyes='closed_soft', brows='worried', mouth='sigh'),
    'dreamy': dict(eyes='sparkle_up', brows='up', mouth='smile_small', blush=1),
    'sleepy': dict(eyes='sleepy', brows='low', mouth='small_o'),
    'bored': dict(eyes='half_aside', brows='flat', mouth='flat'),
    'thinking': dict(eyes='up_side', brows='raised', mouth='hmm'),
    'curious': dict(eyes='sparkle', brows='raised', mouth='small_o'),
    'confused': dict(eyes='confused', brows='uneven', mouth='wavy'),
    'surprised': dict(eyes='wide', brows='up', mouth='o'),
    'shocked': dict(eyes='shock', brows='up', mouth='scream'),
    'scared': dict(eyes='wide_teary', brows='worried', mouth='wavy_open'),
    'nervous': dict(eyes='nervous', brows='worried', mouth='wavy'),
    'worried': dict(eyes='teary', brows='worried', mouth='frown_small'),
    'sad': dict(eyes='sad', brows='sad', mouth='frown'),
    'crying': dict(eyes='closed_tight', brows='sad', mouth='sob', extra='tears'),
    'pout': dict(eyes='half_aside', brows='angry', mouth='pout', blush=2),
    'annoyed': dict(eyes='half', brows='angry', mouth='flat_frown'),
    'angry': dict(eyes='angry', brows='angry', mouth='grit'),
    'disgusted': dict(eyes='squint', brows='angry', mouth='disgust'),
    'determined': dict(eyes='determined', brows='determined', mouth='grin_closed'),
    'dizzy': dict(eyes='spiral', brows='uneven', mouth='wavy_open', blush=1),
}
TALK = {'mouthHalf': 'talk_half', 'mouthOpen': 'talk_open'}


def face_layer(c, spec):
    extra = ''
    if spec.get('extra') == 'tears':
        extra = tears(c, 'stream')
    return head_front(c, spec['eyes'], spec['brows'], spec['mouth'], spec.get('blush', 0), extra)


def clip_layer(c, content, shapes):
    clip = ''.join(shapes)
    return f'<clipPath id="layerClip">{clip}</clipPath><g clip-path="url(#layerClip)">{content}</g>'


EYES_CLIP = [f'<ellipse cx="{EYE_L[0]}" cy="{EYE_Y - 4}" rx="{EYE_W / 2 + 18}" ry="{EYE_H / 2 + 13}"/>',
             f'<ellipse cx="{EYE_R[0]}" cy="{EYE_Y - 4}" rx="{EYE_W / 2 + 18}" ry="{EYE_H / 2 + 13}"/>']
MOUTH_CLIP = [f'<ellipse cx="{MOUTH[0]}" cy="{MOUTH[1] + 8}" rx="44" ry="30"/>']


def layers(c):
    """Todas las capas de la skin: {nombre de archivo: svg}."""
    out = {
        'base.svg': svg(c, base_svg(c)),
        'eyes_closed.svg': svg(c, clip_layer(c, head_front(c, 'closed'), EYES_CLIP)),
        'mouth_half.svg': svg(c, clip_layer(c, head_front(c, mouth_kind='talk_half'), MOUTH_CLIP)),
        'mouth_open.svg': svg(c, clip_layer(c, head_front(c, mouth_kind='talk_open'), MOUTH_CLIP)),
    }
    for name, spec in FACES.items():
        out[f'emo_{name}.svg'] = svg(c, face_layer(c, spec))
    return out


# ------------------------------------------------------------------ personajes
# Todas son mujeres adultas (la edad va en skin.json). Las «adult» son insinuantes, sin desnudos,
# y la app solo las enseña con el contenido +18 desbloqueado.
def N(es, en, ru, uk, zh):
    return {'es': es, 'en': en, 'ru': ru, 'uk': uk, 'zh': zh}


CHARS = [
    Char(id='aiko', name='Aiko', age=27,
         desc=N('Secretaria eficiente con gafas', 'Efficient secretary with glasses', 'Деловая секретарша в очках', 'Ділова секретарка в окулярах', '戴眼镜的干练秘书'),
         hair_style='bob', bangs='side', acc=['glasses', 'earrings'],
         hair='#3a2622', hair_sh='#28181a', hair_hi='#6a4a40', iris=('#1e2a4a', '#3f6db0', '#9fc4ef'),
         outfit='office', lips='#cf6a7a'),
    Char(id='mika', name='Mika', age=24,
         desc=N('Alternativa: rejilla, piercings y camiseta de grupo', 'Alt girl: mesh, piercings and a band tee', 'Альтернативщица: сетка, пирсинг и футболка группы', 'Альтернативниця: сітка, пірсинг і футболка гурту', '另类女孩：网纱、穿孔和乐队T恤'),
         hair_style='undercut', bangs='short', acc=['earrings', 'lip_ring', 'choker', 'choker_ring'],
         hair='#151217', hair_sh='#0a080c', hair_hi='#4a3a52', hair_tip='#c4245a', iris=('#3a0a0a', '#c42020', '#ffa080'),
         outfit='band_tee', wing=True, eyeshadow='#5a2a6a', lips='#7a2a4a', lips_dark='#4a1a2e', lash='#0e080c'),
    Char(id='yuki', name='Yuki', age=25,
         desc=N('Kitsune del santuario, pelo plateado y haori', 'Shrine kitsune with silver hair and haori', 'Кицунэ из святилища в хаори', 'Кіцуне зі святилища в хаорі', '神社的狐狸小姐，银发与羽织'),
         hair_style='long', bangs='split', ears='none', acc=['fox_ears', 'tail_fox'],
         hair='#eef0f8', hair_sh='#b9bdd6', hair_hi='#ffffff', iris=('#5a3200', '#d8920c', '#ffe08a'),
         outfit='haori', lash='#4a3040', pal={'brow': '#9a9cbc'}),
    Char(id='lena', name='Lena', age=26,
         desc=N('Hacker ciberpunk con visor y techwear', 'Cyberpunk hacker with visor and techwear', 'Киберпанк-хакерша в визоре', 'Кіберпанк-хакерка у візорі', '戴护目镜的赛博朋克黑客'),
         hair_style='ponytail', bangs='swept', acc=['visor', 'earrings'],
         hair='#1f8f9a', hair_sh='#13606a', hair_hi='#6fe0e6', iris=('#08303a', '#18a0b8', '#a0f4ff'),
         outfit='techwear', pal={'tie': '#3cf2d8'}),
    Char(id='hana', name='Hana', age=23,
         desc=N('Barista risueña con una flor en el pelo', 'Cheerful barista with a flower in her hair', 'Весёлая бариста с цветком в волосах', 'Весела бариста з квіткою у волоссі', '头戴小花的开朗咖啡师'),
         hair_style='wavy', bangs='swept', acc=['flower'],
         hair='#a0482a', hair_sh='#6e2c18', hair_hi='#e0845a', iris=('#3a2008', '#8a5a20', '#e8c070'),
         outfit='apron', cheek='#ff9a8a'),
    Char(id='elara', name='Elara', age=28,
         desc=N('Maga elfa con capa y tiara', 'Elf mage with a cloak and tiara', 'Эльфийка-волшебница в плаще', 'Ельфійка-чарівниця в плащі', '披斗篷戴头冠的精灵法师'),
         hair_style='hime_long', bangs='split', ears='elf', acc=['tiara'],
         hair='#f2d68a', hair_sh='#c8a050', hair_hi='#fff4c8', iris=('#0a3a2a', '#20a070', '#a0f0c8'),
         outfit='mage', lash='#5a3a20', pal={'brow': '#b08a40'}),
    Char(id='rin', name='Rin', age=22,
         desc=N('Streamer con chaqueta corta y gargantilla', 'Streamer in a cropped jacket and choker', 'Стримерша в короткой куртке', 'Стримерка в короткій куртці', '穿短夹克戴颈链的主播'),
         hair_style='bob', bangs='blunt', acc=['earrings', 'choker', 'hairpin'],
         hair='#c89ae8', hair_sh='#8a62b0', hair_hi='#f0d8ff', iris=('#3a1a5a', '#9a5ae0', '#ffb0f0'),
         outfit='jacket_crop', pal={'brow': '#7a52a0'}),
    # ---- +18 (insinuantes)
    Char(id='lilith', name='Lilith', age=29, adult=True,
         desc=N('Súcubo con cuernos, alas y mono escotado', 'Succubus with horns, wings and a plunging bodysuit', 'Суккуб с рогами и крыльями', 'Сукуб з рогами та крилами', '有角有翼的魅魔'),
         hair_style='wavy', bangs='split', acc=['horns', 'wings', 'choker', 'choker_ring', 'earrings'],
         hair='#7a1830', hair_sh='#4a0c1e', hair_hi='#b04060', iris=('#4a0a1a', '#c42050', '#ff9ab0'),
         outfit='bodysuit', wing=True, eyeshadow='#b02a60', lips='#c0284a', lips_dark='#7a1028', mole=True),
    Char(id='vera', name='Vera', age=27, adult=True,
         desc=N('Crupier de casino con traje de conejita', 'Casino dealer in a bunny suit', 'Крупье казино в костюме зайчика', 'Круп\'є казино в костюмі зайчика', '穿兔女郎装的赌场荷官'),
         hair_style='hime_long', bangs='blunt', acc=['bunny_ears', 'earrings', 'bowtie'],
         hair='#e9e4f2', hair_sh='#b8aed0', hair_hi='#ffffff', iris=('#3a0a2a', '#a0306a', '#f0a0c8'),
         outfit='bunny', wing=True, eyeshadow='#8a3a7a', lips='#b8305a', lips_dark='#7a1a3a', pal={'brow': '#9a90b0'}),
    Char(id='selene', name='Selene', age=31, adult=True,
         desc=N('Condesa vampira con vestido de encaje', 'Vampire countess in a lace gown', 'Графиня-вампир в кружевном платье', 'Графиня-вампірка в мереживній сукні', '身着蕾丝长裙的吸血鬼伯爵夫人'),
         hair_style='hime_long', bangs='blunt', acc=['tiara', 'choker', 'earrings'],
         hair='#17131c', hair_sh='#0a080e', hair_hi='#4a4060', iris=('#3a0008', '#c8102a', '#ff7080'),
         outfit='gown', skin='#fbeef0', skin_sh='#e8cdd6', skin_sh2='#d4aab8', wing=True, eyeshadow='#5a1030', lips='#9a1030', lips_dark='#5a0818',
         pal={'gold': '#c0c4d8', 'gem': '#c8102a'}),
    Char(id='marina', name='Marina', age=26, adult=True,
         desc=N('Socorrista en bikini con gafas de sol', 'Lifeguard in a bikini with sunglasses', 'Спасательница в бикини', 'Рятувальниця в бікіні', '戴墨镜穿比基尼的救生员'),
         hair_style='wavy', bangs='side', acc=['sunglasses', 'flower', 'earrings'],
         hair='#d8a860', hair_sh='#a87830', hair_hi='#ffe0a0', iris=('#08304a', '#1880c0', '#90e0ff'),
         outfit='bikini', skin='#f2c9a6', skin_sh='#dca784', skin_sh2='#c48a68', cheek='#ff8a7a', lips='#d0566a',
         pal={'brow': '#8a6030', 'flower': '#ff6f8f'}),
    Char(id='nyx', name='Nyx', age=28, adult=True,
         desc=N('Ladrona felina con mono ajustado', 'Cat burglar in a skin-tight catsuit', 'Кошка-воровка в облегающем комбинезоне', 'Кішка-злодійка в облиплому комбінезоні', '身穿紧身衣的猫女怪盗'),
         hair_style='bob', bangs='side', acc=['cat_ears', 'choker', 'choker_ring', 'earrings'],
         hair='#2e2440', hair_sh='#1c1628', hair_hi='#5a4a78', iris=('#4a3a00', '#d8b020', '#fff080'),
         outfit='catsuit', wing=True, eyeshadow='#4a2a6a', lips='#8a2a5a', lips_dark='#5a1238', pal={'ear_in': '#b080c0'}),
    Char(id='ivy', name='Ivy', age=30, adult=True,
         desc=N('Vestido lencero de satén para las noches', 'Satin slip dress for late nights', 'Атласное платье-комбинация', 'Атласна сукня-комбінація', '深夜的缎面吊带裙'),
         hair_style='wavy', bangs='split', acc=['earrings', 'necklace'],
         hair='#e8a0c0', hair_sh='#b86890', hair_hi='#ffd6e8', iris=('#3a1030', '#b04880', '#ffb0d8'),
         outfit='slip', wing=True, eyeshadow='#c0608a', lips='#c8406a', lips_dark='#8a1a40', mole=True, pal={'brow': '#a05a7a', 'gem': '#ff6f9a'}),
]


def manifest(c, files):
    return {
        'id': f'mk-{c.id}',
        'name': c.name,
        'names': {k: c.name for k in ('es', 'en', 'ru', 'uk', 'zh')},
        'width': W,
        'height': H,
        'files': {'base': 'base.svg', 'eyesClosed': 'eyes_closed.svg', 'mouthHalf': 'mouth_half.svg', 'mouthOpen': 'mouth_open.svg'},
        'emotions': {name: f'emo_{name}.svg' for name in FACES},
        'rig': {
            'eyes': [{'x': EYE_L[0], 'y': EYE_Y, 'w': EYE_W + 20, 'h': EYE_H + 16}, {'x': EYE_R[0], 'y': EYE_Y, 'w': EYE_W + 20, 'h': EYE_H + 16}],
            'mouth': {'x': MOUTH[0], 'y': MOUTH[1], 'w': 40},
            'neck': {'x': CX, 'y': 492},
            'cheeks': [{'x': CX - 92, 'y': 378}, {'x': CX + 92, 'y': 378}],
        },
        'market': {'adult': c.adult, 'age': c.age, 'author': 'Waifu Desk', 'license': 'mit', 'desc': c.desc, 'tags': c.tags},
    }


def thumb(c, svg_path, out_jpg):
    """Miniatura 280×350 para la galería: busto sobre el mismo fondo morado que las demás."""
    import subprocess
    import tempfile
    from PIL import Image
    with tempfile.TemporaryDirectory() as tmp:
        png = os.path.join(tmp, 't.png')
        subprocess.run(['rsvg-convert', '-w', '560', svg_path, '-o', png], check=True)
        im = Image.open(png).convert('RGBA').crop((90, 30, 470, 505)).resize((280, 350), Image.LANCZOS)
    bg = Image.new('RGBA', (280, 350))
    px = bg.load()
    for y in range(350):
        for x in range(280):
            k = y / 349
            d = abs(x - 140) / 140
            r = int(24 + 14 * k + 17 * d * (1 - k))
            g = int(19 + 0 * k + 16 * d * (1 - k))
            b = int(49 + 10 * k + 34 * d * (1 - k))
            px[x, y] = (r, g, b, 255)
    bg.alpha_composite(im)
    bg.convert('RGB').save(out_jpg, quality=88)


def write_char(c, out_dir, thumbs_dir=None):
    d = os.path.join(out_dir, c.id)
    os.makedirs(d, exist_ok=True)
    files = layers(c)
    for name, content in files.items():
        with open(os.path.join(d, name), 'w') as fh:
            fh.write(content)
    with open(os.path.join(d, 'skin.json'), 'w') as fh:
        json.dump(manifest(c, files), fh, indent=2, ensure_ascii=False)
    if thumbs_dir:
        thumb(c, os.path.join(d, 'base.svg'), os.path.join(thumbs_dir, f'mk-{c.id}.jpg'))
    return d


def main():
    args = sys.argv[1:]
    out_dir = args[0] if args and not args[0].isidentifier() else os.path.join(ROOT, 'assets', 'market')
    only = [a for a in args if a.isidentifier()]
    thumbs = os.path.join(ROOT, 'assets', 'gallery') if out_dir == os.path.join(ROOT, 'assets', 'market') else out_dir
    os.makedirs(out_dir, exist_ok=True)
    index = []
    for c in CHARS:
        if only and c.id not in only:
            continue
        write_char(c, out_dir, thumbs)
        index.append({'id': f'mk-{c.id}', 'dir': c.id, 'name': c.name, 'adult': c.adult, 'age': c.age, 'desc': c.desc, 'outfit': c.outfit})
        print('ok', c.id)
    if not only:
        with open(os.path.join(out_dir, 'market.json'), 'w') as fh:
            json.dump({'version': 1, 'skins': index}, fh, indent=2, ensure_ascii=False)


if __name__ == '__main__':
    main()
