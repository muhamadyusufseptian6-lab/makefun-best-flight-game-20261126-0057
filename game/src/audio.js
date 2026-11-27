// Synthesized sound, no audio files: Web Audio oscillators + filtered noise.
// The AudioContext is created only after the player's first interaction.
export function makeAudio() {
  return {
    ctx: null,
    master: null,
    engineOsc: null,
    engineOsc2: null,
    engineGain: null,
    windSource: null,
    windGain: null,
    muted: false,
    started: false,
  };
}

export function ensureAudio(audio) {
  if (audio.started) {
    if (audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume();
    return;
  }
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    audio.ctx = ctx;
    audio.master = ctx.createGain();
    audio.master.gain.value = audio.muted ? 0 : 0.5;
    audio.master.connect(ctx.destination);

    // Engine hum: two detuned oscillators.
    audio.engineOsc = ctx.createOscillator();
    audio.engineOsc.type = 'sawtooth';
    audio.engineOsc.frequency.value = 55;
    audio.engineOsc2 = ctx.createOscillator();
    audio.engineOsc2.type = 'sine';
    audio.engineOsc2.frequency.value = 110;
    audio.engineGain = ctx.createGain();
    audio.engineGain.gain.value = 0;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    audio.engineOsc.connect(engineFilter);
    audio.engineOsc2.connect(engineFilter);
    engineFilter.connect(audio.engineGain);
    audio.engineGain.connect(audio.master);
    audio.engineOsc.start();
    audio.engineOsc2.start();

    // Wind: looped noise buffer through a lowpass filter.
    const len = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    audio.windSource = ctx.createBufferSource();
    audio.windSource.buffer = buffer;
    audio.windSource.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 700;
    audio.windGain = ctx.createGain();
    audio.windGain.gain.value = 0;
    audio.windSource.connect(windFilter);
    windFilter.connect(audio.windGain);
    audio.windGain.connect(audio.master);
    audio.windSource.start();
    audio.started = true;
  } catch (e) {
    // Audio is decoration; a failure must never stop the game.
    audio.started = false;
  }
}

// Called every frame with the plane's state; the hum follows throttle + speed.
export function updateEngineSound(audio, throttle, speed, flying) {
  if (!audio.started || !audio.ctx) return;
  const t = audio.ctx.currentTime;
  const on = flying ? 1 : 0;
  audio.engineGain.gain.setTargetAtTime(0.05 + throttle * 0.10 * on, t, 0.1);
  audio.engineOsc.frequency.setTargetAtTime(48 + throttle * 70 + speed * 0.06, t, 0.1);
  audio.engineOsc2.frequency.setTargetAtTime(96 + throttle * 140 + speed * 0.12, t, 0.1);
  audio.windGain.gain.setTargetAtTime(Math.min(0.14, speed / 420 * 0.14) * on, t, 0.2);
}

function blip(audio, freq, dur, type, vol) {
  if (!audio.started || !audio.ctx) return;
  const ctx = audio.ctx;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type || 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol || 0.25, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  osc.connect(gain);
  gain.connect(audio.master);
  osc.start();
  osc.stop(ctx.currentTime + dur);
}

export function playRing(audio) {
  blip(audio, 880, 0.18, 'sine', 0.3);
  setTimeout(() => blip(audio, 1320, 0.25, 'sine', 0.3), 90);
}

export function playPickup(audio) {
  blip(audio, 660, 0.12, 'triangle', 0.3);
  setTimeout(() => blip(audio, 990, 0.15, 'triangle', 0.3), 70);
}

export function playLand(audio) {
  blip(audio, 220, 0.3, 'triangle', 0.35);
  setTimeout(() => blip(audio, 330, 0.4, 'triangle', 0.3), 120);
}

export function playCrash(audio) {
  if (!audio.started || !audio.ctx) return;
  const ctx = audio.ctx;
  const len = ctx.sampleRate * 0.6;
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.value = 0.5;
  src.connect(gain);
  gain.connect(audio.master);
  src.start();
  blip(audio, 70, 0.5, 'sawtooth', 0.4);
}

export function playWarn(audio) {
  blip(audio, 440, 0.15, 'square', 0.12);
}

export function setMuted(audio, muted) {
  audio.muted = muted;
  if (audio.master && audio.ctx) {
    audio.master.gain.setTargetAtTime(muted ? 0 : 0.5, audio.ctx.currentTime, 0.05);
  }
}
