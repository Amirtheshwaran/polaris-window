// ==========================================================================
// Polaris Window — Routing & Primary Destination Navigation
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
