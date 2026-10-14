#!/usr/bin/env python3
"""Draws icons/icon{16,32,48,128}.png: a rounded tile with a stats line.
Run once after changing the design; the PNGs are committed. Needs Pillow."""
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'icons')
BG = (31, 111, 235)
FG = (255, 255, 255)
LINE = [(0.16, 0.66), (0.36, 0.44), (0.52, 0.58), (0.84, 0.26)]

os.makedirs(OUT, exist_ok=True)
for size in (16, 32, 48, 128):
    scale = 8  # draw large, downsample for smooth edges
    s = size * scale
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.22), fill=BG)
    width = max(int(s * 0.09), scale * 2)
    points = [(x * s, y * s) for x, y in LINE]
    d.line(points, fill=FG, width=width, joint='curve')
    r = width * 0.9
    x, y = points[-1]
    d.ellipse([x - r, y - r, x + r, y + r], fill=FG)
    # baseline
    d.line([(0.16 * s, 0.8 * s), (0.84 * s, 0.8 * s)], fill=FG + (150,), width=max(width // 2, scale))
    img.resize((size, size), Image.LANCZOS).save(os.path.join(OUT, 'icon{}.png'.format(size)))
