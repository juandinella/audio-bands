# audio-bands

[![npm](https://img.shields.io/npm/v/@juandinella/audio-bands)](https://www.npmjs.com/package/@juandinella/audio-bands)

**Demo**: [audio-bands.juandinella.com](https://audio-bands.juandinella.com)

Headless audio analysis for the browser. Read a consistent frame of low/mid/high energy regions, custom named bands, raw FFT bins, and waveform data without shipping a renderer.

```ts
const frame = audio.snapshot();
const { bass, mid, high } = frame.bands;
const custom = frame.customBands;
const fft = frame.fft;
```

## Why

Most audio libraries either only play audio or immediately draw a canvas for you. This one stays lower level: it gives you usable analysis data and lets you decide how to render it.

The intended center of the API is `snapshot()`: one call, one coherent analysis frame.

## Install

```bash
npm install @juandinella/audio-bands
```

For repository development, `npm test` covers the unit suite. `npm run test:browser` checks the built bundles and exercises native Web Audio in Chromium, including playback and microphone cleanup with a browser-provided test device.

### Entry points

- `@juandinella/audio-bands`: main framework-agnostic export
- `@juandinella/audio-bands/core`: explicit core-only entry
- `@juandinella/audio-bands/react`: React hook

If you use the React hook, install `react` as well.

Minimal reference examples live in [`examples/README.md`](./examples/README.md). The Vite app in `examples/src/App.tsx` is a showcase demo, while `examples/snippets/` contains the smallest copyable integrations.

## Usage

### Vanilla JS

```html
<button id="play" disabled>Play</button>
```

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

const playButton = document.querySelector<HTMLButtonElement>('#play')!;
let disposed = false;
let raf = 0;

function play() {
  void audio.play().catch(console.error);
}

playButton.addEventListener('click', play);
void audio.load('/track.mp3').then(() => {
  if (!disposed) playButton.disabled = false;
}).catch(console.error);

function loop() {
  const frame = audio.snapshot();
  const { bass, mid, high, overall } = frame.bands;
  const custom = frame.customBands;
  const fft = frame.fft;
  const waveform = frame.waveform;

  raf = requestAnimationFrame(loop);
}

raf = requestAnimationFrame(loop);

// Call when removing the visualizer.
function cleanup() {
  disposed = true;
  cancelAnimationFrame(raf);
  playButton.removeEventListener('click', play);
  audio.destroy();
}
```

### React hook

```tsx
import { useEffect, useState } from 'react';
import { useAudioBands } from '@juandinella/audio-bands/react';

function Visualizer() {
  const { loadTrack, togglePlayPause, snapshot, isPlaying, hasTrack } = useAudioBands();
  const [frame, setFrame] = useState(() => snapshot());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isPlaying) return;
    let raf = 0;
    function loop() {
      setFrame(snapshot());
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, snapshot]);

  async function handleLoad() {
    setIsLoading(true);
    setError('');
    try {
      await loadTrack('/track.mp3');
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function handlePlay() {
    setError('');
    try {
      await togglePlayPause();
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <>
      <button onClick={handleLoad} disabled={isLoading}>
        {isLoading ? 'Loading…' : 'Load track'}
      </button>
      <button onClick={handlePlay} disabled={isLoading || !hasTrack}>
        {isPlaying ? 'Pause' : 'Play'}
      </button>
      {error && <p role="alert">{error}</p>}
      <pre>{JSON.stringify(frame.bands, null, 2)}</pre>
    </>
  );
}
```

This example updates React state for a small text display. For canvas rendering, read `snapshot()` and draw inside the animation loop instead. The hook releases audio resources on unmount; the effect above cancels the loop.

### Mic input

```ts
// Call from a click or tap handler.
async function startMic() {
  try {
    await audio.enableMic();
  } catch (error) {
    console.error(error);
  }
}

// Read these inside your animation loop after enabling the mic.
const micBands = audio.getBands('mic');
const micCustomBands = audio.getCustomBands('mic');
const waveform = audio.getWaveform('mic');
```

## What `bass`, `mid`, `high`, and `overall` Mean

`getBands()` returns three coarse analyser regions plus a convenience summary value:

- `bass`, `mid`, and `high` are normalized slices of the analyser spectrum, not fixed acoustic bands in Hz
- the default split is percentage-based (`0-0.08`, `0.08-0.4`, `0.4-1`) over the available FFT bins
- those regions therefore depend on analyser resolution and the underlying audio context sample rate
- `overall` is a UI-oriented weighted summary (`bass * 0.5 + mid * 0.3 + high * 0.2`), not a perceptual loudness metric

Use these values as stable control signals for interaction and motion. If you need tighter semantic control, define `customBands`. If you need physically meaningful bin-level data, use `getFftData()` or `snapshot()`.

Use `snapshot()` first when you need a full analysis frame:

- read `bands`, `customBands`, `fft`, and `waveform` together
- avoid multiple analyser reads in one render loop
- keep derived values synchronized

Use `getBands()` when you only want stable, simple control signals:

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
| `load(url)`             | Load a track, connect it to the analyser, and resolve when the media is ready. Rejects with `AudioBandsError` on load failure. |
| `play()`                | Start playback for the current track. Rejects with `AudioBandsError` on failure. |
| `pause()`               | Pause the current track. |
| `setLoop(loop)`         | Set whether the current and future loaded tracks should loop. |
| `seek(seconds)`         | Seek the current track to a given time in seconds. |
| `getDuration()`         | Returns the current track duration in seconds, or `null` when unavailable. |
| `getCurrentTime()`      | Returns the current playback time in seconds, or `null` when unavailable. |
| `togglePlayPause()`     | Toggle the current track. Returns a promise and propagates playback errors when toggling into play. |
| `enableMic()`           | Request microphone access and start mic analysis. Rejects with `AudioBandsError` on failure. |
| `disableMic()`          | Stop mic input and clean up the stream. |
| `snapshot(source?)`     | Returns `{ bands, customBands, fft, waveform }` using one frequency read and one time-domain read. The typed-array buffers are reused. |
| `getBands(source?)`     | Returns normalized analyser-region energy `{ bass, mid, high, overall }`. |
| `getCustomBands(source?)` | Returns normalized values for configured custom bands. |
| `getFftData(source?)`   | Returns raw `Uint8Array` frequency bins. |
| `getWaveform(source?)`  | Returns raw time-domain data for `'music'` or `'mic'`. |
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
  playbackError,
  micError,
  state,
  loadTrack,
  play,
  pause,
  setLoop,
  seek,
  getDuration,
  getCurrentTime,
  togglePlayPause,
  toggleMic,
  snapshot,
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
  onPlaybackError?: (error: AudioBandsError) => void;
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
  hasTrack: boolean; // loading finished, even if playback later fails
  loadError: AudioBandsError | null;
  playbackError: AudioBandsError | null;
  micError: AudioBandsError | null;
};
```

## Notes

- `AudioContext` is created lazily on the first call to `load()` or `enableMic()`.
- Call `play()`, `togglePlayPause()`, and `enableMic()` from a click or tap handler. Playback and mic activation resume a suspended context, but cannot bypass the browser's autoplay policy. If loading across an `await` loses user activation, use separate load and play controls as in the React example.
- Microphone access needs HTTPS or localhost and permission from the user. Concurrent `enableMic()` calls share a pending request. `disableMic()` and `destroy()` invalidate it and stop any stream received later. Late results cannot activate the mic or overwrite errors from a newer request. The library cannot dismiss the browser's permission dialog.
- Cross-origin track URLs must allow CORS for your origin. The media element uses `crossOrigin = 'anonymous'`; a URL that plays outside Web Audio is not necessarily available for analysis.
- `load()` prepares the current track but does not start playback. It resolves only after the media is ready enough for duration/seek reads to be meaningful, then you can call `play()` or `togglePlayPause()`.
- `togglePlayPause()` follows the same playback error contract as `play()`: if toggling into play fails, the returned promise rejects.
- `hasTrack` means the current track finished loading and is ready on the instance. It can still be `true` if `play()` fails later due to autoplay policy or another playback error.
- `isPlaying` follows the underlying media element events, so it falls back to `false` when the track pauses or reaches `ended`.
- `loadError` stores track loading failures only.
- `playbackError` stores playback failures for the current track, such as autoplay-policy rejections.
- In the React hook, changing `music`, `mic`, `bandRanges`, or `customBands` recreates the underlying `AudioBands` instance.
- The mic analyser is not connected to `AudioContext.destination`, so it will not feed back into the speakers.
- `snapshot()` is the preferred way to read analysis inside `requestAnimationFrame`.
- `getBands()`, `getCustomBands()`, `getFftData()`, and `getWaveform()` are convenience reads when you only need one view of the current frame.
- `getFftData()`, `getWaveform()`, and the `fft` / `waveform` fields of `snapshot()` reuse their underlying buffers. Later reads overwrite earlier data. Use `frame.fft?.slice()` and `frame.waveform?.slice()` to retain a frame; treat the shared buffers as read-only. `bands` and `customBands` are new objects on each snapshot.
- `fftSize` must be a power of two between `32` and `32768`.
- Band ranges are normalized from `0` to `1`, where `0` is the start of the analyser spectrum and `1` is the end.
- The default `bass` / `mid` / `high` labels are convenience names for analyser regions, not fixed Hz buckets.
- `overall` is intended as a simple UI summary, not as an acoustically weighted loudness value.

## Development

- CI uses Node.js 22 and npm 11.5.1. The release checker also supports npm 12's pack metadata format.
- `npm test` builds the package and runs the unit suite.
- `npx tsc --noEmit` checks the source types.
- `npx playwright install chromium` installs the browser needed for local tests.
- `npm run test:browser` checks the built bundles and native Web Audio playback/mic lifecycle in Chromium. Firefox and WebKit are not covered by this suite.
- `npm run test:release` packs the library and verifies the published tarball shape from a temporary consumer app.
- Pull requests, pushes to `main`, and `v*` tags run the release-check workflow. Use the manual `Publish to npm` GitHub Actions workflow against a verified release ref.

## License

MIT
