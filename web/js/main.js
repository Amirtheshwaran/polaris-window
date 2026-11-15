import { LOAD, SAFE_SLOPE, D, loadAll, allSites, addCustom, removeCustom, siteState, stats, findWindows, gridAverage, tIndex, tDate, fmtDate, fmtDay, pct, hrs, HOUR } from './data.js';
import * as SC from './scene.js';
import { drawPano, drawStrip } from './pano.js';

const $ = id => document.getElementById(id), $$ = q => [...document.querySelectorAll(q)];
const ST = { site: 'ridge', t: 0, tab: 'site', layer: 'light', mode: 'explore', cmp: ['ridge', 'a3_malapert_massif', 'a3_mons_mouton', 'a3_haworth'], playing: false, heat: null };
const ALIAS = { malapert: 'a3_malapert_massif', nobile: 'a3_nobile_rim_1', mouton: 'a3_mons_mouton', haworth: 'a3_haworth', degerlache: 'a3_de_gerlache_rim_2' };
const site = () => allSites().find(s => s.id === ST.site) || D.sites[0];
const COLORS = ['#fbbf24', '#60a5fa', '#34d399', '#f472b6'];
let cmpChart, cmpChart2, rafPending = false;

function toast(m) { const t = $('toast'); t.textContent = m; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => t.hidden = true, 2200); }

// ------------------------------------------------------------- URL state (shareable links)
function readHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  if (p.get('site')) ST.site = ALIAS[p.get('site')] || p.get('site');
  if (p.get('t')) ST.t = tIndex(Date.parse(p.get('t') + ':00:00Z'));
  for (const k of ['tab', 'layer', 'mode']) if (p.get(k)) ST[k] = p.get(k);
  if (p.get('cmp')) ST.cmp = p.get('cmp').split(',').map(id => ALIAS[id] || id);
  if (p.get('cx')) { const s = addCustom(+p.get('cx'), +p.get('cy'), p.get('cn') || 'Shared site', false); if (s) ST.site = s.id; }
  if (p.get('hm')) ST.heatReq = { metric: p.get('hm'), from: p.get('hf'), to: p.get('ht') };
}
function writeHash() {
  const s = site(), p = new URLSearchParams({ site: s.id, t: tDate(ST.t).toISOString().slice(0, 13), tab: ST.tab, mode: ST.mode, layer: ST.layer });
  if (s.custom) { p.set('cx', Math.round(s.x)); p.set('cy', Math.round(s.y)); p.set('cn', s.name); }
  if (ST.tab === 'compare') p.set('cmp', ST.cmp.join(','));
  if (ST.heat) { p.set('hm', ST.heat.metric); p.set('hf', ST.heat.from); p.set('ht', ST.heat.to); }
  history.replaceState(null, '', '#' + p.toString());
}

// ------------------------------------------------------------- render pieces
function renderSiteList() {
  const li = s => `<li data-id="${s.id}" class="${s.id === ST.site ? 'on' : ''}"><span>${s.name}<br><small>${s.lat.toFixed(2)}°, ${s.lon.toFixed(1)}°E</small></span>${s.custom ? '<span class="x" title="Remove">✕</span>' : ''}</li>`;
  const A = allSites().filter(s => s.artemis), O = allSites().filter(s => !s.artemis && !s.custom && !s.clps), K = allSites().filter(s => s.clps), C = allSites().filter(s => s.custom);
  $('siteList').innerHTML = `<li class="grp">🚀 NASA Artemis III candidate regions</li>${A.map(li).join('')}<li class="grp">🔬 Science sites</li>${O.map(li).join('')}<li class="grp">🛬 Real CLPS landings</li>${K.map(li).join('')}${C.length ? '<li class="grp">📍 Your sites</li>' + C.map(li).join('') : ''}`;
  SC.setMarkers(allSites(), ST.site, selectSite); SC.setRegions(allSites(), ST.site);
}
function selectSite(id, fly = true) {
  ST.site = id; renderSiteList(); const s = site(); if (fly) SC.flyTo(s, false); update(); renderTab();
}

function update() {
  if (rafPending) return; rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    const s = site(), st = siteState(s, ST.t), d = tDate(ST.t);
    $('time').value = ST.t; $('timeInput').value = d.toISOString().slice(0, 16);
    SC.setTime(ST.t);
    $('hudSite').textContent = s.name;
    $('hudSun').innerHTML = `${fmtDate(d)} · Sun ${st.sel.toFixed(2)}° ${st.sun > .5 ? '<b style="color:#fbbf24">sunlit</b>' : 'shadow'} · Earth ${st.eel.toFixed(1)}° ${st.earth ? '<b style="color:#60a5fa">in view</b>' : 'blocked'}` +
      (st.sel < 0 && st.sun > .5 ? '<br><span style="color:#fbbf24">The Sun is below a flat horizon, but this spot is higher than the land around it, so it can still see the Sun.</span>' : '');
    if (ST.tab === 'site') renderSiteTab();
    writeHash();
  });
}

