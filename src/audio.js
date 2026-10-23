/* =========================================================
   PROCEDURAL FIRE SOUND SYNTHESIZER
   Web Audio API: dynamic fire crackles, embers & roar
   ========================================================= */

export class FireAudioSynthesizer {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.isStarted = false;

    // Audio nodes
    this.masterGain = null;
    this.crackleGain = null;
    this.roarGain = null;

    // Movement responsiveness
    this.activityLevel = 0; // decays when still
  }

  init() {
    if (this.ctx) return;

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    this.ctx = new AudioContext();

    // Master Volume
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    // 1. Fire Roar (Bandpass filtered brown/pink noise)
    this.setupRoar();

    // 2. Fire Crackles (Popping sparks & snapped twigs)
    this.setupCrackles();

    this.isStarted = true;
  }

  setupRoar() {
    // Generate pink noise buffer
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      output[i] *= 0.11;
      b6 = white * 0.115926;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    // Low-pass & Bandpass filters for rumble
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, this.ctx.currentTime);

    this.roarGain = this.ctx.createGain();
    this.roarGain.gain.setValueAtTime(0.05, this.ctx.currentTime);

    whiteNoise.connect(filter);
    filter.connect(this.roarGain);
    this.roarGain.connect(this.masterGain);

    whiteNoise.start();
  }

  setupCrackles() {
    this.crackleGain = this.ctx.createGain();
    this.crackleGain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    this.crackleGain.connect(this.masterGain);

    // Crackle loop using scheduled impulse clicks
    const scheduleNextCrackle = () => {
      if (!this.ctx || this.isMuted) {
        setTimeout(scheduleNextCrackle, 100);
        return;
      }

      if (this.activityLevel > 0.01) {
        this.triggerSparkPop();
      }

      // Interval adapts: faster when hand moves, slower when idle
      const baseDelay = 40 + (1.0 - Math.min(1.0, this.activityLevel)) * 220;
      const jitter = Math.random() * 50;
      setTimeout(scheduleNextCrackle, baseDelay + jitter);
    };

    scheduleNextCrackle();
  }

  triggerSparkPop() {
    if (!this.ctx || this.ctx.state !== 'running') return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    // High frequency pop
    filter.type = 'bandpass';
    filter.frequency.value = 1800 + Math.random() * 3200;
    filter.Q.value = 4.0;

    const now = this.ctx.currentTime;
    const duration = 0.015 + Math.random() * 0.035;

    osc.type = Math.random() > 0.5 ? 'triangle' : 'sawtooth';
    osc.frequency.setValueAtTime(400 + Math.random() * 600, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + duration);

    const volume = (0.2 + Math.random() * 0.4) * Math.min(1.0, this.activityLevel + 0.2);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.crackleGain);

    osc.start(now);
    osc.stop(now + duration);
  }

  /**
   * Called each frame with movement intensity [0..1]
   */
  update(intensity, dt) {
    if (!this.isStarted || !this.ctx) return;

    // Smooth lerp activity level
    const targetActivity = Math.min(1.0, intensity);
    this.activityLevel += (targetActivity - this.activityLevel) * Math.min(1.0, dt * 6.0);

    if (this.roarGain && !this.isMuted) {
      const roarVol = 0.04 + this.activityLevel * 0.35;
      this.roarGain.gain.setTargetAtTime(roarVol, this.ctx.currentTime, 0.08);
    }
  }

  toggleMute() {
    if (!this.isStarted) {
      this.init();
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.35, this.ctx.currentTime, 0.05);
    }
    return this.isMuted;
  }

  resumeIfSuspended() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }
}
