"""Sanity tests for the Polaris Window science pipeline.  Run: python -m pytest tests -q"""
import gzip, os, sys
import numpy as np
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "pipeline"))
from lunar import R, ll2xy, xy2ll, horizons, local_az_el, sun_frac  # noqa: E402


def test_polar_stereographic_round_trip():
    rng = np.random.default_rng(0)
    lat, lon = rng.uniform(-90, -80, 500), rng.uniform(0, 360, 500)
    la2, lo2 = xy2ll(*ll2xy(lat, lon))
    assert np.allclose(la2, lat, atol=1e-9)
    assert np.allclose((lo2 - lon + 180) % 360 - 180, 0, atol=1e-7)


def test_horizon_of_a_perfect_sphere_is_the_geometric_dip():
    # On a smooth sphere a 2 m observer sees the horizon dip by about 2*sqrt(2h/2R) radians ≈ 0.087°
    dem = np.zeros((7600, 7600), np.float32)
    hz = horizons(dem, np.array([0.0, 50000.0]), np.array([0.0, -30000.0]), 36, 220000.0)
    expected = -np.degrees(2 * np.sqrt(2.0 / (2 * R)))
    assert np.allclose(hz, expected, atol=0.01)


def test_a_wall_blocks_the_horizon_in_one_direction_only():
    dem = np.zeros((7600, 7600), np.float32)
    dem[:, 3799 + 13:3799 + 16] = 1000.0  # 1 km tall wall about 1 km east (+x) of the pole
    hz = horizons(dem, np.array([0.0]), np.array([0.0]), 72, 220000.0)[0]
    assert hz[18] > 40  # azimuth 90° (toward +x) is blocked by the wall
    assert hz[54] < 0   # azimuth 270° (away from the wall) stays open


def test_azimuth_convention_matches_the_map():
    # Map-plane azimuth: 0° points toward the lon 0° meridian (+X in MOON_ME), 90° toward lon 90°E (+Y)
    lat, lon = -89.9, 45.0
    az0, el0 = local_az_el(lat, lon, np.array([[1.0, 0, 0]]))
    az90, _ = local_az_el(lat, lon, np.array([[0, 1.0, 0]]))
    assert abs(az0[0]) < 0.5 or abs(az0[0] - 360) < 0.5
    assert abs(az90[0] - 90) < 0.5
    assert abs(el0[0]) < 0.2  # near the pole the equatorial plane is close to the horizon


def test_sun_fraction_is_half_when_the_disc_center_touches_the_horizon():
    assert sun_frac(np.array(1.0), np.array(1.0)) == pytest.approx(0.5)
    assert sun_frac(np.array(2.0), np.array(1.0)) == 1.0
    assert sun_frac(np.array(0.0), np.array(1.0)) == 0.0


def test_packed_horizon_files_are_lossless():
    data = os.path.join(os.path.dirname(__file__), "..", "web", "data")
    for name in ("core", "regional"):
        raw = np.fromfile(f"{data}/hz_{name}.bin", np.uint8).reshape(-1, 120)
        d = np.frombuffer(gzip.decompress(open(f"{data}/hz_{name}.dgz", "rb").read()), np.uint8).reshape(-1, 120)
        assert np.array_equal(np.cumsum(d, axis=1, dtype=np.uint8), raw)
