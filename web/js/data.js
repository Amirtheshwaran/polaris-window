// Core data + geometry. All lunar vectors are in the MOON_ME body-fixed frame (same frame as LOLA).
export const D = { meta: null, sites: [], ephem: null, T: 0, t0: 0, grids: {}, custom: [] };
const R = 1737400, DEG = Math.PI / 180, SUN_R = 0.267;
export const HOUR = 3600e3;

async function bin(url, Type) { const b = await (await fetch(url)).arrayBuffer(); return new Type(b); }

export async function loadAll() {
  const [meta, sites, eph, hr, hc, ter, terc, slr, slc] = await Promise.all([
    fetch('data/meta.json').then(r => r.json()), fetch('data/sites.json').then(r => r.json()),
    bin('data/ephem.bin', Float32Array), bin('data/hz_regional.bin', Uint8Array), bin('data/hz_core.bin', Uint8Array),
    bin('data/terrain.bin', Int16Array), bin('data/terrain_core.bin', Int16Array), bin('data/slope_regional.bin', Uint8Array), bin('data/slope_core.bin', Uint8Array)]);
  Object.assign(D, { meta, sites, ephem: eph, T: meta.ephem.count, t0: Date.parse(meta.ephem.start), terrain: ter, terrainCore: terc });
  D.grids.core = mkGrid(meta.grids.core, hc, meta);
  D.grids.regional = mkGrid(meta.grids.regional, hr, meta);
  D.grids.core.slope = Float32Array.from(slc, v => v * .25); D.grids.regional.slope = Float32Array.from(slr, v => v * .25);
  for (const s of D.sites) prepSite(s, s.horizon);
  try { for (const c of JSON.parse(localStorage.getItem('pw_custom') || '[]')) addCustom(c.x, c.y, c.name, false); } catch (e) {}
}

function mkGrid(g, q, meta) {
  const n = g.n, half = g.half, N = n * n, naz = meta.naz;
  const hz = new Float32Array(q.length);
  for (let i = 0; i < q.length; i++) hz[i] = meta.hz_q.offset + q[i] * meta.hz_q.step;
  // per-cell local frame (up/east/north) and lat/lon, for fast az/el
  const F = new Float32Array(N * 9);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x = ((j + .5) / n) * 2 * half - half, y = -(((i + .5) / n) * 2 * half - half);
    const [lat, lon] = xy2ll(x, y); frame(lat, lon, F, (i * n + j) * 9);
  }
  return { n, half, naz, hz, F };
}

export function ll2xy(lat, lon) { const rho = 2 * R * Math.tan((90 + lat) * DEG / 2); return [rho * Math.sin(lon * DEG), rho * Math.cos(lon * DEG)]; }
export function xy2ll(x, y) { const rho = Math.hypot(x, y); return [2 * Math.atan(rho / (2 * R)) / DEG - 90, ((Math.atan2(x, y) / DEG) + 360) % 360]; }

// local frame stored as up(3), mx-axis(3), my-axis(3): map-plane azimuth = atan2(v·mx, v·my)
function frame(lat, lon, F, o) {
  const la = lat * DEG, lo = lon * DEG, cl = Math.cos(la), sl = Math.sin(la), co = Math.cos(lo), so = Math.sin(lo);
  const up = [cl * co, cl * so, sl], east = [-so, co, 0], north = [-sl * co, -sl * so, cl];
  // mx = n sin lo + e cos lo ; my = n cos lo - e sin lo
  const mx = [north[0] * so + east[0] * co, north[1] * so + east[1] * co, north[2] * so + east[2] * co];
  const my = [north[0] * co - east[0] * so, north[1] * co - east[1] * so, north[2] * co - east[2] * so];
  F.set(up, o); F.set(mx, o + 3); F.set(my, o + 6);
}

export function sunVec(t) { const o = t * 6, e = D.ephem; return [e[o], e[o + 1], e[o + 2]]; }
export function earthVec(t) { const o = t * 6 + 3, e = D.ephem; return [e[o], e[o + 1], e[o + 2]]; }
export const tIndex = ms => Math.max(0, Math.min(D.T - 1, Math.round((ms - D.t0) / HOUR)));
export const tDate = t => new Date(D.t0 + t * HOUR);

// az (deg, map-plane, 0 = toward lon 0°, 90 = toward lon 90°E) and elevation (deg)
export function azel(F, o, v) {
  const u = v[0] * F[o] + v[1] * F[o + 1] + v[2] * F[o + 2];
  const mx = v[0] * F[o + 3] + v[1] * F[o + 4] + v[2] * F[o + 5];
  const my = v[0] * F[o + 6] + v[1] * F[o + 7] + v[2] * F[o + 8];
  const h = Math.hypot(mx, my);
  return [((Math.atan2(mx, my) / DEG) + 360) % 360, Math.atan2(u, h) / DEG];
}
export function hzAt(prof, off, naz, az) {
  const f = az / 360 * naz, i0 = Math.floor(f) % naz, w = f - Math.floor(f);
  return prof[off + i0] * (1 - w) + prof[off + (i0 + 1) % naz] * w;
}
export const sunFrac = (el, hz) => Math.min(1, Math.max(0, (el - hz) / (2 * SUN_R) + .5));

