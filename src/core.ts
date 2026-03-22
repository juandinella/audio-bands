import type { Bands, AudioSource, AudioBandsCallbacks } from './types';

const ZERO: Bands = { bass: 0, mid: 0, high: 0, overall: 0 };

function avg(arr: Uint8Array<ArrayBuffer>, from: number, to: number): number {
  let sum = 0;
  for (let i = from; i < to; i++) sum += arr[i];
  return sum / (to - from);
}

function computeBands(analyser: AnalyserNode, data: Uint8Array<ArrayBuffer>): Bands {
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
  private audioEl: HTMLAudioElement | null = null;
  private musicSource: MediaElementAudioSourceNode | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private micStream: MediaStream | null = null;

  constructor(callbacks: AudioBandsCallbacks = {}) {
    this.callbacks = callbacks;
  }

  // Lazy — AudioContext must be created after a user gesture
  private ensureCtx(): AudioContext {
    if (this.ctx) return this.ctx;

    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    const ctx = new Ctx();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.85;
    analyser.connect(ctx.destination);

    this.ctx = ctx;
    this.musicAnalyser = analyser;
    this.musicData = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>;

    return ctx;
  }

  async load(url: string): Promise<void> {
    const ctx = this.ensureCtx();

    this.audioEl?.pause();
    if (this.audioEl) this.audioEl.src = '';
    try { this.musicSource?.disconnect(); } catch {}

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
    } catch {
      this.callbacks.onError?.();
    }
  }

  togglePlayPause(): void {
    const audio = this.audioEl;
    if (!audio) return;
    if (audio.paused) {
      audio.play();
      this.callbacks.onPlay?.();
    } else {
      audio.pause();
      this.callbacks.onPause?.();
    }
  }

  async enableMic(): Promise<void> {
    const ctx = this.ensureCtx();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.micStream = stream;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      this.micAnalyser = analyser;
      this.micData = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>;

      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      // Not connected to destination — prevents mic feedback
      this.micSource = source;

      this.callbacks.onMicStart?.();
    } catch {
      console.warn('[audio-bands] Mic access denied');
    }
  }

  disableMic(): void {
    this.micStream?.getTracks().forEach((t) => t.stop());
    this.micStream = null;
    try { this.micSource?.disconnect(); } catch {}
    this.micSource = null;
    this.micAnalyser = null;
    this.micData = null;
    this.callbacks.onMicStop?.();
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

  // Call inside requestAnimationFrame to get raw time-domain waveform
  getWaveform(): Uint8Array<ArrayBuffer> | null {
    if (!this.micAnalyser) return null;
    const data = new Uint8Array(this.micAnalyser.fftSize) as Uint8Array<ArrayBuffer>;
    this.micAnalyser.getByteTimeDomainData(data);
    return data;
  }

  // Call when done — stops mic, closes AudioContext
  destroy(): void {
    this.audioEl?.pause();
    this.micStream?.getTracks().forEach((t) => t.stop());
    this.ctx?.close();
  }
}
