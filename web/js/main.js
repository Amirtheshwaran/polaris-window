// ==========================================================================
// Polaris Window — Minimalist Lunar Mission Planner
// NASA Space Apps Challenge 2026
// Application Bootstrapper & Lifecycle Orchestrator
// ==========================================================================

import { $, $$, ST, site, readHash, writeHash } from './state.js';
import { D, loadAll, allSites, siteState, tDate, tIndex, fmtDate, fmtDay, OPT, setEMask } from './data.js';
import * as SC from './scene.js';
import { switchTab, registerViews, setMode, updateDestinationNav } from './router.js';
import { initSiteSelector, renderSiteList, selectSite, pick } from './site-selector.js';
import { initTimeline, syncTimelineDisplay, play, step } from './timeline.js';
import { toast, initAccordions, openModal, closeModal } from './ui-components.js';
import { renderSiteTab } from './views/explore-view.js';
import { initWindowFinder, runWindows, renderDates } from './window-finder.js';
import { renderCompare } from './compare.js';
import { initHeatmaps, runHeat, setLayer, HPRE } from './heatmaps.js';
import { renderValid, renderAbout } from './views/science-view.js';
import { initShareModal, missionBrief } from './reports.js';
import { tourStep, tourNext, startTour, tourClose, demo } from './tour.js';

let rafPending = false;

export function update() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    const s = site();
    if (!s) return;
    const st = siteState(s, ST.t);
    const d = tDate(ST.t);

    syncTimelineDisplay(ST.t);
    SC.setTime(ST.t);
    SC.setRays(s, st);

    if ($('hudSite')) $('hudSite').textContent = s.name;
    const sunBadge = st.sun > 0.5
      ? '<span style="color:var(--lunar-white);font-weight:600">Sunlit</span>'
      : '<span style="color:var(--text-muted)">Shadow</span>';
    const earthBadge = st.earth
      ? '<span style="color:var(--lunar-white);font-weight:600">Earth in view</span>'
      : '<span style="color:var(--text-muted)">Earth blocked</span>';

    if ($('hudSun')) {
      $('hudSun').innerHTML = `
        ${fmtDate(d).slice(0, 16)} UTC · Sun ${st.sel.toFixed(2)}° · Earth ${st.eel.toFixed(1)}°
        <div style="display:flex;gap:8px;margin-top:4px;">${sunBadge} · ${earthBadge}</div>
      `;
    }

    if (ST.tab === 'site') renderSiteTab();
    writeHash();
  });
}

