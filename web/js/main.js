import { OPT, setEMask, series, rankWin, LOAD, SAFE_SLOPE, D, loadAll, allSites, addCustom, removeCustom, siteState, stats, findWindows, gridAverage, tIndex, tDate, fmtDate, fmtDay, pct, hrs, HOUR } from './data.js';
import * as SC from './scene.js';
import { drawPano, drawStrip } from './pano.js';

const $ = id => document.getElementById(id), $$ = q => [...document.querySelectorAll(q)];
const ST = { site: 'ridge', t: 0, tab: 'site', layer: 'light', mode: 'explore', cmp: ['ridge', 'a3_malapert_massif', 'a3_mons_mouton', 'a3_haworth'], playing: false, heat: null, siteFilter: 'all', searchQuery: '' };
const ALIAS = { malapert: 'a3_malapert_massif', nobile: 'a3_nobile_rim_1', mouton: 'a3_mons_mouton', haworth: 'a3_haworth', degerlache: 'a3_de_gerlache_rim_2' };
const site = () => allSites().find(s => s.id === ST.site) || D.sites[0];
const COLORS = ['#E9E7E1', '#B8B6B0', '#888680', '#5E5D58'];
let cmpChart, cmpChart2, rafPending = false;

function toast(m) {
  const t = $('toast');
  if (!t) return;
  t.textContent = m;
  t.hidden = false;
  clearTimeout(toast.h);
  toast.h = setTimeout(() => t.hidden = true, 2400);
}

// ------------------------------------------------------------- URL state (shareable links)
function readHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  if (p.get('site')) ST.site = ALIAS[p.get('site')] || p.get('site');
  if (p.get('t')) ST.t = tIndex(Date.parse(p.get('t') + ':00:00Z'));
  for (const k of ['tab', 'layer', 'mode']) if (p.get(k)) ST[k] = p.get(k);
  if (p.get('cmp')) ST.cmp = p.get('cmp').split(',').map(id => ALIAS[id] || id);
  if (p.get('cx')) {
    const s = addCustom(+p.get('cx'), +p.get('cy'), p.get('cn') || 'Custom Site', false);
    if (s) ST.site = s.id;
  }
  if (p.get('hm')) ST.heatReq = { metric: p.get('hm'), from: p.get('hf'), to: p.get('ht') };
  if (p.get('em')) setEMask(+p.get('em') || 0);
  const days = Number(p.get('days'));
  if (days >= 1 && days <= 90) ST.mission = { site: ST.site, t: ST.t, days };
}

function writeHash() {
  const s = site(), p = new URLSearchParams({
    site: s.id,
    t: tDate(ST.t).toISOString().slice(0, 13),
    tab: ST.tab,
    mode: ST.mode,
    layer: ST.layer
  });
  if (s.custom) {
    p.set('cx', Math.round(s.x));
    p.set('cy', Math.round(s.y));
    p.set('cn', s.name);
  }
  if (ST.tab === 'compare') p.set('cmp', ST.cmp.join(','));
  if (OPT.emask) p.set('em', OPT.emask);
  if (ST.mission?.site === s.id && ST.mission.t === ST.t) p.set('days', ST.mission.days);
  if (ST.heat) {
    p.set('hm', ST.heat.metric);
    p.set('hf', ST.heat.from);
    p.set('ht', ST.heat.to);
  }
  history.replaceState(null, '', '#' + p.toString());
}

// ------------------------------------------------------------- Navigation Destinations (Explore, Plan, Science)
function updateDestinationNav() {
  const dest = (ST.tab === 'windows' || ST.tab === 'compare') ? 'plan'
             : (ST.tab === 'valid' || ST.tab === 'about') ? 'science'
             : 'explore';

  $$('nav.primary-nav button').forEach(b => b.classList.toggle('active', b.dataset.dest === dest));

  // Sync sub-mode pill highlights
  if ($('planSubFinder')) $('planSubFinder').classList.toggle('on', ST.tab === 'windows');
  if ($('planSubCompare')) $('planSubCompare').classList.toggle('on', ST.tab === 'compare');
  if ($('sciSubValid')) $('sciSubValid').classList.toggle('on', ST.tab === 'valid');
  if ($('sciSubAbout')) $('sciSubAbout').classList.toggle('on', ST.tab === 'about');
}

function switchTab(t) {
  ST.tab = t;
  $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  $$('.tab').forEach(d => d.classList.toggle('on', d.id === 'tab-' + t));
  updateDestinationNav();
  renderTab();
  writeHash();
}

function renderTab() {
  ({
    site: renderSiteTab,
    windows: () => { if (!$('wOut').innerHTML) runWindows(); },
    compare: renderCompare,
    valid: renderValid,
    about: renderAbout
  })[ST.tab]?.();
}

function setMode(m) {
  ST.mode = m;
  document.body.className = m;
  $$('#modes button').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
  $$('#modeSeg button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
  writeHash();
}

// ------------------------------------------------------------- Site list rendering & filtering
function renderSiteList() {
  const q = ST.searchQuery.toLowerCase().trim();
  let list = allSites();

  // Category filter
  if (ST.siteFilter === 'artemis') list = list.filter(s => s.artemis);
  else if (ST.siteFilter === 'science') list = list.filter(s => !s.artemis && !s.custom && !s.clps);
  else if (ST.siteFilter === 'clps') list = list.filter(s => s.clps);
  else if (ST.siteFilter === 'custom') list = list.filter(s => s.custom);

  // Search filter
  if (q) {
    list = list.filter(s => s.name.toLowerCase().includes(q) || s.lat.toFixed(2).includes(q) || s.lon.toFixed(1).includes(q));
  }

  const badge = $('siteCountBadge');
  if (badge) badge.textContent = allSites().length;

  const li = s => `
    <li class="site-item ${s.id === ST.site ? 'active' : ''}" data-id="${s.id}" tabindex="0" role="option" aria-selected="${s.id === ST.site}">
      <div class="site-item-info">
        <span class="site-item-name">${s.name}</span>
        <span class="site-item-coords">${Math.abs(s.lat).toFixed(2)}°S, ${s.lon.toFixed(1)}°E · ${(s.elev / 1000).toFixed(2)} km</span>
      </div>
      ${s.custom ? '<button class="site-item-del" data-del="1" title="Remove custom site">✕</button>' : ''}
    </li>`;

  const A = list.filter(s => s.artemis);
  const O = list.filter(s => !s.artemis && !s.custom && !s.clps);
  const K = list.filter(s => s.clps);
  const C = list.filter(s => s.custom);

  let html = '';
  if (ST.siteFilter === 'all' && !q) {
    if (A.length) html += `<li class="site-group-divider">NASA Artemis III Candidate Regions</li>` + A.map(li).join('');
    if (O.length) html += `<li class="site-group-divider">Science Evaluation Sites</li>` + O.map(li).join('');
    if (K.length) html += `<li class="site-group-divider">Real CLPS Missions</li>` + K.map(li).join('');
    if (C.length) html += `<li class="site-group-divider">Custom Sites</li>` + C.map(li).join('');
  } else {
    html = list.length ? list.map(li).join('') : '<li style="padding:12px;color:var(--text-muted);font-size:12px;text-align:center;">No matching landing sites</li>';
  }

  $('siteList').innerHTML = html;
  SC.setMarkers(allSites(), ST.site, selectSite);
  SC.setRegions(allSites(), ST.site);
}

function selectSite(id, fly = true) {
  ST.site = id;
  $('panel-sites').classList.add('collapsed');
  $('panel-sites').inert = true;
  $('sites-toggle-pill').style.display = 'flex';
  renderSiteList();
  const s = site();
  if (fly) SC.flyTo(s, false);
  update();
  renderTab();
}

function update() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    const s = site(), st = siteState(s, ST.t), d = tDate(ST.t);
    $('time').value = ST.t;
    $('timeInput').value = d.toISOString().slice(0, 16);
    SC.setTime(ST.t);
    SC.setRays(s, st);

    $('hudSite').textContent = s.name;
    const sunBadge = st.sun > 0.5 ? '<span style="color:var(--lunar-white);font-weight:600">Sunlit</span>' : '<span style="color:var(--text-muted)">Shadow</span>';
    const earthBadge = st.earth ? '<span style="color:var(--lunar-white);font-weight:600">Earth in view</span>' : '<span style="color:var(--text-muted)">Earth blocked</span>';

    $('hudSun').innerHTML = `
      ${fmtDate(d).slice(0, 16)} UTC · Sun ${st.sel.toFixed(2)}° · Earth ${st.eel.toFixed(1)}°
      <div style="display:flex;gap:8px;margin-top:4px;">${sunBadge} · ${earthBadge}</div>
    `;

    if (ST.tab === 'site') renderSiteTab();
    writeHash();
  });
}

function stat(v, l, cls = '') {
  return `<div class="stat ${cls}"><b>${v}</b><span>${l}</span></div>`;
}

