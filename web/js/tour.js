// ==========================================================================
// Polaris Window — Guided Tour & 30-Second Automated Demo Narration
// ==========================================================================

import { $, ST, site } from './state.js';
import { D, tIndex } from './data.js';
import * as SC from './scene.js';
import { switchTab } from './router.js';
import { selectSite } from './site-selector.js';
import { play } from './timeline.js';
import { setLayer, runHeat } from './heatmaps.js';
import { runWindows } from './window-finder.js';

let tourIndex = 0;

function say(text) {
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = 0.98;
    speechSynthesis.speak(u);
  } catch (e) {}
}

export function tourStep(delta = 1) {
  const steps = getTourSteps();
  tourIndex = Math.max(0, Math.min(steps.length - 1, tourIndex + delta));
  $('tourBox').hidden = false;
  $('tourText').textContent = steps[tourIndex][0];
  if (ST.speak) say(steps[tourIndex][0]);
  $('tourStep').textContent = `${tourIndex + 1} / ${steps.length}`;
  $('tourNext').textContent = tourIndex === steps.length - 1 ? 'Finish' : 'Next ›';
  steps[tourIndex][1]();
}

export function startTour() {
  tourIndex = 0;
  tourStep(0);
}

export function tourClose() {
  $('tourBox').hidden = true;
  speechSynthesis.cancel();
}

export function getTourSteps() {
  return [
    ['The Moon\'s south pole is rendered from NASA LRO laser altimetry. Solar elevation varies with location and date; near the pole, low angles make terrain shadows important.', () => { SC.overview(); setLayer('light'); play(true); }],
    ['Inspect Shackleton Rim. This model estimates sunlight, not ice deposits or surface temperature.', () => { selectSite('shackleton'); }],
    ['Outlines indicate NASA Artemis III candidate landing regions from official USGS footprints.', () => { play(false); SC.overview(); }],
    ['Connecting Ridge illustrates sunlight and Earth visibility tradeoffs. Read the evaluation period alongside the percentages.', () => { play(false); switchTab('site'); selectSite('ridge'); }],
    ['The skyline panorama projects terrain silhouettes with Sun and Earth paths. When Earth is occulted, direct-to-Earth communication is lost.', () => { const s = site(); SC.setExag(1); SC.flyTo(s, true); }],
    ['The battery survival simulator charges a virtual lander hour-by-hour using modeled solar illumination and simplified battery assumptions.', () => { SC.setExag(3); SC.overview(); switchTab('site'); selectSite('a3_malapert_massif', false); ST.t = tIndex(Date.parse('2027-04-10T00:00Z')); }],
    ['Heatmaps estimate illumination, Earth visibility and coarse slope. Neither ice deposits nor landing safety are established.', () => { switchTab('heat'); runHeat({ metric: 'sun', from: '2027-01-01', to: '2027-12-31' }); SC.setExag(3); SC.overview(); }],
    ['Side-by-side comparison tracks illumination availability and comms blackout durations across lunations.', () => switchTab('compare')],
    ['The finder samples landing starts every six hours within your chosen date range.', () => { switchTab('windows'); runWindows(); }],
    ['Science shows recorded comparisons with NASA PGDA maps and sampled JPL Horizons ephemeris. These checks do not certify every prediction or flight use.', () => switchTab('valid')]
  ];
}

export function demo() {
  const cap = (html, isTitle) => {
    const c = $('caption');
    if (!c) return;
    c.innerHTML = html;
    c.className = isTitle ? 'title' : '';
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
