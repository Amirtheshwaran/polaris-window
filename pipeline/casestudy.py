"""Extend the ephemeris to start 2025-01-01 and add real CLPS landing case studies to sites.json.
Run: python pipeline/casestudy.py <raw_dir>"""
import json, os, sys
import numpy as np
from scipy.ndimage import uniform_filter
from lunar import load_dem, ll2xy, hgt, horizons, local_az_el, interp_h, sun_frac, ephem

RAW = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), "..", "web", "data")
meta = json.load(open(f"{OUT}/meta.json"))

# 1. ephemeris 2025-01-01 .. 2031-01-01, hourly (Sun unit vector, Earth position / 1000 km), MOON_ME frame
ets, SUN, EARTH = ephem(RAW, "2025-01-01T00:00:00", "2031-01-01T00:00:00", 3600.0)
np.hstack([SUN, EARTH / 1000.0]).astype(np.float32).tofile(f"{OUT}/ephem.bin")
meta["ephem"].update(start="2025-01-01T00:00:00Z", count=int(len(ets)))
json.dump(meta, open(f"{OUT}/meta.json", "w"), indent=1)
print("ephem", len(ets))

# 2. case studies
CASES = [dict(
    id="clps_im2", name="IM-2 Athena (CLPS 2025)", lat=-84.7906, lon=29.1957, landed="2025-03-06T17:00:00Z",
    note="Real NASA CLPS landing by Intuitive Machines, 6 March 2025 (location approximate, as reported).",
    story="Athena's site and date were excellent: our model shows 100% sunlight and Earth in view for its planned 10-day mission, on a gentle slope. "
          "But it touched down about 250 m off target inside a small crater, smaller than these 80 m maps can show, and tipped onto its side. "
          "Its power ran out within about a day. The lesson: pick the right place and date (this tool), then map hazards at even finer scale.")]
dem = load_dem(RAW)
gy, gx = np.gradient(dem, 80.0)
slope3 = uniform_filter(np.degrees(np.arctan(np.hypot(gx, gy))).astype(np.float32), 3)
nasa = np.fromfile(f"{RAW}/avgvisib_75s_120m_201608.img", "<i2").reshape(7624, 7624) * 0.00004
_, VSUN, _ = ephem(RAW, "2009-07-13T18:00:00", "2013-07-18T12:00:00", 6 * 3600.0)
sites = [s for s in json.load(open(f"{OUT}/sites.json")) if not s["id"].startswith("clps_")]
for c in CASES:
    x, y = ll2xy(c["lat"], c["lon"])
    prof = horizons(dem, np.array([x]), np.array([y]), 720, 220000.0)[0]
    az, el = local_az_el(c["lat"], c["lon"], VSUN)
    i, j = int(round(3811.5 - y / 120)), int(round(3811.5 + x / 120))
    c.update(lon=c["lon"] % 360, x=round(float(x)), y=round(float(y)), elev=round(float(hgt(dem, x, y))), clps=True,
             slope=round(float(slope3[int(round(3799.5 - y / 80)), int(round(3799.5 + x / 80))]), 1),
             horizon=[round(float(v), 2) for v in prof],
             validation=dict(ours=round(float((sun_frac(el, interp_h(prof, az)) > 0).mean()), 4), nasa=round(float(nasa[i, j]), 4),
                             nasa_best120m=round(float(nasa[i - 1:i + 2, j - 1:j + 2].max()), 4)))
    sites.append(c); print(c["id"], c["elev"], c["slope"], c["validation"])
json.dump(sites, open(f"{OUT}/sites.json", "w"))
