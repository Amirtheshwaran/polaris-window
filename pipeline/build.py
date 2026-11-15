"""Polaris Window data pipeline.

LOLA LDEM_80S_80M (NASA PDS)  ->  terrain mesh + horizon-elevation grids + site horizon profiles
NAIF SPICE (DE440 + MOON_ME)   ->  hourly Sun / Earth vectors in the lunar body-fixed frame
NASA PGDA AVGVISIB maps         ->  validation of our illumination model

Run:  python pipeline/build.py <raw_dir>   (writes web/data/*)
"""
import json, sys, os, time
import numpy as np
import numba as nb
import spiceypy as sp

RAW = sys.argv[1] if len(sys.argv) > 1 else "/home/user/data/raw"
OUT = os.path.join(os.path.dirname(__file__), "..", "web", "data")
os.makedirs(OUT, exist_ok=True)
R = 1737400.0
OBS_H = 2.0  # observer (solar panel / antenna) height above ground, m

# ---------------------------------------------------------------- DEM
N0, S0, PX = 7600, 3799.5, 80.0
dem = (np.fromfile(f"{RAW}/ldem_80s_80m.img", "<i2").reshape(N0, N0) * 0.5).astype(np.float32)


def ll2xy(lat, lon):
    rho = 2 * R * np.tan(np.radians(90 + lat) / 2)
    return rho * np.sin(np.radians(lon)), rho * np.cos(np.radians(lon))


def xy2ll(x, y):
    rho = np.hypot(x, y)
    return np.degrees(2 * np.arctan(rho / (2 * R))) - 90, np.degrees(np.arctan2(x, y)) % 360


@nb.njit(fastmath=True)
def hgt(dem, x, y):
    s = 3799.5 + x / 80.0
    l = 3799.5 - y / 80.0
    if s < 0 or l < 0 or s >= 7598 or l >= 7598:
        return np.nan
    i = int(l); j = int(s); fl = l - i; fs = s - j
    return (dem[i, j] * (1 - fs) + dem[i, j + 1] * fs) * (1 - fl) + (dem[i + 1, j] * (1 - fs) + dem[i + 1, j + 1] * fs) * fl


@nb.njit(parallel=True, fastmath=True)
def horizons(dem, xs, ys, naz, dmax):
    """Horizon elevation angle (deg) for each point and azimuth.
    Azimuth is measured in the map plane from +y (lon 0 direction) toward +x."""
    n = xs.shape[0]
    out = np.empty((n, naz), np.float32)
    for k in nb.prange(n):
        h0 = hgt(dem, xs[k], ys[k]) + 2.0
        for a in range(naz):
            az = 2 * np.pi * a / naz
            dx = np.sin(az); dy = np.cos(az)
            best = -90.0
            d = 80.0
            while d < dmax:
                h = hgt(dem, xs[k] + dx * d, ys[k] + dy * d)
                if np.isnan(h):
                    break
                e = np.arctan2(h - h0 - d * d / (2 * 1737400.0), d)
                if e > best:
                    best = e
                d += max(80.0, d * 0.012)
            out[k, a] = np.degrees(best)
    return out


def grid(half, n):
    c = (np.arange(n) + 0.5) / n * 2 * half - half
    X, Y = np.meshgrid(c, -c)  # row 0 = +y (top)
    return X.ravel(), Y.ravel()


def q8(h):  # horizon deg -> uint8, 0.1 deg steps from -4 deg
    return np.clip(np.round((h + 4.0) * 10), 0, 255).astype(np.uint8)


GRIDS = {"regional": (192000.0, 256), "core": (40000.0, 256)}
NAZ = 120
t = time.time()
grid_h = {}
for name, (half, n) in GRIDS.items():
    X, Y = grid(half, n)
    h = horizons(dem, X, Y, NAZ, 220000.0)
    grid_h[name] = h
    q8(h).tofile(f"{OUT}/hz_{name}.bin")
    print(name, "horizons", h.shape, f"{time.time()-t:.0f}s", flush=True)

# terrain mesh heights (with lunar curvature kept separate; client applies it)
TN = 641
X, Y = grid(192000.0, TN)
Xn = np.linspace(-192000, 192000, TN); Xg, Yg = np.meshgrid(Xn, -Xn)
idx_s = np.clip(np.round(3799.5 + Xg / 80).astype(int), 0, N0 - 1)
idx_l = np.clip(np.round(3799.5 - Yg / 80).astype(int), 0, N0 - 1)
# box-filter for anti-aliasing
from scipy.ndimage import uniform_filter
dem_s = uniform_filter(dem, 7)
np.round(dem_s[idx_l, idx_s]).astype(np.int16).tofile(f"{OUT}/terrain.bin")
CN = 513
Xc = np.linspace(-40000, 40000, CN); Xg, Yg = np.meshgrid(Xc, -Xc)
np.round(uniform_filter(dem, 2)[np.round(3799.5 - Yg / 80).astype(int), np.round(3799.5 + Xg / 80).astype(int)]).astype(np.int16).tofile(f"{OUT}/terrain_core.bin")