function stat(v, l, cls = '') { return `<div class="stat ${cls}"><b>${v}</b><span>${l}</span></div>`; }
function renderSiteTab() {
  const s = site(), st = siteState(s, ST.t);
  $('siteName').textContent = s.name;
  $('siteMeta').innerHTML = `${s.note}<br>lat ${s.lat.toFixed(3)}°, lon ${s.lon.toFixed(2)}°E · elevation ${(s.elev / 1000).toFixed(2)} km · 🧍 Stand here in 3D, looking at the <a href="#" id="standBtn">☀️ Sun</a> or <a href="#" id="standEarth">🌍 Earth</a> · <a href="#" id="overBtn">overview</a> · <a target="_blank" rel="noopener" title="Open NASA/JPL Horizons and compare the Sun elevation with ours" href="${horizonsURL(s)}">✅ verify in JPL Horizons</a><br>See it in NASA tools (coordinates copied when you click): <a class="ext" target="_blank" rel="noopener" href="https://trek.nasa.gov/moon/">🌕 Moon Trek</a> · <a class="ext" target="_blank" rel="noopener" href="https://quickmap.lroc.asu.edu/">🛰 LROC QuickMap</a>`;
  $$('#siteMeta a.ext').forEach(a => a.onclick = () => { navigator.clipboard?.writeText(`${s.lat.toFixed(4)}, ${s.lon > 180 ? (s.lon - 360).toFixed(4) : s.lon.toFixed(4)}`); toast(`Copied ${s.name} coordinates: paste them into the search box`); });
  const stand = look => e => { e.preventDefault(); SC.setExag(1); $('exag').value = 1; $('exagV').textContent = 1; SC.flyTo(s, true, look); };
  $('standBtn').onclick = stand('sun'); $('standEarth').onclick = stand('earth');
  $('overBtn').onclick = e => { e.preventDefault(); SC.overview(); };
  drawPano($('pano'), s, ST.t); drawStrip($('siteStrip'), s, ST.t, ST.mission && ST.mission.t === ST.t && ST.mission.site === s.id ? ST.mission.days : 0);
  const m = stats(s, ST.t, Math.min(D.T, ST.t + 24 * 365));
  $('verdict').innerHTML = verdict(s, m, st);
  $('siteStats').innerHTML = stat('☀️ ' + pct(m.sun), 'of the time in sunlight (next 12 months)') + stat('🌍 ' + pct(m.earth), 'of the time Earth is in view (radio home)') + stat('🌑 ' + hrs(m.maxDark), 'longest night (no solar power)') +
    stat('📵 ' + hrs(m.maxBlk), 'longest time without Earth (comms blackout)') + stat(pct(m.both), 'sun AND Earth together', 'planner-only') + stat('⚡ ' + Math.round(m.powerW) + ' W', 'average power from a 10 m² solar panel', 'planner-only') +
    (s.validation ? stat(pct(s.validation.ours) + ' / ' + pct(s.validation.nasa), 'ours vs NASA map, 2009–13', 'planner-only') : '') +
    stat(st.sel.toFixed(2) + '° / ' + st.shz.toFixed(2) + '°', 'Sun elev. / terrain horizon now', 'planner-only') + stat(st.eel.toFixed(2) + '°', 'Earth elevation now', 'planner-only') +
    (s.slope != null ? stat('⛰️ ' + s.slope + '°', 'ground slope (landers need under about 8°)', 'planner-only') : '');
}

