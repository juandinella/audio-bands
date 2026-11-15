import { useCallback, useEffect, useRef, useState } from 'react';
import { useAudioBands } from '@juandinella/audio-bands/react';
import type { Bands } from '@juandinella/audio-bands';

// CC BY 3.0 tracks from ccMixter. The licence asks for credit: the deck
// shows the artist, the page footer the full attribution. Sources in
// public/audio/CREDITS.md.
const ccBy3 = 'https://creativecommons.org/licenses/by/3.0/';
export const tracks = [
  {
    name: 'I dunno',
    by: 'grapes',
    featuring: 'J Lang, Morusque',
    url: '/audio/i-dunno.m4a',
    page: 'https://ccmixter.org/files/grapes/16626',
    license: ccBy3,
  },
  {
    name: 'Drive',
    by: 'AlexBeroza',
    featuring: 'cdk & Darryl J',
    url: '/audio/drive.m4a',
    page: 'https://ccmixter.org/files/AlexBeroza/43098',
    license: ccBy3,
  },
  {
    name: 'Parametaphoriquement',
    by: 'gmz',
    featuring: 'Morusque',
    url: '/audio/parametaphoriquement.m4a',
    page: 'https://ccmixter.org/files/gmz/19367',
    license: ccBy3,
  },
  {
    name: 'nightWalk',
    by: 'airtone',
    featuring: '',
    url: '/audio/nightwalk.m4a',
    page: 'https://ccmixter.org/files/airtone/56520',
    license: ccBy3,
  },
];

export type Input = 'Line' | 'Mic';

// Response is the meter's ballistics: how fast the reading follows the signal.
export const responses = { Fast: 0.6, Med: 0.85, Slow: 0.95 } as const;
export type Response = keyof typeof responses;

// Resolution is the analyser's fftSize, printed as the bins it yields.
export const resolutions = { '128': 256, '512': 1024, '2048': 4096 } as const;
export type Resolution = keyof typeof resolutions;

// Crossover knobs turn on a log scale, as on hardware.
export const crossovers = {
  low: { min: 60, max: 3000, initial: 400 },
  high: { min: 500, max: 16000, initial: 3500 },
} as const;
export const positionToHz = (p: number, { min, max }: { min: number; max: number }) =>
  min * Math.pow(max / min, p / 100);

// The edge the library actually uses: ranges map to whole bins. The small
// epsilon keeps an edge passed as k / bins on bin k despite float rounding.
export function effectiveHz(fraction: number, bins: number, nyquist: number) {
  return (Math.max(1, Math.floor(bins * fraction + 1e-9)) / bins) * nyquist;
}

// The crossover edges a knob can actually reach at this resolution: its log
// sweep, snapped to whole bins, without repeats. The knob steps through
// these, like a digital crossover's detents, so every click moves the edge.
export function knobEdges(range: { min: number; max: number }, bins: number, nyquist: number) {
  const edges = new Set<number>();
  // 101 log-spaced positions keep the turn logarithmic; coarse resolutions
  // collapse to fewer, larger steps.
  for (let i = 0; i <= 100; i++) edges.add(effectiveHz(positionToHz(i, range) / nyquist, bins, nyquist));
  return [...edges].sort((a, b) => a - b);
}

export function formatHz(hz: number) {
  return hz >= 1000 ? `${(hz / 1000).toFixed(hz >= 10000 ? 1 : 2)}k` : `${Math.round(hz)}`;
}

export type Frame = { bands: Bands; fft: Uint8Array | null; waveform: Uint8Array | null; live: boolean };

