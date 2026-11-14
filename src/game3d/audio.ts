// Realistic procedural Web Audio sound synthesis for 3D arena gunplay & movement

class RivalsAudioEngine {
  private ctx: AudioContext | null = null;
  private muted = false;

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
  }

  public playGunshot(kind: string, distanceScale = 1): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const att = Math.max(0.18, Math.min(1, distanceScale));

    if (kind === 'sniper') {
      // Heavy supersonic crack + deep sub punch + metallic bolt echo
      this.playBandNoise(0.28, 1200, 0.7, 0.28 * att);
      this.playBandNoise(0.045, 3600, 1.4, 0.24 * att);
      this.playPunchOsc(ctx, now, 165, 38, 0.22, 0.24 * att, 'triangle');
      this.playMechanicalClick(ctx, now + 0.28, 1350, 0.045 * att);
    } else if (kind === 'shotgun') {
      // Wide low-mid boom + heavy scatter crack + pump rack
      this.playBandNoise(0.24, 780, 0.65, 0.3 * att);
      this.playBandNoise(0.08, 2200, 1.1, 0.2 * att);
      this.playPunchOsc(ctx, now, 140, 34, 0.2, 0.25 * att, 'sawtooth');
      this.playMechanicalClick(ctx, now + 0.19, 980, 0.04 * att);
    } else if (kind === 'revolver') {
      // Sharp magnum crack + brass ring
      this.playBandNoise(0.14, 1550, 0.9, 0.2 * att);
      this.playPunchOsc(ctx, now, 280, 62, 0.14, 0.17 * att, 'triangle');
      this.playMechanicalClick(ctx, now + 0.03, 2400, 0.03 * att);
    } else if (kind === 'uzi') {
      // Rapid high-cyclic submachine snap
      this.playBandNoise(0.05, 2400, 1.1, 0.12 * att);
      this.playPunchOsc(ctx, now, 320, 95, 0.055, 0.1 * att, 'triangle');
    } else {
      // Assault Rifle / Burst / Handgun crisp tactical report + bolt clack
      this.playBandNoise(0.075, 1950, 0.95, 0.14 * att);
      this.playPunchOsc(ctx, now, 260, 72, 0.075, 0.13 * att, 'triangle');
      this.playMechanicalClick(ctx, now + 0.025, 2900, 0.024 * att);
    }
  }

  public playShellDrop(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const base = 3600 + Math.random() * 900;
    [0, 0.065].forEach((offset, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(base * (1 - i * 0.08), now + offset);
      gain.gain.setValueAtTime(0.018, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.045);
    });
  }

  public playFootstep(sprinting: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const vol = sprinting ? 0.06 : 0.038;
    const cutoff = sprinting ? 520 + Math.random() * 140 : 380 + Math.random() * 100;
    this.playBandNoise(0.065, cutoff, 1.2, vol);
    this.playPunchOsc(ctx, ctx.currentTime, 92, 42, 0.055, vol * 0.8, 'sine');
  }

  public playLand(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.playBandNoise(0.11, 340, 0.9, 0.1);
    this.playPunchOsc(ctx, ctx.currentTime, 110, 36, 0.11, 0.11, 'sine');
  }

  public playHitmarker(headshot: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (headshot) {
      // Sharp helmet crack + crisp metallic ding
      this.playBandNoise(0.04, 3200, 1.2, 0.11);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1780, now);
      osc.frequency.exponentialRampToValueAtTime(2340, now + 0.09);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.16);
    } else {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1020, now);
      osc.frequency.exponentialRampToValueAtTime(580, now + 0.035);
      gain.gain.setValueAtTime(0.095, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.042);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.046);
    }
  }

  public playMeleeSlash(): void {
    this.playBandNoise(0.14, 2400, 1.1, 0.13);
  }

  public playSlide(): void {
    this.playBandNoise(0.24, 720, 0.8, 0.11);
  }

  public playExplosion(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.playBandNoise(0.45, 460, 0.6, 0.28);
    this.playBandNoise(0.22, 1400, 0.8, 0.14);
    const now = ctx.currentTime;
    this.playPunchOsc(ctx, now, 118, 26, 0.42, 0.26, 'sine');
  }

  public playHeal(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.06);
      gain.gain.setValueAtTime(0.09, now + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.06 + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.06);
      osc.stop(now + i * 0.06 + 0.15);
    });
  }

  public playReload(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Mag release click -> mag seat -> slide rack
    this.playMechanicalClick(ctx, now, 1150, 0.06);
    this.playMechanicalClick(ctx, now + 0.24, 880, 0.07);
    this.playMechanicalClick(ctx, now + 0.48, 1680, 0.075);
  }

  public playRoundEnd(won: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = won ? [523.25, 659.25, 783.99, 1046.5] : [392.0, 349.23, 293.66];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);
      gain.gain.setValueAtTime(0.11, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.08 + 0.24);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.25);
    });
  }

  public playPlayerHit(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.playBandNoise(0.07, 1100, 0.9, 0.12);
    this.playPunchOsc(ctx, now, 155, 58, 0.11, 0.13, 'sawtooth');
  }

  private playPunchOsc(
    ctx: AudioContext,
    startTime: number,
    startHz: number,
    endHz: number,
    dur: number,
    vol: number,
    type: OscillatorType
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(startHz, startTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endHz), startTime + dur);
    gain.gain.setValueAtTime(vol, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + dur + 0.01);
  }

  private playMechanicalClick(
    ctx: AudioContext,
    startTime: number,
    hz: number,
    vol: number
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(hz, startTime);
    osc.frequency.exponentialRampToValueAtTime(hz * 0.55, startTime + 0.032);
    gain.gain.setValueAtTime(vol, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.035);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + 0.04);
  }

  private playBandNoise(
    duration: number,
    cutoffHz: number,
    q: number,
    volume: number
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const sampleRate = ctx.sampleRate;
    const length = Math.max(1, Math.floor(sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      const env = Math.pow(1 - i / length, 1.35);
      data[i] = (Math.random() * 2 - 1) * env;
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoffHz;
    filter.Q.value = q;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  }
}

export const shooterAudio = new RivalsAudioEngine();