// ------------------------------------------------------------- window finder
function runWindows() {
  const c = { days: +$('wLen').value, minSun: +$('wSun').value, minEarth: +$('wEarth').value, maxDark: +$('wDark').value, maxBlack: +$('wBlack').value, from: Date.parse($('wFrom').value), to: Date.parse($('wTo').value) };
  const list = $('wSites').value === 'all' ? allSites() : [site()];
  const res = list.map(s => ({ s, r: findWindows(s, c) })).sort((a, b) => (b.r.picked[0]?.score || 0) - (a.r.picked[0]?.score || 0));
  const best = res.find(x => x.r.picked.length);
  let h = best ? (() => { const w = best.r.picked[0], d = tDate(w.a);
    return `<div class="winner">🏆 Best choice<big>${best.s.name}, land on ${d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}</big>
    During the ${c.days}-day mission the Sun shines ${pct(w.sun)} of the time and Earth is in view ${pct(w.earth)} of the time. The longest night is only ${hrs(w.maxDark)}.
    <br><a href="#" id="goBest">🧍 Stand there on that date →</a></div><p class="hint">Click any row below to jump to that date.</p>`; })() : '<p class="bad">No landing time meets every rule. Try a shorter mission or a different preset.</p>';
  res.forEach(({ s, r }, i) => {
    h += `<div class="winSite"><span>${i + 1}. ${s.name}</span><span class="badge">${r.feasible} of ${r.total} start times feasible</span></div><canvas class="calStrip" data-i="${i}"></canvas>`;
    if (r.picked.length) h += `<table><tr><th>Landing (UTC)</th><th>Sun</th><th>Earth</th><th>Max dark</th><th>Max blackout</th><th>Score</th></tr>` +
      r.picked.map(w => `<tr class="click" data-site="${s.id}" data-t="${w.a}"><td>${fmtDate(tDate(w.a)).slice(0, 16)}</td><td>${pct(w.sun)}</td><td>${pct(w.earth)}</td><td>${hrs(w.maxDark)}</td><td>${hrs(w.maxBlk)}</td><td><b>${w.score.toFixed(0)}</b></td></tr>`).join('') + '</table>';
  });
  h += `<p class="hint">Score = 55% sunlight + 30% Earth visibility + 15% (1 − longest darkness / mission). Start times evaluated every 6 h. Strip: feasibility over the search range (brighter = better).</p>`;
  $('wOut').innerHTML = h;
  $$('#wOut canvas').forEach(cv => {
    const r = res[+cv.dataset.i].r, dpr = devicePixelRatio, W = cv.width = cv.clientWidth * dpr, H = cv.height = 22 * dpr, g = cv.getContext('2d');
    g.fillStyle = '#1f0a0a'; g.fillRect(0, 0, W, H);
    r.curve.forEach((v, k) => { if (v > 0) { g.fillStyle = `hsl(${40 + v}, 90%, ${25 + v * .4}%)`; g.fillRect(k / r.curve.length * W, 0, Math.ceil(W / r.curve.length) + 1, H); } });
    g.fillStyle = '#fff'; r.picked.forEach(w => g.fillRect((w.a - r.a0) / r.step / r.curve.length * W - dpr, 0, 2 * dpr, H));
  });
  const go = (sid, t) => { ST.t = t; ST.mission = { site: sid, t, days: c.days }; switchTab('site'); selectSite(sid); };
  $$('#wOut tr.click').forEach(tr => tr.onclick = () => go(tr.dataset.site, +tr.dataset.t));
  if (best) $('goBest').onclick = e => { e.preventDefault(); go(best.s.id, best.r.picked[0].a); };
}

// ------------------------------------------------------------- compare
function renderCompare() {
  $('cmpPick').innerHTML = allSites().map(s => `<label><input type="checkbox" value="${s.id}" ${ST.cmp.includes(s.id) ? 'checked' : ''}>${s.name}</label>`).join('');
  $$('#cmpPick input').forEach(i => i.onchange = () => {
    const v = $$('#cmpPick input:checked').map(x => x.value);
    if (v.length > 4) { i.checked = false; toast('Pick up to 4 sites'); return; }
    ST.cmp = v; renderCompare();
  });
  const a = tIndex(Date.parse($('cFrom').value)), b = tIndex(Date.parse($('cTo').value) + 24 * HOUR);
  const S = ST.cmp.map(id => allSites().find(s => s.id === id)).filter(Boolean);
  const M = S.map(s => stats(s, a, b));
  const best = (k, hi = true) => { const v = M.map(m => m[k]); return hi ? Math.max(...v) : Math.min(...v); };
  const row = (lbl, k, f, hi = true) => `<tr><td>${lbl}</td>${M.map(m => `<td class="${m[k] === best(k, hi) && S.length > 1 ? 'good' : ''}">${f(m[k])}</td>`).join('')}</tr>`;
  $('cmpTable').innerHTML = `<table><tr><th></th>${S.map((s, i) => `<th style="color:${COLORS[i]}">${s.name}</th>`).join('')}</tr>` +
    row('Sunlight', 'sun', pct) + row('Earth visible', 'earth', pct) + row('Sun + Earth', 'both', pct) + row('Longest darkness', 'maxDark', hrs, false) +
    row('Longest blackout', 'maxBlk', hrs, false) + row('Avg power (10 m²)', 'powerW', v => Math.round(v) + ' W') + row('Energy', 'energyKWh', v => (v / 1000).toFixed(1) + ' MWh') + '</table>';
  // monthly series
  const labels = [], step = 24 * 29.53;
  for (let t = a; t + step <= b + 1; t += step) labels.push(fmtDay(tDate(t)).slice(0, 7));
  const ds = (k, f) => S.map((s, i) => ({ label: s.name, borderColor: COLORS[i], backgroundColor: COLORS[i] + '55', tension: .25, pointRadius: 2,
    data: labels.map((_, j) => f(stats(s, Math.round(a + j * step), Math.round(a + (j + 1) * step)))) }));
  const opts = (title, ymax) => ({ responsive: true, animation: false, plugins: { title: { display: true, text: title, color: '#e5e7eb' }, legend: { labels: { color: '#cbd5e1', boxWidth: 10 } } },
    scales: { x: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } }, y: { min: 0, max: ymax, ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } } } });
  if (!window.Chart) return;
  cmpChart?.destroy(); cmpChart2?.destroy();
  cmpChart = new Chart($('cmpChart'), { type: 'line', data: { labels, datasets: ds('sun', m => +(m.sun * 100).toFixed(1)) }, options: opts('Sunlight % per lunation', 100) });
  cmpChart2 = new Chart($('cmpChart2'), { type: 'bar', data: { labels, datasets: ds('blk', m => +(m.maxBlk / 24).toFixed(1)) }, options: opts('Longest comms blackout per lunation (days)') });
}