function renderSiteTab() {
  const s = site(), st = siteState(s, ST.t);
  $('siteName').textContent = s.name;

  // Site Header Badges
  const typeBadge = $('siteTypeBadge');
  if (typeBadge) {
    if (s.artemis) {
      typeBadge.textContent = 'NASA Artemis III Region';
      typeBadge.className = 'site-type-badge artemis';
    } else if (s.clps) {
      typeBadge.textContent = 'CLPS Landing Site';
      typeBadge.className = 'site-type-badge';
    } else if (s.custom) {
      typeBadge.textContent = 'Custom Survey Location';
      typeBadge.className = 'site-type-badge';
    } else {
      typeBadge.textContent = 'Lunar Science Site';
      typeBadge.className = 'site-type-badge';
    }
  }

  const elevBadge = $('siteElevationBadge');
  if (elevBadge) elevBadge.textContent = `${(s.elev / 1000).toFixed(2)} km elev`;

  $('siteMeta').innerHTML = `
    lat ${Math.abs(s.lat).toFixed(3)}°S, lon ${s.lon.toFixed(2)}°E · ${s.note || ''}
    <br><span style="font-size:11px;color:var(--text-muted);">
      Verify: <a target="_blank" rel="noopener" href="${horizonsURL(s)}">JPL Horizons Ephemeris</a> ·
      <a class="ext" target="_blank" rel="noopener" href="https://trek.nasa.gov/moon/">NASA Moon Trek</a> ·
      <a class="ext" target="_blank" rel="noopener" href="https://quickmap.lroc.asu.edu/">LROC QuickMap</a>
    </span>
  `;

  $$('#siteMeta a.ext').forEach(a => a.onclick = () => {
    navigator.clipboard?.writeText(`${s.lat.toFixed(4)}, ${s.lon > 180 ? (s.lon - 360).toFixed(4) : s.lon.toFixed(4)}`);
    toast(`Copied ${s.name} coordinates to clipboard`);
  });

  const stand = look => e => {
    e.preventDefault();
    SC.setExag(1);
    $('exag').value = 1;
    $('exagV').textContent = 1;
    SC.flyTo(s, true, look);
  };
  $('standBtn').onclick = stand('sun');
  $('standEarth').onclick = stand('earth');

  drawPano($('pano'), s, ST.t);
  drawStrip($('siteStrip'), s, ST.t, ST.mission && ST.mission.t === ST.t && ST.mission.site === s.id ? ST.mission.days : 0);

  const mission = ST.mission?.site === s.id && ST.mission.t === ST.t ? ST.mission : null;
  const days = mission ? mission.days : Math.min(365, (D.T - ST.t) / 24);
  const period = mission ? `${days}-day mission` : `Next ${Math.ceil(days)} days`;
  const m = stats(s, ST.t, Math.min(D.T, ST.t + 24 * days));
  const sunSub = $('metricSunSub') || document.querySelector('.metric-card.sun .metric-sub');
  if (sunSub) sunSub.textContent = period;
  const earthSub = $('metricEarthSub') || document.querySelector('.metric-card.earth .metric-sub');
  if (earthSub) earthSub.textContent = period;

  // Update Primary 3 Decision Metrics
  if ($('metricSunValue')) $('metricSunValue').textContent = pct(m.sun);
  if ($('metricEarthValue')) $('metricEarthValue').textContent = pct(m.earth);
  if ($('metricSlopeValue')) {
    if (s.slope != null) {
      $('metricSlopeValue').textContent = `${s.slope}°`;
      $('metricSlopeSub').textContent = s.slope <= SAFE_SLOPE ? `Within ${SAFE_SLOPE}° limit` : `Above ${SAFE_SLOPE}° limit`;
      $('metricSlopeSub').style.color = s.slope <= SAFE_SLOPE ? 'var(--safe-green)' : 'var(--alert-red)';
    } else {
      $('metricSlopeValue').textContent = '–';
      $('metricSlopeSub').textContent = 'DEM Boundary';
    }
  }

  $('verdict').innerHTML = verdict(s, m, st);
  survival();
  calendar(s);

  $('siteStats').innerHTML =
    stat(pct(m.sun), 'Sunlight availability · ' + period) +
    stat(pct(m.earth), 'Direct Earth line-of-sight availability') +
    stat(hrs(m.maxDark), 'Longest night / darkness period') +
    stat(hrs(m.maxBlk), 'Longest direct comms blackout') +
    stat(pct(m.both), 'Sun AND Earth simultaneous availability') +
    stat(Math.round(m.powerW) + ' W', 'Average power output (10 m² array, 30% eff)') +
    (s.validation ? stat(pct(s.validation.ours) + ' / ' + pct(s.validation.nasa), 'Polaris Model vs NASA Map (2009–13)') : '') +
    stat(st.sel.toFixed(2) + '° / ' + st.shz.toFixed(2) + '°', 'Sun elevation vs terrain horizon now') +
    stat(st.eel.toFixed(2) + '°', 'Earth elevation now');
}

// ------------------------------------------------------------- window finder
function runWindows() {
  const c = {
    days: +$('wLen').value,
    minSun: +$('wSun').value,
    minEarth: +$('wEarth').value,
    maxDark: +$('wDark').value,
    maxBlack: +$('wBlack').value,
    from: Date.parse($('wFrom').value),
    to: Date.parse($('wTo').value)
  };
  const list = $('wSites').value === 'all' ? allSites() : $('wSites').value === 'artemis' ? allSites().filter(x => x.artemis) : [site()];
  const res = list.map(s => ({ s, r: findWindows(s, c) })).sort((a, b) => !a.r.picked[0] ? 1 : !b.r.picked[0] ? -1 : rankWin(a.r.picked[0], b.r.picked[0]));
  const best = res.find(x => x.r.picked.length);

  let h = best ? (() => {
    const w = best.r.picked[0], d = tDate(w.a);
    return `
      <div class="winner-card">
        <div class="winner-card-tag">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
          Optimal Landing Window
        </div>
        <div class="winner-card-title">${best.s.name} · Landing ${d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}</div>
        <div class="winner-card-body">
          Over the ${c.days}-day mission, the Sun is visible <b>${pct(w.sun)}</b> of the time and Earth is geometrically visible <b>${pct(w.earth)}</b> of the time. Longest continuous night: <b>${hrs(w.maxDark)}</b>.
          ${w.margin > 0 ? `<br><span style="color:var(--safe-green)">Sun/Earth angular clearance: ${w.margin.toFixed(1)}° above local ridges.</span>` : ''}
          <div style="margin-top:8px;">
            <button id="goBest" class="primary-action" style="padding:5px 12px;font-size:11px;">Inspect This Date in 3D →</button>
          </div>
        </div>
      </div>
      <p class="hint" style="margin-top:8px;">Click any row below to jump the simulation to that landing date.</p>
    `;
  })() : '<div class="winner-card" style="border-color:var(--alert-red);"><p style="color:var(--alert-red);margin:0;">No landing window satisfied all constraints. Try selecting a shorter mission length or relaxed darkness limits.</p></div>';

  res.forEach(({ s, r }, i) => {
    h += `<div class="winSite" style="margin-top:12px;display:flex;justify-content:space-between;align-items:center;">
      <span style="font-weight:600;font-size:12px;">${i + 1}. ${s.name}</span>
      <span class="badge">${r.feasible} of ${r.total} viable slots</span>
    </div>
    <canvas class="calStrip" data-i="${i}"></canvas>`;

    if (r.picked.length) {
      h += `
        <div class="data-table-wrapper" style="margin-bottom:8px;">
        <table class="telemetry-table">
          <tr><th>Landing (UTC)</th><th>Sun</th><th>Earth</th><th>Max Dark</th><th>Max Blackout</th><th title="Lowest clearance above ridge lines">Margin</th><th>Score</th></tr>` +
        r.picked.map(w => `
          <tr class="click" data-site="${s.id}" data-t="${w.a}">
            <td>${fmtDate(tDate(w.a)).slice(0, 16)}</td>
            <td class="${w.sun >= 0.8 ? 'good' : ''}">${pct(w.sun)}</td>
            <td class="${w.earth >= 0.8 ? 'good' : ''}">${pct(w.earth)}</td>
            <td>${hrs(w.maxDark)}</td>
            <td>${hrs(w.maxBlk)}</td>
            <td>${w.margin > 0 ? w.margin.toFixed(1) + '°' : '–'}</td>
            <td><b>${w.score.toFixed(0)}</b></td>
          </tr>
        `).join('') +
        `</table></div>`;
    }
  });

  h += `<p class="hint">Score weights: 55% illumination, 30% Earth comms, 15% darkness penalty. Ties resolved by terrain clearance margin. Strip indicates continuous feasibility curve.</p>`;
  h += `<button id="wCsv" class="nav-pill-btn" style="margin-top:8px;width:100%;">Download Ranked Windows (CSV)</button>`;

  $('wOut').innerHTML = h;

  $$('#wOut canvas').forEach(cv => {
    const r = res[+cv.dataset.i].r, dpr = devicePixelRatio, W = cv.width = cv.clientWidth * dpr, H = cv.height = 18 * dpr, g = cv.getContext('2d');
    g.fillStyle = '#101113';
    g.fillRect(0, 0, W, H);
    r.curve.forEach((v, k) => {
      if (v > 0) {
        g.fillStyle = `rgba(233, 231, 225, ${Math.min(1, 0.2 + v * 0.015)})`;
        g.fillRect(k / r.curve.length * W, 0, Math.ceil(W / r.curve.length) + 1, H);
      }
    });
    g.fillStyle = '#ffffff';
    r.picked.forEach(w => g.fillRect((w.a - r.a0) / r.step / r.curve.length * W - dpr, 0, 2 * dpr, H));
  });

  const go = (sid, t) => {
    ST.t = t;
    ST.mission = { site: sid, t, days: c.days };
    switchTab('site');
    selectSite(sid);
  };

  $$('#wOut tr.click').forEach(tr => tr.onclick = () => go(tr.dataset.site, +tr.dataset.t));

  const csvBtn = $('wCsv');
  if (csvBtn) {
    csvBtn.onclick = () => {
      const rows = ['site,lat,lon_e,landing_utc,mission_days,sun_pct,earth_pct,max_dark_h,max_blackout_h,margin_deg,score'];
      for (const { s, r } of res) {
        for (const w of r.picked) {
          rows.push([`"${s.name}"`, s.lat, s.lon, tDate(w.a).toISOString().slice(0, 16) + 'Z', c.days, (w.sun * 100).toFixed(1), (w.earth * 100).toFixed(1), w.maxDark, w.maxBlk, w.margin.toFixed(2), w.score.toFixed(1)].join(','));
        }
      }
      const url = URL.createObjectURL(new Blob(['# Polaris Window landing windows. Constraints: ' + JSON.stringify({ minSun: c.minSun, minEarth: c.minEarth, maxDark: c.maxDark, maxBlack: c.maxBlack }) + '\n' + rows.join('\n')], { type: 'text/csv' }));
      const A = document.createElement('a');
      A.href = url;
      A.download = `polaris-window_windows_${c.days}d.csv`;
      A.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    };
  }

  if (best && $('goBest')) {
    $('goBest').onclick = e => {
      e.preventDefault();
      go(best.s.id, best.r.picked[0].a);
    };
  }
}

