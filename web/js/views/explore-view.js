// ==========================================================================
// Polaris Window — Explore View: Site Details, Metrics & Horizon Silhouette
// ==========================================================================

import { $, $$, ST, site } from '../state.js';
import { D, siteState, stats, series, SAFE_SLOPE, pct, hrs } from '../data.js';
import * as SC from '../scene.js';
import { drawPano, drawStrip } from '../pano.js';
import { toast } from '../ui-components.js';
import { horizonsURL } from '../reports.js';
import { survival, calendar } from '../window-finder.js';

export function stat(v, l, cls = '') {
  return `<div class="stat ${cls}"><b>${v}</b><span>${l}</span></div>`;
}

export function nextChange(arr, t, vis) {
  const now = vis(arr[t]);
  for (let k = t + 1; k < Math.min(D.T, t + 24 * 400); k++) {
    if (vis(arr[k]) !== now) return k - t;
  }
  return -1;
}

export const dur = h => h < 24 ? `${h} hour${h === 1 ? '' : 's'}` : `${Math.floor(h / 24)} day${h >= 48 ? 's' : ''}${h % 24 ? ' ' + (h % 24) + ' h' : ''}`;

export function countdown(s) {
  const { sun, earth } = series(s);
  const t = ST.t;
  const ns = nextChange(sun, t, v => v >= 125);
  const ne = nextChange(earth, t, v => v === 1);
  const sunUp = sun[t] >= 125;
  const earthUp = earth[t] === 1;

  const a = ns < 0
    ? (sunUp ? 'Sun does not set here for over a year.' : 'Sun does not rise here for over a year.')
    : sunUp ? `Sun sets in <b>${dur(ns)}</b>.` : `Sun rises in <b>${dur(ns)}</b>.`;

  const b = ne < 0
    ? (earthUp ? 'Earth stays in view for over a year.' : 'Earth stays occulted for over a year.')
    : earthUp ? `Earth occulted behind ridges in <b>${dur(ne)}</b>.` : `Earth rises in <b>${dur(ne)}</b>.`;

  return `<div style="font-size:11px;color:var(--text-muted);margin-top:6px;">${a} ${b}</div>`;
}

export function verdict(s, m, st) {
  const pw = m.sun > 0.75 ? 'exceptional solar illumination' : m.sun > 0.55 ? 'favorable solar power' : m.sun > 0.2 ? 'intermittent sunlight' : 'continuous shadow';
  const cm = m.earth > 0.75 ? 'continuous direct-to-Earth contact' : m.earth > 0.45 ? 'Earth line-of-sight available half the time' : m.earth > 0.05 ? 'frequent terrain occultations' : 'no direct-to-Earth link (requires lunar relay)';
  const sl = s.slope == null ? '' : s.slope <= SAFE_SLOPE ? ` Modeled slope ${s.slope}° meets the ${SAFE_SLOPE}° screening limit; unresolved hazards still matter.` : ` Steep terrain (${s.slope}° slope).`;
  const story = s.story ? `<div style="background:var(--obsidian-surface-2);border-left:3px solid var(--lunar-white);padding:6px 10px;margin-bottom:8px;font-size:11px;color:var(--text-secondary);"><b style="color:var(--text-primary)">Mission Context:</b> ${s.story}</div>` : '';
  return `
    ${story}
    <div style="font-size:12px;color:var(--text-secondary);line-height:1.4;">
      <b>${s.name}</b> features ${pw} and ${cm}.${sl}
    </div>
    ${countdown(s)}
  `;
}

export function renderSiteTab() {
  const s = site();
  if (!s) return;
  const st = siteState(s, ST.t);
  if ($('siteName')) $('siteName').textContent = s.name;

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

  if ($('siteMeta')) {
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
  }

  const stand = look => e => {
    e.preventDefault();
    SC.setExag(1);
    if ($('exag')) $('exag').value = 1;
    if ($('exagV')) $('exagV').textContent = 1;
    SC.flyTo(s, true, look);
  };
  if ($('standBtn')) $('standBtn').onclick = stand('sun');
  if ($('standEarth')) $('standEarth').onclick = stand('earth');

  if ($('pano')) drawPano($('pano'), s, ST.t);
  if ($('siteStrip')) drawStrip($('siteStrip'), s, ST.t, ST.mission && ST.mission.t === ST.t && ST.mission.site === s.id ? ST.mission.days : 0);

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
      $('metricSlopeSub').textContent = s.slope <= SAFE_SLOPE ? `Safe slope (<${SAFE_SLOPE}°)` : `Steep slope (>${SAFE_SLOPE}°)`;
      $('metricSlopeSub').style.color = 'var(--text-muted)';
    } else {
      $('metricSlopeValue').textContent = '–';
      $('metricSlopeSub').textContent = 'DEM Boundary';
    }
  }

  if ($('verdict')) $('verdict').innerHTML = verdict(s, m, st);
  survival();
  calendar(s);

  if ($('siteStats')) {
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
}