// ------------------------------------------------------------- heatmap
async function runHeat(req) {
  const metric = req?.metric || $('hMetric').value, from = req?.from || $('hFrom').value, to = req?.to || $('hTo').value;
  $('hMetric').value = metric; $('hFrom').value = from; $('hTo').value = to;
  const a = tIndex(Date.parse(from)), b = tIndex(Date.parse(to) + 24 * HOUR);
  if (b <= a) return toast('End date must be after start');
  $('hRun').disabled = true;
  const out = {};
  for (const name of ['core', 'regional']) {
    out[name] = await gridAverage(D.grids[name], a, b, metric, p => $('hOut').textContent = `Computing ${name} grid… ${(p * 100).toFixed(0)}%`);
  }
  let vmax = 1; if (metric === 'both' || metric === 'land') { vmax = .05; for (const v of out.core) vmax = Math.max(vmax, v); for (const v of out.regional) vmax = Math.max(vmax, v); }
  ST.heatMax = vmax; for (const name in out) SC.setHeat(name, out[name], vmax);
  $('hRun').disabled = false;
  ST.heat = { metric, from, to }; setLayer('heat');
  const c = out.core; let best = 0, bi = 0; for (let i = 0; i < c.length; i++) if (c[i] > best) { best = c[i]; bi = i; }
  const label = HEATL[metric];
  let psr = 0; if (metric === 'sun') for (const v of c) psr += v === 0;
  if (metric === 'slope') { let safe = 0; for (const v of D.grids.core.slope) safe += v <= SAFE_SLOPE; $('hOut').innerHTML = `Bright = flat and safe, dark = steep (over 20°). ${(safe / c.length * 100).toFixed(0)}% of the central 80 km is flatter than ${SAFE_SLOPE}°, a typical lander limit. Slopes from LOLA at an 80 m baseline.`; writeHash(); return; }
  $('hOut').innerHTML = `${label}, ${from} → ${to}. Best cell in the central 80 km: <b>${pct(best)}</b>.` + (metric === 'land' ? ` Only ground flatter than ${SAFE_SLOPE}° counts.` : '') + (metric === 'sun' ? ` ${(psr / c.length * 100).toFixed(1)}% of the central area got no sunlight at all in this period.` : '') +
    ` <a href="#" id="heatBest">Drop a site at the best cell</a>`;
  $('heatBest').onclick = e => { e.preventDefault(); const n = D.grids.core.n, h = D.grids.core.half, i = Math.floor(bi / n), j = bi % n; pick((j + .5) / n * 2 * h - h, h - (i + .5) / n * 2 * h, 'Best ' + label); };
  writeHash();
}
function setLayer(l) {
  ST.layer = l; SC.setMode(l); $$('#layerSeg button').forEach(b => b.classList.toggle('on', b.dataset.layer === l));
  const g = 'linear-gradient(90deg,#000004,#280b54,#65156e,#9f2a63,#d44842,#f57d15,#fac127,#fcffa4)';
  $('legend').innerHTML = l === 'heat' && ST.heat ? (ST.heat.metric === 'slope' ? `<div>Ground slope</div><div class="bar" style="background:${g}"></div><div class="ends"><span>20°+ steep</span><span>10°</span><span>0° flat</span></div>` : `<div>${HEATL[ST.heat.metric]} %</div><div class="bar" style="background:${g}"></div><div class="ends"><span>0%</span><span>${pct((ST.heatMax || 1) / 2).replace('.0%', '%')}</span><span>${pct(ST.heatMax || 1).replace('.0%', '%')}</span></div>`) :
    l === 'heat' ? '<div>Run a heatmap from the Heatmap tab.</div>' : '<div>Terrain lit by the real Sun position (shadows from LOLA horizons). Gold/blue glows: Sun and Earth.</div>';
  update();
}

