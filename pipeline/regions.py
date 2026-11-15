"""NASA Artemis III candidate landing regions (Oct 2024) from the official USGS data release
(McClernan 2024, https://doi.org/10.5066/P1MEQ6UK, 1 km LGRS grids in Lunar Polar Stereographic).

For each region: footprint outline -> our map coords, footprint center, and the best landing spot inside it:
max (0.6 sunlight + 0.4 Earth visibility) over 2027 on ground flatter than 8 deg (LOLA 80 m slope).
Replaces the old approximate region sites in web/data/sites.json.
Run: python pipeline/regions.py <raw_dir> <usgs_grids_dir>"""
import glob, json, os, sys
import numpy as np
import shapefile
from scipy.ndimage import uniform_filter
from lunar import load_dem, xy2ll, ll2xy, hgt, horizons, local_az_el, site_pos, interp_h, sun_frac, ephem

RAW, GRIDS = sys.argv[1], sys.argv[2]
OUT = os.path.join(os.path.dirname(__file__), "..", "web", "data")
K0, FE = 0.994, 500000.0  # USGS LPS projection: stereographic, scale 0.994, false easting/northing 500 km
# Footprint-derived centers circulated by a third-party site (MoonSnag); used only as a cross-check,
# and for Mons Mouton Plateau whose USGS file is not downloadable without a browser session.
REF = {"Peak_Near_Cabeus_B": (-83.552, -68.416), "Haworth": (-86.635, -23.672), "Malapert_Massif": (-85.925, -1.205),
       "Mons_Mouton_Plateau": (-84.291, 27.427), "Mons_Mouton": (-85.409, 30.837), "Nobile_Rim_1": (-85.423, 36.19),
       "Nobile_Rim_2": (-83.976, 57.961), "de_Gerlache_Rim_2": (-88.142, -63.662), "Slater_Plain": (-87.256, 125.218)}

dem = load_dem(RAW)
gy, gx = np.gradient(dem, 80.0)
slope3 = uniform_filter(np.degrees(np.arctan(np.hypot(gx, gy))).astype(np.float32), 3)
_, SUN, EARTH = ephem(RAW, "2027-01-01T00:00:00", "2028-01-01T00:00:00", 6 * 3600.0)
nasa = np.fromfile(f"{RAW}/avgvisib_75s_120m_201608.img", "<i2").reshape(7624, 7624) * 0.00004
_, VSUN, _ = ephem(RAW, "2009-07-13T18:00:00", "2013-07-18T12:00:00", 6 * 3600.0)


def slope_at(x, y):
    return float(slope3[int(round(3799.5 - y / 80)), int(round(3799.5 + x / 80))])


regions = []
for name in REF:
    shp = glob.glob(f"{GRIDS}/{name}/*_1km_S_Grid.shp")
    if shp:
        r = shapefile.Reader(shp[0][:-4])
        x0, y0, x1, y1 = [(v - FE) / K0 for v in r.bbox]
        src = "USGS footprint (1 km LGRS grid)"
    else:  # fallback: 15 km box around the reference center
        cx, cy = ll2xy(*REF[name]); x0, y0, x1, y1 = cx - 7500, cy - 7500, cx + 7500, cy + 7500
        src = "approximate 15 km box around published center (USGS file unavailable)"
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    clat, clon = xy2ll(cx, cy)
    rx, ry = ll2xy(*REF[name]); off = float(np.hypot(cx - rx, cy - ry))
    # candidate spots on a 160 m lattice inside the footprint, flat enough to land
    gxs, gys = np.meshgrid(np.arange(x0 + 80, x1, 160.0), np.arange(y0 + 80, y1, 160.0))
    gxs, gys = gxs.ravel(), gys.ravel()
    ok = np.array([slope_at(a, b) <= 8 for a, b in zip(gxs, gys)])
    gxs, gys = gxs[ok], gys[ok]
    hz = horizons(dem, gxs, gys, 90, 180000.0)
    lat, lon = xy2ll(gxs, gys)
    score = np.empty(len(gxs))
    for k in range(len(gxs)):
        az, el = local_az_el(lat[k], lon[k], SUN); s = sun_frac(el, interp_h(hz[k], az)).mean()
        p = site_pos(lat[k], lon[k], hgt(dem, gxs[k], gys[k]))
        az, el = local_az_el(lat[k], lon[k], EARTH, p); e = (el > interp_h(hz[k], az)).mean()
        score[k] = 0.6 * s + 0.4 * e
    b = int(np.argmax(score)); bx, by = float(gxs[b]), float(gys[b]); blat, blon = xy2ll(bx, by)
    prof = horizons(dem, np.array([bx]), np.array([by]), 720, 220000.0)[0]
    az, el = local_az_el(blat, blon, VSUN)
    ours = float((sun_frac(el, interp_h(prof, az)) > 0).mean())
    i, j = int(round(3811.5 - by / 120)), int(round(3811.5 + bx / 120))
    outline = [[round(x0), round(y0)], [round(x1), round(y0)], [round(x1), round(y1)], [round(x0), round(y1)]]
    label = name.replace("_", " ").replace("de Gerlache", "de Gerlache").replace("Near", "near")
    regions.append(dict(
        id="a3_" + name.lower(), name=label, artemis=True,
        note=f"NASA Artemis III candidate region (Oct 2024). Pin = best flat (≤8°) spot for sun + Earth inside the {round((x1-x0)/1000)}×{round((y1-y0)/1000)} km region.",
        lat=round(float(blat), 4), lon=round(float(blon), 4), x=round(bx), y=round(by), elev=round(float(hgt(dem, bx, by))),
        slope=round(slope_at(bx, by), 1), horizon=[round(float(v), 2) for v in prof],
        validation=dict(ours=round(ours, 4), nasa=round(float(nasa[i, j]), 4), nasa_best120m=round(float(nasa[i - 1:i + 2, j - 1:j + 2].max()), 4)),
        region=dict(outline=outline, center=[round(float(clat), 4), round(float(clon), 4)], source=src, ref_offset_km=round(off / 1000, 2),
                    candidates=int(len(gxs)), best_score=round(float(score[b]), 3))))
    print(f"{name:22s} center {clat:8.3f} {clon:8.2f}  vs ref {off/1000:5.2f} km  cand {len(gxs):5d}  best {blat:.3f},{blon:.2f} score {score[b]:.2f}  {src[:20]}", flush=True)

sites = [s for s in json.load(open(f"{OUT}/sites.json")) if s["id"] in ("ridge", "shackleton", "faustini")]
for s in sites:
    s["note"] = s["note"].replace(" (approx.)", "")
json.dump(regions + sites, open(f"{OUT}/sites.json", "w"))
meta = json.load(open(f"{OUT}/meta.json"))
meta["regions_source"] = "McClernan, M.T., 2024, Down Selected Artemis III Candidate Landing Site Navigational Grids: USGS data release, https://doi.org/10.5066/P1MEQ6UK"
json.dump(meta, open(f"{OUT}/meta.json", "w"), indent=1)
print("sites:", [s["id"] for s in regions + sites])