// ------------------------------------------------------------- Application Bootstrap
(async function initApp() {
  const gl = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl');
  if (!gl) {
    if ($('loadMsg')) $('loadMsg').innerHTML = 'Polaris Window requires WebGL 3D graphics support. Please open in an updated browser.';
    const spin = document.querySelector('.spin');
    if (spin) spin.style.display = 'none';
    return;
  }

  const isDemo = /demo=1/.test(location.hash);
  const startHash = location.hash; // captured before the app rewrites the hash with its state

  D.LOAD = { got: 0, total: 10.2e6 };
  const pfill = $('pfill');
  const loadMsg = $('loadMsg');

  try {
    await loadAll();
  } catch (e) {
    if (loadMsg) loadMsg.textContent = 'Could not load data: ' + e.message;
    console.error('Data load failed:', e);
    return;
  }

  ST.t = tIndex(Date.now());
  readHash();
  if ($('time')) {
    $('time').max = D.T - 1;
    $('time').value = ST.t;
  }

  // Register views with router
  registerViews({
    site: renderSiteTab,
    windows: () => { if (!$('wOut')?.innerHTML) runWindows(); },
    compare: renderCompare,
    valid: renderValid,
    about: renderAbout
  });

  // Initialize modules
  SC.initScene($('view3d'), (x, y) => pick(x, y));
  setMode(ST.mode);
  initSiteSelector((id, fly) => {
    update();
    renderSiteTab();
  });
  initTimeline(update);
  initWindowFinder();
  initHeatmaps(update);
  initShareModal();
  initAccordions(() => {
    if (ST.tab === 'site') renderSiteTab();
  });

  renderSiteList();
  switchTab(ST.tab);
  setLayer(ST.layer || 'light');

  if (ST.heatReq) runHeat(ST.heatReq);
  SC.flyTo(site(), false);

  const loadingEl = $('loading');
  if (loadingEl) loadingEl.remove();

  // First-visit welcome: explains the app in three steps. Skipped for deep links and demo mode.
  const introBox = $('introBox');
  const closeIntro = () => {
    if (introBox) introBox.hidden = true;
    try { localStorage.setItem('pw_intro_seen', '1'); } catch (_) {}
  };
  let introSeen = false;
  try { introSeen = localStorage.getItem('pw_intro_seen') === '1'; } catch (_) {}
  if (introBox && !isDemo && !introSeen && !/site=|tab=/.test(startHash)) introBox.hidden = false;
  if ($('introGo')) $('introGo').onclick = closeIntro;
  if ($('introTour')) $('introTour').onclick = () => { closeIntro(); startTour(); };
  if (introBox) introBox.onclick = e => { if (e.target === introBox) closeIntro(); };

  // ------------------------------------------------------------- Event Wiring
  // Primary 3 Destinations Navigation
  $('nav-explore').onclick = () => switchTab('site');
  $('nav-plan').onclick = () => switchTab('windows');
  $('compareBack').onclick = () => switchTab('windows');
  $('nav-science').onclick = () => switchTab('valid');

  // Plan Sub-Nav
  if ($('planSubFinder')) $('planSubFinder').onclick = () => switchTab('windows');
  if ($('planSubCompare')) $('planSubCompare').onclick = () => switchTab('compare');

  // Science Sub-Nav
  if ($('sciSubValid')) $('sciSubValid').onclick = () => switchTab('valid');
  if ($('sciSubAbout')) $('sciSubAbout').onclick = () => switchTab('about');
  if ($('sciSubValid2')) $('sciSubValid2').onclick = () => switchTab('valid');
  if ($('sciSubAbout2')) $('sciSubAbout2').onclick = () => switchTab('about');

  // Primary Action in Explore Deck: "Find Landing Window"
  if ($('primaryFindWindowBtn')) {
    $('primaryFindWindowBtn').onclick = () => {
      if ($('wSites')) $('wSites').value = 'sel';
      if ($('wOut')) $('wOut').innerHTML = '';
      switchTab('windows');
    };
  }

  // Open / Close Contextual Site Details Panel
  if ($('openDetailsBtn')) {
    $('openDetailsBtn').onclick = () => {
      const deck = $('panel-deck');
      if (deck) {
        deck.classList.remove('collapsed');
        deck.dataset.explicitOpen = 'true';
        // Rule of one drawer: close sites drawer if open
        const sites = $('panel-sites');
        if (sites) {
          sites.classList.add('collapsed');
          sites.inert = true;
          $('sites-toggle-pill')?.classList.remove('active');
        }
      }
    };
  }

  if ($('deckCloseBtn')) {
    $('deckCloseBtn').onclick = () => {
      const deck = $('panel-deck');
      if (deck) {
        deck.classList.add('collapsed');
        delete deck.dataset.explicitOpen;
      }
    };
  }

  // Secondary Menu Toggle & Dismissal
  const menuBtn = $('menuBtn');
  const secondaryMenu = $('secondaryMenu');
  if (menuBtn && secondaryMenu) {
    menuBtn.onclick = (e) => {
      e.stopPropagation();
      secondaryMenu.hidden = !secondaryMenu.hidden;
    };
    document.addEventListener('click', (e) => {
      if (!secondaryMenu.hidden && !e.target.closest('.menu-dropdown-wrapper')) {
        secondaryMenu.hidden = true;
      }
    });
  }

  // Overview Camera button
  if ($('overBtn')) $('overBtn').onclick = () => SC.overview();

  // Settings Modal
  $('settingsBtn').onclick = () => openModal('settingsModal');
  $('settingsClose').onclick = () => closeModal('settingsModal');
  $('settingsModal').onclick = e => { if (e.target.id === 'settingsModal') closeModal('settingsModal'); };

  // Mode Segment buttons
  $$('#modeSeg button').forEach(b => {
    b.onclick = () => setMode(b.dataset.m);
  });

  // Render Quality Segment buttons
  try {
    const savedQ = localStorage.getItem('polaris_quality');
    if (savedQ) {
      const btn = $(`#qualitySeg button[data-q="${savedQ}"]`);
      if (btn) {
        $$('#qualitySeg button').forEach(x => x.classList.remove('on'));
        btn.classList.add('on');
        SC.setQuality(savedQ);
      }
    }
  } catch (_) {}

  $$('#qualitySeg button').forEach(b => {
    b.onclick = () => {
      $$('#qualitySeg button').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      SC.setQuality(b.dataset.q);
      try { localStorage.setItem('polaris_quality', b.dataset.q); } catch (_) {}
    };
  });

  // Onboarding banner
  if ($('introDismissBtn')) {
    $('introDismissBtn').onclick = () => $('intro-banner')?.classList.add('dismissed');
  }
  if ($('introTourBtn')) {
    $('introTourBtn').onclick = () => {
      $('intro-banner')?.classList.add('dismissed');
      startTour();
    };
  }

  if ($('trust')) $('trust').onclick = e => { e.preventDefault(); switchTab('valid'); };

  // Earth elevation mask slider
  if ($('emask')) {
    $('emask').value = OPT.emask;
    $('emask').onchange = e => {
      setEMask(+e.target.value);
      toast(`Earth line-of-sight threshold set to ${OPT.emask}° above terrain`);
      update();
      if ($('wOut')?.innerHTML && ST.tab === 'windows') runWindows();
    };
  }

  // Mission Brief button
  if ($('briefBtn')) $('briefBtn').onclick = missionBrief;

  // Calendar cell click
  if ($('cal')) {
    $('cal').onclick = e => {
      const t = e.target.dataset.t;
      if (t) {
        ST.t = +t;
        update();
      }
    };
  }

  // Panorama hover and click
  const nearPanoPoint = e => {
    const cv = $('pano');
    if (!cv) return null;
    const r = cv.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    let best = null, bd = 100;
    for (const p of cv._pts || []) {
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bd) { bd = d; best = p; }
    }
    return best && { p: best, x, y };
  };

  const panoEl = $('pano');
  if (panoEl) {
    panoEl.onmousemove = e => {
      const h = nearPanoPoint(e);
      const tip = $('panoTip');
      if (!tip) return;
      if (!h) { tip.hidden = true; panoEl.style.cursor = ''; return; }
      tip.hidden = false;
      panoEl.style.cursor = 'pointer';
      tip.style.left = Math.min(h.x + 12, panoEl.clientWidth - 190) + 'px';
      tip.style.top = Math.max(0, h.y - 34) + 'px';
      tip.innerHTML = `${h.p.k} at ${h.p.el.toFixed(1)}°, ${h.p.vis ? 'Visible' : 'Terrain Occulted'}<br><b>${fmtDate(tDate(h.p.t))}</b>`;
    };
    panoEl.onmouseleave = () => {
      if ($('panoTip')) $('panoTip').hidden = true;
    };
    panoEl.onclick = e => {
      const h = nearPanoPoint(e);
      if (h) {
        ST.t = h.p.t;
        if ($('panoTip')) $('panoTip').hidden = true;
        update();
      }
    };
  }

  // CSV export for site telemetry
  if ($('csvBtn')) {
    $('csvBtn').onclick = () => {
      const s = site();
      const a = ST.t;
      const b = Math.min(D.T, a + 24 * 365);
      const rows = ['utc,sun_az_deg,sun_el_deg,sun_horizon_deg,sun_disc_visible_frac,earth_az_deg,earth_el_deg,earth_horizon_deg,earth_visible'];
      for (let t = a; t < b; t++) {
        const q = siteState(s, t);
        rows.push([tDate(t).toISOString().slice(0, 16) + 'Z', q.saz.toFixed(3), q.sel.toFixed(4), q.shz.toFixed(3), q.sun.toFixed(3), q.eaz.toFixed(3), q.eel.toFixed(4), q.ehz.toFixed(3), q.earth].join(','));
      }
      const head = `# Polaris Window Export: ${s.name} (lat ${s.lat}, lon ${s.lon}E, elev ${s.elev}m LOLA). Observer +2m. Azimuth: map-plane. Frame MOON_ME, NAIF DE440.\n`;
      const url = URL.createObjectURL(new Blob([head + rows.join('\n')], { type: 'text/csv' }));
      const A = document.createElement('a');
      A.href = url;
      A.download = `polaris-window_${s.id}_${fmtDay(tDate(a))}.csv`;
      A.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    };
  }

  // Terrain exaggeration slider
  if ($('exag')) {
    $('exag').oninput = e => {
      if ($('exagV')) $('exagV').textContent = e.target.value;
      SC.setExag(+e.target.value);
      renderSiteList();
    };
  }

  // Window finder run button
  if ($('wRun')) $('wRun').onclick = runWindows;

  // Comparison mode toggles
  if ($('cFrom')) $('cFrom').onchange = renderCompare;
  if ($('cTo')) $('cTo').onchange = renderCompare;
  $$('#cmpMode button').forEach(b => {
    b.onclick = () => {
      ST.cmpMode = b.dataset.c;
      $$('#cmpMode button').forEach(x => x.classList.toggle('on', x === b));
      if ($('cmpSites')) $('cmpSites').hidden = ST.cmpMode === 'dates';
      if ($('cmpDates')) $('cmpDates').hidden = ST.cmpMode !== 'dates';
      renderCompare();
    };
  });

  // Guided Tour events
  if ($('tourBtn')) $('tourBtn').onclick = startTour;
  if ($('tourNext')) $('tourNext').onclick = tourNext;
  if ($('tourPrev')) $('tourPrev').onclick = () => tourStep(-1);
  if ($('tourEnd')) $('tourEnd').onclick = tourClose;

  // Keyboard Navigation
  addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (introBox && !introBox.hidden) { closeIntro(); return; }
      closeModal('shareBox');
      closeModal('settingsModal');
      if ($('secondaryMenu')) $('secondaryMenu').hidden = true;
      const bp = $('briefPreview');
      if (bp) bp.remove();
      // Close deck if in explore mode
      if (ST.tab === 'site') {
        const deck = $('panel-deck');
        if (deck && !deck.classList.contains('collapsed')) {
          deck.classList.add('collapsed');
          delete deck.dataset.explicitOpen;
          return;
        }
      }
      // Close sites drawer if open
      const sites = $('panel-sites');
      if (sites && !sites.classList.contains('collapsed')) {
        sites.classList.add('collapsed');
        sites.inert = true;
        $('sites-toggle-pill')?.classList.remove('active');
        return;
      }
      return;
    }
    if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName) && document.activeElement.type !== 'range') return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      step((e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 24 : 1));
    } else if (e.key === ' ' && document.activeElement === document.body) {
      e.preventDefault();
      play();
    }
  });

  addEventListener('resize', () => {
    if (ST.tab === 'site') renderSiteTab();
  });

  // Run demo if requested
  if (isDemo) setTimeout(demo, 800);

  // Global debug and test harness API
  window.PW = {
    ST, D, selectSite, switchTab, runWindows, runHeat, demo, startTour,
    goLanding: id => {
      const s = allSites().find(x => x.id === id);
      if (s?.landed) {
        ST.t = tIndex(Date.parse(s.landed));
        ST.mission = { site: id, t: ST.t, days: 10 };
      }
      selectSite(id);
    }
  };

  update();
})();
