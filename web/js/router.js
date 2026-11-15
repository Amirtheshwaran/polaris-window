// ==========================================================================
// Polaris Window — Routing & Primary Destination Navigation
// Minimalist Observatory Experience: Obsidian (#101113) & Lunar White (#E9E7E1)
// ==========================================================================

import { $, $$, ST, writeHash } from './state.js';

let viewHandlers = {};

export function registerViews(views) {
  viewHandlers = { ...viewHandlers, ...views };
}

export function updateDestinationNav() {
  const dest = (ST.tab === 'windows' || ST.tab === 'compare') ? 'plan'
             : (ST.tab === 'valid' || ST.tab === 'about') ? 'science'
             : 'explore';

  $$('nav.primary-nav button').forEach(b => {
    b.classList.toggle('active', b.dataset.dest === dest);
  });

  // Sub-mode pill highlights
  if ($('planSubFinder')) $('planSubFinder').classList.toggle('on', ST.tab === 'windows');
  if ($('planSubCompare')) $('planSubCompare').classList.toggle('on', ST.tab === 'compare');
  if ($('sciSubValid')) $('sciSubValid').classList.toggle('on', ST.tab === 'valid');
  if ($('sciSubAbout')) $('sciSubAbout').classList.toggle('on', ST.tab === 'about');
}

export function switchTab(tabId) {
  ST.tab = tabId;
  $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tabId));
  $$('.tab').forEach(d => d.classList.toggle('on', d.id === 'tab-' + tabId));
  updateDestinationNav();

  const deck = $('panel-deck');
  const summary = $('site-summary-card');
  const deckTitle = $('deckPanelTitle');

  if (tabId === 'site') {
    // In Explore mode: show discrete summary card, deck is collapsed unless explicitly opened
    if (summary) summary.style.display = '';
    if (deck && !deck.dataset.explicitOpen) {
      deck.classList.add('collapsed');
    }
    if (deckTitle) deckTitle.textContent = 'Site Details & Horizons';
  } else {
    // In Plan, Science or Heatmap mode: hide summary card and open contextual deck
    if (summary) summary.style.display = 'none';
    if (deck) {
      deck.classList.remove('collapsed');
    }
    // Ensure Locations drawer is closed so only one panel is open
    const sites = $('panel-sites');
    if (sites && !sites.classList.contains('collapsed')) {
      sites.classList.add('collapsed');
      sites.inert = true;
      $('sites-toggle-pill')?.classList.remove('active');
    }

    if (deckTitle) {
      if (tabId === 'windows') deckTitle.textContent = 'Landing Date Finder';
      else if (tabId === 'compare') deckTitle.textContent = 'Side-by-Side Comparison';
      else if (tabId === 'valid') deckTitle.textContent = 'NASA Map Validation';
      else if (tabId === 'about') deckTitle.textContent = 'How the Science Works';
      else if (tabId === 'heat') deckTitle.textContent = 'Regional Heatmaps';
    }
  }

  renderTab();
  writeHash();
}

export function renderTab() {
  viewHandlers[ST.tab]?.();
}

export function setMode(modeId) {
  ST.mode = modeId;
  document.body.className = modeId;
  $$('#modes button').forEach(b => b.classList.toggle('on', b.dataset.mode === modeId));
  $$('#modeSeg button').forEach(b => b.classList.toggle('on', b.dataset.m === modeId));
  writeHash();
}