# ---------------------------------------------------------------- SPICE ephemeris
for k in ["naif0012.tls", "de440s.bsp", "pck00011.tpc", "moon_pa_de440_200625.bpc", "moon_de440_250416.tf"]:
    sp.furnsh(f"{RAW}/{k}")


def ephem(t0, t1, step):
    e0 = sp.str2et(t0); e1 = sp.str2et(t1)
    ets = np.arange(e0, e1, step)
    sun, _ = sp.spkpos("SUN", ets, "MOON_ME", "LT+S", "MOON")
    earth, _ = sp.spkpos("EARTH", ets, "MOON_ME", "LT+S", "MOON")
    sun = np.array(sun); earth = np.array(earth)
    return ets, sun / np.linalg.norm(sun, axis=1)[:, None], earth


ETS, SUN, EARTH = ephem("2025-01-01T00:00:00", "2031-01-01T00:00:00", 3600.0)
np.hstack([SUN, EARTH / 1000.0]).astype(np.float32).tofile(f"{OUT}/ephem.bin")  # earth in 1000 km
print("ephem", SUN.shape, flush=True)


# ---------------------------------------------------------------- local geometry helpers
def local_az_el(lat, lon, vec, rpos=None):
    """vec: (T,3) direction (or position if rpos given). Returns map-plane azimuth (deg) and elevation (deg)."""
    la, lo = np.radians(lat), np.radians(lon)
    up = np.array([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)])
    east = np.array([-np.sin(lo), np.cos(lo), 0.0])
    north = np.cross(up, east)
    v = vec if rpos is None else vec - rpos
    v = v / np.linalg.norm(v, axis=-1)[..., None]
    u, e, n = v @ up, v @ east, v @ north
    mx = n * np.sin(lo) + e * np.cos(lo)
    my = n * np.cos(lo) - e * np.sin(lo)
    return np.degrees(np.arctan2(mx, my)) % 360, np.degrees(np.arcsin(np.clip(u, -1, 1)))


def interp_h(prof, az):
    naz = prof.shape[-1]
    f = az / 360 * naz
    i0 = np.floor(f).astype(int) % naz; i1 = (i0 + 1) % naz; w = f - np.floor(f)
    return prof[..., i0] * (1 - w) + prof[..., i1] * w


SUN_R = 0.267  # deg, solar angular radius


def sun_frac(el, hz):
    return np.clip((el - hz) / (2 * SUN_R) + 0.5, 0, 1)


def grid_avg_vis(name, sun, partial=True):
    half, n = GRIDS[name]
    X, Y = grid(half, n)
    lat, lon = xy2ll(X, Y)
    h = grid_h[name]
    acc = np.zeros(len(X))
    for k in range(len(X)):
        az, el = local_az_el(lat[k], lon[k], sun)
        hz = interp_h(h[k], az)
        acc[k] = (sun_frac(el, hz) > 0).mean() if not partial else sun_frac(el, hz).mean()
    return acc.reshape(n, n)


# ---------------------------------------------------------------- validation vs NASA PGDA (Mazarico et al.)
VE, VSUN, _ = ephem("2009-07-13T18:00:00", "2013-07-18T12:00:00", 6 * 3600.0)
nasa = np.fromfile(f"{RAW}/avgvisib_75s_120m_201608.img", "<i2").reshape(7624, 7624) * 0.00004
val = {}
for name in GRIDS:
    half, n = GRIDS[name]
    ours = grid_avg_vis(name, VSUN, partial=False)  # "sunlit by any fraction of solar disc", same as NASA
    X, Y = grid(half, n)
    s = np.round(3811.5 + X / 120).astype(int); l = np.round(3811.5 - Y / 120).astype(int)
    # NASA map averaged over our cell footprint
    from scipy.ndimage import uniform_filter as uf
    k = max(1, int(round(2 * half / n / 120)))
    nas = uf(nasa.astype(np.float32), k)[l, s].reshape(n, n)
    d = ours - nas
    val[name] = dict(cell_m=2 * half / n, r=float(np.corrcoef(ours.ravel(), nas.ravel())[0, 1]),
                     mae=float(np.abs(d).mean()), bias=float(d.mean()), within10=float((np.abs(d) < 0.10).mean()))
    np.save(f"{RAW}/val_{name}.npy", np.stack([ours, nas]))
    print("validation", name, val[name], flush=True)

