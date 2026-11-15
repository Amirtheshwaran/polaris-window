import { siteState, series, tDate, D, sunVec, earthVec } from './data.js';

const DIRS = { 0: 'Earth side', 180: 'far side' };

export function drawPano(cv, s, t) {
  const dpr = devicePixelRatio || 1, W = cv.clientWidth * dpr, H = 300 * dpr; cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  // gather paths for the next synodic month
  const N = 708, sun = [], earth = [];
  for (let k = 0; k < N && t + k < D.T; k += 2) { const st = siteState(s, t + k); st.t = t + k; sun.push(st); earth.push(st); }
  const cur = siteState(s, t);
  let hmax = -90, hmin = 90; for (const h of s.prof) { hmax = Math.max(hmax, h); hmin = Math.min(hmin, h); }
  let emax = -90, emin = 90; for (const e of earth) { emax = Math.max(emax, e.eel); emin = Math.min(emin, e.eel); }
  const top = Math.min(30, Math.max(6, hmax + 2, emax + 2)), bot = Math.max(-10, Math.min(-2.5, hmin - 1, emin - 1));
  const X = az => ((az + 180) % 360) / 360 * W, Y = el => (top - el) / (top - bot) * (H - 22 * dpr);
  // sky
  const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#000'); sky.addColorStop(1, '#0a1020'); g.fillStyle = sky; g.fillRect(0, 0, W, H);
  g.fillStyle = '#fff'; for (let i = 0; i < 140; i++) { const x = (Math.sin(i * 91.7) * .5 + .5) * W, y = (Math.sin(i * 37.3) * .5 + .5) * Y(hmin); g.globalAlpha = .25 + .5 * ((i * 13) % 7) / 7; g.fillRect(x, y, dpr, dpr); }
  g.globalAlpha = 1;
  // grid
  g.strokeStyle = '#1e293b'; g.lineWidth = 1; g.fillStyle = '#64748b'; g.font = `${10 * dpr}px system-ui`;
  for (let el = Math.ceil(bot / 2) * 2; el <= top; el += 2) { g.beginPath(); g.moveTo(0, Y(el)); g.lineTo(W, Y(el)); g.stroke(); g.fillText(el + '°', 3 * dpr, Y(el) - 2 * dpr); }
  g.strokeStyle = '#334155'; g.setLineDash([2 * dpr, 3 * dpr]); g.beginPath(); g.moveTo(0, Y(0)); g.lineTo(W, Y(0)); g.stroke(); g.setLineDash([]);
  // terrain silhouette
  const n = s.prof.length, grd = g.createLinearGradient(0, Y(hmax), 0, H); grd.addColorStop(0, '#3f3f46'); grd.addColorStop(1, '#09090b');
  g.beginPath(); g.moveTo(0, H);
  for (let i = 0; i <= n; i++) { const k = (i + n / 2) % n; g.lineTo(i / n * W, Y(s.prof[k])); }
  g.lineTo(W, H); g.closePath(); g.fillStyle = grd; g.fill();
  g.strokeStyle = '#a1a1aa'; g.lineWidth = 1.2 * dpr; g.beginPath();
  for (let i = 0; i <= n; i++) { const x = i / n * W, y = Y(s.prof[(i + n / 2) % n]); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
  // paths
  const dots = (arr, azk, elk, hzk, col) => { for (const p of arr) { const vis = p[elk] > p[hzk]; g.fillStyle = vis ? col : '#475569'; g.globalAlpha = vis ? .9 : .55; g.fillRect(X(p[azk]) - dpr, Y(p[elk]) - dpr, 2 * dpr, 2 * dpr); } g.globalAlpha = 1; };
  dots(earth, 'eaz', 'eel', 'ehz', '#60a5fa'); dots(sun, 'saz', 'sel', 'shz', '#fbbf24');
  // current bodies
  const disc = (az, el, r, c1, c2, label) => {
    const x = X(az), y = Y(el), gr = g.createRadialGradient(x, y, 0, x, y, r * 3); gr.addColorStop(0, c1); gr.addColorStop(.3, c2); gr.addColorStop(1, 'transparent');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r * 3, 0, 7); g.fill(); g.fillStyle = c1; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    g.fillStyle = '#e5e7eb'; g.font = `600 ${11 * dpr}px system-ui`; g.fillText(label, Math.min(x + r + 4 * dpr, W - 110 * dpr), y - r);
  };
  // Earth phase as seen from the Moon: lit fraction = (1 - cos θ)/2, θ = angle Sun–site–Earth
  const sv = sunVec(t), ev = earthVec(t), ex = ev[0] - s.pos[0], ey = ev[1] - s.pos[1], ez = ev[2] - s.pos[2];
  const cth = (sv[0] * ex + sv[1] * ey + sv[2] * ez) / Math.hypot(ex, ey, ez), lit = (1 - cth) / 2;
  // hit targets for hover/click (CSS pixels)
  cv._pts = sun.map(p => ({ x: X(p.saz) / dpr, y: Y(p.sel) / dpr, t: p.t, k: '☀️ Sun', el: p.sel, vis: p.sun > .5 })).concat(earth.map(p => ({ x: X(p.eaz) / dpr, y: Y(p.eel) / dpr, t: p.t, k: '🌍 Earth', el: p.eel, vis: !!p.earth })));
  disc(cur.eaz, cur.eel, 5 * dpr, '#bfdbfe', '#3b82f699', 'Earth ' + cur.eel.toFixed(1) + '°' + (cur.earth ? '' : ' (blocked)'));
  { // phase disc: dark Earth, lit part toward the Sun's side on screen
    const x = X(cur.eaz), y = Y(cur.eel), r = 5 * dpr, dir = Math.sign(((cur.saz - cur.eaz + 540) % 360) - 180) || 1;
    g.fillStyle = '#0b1a33'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    g.fillStyle = '#93c5fd'; g.beginPath(); g.arc(x, y, r, -Math.PI / 2, Math.PI / 2, dir < 0);
    g.ellipse(x, y, r * Math.abs(2 * lit - 1), r, 0, Math.PI / 2, -Math.PI / 2, (lit > .5) === (dir < 0)); g.fill();
    g.fillStyle = '#94a3b8'; g.font = `${10 * dpr}px system-ui`; g.fillText(`Earth phase: ${Math.round(lit * 100)}% lit`, Math.min(x + r + 4 * dpr, W - 110 * dpr), y + r + 12 * dpr);
  }
  disc(cur.saz, cur.sel, 6 * dpr, '#fffbeb', '#fbbf24aa', 'Sun ' + cur.sel.toFixed(2) + '°' + (cur.sun > .5 ? '' : ' (in shadow)'));
  // azimuth axis
  g.fillStyle = '#0b1220'; g.fillRect(0, H - 22 * dpr, W, 22 * dpr); g.fillStyle = '#94a3b8'; g.font = `${10 * dpr}px system-ui`;
  for (let a = 0; a < 360; a += 30) { g.fillRect(X(a), H - 22 * dpr, 1, 5 * dpr); g.fillText(a + '°', X(a) + 3 * dpr, H - 8 * dpr); if (DIRS[a] !== undefined) { g.fillStyle = '#cbd5e1'; g.fillText('▼ ' + DIRS[a], X(a) - 4 * dpr, 12 * dpr); g.fillStyle = '#94a3b8'; } }
  g.fillStyle = '#64748b'; g.fillText(`vert. ×${(((H - 22 * dpr) / (top - bot)) / (W / 360)).toFixed(1)}`, W - 70 * dpr, 12 * dpr);
}