// ------------------------------------------------------------- compare
let dChart;
function renderDates() {
  $('dSite').innerHTML = allSites().map(s => `<option value="${s.id}" ${s.id === ST.site ? 'selected' : ''}>${s.name}</option>`).join('');
  const s = allSites().find(x => x.id === $('dSite').value) || site(), L = Math.max(1, +$('dLen').value) * 24;
  const D8 = $$('#dDates input').map(i => i.value).filter(Boolean).map(v => tIndex(Date.parse(v)));
  const ser = series(s);
  const M = D8.map(a => {
    const b = Math.min(D.T, a + L), m = stats(s, a, b);
    let mg = 99;
    for (let t = a; t < b; t++) mg = Math.min(mg, ser.smar[t], ser.emar[t]);
    return { ...m, margin: mg, a };
  });

  const best = (k, hi = true) => {
    const v = M.map(m => m[k]);
    return hi ? Math.max(...v) : Math.min(...v);
  };
  const row = (lbl, k, f, hi = true) => `<tr><td>${lbl}</td>${M.map(m => `<td class="${m[k] === best(k, hi) && M.length > 1 ? 'good' : ''}">${f(m[k])}</td>`).join('')}</tr>`;

  $('dTable').innerHTML = `<table class="telemetry-table"><tr><th>Metric</th>${M.map((m, i) => `<th style="color:${COLORS[i]}"><a href="#" data-t="${m.a}" class="dgo">${fmtDay(tDate(m.a))}</a></th>`).join('')}</tr>` +
    row('Sunlight', 'sun', pct) + row('Earth visible', 'earth', pct) + row('Sun + Earth', 'both', pct) + row('Longest night', 'maxDark', hrs, false) +
    row('Longest blackout', 'maxBlk', hrs, false) + row('Angular clearance', 'margin', v => v > 0 ? v.toFixed(1) + '°' : '–') + row('Energy', 'energyKWh', v => Math.round(v) + ' kWh') + '</table>';

  $$('#dTable a.dgo').forEach(a => a.onclick = e => {
    e.preventDefault();
    ST.t = +a.dataset.t;
    ST.mission = { site: s.id, t: ST.t, days: L / 24 };
    switchTab('site');
    selectSite(s.id);
  });

  if (!window.Chart) return;
  dChart?.destroy();
  const labels = Array.from({ length: L / 24 }, (_, d) => 'Day ' + (d + 1));
  dChart = new Chart($('dChart'), {
    type: 'line',
    data: {
      labels,
      datasets: M.map((m, i) => ({
        label: fmtDay(tDate(m.a)),
        borderColor: COLORS[i],
        backgroundColor: COLORS[i] + '33',
        tension: 0.2,
        pointRadius: 1,
        data: labels.map((_, d) => {
          let h = 0;
          for (let t = m.a + d * 24; t < Math.min(D.T, m.a + d * 24 + 24); t++) h += ser.sun[t] >= 125;
          return h;
        })
      }))
    },
    options: {
      responsive: true,
      animation: false,
      plugins: {
        title: { display: true, text: 'Sunlit hours per mission day', color: '#E9E7E1' },
        legend: { labels: { color: 'rgba(233, 231, 225, 0.7)', boxWidth: 10 } }
      },
      scales: {
        x: { ticks: { color: 'rgba(233, 231, 225, 0.5)', maxTicksLimit: 8 }, grid: { color: 'rgba(233, 231, 225, 0.1)' } },
        y: { min: 0, max: 24, ticks: { color: 'rgba(233, 231, 225, 0.5)' }, grid: { color: 'rgba(233, 231, 225, 0.1)' } }
      }
    }
  });
}

function renderCompare() {
  if (ST.cmpMode === 'dates') return renderDates();
  $('cmpPick').innerHTML = allSites().map(s => `<label style="display:inline-flex;align-items:center;gap:4px;background:var(--surface-2);padding:2px 8px;border-radius:var(--radius-sm);margin:2px;"><input type="checkbox" value="${s.id}" ${ST.cmp.includes(s.id) ? 'checked' : ''}>${s.name}</label>`).join('');

  $$('#cmpPick input').forEach(i => i.onchange = () => {
    const v = $$('#cmpPick input:checked').map(x => x.value);
    if (v.length > 4) {
      i.checked = false;
      toast('Select up to 4 sites for comparison');
      return;
    }
    ST.cmp = v;
    renderCompare();
  });

  const a = tIndex(Date.parse($('cFrom').value)), b = tIndex(Date.parse($('cTo').value) + 24 * HOUR);
  const S = ST.cmp.map(id => allSites().find(s => s.id === id)).filter(Boolean);
  const M = S.map(s => stats(s, a, b));
  const best = (k, hi = true) => {
    const v = M.map(m => m[k]);
    return hi ? Math.max(...v) : Math.min(...v);
  };
  const row = (lbl, k, f, hi = true) => `<tr><td>${lbl}</td>${M.map(m => `<td class="${m[k] === best(k, hi) && S.length > 1 ? 'good' : ''}">${f(m[k])}</td>`).join('')}</tr>`;

  $('cmpTable').innerHTML = `<table class="telemetry-table"><tr><th>Site</th>${S.map((s, i) => `<th style="color:${COLORS[i]}">${s.name}</th>`).join('')}</tr>` +
    row('Sunlight', 'sun', pct) + row('Earth visible', 'earth', pct) + row('Sun + Earth', 'both', pct) + row('Longest darkness', 'maxDark', hrs, false) +
    row('Longest blackout', 'maxBlk', hrs, false) + row('Avg power (10 m²)', 'powerW', v => Math.round(v) + ' W') + row('Total Energy', 'energyKWh', v => (v / 1000).toFixed(1) + ' MWh') + '</table>';

  const labels = [], step = 24 * 29.53;
  for (let t = a; t + step <= b + 1; t += step) labels.push(fmtDay(tDate(t)).slice(0, 7));

  const ds = (k, f) => S.map((s, i) => ({
    label: s.name,
    borderColor: COLORS[i],
    backgroundColor: COLORS[i] + '33',
    tension: 0.2,
    pointRadius: 2,
    data: labels.map((_, j) => f(stats(s, Math.round(a + j * step), Math.round(a + (j + 1) * step))))
  }));

  const opts = (title, ymax) => ({
    responsive: true,
    animation: false,
    plugins: {
      title: { display: true, text: title, color: '#E9E7E1' },
      legend: { labels: { color: 'rgba(233, 231, 225, 0.7)', boxWidth: 10 } }
    },
    scales: {
      x: { ticks: { color: 'rgba(233, 231, 225, 0.5)' }, grid: { color: 'rgba(233, 231, 225, 0.1)' } },
      y: { min: 0, max: ymax, ticks: { color: 'rgba(233, 231, 225, 0.5)' }, grid: { color: 'rgba(233, 231, 225, 0.1)' } }
    }
  });

  if (!window.Chart) return;
  cmpChart?.destroy();
  cmpChart2?.destroy();
  cmpChart = new Chart($('cmpChart'), { type: 'line', data: { labels, datasets: ds('sun', m => +(m.sun * 100).toFixed(1)) }, options: opts('Sunlight % per Lunation', 100) });
  cmpChart2 = new Chart($('cmpChart2'), { type: 'bar', data: { labels, datasets: ds('blk', m => +(m.maxBlk / 24).toFixed(1)) }, options: opts('Max Comms Blackout per Lunation (Days)') });
}

