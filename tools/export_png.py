"""Exports brand SVGs to PNG with headless Chromium. Run: python3 tools/export_png.py"""
import os, re
from playwright.sync_api import sync_playwright
B = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'app', 'brand')
jobs = [('app-icon.svg', 'icon-192.png', 192), ('app-icon.svg', 'icon-512.png', 512), ('app-icon-maskable.svg', 'icon-maskable-512.png', 512),
        ('app-icon.svg', 'apple-touch-icon.png', 180), ('mark.svg', 'mark.png', 1024), ('lockup.svg', 'lockup.png', 1600),
        ('lockup-stacked.svg', 'lockup-stacked.png', 1200), ('wordmark.svg', 'wordmark.png', 1600)]
with sync_playwright() as p:
    br = p.chromium.launch()
    for src, out, w in jobs:
        svg = open(os.path.join(B, src)).read()
        vw, vh = map(float, re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', svg).groups())
        h = round(w * vh / vw)
        pg = br.new_page(viewport={'width': w, 'height': h})
        pg.set_content(f'<html><body style="margin:0;background:transparent"><img src="file://{os.path.abspath(os.path.join(B, src))}" style="width:{w}px;height:{h}px;display:block"></body></html>')
        pg.wait_for_timeout(150)
        pg.screenshot(path=os.path.join(B, out), omit_background=True)
        pg.close(); print(out, w, h)
    br.close()
