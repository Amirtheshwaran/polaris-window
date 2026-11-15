// ==========================================================================
// Polaris Window — Site Selection, Drawer Filtering & Custom Site Creation
// ==========================================================================

import { $, $$, ST, site } from './state.js';
import { allSites, addCustom, removeCustom } from './data.js';
import * as SC from './scene.js';
import { toast } from './ui-components.js';

let onSelectCallback = null;

export function initSiteSelector(onSelect) {
  onSelectCallback = onSelect;

  $('sites-toggle-pill').onclick = () => {
    $('panel-sites').classList.remove('collapsed');
    $('panel-sites').inert = false;
    $('sites-toggle-pill').style.display = 'none';
  };

  $('sitesCloseBtn').onclick = () => {
    $('panel-sites').classList.add('collapsed');
    $('panel-sites').inert = true;
    $('sites-toggle-pill').style.display = 'flex';
  };

  $('siteSearch').oninput = e => {
    ST.searchQuery = e.target.value;
    renderSiteList();
  };

  $$('.site-category-chips button').forEach(b => {
    b.onclick = () => {
      $$('.site-category-chips button').forEach(c => c.classList.remove('active'));
      b.classList.add('active');
      ST.siteFilter = b.dataset.cat;
      renderSiteList();
    };
  });

  $('siteList').onclick = e => {
    const li = e.target.closest('.site-item');
    if (!li) return;
    const s = allSites().find(x => x.id === li.dataset.id);
    if (!s) return;
    if (e.target.dataset.del) {
      removeCustom(s);
      toast(`Removed ${s.name}`);
      if (ST.site === s.id) ST.site = 'ridge';
      renderSiteList();
      onSelectCallback?.(ST.site, false);
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
}

export function renderSiteList() {
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

export function selectSite(id, fly = true) {
  ST.site = id;
  $('panel-sites').classList.add('collapsed');
  $('panel-sites').inert = true;
  $('sites-toggle-pill').style.display = 'flex';
  renderSiteList();
  const s = site();
  if (fly && s) SC.flyTo(s, false);
  onSelectCallback?.(id, fly);
}

export function pick(x, y, name) {
  const s = addCustom(x, y, name);
  if (!s) return toast('Location lies outside analyzed terrain region');
  toast(`Added ${s.name} at ${Math.abs(s.lat).toFixed(3)}°S, ${s.lon.toFixed(1)}°E`);
  selectSite(s.id, false);
}