# ---------------------------------------------------------------- sites
SITES = [
    # id, name, nominal lat, lon, snap mode, snap radius km, note
    ("ridge", "Connecting Ridge", -89.45, 222.7, "light", 4, "Shackleton–de Gerlache ridge, among the best-lit terrain on the Moon"),
    ("shackleton", "Shackleton Rim", -89.68, 194.0, "light", 3, "Rim of Shackleton crater, next to permanently shadowed ice traps"),
    ("degerlache", "de Gerlache Rim", -88.67, 292.0, "light", 6, "Artemis III candidate region (approx.)"),
    ("haworth", "Haworth", -86.8, 345.0, "light", 8, "Artemis III candidate region (approx.)"),
    ("malapert", "Malapert Massif", -86.0, 2.9, "high", 15, "Artemis III candidate region (approx.), 5 km tall massif"),
    ("nobile", "Nobile Rim", -85.4, 37.0, "light", 10, "Artemis III candidate region (approx.)"),
    ("mouton", "Mons Mouton", -84.6, 31.0, "high", 20, "Artemis III candidate region (approx.), former VIPER target area"),
    ("faustini", "Faustini PSR", -87.3, 77.0, "low", 4, "Permanently shadowed crater floor, water-ice science target"),
]
Y27 = slice(24 * 365, 24 * 730)  # 2026 for snapping
sites = []
for sid, name, la, lo, mode, rkm, note in SITES:
    x0, y0 = ll2xy(la, lo)
    if mode == "high":
        r = int(rkm * 1000 / 80); s0 = int(3799.5 + x0 / 80); l0 = int(3799.5 - y0 / 80)
        win = dem[l0 - r:l0 + r + 1, s0 - r:s0 + r + 1]
        i, j = np.unravel_index(np.argmax(win), win.shape)
        x, y = (s0 - r + j - 3799.5) * 80, (3799.5 - (l0 - r + i)) * 80
    else:
        # candidate points on a 240 m lattice within radius; pick best (or worst) average sunlight
        g = np.arange(-rkm * 1000, rkm * 1000 + 1, 240.0)
        cx, cy = np.meshgrid(g, g); m = np.hypot(cx, cy) <= rkm * 1000
        cx = (cx[m] + x0).astype(np.float64); cy = (cy[m] + y0).astype(np.float64)
        hz = horizons(dem, cx, cy, 90, 150000.0)
        clat, clon = xy2ll(cx, cy)
        sc = np.empty(len(cx))
        for k in range(len(cx)):
            az, el = local_az_el(clat[k], clon[k], SUN[Y27][::6])
            sc[k] = sun_frac(el, interp_h(hz[k], az)).mean()
        k = np.argmax(sc) if mode == "light" else np.argmin(sc)
        x, y = cx[k], cy[k]
    lat, lon = xy2ll(x, y)
    prof = horizons(dem, np.array([x]), np.array([y]), 720, 220000.0)[0]
    sites.append(dict(id=sid, name=name, note=note, lat=round(float(lat), 4), lon=round(float(lon), 4),
                      x=round(float(x)), y=round(float(y)), elev=round(float(hgt(dem, x, y))),
                      horizon=[round(float(v), 2) for v in prof]))
    print("site", sid, round(lat, 3), round(lon, 2), flush=True)

# validation for sites (point-wise against NASA map, same period, any-fraction criterion)
for s in sites:
    az, el = local_az_el(s["lat"], s["lon"], VSUN)
    ours = float((sun_frac(el, interp_h(np.array(s["horizon"]), az)) > 0).mean())
    sx, sy = 3811.5 + s["x"] / 120, 3811.5 - s["y"] / 120
    i, j = int(round(sy)), int(round(sx))
    s["validation"] = dict(ours=round(ours, 4), nasa=round(float(nasa[i, j]), 4), nasa_best120m=round(float(nasa[i - 1:i + 2, j - 1:j + 2].max()), 4))
    print("val site", s["id"], s["validation"])

meta = dict(
    R=R, obs_h=OBS_H, naz=NAZ, hz_q=dict(offset=-4.0, step=0.1),
    grids={k: dict(half=v[0], n=v[1]) for k, v in GRIDS.items()},
    terrain=dict(half=192000.0, n=TN), terrain_core=dict(half=40000.0, n=CN),
    ephem=dict(start="2025-01-01T00:00:00Z", step_h=1, count=int(len(ETS)), frame="MOON_ME", earth_unit_km=1000),
    validation=dict(period="2009-07-13 to 2013-07-18", source="NASA PGDA / LOLA AVGVISIB_75S_120M_201608 (Mazarico et al. 2011)",
                    grids=val),
    sources=["LOLA LDEM_80S_80M (NASA PDS Geosciences Node)", "NAIF SPICE DE440s + MOON_PA_DE440 + MOON_ME frame",
             "NASA PGDA Lunar Polar Illumination maps (validation)"],
)
json.dump(meta, open(f"{OUT}/meta.json", "w"), indent=1)
json.dump(sites, open(f"{OUT}/sites.json", "w"))
print("done", f"{time.time()-t:.0f}s")
