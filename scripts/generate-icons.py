"""Builds the app icon set from the source logo (white rounded-corner background, no alpha).

Usage (from the repo root):  python3 scripts/generate-icons.py logo/bahayplusicon.png apps/web/public/icons apps/web/app
Outputs: public/icons/{icon-192,icon-512,maskable-512}.png and app/{icon.png,apple-icon.png,favicon.ico}.
"""
import sys
from PIL import Image, ImageFilter

src, out_dir, app_dir = sys.argv[1], sys.argv[2], sys.argv[3]
img = Image.open(src).convert("RGB")
W, H = img.size

def corner_mask(im, thresh=235):
    """Mask of the near-white background reachable from the four corners (flood fill)."""
    mask = Image.new("L", im.size, 0)
    px = im.load()
    seen = set()
    stack = [(0, 0), (W - 1, 0), (0, H - 1), (W - 1, H - 1)]
    m = mask.load()
    while stack:
        x, y = stack.pop()
        if (x, y) in seen or not (0 <= x < W and 0 <= y < H):
            continue
        seen.add((x, y))
        r, g, b = px[x, y]
        if min(r, g, b) < thresh:
            continue
        m[x, y] = 255
        stack.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    return mask

# Grow the background mask past the anti-aliased white/green edge so no light ring remains.
bg = corner_mask(img).filter(ImageFilter.MaxFilter(11))
# Transparent-corner version ("any" purpose icons, favicon); soften the edge by 1px.
rgba = img.convert("RGBA")
alpha = Image.eval(bg.filter(ImageFilter.GaussianBlur(1.5)), lambda v: 255 - v)
rgba.putalpha(alpha)

# Full-bleed version (maskable, Apple touch): fill each corner with the green sampled just inside it.
full = img.copy()
fp = full.load()
mp = bg.load()
inset = int(W * 0.2)
samples = {
    "tl": img.getpixel((inset, inset)), "tr": img.getpixel((W - inset, inset)),
    "bl": img.getpixel((inset, H - inset)), "br": img.getpixel((W - inset, H - inset)),
}
for y in range(H):
    for x in range(W):
        if mp[x, y]:
            key = ("t" if y < H / 2 else "b") + ("l" if x < W / 2 else "r")
            fp[x, y] = samples[key]

def save(im, size, path):
    im.resize((size, size), Image.LANCZOS).save(path, optimize=True)

save(rgba, 192, f"{out_dir}/icon-192.png")
save(rgba, 512, f"{out_dir}/icon-512.png")
save(full, 512, f"{out_dir}/maskable-512.png")
save(full, 180, f"{app_dir}/apple-icon.png")
save(rgba, 192, f"{app_dir}/icon.png")  # tab icon: keep it small for mobile data
rgba.resize((256, 256), Image.LANCZOS).save(f"{app_dir}/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
print("samples:", samples)