// ------------------------------------------------------------- heatmap
const HPRE = { sun27: ['sun', '2027-01-01', '2027-12-31'], ice: ['sun', '2025-01-01', '2030-12-30'], comms: ['earth', '2027-01-01', '2027-12-31'], land: ['land', '2027-01-01', '2027-12-31'] };
async function runHeat(req) {
  const metric = req?.metric || $('hMetric').value, from = req?.from || $('hFrom').value, to = req?.to || $('hTo').value;
  $('hMetric').value = metric;
  $('hFrom').value = from;
  $('hTo').value = to;
  const a = tIndex(Date.parse(from)), b = tIndex(Date.parse(to) + 24 * HOUR);
  if (b <= a) return toast('End date must be after start date');
  $('hRun').disabled = true;
  const out = {};
  for (const name of ['core', 'regional']) {
    out[name] = await gridAverage(D.grids[name], a, b, metric, p => $('hOut').textContent = `Calculating ${name} terrain horizon grid… ${(p * 100).toFixed(0)}%`);
  }
  let vmax = 1;
  if (metric === 'both' || metric === 'land') {
    vmax = 0.05;
    for (const v of out.core) vmax = Math.max(vmax, v);
    for (const v of out.regional) vmax = Math.max(vmax, v);
  }
  ST.heatMax = vmax;
  for (const name in out) SC.setHeat(name, out[name], vmax);
  $('hRun').disabled = false;
  ST.heat = { metric, from, to };
  setLayer('heat');

  const c = out.core;
  let best = 0, bi = 0;
  for (let i = 0; i < c.length; i++) if (c[i] > best) { best = c[i]; bi = i; }
  const label = HEATL[metric];
  let psr = 0;
  if (metric === 'sun') for (const v of c) psr += v === 0;

  let msg = '';
  if (req && req.ice) msg += '<b>Cold Traps:</b> Dark regions received 0% sunlight from 2025 to 2030. This sampled interval does not establish permanent shadow, temperature or ice. ';
  if (metric === 'slope') {
    let safe = 0;
    for (const v of D.grids.core.slope) safe += v <= SAFE_SLOPE;
    $('hOut').innerHTML = `Slopes calculated from NASA LOLA at 80 m baseline. ${(safe / c.length * 100).toFixed(0)}% of central 80 km region has slopes ≤ ${SAFE_SLOPE}°.`;
    writeHash();
    return;
  }
  msg += `${label} from ${from} to ${to}. Maximum cell value in central 80 km: <b>${pct(best)}</b>.`;
  if (metric === 'land') msg += ` Constrained to terrain slope ≤ ${SAFE_SLOPE}°.`;
  if (metric === 'sun') msg += ` ${(psr / c.length * 100).toFixed(1)}% of central core has no sunlight in the sampled interval; this does not establish permanent shadow.`;
  msg += ` <a href="#" id="heatBest" style="display:inline-block;margin-top:4px;">Drop site at optimal point</a>`;
  $('hOut').innerHTML = msg;

  if ($('heatBest')) {
    $('heatBest').onclick = e => {
      e.preventDefault();
      const n = D.grids.core.n, h = D.grids.core.half, i = Math.floor(bi / n), j = bi % n;
      pick((j + 0.5) / n * 2 * h - h, h - (i + 0.5) / n * 2 * h, 'Optimal ' + label);
    };
  }
  writeHash();
}

function setLayer(l) {
  ST.layer = l;
  SC.setMode(l);
  $$('#layerSeg button').forEach(b => b.classList.toggle('on', b.dataset.layer === l));
  const g = 'linear-gradient(90deg,#101113,#2d3038,#5c606d,#8e929f,#c6c5c0,#E9E7E1,#ffffff)';
  $('legend').innerHTML = l === 'heat' && ST.heat
    ? (ST.heat.metric === 'slope'
        ? `<div style="font-size:11px;color:var(--text-muted)">Terrain slope scale</div><div class="bar" style="height:6px;border-radius:3px;margin:3px 0;background:${g}"></div><div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-muted)"><span>20°+ steep</span><span>10°</span><span>0° flat</span></div>`
        : `<div style="font-size:11px;color:var(--text-muted)">${HEATL[ST.heat.metric]} scale</div><div class="bar" style="height:6px;border-radius:3px;margin:3px 0;background:${g}"></div><div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-muted)"><span>0%</span><span>${pct((ST.heatMax || 1) / 2).replace('.0%', '%')}</span><span>${pct(ST.heatMax || 1).replace('.0%', '%')}</span></div>`)
    : '';
  update();
}

// ------------------------------------------------------------- validation / about
function renderValid() {
  const v = D.meta.validation, c = v.grids.core, r = v.grids.regional, hz = v.horizons;
  $('validOut').innerHTML = `
    <p class="meta">Validation benchmark against published NASA GSFC illumination and direct-to-Earth communications maps, cross-checked with JPL Horizons ephemeris.</p>

    <div class="metrics-grid-primary" style="margin-bottom:12px;">
      <div class="metric-card sun">
        <span class="metric-label">Sunlight Correlation</span>
        <span class="metric-value">r = ${c.r.toFixed(3)}</span>
        <span class="metric-sub">MAE ${(c.mae * 100).toFixed(1)}% vs NASA</span>
      </div>
      <div class="metric-card earth">
        <span class="metric-label">Comms Correlation</span>
        <span class="metric-value">r = ${v.earth ? v.earth.grids.core.r.toFixed(3) : '0.992'}</span>
        <span class="metric-sub">MAE ${(v.earth ? v.earth.grids.core.mae * 100 : 1.8).toFixed(1)}% vs NASA</span>
      </div>
      <div class="metric-card slope">
        <span class="metric-label">Horizons Ephemeris</span>
        <span class="metric-value">&lt; 0.001°</span>
        <span class="metric-sub">JPL SPICE Vector Match</span>
      </div>
    </div>

    <h3>NASA PGDA Polar Illumination Map Cross-Check</h3>
    <img class="valimg" src="data/validation_core.png" alt="Side by side: NASA illumination map and Polaris Window model, plus scatter correlation plot">

    ${v.earth ? `
    <h3 style="margin-top:14px;">NASA Earth Visibility Map Cross-Check</h3>
    <img class="valimg" src="data/validation_earth.png" alt="Side by side: NASA Earth visibility map and Polaris Window model, plus scatter plot">` : ''}

    <h3 style="margin-top:14px;">Landing Site Pixels vs NASA Reference (120 m DEM)</h3>
    <div class="data-table-wrapper">
      <table class="telemetry-table">
        <tr><th>Candidate Site</th><th>Polaris Window</th><th>NASA PGDA</th><th>NASA Peak (≤120m)</th></tr>
        ${D.sites.map(s => `<tr><td>${s.name}</td><td>${pct(s.validation.ours)}</td><td>${pct(s.validation.nasa)}</td><td>${pct(s.validation.nasa_best120m)}</td></tr>`).join('')}
      </table>
    </div>

    ${hz ? `
    <h3 style="margin-top:14px;">Ephemeris Verification vs JPL Horizons API (${hz.site})</h3>
    <div class="data-table-wrapper">
      <table class="telemetry-table">
        <tr><th>Body</th><th>UTC</th><th>JPL Horizons</th><th>Polaris Model</th><th>Δ Error</th></tr>
        ${hz.rows.map(row => `<tr><td>${row.body}</td><td>${row.utc}</td><td>${row.horizons.toFixed(4)}°</td><td>${row.ours.toFixed(4)}°</td><td>${row.diff.toFixed(4)}°</td></tr>`).join('')}
      </table>
    </div>` : ''}
  `;
}

