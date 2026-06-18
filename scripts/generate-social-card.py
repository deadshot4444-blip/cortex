#!/usr/bin/env python3
"""Generate Cortex social preview card (1200x630)."""
from __future__ import annotations

import math
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "social-card.png"
VIDEO = ROOT / "assets" / "neuro-bg.mp4"
FRAME = ROOT / "scripts" / ".og-frame.jpg"

W, H = 1200, 630
BG = (17, 17, 19)
WHITE = (255, 255, 255)
GREEN = (26, 127, 55)
MUTED = (150, 150, 158)
LINE = (48, 48, 54)


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        "/System/Library/Fonts/SFNS.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/Library/Fonts/Arial.ttf",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def extract_frame() -> Image.Image | None:
    if not VIDEO.exists():
        return None
    try:
        subprocess.run(
            [
                "ffmpeg", "-y", "-ss", "2.5", "-i", str(VIDEO),
                "-vframes", "1", "-q:v", "2", str(FRAME),
            ],
            check=True,
            capture_output=True,
        )
        return Image.open(FRAME).convert("RGB")
    except (subprocess.CalledProcessError, OSError):
        return None


def cover_crop(img: Image.Image, tw: int, th: int) -> Image.Image:
    sw, sh = img.size
    scale = max(tw / sw, th / sh)
    nw, nh = int(sw * scale), int(sh * scale)
    img = img.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - tw) // 2
    top = (nh - th) // 2
    return img.crop((left, top, left + tw, top + th))


def draw_corners(draw: ImageDraw.ImageDraw) -> None:
    inset, arm = 36, 52
    c = (90, 90, 96)
    pts = [
        ((inset, inset + arm), (inset, inset), (inset + arm, inset)),
        ((W - inset - arm, inset), (W - inset, inset), (W - inset, inset + arm)),
        ((inset, H - inset - arm), (inset, H - inset), (inset + arm, H - inset)),
        ((W - inset - arm, H - inset), (W - inset, H - inset), (W - inset, H - inset - arm)),
    ]
    for a, b, cpt in pts:
        draw.line([a, b], fill=c, width=2)
        draw.line([b, cpt], fill=c, width=2)


def draw_mark(draw: ImageDraw.ImageDraw, x: int, y: int, size: int = 44) -> None:
    draw.rectangle((x, y, x + size, y + size), fill=WHITE)
    cx, cy = x + size // 2, y + size // 2
    t = max(4, size // 9)
    draw.rectangle((cx - t, y + size // 5, cx + t, y + size - size // 5), fill=BG)
    draw.rectangle((x + size // 5, cy - t, x + size - size // 5, cy + t), fill=BG)


def draw_network(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int]) -> None:
    x0, y0, x1, y1 = box
    nodes = [
        (0.72, 0.28), (0.86, 0.22), (0.92, 0.42), (0.78, 0.52),
        (0.88, 0.62), (0.74, 0.72), (0.58, 0.58), (0.64, 0.38),
        (0.52, 0.30), (0.48, 0.50), (0.56, 0.68),
    ]
    pts = [(int(x0 + (x1 - x0) * nx), int(y0 + (y1 - y0) * ny)) for nx, ny in nodes]
    edges = [
        (0, 1), (1, 2), (2, 3), (3, 4), (4, 5), (5, 6), (6, 7), (7, 8),
        (8, 9), (9, 10), (10, 5), (3, 9), (7, 3), (0, 8), (1, 7), (2, 4),
    ]
    for a, b in edges:
        draw.line([pts[a], pts[b]], fill=(55, 55, 62), width=2)
    for i, p in enumerate(pts):
        r = 9 if i in (1, 4, 9) else 7
        color = GREEN if i == 4 else (210, 210, 215)
        draw.ellipse((p[0] - r, p[1] - r, p[0] + r, p[1] + r), fill=color)


def gradient_overlay(base: Image.Image, strength: float = 0.72) -> Image.Image:
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for x in range(W):
        t = x / W
        fade = 0.35 + 0.65 * max(0.0, (1 + math.cos(t * math.pi)) / 2)
        alpha = int(255 * strength * fade)
        draw.line([(x, 0), (x, H)], fill=(8, 8, 10, min(255, alpha)))
    return Image.alpha_composite(base.convert("RGBA"), overlay).convert("RGB")


def main() -> int:
    frame = extract_frame()
    if frame:
        bg = cover_crop(frame, W, H)
        img = gradient_overlay(bg, 0.78)
    else:
        img = Image.new("RGB", (W, H), BG)

    draw = ImageDraw.Draw(img)
    draw_corners(draw)

    font_brand = load_font(22, bold=True)
    font_head = load_font(64, bold=True)
    font_sub = load_font(26)
    font_stat = load_font(18)
    font_url = load_font(20)

    draw_mark(draw, 56, 52)
    draw.text((112, 58), "CORTEX MEDICAL ACADEMY", font=font_brand, fill=WHITE)

    pill = "FREE FOREVER"
    px = W - 56
    bbox = draw.textbbox((0, 0), pill, font=font_stat)
    pw, ph = bbox[2] - bbox[0] + 28, bbox[3] - bbox[1] + 16
    draw.rectangle((px - pw, 52, px, 52 + ph), outline=GREEN, width=2)
    draw.text((px - pw + 14, 60), pill, font=font_stat, fill=GREEN)

    draw.text((56, 200), "Master the", font=font_head, fill=WHITE)
    draw.text((56, 272), "human machine.", font=font_head, fill=WHITE)

    sub = "Free MCAT prep, clinical scenarios & neuroengineering — built on first principles."
    draw.text((58, 380), sub, font=font_sub, fill=MUTED)

    draw.line([(56, 500), (W - 56, 500)], fill=LINE, width=1)
    draw.text((56, 528), "2,599+ CASES  ·  26 SPECIALTIES  ·  MCAT FREE FOREVER", font=font_stat, fill=MUTED)
    draw.text((W - 56, 528), "cortexmedical.academy", font=font_url, fill=WHITE, anchor="ra")

    draw_network(draw, (int(W * 0.46), 120, W - 40, H - 120))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT, "PNG", optimize=True)
    og_jpg = ROOT / "og.jpg"
    og = img.convert("RGB").resize((1200, 600), Image.Resampling.LANCZOS)
    og.save(og_jpg, "JPEG", quality=90, optimize=True, progressive=False)
    print(f"Wrote {OUT} ({OUT.stat().st_size} bytes)")
    print(f"Wrote {og_jpg} ({og_jpg.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())