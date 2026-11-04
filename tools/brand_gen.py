"""Builds the Chore Wars logo SVGs (mark, wordmark, lockups, app icon).
Wordmark glyphs are converted to outlines from Bungee (SIL OFL) so the SVGs need no font.
Run: python3 tools/brand_gen.py  -> writes app/brand/*.svg
"""
import math, os
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'app', 'brand')
INK, GRAPE, GRAPE2, ZAP, SPLASH, RIVAL, SUDS = '#1A0E5C', '#4B23D9', '#6A3BFF', '#FFD12E', '#22D3EE', '#FF3B7F', '#F5F2FF'

font = TTFont(os.path.join(HERE, 'Bungee.ttf'))
gs = font.getGlyphSet(); cmap = font.getBestCmap(); upm = font['head'].unitsPerEm
hmtx = font['hmtx']

def text_path(txt, size, track=0.02):
    """Return (d, width, height) for txt set at `size` px, baseline at cap height."""
    s = size / upm; x = 0; parts = []
    cap = font['OS/2'].sCapHeight or 700
    for ch in txt:
        g = cmap.get(ord(ch))
        if ch == ' ':
            x += hmtx['space'][0] * s * 0.7; continue
        pen = SVGPathPen(gs)
        tp = TransformPen(pen, (s, 0, 0, -s, x, cap * s))
        gs[g].draw(tp)
        parts.append(pen.getCommands())
        x += hmtx[g][0] * s + track * size
    return ' '.join(parts), x - track * size, cap * s

def burst(cx, cy, r1, r2, n=12, rot=-90):
    pts = []
    for i in range(n * 2):
        r = r1 if i % 2 == 0 else r2
        a = math.radians(rot + i * 180 / n)
        pts.append(f'{cx + r * math.cos(a):.1f},{cy + r * math.sin(a):.1f}')
    return ' '.join(pts)

def mark_body(with_burst=True):
    b = f'<polygon points="{burst(120,122,114,90)}" fill="{ZAP}" stroke="{INK}" stroke-width="8" stroke-linejoin="round"/>' if with_burst else ''
    return '<g transform="translate(14 16) scale(.87)">' + b + f'''
<g transform="rotate(-14 120 134)" stroke="{INK}" stroke-width="8" stroke-linejoin="round" stroke-linecap="round">
  <path d="M150 92 Q176 104 166 140 Q156 132 148 112 Z" fill="{RIVAL}"/>
  <rect x="76" y="118" width="88" height="104" rx="24" fill="{SPLASH}"/>
  <rect x="92" y="134" width="14" height="60" rx="7" fill="#FFFFFF" stroke="none" opacity=".75"/>
  <path d="M132 134 L112 170 H126 L118 204 L150 160 H134 L144 134 Z" fill="{ZAP}" stroke-width="6"/>
  <rect x="94" y="100" width="52" height="24" rx="7" fill="{GRAPE}"/>
  <path d="M86 56 H170 L194 64 V86 L170 94 H92 Q84 94 84 86 V62 Q84 56 90 56 Z" fill="{RIVAL}"/>
  <path d="M100 66 H150" stroke="#FFFFFF" stroke-width="6" opacity=".7"/>
  <path d="M206 58 L226 48 M210 75 H236 M206 92 L226 102" stroke-width="8"/>
</g></g>'''

def svg(w, h, body, title):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" width="{w:.0f}" height="{h:.0f}" role="img" aria-label="{title}"><title>{title}</title>{body}</svg>\n'

def wordmark_group(txt, size, x, y, fill=ZAP, skew=-7):
    d, w, h = text_path(txt, size)
    sw = size * 0.16; ext = size * 0.09
    g = (f'<g transform="translate({x:.1f} {y:.1f}) skewX({skew})">'
         f'<path d="{d}" transform="translate(0 {ext:.1f})" fill="{INK}" stroke="{INK}" stroke-width="{sw:.1f}" stroke-linejoin="round"/>'
         f'<path d="{d}" fill="{fill}" stroke="{INK}" stroke-width="{sw:.1f}" stroke-linejoin="round" paint-order="stroke"/>'
         f'<path d="{d}" fill="{fill}"/>'
         f'</g>')
    return g, w, h + ext

os.makedirs(OUT, exist_ok=True)
# 1. Mark
open(os.path.join(OUT, 'mark.svg'), 'w').write(svg(240, 240, mark_body(), 'Chore Wars mark'))
# 2. App icon (rounded square)
icon = (f'<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{GRAPE2}"/><stop offset="1" stop-color="{GRAPE}"/></linearGradient></defs>'
        f'<rect width="240" height="240" rx="54" fill="url(#g)"/><g transform="translate(22 22) scale(.82)">{mark_body()}</g>')
open(os.path.join(OUT, 'app-icon.svg'), 'w').write(svg(240, 240, icon, 'Chore Wars app icon'))
# full-bleed maskable icon
mask = f'<rect width="240" height="240" fill="{GRAPE}"/><g transform="translate(42 42) scale(.65)">{mark_body()}</g>'
open(os.path.join(OUT, 'app-icon-maskable.svg'), 'w').write(svg(240, 240, mask, 'Chore Wars app icon'))
# 3. Wordmark, one line
size = 120; pad = size * 0.14
g, w, h = wordmark_group('CHORE WARS', size, pad + 12, pad)
W, H = w + pad * 2 + 24, h + pad * 2
open(os.path.join(OUT, 'wordmark.svg'), 'w').write(svg(W, H, g, 'Chore Wars'))
# 4. Horizontal lockup: mark + wordmark
ms = 1.15; mw = 240 * ms
g2, w2, h2 = wordmark_group('CHORE WARS', size, mw + 10, (mw - h) / 2)
LW = mw + 10 + w2 + pad * 2; LH = mw
open(os.path.join(OUT, 'lockup.svg'), 'w').write(svg(LW, LH, f'<g transform="scale({ms})">{mark_body()}</g>' + g2, 'Chore Wars'))
# 5. Stacked lockup
s1 = 150
gA, wA, hA = wordmark_group('CHORE', s1, 0, 0)
gB, wB, hB = wordmark_group('WARS', s1 * 1.28, 0, 0)
SW = max(wA, wB) + 80; mark_s = 1.6; top = 240 * mark_s
gA = gA.replace('translate(0.0 0.0)', f'translate({(SW - wA) / 2 + 10:.1f} {top + 10:.1f})')
gB = gB.replace('translate(0.0 0.0)', f'translate({(SW - wB) / 2 + 14:.1f} {top + hA + 34:.1f})')
SH = top + hA + hB + 70
st = f'<g transform="translate({(SW - 240 * mark_s) / 2:.1f} 0) scale({mark_s})">{mark_body()}</g>' + gA + gB
open(os.path.join(OUT, 'lockup-stacked.svg'), 'w').write(svg(SW, SH, st, 'Chore Wars'))
print('ok', OUT)
