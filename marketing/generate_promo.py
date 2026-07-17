"""
Generates Chrome Web Store promotional images: a required 440x280 "small
promo tile" and an optional 1400x560 "marquee promo tile", for both Slate
Focus and Slate Stack.

Per Chrome's own guidance (developer.chrome.com/docs/webstore/images):
these should NOT be screenshots -- they should communicate brand via
color/graphics, avoid text, fill the entire frame (no white/light-gray
margins), and use saturated colors. So each one reuses the real icon
artwork/palette from icons/generate_icons.py, scaled into a full-bleed
rectangular composition rather than a rounded icon tile.
"""
from PIL import Image, ImageDraw
import math

SS = 4  # supersample factor for smooth edges

# ---------- Slate Focus ----------
FOCUS_CHARCOAL = (92, 96, 103, 255)
FOCUS_AMBER = (224, 169, 74, 255)


def make_focus_promo(w, h):
    """Recreates the extension's own ruler band and its 'edge softness'
    slider as a single image: the band spans the full width at a fixed
    height (same shape everywhere), but the fade at its top/bottom edges
    is wide and soft on the left (as if edge softness is maxed out) and
    tapers down to a hard, zero-softness cutoff by the right edge -- the
    same linear-gradient math the real overlay uses
    (`color 0% ... transparent 100%`), just swept across x instead of
    being one fixed value."""
    S = SS
    W, H = w * S, h * S
    img = Image.new("RGB", (W, H), FOCUS_CHARCOAL[:3])

    band_half = H * 0.30
    band_top = round(H * 0.5 - band_half)
    band_bottom = round(H * 0.5 + band_half)
    max_softness = band_half * 0.95  # near-total fade at x=0
    min_softness = 0.0               # hard edge at x=W

    px = img.load()
    for x in range(W):
        frac_x = x / W
        softness = max_softness + (min_softness - max_softness) * frac_x
        for y in range(band_top, band_bottom):
            dist_from_top = y - band_top
            dist_from_bottom = band_bottom - y
            edge_dist = min(dist_from_top, dist_from_bottom)
            if softness <= 0 or edge_dist >= softness:
                alpha = 1.0
            else:
                alpha = edge_dist / softness
            if alpha <= 0:
                continue
            r = round(FOCUS_CHARCOAL[0] + (FOCUS_AMBER[0] - FOCUS_CHARCOAL[0]) * alpha)
            g = round(FOCUS_CHARCOAL[1] + (FOCUS_AMBER[1] - FOCUS_CHARCOAL[1]) * alpha)
            b = round(FOCUS_CHARCOAL[2] + (FOCUS_AMBER[2] - FOCUS_CHARCOAL[2]) * alpha)
            px[x, y] = (r, g, b)

    return img.resize((w, h), Image.LANCZOS)


# ---------- Slate Stack ----------
FRONT = (58, 61, 66, 255)
MID = (90, 110, 96, 255)
SAGE = (140, 173, 146, 255)
GREEN = (127, 174, 134, 255)
GREEN_DIM = (127, 174, 134, 160)


def rounded_tile(size_px, radius_px, color):
    layer = Image.new("RGBA", (size_px, size_px), (0, 0, 0, 0))
    ImageDraw.Draw(layer).rounded_rectangle([0, 0, size_px - 1, size_px - 1], radius=radius_px, fill=color)
    return layer


def stack_graphic(tile):
    step = round(0.09 * tile)
    pad = step * 2
    radius = round(0.2 * tile)
    canvas_size = tile + pad * 2
    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))

    canvas.alpha_composite(rounded_tile(tile, radius, SAGE), (pad + 2 * step, pad + 2 * step))
    canvas.alpha_composite(rounded_tile(tile, radius, MID), (pad + step, pad + step))

    front = rounded_tile(tile, radius, FRONT)
    fd = ImageDraw.Draw(front)
    lx = round(0.22 * tile)
    lr = round(0.04 * tile)
    fd.rounded_rectangle(
        [lx, round(0.38 * tile), lx + round(0.56 * tile), round(0.38 * tile) + round(0.08 * tile)],
        radius=lr, fill=GREEN,
    )
    fd.rounded_rectangle(
        [lx, round(0.54 * tile), lx + round(0.40 * tile), round(0.54 * tile) + round(0.08 * tile)],
        radius=lr, fill=GREEN_DIM,
    )
    canvas.alpha_composite(front, (pad, pad))
    return canvas


def make_stack_promo(w, h):
    S = SS
    W, H = w * S, h * S
    BG = (32, 34, 38)  # distinctly darker than FRONT so the front tile doesn't vanish into the background
    img = Image.new("RGBA", (W, H), BG + (255,))

    tile_size = round(H * 0.62)
    graphic = stack_graphic(tile_size)
    graphic = graphic.resize((round(graphic.width), round(graphic.height)), Image.LANCZOS)

    x = (W - graphic.width) // 2
    y = (H - graphic.height) // 2
    img.alpha_composite(graphic, (x, y))

    return img.convert("RGB").resize((w, h), Image.LANCZOS)


SIZES = {"small": (440, 280), "marquee": (1400, 560)}

import os
OUT_FOCUS = "/tmp/promo_build/readrail-focus"
OUT_STACK = "/tmp/promo_build/read-later"
os.makedirs(OUT_FOCUS, exist_ok=True)
os.makedirs(OUT_STACK, exist_ok=True)

for name, (w, h) in SIZES.items():
    im = make_focus_promo(w, h)
    path = f"{OUT_FOCUS}/slate-focus-promo-{name}-{w}x{h}.png"
    im.save(path, "PNG")
    print("saved", path, im.size, im.mode)

for name, (w, h) in SIZES.items():
    im = make_stack_promo(w, h)
    path = f"{OUT_STACK}/slate-stack-promo-{name}-{w}x{h}.png"
    im.save(path, "PNG")
    print("saved", path, im.size, im.mode)
