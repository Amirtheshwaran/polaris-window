"""Landing-safety slope layer from LOLA LDEM_80S_80M.
Writes web/data/slope_core.bin, slope_regional.bin (uint8, 0.25 deg steps, same 256x256 grids as horizons)
and adds 'slope' (deg, 80 m baseline, 3x3 mean) to each site in sites.json.
Run: python pipeline/slope.py <raw_dir>"""
import json, os, sys
import numpy as np
from scipy.ndimage import uniform_filter

RAW = sys.argv[1] if len(sys.argv) > 1 else "/home/user/data/raw"
OUT = os.path.join(os.path.dirname(__file__), "..", "web", "data")
dem = (np.fromfile(f"{RAW}/ldem_80s_80m.img", "<i2").reshape(7600, 7600) * 0.5).astype(np.float32)
gy, gx = np.gradient(dem, 80.0)
slope = np.degrees(np.arctan(np.hypot(gx, gy))).astype(np.float32)

meta = json.load(open(f"{OUT}/meta.json"))
for name, g in meta["grids"].items():
    half, n = g["half"], g["n"]
    c = (np.arange(n) + 0.5) / n * 2 * half - half
    X, Y = np.meshgrid(c, -c)
    k = max(1, int(round(2 * half / n / 80)))  # average over the cell footprint
    sm = uniform_filter(slope, k) if k > 1 else slope
    v = sm[np.round(3799.5 - Y / 80).astype(int), np.round(3799.5 + X / 80).astype(int)]
    np.clip(np.round(v * 4), 0, 255).astype(np.uint8).tofile(f"{OUT}/slope_{name}.bin")
    print(name, "slope mean %.1f" % v.mean())
meta["slope_q"] = dict(step=0.25, baseline_m=80)
json.dump(meta, open(f"{OUT}/meta.json", "w"), indent=1)

sites = json.load(open(f"{OUT}/sites.json"))
sm3 = uniform_filter(slope, 3)
for s in sites:
    s["slope"] = round(float(sm3[int(round(3799.5 - s["y"] / 80)), int(round(3799.5 + s["x"] / 80))]), 1)
    print(s["id"], s["slope"])
json.dump(sites, open(f"{OUT}/sites.json", "w"))
