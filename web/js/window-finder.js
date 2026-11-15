// ==========================================================================
// Polaris Window — Landing Window Analysis, Ranking & Mission Feasibility
// ==========================================================================

import { $, $$, ST, site, COLORS } from './state.js';
import { allSites, findWindows, rankWin, D, series, stats, tDate, tIndex, fmtDate, fmtDay, pct, hrs } from './data.js';
import { switchTab } from './router.js';
import { selectSite } from './site-selector.js';

export const PRESETS = {
  bal: [60, 50, 72, 96],
  power: [80, 0, 48, 2000],
  comms: [40, 80, 240, 48]
};

let dChart = null;

export function initWindowFinder() {
  $$('#wPreset button').forEach(b => {
    b.onclick = () => {
      $$('#wPreset button').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      const p = PRESETS[b.dataset.p];
      if (p) {
        [$('wSun').value, $('wEarth').value, $('wDark').value, $('wBlack').value] = p;
        runWindows();
      }
    };
  });

  const goBtn = $('wGo');
  if (goBtn) goBtn.onclick = runWindows;

  ['dSite', 'dLen'].forEach(id => {
    const el = $(id);
    if (el) el.onchange = renderDates;
  });

  $$('#dDates input').forEach(i => i.onchange = renderDates);

  ['svPanel', 'svBatt', 'svLoad', 'svDays'].forEach(id => {
    const el = $(id);
    if (el) el.oninput = survival;
  });
}

export function runWindows() {
  const c = {
    days: +$('wLen').value,
    minSun: +$('wSun').value,
    minEarth: +$('wEarth').value,
    maxDark: +$('wDark').value,
    maxBlack: +$('wBlack').value,
    from: Date.parse($('wFrom').value),
    to: Date.parse($('wTo').value)
  };

  const list = $('wSites').value === 'all'
    ? allSites()
    : $('wSites').value === 'artemis'
      ? allSites().filter(x => x.artemis)
      : [site()];

  const res = list.map(s => ({ s, r: findWindows(s, c) }))
    .sort((a, b) => !a.r.picked[0] ? 1 : !b.r.picked[0] ? -1 : rankWin(a.r.picked[0], b.r.picked[0]));
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
    const r = res[+cv.dataset.i].r;
    const dpr = devicePixelRatio || 1;
    const W = cv.width = cv.clientWidth * dpr;
    const H = cv.height = 18 * dpr;
    const g = cv.getContext('2d');
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

export function renderDates() {
  $('dSite').innerHTML = allSites().map(s => `<option value="${s.id}" ${s.id === ST.site ? 'selected' : ''}>${s.name}</option>`).join('');
  const s = allSites().find(x => x.id === $('dSite').value) || site();
  const L = Math.max(1, +$('dLen').value) * 24;
  const D8 = $$('#dDates input').map(i => i.value).filter(Boolean).map(v => tIndex(Date.parse(v)));
  const ser = series(s);
  const M = D8.map(a => {
    const b = Math.min(D.T, a + L);
    const m = stats(s, a, b);
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

export function survival() {
  const s = site();
  const ser = series(s);
  const P = +$('svPanel').value;
  const B = +$('svBatt').value;
  const L = +$('svLoad').value;
  const days = +$('svDays').value;

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

  const cv = $('svChart');
  if (!cv) return;
  const dpr = devicePixelRatio || 1;
  const W = cv.width = cv.clientWidth * dpr;
  const H = cv.height = 90 * dpr;
  const g = cv.getContext('2d');
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

export function calendar(s = site()) {
  const ser = series(s);
  const d0 = tDate(ST.t);
  const y = d0.getUTCFullYear();
  const m0 = d0.getUTCMonth();
  let h = '';
  for (let mi = 0; mi < 12; mi++) {
    const mm = (m0 + mi) % 12;
    const yy = y + Math.floor((m0 + mi) / 12);
    const first = Date.UTC(yy, mm, 1);
    const nd = new Date(Date.UTC(yy, mm + 1, 0)).getUTCDate();
    let cells = '';
    for (let d = 1; d <= nd; d++) {
      const a = tIndex(first + (d - 1) * 864e5);
      if (a + 24 > D.T) break;
      let sh = 0, eh = 0;
      for (let t = a; t < a + 24; t++) {
        sh += ser.sun[t] >= 125;
        eh += ser.earth[t];
      }
      const c = sh === 0 ? 0 : sh === 24 && eh === 24 ? 3 : eh === 0 ? 1 : 2;
      cells += `<i class="cl c${c}" data-t="${a}" title="${yy}-${String(mm + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}: Sun ${sh}h, Earth ${eh}h"></i>`;
    }
    h += `<div class="calrow"><span>${new Date(first).toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })} ${String(yy).slice(2)}</span>${cells}</div>`;
  }
  if ($('cal')) $('cal').innerHTML = h;
}