export function drawStrip(cv, s, t, missionDays = 0) {
  const dpr = devicePixelRatio || 1, W = cv.clientWidth * dpr, H = 70 * dpr; cv.width = W; cv.height = H;
  const g = cv.getContext('2d'), { sun, earth } = series(s), L = 60 * 24;
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  for (let k = 0; k < L && t + k < D.T; k++) {
    const x = k / L * W, w = Math.ceil(W / L) + 1, sv = sun[t + k] / 250;
    g.fillStyle = `rgba(251,191,36,${sv})`; g.fillRect(x, 4 * dpr, w, 26 * dpr);
    g.fillStyle = earth[t + k] ? '#3b82f6' : '#000'; g.fillRect(x, 34 * dpr, w, 18 * dpr);
  }
  if (missionDays) { const w = missionDays / 60 * W; g.strokeStyle = '#34d399'; g.lineWidth = 2 * dpr; g.strokeRect(dpr, dpr, w - 2 * dpr, 52 * dpr); g.fillStyle = '#34d399'; g.font = `600 ${10 * dpr}px system-ui`; g.fillText(`your ${missionDays}-day mission`, 4 * dpr, 46 * dpr); }
  g.fillStyle = '#94a3b8'; g.font = `${10 * dpr}px system-ui`;
  for (let d = 0; d <= 60; d += 10) { const x = d / 60 * W; g.fillRect(x, 52 * dpr, 1, 4 * dpr); g.fillText(tDate(t + d * 24).toISOString().slice(5, 10), Math.min(x + 2 * dpr, W - 34 * dpr), 66 * dpr); }
}