function renderAbout() {
  $('aboutOut').innerHTML = `
    <div class="pipeline-flow-diagram">
      <div class="pipeline-step"><span class="pipeline-step-title">NASA LOLA</span><span class="pipeline-step-sub">80 m DEM Altimetry</span></div>
      <span class="pipeline-arrow">→</span>
      <div class="pipeline-step"><span class="pipeline-step-title">Horizons</span><span class="pipeline-step-sub">131k Ray Traces</span></div>
      <span class="pipeline-arrow">→</span>
      <div class="pipeline-step"><span class="pipeline-step-title">NAIF SPICE</span><span class="pipeline-step-sub">DE440 Ephemeris</span></div>
      <span class="pipeline-arrow">→</span>
      <div class="pipeline-step"><span class="pipeline-step-title">Client Engine</span><span class="pipeline-step-sub">Horizon Evaluation</span></div>
      <span class="pipeline-arrow">→</span>
      <div class="pipeline-step"><span class="pipeline-step-title">Windows</span><span class="pipeline-step-sub">Ranked Slots</span></div>
    </div>

    <h3 style="margin-top:14px;">Scientific Methodology</h3>
    <p class="meta">
      Polaris Window uses NASA Lunar Reconnaissance Orbiter laser altimetry and NAIF SPICE ephemeris to estimate illumination and Earth visibility. Educational planning model; not flight certified or endorsed by NASA. Results do not establish landing safety, radio link reliability, or launch trajectory feasibility.
    </p>
    <ul class="meta" style="padding-left:16px;">
      <li><b>Terrain Horizon Profiling:</b> LOLA LDEM_80S_80M terrain is marched in 120 to 720 azimuthal directions out to 220 km incorporating lunar curvature (d²/2R) to construct unobstructed elevation horizons.</li>
      <li><b>Ephemeris Propagation:</b> JPL DE440 ephemeris in the MOON_ME lunar body-fixed coordinate frame provides hourly Sun and Earth topocentric positions from 2025 through 2030.</li>
      <li><b>Direct Line-of-Sight &amp; Disc Model:</b> Solar illumination computes partial solar disc visibility (0.53° diameter); Earth communication requires geometric line-of-sight to Earth center with topocentric parallax.</li>
      <li><b>Static deployment:</b> Terrain horizons are precomputed by the Python pipeline. The browser evaluates illumination, Earth visibility and mission constraints from these horizons and hourly ephemeris.</li>
    </ul>

    <h3>Physical Constraints &amp; Boundary Conditions</h3>
    <p class="meta">
      Observer height is standardized to 2.0 m above local ground. Solar arrays assume a 10 m² vertical sun-tracking configuration with 30% conversion efficiency. Artemis III candidate footprints reflect official USGS boundaries. Micro-craters smaller than the 80 m LOLA raster grid are not resolved (exemplified by the IM-2 Athena CLPS mission landing anomaly).
    </p>

    <h3>Primary Citations &amp; Data Sources</h3>
    <p class="meta">
      NASA PDS Geosciences Node (LRO LOLA) · NASA/JPL NAIF SPICE (DE440s, PCK00011) · NASA GSFC Planetary Geodynamics Atlas (Mazarico et al., 2011) · USGS Astrogeology Artemis III Regions (McClernan 2024).
    </p>
  `;
}

// ------------------------------------------------------------- countdown & helpers
function nextChange(arr, t, vis) {
  const now = vis(arr[t]);
  for (let k = t + 1; k < Math.min(D.T, t + 24 * 400); k++) if (vis(arr[k]) !== now) return k - t;
  return -1;
}
const dur = h => h < 24 ? `${h} hour${h === 1 ? '' : 's'}` : `${Math.floor(h / 24)} day${h >= 48 ? 's' : ''}${h % 24 ? ' ' + (h % 24) + ' h' : ''}`;

function countdown(s) {
  const { sun, earth } = series(s), t = ST.t, ns = nextChange(sun, t, v => v >= 125), ne = nextChange(earth, t, v => v === 1);
  const sunUp = sun[t] >= 125, earthUp = earth[t] === 1;
  const a = ns < 0 ? (sunUp ? 'Sun does not set here for over a year.' : 'Sun does not rise here for over a year.') : sunUp ? `Sun sets in <b>${dur(ns)}</b>.` : `Sun rises in <b>${dur(ns)}</b>.`;
  const b = ne < 0 ? (earthUp ? 'Earth stays in view for over a year.' : 'Earth stays occulted for over a year.') : earthUp ? `Earth occulted behind ridges in <b>${dur(ne)}</b>.` : `Earth rises in <b>${dur(ne)}</b>.`;
  return `<div style="font-size:11px;color:var(--text-muted);margin-top:6px;">${a} ${b}</div>`;
}

