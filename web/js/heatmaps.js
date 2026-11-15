// ==========================================================================
// Polaris Window — Regional Illumination & Comms Heatmaps
// ==========================================================================

import { $, $$, ST, writeHash } from './state.js';
import { D, gridAverage, SAFE_SLOPE, pct, tIndex, HOUR } from './data.js';
import * as SC from './scene.js';
import { toast } from './ui-components.js';
import { pick } from './site-selector.js';

export const HPRE = {
  sun27: ['sun', '2027-01-01', '2027-12-31'],
  ice: ['sun', '2025-01-01', '2030-12-30'],
  comms: ['earth', '2027-01-01', '2027-12-31'],
  land: ['land', '2027-01-01', '2027-12-31']
};

export const HEATL = {
  sun: 'Sunlight',
  earth: 'Earth Visibility',
  both: 'Sun AND Earth',
  slope: 'Flat Ground',
  land: 'Optimal Spots'
};

let updateCallback = null;

export function initHeatmaps(onUpdate) {
  updateCallback = onUpdate;

  const hRun = $('hRun');
  if (hRun) hRun.onclick = () => runHeat();

  $$('#hPresets button').forEach(b => {
    b.onclick = () => {
      const p = HPRE[b.dataset.p];
      if (p) runHeat({ metric: p[0], from: p[1], to: p[2], ice: b.dataset.p === 'ice' });
    };
  });

  $$('#layerSeg button').forEach(b => {
    b.onclick = () => {
      if (b.dataset.layer === 'heat' && !ST.heat) {
        runHeat({ metric: 'sun', from: '2026-11-15', to: '2027-11-15' });
        return;
      }
      setLayer(b.dataset.layer);
    };
  });
}

export async function runHeat(req) {
  const metric = req?.metric || $('hMetric').value;
  const from = req?.from || $('hFrom').value;
  const to = req?.to || $('hTo').value;

  if ($('hMetric')) $('hMetric').value = metric;
  if ($('hFrom')) $('hFrom').value = from;
  if ($('hTo')) $('hTo').value = to;

  const a = tIndex(Date.parse(from));
  const b = tIndex(Date.parse(to) + 24 * HOUR);
  if (b <= a) return toast('End date must be after start date');

  if ($('hRun')) $('hRun').disabled = true;
  const out = {};
  for (const name of ['core', 'regional']) {
    out[name] = await gridAverage(D.grids[name], a, b, metric, p => {
      if ($('hOut')) $('hOut').textContent = `Calculating ${name} terrain horizon grid… ${(p * 100).toFixed(0)}%`;
    });
  }

  let vmax = 1;
  if (metric === 'both' || metric === 'land') {
    vmax = 0.05;
    for (const v of out.core) vmax = Math.max(vmax, v);
    for (const v of out.regional) vmax = Math.max(vmax, v);
  }
  ST.heatMax = vmax;
  for (const name in out) SC.setHeat(name, out[name], vmax);
  if ($('hRun')) $('hRun').disabled = false;
  ST.heat = { metric, from, to };
  setLayer('heat');

  const c = out.core;
  let best = 0, bi = 0;
  for (let i = 0; i < c.length; i++) {
    if (c[i] > best) {
      best = c[i];
      bi = i;
    }
  }
  const label = HEATL[metric] || metric;
  let psr = 0;
  if (metric === 'sun') {
    for (const v of c) psr += v === 0;
  }

  let msg = '';
  if (req && req.ice) {
    msg += '<b>Cold Traps:</b> Dark regions received 0% sunlight from 2025 to 2030. This sampled interval does not establish permanent shadow, temperature or ice. ';
  }
  if (metric === 'slope') {
    let safe = 0;
    for (const v of D.grids.core.slope) safe += v <= SAFE_SLOPE;
    if ($('hOut')) {
      $('hOut').innerHTML = `Slopes calculated from NASA LOLA at 80 m baseline. ${(safe / c.length * 100).toFixed(0)}% of central 80 km region has slopes ≤ ${SAFE_SLOPE}°.`;
    }
    writeHash();
    return;
  }

  msg += `${label} from ${from} to ${to}. Maximum cell value in central 80 km: <b>${pct(best)}</b>.`;
  if (metric === 'land') msg += ` Constrained to terrain slope ≤ ${SAFE_SLOPE}°.`;
  if (metric === 'sun') msg += ` ${(psr / c.length * 100).toFixed(1)}% of central core has no sunlight in the sampled interval; this does not establish permanent shadow.`;
  msg += ` <a href="#" id="heatBest" style="display:inline-block;margin-top:4px;">Drop site at optimal point</a>`;
  if ($('hOut')) $('hOut').innerHTML = msg;

  if ($('heatBest')) {
    $('heatBest').onclick = e => {
      e.preventDefault();
      const n = D.grids.core.n, h = D.grids.core.half;
      const i = Math.floor(bi / n), j = bi % n;
      pick((j + 0.5) / n * 2 * h - h, h - (i + 0.5) / n * 2 * h, 'Optimal ' + label);
    };
  }
  writeHash();
}

export function setLayer(layerName) {
  ST.layer = layerName;
  SC.setMode(layerName);
  $$('#layerSeg button').forEach(b => b.classList.toggle('on', b.dataset.layer === layerName));
  const g = 'linear-gradient(90deg,#101113,#2d3038,#5c606d,#8e929f,#c6c5c0,#E9E7E1,#ffffff)';
  if ($('legend')) {
    $('legend').innerHTML = layerName === 'heat' && ST.heat
      ? (ST.heat.metric === 'slope'
          ? `<div style="font-size:11px;color:var(--text-muted)">Terrain slope scale</div><div class="bar" style="height:6px;border-radius:3px;margin:3px 0;background:${g}"></div><div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-muted)"><span>20°+ steep</span><span>10°</span><span>0° flat</span></div>`
          : `<div style="font-size:11px;color:var(--text-muted)">${HEATL[ST.heat.metric]} scale</div><div class="bar" style="height:6px;border-radius:3px;margin:3px 0;background:${g}"></div><div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-muted)"><span>0%</span><span>${pct((ST.heatMax || 1) / 2).replace('.0%', '%')}</span><span>${pct(ST.heatMax || 1).replace('.0%', '%')}</span></div>`)
      : '';
  }
  updateCallback?.();
}
