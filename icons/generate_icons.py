"""
Regenerates icon16/32/48/128.png for Slate Stack.

Concept: overlapping rounded "slate tiles" -- a literal picture of a stack
you work through. The front tile is always charcoal; the back-most tile is
always sage green (the one consistent accent across every size, since
subtle gray-on-gray gradients disappear at small sizes but a color contrast
survives even at 16px). Run with: python3 generate_icons.py
Requires Pillow (pip install pillow).
"""

from PIL import Image, ImageDraw

FRONT = (58, 61, 66, 255)    # charcoal, always the top/front tile
MID = (90, 110, 96, 255)     # transitional muted green-gray, 128/48/32 only
SAGE = (140, 173, 146, 255)  # back-most tile, present at every size
GREEN = (127, 174, 134, 255)
GREEN_DIM = (127, 174, 134, 160)
SS = 8


def rounded_tile(size_px, radius_px, color):
    layer = Image.new("RGBA", (size_px, size_px), (0, 0, 0, 0))
    ImageDraw.Draw(layer).rounded_rectangle([0, 0, size_px - 1, size_px - 1], radius=radius_px, fill=color)
    return layer


def make_stack_icon_3tile(size):
    """Used for 32/48/128 -- three tiles, with 'text line' accents on the
    front tile at every one of these sizes (they scale with tile size, so
    they hold up down to 32px; only the 16px 2-tile version drops them)."""
    S = size * SS
    canvas = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    tile = round(0.781 * S)
    step = round(0.0703 * S)
    pad = round(0.0391 * S)
    radius = round(0.2 * tile)

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
    return canvas.resize((size, size), Image.LANCZOS)


def make_stack_icon_2tile(size=16):
    """Used only at 16px -- three tiles turn to mush at this size, so it
    simplifies to two. Still carries the same green-line accent as every
    other size (rendered at 8x supersample so it survives the downscale
    as a crisp thin mark rather than disappearing)."""
    S = size * SS
    canvas = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    tile = round(0.78 * S)
    step = round(0.22 * S)
    radius = round(0.22 * tile)

    canvas.alpha_composite(rounded_tile(tile, radius, SAGE), (step, step))

    front = rounded_tile(tile, radius, FRONT)
    fd = ImageDraw.Draw(front)
    lx = round(0.22 * tile)
    lr = round(0.04 * tile)
    fd.rounded_rectangle(
        [lx, round(0.38 * tile), lx + round(0.56 * tile), round(0.38 * tile) + round(0.10 * tile)],
        radius=lr, fill=GREEN,
    )
    fd.rounded_rectangle(
        [lx, round(0.56 * tile), lx + round(0.40 * tile), round(0.56 * tile) + round(0.10 * tile)],
        radius=lr, fill=GREEN_DIM,
    )
    canvas.alpha_composite(front, (0, 0))
    return canvas.resize((size, size), Image.LANCZOS)


if __name__ == "__main__":
    for size in [32, 48, 128]:
        make_stack_icon_3tile(size).save(f"icon{size}.png")
        print(f"icon{size}.png (3-tile) regenerated")
    make_stack_icon_2tile(16).save("icon16.png")
    print("icon16.png (2-tile) regenerated")