// ------------------------------------------------------------- validation / about
function renderValid() {
  const v = D.meta.validation, c = v.grids.core, r = v.grids.regional, hz = v.horizons;
  $('validOut').innerHTML = `<p class="meta">We recomputed NASA's published average-illumination map (${v.source}) for the same period (${v.period}) and the same criterion (any part of the solar disc visible), using only our own pipeline.</p>
  <div class="stats">${stat(c.r.toFixed(3), 'correlation with NASA map (central 80 km, 312 m cells)')}${stat((c.mae * 100).toFixed(1) + ' pts', 'mean absolute error')}${stat((c.within10 * 100).toFixed(1) + '%', 'cells within 10 pts of NASA')}
  ${stat(r.r.toFixed(3), 'correlation, full 384 km region')}${stat((r.mae * 100).toFixed(1) + ' pts', 'mean abs. error, full region')}${hz ? stat(hz.max_abs_diff_deg.toFixed(4) + '°', 'max Sun/Earth elevation diff vs JPL Horizons') : ''}</div>
  <img class="valimg" src="data/validation_core.png" alt="Side by side: NASA illumination map and Polaris Window model, plus scatter plot">
  <h3>Sites vs NASA map (nearest 120 m pixel)</h3>
  <table><tr><th>Site</th><th>Ours</th><th>NASA</th><th>NASA best ≤120 m</th></tr>${D.sites.map(s => `<tr><td>${s.name}</td><td>${pct(s.validation.ours)}</td><td>${pct(s.validation.nasa)}</td><td>${pct(s.validation.nasa_best120m)}</td></tr>`).join('')}</table>
  <p class="hint">Our sites sit on hand-picked 80 m peak pixels at a 2 m mast height; NASA's map is 120 m at ground level, which explains the small positive bias on ridge tops.</p>
  ${hz ? `<h3>Ephemeris vs JPL Horizons (${hz.site})</h3><table><tr><th>Body</th><th>UTC</th><th>Horizons</th><th>Ours</th><th>Δ</th></tr>${hz.rows.map(r => `<tr><td>${r.body}</td><td>${r.utc}</td><td>${r.horizons.toFixed(4)}°</td><td>${r.ours.toFixed(4)}°</td><td>${r.diff.toFixed(4)}°</td></tr>`).join('')}</table>` : ''}`;
}
function renderAbout() {
  $('aboutOut').innerHTML = `<p>Polaris Window answers the mission planner's real question: <b>when and where should we land?</b> It combines real NASA terrain and ephemeris into four tools: a live 3D south pole, a stand-at-site horizon panorama, an automatic landing-window finder, and side-by-side site comparison with heatmaps.</p>
  <h3>How it works</h3><ol class="meta"><li>LOLA LDEM_80S_80M (80 m/pixel) is ray-marched in 120–720 directions out to 220 km, including lunar curvature, to get each point's terrain horizon.</li>
  <li>NAIF SPICE (DE440 + lunar MOON_ME frame) gives hourly Sun and Earth vectors for 2025–2030.</li>
  <li>The browser compares Sun/Earth elevation with the terrain horizon at their azimuth, for any site and any date, with no server.</li>
  <li>Results are checked against NASA PGDA illumination maps and JPL Horizons (Validation tab).</li></ol>
  <h3>Assumptions</h3><p class="meta">Observer 2 m above ground. Sunlight counts partial solar disc. Earth "visible" = Earth's center above the terrain horizon (direct-to-Earth line of sight). Power: 10 m² vertical sun-tracking array, 30% efficiency. Region pins are our model's best spots, not NASA-designated landing points.</p>
  <h3>Case study: IM-2 Athena (CLPS, March 2025)</h3><p class="meta">At Athena's reported landing location our model gives 100% sunlight and Earth visibility for its planned 10-day mission, on a 2.6° slope, so the site and date were sound. Its long-term sunlight (46.8%) matches NASA's map (46.8%). The lander was lost to a small crater and a tip-over, below the 80 m resolution used here. That shows where high-resolution hazard mapping comes next.</p>
  <h3>Landing regions</h3><p class="meta">The nine NASA Artemis III candidate regions (announced October 2024) use the official USGS footprints (McClernan 2024, doi:10.5066/P1MEQ6UK). Mons Mouton Plateau uses an approximate 15 km box. Each pin is our best spot inside the region: the most sunlight and Earth visibility on ground flatter than 8°.</p>
  <h3>Data</h3><p class="meta">NASA LRO LOLA (PDS Geosciences Node) · NASA/JPL NAIF SPICE · NASA PGDA Lunar Polar Illumination (Mazarico et al. 2011) · JPL Horizons. Built with Three.js, Chart.js, Python, NumPy, Numba, SpiceyPy.</p>`;
}

