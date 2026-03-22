export type Bands = {
  bass: number;    // 0–1, low frequencies (0–8% of spectrum)
  mid: number;     // 0–1, mid frequencies (8–40%)
  high: number;    // 0–1, high frequencies (40–100%)
  overall: number; // 0–1, weighted mix (bass×0.5 + mid×0.3 + high×0.2)
};

export type AudioSource = 'music' | 'mic';

export type AudioBandsCallbacks = {
  onPlay?: () => void;
  onPause?: () => void;
  onError?: () => void;
  onMicStart?: () => void;
  onMicStop?: () => void;
};
