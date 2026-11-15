// ==========================================================================
// Polaris Window — Shared UI Components & Modal Management
// ==========================================================================

import { $, $$ } from './state.js';

export function toast(message) {
  const t = $('toast');
  if (!t) return;
  t.textContent = message;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => {
    t.hidden = true;
  }, 2400);
}

export function openModal(id) {
  const el = $(id);
  if (el) el.hidden = false;
}

export function closeModal(id) {
  const el = $(id);
  if (el) el.hidden = true;
}

export function initAccordions(onToggle) {
  $$('.accordion-header').forEach(hdr => {
    hdr.tabIndex = 0;
    hdr.setAttribute('role', 'button');
    const sec = hdr.closest('.accordion-section');
    hdr.setAttribute('aria-expanded', sec?.classList.contains('open') ? 'true' : 'false');

    hdr.onkeydown = e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        hdr.click();
      }
    };

    hdr.onclick = () => {
      if (!sec) return;
      sec.classList.toggle('open');
      hdr.setAttribute('aria-expanded', sec.classList.contains('open') ? 'true' : 'false');
      onToggle?.();
    };
  });
}