const HEATL = { sun: 'Sunlight', earth: 'Earth visibility', both: 'Sun AND Earth', slope: 'Flat ground', land: 'Best landing spots' };
const stars = (v, icon) => icon.repeat(Math.round(v * 5)) + '<span style="opacity:.25">' + icon.repeat(5 - Math.round(v * 5)) + '</span>';
function verdict(s, m, st) {
  const pw = m.sun > .75 ? 'excellent for solar power' : m.sun > .55 ? 'good for solar power' : m.sun > .2 ? 'often dark, so it needs big batteries' : 'almost always dark, a cold trap where ice can hide';
  const cm = m.earth > .75 ? 'Earth is almost always in view' : m.earth > .45 ? 'Earth is in view about half the time' : m.earth > 0.05 ? 'Earth is often hidden behind mountains' : 'Earth is never in view, so it needs a relay satellite';
  const sl = s.slope == null ? '' : s.slope <= SAFE_SLOPE ? ` The ground is flat enough to land (${s.slope}° slope).` : ` The ground is steep (${s.slope}°), which is risky for a lander.`;
  const kwh = Math.round(m.maxDark * 1), cars = Math.max(1, Math.round(kwh / 60));
  const bat = m.maxDark > 0 && m.sun > .05 ? ` To keep a 1 kW base running through the longest night (${hrs(m.maxDark)}) you need about ${kwh.toLocaleString()} kWh of batteries, roughly ${cars} electric-car batter${cars === 1 ? 'y' : 'ies'}.` : '';
  const story = s.story ? `<div class="story">📖 <b>True story:</b> ${s.story} <a href="#" onclick="PW.goLanding('${s.id}');return false">⏱ Go to the landing moment</a></div>` : '';
  return `${story}<b>${s.name}</b> is ${pw}, and ${cm}.${sl}${bat}<div class="rate"><span title="Sunlight">☀️ Power ${stars(m.sun, '★')}</span><span title="Earth visibility">📡 Talk to Earth ${stars(m.earth, '★')}</span></div>
  <div class="meta" style="margin:6px 0 0">Right now: the Sun is ${st.sun > .5 ? '<b style="color:#fbbf24">shining here</b>' : 'hidden'} and Earth is ${st.earth ? '<b style="color:#60a5fa">in view</b>' : 'hidden'}.</div>`;
}
function horizonsURL(s) {
  const d = tDate(ST.t).toISOString().slice(0, 16).replace('T', ' '), e = tDate(ST.t + 1).toISOString().slice(0, 16).replace('T', ' ');
  const q = { format: 'text', COMMAND: "'10'", CENTER: "'coord@301'", COORD_TYPE: "'GEODETIC'", SITE_COORD: `'${s.lon.toFixed(4)},${s.lat.toFixed(4)},${(s.elev / 1000).toFixed(3)}'`,
    MAKE_EPHEM: "'YES'", EPHEM_TYPE: "'OBSERVER'", START_TIME: `'${d}'`, STOP_TIME: `'${e}'`, STEP_SIZE: "'1 h'", QUANTITIES: "'4'", ANG_FORMAT: "'DEG'" };
  return 'https://ssd.jpl.nasa.gov/api/horizons.api?' + Object.entries(q).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
}
const PRESETS = { bal: [60, 50, 72, 96], power: [80, 0, 48, 2000], comms: [40, 80, 240, 48] };
function preset(p) { $$('#wPreset button').forEach(b => b.classList.toggle('on', b.dataset.p === p)); ['wSun', 'wEarth', 'wDark', 'wBlack'].forEach((id, i) => $(id).value = PRESETS[p][i]); }

// ------------------------------------------------------------- tabs, modes, tour
function switchTab(t) { ST.tab = t; $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t)); $$('.tab').forEach(d => d.classList.toggle('on', d.id === 'tab-' + t)); renderTab(); writeHash(); }
function renderTab() { ({ site: renderSiteTab, compare: renderCompare, valid: renderValid, about: renderAbout })[ST.tab]?.(); }
function setMode(m) { ST.mode = m; document.body.className = m; $$('#modes button').forEach(b => b.classList.toggle('on', b.dataset.mode === m)); writeHash(); }

