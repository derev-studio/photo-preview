/* One quiet audio engine shared by the page and its same-origin viewer. */
(() => {
  'use strict';
  const embedded = window.parent !== window;
  if (!embedded) {
    let enabled = true, context, master, last = -Infinity;
    try { enabled = localStorage.getItem('porcelain-sound') !== 'off'; } catch {}
    const toggle = document.getElementById('sound-toggle');
    const paint = () => { if (toggle) { toggle.textContent = enabled ? 'Звук: вкл.' : 'Звук: выкл.'; toggle.setAttribute('aria-pressed', String(enabled)); } };
    window.porcelainSound = (motion = false) => {
      if (!enabled || document.hidden) return;
      const now = performance.now();
      if (now - last < (motion ? 220 : 80)) return;
      last = now;
      try {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) return;
        if (!context) { context = new Audio(); master = context.createGain(); master.gain.value = .45; master.connect(context.destination); }
        if (context.state === 'suspended') context.resume().catch(() => {});
        const start = context.currentTime, fundamental = motion ? 1260 : 1420;
        [1, 2.71, 4.12].forEach((ratio, i) => {
          const oscillator = context.createOscillator(), gain = context.createGain();
          oscillator.type = 'sine'; oscillator.frequency.value = fundamental * ratio;
          gain.gain.setValueAtTime(.0001, start);
          gain.gain.exponentialRampToValueAtTime((motion ? .025 : .07) / (i + 1), start + .006);
          gain.gain.exponentialRampToValueAtTime(.0001, start + .65 / (i + 1));
          oscillator.connect(gain); gain.connect(master); oscillator.start(start); oscillator.stop(start + .7);
          oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
        });
      } catch { /* Audio is optional; every control keeps working. */ }
    };
    toggle?.addEventListener('click', () => {
      enabled = !enabled;
      if (master) master.gain.setValueAtTime(enabled ? .45 : 0, context.currentTime);
      try { localStorage.setItem('porcelain-sound', enabled ? 'on' : 'off'); } catch {}
      paint(); if (enabled) window.porcelainSound();
    });
    paint();
  }
  const ring = motion => { try { (embedded ? window.parent : window).porcelainSound?.(motion); } catch {} };
  document.addEventListener('click', event => {
    const button = event.target.closest('button,a#shop');
    if (event.isTrusted && button && !button.disabled && button.id !== 'sound-toggle') ring(false);
  });
  if (embedded) {
    let drag;
    document.addEventListener('pointerdown', event => {
      if (event.isTrusted && event.target.tagName === 'CANVAS' && window.controls?.enabled) drag = {id:event.pointerId,x:event.clientX,y:event.clientY};
    });
    document.addEventListener('pointermove', event => {
      if (!drag || drag.id !== event.pointerId || !window.controls?.enabled) return;
      if (Math.hypot(event.clientX-drag.x,event.clientY-drag.y) > 18) { ring(true); drag.x=event.clientX; drag.y=event.clientY; }
    });
    for (const name of ['pointerup','pointercancel','lostpointercapture']) document.addEventListener(name, () => { drag = null; });
    window.addEventListener('blur', () => { drag = null; });
  }
})();
