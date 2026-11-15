"""Validate Earth visibility (direct-to-Earth comms) against NASA PGDA AVGVISIB_75S_120M_201608_EARTH
(Mazarico et al. 2011), using the exact horizon grids the web app ships (web/data/hz_*.bin).
NASA criterion: any part of Earth's disc above the terrain (Earth angular radius ~0.95 deg).
Run: python pipeline/validate_earth.py <raw_dir>"""
import json, os, sys
import numpy as np
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
from scipy.ndimage import uniform_filter
from lunar import xy2ll, ephem, R

RAW = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), "..", "web", "data")
meta = json.load(open(f"{OUT}/meta.json"))
_, _, EARTH = ephem(RAW, "2009-07-13T18:00:00", "2013-07-18T12:00:00", 6 * 3600.0)  # km, MOON_ME
nasa = (np.fromfile(f"{RAW}/avgvisib_75s_120m_201608_earth.img", "<i2").reshape(7624, 7624) * 0.00004).astype(np.float32)
EARTH_R = np.degrees(6371.0 / 384400.0)

res = {}
for name, g in meta["grids"].items():
    half, n, naz = g["half"], g["n"], meta["naz"]
    hz = np.fromfile(f"{OUT}/hz_{name}.bin", np.uint8).reshape(n * n, naz) * meta["hz_q"]["step"] + meta["hz_q"]["offset"]
    c = (np.arange(n) + 0.5) / n * 2 * half - half
    X, Y = np.meshgrid(c, -c); X, Y = X.ravel(), Y.ravel()
    lat, lon = np.radians(np.array(xy2ll(X, Y)))
    up = np.stack([np.cos(lat) * np.cos(lon), np.cos(lat) * np.sin(lon), np.sin(lat)], 1)
    east = np.stack([-np.sin(lon), np.cos(lon), 0 * lon], 1); north = np.cross(up, east)
    mxa = north * np.sin(lon)[:, None] + east * np.cos(lon)[:, None]; mya = north * np.cos(lon)[:, None] - east * np.sin(lon)[:, None]
    pos = up * (R / 1000.0)
    vis = np.zeros(n * n)
    idx = np.arange(n * n)
    for e in EARTH:
        v = e[None, :] - pos
        u = (v * up).sum(1); mx = (v * mxa).sum(1); my = (v * mya).sum(1)
        el = np.degrees(np.arctan2(u, np.hypot(mx, my))); az = np.degrees(np.arctan2(mx, my)) % 360
        f = az / 360 * naz; i0 = np.floor(f).astype(int) % naz; w = f - np.floor(f)
        h = hz[idx, i0] * (1 - w) + hz[idx, (i0 + 1) % naz] * w
        vis += el + EARTH_R > h
    ours = (vis / len(EARTH)).reshape(n, n)
    k = max(1, int(round(2 * half / n / 120)))
    s = np.round(3811.5 + X / 120).astype(int); l = np.round(3811.5 - Y / 120).astype(int)
    nas = (uniform_filter(nasa, k) if k > 1 else nasa)[l, s].reshape(n, n)
    d = ours - nas
    res[name] = dict(cell_m=2 * half / n, r=float(np.corrcoef(ours.ravel(), nas.ravel())[0, 1]), mae=float(np.abs(d).mean()),
                     bias=float(d.mean()), within10=float((np.abs(d) < 0.10).mean()))
    print(name, res[name], flush=True)
    if name == "core":
        plt.rcParams.update({"figure.facecolor": "#0b1220", "axes.facecolor": "#0b1220", "text.color": "#e5e7eb", "axes.labelcolor": "#e5e7eb",
                             "xtick.color": "#94a3b8", "ytick.color": "#94a3b8", "axes.edgecolor": "#334155"})
        fig, ax = plt.subplots(1, 3, figsize=(13, 4.4))
        for a, img, t in [(ax[0], nas, "NASA PGDA Earth visibility (Mazarico et al.)"), (ax[1], ours, "Polaris Window model")]:
            im = a.imshow(img * 100, cmap="Blues_r", vmin=0, vmax=100, extent=[-40, 40, -40, 40]); a.set_title(t, fontsize=11); a.set_xlabel("km"); a.set_ylabel("km")
        fig.colorbar(im, ax=ax[:2], shrink=.8, label="Earth visible % of time, 2009-07 to 2013-07")
        ax[2].hexbin(nas.ravel() * 100, ours.ravel() * 100, gridsize=60, bins="log", cmap="viridis", mincnt=1); ax[2].plot([0, 100], [0, 100], "--", color="#60a5fa", lw=1)
        ax[2].set_xlabel("NASA Earth visibility %"); ax[2].set_ylabel("Our Earth visibility %")
        ax[2].set_title(f"r = {res[name]['r']:.3f}   mean abs. error = {res[name]['mae']*100:.1f} pts", fontsize=11)
        plt.savefig(f"{OUT}/validation_earth.png", dpi=110, bbox_inches="tight"); plt.close()

meta["validation"]["earth"] = dict(source="NASA PGDA / LOLA AVGVISIB_75S_120M_201608_EARTH (Mazarico et al. 2011)",
                                   criterion="any part of Earth's disc above terrain", grids=res)
json.dump(meta, open(f"{OUT}/meta.json", "w"), indent=1)
