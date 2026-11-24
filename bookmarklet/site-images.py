#!/usr/bin/env python3
"""Draws the website's raster pictures into site-src/: the favicons, the home-screen icons and the link-preview card.

The PNGs are committed and the build only copies them, so a release needs neither Python nor these fonts. Run this
again (python3 bookmarklet/site-images.py, needs Pillow) after changing the icon or the card's words or picture.
Nothing is fetched: the icon is drawn from its own shapes, the card uses a font installed on the machine and a
picture already in site-src/img/.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'site-src'
ORANGE, HERO, WHITE = '#ea580c', '#18181b', '#ffffff'  # site.css: --orange, --hero

# The icon is drawn from these shapes, not read from the SVG: Pillow has no SVG renderer. So a changed icon stops
# here instead of leaving the old one in the PNGs.
ICON_SVG = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 3h18a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-8l-5 4v-4H3a2 '
            '2 0 0 1-2-2V5a2 2 0 0 1 2-2z" fill="#ea580c"/><path d="M7.4 5.2L12.16 17.44L13.86 12.51L18.79 10.81Z" fill="#fff"/></svg>')
for svg in (ROOT / 'core/icons/icon.svg', SRC / 'img/icon.svg'):
    if svg.read_text().strip() != ICON_SVG:
        raise SystemExit(f'{svg} changed: draw its new shapes in icon() below, then update ICON_SVG')


def icon(size, pad=0.0, bg=None):
    """The icon on a size x size square, drawn 8x larger and scaled down for smooth edges. pad: the margin, as a share
    of the side, for icons a system crops or puts on its own tile. bg: a solid background instead of transparent."""
    big = size * 8
    im = Image.new('RGBA', (big, big), bg or (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    u = big * (1 - 2 * pad) / 24  # one unit of the icon's 24-unit viewBox
    at = lambda x, y: (big * pad + x * u, big * pad + y * u)
    d.rounded_rectangle([at(1, 3), at(23, 19)], radius=2 * u, fill=ORANGE)  # the bubble
    d.polygon([at(13, 18.9), at(8, 23), at(8, 18.9)], fill=ORANGE)  # its tail
    d.polygon([at(7.4, 5.2), at(12.16, 17.44), at(13.86, 12.51), at(18.79, 10.81)], fill=WHITE)  # the pointer
    return im.resize((size, size), Image.LANCZOS)


def font(weight, size):
    # The site's text is system-ui; on this machine that is Ubuntu Sans.
    f = ImageFont.truetype('/usr/share/fonts/truetype/ubuntu/UbuntuSans[wdth,wght].ttf', size)
    f.set_variation_by_name(weight)
    return f


def card():
    """The 1200 x 630 link preview: name, what it does, and the tool on a page. No version, so it never goes stale."""
    W, H = 1200, 630
    im = Image.new('RGB', (W, H), HERO)
    glow = Image.new('L', (W, H), 0)
    ImageDraw.Draw(glow).ellipse([560, -40, 1300, 640], fill=70)  # the hero's orange glow, behind the picture
    im.paste(Image.new('RGB', (W, H), ORANGE), mask=glow.filter(ImageFilter.GaussianBlur(120)))

    shot = Image.open(SRC / 'img/clip-share-poster.png').convert('RGB')  # pins, the round button, its key list
    sw = 610
    shot = shot.resize((sw, round(shot.height * sw / shot.width)), Image.LANCZOS)
    x, y = W - sw - 48, (H - shot.height) // 2
    shadow = Image.new('L', (W, H), 0)
    ImageDraw.Draw(shadow).rounded_rectangle([x, y + 18, x + sw, y + shot.height + 18], 18, fill=150)
    im.paste((0, 0, 0), mask=shadow.filter(ImageFilter.GaussianBlur(22)))
    mask = Image.new('L', shot.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, sw - 1, shot.height - 1], 16, fill=255)
    im.paste(shot, (x, y), mask)
    ImageDraw.Draw(im).rounded_rectangle([x - 1, y - 1, x + sw, y + shot.height], 17, outline='#3f3f46', width=2)

    d = ImageDraw.Draw(im)
    left = 64
    im.paste(icon(64), (left, 92), icon(64))
    d.text((left, 176), 'Page Comments', font=font('Bold', 58), fill='#fafafa')
    body = font('Medium', 31)
    for i, line in enumerate(['Point at anything on a', 'web page and say what', 'should change.']):
        d.text((left, 270 + i * 42), line, font=body, fill='#e4e4e7')
    d.text((left, 412), 'Hand it to Claude Code,', font=body, fill='#fdba74')
    d.text((left, 454), 'Slack, Jira or a teammate.', font=body, fill='#fdba74')
    d.text((left, 532), 'Free and open source  ·  No account', font=font('Medium', 22), fill='#a1a1aa')
    return im


def save(im, rel, **kw):
    path = SRC / rel
    im.save(path, optimize=True, **kw)
    print(f'{rel}: {im.size[0]}x{im.size[1]}, {path.stat().st_size} bytes')


# favicon.ico at the root: browsers and crawlers ask for it even on pages that name no icon.
save(icon(48), 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)], append_images=[icon(16), icon(32)])
save(icon(180, pad=0.14, bg=HERO), 'apple-touch-icon.png')  # iOS fills a transparent corner with black
save(icon(192), 'img/icon-192.png')
save(icon(512), 'img/icon-512.png')
save(card(), 'img/og.png')
