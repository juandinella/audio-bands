import { AudioBandsError } from './errors';
import type {
  AudioAnalyserConfig,
  AudioBandsOptions,
  AudioBandsState,
  AudioSource,
  BandRange,
  Bands,
  ClassicBandRanges,
  CustomBandRanges,
} from './types';

const DEFAULT_MUSIC_ANALYSER: Required<AudioAnalyserConfig> = {
  fftSize: 256,
  smoothingTimeConstant: 0.85,
};

const DEFAULT_MIC_ANALYSER: Required<AudioAnalyserConfig> = {
  fftSize: 256,
  smoothingTimeConstant: 0.8,
};

const DEFAULT_CLASSIC_RANGES: Record<keyof Omit<Bands, 'overall'>, BandRange> = {
  bass: { from: 0, to: 0.08 },
  mid: { from: 0.08, to: 0.4 },
  high: { from: 0.4, to: 1 },
};

const ZERO: Bands = { bass: 0, mid: 0, high: 0, overall: 0 };

function avg(arr: Uint8Array<ArrayBuffer>, from: number, to: number): number {
  let sum = 0;
  for (let i = from; i < to; i++) sum += arr[i];
  return sum / (to - from);
}

function isPowerOfTwo(value: number): boolean {
  return (value & (value - 1)) === 0;
}

function normalizeAnalyserConfig(
  config: AudioAnalyserConfig | undefined,
  fallback: Required<AudioAnalyserConfig>,
): Required<AudioAnalyserConfig> {
  const fftSize = config?.fftSize ?? fallback.fftSize;
  const smoothingTimeConstant =
    config?.smoothingTimeConstant ?? fallback.smoothingTimeConstant;

  if (
    !Number.isInteger(fftSize) ||
    fftSize < 32 ||
    fftSize > 32768 ||
    !isPowerOfTwo(fftSize)
  ) {
    throw new AudioBandsError(
      'config',
      'invalid_config',
      'fftSize must be a power of two between 32 and 32768',
    );
  }

  if (
    typeof smoothingTimeConstant !== 'number' ||
    smoothingTimeConstant < 0 ||
    smoothingTimeConstant > 1
  ) {
    throw new AudioBandsError(
      'config',
      'invalid_config',
      'smoothingTimeConstant must be between 0 and 1',
    );
  }

  return { fftSize, smoothingTimeConstant };
}

function normalizeRange(name: string, range: BandRange | undefined): BandRange {
  const normalized = range ?? DEFAULT_CLASSIC_RANGES[name as keyof typeof DEFAULT_CLASSIC_RANGES];

  if (
    typeof normalized?.from !== 'number' ||
    typeof normalized?.to !== 'number' ||
    normalized.from < 0 ||
    normalized.to > 1 ||
    normalized.from >= normalized.to
  ) {
    throw new AudioBandsError(
      'config',
      'invalid_config',
      `Band range "${name}" must satisfy 0 <= from < to <= 1`,
    );
  }

  return normalized;
}

function normalizeClassicRanges(
  ranges: ClassicBandRanges | undefined,
): Record<keyof Omit<Bands, 'overall'>, BandRange> {
  return {
    bass: normalizeRange('bass', ranges?.bass),
    mid: normalizeRange('mid', ranges?.mid),
    high: normalizeRange('high', ranges?.high),
  };
}

function normalizeCustomBands(customBands: CustomBandRanges | undefined): CustomBandRanges {
  if (!customBands) return {};

  return Object.fromEntries(
    Object.entries(customBands).map(([name, range]) => [name, normalizeRange(name, range)]),
  );
}

function getIndexes(len: number, range: BandRange): [number, number] {
  const from = Math.max(0, Math.min(len - 1, Math.floor(len * range.from)));
  const to = Math.max(from + 1, Math.min(len, Math.floor(len * range.to)));
  return [from, to];
}

function getRangeValue(data: Uint8Array<ArrayBuffer>, range: BandRange): number {
  const [from, to] = getIndexes(data.length, range);
  return avg(data, from, to) / 255;
}

function fillFrequencyData(
  analyser: AnalyserNode,
  data: Uint8Array<ArrayBuffer>,
): Uint8Array<ArrayBuffer> {
  analyser.getByteFrequencyData(data);
  return data;
}

