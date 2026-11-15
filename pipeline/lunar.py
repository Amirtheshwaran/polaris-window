"""Shared lunar geometry for the pipeline (same math as build.py, importable)."""
import numpy as np
import numba as nb
import spiceypy as sp

R = 1737400.0
SUN_R = 0.267


def load_dem(raw):
    return (np.fromfile(f"{raw}/ldem_80s_80m.img", "<i2").reshape(7600, 7600) * 0.5).astype(np.float32)


def ll2xy(lat, lon):
    rho = 2 * R * np.tan(np.radians(90 + lat) / 2)
    return rho * np.sin(np.radians(lon)), rho * np.cos(np.radians(lon))


def xy2ll(x, y):
    return np.degrees(2 * np.arctan(np.hypot(x, y) / (2 * R))) - 90, np.degrees(np.arctan2(x, y)) % 360


@nb.njit(fastmath=True)
def hgt(dem, x, y):
    s = 3799.5 + x / 80.0; l = 3799.5 - y / 80.0
    if s < 0 or l < 0 or s >= 7598 or l >= 7598:
        return np.nan
    i = int(l); j = int(s); fl = l - i; fs = s - j
    return (dem[i, j] * (1 - fs) + dem[i, j + 1] * fs) * (1 - fl) + (dem[i + 1, j] * (1 - fs) + dem[i + 1, j + 1] * fs) * fl


@nb.njit(parallel=True, fastmath=True)
def horizons(dem, xs, ys, naz, dmax):
    n = xs.shape[0]; out = np.empty((n, naz), np.float32)
    for k in nb.prange(n):
        h0 = hgt(dem, xs[k], ys[k]) + 2.0
        for a in range(naz):
            az = 2 * np.pi * a / naz; dx = np.sin(az); dy = np.cos(az); best = -90.0; d = 80.0
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


def local_az_el(lat, lon, vec, rpos=None):
    la, lo = np.radians(lat), np.radians(lon)
    up = np.array([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)])
    east = np.array([-np.sin(lo), np.cos(lo), 0.0]); north = np.cross(up, east)
    v = vec if rpos is None else vec - rpos
    v = v / np.linalg.norm(v, axis=-1)[..., None]
    u, e, n = v @ up, v @ east, v @ north
    mx = n * np.sin(lo) + e * np.cos(lo); my = n * np.cos(lo) - e * np.sin(lo)
    return np.degrees(np.arctan2(mx, my)) % 360, np.degrees(np.arcsin(np.clip(u, -1, 1)))


def site_pos(lat, lon, elev):
    la, lo = np.radians(lat), np.radians(lon); r = (R + elev) / 1000.0
    return np.array([r * np.cos(la) * np.cos(lo), r * np.cos(la) * np.sin(lo), r * np.sin(la)])


def interp_h(prof, az):
    naz = prof.shape[-1]; f = az / 360 * naz
    i0 = np.floor(f).astype(int) % naz; i1 = (i0 + 1) % naz; w = f - np.floor(f)
    return prof[..., i0] * (1 - w) + prof[..., i1] * w


def sun_frac(el, hz):
    return np.clip((el - hz) / (2 * SUN_R) + 0.5, 0, 1)


def ephem(raw, t0, t1, step):
    for k in ["naif0012.tls", "de440s.bsp", "pck00011.tpc", "moon_pa_de440_200625.bpc", "moon_de440_250416.tf"]:
        sp.furnsh(f"{raw}/{k}")
    ets = np.arange(sp.str2et(t0), sp.str2et(t1), step)
    sun, _ = sp.spkpos("SUN", ets, "MOON_ME", "LT+S", "MOON"); earth, _ = sp.spkpos("EARTH", ets, "MOON_ME", "LT+S", "MOON")
    sun = np.array(sun); return ets, sun / np.linalg.norm(sun, axis=1)[:, None], np.array(earth)
