"""Read a few members out of a large remote ZIP using HTTP Range requests (no full download).
Usage: python rangezip.py <url> [substring-filter] [outdir]   -> lists members, extracts those matching filter."""
import io, os, sys, urllib.request, zipfile


class RangeFile(io.RawIOBase):
    def __init__(self, url):
        self.url, self.pos = url, 0
        req = urllib.request.Request(url, method="HEAD")
        with urllib.request.urlopen(req, timeout=60) as r:
            self.size = int(r.headers["Content-Length"])
            assert r.headers.get("Accept-Ranges", "") == "bytes" or True

    def seekable(self): return True
    def readable(self): return True
    def tell(self): return self.pos

    def seek(self, off, whence=0):
        self.pos = off if whence == 0 else self.pos + off if whence == 1 else self.size + off
        return self.pos

    def read(self, n=-1):
        if n is None or n < 0: n = self.size - self.pos
        if n == 0 or self.pos >= self.size: return b""
        end = min(self.size, self.pos + n) - 1
        req = urllib.request.Request(self.url, headers={"Range": f"bytes={self.pos}-{end}"})
        with urllib.request.urlopen(req, timeout=120) as r:
            data = r.read()
        self.pos += len(data)
        return data

    def readinto(self, b):
        m = memoryview(b).cast('B'); d = self.read(len(m)); m[:len(d)] = d; return len(d)


if __name__ == "__main__":
    url = sys.argv[1]; flt = sys.argv[2] if len(sys.argv) > 2 else None; out = sys.argv[3] if len(sys.argv) > 3 else "."
    z = zipfile.ZipFile(io.BufferedReader(RangeFile(url), buffer_size=1 << 16))
    for i in z.infolist():
        if flt is None: print(i.filename, i.file_size)
        elif flt in i.filename:
            os.makedirs(out, exist_ok=True); z.extract(i, out); print("extracted", i.filename, i.file_size)
