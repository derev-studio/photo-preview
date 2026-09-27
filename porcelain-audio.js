/* One quiet audio engine shared by the page and its same-origin viewer. */
(() => {
  'use strict';
  const embedded = window.parent !== window;
  if (!embedded) {
    let enabled = true, context, master, echo, paper, paperBuffer, spin, spinBuffer, last = -Infinity;
    try { enabled = localStorage.getItem('porcelain-sound') !== 'off'; } catch {}
    const toggle = document.getElementById('sound-toggle');
    const paint = () => { if (toggle) { toggle.textContent = enabled ? 'Звук: вкл.' : 'Звук: выкл.'; toggle.setAttribute('aria-pressed', String(enabled)); } };
    const notes = [659.25, 783.99, 880, 987.77, 1174.66, 1318.51, 1567.98, 1760];
    const pitches = {'open-gallery':0,'open-comments':1,'login':2,'logout':2,'shop':3,'replay':4,'pause':0,'inspect':5,'quick-photo':6,'upload-photo':6,'large-apply':7,'sound-toggle':5,'mug-touch':2};
    // Called synchronously from real gestures, including touches inside the viewer.
    window.unlockPorcelainAudio = () => {
      if (!enabled || document.hidden) return Promise.resolve();
      try {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) return;
        try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
        if (!context) {
          context = new Audio(); master = context.createGain(); master.gain.value = .45; master.connect(context.destination);
          // Two quiet, finite reflections: no feedback loop or accumulating reverb.
          echo = context.createGain();
          [.115, .235].forEach((seconds, i) => {
            const delay = context.createDelay(.3), wet = context.createGain();
            delay.delayTime.value = seconds; wet.gain.value = i ? .09 : .19;
            echo.connect(delay); delay.connect(wet); wet.connect(master);
          });
        }
        if (context.state !== 'running') {
          const source = context.createBufferSource();
          source.buffer = context.createBuffer(1, 1, context.sampleRate);
          source.connect(context.destination);source.onended=()=>source.disconnect();source.start();
          return context.resume();
        }
        return Promise.resolve();
      } catch { return Promise.resolve(); }
    };
    window.porcelainSound = async (motion = false, key = 'sound-toggle') => {
      if (!enabled || document.hidden) return;
      const now = performance.now();
      if (now - last < (motion ? 220 : 80)) return;
      last = now;
      try {
        await window.unlockPorcelainAudio();
        if (!context || context.state !== 'running' || !enabled || document.hidden) return;
        const hash = [...key].reduce((n, char) => (n * 31 + char.codePointAt(0)) >>> 0, 0);
        const fundamental = notes[pitches[key] ?? hash % notes.length] * (motion ? .75 : 1);
        const start = context.currentTime;
        // Slightly detuned resonances create a shimmering, vibrating ceramic tail.
        [1, 1.003, 2.71, 4.12].forEach((ratio, i) => {
          const oscillator = context.createOscillator(), gain = context.createGain();
          const duration = (motion ? .7 : 1.65) / (1 + i * .45);
          oscillator.type = 'sine'; oscillator.frequency.value = fundamental * ratio;
          gain.gain.setValueAtTime(.0001, start);
          gain.gain.exponentialRampToValueAtTime((motion ? .018 : .052) * [1,.48,.23,.08][i], start + .009);
          gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
          oscillator.connect(gain); gain.connect(master); gain.connect(echo);
          oscillator.start(start); oscillator.stop(start + duration + .02);
          oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
        });
      } catch { /* Audio is optional; every control keeps working. */ }
    };
    // Smooth air follows the flight; a separate soft contact ends the movement.
    window.porcelainPaper = (active, progress = 0) => {
      if (!active || !enabled || document.hidden || !context || context.state !== 'running') {
        if (paper) { paper.source.stop(); paper = null; }
        return;
      }
      try {
        if (!paper) {
          if (!paperBuffer) {
            paperBuffer = context.createBuffer(1, context.sampleRate * 3, context.sampleRate);
            const samples = paperBuffer.getChannelData(0);
            let smooth = 0;
            for (let i = 0; i < samples.length; i++) {
              const t = i / context.sampleRate;
              smooth = .93 * smooth + .07 * (Math.random() * 2 - 1);
              samples[i] = smooth * (1.3 + .15 * Math.sin(t * 2));
            }
          }
          const source = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain();
          source.buffer = paperBuffer; source.loop = true;
          filter.type = 'lowpass'; filter.frequency.value = 750; filter.Q.value = .5;
          gain.gain.value = 0;
          source.connect(filter); filter.connect(gain); gain.connect(master);
          source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
          source.start(); paper = {source, gain, filter};
        }
        const p = Math.max(0, Math.min(1, progress));
        const wings = [[.15,.08,.65],[.36,.11,1],[.61,.09,.7],[.77,.065,.45]].reduce((sum,[center,width,level]) => sum + level * Math.exp(-(((p-center)/width)**2)), 0);
        paper.gain.gain.setTargetAtTime(.025 * wings * Math.sin(Math.PI * Math.min(1, p / .9)), context.currentTime, .06);
        paper.filter.frequency.setTargetAtTime(450 + 250 * Math.sin(Math.PI * p), context.currentTime, .05);
      } catch { if (paper) { paper.source.stop(); paper = null; } }
    };
    // A low, non-tonal rolling texture, like a softly lubricated bearing.
    window.porcelainSpin = (active, progress = 0) => {
      if (!active || !enabled || document.hidden || !context || context.state !== 'running') {
        if (spin) {
          spin.gain.gain.setTargetAtTime(0, context.currentTime, .025);
          spin.source.stop(context.currentTime + .12);
          spin = null;
        }
        return;
      }
      try {
        if (!spin) {
          if (!spinBuffer) {
            spinBuffer = context.createBuffer(1, context.sampleRate * 8, context.sampleRate);
            const samples = spinBuffer.getChannelData(0);
            let smooth = 0;
            for (let i = 0; i < samples.length; i++) {
              smooth = .97 * smooth + .03 * (Math.random() * 2 - 1);
              samples[i] = smooth;
            }
          }
          const source = context.createBufferSource(), low = context.createBiquadFilter(), high = context.createBiquadFilter(), gain = context.createGain();
          source.buffer = spinBuffer; source.loop = true;
          low.type = 'lowpass'; low.frequency.value = 480; low.Q.value = .5;
          high.type = 'highpass'; high.frequency.value = 110; high.Q.value = .5;
          gain.gain.value = 0;
          source.connect(high); high.connect(low); low.connect(gain); gain.connect(master);
          source.onended = () => { source.disconnect(); high.disconnect(); low.disconnect(); gain.disconnect(); };
          source.start(); spin = {source, gain, low};
        }
        const p = Math.max(0, Math.min(1, progress));
        const speed = Math.sin(Math.PI * p);
        spin.gain.gain.setTargetAtTime(.09 * speed, context.currentTime, .12);
        spin.low.frequency.setTargetAtTime(320 + 160 * speed, context.currentTime, .12);
      } catch { /* No sound must block the viewer. */ }
    };
    window.porcelainContact = () => {
      if (!enabled || document.hidden || !context || context.state !== 'running') return;
      try {
        const start = context.currentTime;
        // Rounded, breathy "kiss": brief air compression and a quiet falling tone.
        const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * .22), context.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const air = context.createBufferSource(), filter = context.createBiquadFilter(), breath = context.createGain();
        air.buffer = buffer; filter.type = 'bandpass'; filter.Q.value = .8;
        filter.frequency.setValueAtTime(1100, start);
        filter.frequency.exponentialRampToValueAtTime(450, start + .18);
        breath.gain.setValueAtTime(.0001, start);
        breath.gain.exponentialRampToValueAtTime(.065, start + .035);
        breath.gain.exponentialRampToValueAtTime(.0001, start + .21);
        air.connect(filter); filter.connect(breath); breath.connect(master);
        air.onended = () => { air.disconnect(); filter.disconnect(); breath.disconnect(); };
        air.start(start); air.stop(start + .22);
        const tone = context.createOscillator(), touch = context.createGain();
        tone.type = 'sine'; tone.frequency.setValueAtTime(420, start);
        tone.frequency.exponentialRampToValueAtTime(190, start + .13);
        touch.gain.setValueAtTime(.0001, start);
        touch.gain.exponentialRampToValueAtTime(.044, start + .018);
        touch.gain.exponentialRampToValueAtTime(.0001, start + .16);
        tone.connect(touch); touch.connect(master);
        tone.onended = () => { tone.disconnect(); touch.disconnect(); };
        tone.start(start); tone.stop(start + .18);
      } catch { /* Optional sound must never interrupt the animation. */ }
    };
    toggle?.addEventListener('click', () => {
      enabled = !enabled;
      if (!enabled) { window.porcelainPaper(false); window.porcelainSpin(false); }
      if (master) master.gain.setValueAtTime(enabled ? .45 : 0, context.currentTime);
      try { localStorage.setItem('porcelain-sound', enabled ? 'on' : 'off'); } catch {}
      paint(); if (enabled) window.porcelainSound();
    });
    paint();
  }
  const unlock = event => {
    if (!event.isTrusted) return;
    try { (embedded ? window.parent : window).unlockPorcelainAudio?.()?.catch(()=>{}); } catch {}
  };
  document.addEventListener('touchend', unlock, {capture:true,passive:true});
  document.addEventListener('pointerup', unlock, {capture:true,passive:true});
  document.addEventListener('keydown', unlock, {capture:true});
  const ring = (motion, key) => { try { (embedded ? window.parent : window).porcelainSound?.(motion, key); } catch {} };
  document.addEventListener('click', event => {
    const button = event.target.closest('button,a#shop');
    if (event.isTrusted && button && !button.disabled && button.id !== 'sound-toggle') ring(false, button.id || button.getAttribute('aria-label') || button.textContent.trim());
  });
  if (embedded) {
    const paperSound = (active, progress) => { try { window.parent.porcelainPaper?.(active, progress); } catch {} };
    const spinSound = (active, progress) => { try { window.parent.porcelainSpin?.(active, progress); } catch {} };
    let previousTime = null;
    function followPhoto() {
      const state = window.demo?.getState();
      const active = !document.hidden && state?.running && state.time >= 3.1 && state.time < 6.25;
      paperSound(Boolean(active), active ? (state.time - 3.1) / 3.15 : 0);
      if (!document.hidden && state?.running && previousTime !== null && previousTime < 6.25 && state.time >= 6.25 && state.time - previousTime < .3) {
        try { window.parent.porcelainContact?.(); } catch {}
      }
      const turning = !document.hidden && state?.running && state.time >= 7.8 && state.time < 13.8;
      spinSound(Boolean(turning), turning ? (state.time - 7.8) / 6 : 0);
      previousTime = !document.hidden && state?.running ? state.time : null;
      requestAnimationFrame(followPhoto);
    }
    requestAnimationFrame(followPhoto);
    document.addEventListener('visibilitychange', () => { if (document.hidden) { paperSound(false); spinSound(false); } });
    window.addEventListener('pagehide', () => { paperSound(false); spinSound(false); });
    let drag;
    document.addEventListener('pointerdown', event => {
      if (event.isTrusted && event.target.tagName === 'CANVAS' && window.controls?.enabled) { drag = {id:event.pointerId,x:event.clientX,y:event.clientY}; ring(false, 'mug-touch'); }
    });
    document.addEventListener('pointermove', event => {
      if (!drag || drag.id !== event.pointerId || !window.controls?.enabled) return;
      if (Math.hypot(event.clientX-drag.x,event.clientY-drag.y) > 18) { ring(true, 'mug-touch'); drag.x=event.clientX; drag.y=event.clientY; }
    });
    for (const name of ['pointerup','pointercancel','lostpointercapture']) document.addEventListener(name, () => { drag = null; });
    window.addEventListener('blur', () => { drag = null; });
  }
})();
