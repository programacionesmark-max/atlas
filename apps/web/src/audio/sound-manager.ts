export type SoundEffect =
  | 'dice'
  | 'move'
  | 'buy'
  | 'rent'
  | 'money'
  | 'card'
  | 'notification'
  | 'trade'
  | 'bankruptcy'
  | 'victory';

export interface SoundSettings {
  master: number;
  music: number;
  sfx: number;
  muted: boolean;
}

const STORAGE_KEY = 'atlas-estates:audio:v1';
const DEFAULT_SETTINGS: SoundSettings = { master: 0.72, music: 0.22, sfx: 0.7, muted: false };

type BrowserWindow = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };

function clamp(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

function loadSettings(): SoundSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? ''
    ) as Partial<SoundSettings>;
    return {
      master: clamp(parsed.master ?? DEFAULT_SETTINGS.master),
      music: clamp(parsed.music ?? DEFAULT_SETTINGS.music),
      sfx: clamp(parsed.sfx ?? DEFAULT_SETTINGS.sfx),
      muted: Boolean(parsed.muted)
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

class SoundManager {
  private settings = loadSettings();
  private context: AudioContext | null = null;
  private output: GainNode | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;
  private listeners = new Set<() => void>();

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = (): SoundSettings => this.settings;

  installAutoUnlock(): void {
    if (typeof window === 'undefined') return;
    const unlock = () => {
      void this.unlock();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock, { once: true, passive: true });
    window.addEventListener('keydown', unlock, { once: true });
  }

  async unlock(): Promise<void> {
    if (typeof window === 'undefined') return;
    if (!this.context) {
      const AudioContextClass = window.AudioContext ?? (window as BrowserWindow).webkitAudioContext;
      if (!AudioContextClass) return;
      this.context = new AudioContextClass();
      this.output = this.context.createGain();
      this.output.connect(this.context.destination);
      this.applyVolume();
    }
    if (this.context.state === 'suspended') await this.context.resume();
    this.syncMusic();
  }

  setSettings(patch: Partial<SoundSettings>): void {
    this.settings = {
      master: clamp(patch.master ?? this.settings.master),
      music: clamp(patch.music ?? this.settings.music),
      sfx: clamp(patch.sfx ?? this.settings.sfx),
      muted: patch.muted ?? this.settings.muted
    };
    if (typeof window !== 'undefined')
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    this.applyVolume();
    this.syncMusic();
    for (const listener of this.listeners) listener();
  }

  play(effect: SoundEffect): void {
    if (!this.context || !this.output || this.settings.muted || this.settings.sfx === 0) return;
    const volume = this.settings.sfx;
    switch (effect) {
      case 'dice':
        this.tone(150, 0.07, volume * 0.16, 'square');
        this.tone(105, 0.08, volume * 0.13, 'square', 0.085);
        this.tone(185, 0.06, volume * 0.11, 'triangle', 0.17);
        break;
      case 'move':
        this.tone(330, 0.055, volume * 0.08, 'triangle');
        this.tone(392, 0.055, volume * 0.08, 'triangle', 0.07);
        break;
      case 'buy':
        this.chime([392, 523.25, 659.25], volume * 0.12);
        break;
      case 'rent':
        this.chime([440, 349.23, 293.66], volume * 0.1);
        break;
      case 'money':
        this.chime([523.25, 659.25], volume * 0.1);
        break;
      case 'card':
        this.chime([293.66, 440, 587.33], volume * 0.09);
        break;
      case 'notification':
        this.chime([659.25, 783.99], volume * 0.08);
        break;
      case 'trade':
        this.chime([349.23, 440, 349.23], volume * 0.09);
        break;
      case 'bankruptcy':
        this.chime([293.66, 246.94, 196], volume * 0.12, 0.15);
        break;
      case 'victory':
        this.chime([392, 493.88, 587.33, 783.99], volume * 0.14, 0.12);
        break;
    }
  }

  private applyVolume(): void {
    if (!this.context || !this.output) return;
    const value = this.settings.muted ? 0 : this.settings.master;
    this.output.gain.setTargetAtTime(value, this.context.currentTime, 0.02);
  }

  private syncMusic(): void {
    const shouldPlay = Boolean(
      this.context && !this.settings.muted && this.settings.master > 0 && this.settings.music > 0
    );
    if (!shouldPlay && this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
      return;
    }
    if (!shouldPlay || this.musicTimer !== null) return;
    this.playMusicStep();
    this.musicTimer = window.setInterval(() => this.playMusicStep(), 3_800);
  }

  private playMusicStep(): void {
    const chords = [
      [130.81, 196, 261.63],
      [146.83, 220, 293.66],
      [110, 164.81, 220],
      [98, 146.83, 196]
    ];
    const chord = chords[this.musicStep % chords.length] ?? chords[0]!;
    this.musicStep += 1;
    for (const frequency of chord)
      this.tone(frequency, 2.7, this.settings.music * 0.022, 'sine', 0, true);
  }

  private chime(frequencies: readonly number[], volume: number, spacing = 0.09): void {
    frequencies.forEach((frequency, index) =>
      this.tone(frequency, 0.18, volume, 'triangle', index * spacing)
    );
  }

  private tone(
    frequency: number,
    duration: number,
    volume: number,
    type: OscillatorType,
    delay = 0,
    soft = false
  ): void {
    if (!this.context || !this.output) return;
    const start = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), start + (soft ? 0.35 : 0.01));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(this.output);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  }
}

export const soundManager = new SoundManager();