const TOUR = [
  ['This is the real lunar south pole, built from NASA LRO laser altimetry. Here the Sun never climbs more than about 1.6° above the horizon, so every hill and crater rim decides who gets power.', () => { SC.overview(); setLayer('light'); play(true); }],
  ['Watch the shadows sweep as the Sun circles the horizon once a month. Crater floors like Shackleton stay dark for billions of years: that is where the water ice is.', () => { selectSite('shackleton'); }],
  ['The green boxes are NASA\'s nine Artemis III candidate landing regions, using official USGS boundaries. Inside each one, we found the flat spot with the most sunlight and Earth contact.', () => { play(false); SC.overview(); }],
  ['The Connecting Ridge sits in sunlight about 90% of the time. Planners want this: near-continuous solar power next to the ice.', () => { play(false); switchTab('site'); selectSite('ridge'); }],
  ['Stand at the site: the panorama shows the real horizon, the Sun path (gold) and Earth path (blue) for the next month. When Earth dips behind the terrain, direct-to-Earth comms go dark.', () => { const s = site(); SC.setExag(1); SC.flyTo(s, true); }],
  ['Heatmap mode colors the whole region by how often it is sunlit over any date range.', () => { switchTab('heat'); runHeat({ metric: 'sun', from: '2027-01-01', to: '2027-12-31' }); SC.setExag(3); SC.overview(); }],
  ['Compare sites side by side: sunlight, Earth visibility and the longest blackout, month by month.', () => switchTab('compare')],
  ['Planner mode: give it a mission length and power/comms limits, and the window finder ranks every possible landing date.', () => { setMode('planner'); switchTab('windows'); runWindows(); }],
  ['A true story: in March 2025 the CLPS lander Athena picked a great spot here, with 100% sun and Earth for 10 days. But it landed in a small crater, tipped over and ran out of power. Picking the place and date is step one, and the next step is mapping small hazards.', () => { setMode('explore'); switchTab('site'); PW.goLanding('clps_im2'); }],
  ['Every number is checked against NASA: our illumination model matches NASA\'s published map with r ≈ 0.99, and our ephemeris matches JPL Horizons to 0.001°.', () => switchTab('valid')],
];
let tourI = 0;
function tour(i) { tourI = Math.max(0, Math.min(TOUR.length - 1, i)); $('tourBox').hidden = false; $('tourText').textContent = TOUR[tourI][0]; $('tourStep').textContent = `${tourI + 1} / ${TOUR.length}`; $('tourNext').textContent = tourI === TOUR.length - 1 ? 'Done' : 'Next ›'; TOUR[tourI][1](); }

let playH;
function play(on) {
  ST.playing = on ?? !ST.playing; $('play').textContent = ST.playing ? '❚❚' : '▶'; clearInterval(playH);
  if (ST.playing) playH = setInterval(() => { ST.t = (ST.t + +$('speed').value) % D.T; update(); }, 50);
}
function pick(x, y, name) {
  const s = addCustom(x, y, name);
  if (!s) return toast('Outside the analysis region');
  toast(`Added ${s.name} at ${s.lat.toFixed(3)}°, ${s.lon.toFixed(1)}°E`); switchTab('site'); selectSite(s.id, false);
}

// ------------------------------------------------------------- 30-second demo (open #demo=1, then screen-record)
function demo() {
  const cap = (html, title) => { const c = $('caption'); c.innerHTML = html; c.className = title ? 'title' : ''; c.hidden = !html; };
  const steps = [
    [0, () => { setMode('explore'); setLayer('light'); SC.overview(); SC.autoRotate(true); $('speed').value = 12; play(true); cap('Hi, we are team Polaris Window.'); }],
    [2000, () => cap('Landing at the Moon\'s south pole means fighting for sunlight and a line of sight to Earth.')],
    [5000, () => cap('Polaris Window<small>Know exactly when and where to land</small>', true)],
    [8500, () => { SC.autoRotate(false); play(false); ST.t = tIndex(Date.parse('2027-03-01T00:00Z')); switchTab('site'); selectSite('ridge'); cap('Built on NASA LOLA terrain and JPL ephemeris: stand at any site and watch the Sun and Earth cross the real horizon.'); }],
    [11000, () => { SC.setExag(1); SC.flyTo(site(), true); $('speed').value = 1; play(true); }],
    [14000, () => { play(false); switchTab('windows'); runWindows(); cap('Enter your mission length and power and comms limits, and it ranks the best landing dates.'); }],
    [19000, () => { SC.setExag(3); switchTab('heat'); SC.overview(); SC.autoRotate(true, 1.2); runHeat({ metric: 'land', from: '2027-01-01', to: '2027-12-31' }); cap('Map sunlight, Earth contact and safe flat ground across the whole region…'); }],
    [23000, () => { switchTab('valid'); cap('…and every result is checked against NASA\'s own illumination maps and JPL Horizons.'); }],
    [26000, () => { setLayer('light'); $('speed').value = 12; play(true); cap('From mission planners to classrooms: pick your window to the Moon.'); }],
    [30000, () => { play(false); SC.autoRotate(false); cap('Polaris Window<small>amirtheshwaran.github.io/polaris-window</small>', true); }],
  ];
  const t0 = performance.now();
  for (const [ms, fn] of steps) setTimeout(fn, ms);
  return t0;
}

