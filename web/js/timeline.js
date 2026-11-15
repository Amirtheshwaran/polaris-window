// ==========================================================================
// Polaris Window — Timeline Controls, Transport & Playback Loop
// ==========================================================================

import { $, ST } from './state.js';
import { D, tDate, tIndex } from './data.js';

let playInterval = null;
let updateCallback = null;

export function initTimeline(onUpdate) {
  updateCallback = onUpdate;

  $('play').onclick = () => play();
  $('tBack').onclick = () => step(-24);
  $('tFwd').onclick = () => step(24);

  $('time').oninput = e => {
    ST.t = +e.target.value;
    updateCallback?.();
  };

  $('timeInput').onchange = e => {
    const ms = Date.parse(e.target.value + ':00:00Z');
    if (!isNaN(ms)) {
      ST.t = tIndex(ms);
      updateCallback?.();
    }
  };
}

export function step(hours) {
  ST.t = Math.max(0, Math.min(D.T - 1, ST.t + hours));
  updateCallback?.();
}

export function play(forceOn) {
  ST.playing = forceOn ?? !ST.playing;
  $('play').textContent = ST.playing ? '❚❚' : '▶';
  clearInterval(playInterval);

  if (ST.playing) {
    playInterval = setInterval(() => {
      const speed = +($('speed')?.value || 4);
      ST.t = (ST.t + speed) % D.T;
      updateCallback?.();
    }, 50);
  }
}

export function pause() {
  if (ST.playing) {
    play(false);
  }
}

export function syncTimelineDisplay(timestampIndex) {
  const d = tDate(timestampIndex);
  if ($('time')) $('time').value = timestampIndex;
  if ($('timeInput')) $('timeInput').value = d.toISOString().slice(0, 16);
}
