// ==========================================================================
// Polaris Window — Multi-Site Comparison & Lunation Telemetry Charts
// ==========================================================================

import { $, $$, ST, COLORS } from './state.js';
import { allSites, stats, tIndex, tDate, fmtDay, pct, hrs, HOUR } from './data.js';
import { toast } from './ui-components.js';
import { renderDates } from './window-finder.js';

let cmpChart = null;
let cmpChart2 = null;

export function renderCompare() {
  if (ST.cmpMode === 'dates') return renderDates();

  const cmpPick = $('cmpPick');
  if (cmpPick) {
    cmpPick.innerHTML = allSites().map(s => `
      <label style="display:inline-flex;align-items:center;gap:4px;background:var(--obsidian-surface-2);padding:2px 8px;border-radius:var(--radius-sm);margin:2px;">
        <input type="checkbox" value="${s.id}" ${ST.cmp.includes(s.id) ? 'checked' : ''}>${s.name}
      </label>
    `).join('');
  }

  $$('#cmpPick input').forEach(i => {
    i.onchange = () => {
      const v = $$('#cmpPick input:checked').map(x => x.value);
      if (v.length > 4) {
        i.checked = false;
        toast('Select up to 4 sites for comparison');
        return;
      }
      ST.cmp = v;
      renderCompare();
    };
  });

  const a = tIndex(Date.parse($('cFrom').value));
  const b = tIndex(Date.parse($('cTo').value) + 24 * HOUR);
  const S = ST.cmp.map(id => allSites().find(s => s.id === id)).filter(Boolean);
  const M = S.map(s => stats(s, a, b));

  const best = (k, hi = true) => {
    const v = M.map(m => m[k]);
    return hi ? Math.max(...v) : Math.min(...v);
  };
  const row = (lbl, k, f, hi = true) => `<tr><td>${lbl}</td>${M.map(m => `<td class="${m[k] === best(k, hi) && S.length > 1 ? 'good' : ''}">${f(m[k])}</td>`).join('')}</tr>`;

  if ($('cmpTable')) {
    $('cmpTable').innerHTML = `<table class="telemetry-table"><tr><th>Site</th>${S.map((s, i) => `<th style="color:${COLORS[i]}">${s.name}</th>`).join('')}</tr>` +
      row('Sunlight', 'sun', pct) + row('Earth visible', 'earth', pct) + row('Sun + Earth', 'both', pct) + row('Longest darkness', 'maxDark', hrs, false) +
      row('Longest blackout', 'maxBlk', hrs, false) + row('Avg power (10 m²)', 'powerW', v => Math.round(v) + ' W') + row('Total Energy', 'energyKWh', v => (v / 1000).toFixed(1) + ' MWh') + '</table>';
  }

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
  if ($('cmpChart')) {
    cmpChart = new Chart($('cmpChart'), {
      type: 'line',
      data: { labels, datasets: ds('sun', m => +(m.sun * 100).toFixed(1)) },
      options: opts('Sunlight % per Lunation', 100)
    });
  }
  if ($('cmpChart2')) {
    cmpChart2 = new Chart($('cmpChart2'), {
      type: 'bar',
      data: { labels, datasets: ds('blk', m => +(m.maxBlk / 24).toFixed(1)) },
      options: opts('Max Comms Blackout per Lunation (Days)')
    });
  }
}
