import type { Bands, AudioSource, AudioBandsCallbacks } from './types';

const ZERO: Bands = { bass: 0, mid: 0, high: 0, overall: 0 };

function avg(arr: Uint8Array<ArrayBuffer>, from: number, to: number): number {
  let sum = 0;
  for (let i = from; i < to; i++) sum += arr[i];
  return sum / (to - from);
}

function computeBands(
  analyser: AnalyserNode,
  data: Uint8Array<ArrayBuffer>,
): Bands {
  analyser.getByteFrequencyData(data);
  const len = data.length;
  const bass = avg(data, 0, Math.floor(len * 0.08));
  const mid = avg(data, Math.floor(len * 0.08), Math.floor(len * 0.4));
  const high = avg(data, Math.floor(len * 0.4), len);
  return {
    bass: bass / 255,
    mid: mid / 255,
    high: high / 255,
    overall: (bass * 0.5 + mid * 0.3 + high * 0.2) / 255,
  };
}

/**
 * Vanilla JS class — no framework dependency.
 * Works in React, Vue, Svelte, or plain HTML.
 *
 * Call destroy() when done to close the AudioContext and stop the mic.
 */
export class AudioBands {
  private callbacks: AudioBandsCallbacks;

  private ctx: AudioContext | null = null;
  private musicAnalyser: AnalyserNode | null = null;
  private musicData: Uint8Array<ArrayBuffer> | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private micData: Uint8Array<ArrayBuffer> | null = null;
  private micWaveformData: Uint8Array<ArrayBuffer> | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private musicSource: MediaElementAudioSourceNode | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private micStream: MediaStream | null = null;
  private destroyed = false;

  constructor(callbacks: AudioBandsCallbacks = {}) {
    this.callbacks = callbacks;
  }

  // Lazy — AudioContext must be created after a user gesture
  private ensureCtx(): AudioContext {
    if (this.destroyed) {
      throw new Error('[audio-bands] This AudioBands instance was destroyed');
    }
    if (this.ctx) return this.ctx;

    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;

    const ctx = new Ctx();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.85;
    analyser.connect(ctx.destination);

    this.ctx = ctx;
    this.musicAnalyser = analyser;
    this.musicData = new Uint8Array(
      analyser.frequencyBinCount,
    ) as Uint8Array<ArrayBuffer>;

    return ctx;
  }

  async load(url: string): Promise<void> {
    const ctx = this.ensureCtx();

    this.teardownMusic();

    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.src = url;
    audio.loop = true;
    this.audioEl = audio;

    const source = ctx.createMediaElementSource(audio);
    source.connect(this.musicAnalyser!);
    this.musicSource = source;

    try {
      await audio.play();
      this.callbacks.onPlay?.();
    } catch (error) {
      this.callbacks.onError?.(error);
      throw error;
    }
  }

  togglePlayPause(): void {
    const audio = this.audioEl;
    if (!audio) return;
    if (audio.paused) {
      void audio
        .play()
        .then(() => this.callbacks.onPlay?.())
        .catch((error) => this.callbacks.onError?.(error));
    } else {
      audio.pause();
      this.callbacks.onPause?.();
    }
  }

  async enableMic(): Promise<void> {
    const ctx = this.ensureCtx();
    if (this.micStream) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      this.micStream = stream;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      this.micAnalyser = analyser;
      this.micData = new Uint8Array(
        analyser.frequencyBinCount,
      ) as Uint8Array<ArrayBuffer>;
      this.micWaveformData = new Uint8Array(
        analyser.fftSize,
      ) as Uint8Array<ArrayBuffer>;

      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      // Not connected to destination — prevents mic feedback
      this.micSource = source;

      this.callbacks.onMicStart?.();
    } catch (error) {
      this.callbacks.onError?.(error);
      throw error;
    }
  }

  disableMic(): void {
    const hadMic = Boolean(this.micStream || this.micSource || this.micAnalyser);
    this.micStream?.getTracks().forEach((t) => t.stop());
    this.micStream = null;
    try {
      this.micSource?.disconnect();
    } catch {
      /* already disconnected */
    }
    this.micSource = null;
    this.micAnalyser = null;
    this.micData = null;
    this.micWaveformData = null;
    if (hadMic) this.callbacks.onMicStop?.();
  }

  // Call inside requestAnimationFrame to get current frequency data
  getBands(source: AudioSource = 'music'): Bands {
    if (source === 'mic') {
      if (!this.micAnalyser || !this.micData) return { ...ZERO };
      return computeBands(this.micAnalyser, this.micData);
    }
    if (!this.musicAnalyser || !this.musicData) return { ...ZERO };
    return computeBands(this.musicAnalyser, this.musicData);
  }

  // Call inside requestAnimationFrame to get raw FFT frequency bins (0–255 per bin)
  getFftData(source: AudioSource = 'music'): Uint8Array<ArrayBuffer> | null {
    if (source === 'mic') {
      if (!this.micAnalyser || !this.micData) return null;
      this.micAnalyser.getByteFrequencyData(this.micData);
      return this.micData;
    }
    if (!this.musicAnalyser || !this.musicData) return null;
    this.musicAnalyser.getByteFrequencyData(this.musicData);
    return this.musicData;
  }

  // Call inside requestAnimationFrame to get raw time-domain waveform
  getWaveform(): Uint8Array<ArrayBuffer> | null {
    if (!this.micAnalyser || !this.micWaveformData) return null;
    this.micAnalyser.getByteTimeDomainData(this.micWaveformData);
    return this.micWaveformData;
  }

  // Call when done — stops mic, closes AudioContext
  destroy(): void {
    if (this.destroyed) return;

    this.teardownMusic();
    this.disableMic();
    void this.ctx?.close();
    this.ctx = null;
    this.musicAnalyser = null;
    this.musicData = null;
    this.callbacks = {};
    this.destroyed = true;
  }

  private teardownMusic(): void {
    this.audioEl?.pause();
    if (this.audioEl) {
      this.audioEl.src = '';
      this.audioEl.load();
    }
    this.audioEl = null;

    try {
      this.musicSource?.disconnect();
    } catch {
      /* already disconnected */
    }
    this.musicSource = null;
  }
}
