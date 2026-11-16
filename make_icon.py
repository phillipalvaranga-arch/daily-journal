#!/usr/bin/env python3
"""Draw a notebook-with-green-checkmark icon in all required sizes."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent
ICONS = ROOT / "icons"
ICONS.mkdir(exist_ok=True)


def lerp(a, b, t):
    return int(a + (b - a) * t)


def bg_gradient(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    px = img.load()
    for y in range(size):
        t = y / max(size - 1, 1)
        r = lerp(24, 18, t)
        g = lerp(82, 58, t)
        b = lerp(58, 42, t)
        for x in range(size):
            # slight radial light in the upper center
            cx, cy = size * 0.5, size * 0.38
            d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5 / size
            k = max(0.0, 1.0 - d * 1.35)
            px[x, y] = (
                min(255, r + int(18 * k)),
                min(255, g + int(28 * k)),
                min(255, b + int(16 * k)),
                255,
            )
    return img


def rounded_rect(draw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def draw_shadow(base, box, radius, blur, alpha=70, offset=(0, 0)):
    """Return a new image with a soft shadow under a rounded rect, composited."""
    size = base.size[0]
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    ox, oy = offset
    x0, y0, x1, y1 = box
    d.rounded_rectangle((x0 + ox, y0 + oy, x1 + ox, y1 + oy), radius=radius, fill=(0, 0, 0, alpha))
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    return Image.alpha_composite(base, layer)


def draw_check(draw, cx, cy, size, color, width):
    """Draw a bold check mark centered at cx, cy."""
    # Three points of a check, relative
    w = size
    p1 = (cx - 0.38 * w, cy + 0.02 * w)
    p2 = (cx - 0.10 * w, cy + 0.32 * w)
    p3 = (cx + 0.42 * w, cy - 0.30 * w)
    draw.line([p1, p2, p3], fill=color, width=max(2, int(width)), joint="curve")
    # caps
    r = max(1, int(width * 0.52))
    for p in (p1, p2, p3):
        draw.ellipse((p[0] - r, p[1] - r, p[0] + r, p[1] + r), fill=color)


def render(size, maskable=False):
    img = bg_gradient(size)
    # For very small sizes, simplify
    s = size
    # Notebook geometry — stays inside the maskable safe zone (center 80%)
    # Safe inset ~10% each side; use ~14% to be comfortable.
    inset = int(s * (0.16 if maskable else 0.14))
    # Notebook is portrait in the upper-leftish center
    nb_w = int(s * 0.50)
    nb_h = int(s * 0.62)
    nb_x = (s - nb_w) // 2 - int(s * 0.04)
    nb_y = (s - nb_h) // 2 - int(s * 0.02)
    radius = max(6, int(s * 0.055))

    # Page peeking behind
    img = draw_shadow(img, (nb_x, nb_y, nb_x + nb_w, nb_y + nb_h), radius, blur=max(2, s // 40), alpha=90, offset=(0, int(s * 0.018)))
    d = ImageDraw.Draw(img)
    peek = int(s * 0.028)
    rounded_rect(
        d,
        (nb_x + peek * 2, nb_y - peek // 2, nb_x + nb_w + peek, nb_y + nb_h - peek),
        radius,
        fill=(236, 229, 214, 255),
    )

    # Main page
    cream = (252, 247, 236, 255)
    rounded_rect(d, (nb_x, nb_y, nb_x + nb_w, nb_y + nb_h), radius, fill=cream)

    # Spine / binding strip
    spine_w = max(3, int(nb_w * 0.11))
    # clip to rounded left — draw a darker rounded rect then cover right
    spine_col = (46, 110, 79, 255)
    d.rounded_rectangle((nb_x, nb_y, nb_x + spine_w * 2, nb_y + nb_h), radius=radius, fill=spine_col)
    d.rectangle((nb_x + spine_w, nb_y, nb_x + spine_w * 2 + 2, nb_y + nb_h), fill=cream)

    # Binding rings or holes
    ring_n = 5
    for i in range(ring_n):
        cy = nb_y + int(nb_h * (0.16 + i * 0.16))
        cx = nb_x + spine_w // 2
        rr = max(2, int(s * 0.016))
        d.ellipse((cx - rr, cy - rr, cx + rr, cy + rr), fill=(232, 224, 204, 255))
        d.ellipse((cx - rr // 2, cy - rr // 2, cx + rr // 2, cy + rr // 2), fill=(30, 70, 52, 255))

    # Ruled lines
    if s >= 64:
        line_col = (210, 198, 176, 255)
        margin_x = nb_x + spine_w + int(nb_w * 0.10)
        right = nb_x + nb_w - int(nb_w * 0.10)
        top = nb_y + int(nb_h * 0.22)
        gap = int(nb_h * 0.11)
        lw = max(1, s // 180)
        for i in range(5):
            y = top + i * gap
            if y < nb_y + nb_h - int(nb_h * 0.10):
                d.line((margin_x, y, right, y), fill=line_col, width=lw)
        # vertical margin line
        mx = nb_x + spine_w + int(nb_w * 0.06)
        d.line((mx, nb_y + int(nb_h * 0.12), mx, nb_y + nb_h - int(nb_h * 0.08)), fill=(214, 120, 110, 220), width=max(1, s // 160))

    # Big green check badge, overlapping bottom-right of the notebook
    badge_r = int(s * 0.22)
    bx = nb_x + nb_w + int(s * 0.01)
    by = nb_y + nb_h - int(s * 0.02)
    # keep badge inside canvas and safe zone
    bx = min(bx, s - badge_r - int(s * 0.07))
    by = min(by, s - badge_r - int(s * 0.07))
    bx = max(bx, badge_r + int(s * 0.07))
    by = max(by, badge_r + int(s * 0.07))

    # Badge shadow
    shadow = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    off = int(s * 0.012)
    sd.ellipse((bx - badge_r + off, by - badge_r + off, bx + badge_r + off, by + badge_r + off), fill=(0, 0, 0, 110))
    shadow = shadow.filter(ImageFilter.GaussianBlur(max(1, s // 50)))
    img = Image.alpha_composite(img, shadow)
    d = ImageDraw.Draw(img)

    # Badge circle
    green = (31, 166, 90, 255)
    green_dark = (20, 122, 66, 255)
    # subtle ring
    d.ellipse((bx - badge_r, by - badge_r, bx + badge_r, by + badge_r), fill=green_dark)
    inner = badge_r - max(2, int(s * 0.012))
    d.ellipse((bx - inner, by - inner, bx + inner, by + inner), fill=green)
    # highlight
    if s >= 64:
        hr = int(badge_r * 0.7)
        hi = Image.new("RGBA", (s, s), (0, 0, 0, 0))
        hd = ImageDraw.Draw(hi)
        hd.ellipse((bx - hr, by - badge_r + int(s * 0.01), bx + hr, by - int(badge_r * 0.15)), fill=(255, 255, 255, 50))
        hi = hi.filter(ImageFilter.GaussianBlur(max(1, s // 80)))
        img = Image.alpha_composite(img, hi)
        d = ImageDraw.Draw(img)

    draw_check(d, bx, by + int(s * 0.01), int(badge_r * 1.55), (255, 255, 255, 255), width=max(3, int(s * 0.055)))

    return img


def save_png(img, path, size=None):
    if size and img.size[0] != size:
        img = img.resize((size, size), Image.Resampling.LANCZOS)
    img.save(path, "PNG")
    print(f"wrote {path} {img.size}")


def main():
    master = render(1024, maskable=False)
    maskable = render(1024, maskable=True)

    save_png(master.resize((512, 512), Image.Resampling.LANCZOS), ICONS / "icon-512.png")
    save_png(master.resize((192, 192), Image.Resampling.LANCZOS), ICONS / "icon-192.png")
    save_png(master.resize((180, 180), Image.Resampling.LANCZOS), ICONS / "apple-touch-icon.png")
    save_png(master.resize((32, 32), Image.Resampling.LANCZOS), ICONS / "favicon.png")
    save_png(maskable.resize((512, 512), Image.Resampling.LANCZOS), ICONS / "maskable-512.png")

    # also copy 512 to root as some prior apps did
    save_png(master.resize((512, 512), Image.Resampling.LANCZOS), ROOT / "icon-512.png")

    # Multi-size ICO
    ico_sizes = [16, 24, 32, 48, 64, 128, 256]
    ico_images = [master.resize((n, n), Image.Resampling.LANCZOS) for n in ico_sizes]
    ico_path = ROOT / "icon.ico"
    ico_images[0].save(
        ico_path,
        format="ICO",
        sizes=[(n, n) for n in ico_sizes],
        append_images=ico_images[1:],
    )
    # Pillow's ICO save uses the 'sizes' argument from the first image
    master.save(ico_path, format="ICO", sizes=[(n, n) for n in ico_sizes])
    (ICONS / "icon.ico").write_bytes(ico_path.read_bytes())
    print(f"wrote {ico_path} sizes={ico_sizes} bytes={ico_path.stat().st_size}")

    # Simple SVG source for reference
    svg = '''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="My Daily Journal">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#18523a"/>
      <stop offset="1" stop-color="#123a2a"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#bg)"/>
  <rect x="196" y="86" width="210" height="290" rx="28" fill="#ece5d6"/>
  <rect x="116" y="96" width="256" height="318" rx="28" fill="#fcf7ec"/>
  <rect x="116" y="96" width="36" height="318" rx="18" fill="#2e6e4f"/>
  <rect x="134" y="96" width="18" height="318" fill="#fcf7ec"/>
  <g fill="none" stroke="#d2c6b0" stroke-width="4">
    <path d="M176 180h160M176 214h160M176 248h160M176 282h160M176 316h160"/>
  </g>
  <path d="M168 140v250" stroke="#d6786e" stroke-width="3" fill="none"/>
  <circle cx="352" cy="352" r="108" fill="#147a42"/>
  <circle cx="352" cy="352" r="98" fill="#1fa65a"/>
  <path d="M300 356l36 42 76-86" fill="none" stroke="#fff" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
'''
    (ICONS / "icon.svg").write_text(svg)
    print("wrote icons/icon.svg")


if __name__ == "__main__":
    main()