function prepSite(s, prof) {
  s.prof = Float32Array.from(prof); s.naz = prof.length; s.F = new Float32Array(9); frame(s.lat, s.lon, s.F, 0);
  const rr = (R + (s.elev || 0)) / 1e6, la = s.lat * DEG, lo = s.lon * DEG; // position in 1000 km
  s.pos = [rr * Math.cos(la) * Math.cos(lo), rr * Math.cos(la) * Math.sin(lo), rr * Math.sin(la)];
  s.series = null;
}

// Sun/Earth state at a site for time index t
export function siteState(s, t) {
  const [saz, sel] = azel(s.F, 0, sunVec(t));
  const e = earthVec(t), ev = [e[0] - s.pos[0], e[1] - s.pos[1], e[2] - s.pos[2]];
  const [eaz, eel] = azel(s.F, 0, ev);
  const shz = hzAt(s.prof, 0, s.naz, saz), ehz = hzAt(s.prof, 0, s.naz, eaz);
  return { saz, sel, shz, sun: sunFrac(sel, shz), eaz, eel, ehz, earth: eel > ehz ? 1 : 0 };
}

// Full hourly series for the whole ephemeris (cached): sun fraction (uint8 0..250), earth visible (0/1)
export function series(s) {
  if (s.series) return s.series;
  const sun = new Uint8Array(D.T), earth = new Uint8Array(D.T), sel = new Float32Array(D.T), eel = new Float32Array(D.T);
  for (let t = 0; t < D.T; t++) { const st = siteState(s, t); sun[t] = Math.round(st.sun * 250); earth[t] = st.earth; sel[t] = st.sel; eel[t] = st.eel; }
  return (s.series = { sun, earth, sel, eel });
}

// Statistics for a site over [a,b) hour indices
export function stats(s, a, b) {
  const { sun, earth } = series(s);
  let ss = 0, ee = 0, dark = 0, maxDark = 0, blk = 0, maxBlk = 0, both = 0;
  for (let t = a; t < b; t++) {
    ss += sun[t]; ee += earth[t]; if (sun[t] > 125 && earth[t]) both++;
    dark = sun[t] < 125 ? dark + 1 : 0; if (dark > maxDark) maxDark = dark;
    blk = earth[t] ? 0 : blk + 1; if (blk > maxBlk) maxBlk = blk;
  }
  const n = Math.max(1, b - a), sunP = ss / 250 / n;
  return { sun: sunP, earth: ee / n, both: both / n, maxDark, maxBlk, hours: n,
    // 10 m² vertical sun-tracking array, 30% efficient, 1361 W/m²
    powerW: sunP * 1361 * 0.3 * 10, energyKWh: ss / 250 * 1361 * 0.3 * 10 / 1000 };
}

// Auto window finder: rank start dates (6-hour steps) for an N-day mission.
export function findWindows(s, c) {
  const L = Math.round(c.days * 24), a0 = tIndex(c.from), a1 = Math.min(tIndex(c.to), D.T - L), step = 6;
  const { sun, earth } = series(s), cand = [];
  // prefix sums for fast means
  const ps = new Float64Array(D.T + 1), pe = new Float64Array(D.T + 1);
  for (let t = 0; t < D.T; t++) { ps[t + 1] = ps[t] + sun[t] / 250; pe[t + 1] = pe[t] + earth[t]; }
  const curve = [];
  for (let a = a0; a <= a1; a += step) {
    const sp = (ps[a + L] - ps[a]) / L, ep = (pe[a + L] - pe[a]) / L;
    let ok = sp * 100 >= c.minSun && ep * 100 >= c.minEarth, md = 0, mb = 0;
    if (ok) { // only evaluate run lengths for feasible windows
      let d = 0, k = 0;
      for (let t = a; t < a + L; t++) { d = sun[t] < 125 ? d + 1 : 0; if (d > md) md = d; k = earth[t] ? 0 : k + 1; if (k > mb) mb = k; }
      ok = md <= c.maxDark && mb <= c.maxBlack;
    }
    const score = ok ? 100 * (0.55 * sp + 0.3 * ep + 0.15 * (1 - md / L)) : 0;
    curve.push(score);
    if (ok) cand.push({ a, sun: sp, earth: ep, maxDark: md, maxBlk: mb, score });
  }
  cand.sort((x, y) => (y.score - x.score) || (x.a - y.a));
  const picked = []; // non-overlapping top windows
  for (const w of cand) { if (picked.every(p => Math.abs(p.a - w.a) >= L)) picked.push(w); if (picked.length >= 5) break; }
  return { picked, curve, a0, step, feasible: cand.length, total: curve.length };
}

