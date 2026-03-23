# audio-bands

[![npm](https://img.shields.io/npm/v/@juandinella/audio-bands)](https://www.npmjs.com/package/@juandinella/audio-bands)

**Demo**: [audio-bands.juandinella.com](https://audio-bands.juandinella.com)

Headless audio analysis for the browser. Get normalized `bass`, `mid`, `high`, custom named bands, raw FFT bins, or mic waveform data without shipping a renderer.

```ts
const { bass, mid, high } = audio.getBands();
const custom = audio.getCustomBands();
const fft = audio.getFftData();
```

## Why

Most audio libraries either only play audio or immediately draw a canvas for you. This one stays lower level: it gives you usable analysis data and lets you decide how to render it.

## Install

```bash
npm install @juandinella/audio-bands
```

### Entry points

- `@juandinella/audio-bands`: main framework-agnostic export
- `@juandinella/audio-bands/core`: explicit core-only entry
- `@juandinella/audio-bands/react`: React hook

If you use the React hook, install `react` as well.

## Usage

### Vanilla JS

```ts
import { AudioBands } from '@juandinella/audio-bands';

const audio = new AudioBands({
  music: {
    fftSize: 512,
    smoothingTimeConstant: 0.7,
  },
  customBands: {
    presence: { from: 0.25, to: 0.5 },
    air: { from: 0.5, to: 1 },
  },
  onLoadError: (error) => console.error('track error', error),
  onMicError: (error) => console.error('mic error', error),
});

await audio.load('/track.mp3');

function loop() {
  const { bass, mid, high, overall } = audio.getBands();
  const custom = audio.getCustomBands();
  const fft = audio.getFftData();

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
```

### React hook

```tsx
import { useAudioBands } from '@juandinella/audio-bands/react';

function Visualizer() {
  const {
    isPlaying,
    hasTrack,
    loadError,
    micError,
    loadTrack,
    togglePlayPause,
    toggleMic,
    getBands,
    getCustomBands,
  } = useAudioBands({
    customBands: {
      presence: { from: 0.25, to: 0.5 },
    },
  });

  return (
    <>
      <button onClick={() => loadTrack('/track.mp3')}>load</button>
      <button onClick={togglePlayPause}>{isPlaying ? 'Pause' : 'Play'}</button>
      <button onClick={toggleMic}>Toggle mic</button>
      <pre>{JSON.stringify({ hasTrack, loadError, micError, ...getBands(), ...getCustomBands() }, null, 2)}</pre>
    </>
  );
}
```

### Mic input

```ts
await audio.enableMic();

const micBands = audio.getBands('mic');
const micCustomBands = audio.getCustomBands('mic');
const waveform = audio.getWaveform();
```

## When To Use Bands Vs FFT

Use `getBands()` when you want stable, simple control signals:

- pulsing a blob with low-end energy
- scaling UI based on overall intensity
- animating typography or CSS variables
- driving scenes where three broad zones are enough

Use `getCustomBands()` when the default bass/mid/high split is too coarse, but you still want named, high-level buckets:

- separate `presence`, `air`, or `sub`
- tune bands to your own design system or animation logic
- keep your render code semantic instead of index-based

Use `getFftData()` when you need bin-level detail:

- bar visualizers
- line spectrums
- log interpolation
- any renderer that maps directly over bins

Rule of thumb:

- `getBands()` for product UI
- `getCustomBands()` for art direction
- `getFftData()` for visualizers

## API

### `AudioBands`

```ts
new AudioBands(options?: AudioBandsOptions)
```

#### Methods

| Method                  | Description |
| ----------------------- | ----------- |
| `load(url)`             | Load and play a track. Rejects with `AudioBandsError` on failure. |
| `togglePlayPause()`     | Toggle the current track. |
| `enableMic()`           | Request microphone access and start mic analysis. Rejects with `AudioBandsError` on failure. |
| `disableMic()`          | Stop mic input and clean up the stream. |
| `getBands(source?)`     | Returns normalized `{ bass, mid, high, overall }`. |
| `getCustomBands(source?)` | Returns normalized values for configured custom bands. |
| `getFftData(source?)`   | Returns raw `Uint8Array` frequency bins. |
| `getWaveform()`         | Returns raw mic time-domain data. |
| `getState()`            | Returns the current playback/mic/error state. |
| `destroy()`             | Stop playback, release the mic and close the `AudioContext`. |

### `useAudioBands()`

```ts
const {
  isPlaying,
  micActive,
  hasTrack,
  audioError,
  loadError,
  micError,
  state,
  loadTrack,
  togglePlayPause,
  toggleMic,
  getBands,
  getCustomBands,
  getFftData,
  getWaveform,
} = useAudioBands(options);
```

### `AudioBandsOptions`

```ts
type AudioBandsOptions = {
  music?: {
    fftSize?: number;
    smoothingTimeConstant?: number;
  };
  mic?: {
    fftSize?: number;
    smoothingTimeConstant?: number;
  };
  bandRanges?: {
    bass?: { from: number; to: number };
    mid?: { from: number; to: number };
    high?: { from: number; to: number };
  };
  customBands?: Record<string, { from: number; to: number }>;
  onError?: (error: AudioBandsError) => void;
  onLoadError?: (error: AudioBandsError) => void;
  onMicError?: (error: AudioBandsError) => void;
  onStateChange?: (state: AudioBandsState) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onMicStart?: () => void;
  onMicStop?: () => void;
};
```

### `AudioBandsState`

```ts
type AudioBandsState = {
  isPlaying: boolean;
  micActive: boolean;
  hasTrack: boolean; // a track source is assigned, even if playback later fails
  loadError: AudioBandsError | null;
  micError: AudioBandsError | null;
};
```

## Notes

- `AudioContext` is created lazily on the first call to `load()` or `enableMic()`.
- `hasTrack` means a track source is currently assigned to the instance. It can still be `true` if `play()` fails due to autoplay policy or another playback error.
- The mic analyser is not connected to `AudioContext.destination`, so it will not feed back into the speakers.
- `getBands()`, `getCustomBands()`, `getFftData()`, and `getWaveform()` read live data. Call them inside `requestAnimationFrame`, not from React state updates.
- `getFftData()` returns the same underlying buffer on each call. Copy it if you need frame-to-frame comparisons.
- `fftSize` must be a power of two between `32` and `32768`.
- Band ranges are normalized from `0` to `1`, where `0` is the start of the analyser spectrum and `1` is the end.

## License

MIT