// ------------------------------------------------------------- boot
(async function () {
  const gl = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl');
  if (!gl) { $('loadMsg').innerHTML = 'Polaris Window needs WebGL (3D graphics). Please open it in an up-to-date Chrome, Edge, Firefox or Safari, with hardware acceleration turned on.'; document.querySelector('.spin').style.display = 'none'; return; }
  const hadHash = location.hash.length > 1, isDemo = /demo=1/.test(location.hash);
  LOAD.onprog = () => { $('pfill').style.width = Math.min(100, LOAD.got / LOAD.total * 100) + '%'; $('loadMsg').textContent = `Loading real NASA Moon terrain… ${(LOAD.got / 1e6).toFixed(1)} MB`; };
  try { await loadAll(); } catch (e) { $('loadMsg').textContent = 'Could not load data: ' + e.message + '. Please refresh.'; return; }
  ST.t = tIndex(Date.now());
  readHash();
  $('time').max = D.T - 1; $('time').value = ST.t;
  SC.initScene($('view3d'), (x, y) => pick(x, y));
  setMode(ST.mode); renderSiteList(); switchTab(ST.tab); setLayer('light');
  if (ST.heatReq) runHeat(ST.heatReq);
  SC.flyTo(site(), false);
  $('loading').remove();
  $('time').oninput = e => { ST.t = +e.target.value; update(); };
  $('timeInput').onchange = e => { ST.t = tIndex(Date.parse(e.target.value + 'Z')); update(); };
  $('play').onclick = () => play();
  $('trust').onclick = e => { e.preventDefault(); switchTab('valid'); };
  $('csvBtn').onclick = () => {
    const s = site(), a = ST.t, b = Math.min(D.T, a + 24 * 365), rows = ['utc,sun_az_deg,sun_el_deg,sun_horizon_deg,sun_disc_visible_frac,earth_az_deg,earth_el_deg,earth_horizon_deg,earth_visible'];
    for (let t = a; t < b; t++) { const q = siteState(s, t); rows.push([tDate(t).toISOString().slice(0, 16) + 'Z', q.saz.toFixed(3), q.sel.toFixed(4), q.shz.toFixed(3), q.sun.toFixed(3), q.eaz.toFixed(3), q.eel.toFixed(4), q.ehz.toFixed(3), q.earth].join(',')); }
    const head = `# Polaris Window export: ${s.name} lat ${s.lat} lon ${s.lon}E elev ${s.elev} m (LOLA), observer +2 m. Azimuth: map-plane, 0 deg = toward lon 0. Frame MOON_ME, ephemeris NAIF DE440.\n`;
    const url = URL.createObjectURL(new Blob([head + rows.join('\n')], { type: 'text/csv' }));
    const A = document.createElement('a'); A.href = url; A.download = `polaris-window_${s.id}_${fmtDay(tDate(a))}.csv`; A.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  $('exag').oninput = e => { $('exagV').textContent = e.target.value; SC.setExag(+e.target.value); renderSiteList(); };
  $('siteList').onclick = e => { const li = e.target.closest('li'); if (!li || !li.dataset.id) return; const s = allSites().find(x => x.id === li.dataset.id);
    if (e.target.classList.contains('x')) { removeCustom(s); if (ST.site === s.id) ST.site = 'ridge'; renderSiteList(); update(); return; } selectSite(s.id); };
  $$('#tabs button').forEach(b => b.onclick = () => switchTab(b.dataset.tab));
  $$('#modes button').forEach(b => b.onclick = () => setMode(b.dataset.mode));
  $$('#layerSeg button').forEach(b => b.onclick = () => b.dataset.layer === 'heat' && !ST.heat ? (switchTab('heat'), runHeat()) : setLayer(b.dataset.layer));
  $('wRun').onclick = runWindows; $('hRun').onclick = () => runHeat();
  ['cFrom', 'cTo'].forEach(id => $(id).onchange = renderCompare);
  $('shareBtn').onclick = () => { writeHash(); navigator.clipboard?.writeText(location.href).then(() => toast('Link copied: anyone opening it sees this exact view'), () => prompt('Copy this link', location.href)); };
  $('tourBtn').onclick = () => tour(0); $('tourNext').onclick = () => tourI === TOUR.length - 1 ? ($('tourBox').hidden = true) : tour(tourI + 1);
  $('tourPrev').onclick = () => tour(tourI - 1); $('tourEnd').onclick = () => { $('tourBox').hidden = true; play(false); };
  addEventListener('resize', () => ST.tab === 'site' && renderSiteTab());
  $$('#wPreset button').forEach(b => b.onclick = () => { preset(b.dataset.p); if ($('wOut').innerHTML) runWindows(); });
  if (!hadHash) $('welcome').hidden = false;
  if (isDemo) setTimeout(demo, 800);
  $$('#welcome button').forEach(b => b.onclick = () => { $('welcome').hidden = true; const w = b.dataset.w;
    if (w === 'tour') tour(0); else if (w === 'date') { switchTab('windows'); runWindows(); } else { switchTab('site'); selectSite('ridge'); } });
  window.PW = { ST, D, tour, runWindows, runHeat, selectSite, switchTab, demo, goLanding: id => { const s = allSites().find(x => x.id === id); ST.t = tIndex(Date.parse(s.landed)); ST.mission = { site: id, t: ST.t, days: 10 }; selectSite(id); } }; // console / demo-recording hooks
})();
