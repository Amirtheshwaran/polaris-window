// ==========================================================================
// Polaris Window — Centralized Application State & Hash Synchronization
// ==========================================================================

import { allSites, D, addCustom, setEMask, OPT, tIndex, tDate } from './data.js';

export const $ = id => document.getElementById(id);
export const $$ = q => [...document.querySelectorAll(q)];

export const ST = {
  site: 'ridge',
  t: 0,
  tab: 'site',
  layer: 'light',
  mode: 'explore',
  cmp: ['ridge', 'a3_malapert_massif', 'a3_mons_mouton', 'a3_haworth'],
  playing: false,
  heat: null,
  siteFilter: 'all',
  searchQuery: '',
  mission: null,
  heatReq: null,
  speak: false
};

export const ALIAS = {
  malapert: 'a3_malapert_massif',
  nobile: 'a3_nobile_rim_1',
  mouton: 'a3_mons_mouton',
  haworth: 'a3_haworth',
  degerlache: 'a3_de_gerlache_rim_2'
};

export const site = () => allSites().find(s => s.id === ST.site) || D.sites[0];

export const COLORS = ['#E9E7E1', '#B8B6B0', '#888680', '#5E5D58'];

export function readHash() {
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

export function writeHash() {
  const s = site();
  if (!s) return;
  const p = new URLSearchParams({
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