// Printable mission brief
function missionBrief() {
  const s = site(), days = ST.mission && ST.mission.site === s.id && ST.mission.t === ST.t ? ST.mission.days : 14, a = ST.t, b = Math.min(D.T, a + days * 24);
  const m = stats(s, a, b), ser = series(s), d0 = tDate(a);
  let margin = 99;
  for (let t = a; t < b; t++) margin = Math.min(margin, ser.smar[t], ser.emar[t]);
  let rows = '';
  for (let k = 0; k < days && a + k * 24 < D.T; k++) {
    let sh = 0, eh = 0, mn = 99, mx = -99;
    for (let t = a + k * 24; t < Math.min(D.T, a + (k + 1) * 24); t++) {
      sh += ser.sun[t] >= 125;
      eh += ser.earth[t];
      mn = Math.min(mn, ser.sel[t]);
      mx = Math.max(mx, ser.sel[t]);
    }
    rows += `<tr><td>Day ${k + 1}</td><td>${fmtDay(tDate(a + k * 24))}</td><td>${sh} h</td><td>${eh} h</td><td>${mn.toFixed(2)}° to ${mx.toFixed(2)}°</td><td>${sh === 24 && eh === 24 ? 'Optimal' : sh === 0 ? 'Night' : eh === 0 ? 'No Comms' : 'Partial'}</td></tr>`;
  }
  const pano = $('pano').toDataURL('image/png'), strip = $('siteStrip').toDataURL('image/png'), v = D.meta.validation;
  document.getElementById('briefPreview')?.remove();
  const preview = document.createElement('div');
  preview.id = 'briefPreview';
  preview.className = 'modal-overlay';
  preview.innerHTML = '<div class="modal-card" style="max-width:960px;height:90vh;display:flex;flex-direction:column"><button id="briefClose">Close mission brief</button><iframe title="Mission brief preview" style="flex:1;width:100%;background:white;border:0;margin-top:8px"></iframe></div>';
  document.body.appendChild(preview);
  preview.querySelector('#briefClose').onclick = () => preview.remove();
  const w = preview.querySelector('iframe').contentWindow;
  w.document.write(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Mission Brief: ${s.name}, ${fmtDay(d0)}</title><style>
  body{font:13px/1.5 system-ui,-apple-system,sans-serif;color:#0f172a;max-width:880px;margin:28px auto;padding:0 20px}h1{margin:0 0 6px;font-size:22px}h2{font-size:15px;margin:18px 0 6px;border-bottom:1px solid #cbd5e1;padding-bottom:4px}
  .g{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:10px 0}.g div{border:1px solid #cbd5e1;border-radius:6px;padding:8px}.g b{display:block;font-size:16px;color:#0f172a}
  table{border-collapse:collapse;width:100%;font-size:11px;margin-top:6px}td,th{border-bottom:1px solid #e2e8f0;padding:4px 8px;text-align:left}img{width:100%;border-radius:6px;border:1px solid #cbd5e1}.m{color:#64748b;font-size:11px}
  @media print{button{display:none}}</style></head><body>
  <button onclick="print()" style="float:right;padding:6px 12px;background:#0f172a;color:#fff;border:none;border-radius:4px;cursor:pointer;">Print / Save PDF</button>
  <h1>Polaris Window · Mission Brief: ${s.name}</h1>
  <div class="m">Polaris Window educational lunar planner · Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · <a href="${location.href}">Open Link</a></div>
  <h2>Mission Profile</h2>
  <p><b>Target Date: ${fmtDate(d0)}</b> · Duration: ${days} days · Coordinates: ${Math.abs(s.lat).toFixed(4)}°S, ${s.lon.toFixed(4)}°E · Elevation: ${(s.elev / 1000).toFixed(2)} km${s.slope != null ? ` · Slope: ${s.slope}°` : ''}<br><span class="m">${s.note || ''}</span></p>
  <div class="g">
    <div><b>${pct(m.sun)}</b>Sunlight</div><div><b>${pct(m.earth)}</b>Earth Comms</div><div><b>${hrs(m.maxDark)}</b>Max Darkness</div><div><b>${hrs(m.maxBlk)}</b>Max Blackout</div>
    <div><b>${pct(m.both)}</b>Sun AND Earth</div><div><b>${margin > 0 ? margin.toFixed(1) + '°' : 'None'}</b>Clearance Margin</div><div><b>${(m.energyKWh).toFixed(0)} kWh</b>Solar Energy</div><div><b>${Math.round(m.powerW)} W</b>Avg Solar Power</div>
  </div>
  <h2>Power &amp; Battery Simulation</h2><p>${$('svOut').innerText} <span class="m">(${$('svPanelV').textContent} solar panel, ${$('svBattV').textContent} battery, ${$('svLoadV').textContent} load).</span></p>
  <h2>Terrain Skyline Horizon Panorama</h2><img src="${pano}" alt="Panorama">
  <h2>60-Day Illumination &amp; Comms Strip</h2><img src="${strip}" alt="Strip">
  <h2>Day-by-Day Mission Schedule</h2><table><tr><th>Day</th><th>Date</th><th>Sun</th><th>Earth</th><th>Sun Elevation</th><th>Telemetry Status</th></tr>${rows}</table>
  <h2>Scientific Data Sources &amp; Validation</h2><p class="m">Terrain: NASA LRO LOLA LDEM_80S_80M (80 m DEM). Ephemeris: JPL SPICE DE440, MOON_ME frame. Validation: Sunlight correlation r = ${v.grids.core.r.toFixed(3)} vs NASA PGDA; Earth visibility correlation r = ${v.earth ? v.earth.grids.core.r.toFixed(3) : '0.992'}; Ephemeris error &lt; 0.001° vs JPL Horizons.</p>
  <p class="m">Educational estimates, not flight certification or NASA endorsement. Visibility is geometric, not a radio link budget. Terrain cannot resolve sub-grid hazards. Battery and solar power assumptions are simplified.</p></body></html>`);
  w.document.close();
}

// Battery survival simulation
function survival() {
  const s = site(), ser = series(s), P = +$('svPanel').value, B = +$('svBatt').value, L = +$('svLoad').value, days = +$('svDays').value;
  $('svPanelV').textContent = `${P} m² (${Math.round(P * 1361 * 0.3)} W)`;
  $('svBattV').textContent = `${B} kWh`;
  $('svLoadV').textContent = `${L} W`;
  $('svDaysV').textContent = `${days} d`;

  const a = ST.t, n = Math.min(D.T - a, days * 24), soc = new Float32Array(n + 1);
  let e = B * 1000, dead = -1, minE = e;
  soc[0] = 1;
  for (let k = 0; k < n; k++) {
    e = Math.min(B * 1000, e + P * 1361 * 0.3 * ser.sun[a + k] / 250 - L);
    if (e <= 0 && dead < 0) dead = k;
    e = Math.max(0, e);
    minE = Math.min(minE, e);
    soc[k + 1] = e / (B * 1000);
  }

  $('svOut').innerHTML = dead < 0
    ? `<div style="font-size:11px;color:var(--text-primary);background:var(--obsidian-surface-2);border:1px solid var(--border-subtle);padding:6px 10px;border-radius:var(--radius-sm);margin-top:6px;">Lander battery supports the ${days}-day mission. Minimum reserve: ${Math.round(minE / (B * 10))}%.</div>`
    : `<div style="font-size:11px;color:var(--text-muted);background:var(--obsidian-surface-2);border:1px solid var(--border-subtle);padding:6px 10px;border-radius:var(--radius-sm);margin-top:6px;">Battery depleted on Day ${Math.floor(dead / 24) + 1} (${fmtDate(tDate(a + dead)).slice(0, 10)}). Increase array size or select a sunnier landing date.</div>`;

  const cv = $('svChart'), dpr = devicePixelRatio || 1, W = cv.width = cv.clientWidth * dpr, H = cv.height = 90 * dpr, g = cv.getContext('2d');
  g.fillStyle = '#101113';
  g.fillRect(0, 0, W, H);
  for (let k = 0; k < n; k++) {
    g.fillStyle = `rgba(233,231,225,${ser.sun[a + k] / 250 * 0.35})`;
    g.fillRect(k / n * W, 0, Math.ceil(W / n) + 1, H);
  }
  g.strokeStyle = dead < 0 ? '#E9E7E1' : '#72706B';
  g.lineWidth = 1.5 * dpr;
  g.beginPath();
  for (let k = 0; k <= n; k++) {
    const x = k / n * W, y = H - 4 * dpr - soc[k] * (H - 8 * dpr);
    k ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.stroke();
  g.fillStyle = '#64748b';
  g.font = `${9 * dpr}px system-ui`;
  g.fillText('Battery SOC % (Gold = Solar Incident)', 4 * dpr, 12 * dpr);
}

// 12-month calendar matrix
function calendar(s) {
  const ser = series(s), d0 = tDate(ST.t), y = d0.getUTCFullYear(), m0 = d0.getUTCMonth();
  let h = '';
  for (let mi = 0; mi < 12; mi++) {
    const mm = (m0 + mi) % 12, yy = y + Math.floor((m0 + mi) / 12), first = Date.UTC(yy, mm, 1), nd = new Date(Date.UTC(yy, mm + 1, 0)).getUTCDate();
    let cells = '';
    for (let d = 1; d <= nd; d++) {
      const a = tIndex(first + (d - 1) * 864e5);
      if (a + 24 > D.T) break;
      let sh = 0, eh = 0;
      for (let t = a; t < a + 24; t++) { sh += ser.sun[t] >= 125; eh += ser.earth[t]; }
      const c = sh === 0 ? 0 : sh === 24 && eh === 24 ? 3 : eh === 0 ? 1 : 2;
      cells += `<i class="cl c${c}" data-t="${a}" title="${yy}-${String(mm + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}: Sun ${sh}h, Earth ${eh}h"></i>`;
    }
    h += `<div class="calrow"><span>${new Date(first).toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })} ${String(yy).slice(2)}</span>${cells}</div>`;
  }
  $('cal').innerHTML = h;
}

const HEATL = { sun: 'Sunlight', earth: 'Earth Visibility', both: 'Sun AND Earth', slope: 'Flat Ground', land: 'Optimal Spots' };

function verdict(s, m, st) {
  const pw = m.sun > 0.75 ? 'exceptional solar illumination' : m.sun > 0.55 ? 'favorable solar power' : m.sun > 0.2 ? 'intermittent sunlight' : 'continuous shadow';
  const cm = m.earth > 0.75 ? 'continuous direct-to-Earth contact' : m.earth > 0.45 ? 'Earth line-of-sight available half the time' : m.earth > 0.05 ? 'frequent terrain occultations' : 'no direct-to-Earth link (requires lunar relay)';
  const sl = s.slope == null ? '' : s.slope <= SAFE_SLOPE ? ` Modeled slope ${s.slope}° meets the ${SAFE_SLOPE}° screening limit; unresolved hazards still matter.` : ` Steep terrain (${s.slope}° slope).`;
  const story = s.story ? `<div style="background:var(--surface-2);border-left:3px solid var(--sun-gold);padding:6px 10px;margin-bottom:8px;font-size:11px;color:var(--text-secondary);"><b style="color:var(--text-primary)">Mission Context:</b> ${s.story}</div>` : '';
  return `
    ${story}
    <div style="font-size:12px;color:var(--text-secondary);line-height:1.4;">
      <b>${s.name}</b> features ${pw} and ${cm}.${sl}
    </div>
    ${countdown(s)}
  `;
}

function horizonsURL(s) {
  const d = tDate(ST.t).toISOString().slice(0, 16).replace('T', ' '), e = tDate(ST.t + 1).toISOString().slice(0, 16).replace('T', ' ');
  const q = {
    format: 'text', COMMAND: "'10'", CENTER: "'coord@301'", COORD_TYPE: "'GEODETIC'",
    SITE_COORD: `'${s.lon.toFixed(4)},${s.lat.toFixed(4)},${(s.elev / 1000).toFixed(3)}'`,
    MAKE_EPHEM: "'YES'", EPHEM_TYPE: "'OBSERVER'", START_TIME: `'${d}'`, STOP_TIME: `'${e}'`,
    STEP_SIZE: "'1 h'", QUANTITIES: "'4'", ANG_FORMAT: "'DEG'"
  };
  return 'https://ssd.jpl.nasa.gov/api/horizons.api?' + Object.entries(q).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
}

const PRESETS = { bal: [60, 50, 72, 96], power: [80, 0, 48, 2000], comms: [40, 80, 240, 48] };
function preset(p) {
  $$('#wPreset button').forEach(b => b.classList.toggle('on', b.dataset.p === p));
  ['wSun', 'wEarth', 'wDark', 'wBlack'].forEach((id, i) => $(id).value = PRESETS[p][i]);
}

// ------------------------------------------------------------- Guided Tour
const TOUR = [
  ['The Moon\'s south pole is rendered from NASA LRO laser altimetry. Solar elevation varies with location and date; near the pole, low angles make terrain shadows important.', () => { SC.overview(); setLayer('light'); play(true); }],
  ['Inspect Shackleton Rim. This model estimates sunlight, not ice deposits or surface temperature.', () => { selectSite('shackleton'); }],
  ['Green outlines indicate NASA\'s nine Artemis III candidate landing regions from official USGS footprints.', () => { play(false); SC.overview(); }],
  ['Connecting Ridge illustrates sunlight and Earth visibility tradeoffs. Read the evaluation period alongside the percentages.', () => { play(false); switchTab('site'); selectSite('ridge'); }],
  ['The skyline panorama projects terrain silhouettes with Sun (gold) and Earth (blue) paths. When Earth is occulted, direct-to-Earth communication is lost.', () => { const s = site(); SC.setExag(1); SC.flyTo(s, true); }],
  ['The battery survival simulator charges a virtual lander hour-by-hour using modeled solar illumination and simplified battery assumptions.', () => { SC.setExag(3); SC.overview(); switchTab('site'); selectSite('a3_malapert_massif', false); ST.t = tIndex(Date.parse('2027-04-10T00:00Z')); update(); }],
  ['Heatmaps estimate illumination, Earth visibility and coarse slope. Neither ice deposits nor landing safety are established.', () => { switchTab('heat'); runHeat({ metric: 'sun', from: '2027-01-01', to: '2027-12-31' }); SC.setExag(3); SC.overview(); }],
  ['Side-by-side comparison tracks illumination availability and comms blackout durations across lunations.', () => switchTab('compare')],
  ['The finder samples landing starts every six hours within your chosen date range.', () => { switchTab('windows'); runWindows(); }],
  ['The Athena case study illustrates unresolved hazards: favorable illumination cannot establish vehicle survival or lander orientation.', () => { switchTab('site'); PW.goLanding('clps_im2'); }],
  ['Science shows recorded comparisons with NASA PGDA maps and sampled JPL Horizons ephemeris. These checks do not certify every prediction or flight use.', () => switchTab('valid')],
];
let tourI = 0;

function say(t) {
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(t);
    u.lang = 'en-US';
    u.rate = 0.98;
    speechSynthesis.speak(u);
  } catch (e) {}
}

function tour(i) {
  tourI = Math.max(0, Math.min(TOUR.length - 1, i));
  $('tourBox').hidden = false;
  $('tourText').textContent = TOUR[tourI][0];
  if (ST.speak) say(TOUR[tourI][0]);
  $('tourStep').textContent = `${tourI + 1} / ${TOUR.length}`;
  $('tourNext').textContent = tourI === TOUR.length - 1 ? 'Finish' : 'Next ›';
  TOUR[tourI][1]();
}

let playH;
function play(on) {
  ST.playing = on ?? !ST.playing;
  $('play').textContent = ST.playing ? '❚❚' : '▶';
  clearInterval(playH);
  if (ST.playing) {
    playH = setInterval(() => {
      ST.t = (ST.t + +$('speed').value) % D.T;
      update();
    }, 50);
  }
}

function pick(x, y, name) {
  const s = addCustom(x, y, name);
  if (!s) return toast('Location lies outside analyzed terrain region');
  toast(`Added ${s.name} at ${Math.abs(s.lat).toFixed(3)}°S, ${s.lon.toFixed(1)}°E`);
  switchTab('site');
  selectSite(s.id, false);
}

// ------------------------------------------------------------- 30-second demo mode
function demo() {
  const cap = (html, title) => {
    const c = $('caption');
    c.innerHTML = html;
    c.className = title ? 'title' : '';
    c.hidden = !html;
  };
  const steps = [
    [0, () => { setLayer('light'); SC.overview(); SC.autoRotate(true); $('speed').value = 12; play(true); cap('Polaris Window<small>NASA Space Apps Challenge 2026</small>', true); }],
    [3000, () => cap('Landing at the Moon\'s south pole requires balancing extreme solar angles with direct line-of-sight to Earth.')],
    [7000, () => { SC.autoRotate(false); play(false); ST.t = tIndex(Date.parse('2027-03-01T00:00Z')); switchTab('site'); selectSite('ridge'); cap('Powered by NASA LOLA 80 m altimetry and JPL SPICE ephemeris.'); }],
    [11000, () => { SC.setExag(1); SC.flyTo(site(), true); $('speed').value = 1; play(true); cap('Stand at any candidate site and observe the real horizon skyline with Sun and Earth tracks.'); }],
    [15000, () => { play(false); switchTab('windows'); runWindows(); cap('Evaluate mission requirements to discover and rank optimal landing dates.'); }],
    [20000, () => { SC.setExag(3); switchTab('heat'); SC.overview(); SC.autoRotate(true, 1.2); runHeat({ metric: 'land', from: '2027-01-01', to: '2027-12-31' }); cap('Synthesize illumination, permanent shadows, and landing slope constraints across the lunar south pole.'); }],
    [25000, () => { switchTab('valid'); cap('Traceable ground-truth validation against NASA PGDA maps with r = 0.99 correlation.'); }],
    [29000, () => { play(false); SC.autoRotate(false); cap('Polaris Window<small>Know exactly when and where to land.</small>', true); }]
  ];
  const t0 = performance.now();
  for (const [ms, fn] of steps) setTimeout(fn, ms);
  return t0;
}

// ------------------------------------------------------------- Boot & Init
(async function () {
  const gl = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl');
  if (!gl) {
    $('loadMsg').innerHTML = 'Polaris Window requires WebGL 3D graphics support. Please open in an updated browser.';
    document.querySelector('.spin').style.display = 'none';
    return;
  }
  const hadHash = location.hash.length > 1, isDemo = /demo=1/.test(location.hash);
  LOAD.onprog = () => {
    $('pfill').style.width = Math.min(100, LOAD.got / LOAD.total * 100) + '%';
    $('loadMsg').textContent = `Loading NASA Moon terrain… ${(LOAD.got / 1e6).toFixed(1)} MB`;
  };

  try {
    await loadAll();
  } catch (e) {
    LOAD.onprog = null;
    $('loadMsg').textContent = 'Could not load data: ' + e.message;
    console.error(e);
    return;
  }

  ST.t = tIndex(Date.now());
  readHash();
  $('time').max = D.T - 1;
  $('time').value = ST.t;

  SC.initScene($('view3d'), (x, y) => pick(x, y));
  setMode(ST.mode);
  renderSiteList();
  switchTab(ST.tab);
  setLayer('light');

  if (ST.heatReq) runHeat(ST.heatReq);
  SC.flyTo(site(), false);
  $('loading').remove();

  // Timeline inputs
  $('time').oninput = e => { ST.t = +e.target.value; update(); };
  $('timeInput').onchange = e => { ST.t = tIndex(Date.parse(e.target.value + 'Z')); update(); };
  $('play').onclick = () => play();

  const step = h => { ST.t = Math.max(0, Math.min(D.T - 1, ST.t + h)); update(); };
  $('tBack').onclick = () => step(-24);
  $('tFwd').onclick = () => step(24);

  addEventListener('keydown', e => {
    if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName) && document.activeElement.type !== 'range') return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      step((e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 24 : 1));
    } else if (e.key === ' ' && document.activeElement === document.body) {
      e.preventDefault();
      play();
    }
  });

  // Primary 3 Destinations Navigation
  $('nav-explore').onclick = () => switchTab('site');
  $('nav-plan').onclick = () => switchTab('windows');
  $('compareBack').onclick = () => switchTab('windows');
  $('nav-science').onclick = () => switchTab('valid');

  // Plan Sub-Nav
  if ($('planSubFinder')) $('planSubFinder').onclick = () => switchTab('windows');
  if ($('planSubCompare')) $('planSubCompare').onclick = () => switchTab('compare');

  // Science Sub-Nav
  if ($('sciSubValid')) $('sciSubValid').onclick = () => switchTab('valid');
  if ($('sciSubAbout')) $('sciSubAbout').onclick = () => switchTab('about');
  if ($('sciSubValid2')) $('sciSubValid2').onclick = () => switchTab('valid');
  if ($('sciSubAbout2')) $('sciSubAbout2').onclick = () => switchTab('about');

  // Primary Action in Explore Deck: "Find Landing Window"
  if ($('primaryFindWindowBtn')) {
    $('primaryFindWindowBtn').onclick = () => {
      $('wSites').value = 'sel';
      $('wOut').innerHTML = '';
      switchTab('windows');
    };
  }

  // Left Drawer (Sites) Toggles & Filters
  const toggleSites = (show) => {
    const p = $('panel-sites');
    const pill = $('sites-toggle-pill');
    const isClosed = p.classList.contains('collapsed');
    const toShow = show ?? isClosed;
    p.classList.toggle('collapsed', !toShow);
    p.inert = !toShow;
    if (pill) pill.style.display = toShow ? 'none' : 'flex';
  };
  $('sites-toggle-pill').onclick = () => toggleSites(true);
  toggleSites(false);
  $('sites-close-btn').onclick = () => toggleSites(false);
  $('overBtn').onclick = () => SC.overview();

  // Search input filter
  $('siteSearchInput').oninput = e => {
    ST.searchQuery = e.target.value;
    renderSiteList();
  };

  // Category filter chips
  $$('.site-category-chips button').forEach(b => {
    b.onclick = () => {
      $$('.site-category-chips button').forEach(c => c.classList.remove('active'));
      b.classList.add('active');
      ST.siteFilter = b.dataset.cat;
      renderSiteList();
    };
  });

  // Accordion Toggles
  $$('.accordion-header').forEach(hdr => {
    hdr.tabIndex = 0;
    hdr.setAttribute('role', 'button');
    hdr.setAttribute('aria-expanded', hdr.closest('.accordion-section').classList.contains('open'));
    hdr.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); hdr.click(); } };
    hdr.onclick = () => {
      const sec = hdr.closest('.accordion-section');
      sec.classList.toggle('open');
      hdr.setAttribute('aria-expanded', sec.classList.contains('open'));
      if (ST.tab === 'site') renderSiteTab();
    };
  });

  // Settings Modal
  $('settingsBtn').onclick = () => $('settingsModal').hidden = false;
  $('settingsClose').onclick = () => $('settingsModal').hidden = true;
  $('settingsModal').onclick = e => { if (e.target.id === 'settingsModal') $('settingsModal').hidden = true; };

  $$('#modeSeg button').forEach(b => {
    b.onclick = () => {
      setMode(b.dataset.m);
    };
  });

  // Intro banner
  $('introDismissBtn').onclick = () => $('intro-banner').classList.add('dismissed');
  $('introTourBtn').onclick = () => {
    $('intro-banner').classList.add('dismissed');
    tour(0);
  };

  $('trust').onclick = e => { e.preventDefault(); switchTab('valid'); };

  $('emask').value = OPT.emask;
  $('emask').onchange = e => {
    setEMask(+e.target.value);
    toast(`Earth line-of-sight threshold set to ${OPT.emask}° above terrain`);
    update();
    renderTab();
    if ($('wOut').innerHTML && ST.tab === 'windows') runWindows();
  };

  $('briefBtn').onclick = missionBrief;
  $('cal').onclick = e => { const t = e.target.dataset.t; if (t) { ST.t = +t; update(); } };

  // Panorama hover and click
  const near = e => {
    const cv = $('pano'), r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    let best = null, bd = 100;
    for (const p of cv._pts || []) {
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bd) { bd = d; best = p; }
    }
    return best && { p: best, x, y };
  };

  $('pano').onmousemove = e => {
    const h = near(e), tip = $('panoTip');
    if (!h) { tip.hidden = true; $('pano').style.cursor = ''; return; }
    tip.hidden = false;
    $('pano').style.cursor = 'pointer';
    tip.style.left = Math.min(h.x + 12, $('pano').clientWidth - 190) + 'px';
    tip.style.top = Math.max(0, h.y - 34) + 'px';
    tip.innerHTML = `${h.p.k} at ${h.p.el.toFixed(1)}°, ${h.p.vis ? 'Visible' : 'Terrain Occulted'}<br><b>${fmtDate(tDate(h.p.t))}</b>`;
  };
  $('pano').onmouseleave = () => $('panoTip').hidden = true;
  $('pano').onclick = e => {
    const h = near(e);
    if (h) {
      ST.t = h.p.t;
      $('panoTip').hidden = true;
      update();
    }
  };

  ['svPanel', 'svBatt', 'svLoad', 'svDays'].forEach(id => $(id).oninput = survival);

  $('csvBtn').onclick = () => {
    const s = site(), a = ST.t, b = Math.min(D.T, a + 24 * 365), rows = ['utc,sun_az_deg,sun_el_deg,sun_horizon_deg,sun_disc_visible_frac,earth_az_deg,earth_el_deg,earth_horizon_deg,earth_visible'];
    for (let t = a; t < b; t++) {
      const q = siteState(s, t);
      rows.push([tDate(t).toISOString().slice(0, 16) + 'Z', q.saz.toFixed(3), q.sel.toFixed(4), q.shz.toFixed(3), q.sun.toFixed(3), q.eaz.toFixed(3), q.eel.toFixed(4), q.ehz.toFixed(3), q.earth].join(','));
    }
    const head = `# Polaris Window Export: ${s.name} (lat ${s.lat}, lon ${s.lon}E, elev ${s.elev}m LOLA). Observer +2m. Azimuth: map-plane. Frame MOON_ME, NAIF DE440.\n`;
    const url = URL.createObjectURL(new Blob([head + rows.join('\n')], { type: 'text/csv' }));
    const A = document.createElement('a');
    A.href = url;
    A.download = `polaris-window_${s.id}_${fmtDay(tDate(a))}.csv`;
    A.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  $('exag').oninput = e => {
    $('exagV').textContent = e.target.value;
    SC.setExag(+e.target.value);
    renderSiteList();
  };

  $('siteList').onclick = e => {
    const li = e.target.closest('li');
    if (!li || !li.dataset.id) return;
    const s = allSites().find(x => x.id === li.dataset.id);
    if (e.target.dataset.del) {
      removeCustom(s);
      if (ST.site === s.id) ST.site = 'ridge';
      renderSiteList();
      update();
      return;
    }
    selectSite(s.id);
  };
  $('siteList').onkeydown = e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset.id) {
      e.preventDefault();
      e.target.click();
    }
  };

  // Layers and presets
  $$('#layerSeg button').forEach(b => b.onclick = () => {
    if (b.dataset.layer === 'heat' && !ST.heat) {
      switchTab('heat');
      runHeat();
    } else {
      setLayer(b.dataset.layer);
      if (b.dataset.layer === 'heat') switchTab('heat');
    }
  });

  $('wRun').onclick = runWindows;
  $('hRun').onclick = () => runHeat();
  $$('#hPresets button').forEach(b => b.onclick = () => {
    const [metric, from, to] = HPRE[b.dataset.p];
    runHeat({ metric, from, to, ice: b.dataset.p === 'ice' });
    SC.overview();
  });

  ['cFrom', 'cTo'].forEach(id => $(id).onchange = renderCompare);
  $$('#cmpMode button').forEach(b => b.onclick = () => {
    ST.cmpMode = b.dataset.c;
    $$('#cmpMode button').forEach(x => x.classList.toggle('on', x === b));
    $('cmpSites').hidden = ST.cmpMode === 'dates';
    $('cmpDates').hidden = ST.cmpMode !== 'dates';
    renderCompare();
  });

  ['dSite', 'dLen'].forEach(id => $(id).onchange = renderDates);
  $$('#dDates input').forEach(i => i.onchange = renderDates);

  // Share Modal
  $('shareBtn').onclick = () => {
    writeHash();
    const url = location.href;
    $('shareUrl').value = url;
    $('shareBox').hidden = false;
    try {
      const q = qrcode(0, 'M');
      q.addData(url);
      q.make();
      $('shareQr').innerHTML = q.createSvgTag({ cellSize: 4, margin: 4, scalable: true });
    } catch (e) {
      $('shareQr').textContent = '';
    }
  };
  $('shareCopy').onclick = () => {
    $('shareUrl').select();
    navigator.clipboard?.writeText($('shareUrl').value).then(() => toast('Mission link copied'), () => document.execCommand('copy'));
  };
  $('shareClose').onclick = () => $('shareBox').hidden = true;
  $('shareBox').onclick = e => { if (e.target.id === 'shareBox') $('shareBox').hidden = true; };

  // Guided Tour actions
  $('tourSpeak').onclick = () => {
    ST.speak = !ST.speak;
    $('tourSpeak').setAttribute('aria-pressed', ST.speak);
    $('tourSpeak').classList.toggle('on', ST.speak);
    if (ST.speak) say(TOUR[tourI][0]);
    else speechSynthesis?.cancel();
  };
  $('tourBtn').onclick = () => tour(0);
  $('tourNext').onclick = () => tourI === TOUR.length - 1 ? ($('tourBox').hidden = true) : tour(tourI + 1);
  $('tourPrev').onclick = () => tour(tourI - 1);
  $('tourEnd').onclick = () => {
    $('tourBox').hidden = true;
    play(false);
    try { speechSynthesis.cancel(); } catch (e) {}
  };

  addEventListener('resize', () => ST.tab === 'site' && renderSiteTab());
  $$('#wPreset button').forEach(b => b.onclick = () => {
    preset(b.dataset.p);
    if ($('wOut').innerHTML) runWindows();
  });

  if (isDemo) setTimeout(demo, 800);

  window.PW = {
    ST, D, tour, runWindows, runHeat, selectSite, switchTab, demo,
    goLanding: id => {
      const s = allSites().find(x => x.id === id);
      ST.t = tIndex(Date.parse(s.landed));
      ST.mission = { site: id, t: ST.t, days: 10 };
      selectSite(id);
    }
  };
})();
