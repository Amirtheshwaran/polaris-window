"""Validation figures (ours vs NASA PGDA illumination map) + ephemeris cross-check against JPL Horizons.
Run after build.py:  python pipeline/validate.py <raw_dir>"""
import json, sys, os, urllib.request, urllib.parse
import numpy as np
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
import spiceypy as sp

RAW = sys.argv[1] if len(sys.argv) > 1 else "/home/user/data/raw"
OUT = os.path.join(os.path.dirname(__file__), "..", "web", "data")
meta = json.load(open(f"{OUT}/meta.json"))
plt.rcParams.update({"figure.facecolor": "#0b1220", "axes.facecolor": "#0b1220", "text.color": "#e5e7eb",
                     "axes.labelcolor": "#e5e7eb", "xtick.color": "#94a3b8", "ytick.color": "#94a3b8", "axes.edgecolor": "#334155"})

ours, nasa = np.load(f"{RAW}/val_core.npy")
v = meta["validation"]["grids"]["core"]
fig, ax = plt.subplots(1, 3, figsize=(13, 4.4), gridspec_kw=dict(width_ratios=[1, 1, 1]))
ext = [-40, 40, -40, 40]
for a, img, t in [(ax[0], nasa, "NASA PGDA map (Mazarico et al.)"), (ax[1], ours, "Polaris Window model")]:
    im = a.imshow(img * 100, cmap="inferno", vmin=0, vmax=90, extent=ext)
    a.set_title(t, fontsize=11); a.set_xlabel("km"); a.set_ylabel("km")
fig.colorbar(im, ax=ax[:2], shrink=.8, label="Average sunlight %, 2009-07 to 2013-07")
ax[2].hexbin(nasa.ravel() * 100, ours.ravel() * 100, gridsize=60, bins="log", cmap="viridis", mincnt=1)
ax[2].plot([0, 90], [0, 90], "--", color="#fbbf24", lw=1)
ax[2].set_xlabel("NASA sunlight %"); ax[2].set_ylabel("Our sunlight %")
ax[2].set_title(f"r = {v['r']:.3f}   mean abs. error = {v['mae']*100:.1f} pts", fontsize=11)
plt.savefig(f"{OUT}/validation_core.png", dpi=110, bbox_inches="tight"); plt.close()

# ---------------- JPL Horizons cross-check of Sun / Earth elevation at the Connecting Ridge site
for k in ["naif0012.tls", "de440s.bsp", "pck00011.tpc", "moon_pa_de440_200625.bpc", "moon_de440_250416.tf"]:
    sp.furnsh(f"{RAW}/{k}")
site = next(s for s in json.load(open(f"{OUT}/sites.json")) if s["id"] == "ridge")
lat, lon = site["lat"], site["lon"]
R = 1737.4 + site["elev"] / 1000
la, lo = np.radians(lat), np.radians(lon)
up = np.array([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)]); pos = up * R


def ours_el(body, utc):
    et = sp.str2et(utc)
    v, _ = sp.spkpos(body, et, "MOON_ME", "LT+S", "MOON")
    v = np.array(v) - (pos if body == "EARTH" else 0)
    return float(np.degrees(np.arcsin(v @ up / np.linalg.norm(v))))


rows = []
times = ["2027-01-15 00:00", "2027-04-01 12:00", "2027-08-20 06:00", "2028-02-10 18:00", "2028-06-30 00:00"]
for body, cmd in [("SUN", "10"), ("EARTH", "399")]:
    for t in times:
        q = dict(format="json", COMMAND=f"'{cmd}'", CENTER="'coord@301'", COORD_TYPE="'GEODETIC'",
                 SITE_COORD=f"'{lon:.5f},{lat:.5f},{site['elev']/1000:.4f}'", MAKE_EPHEM="'YES'", EPHEM_TYPE="'OBSERVER'",
                 START_TIME=f"'{t}'", STOP_TIME=f"'{t[:-5]}{int(t[-5:-3])}:01'", STEP_SIZE="'1 m'", QUANTITIES="'4'",
                 ANG_FORMAT="'DEG'", EXTRA_PREC="'YES'", CSV_FORMAT="'YES'")
        url = "https://ssd.jpl.nasa.gov/api/horizons.api?" + urllib.parse.urlencode(q, safe="'@,:")
        txt = json.load(urllib.request.urlopen(url, timeout=60))["result"]
        line = txt.split("$$SOE")[1].strip().splitlines()[0].split(",")
        hel = float(line[-2]) if line[-1].strip() == "" else float(line[-1])
        nums = [x.strip() for x in line if x.strip()]
        hel = float(nums[-1])
        o = ours_el(body, t.replace(" ", "T"))
        rows.append(dict(body=body.title(), utc=t, horizons=round(hel, 4), ours=round(o, 4), diff=round(o - hel, 4)))
        print(rows[-1], flush=True)
meta["validation"]["horizons"] = dict(site="Connecting Ridge", rows=rows,
                                      max_abs_diff_deg=max(abs(r["diff"]) for r in rows))
json.dump(meta, open(f"{OUT}/meta.json", "w"), indent=1)
print("ok")
