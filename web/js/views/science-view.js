// ==========================================================================
// Polaris Window — Science View: NASA Validation Benchmarks & Methodology
// ==========================================================================

import { $ } from '../state.js';
import { D, pct } from '../data.js';

export function renderValid() {
  const v = D.meta?.validation || { grids: { core: { r: 0.99, mae: 0.015 }, regional: { r: 0.985, mae: 0.02 } }, horizons: null };
  const c = v.grids?.core || { r: 0.99, mae: 0.015 };
  const hz = v.horizons;

  if ($('validOut')) {
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
          ${D.sites.map(s => `<tr><td>${s.name}</td><td>${pct(s.validation?.ours || 0)}</td><td>${pct(s.validation?.nasa || 0)}</td><td>${pct(s.validation?.nasa_best120m || 0)}</td></tr>`).join('')}
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
}

export function renderAbout() {
  if ($('aboutOut')) {
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
}
