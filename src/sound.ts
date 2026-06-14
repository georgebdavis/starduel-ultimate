export class SoundSynthesizer {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxVolume = 0.5;
  private musicVolume = 0.3;
  private noiseBuffer: AudioBuffer | null = null;
  private activeThrusters: Map<string, { osc: OscillatorNode; noise: AudioBufferSourceNode; gain: GainNode }> = new Map();

  constructor() {
    // AudioContext will be initialized on first user interaction to comply with browser policies
  }

  private init() {
    if (this.ctx) return;
    
    try {
      const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
      this.musicGain.connect(this.ctx.destination);

      // Create pre-rendered white noise buffer
      const bufferSize = 2 * this.ctx.sampleRate;
      this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    } catch (e) {
      console.warn('Web Audio API not supported or blocked:', e);
    }
  }

  public resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setSfxVolume(vol: number) {
    this.sfxVolume = vol / 100;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
    }
  }

  public setMusicVolume(vol: number) {
    this.musicVolume = vol / 100;
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
    }
  }

  // Laser zap sound
  public playLaser(pitch = 1.0) {
    this.resume();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Sharp anime laser: sawtooth / triangle mix
    osc.type = 'sawtooth';
    
    // Frequency sweep: start high and slide down fast
    const startFreq = 1200 * pitch;
    const endFreq = 80 * pitch;
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + 0.15);

    // Amplitude envelope: instant attack, fast decay
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.16);
  }

  // Heavy weapon sound (Dreadnought / Bomber)
  public playHeavyLaser() {
    this.resume();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const subOsc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.3);

    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(100, t);
    subOsc.frequency.exponentialRampToValueAtTime(20, t + 0.3);

    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);

    osc.connect(gain);
    subOsc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    subOsc.start(t);
    
    osc.stop(t + 0.32);
    subOsc.stop(t + 0.32);
  }

  // Dynamic explosion sound using bandpass noise
  public playExplosion(size = 1.0) {
    this.resume();
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;

    const t = this.ctx.currentTime;
    const duration = 0.4 * size + 0.2;

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, t);
    filter.frequency.exponentialRampToValueAtTime(30 * size, t + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.6 * Math.min(size, 1.5), t);
    gain.gain.exponentialRampToValueAtTime(0.005, t + duration);

    noiseSource.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noiseSource.start(t);
    noiseSource.stop(t + duration);
  }

  // Shield deflector ping sound
  public playShieldHit() {
    this.resume();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1800, t);
    osc.frequency.exponentialRampToValueAtTime(400, t + 0.08);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.09);
  }

  // Player dash or teleport sound
  public playDash() {
    this.resume();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(3000, t + 0.25);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.26);
  }

  // Destroyer turbo activation
  public playTurbo() {
    this.resume();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.linearRampToValueAtTime(800, t + 0.3);
    
    // Add pulsing gain envelope
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.linearRampToValueAtTime(0.1, t + 0.3);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.3);
  }

  // Scrap items collection sound
  public playCollect() {
    this.resume();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t); // A5 note
    osc.frequency.setValueAtTime(1320, t + 0.08); // E6 note
    
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.setValueAtTime(0.15, t + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.21);
  }

  // Mine drop sound
  public playMineDrop() {
    this.resume();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.linearRampToValueAtTime(80, t + 0.25);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.26);
  }

  // Upgrade success sound
  public playUpgrade() {
    this.resume();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(523.25, t); // C5
    osc1.frequency.setValueAtTime(659.25, t + 0.08); // E5
    osc1.frequency.setValueAtTime(783.99, t + 0.16); // G5
    osc1.frequency.setValueAtTime(1046.50, t + 0.24); // C6

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1046.50, t);
    
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.masterGain);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.4);
    osc2.stop(t + 0.4);
  }

  // Start continuous thruster rumble for a ship
  public startThruster(shipId: string) {
    this.resume();
    if (!this.ctx || !this.masterGain || !this.noiseBuffer || this.activeThrusters.has(shipId)) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 55; // Low A rumbling

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 120; // Cut off high frequencies

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.1); // Fade in rumble

    osc.connect(filter);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    noise.start(t);

    this.activeThrusters.set(shipId, { osc, noise, gain });
  }

  // Stop continuous thruster rumble
  public stopThruster(shipId: string) {
    const active = this.activeThrusters.get(shipId);
    if (!active || !this.ctx) return;

    const t = this.ctx.currentTime;
    active.gain.gain.cancelScheduledValues(t);
    active.gain.gain.setValueAtTime(active.gain.gain.value, t);
    active.gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1); // Fade out rumble
    
    const osc = active.osc;
    const noise = active.noise;
    
    setTimeout(() => {
      try {
        osc.stop();
        noise.stop();
      } catch (e) {}
    }, 120);

    this.activeThrusters.delete(shipId);
  }

  // Play simple low pitch alert beeps
  public playAlert() {
    this.resume();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(150, t);

    gain.gain.setValueAtTime(0.15, t);
    gain.gain.setValueAtTime(0.0, t + 0.1);
    gain.gain.setValueAtTime(0.15, t + 0.2);
    gain.gain.setValueAtTime(0.0, t + 0.3);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.31);
  }
}
