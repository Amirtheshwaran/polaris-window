"""Pack the horizon grids for faster loading: delta along azimuth (mod 256) + gzip -> web/data/hz_*.dgz.
The raw hz_*.bin files stay as a fallback for browsers without DecompressionStream.
Run after build.py: python pipeline/pack.py"""
import gzip, json, os
import numpy as np

OUT = os.path.join(os.path.dirname(__file__), "..", "web", "data")
naz = json.load(open(f"{OUT}/meta.json"))["naz"]
for name in ("core", "regional"):
    a = np.fromfile(f"{OUT}/hz_{name}.bin", np.uint8).reshape(-1, naz)
    d = np.diff(a.astype(np.int16), axis=1, prepend=0).astype(np.uint8)
    assert np.array_equal(np.cumsum(d, axis=1, dtype=np.uint8), a)  # lossless round trip
    with open(f"{OUT}/hz_{name}.dgz", "wb") as f:
        f.write(gzip.compress(d.tobytes(), 9, mtime=0))
    print(name, a.nbytes, "->", os.path.getsize(f"{OUT}/hz_{name}.dgz"))
