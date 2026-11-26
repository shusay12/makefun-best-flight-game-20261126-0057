// Synthesised sound only: an engine hum that follows throttle and speed, a
// ring chime, a crash thud and a landing fanfare. No audio files, no network.
export function createAudio() {
  let context = null;
  let engineOsc = null;
  let engineGain = null;
  let windGain = null;
  let muted = false;

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      context = new AudioContext();
      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 70;
      const engineFilter = context.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter).connect(engineGain).connect(context.destination);
      engineOsc.start();
      // Wind: looped filtered noise whose level follows airspeed.
      const noiseLength = context.sampleRate * 2;
      const noiseBuffer = context.createBuffer(1, noiseLength, context.sampleRate);
      const noiseData = noiseBuffer.getChannelData(0);
      for (let i = 0; i < noiseLength; i += 1) noiseData[i] = Math.random() * 2 - 1;
      const noise = context.createBufferSource();
      noise.buffer = noiseBuffer;
      noise.loop = true;
      const windFilter = context.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 900;
      windGain = context.createGain();
      windGain.gain.value = 0;
      noise.connect(windFilter).connect(windGain).connect(context.destination);
      noise.start();
      return true;
    } catch {
      context = null;
      return false;
    }
  }

  function tone(frequency, duration, type, volume, when = 0) {
    if (!ensure() || muted) return;
    const start = context.currentTime + when;
    const osc = context.createOscillator();
    osc.type = type;
    osc.frequency.value = frequency;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(gain).connect(context.destination);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  return {
    unlock() {
      ensure();
      if (context && context.state === 'suspended') context.resume();
    },
    /** Continuous engine and wind, called every frame while flying. */
    engine(throttle, speed, flying) {
      if (!ensure() || muted) return;
      const target = flying ? 0.045 + throttle * 0.05 : 0;
      engineGain.gain.setTargetAtTime(target, context.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(55 + throttle * 65 + speed * 0.4, context.currentTime, 0.1);
      windGain.gain.setTargetAtTime(flying ? speed * 0.00045 : 0, context.currentTime, 0.15);
    },
    ring() {
      tone(880, 0.35, 'sine', 0.16);
      tone(1318, 0.45, 'sine', 0.12, 0.07);
    },
    crash() {
      tone(90, 0.6, 'sine', 0.3);
      tone(55, 0.8, 'triangle', 0.22, 0.05);
    },
    land() {
      [523, 659, 784, 1047].forEach((frequency, i) => tone(frequency, 0.5, 'triangle', 0.14, i * 0.12));
    },
    toggleMute() {
      muted = !muted;
      if (engineGain) engineGain.gain.value = 0;
      if (windGain) windGain.gain.value = 0;
      return muted;
    },
  };
}