export function useDeck() {
  const audio = useAudioBands();
  const [input, setInputState] = useState<Input>('Line');
  const [track, setTrack] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [response, setResponseState] = useState<Response>('Med');
  const [resolution, setResolutionState] = useState<Resolution>('128');
  const [xLow, setXLow] = useState<number>(crossovers.low.initial);
  const [xHigh, setXHigh] = useState<number>(crossovers.high.initial);
  const [sampleRate, setSampleRate] = useState(48000);
  const [reduced, setReduced] = useState(false);
  const { loadTrack, setAnalyserConfig, setBandRanges, getSampleRate } = audio;
  const live = input === 'Mic' ? audio.micActive : audio.isPlaying;
  const nyquist = sampleRate / 2;
  const bins = resolutions[resolution] / 2;

  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  // Skipping while a track plays starts the next one, as on any deck.
  // Skipping while stopped only cues it.
  const resumeAfterLoad = useRef(false);

  useEffect(() => {
    let current = true;
    const resume = resumeAfterLoad.current;
    resumeAfterLoad.current = false;
    setLoading(true);
    setError('');
    loadTrack(tracks[track].url)
      .then(async () => {
        if (!current) return;
        setSampleRate(getSampleRate() ?? 48000);
        if (resume) {
          // A browser may refuse to start without a fresh gesture; the deck
          // then just waits on the cued track and Play works as usual.
          await audio.play().catch(() => {});
        }
      })
      .catch(() => current && setError('Track failed to load'))
      .finally(() => current && setLoading(false));
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track, loadTrack, getSampleRate]);

  // Both sources share the panel's settings, so switching input keeps them.
  useEffect(() => {
    const config = { smoothingTimeConstant: responses[response], fftSize: resolutions[resolution] };
    setAnalyserConfig('music', config);
    setAnalyserConfig('mic', config);
  }, [response, resolution, setAnalyserConfig]);

  useEffect(() => {
    const low = Math.min(xLow / nyquist + 1e-9, 0.98);
    const high = Math.min(Math.max(xHigh / nyquist + 1e-9, low + 0.001), 0.99);
    setBandRanges({ bass: { from: 0, to: low }, mid: { from: low, to: high }, high: { from: high, to: 1 } });
  }, [xLow, xHigh, nyquist, setBandRanges]);

  const setInput = useCallback(
    async (next: Input) => {
      setInputState(next);
      setError('');
      if (next === 'Mic') {
        audio.pause();
        if (!audio.micActive) {
          try {
            await audio.toggleMic();
            setSampleRate(getSampleRate() ?? 48000);
          } catch {
            // Back to Line, keeping the reason on the deck's display.
            setInputState('Line');
            setError('Microphone blocked');
          }
        }
      } else if (audio.micActive) {
        await audio.toggleMic();
      }
    },
    [audio, getSampleRate],
  );

  const togglePlay = useCallback(async () => {
    setError('');
    try {
      await audio.togglePlayPause();
    } catch {
      setError('Playback blocked');
    }
  }, [audio]);

  const step = (d: number) => {
    resumeAfterLoad.current = audio.isPlaying;
    setTrack((t) => (t + d + tracks.length) % tracks.length);
  };

  return {
    audio,
    input,
    setInput,
    track,
    step,
    loading,
    error,
    live,
    togglePlay,
    response,
    setResponse: setResponseState,
    resolution,
    setResolution: setResolutionState,
    xLow,
    // The bass edge stays below the high edge, and the other way round.
    setXLow: (hz: number) => setXLow(hz < effectiveHz(xHigh / nyquist, bins, nyquist) ? hz : xLow),
    xHigh,
    setXHigh: (hz: number) => setXHigh(hz > effectiveHz(xLow / nyquist, bins, nyquist) ? hz : xHigh),
    sampleRate,
    nyquist,
    bins,
    reduced,
  };
}

export type Deck = ReturnType<typeof useDeck>;

// The meters read the panel's input every frame, outside React. Levels fall
// back to zero through the analyser's own smoothing when the signal stops.
export function useFrame(deck: Deck, draw: (frame: Frame, now: number) => void) {
  const latest = useRef({ deck, draw });
  latest.current = { deck, draw };
  useEffect(() => {
    let raf = 0;
    const loop = (now: number) => {
      const { deck, draw } = latest.current;
      const snap = deck.audio.snapshot(deck.input === 'Mic' ? 'mic' : 'music');
      draw({ bands: snap.bands, fft: snap.fft, waveform: snap.waveform, live: deck.live }, now);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
}

export const install = 'npm i @juandinella/audio-bands';