function computeBands(
  data: Uint8Array<ArrayBuffer>,
  ranges: Record<keyof Omit<Bands, 'overall'>, BandRange>,
): Bands {
  const bass = getRangeValue(data, ranges.bass);
  const mid = getRangeValue(data, ranges.mid);
  const high = getRangeValue(data, ranges.high);

  return {
    bass,
    mid,
    high,
    overall: bass * 0.5 + mid * 0.3 + high * 0.2,
  };
}

function computeCustomBands(
  data: Uint8Array<ArrayBuffer>,
  ranges: CustomBandRanges,
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(ranges).map(([name, range]) => [name, getRangeValue(data, range)]),
  );
}

function cloneState(state: AudioBandsState): AudioBandsState {
  return { ...state };
}

/**
 * Vanilla JS class — no framework dependency.
 * Works in React, Vue, Svelte, or plain HTML.
 */
export class AudioBands {
  private options: AudioBandsOptions;
  private readonly musicConfig: Required<AudioAnalyserConfig>;
  private readonly micConfig: Required<AudioAnalyserConfig>;
  private readonly classicRanges: Record<keyof Omit<Bands, 'overall'>, BandRange>;
  private readonly customBandRanges: CustomBandRanges;

  private readonly state: AudioBandsState = {
    isPlaying: false,
    micActive: false,
    hasTrack: false,
    loadError: null,
    micError: null,
  };

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

  constructor(options: AudioBandsOptions = {}) {
    this.options = options;
    this.musicConfig = normalizeAnalyserConfig(options.music, DEFAULT_MUSIC_ANALYSER);
    this.micConfig = normalizeAnalyserConfig(options.mic, DEFAULT_MIC_ANALYSER);
    this.classicRanges = normalizeClassicRanges(options.bandRanges);
    this.customBandRanges = normalizeCustomBands(options.customBands);
  }

  getState(): AudioBandsState {
    return cloneState(this.state);
  }

  getCustomBands(source: AudioSource = 'music'): Record<string, number> {
    const data = this.readFrequencyData(source);
    if (!data) return computeCustomBands(new Uint8Array(1) as Uint8Array<ArrayBuffer>, this.customBandRanges);
    return computeCustomBands(data, this.customBandRanges);
  }

  async load(url: string): Promise<void> {
    let ctx: AudioContext;
    try {
      ctx = this.ensureCtx();
    } catch (error) {
      throw this.handleError('load', error);
    }

    this.teardownMusic();

    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.src = url;
    audio.loop = true;
    this.audioEl = audio;
    this.setState({ hasTrack: true, loadError: null });

    const source = ctx.createMediaElementSource(audio);
    source.connect(this.musicAnalyser!);
    this.musicSource = source;

    try {
      await audio.play();
      this.setState({ isPlaying: true, loadError: null });
      this.options.onPlay?.();
    } catch (error) {
      throw this.handleError('load', error, 'load_error');
    }
  }

  togglePlayPause(): void {
    const audio = this.audioEl;
    if (!audio) return;

    if (audio.paused) {
      void audio
        .play()
        .then(() => {
          this.setState({ isPlaying: true, loadError: null });
          this.options.onPlay?.();
        })
        .catch((error) => {
          this.handleError('load', error, 'playback_error');
        });
      return;
    }

    audio.pause();
    this.setState({ isPlaying: false });
    this.options.onPause?.();
  }

