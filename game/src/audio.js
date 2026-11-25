// Procedural Web Audio API synthesizer for Ember & Broth (zero external audio files).
// Generates tactile SFX (chop, wok toss, sizzle, plating, brass bell, ticket chime) and a gentle bistro loop.

export function createAudio() {
  let ctx = null;
  let muted = false;
  let musicTimer = null;
  let stepIndex = 0;

  // Cozy pentatonic/major9 bistro progression (frequencies in Hz).
  const MELODY = [
    523.25, 659.25, 783.99, 659.25, 587.33, 659.25, 523.25, 392.0,
    440.0, 523.25, 659.25, 587.33, 493.88, 587.33, 659.25, 523.25,
  ];
  const BASS = [130.81, 130.81, 164.81, 196.0, 174.61, 174.61, 146.83, 196.0];

  function ensureContext() {
    if (muted) return null;
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      ctx = new AudioCtx();
    }
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  function tone(freq, duration, type = 'sine', gainPeak = 0.08, slideTo = null) {
    const audio = ensureContext();
    if (!audio || muted) return;
    const now = audio.currentTime;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + duration);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainPeak, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function noiseBurst(duration, lowpassHz, gainPeak) {
    const audio = ensureContext();
    if (!audio || muted) return;
    const sampleCount = Math.max(1, Math.floor(audio.sampleRate * duration));
    const buffer = audio.createBuffer(1, sampleCount, audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / sampleCount);
    }
    const src = audio.createBufferSource();
    src.buffer = buffer;
    const filter = audio.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpassHz;
    const gain = audio.createGain();
    gain.gain.value = gainPeak;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(audio.destination);
    src.start();
  }

  function startMusic() {
    if (musicTimer !== null) return;
    musicTimer = window.setInterval(() => {
      if (muted || !ctx || ctx.state !== 'running') return;
      const note = MELODY[stepIndex % MELODY.length];
      tone(note, 0.22, 'triangle', 0.022);
      if (stepIndex % 2 === 0) {
        const bass = BASS[(stepIndex / 2) % BASS.length];
        tone(bass, 0.34, 'sine', 0.028);
      }
      stepIndex += 1;
    }, 340);
  }

  function stopMusic() {
    if (musicTimer !== null) {
      window.clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  return {
    unlock() {
      const audio = ensureContext();
      if (audio) startMusic();
    },
    isMuted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      if (muted) stopMusic();
      else {
        const audio = ensureContext();
        if (audio) startMusic();
      }
      return muted;
    },
    playPickup() {
      tone(380, 0.08, 'sine', 0.06, 520);
    },
    playPlace() {
      tone(290, 0.08, 'triangle', 0.06, 220);
    },
    playChop(done = false) {
      noiseBurst(0.06, 2200, 0.09);
      tone(done ? 660 : 420, 0.07, 'triangle', 0.06, done ? 880 : 320);
    },
    playSizzle() {
      noiseBurst(0.14, 3400, 0.07);
      tone(240, 0.12, 'sawtooth', 0.03, 410);
    },
    playWokToss() {
      noiseBurst(0.18, 2800, 0.11);
      tone(330, 0.14, 'triangle', 0.07, 680);
    },
    playPlate() {
      tone(587.33, 0.12, 'sine', 0.07, 783.99);
    },
    playReady() {
      tone(523.25, 0.12, 'triangle', 0.07);
      window.setTimeout(() => tone(659.25, 0.14, 'triangle', 0.07), 70);
      window.setTimeout(() => tone(783.99, 0.18, 'triangle', 0.08), 140);
    },
    playBell() {
      tone(1046.5, 0.36, 'sine', 0.11);
      tone(1567.98, 0.28, 'sine', 0.06);
      window.setTimeout(() => tone(1318.5, 0.32, 'sine', 0.08), 90);
    },
    playWarn() {
      tone(210, 0.16, 'sawtooth', 0.05, 160);
    },
    playTick() {
      tone(740, 0.05, 'sine', 0.035);
    },
  };
}