export function addCustom(x, y, name, persist = true) {
  const [lat, lon] = xy2ll(x, y), g = gridFor(x, y);
  if (!g) return null;
  const prof = horizonFromGrid(g, x, y), elev = heightAt(x, y), slope = cellOf(g, x, y, g.slope);
  const s = { id: 'c' + Math.round(x) + '_' + Math.round(y), name: name || `Custom ${D.custom.length + 1}`, note: 'Your site (horizon from precomputed grid)', lat, lon, x, y, elev, slope, custom: true };
  prepSite(s, prof); D.custom.push(s);
  if (persist) saveCustom();
  return s;
}
export function removeCustom(s) { D.custom = D.custom.filter(c => c !== s); saveCustom(); }
function saveCustom() { try { localStorage.setItem('pw_custom', JSON.stringify(D.custom.map(c => ({ x: c.x, y: c.y, name: c.name })))); } catch (e) {} }
export const allSites = () => D.sites.concat(D.custom);

export function gridFor(x, y) {
  for (const g of [D.grids.core, D.grids.regional]) if (Math.abs(x) < g.half * 0.985 && Math.abs(y) < g.half * 0.985) return g;
  return null;
}
function cellOf(g, x, y, arr) { const n = g.n, j = Math.min(n - 1, Math.max(0, Math.floor((x + g.half) / (2 * g.half) * n))), i = Math.min(n - 1, Math.max(0, Math.floor((g.half - y) / (2 * g.half) * n))); return +arr[i * n + j].toFixed(1); }
function horizonFromGrid(g, x, y) { // bilinear blend of 4 neighbouring cell profiles
  const n = g.n, fj = (x + g.half) / (2 * g.half) * n - .5, fi = (g.half - y) / (2 * g.half) * n - .5;
  const j = Math.max(0, Math.min(n - 2, Math.floor(fj))), i = Math.max(0, Math.min(n - 2, Math.floor(fi))), wj = fj - j, wi = fi - i;
  const out = new Array(g.naz);
  for (let a = 0; a < g.naz; a++) {
    const h = k => g.hz[k * g.naz + a];
    out[a] = (h(i * n + j) * (1 - wj) + h(i * n + j + 1) * wj) * (1 - wi) + (h((i + 1) * n + j) * (1 - wj) + h((i + 1) * n + j + 1) * wj) * wi;
  }
  return out;
}
export function heightAt(x, y) {
  const use = (arr, half, n) => { const f = v => (v + half) / (2 * half) * (n - 1); const j = Math.round(f(x)), i = Math.round((half - y) / (2 * half) * (n - 1)); return arr[i * n + j]; };
  const c = D.meta.terrain_core, r = D.meta.terrain;
  if (Math.abs(x) < c.half && Math.abs(y) < c.half) return use(D.terrainCore, c.half, c.n);
  return use(D.terrain, r.half, r.n);
}

// Illumination of every grid cell at time t (0..1) -> Uint8 for textures
export function gridIllum(g, t, out) {
  const s = sunVec(t), N = g.n * g.n, F = g.F, hz = g.hz, naz = g.naz;
  for (let k = 0; k < N; k++) { const [az, el] = azel(F, k * 9, s); out[k] = 255 * sunFrac(el, hzAt(hz, k * naz, naz, az)); }
  return out;
}

// Heatmap: average metric per cell over [a,b) with stride; async-chunked so the UI stays alive
export const SAFE_SLOPE = 8; // degrees; typical lander tilt limit
export async function gridAverage(g, a, b, metric, onProg) {
  const N = g.n * g.n, F = g.F, hz = g.hz, naz = g.naz, acc = new Float32Array(N);
  if (metric === 'slope') { for (let k = 0; k < N; k++) acc[k] = Math.max(0, 1 - g.slope[k] / 20); return acc; }
  if (metric === 'land') { const v = await gridAverage(g, a, b, 'both', onProg); for (let k = 0; k < N; k++) v[k] *= g.slope[k] <= SAFE_SLOPE ? 1 : 0; return v; }
  const stride = Math.max(1, Math.ceil((b - a) / 1500)); let cnt = 0;
  const steps = []; for (let t = a; t < b; t += stride) steps.push(t);
  for (let si = 0; si < steps.length; si++) {
    const t = steps[si], s = sunVec(t), e = earthVec(t);
    for (let k = 0; k < N; k++) {
      const o = k * 9; let v = 1;
      if (metric !== 'earth') { const [az, el] = azel(F, o, s); v = sunFrac(el, hzAt(hz, k * naz, naz, az)); }
      if (metric !== 'sun') { // Earth parallax: subtract site position (approx radius R)
        const r = R / 1e6, p = [F[o] * r, F[o + 1] * r, F[o + 2] * r];
        const [az, el] = azel(F, o, [e[0] - p[0], e[1] - p[1], e[2] - p[2]]);
        v *= el > hzAt(hz, k * naz, naz, az) ? 1 : 0;
      }
      acc[k] += v;
    }
    cnt++;
    if (si % 40 === 39) { onProg && onProg(si / steps.length); await new Promise(r => setTimeout(r)); }
  }
  for (let k = 0; k < N; k++) acc[k] /= cnt;
  return acc;
}

export const fmtDate = d => d.toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
export const fmtDay = d => d.toISOString().slice(0, 10);
export const pct = v => (v * 100).toFixed(1) + '%';
export const hrs = h => h >= 48 ? (h / 24).toFixed(1) + ' d' : h + ' h';