  async enableMic(): Promise<void> {
    let ctx: AudioContext;
    try {
      ctx = this.ensureCtx();
    } catch (error) {
      throw this.handleError('mic', error);
    }

    if (this.micStream) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      this.micStream = stream;

      const analyser = this.createAnalyser(ctx, this.micConfig);
      this.micAnalyser = analyser;
      this.micData = new Uint8Array(
        analyser.frequencyBinCount,
      ) as Uint8Array<ArrayBuffer>;
      this.micWaveformData = new Uint8Array(
        analyser.fftSize,
      ) as Uint8Array<ArrayBuffer>;

      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      this.micSource = source;

      this.setState({ micActive: true, micError: null });
      this.options.onMicStart?.();
    } catch (error) {
      throw this.handleError('mic', error, 'mic_error');
    }
  }

  disableMic(): void {
    const hadMic = Boolean(this.micStream || this.micSource || this.micAnalyser);
    this.micStream?.getTracks().forEach((track) => track.stop());
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
    this.setState({ micActive: false });

    if (hadMic) this.options.onMicStop?.();
  }

  getBands(source: AudioSource = 'music'): Bands {
    const data = this.readFrequencyData(source);
    if (!data) return { ...ZERO };
    return computeBands(data, this.classicRanges);
  }

  getFftData(source: AudioSource = 'music'): Uint8Array<ArrayBuffer> | null {
    return this.readFrequencyData(source);
  }

  getWaveform(): Uint8Array<ArrayBuffer> | null {
    if (!this.micAnalyser || !this.micWaveformData) return null;
    this.micAnalyser.getByteTimeDomainData(this.micWaveformData);
    return this.micWaveformData;
  }

  destroy(): void {
    if (this.destroyed) return;

    this.teardownMusic();
    this.disableMic();
    void this.ctx?.close();
    this.ctx = null;
    this.musicAnalyser = null;
    this.musicData = null;
    this.setState({ isPlaying: false, micActive: false, hasTrack: false });
    this.options = {};
    this.destroyed = true;
  }

  private readFrequencyData(source: AudioSource): Uint8Array<ArrayBuffer> | null {
    if (source === 'mic') {
      if (!this.micAnalyser || !this.micData) return null;
      return fillFrequencyData(this.micAnalyser, this.micData);
    }

    if (!this.musicAnalyser || !this.musicData) return null;
    return fillFrequencyData(this.musicAnalyser, this.musicData);
  }

  private ensureCtx(): AudioContext {
    if (this.destroyed) {
      throw new AudioBandsError(
        'lifecycle',
        'destroyed',
        'This AudioBands instance was destroyed',
      );
    }

    if (this.ctx) return this.ctx;

    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

    if (!Ctx) {
      throw new AudioBandsError(
        'lifecycle',
        'unsupported_audio_context',
        'AudioContext is not supported in this environment',
      );
    }

    const ctx = new Ctx();
    const analyser = this.createAnalyser(ctx, this.musicConfig);
    analyser.connect(ctx.destination);

    this.ctx = ctx;
    this.musicAnalyser = analyser;
    this.musicData = new Uint8Array(
      analyser.frequencyBinCount,
    ) as Uint8Array<ArrayBuffer>;

    return ctx;
  }

  private createAnalyser(
    ctx: AudioContext,
    config: Required<AudioAnalyserConfig>,
  ): AnalyserNode {
    const analyser = ctx.createAnalyser();
    analyser.fftSize = config.fftSize;
    analyser.smoothingTimeConstant = config.smoothingTimeConstant;
    return analyser;
  }

  private handleError(
    kind: 'load' | 'mic',
    error: unknown,
    fallbackCode: 'load_error' | 'playback_error' | 'mic_error' = kind === 'mic'
      ? 'mic_error'
      : 'load_error',
  ): AudioBandsError {
    const wrapped =
      error instanceof AudioBandsError
        ? error
        : new AudioBandsError(
            kind,
            fallbackCode,
            kind === 'mic'
              ? 'Failed to access microphone input'
              : 'Failed to load or play audio track',
            error,
          );

    if (kind === 'load') {
      this.setState({ isPlaying: false, loadError: wrapped });
      this.options.onLoadError?.(wrapped);
    } else {
      this.setState({ micActive: false, micError: wrapped });
      this.options.onMicError?.(wrapped);
    }

    this.options.onError?.(wrapped);
    return wrapped;
  }

  private setState(patch: Partial<AudioBandsState>): void {
    let changed = false;

    for (const [key, value] of Object.entries(patch) as Array<
      [keyof AudioBandsState, AudioBandsState[keyof AudioBandsState]]
    >) {
      if (this.state[key] !== value) {
        this.state[key] = value as never;
        changed = true;
      }
    }

    if (changed) this.options.onStateChange?.(this.getState());
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
    this.setState({ isPlaying: false, hasTrack: false });
  }
}
