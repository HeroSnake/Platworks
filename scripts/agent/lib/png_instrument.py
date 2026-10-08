"""Measures the ink bounding box inside the committed icon PNGs.

A stale or mis-framed icon reads as "looks fine" in a diff, and the failure is
silent: the launcher mask, the home screen and the maskable safe zone each clip
somewhere different. This asserts the two things that actually matter — that the
trophy is centred, and that a maskable icon keeps its ink inside the safe circle.

Run: python3 scripts/agent/lib/png_instrument.py [--json]
Exits non-zero if any icon is off-centre or a maskable icon escapes its safe zone.
"""
import json
import struct
import sys
import zlib

BG = (23, 26, 33)  # #171a21, the fill both SVGs paint edge to edge
BG_TOL = 14
ALPHA_MIN = 24

# Android crops a maskable icon to the middle ~80% of the tile (web.dev:
# "a radius equal to 40% of the icon width"). Anything outside this circle may
# be cut away by the launcher's mask.
MASKABLE_SAFE_RADIUS = 0.4

# 1px of antialiasing on the outermost edge of the ink.
CENTRE_TOL = 1.0


def decode(path):
    d = open(path, "rb").read()
    pos, idat = 8, b""
    w = h = bitd = ct = None
    while pos < len(d):
        ln = struct.unpack(">I", d[pos:pos + 4])[0]
        typ = d[pos + 4:pos + 8]
        data = d[pos + 8:pos + 8 + ln]
        pos += 12 + ln
        if typ == b"IHDR":
            w, h, bitd, ct = struct.unpack(">IIBB", data[:10])
        elif typ == b"IDAT":
            idat += data
        elif typ == b"IEND":
            break
    raw = zlib.decompress(idat)
    nch = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[ct]
    bpp = nch * (bitd // 8)
    stride = w * bpp
    out = bytearray()
    prev = bytearray(stride)
    i = 0
    for _ in range(h):
        f = raw[i]
        i += 1
        line = bytearray(raw[i:i + stride])
        i += stride
        if f == 1:
            for x in range(bpp, stride):
                line[x] = (line[x] + line[x - bpp]) & 255
        elif f == 2:
            for x in range(stride):
                line[x] = (line[x] + prev[x]) & 255
        elif f == 3:
            for x in range(stride):
                a = line[x - bpp] if x >= bpp else 0
                line[x] = (line[x] + ((a + prev[x]) >> 1)) & 255
        elif f == 4:
            for x in range(stride):
                a = line[x - bpp] if x >= bpp else 0
                c = prev[x - bpp] if x >= bpp else 0
                b = prev[x]
                pa, pb, pc = abs(b - c), abs(a - c), abs(a + b - 2 * c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[x] = (line[x] + pr) & 255
        out += line
        prev = line
    return w, h, nch, bytes(out)


def is_ink(px, nch, x, o):
    if nch >= 3:
        r, g, b = px[o], px[o + 1], px[o + 2]
        a = px[o + 3] if nch == 4 else 255
    else:
        r = g = b = px[o]
        a = px[o + 1] if nch == 2 else 255
    if a <= ALPHA_MIN:
        return False
    return not (abs(r - BG[0]) <= BG_TOL and abs(g - BG[1]) <= BG_TOL
                and abs(b - BG[2]) <= BG_TOL)


def ink_box(path):
    w, h, nch, px = decode(path)
    minx, miny, maxx, maxy = w, h, -1, -1
    for y in range(h):
        row = y * w * nch
        for x in range(w):
            if is_ink(px, nch, x, row + x * nch):
                minx, miny = min(minx, x), min(miny, y)
                maxx, maxy = max(maxx, x), max(maxy, y)
    return w, h, (minx, miny, maxx, maxy)


def farthest_from_centre(path):
    """Max distance from the canvas centre to any ink pixel."""
    w, h, nch, px = decode(path)
    cx, cy = w / 2, h / 2
    best = 0.0
    for y in range(h):
        row = y * w * nch
        for x in range(w):
            if is_ink(px, nch, x, row + x * nch):
                best = max(best, ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2) ** 0.5)
    return best


TARGETS = [
    ("static/icon-192.png", False),
    ("static/icon-512.png", False),
    ("static/icon-maskable-192.png", True),
    ("static/icon-maskable-512.png", True),
    ("static/apple-touch-icon.png", False),
]


def main():
    as_json = "--json" in sys.argv
    failures = []
    rows = []
    for path, maskable in TARGETS:
        w, h, (x0, y0, x1, y1) = ink_box(path)
        dx = (x0 + x1) / 2 - w / 2
        dy = (y0 + y1) / 2 - h / 2
        row = {"file": path, "size": "%dx%d" % (w, h),
               "ink": "%dx%d" % (x1 - x0 + 1, y1 - y0 + 1),
               "dx": round(dx, 2), "dy": round(dy, 2)}
        if abs(dx) > CENTRE_TOL or abs(dy) > CENTRE_TOL:
            row["fail"] = "off-centre"
            failures.append("%s: ink centre off by (%+.1f, %+.1f)px" % (path, dx, dy))
        if maskable:
            radius = farthest_from_centre(path)
            limit = w * MASKABLE_SAFE_RADIUS
            row["max_radius"] = round(radius, 1)
            row["safe_radius"] = round(limit, 1)
            if radius > limit:
                pct = (radius - limit) / limit * 100
                row["fail"] = "escapes safe zone"
                failures.append("%s: ink reaches %.1fpx from centre, safe zone is %.1fpx (%+.1f%% over)"
                                % (path, radius, limit, pct))
        rows.append(row)

    if as_json:
        print(json.dumps(rows, indent=2))
    else:
        print("%-34s %9s %10s %7s %7s  safe" % ("file", "size", "ink", "dx", "dy"))
        for r in rows:
            safe = ""
            if "max_radius" in r:
                safe = "  r=%.1f/%.1f" % (r["max_radius"], r["safe_radius"])
            status = "  FAIL " + r["fail"] if "fail" in r else "  ok"
            print("%-34s %9s %10s %+7.1f %+7.1f%s%s" % (
                r["file"], r["size"], r["ink"], r["dx"], r["dy"], safe, status))

    if failures:
        print()
        for f in failures:
            print("FAIL " + f)
        sys.exit(1)
    print("\nAll icons centred, all maskable ink inside the 80% safe zone.")


if __name__ == "__main__":
    main()