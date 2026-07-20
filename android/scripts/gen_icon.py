#!/usr/bin/env python3
"""Generate simple PNG launcher icons using only stdlib (zlib+struct)."""
import os
import struct
import zlib


def make_icon(size, out_path):
    # Solid rounded-square background with gradient stripes + white МТ letters
    # Simplified: solid navy blue background with a lighter blue rounded square
    # and white text initials rendered via a hand-plotted bitmap.
    pixels = bytearray()
    # Colors
    bg = (0x1E, 0x40, 0xAF)         # navy blue
    accent = (0x08, 0x91, 0xB2)     # cyan
    white = (0xFF, 0xFF, 0xFF)
    # Simple rounded-square background + diagonal gradient
    r = int(size * 0.18)  # corner radius
    for y in range(size):
        for x in range(size):
            # Rounded corners: transparent outside rounded rect
            in_x = r <= x < size - r
            in_y = r <= y < size - r
            if in_x or in_y:
                inside = True
            else:
                # Check corner
                cx = r if x < r else size - 1 - r
                cy = r if y < r else size - 1 - r
                dx = x - cx
                dy = y - cy
                inside = (dx * dx + dy * dy) <= r * r
            if not inside:
                pixels += bytes([0, 0, 0, 0])
                continue
            # Gradient blend
            t = (x + y) / (2 * size)
            rc = int(bg[0] * (1 - t) + accent[0] * t)
            gc = int(bg[1] * (1 - t) + accent[1] * t)
            bc = int(bg[2] * (1 - t) + accent[2] * t)
            pixels += bytes([rc, gc, bc, 255])
    _draw_letters(pixels, size, white)
    _write_png(out_path, size, size, pixels)


def _draw_letters(pixels, size, color):
    # Rasterize "MT" (Latin) centered — closest to Cyrillic МТ visually,
    # since drawing complex glyphs from stdlib is impractical.
    # Simple block letters using a 5x7 grid, scaled.
    font = {
        'M': ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
        'T': ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."]
    }
    # Compose "MT"
    glyphs = [font['M'], font['T']]
    gw, gh = 5, 7
    scale = size // 16
    if scale < 1:
        scale = 1
    text_w = (gw * 2 + 1) * scale  # 1-col gap
    text_h = gh * scale
    ox = (size - text_w) // 2
    oy = (size - text_h) // 2 + int(size * 0.02)
    for gi, glyph in enumerate(glyphs):
        for yy in range(gh):
            row = glyph[yy]
            for xx in range(gw):
                if row[xx] == '#':
                    for dy in range(scale):
                        for dx in range(scale):
                            px = ox + (gi * (gw + 1) + xx) * scale + dx
                            py = oy + yy * scale + dy
                            if 0 <= px < size and 0 <= py < size:
                                idx = (py * size + px) * 4
                                # Only draw over opaque background
                                if pixels[idx + 3] > 0:
                                    pixels[idx] = color[0]
                                    pixels[idx + 1] = color[1]
                                    pixels[idx + 2] = color[2]
                                    pixels[idx + 3] = 255


def _write_png(path, w, h, rgba):
    def chunk(t, d):
        return (struct.pack('>I', len(d)) + t + d +
                struct.pack('>I', zlib.crc32(t + d) & 0xffffffff))
    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)
    raw = bytearray()
    for y in range(h):
        raw.append(0)
        raw += rgba[y * w * 4:(y + 1) * w * 4]
    idat = zlib.compress(bytes(raw), 9)
    png = sig + chunk(b'IHDR', ihdr) + chunk(b'IDAT', idat) + chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(png)


sizes = {
    'mipmap-mdpi': 48,
    'mipmap-hdpi': 72,
    'mipmap-xhdpi': 96,
    'mipmap-xxhdpi': 144,
}
base = os.path.join(os.path.dirname(__file__), '..', 'res')
for folder, sz in sizes.items():
    d = os.path.join(base, folder)
    os.makedirs(d, exist_ok=True)
    make_icon(sz, os.path.join(d, 'ic_launcher.png'))
    print(f"Wrote {folder}/ic_launcher.png ({sz}x{sz})")
