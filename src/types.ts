import type { AudioBandsError } from './errors';

export type Bands = {
  bass: number; // 0–1, low-end analyser region energy
  mid: number; // 0–1, mid analyser region energy
  high: number; // 0–1, high-end analyser region energy
  overall: number; // 0–1, UI-oriented weighted mix (bass×0.5 + mid×0.3 + high×0.2)
};

export type AudioBandsSnapshot = {
  bands: Bands;
  customBands: Record<string, number>;
  fft: Uint8Array<ArrayBuffer> | null;
  waveform: Uint8Array<ArrayBuffer> | null;
};

export type AudioSource = 'music' | 'mic';

export type AudioBandsErrorKind = 'load' | 'mic' | 'lifecycle' | 'config';

export type AudioBandsErrorCode =
  | 'load_error'
  | 'playback_error'
  | 'mic_error'
  | 'destroyed'
  | 'unsupported_audio_context'
  | 'invalid_config';

export type AudioAnalyserConfig = {
  fftSize?: number;
  smoothingTimeConstant?: number;
};

export type BandRange = {
  from: number;
  to: number;
};

export type ClassicBandRanges = {
  bass?: BandRange;
  mid?: BandRange;
  high?: BandRange;
};

export type CustomBandRanges = Record<string, BandRange>;

export type AudioBandsState = {
  isPlaying: boolean;
  micActive: boolean;
  hasTrack: boolean;
  loadError: AudioBandsError | null;
  micError: AudioBandsError | null;
};

export type AudioBandsCallbacks = {
  onPlay?: () => void;
  onPause?: () => void;
  onError?: (error: AudioBandsError) => void;
  onLoadError?: (error: AudioBandsError) => void;
  onMicError?: (error: AudioBandsError) => void;
  onMicStart?: () => void;
  onMicStop?: () => void;
  onStateChange?: (state: AudioBandsState) => void;
};

export type AudioBandsOptions = AudioBandsCallbacks & {
  music?: AudioAnalyserConfig;
  mic?: AudioAnalyserConfig;
  bandRanges?: ClassicBandRanges;
  customBands?: CustomBandRanges;
};
