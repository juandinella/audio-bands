# audio-bands

Headless audio frequency analysis for the browser. Get real-time `bass`, `mid`, and `high` values normalized to `0–1` — from a music track, a microphone, or both simultaneously. No renderer included: you decide what to do with the numbers.

```ts
const { bass, mid, high } = audio.getBands();
// bass: 0.73, mid: 0.41, high: 0.12
```

## Why

Every audio visualization library either handles only playback (no analysis) or draws its own canvas and hides the data. This library only gives you numbers — what you render is up to you.

## Install

```bash
npm install audio-bands
```

React is an optional peer dependency. The core class works in any framework or plain HTML.

## Usage

### Vanilla JS

Works in Vue, Svelte, plain HTML — anything.

```js
import { AudioBands } from 'audio-bands';

const audio = new AudioBands({
  onPlay: () => console.log('playing'),
  onPause: () => console.log('paused'),
  onError: () => console.error('failed to load'),
  onMicStart: () => console.log('mic on'),
  onMicStop: () => console.log('mic off'),
});

await audio.load('/track.mp3');

// Call inside your animation loop
function loop() {
  const { bass, mid, high, overall } = audio.getBands();
  // drive your canvas, SVG, CSS, WebGL — whatever
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Clean up when done
audio.destroy();
```

### React hook

```tsx
import { useAudioBands } from 'audio-bands';
import { useEffect, useRef } from 'react';

function Visualizer() {
  const { loadTrack, togglePlayPause, toggleMic, getBands, isPlaying } = useAudioBands();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    loadTrack('/track.mp3');
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    let raf: number;

    function loop() {
      const { bass, mid, high } = getBands();

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2, 20 + bass * 80, 0, Math.PI * 2);
      ctx.fill();

      raf = requestAnimationFrame(loop);
    }

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [getBands]);

  return (
    <>
      <canvas ref={canvasRef} width={400} height={400} />
      <button onClick={togglePlayPause}>{isPlaying ? 'Pause' : 'Play'}</button>
      <button onClick={toggleMic}>Toggle mic</button>
    </>
  );
}
```

### Mic input

```ts
// Enable mic — browser will ask for permission
await audio.enableMic();

// Get frequency bands from the mic
const { bass } = audio.getBands('mic');

// Get raw waveform data (time-domain)
const waveform = audio.getWaveform(); // Uint8Array | null

// Disable mic and stop the stream
audio.disableMic();
```

## API

### `AudioBands` (vanilla JS)

```ts
new AudioBands(callbacks?: AudioBandsCallbacks)
```

| Method | Description |
|---|---|
| `load(url)` | Load and play an audio file. Resolves when playback starts. |
| `togglePlayPause()` | Toggle playback. |
| `enableMic()` | Request mic access and start analysis. |
| `disableMic()` | Stop mic stream and clean up. |
| `getBands(source?)` | Returns `Bands` for `'music'` (default) or `'mic'`. Call inside RAF. |
| `getWaveform()` | Returns raw time-domain `Uint8Array` from mic. Call inside RAF. |
| `destroy()` | Stop playback, release mic, close AudioContext. |

### `useAudioBands()` (React)

Same capabilities as `AudioBands`. `destroy()` is called automatically on unmount.

```ts
const {
  isPlaying,
  micActive,
  audioError,
  loadTrack,
  togglePlayPause,
  toggleMic,
  getBands,
  getWaveform,
} = useAudioBands();
```

### `Bands`

```ts
type Bands = {
  bass: number;    // 0–1 — low frequencies (0–8% of spectrum)
  mid: number;     // 0–1 — mid frequencies (8–40%)
  high: number;    // 0–1 — high frequencies (40–100%)
  overall: number; // 0–1 — weighted mix: bass×0.5 + mid×0.3 + high×0.2
};
```

### `AudioBandsCallbacks`

```ts
type AudioBandsCallbacks = {
  onPlay?: () => void;
  onPause?: () => void;
  onError?: () => void;
  onMicStart?: () => void;
  onMicStop?: () => void;
};
```

## Notes

- `AudioContext` is created lazily on the first call to `load()` or `enableMic()` — this respects browser autoplay policy, which requires a user gesture before audio can start.
- The mic analyser is **not** connected to `AudioContext.destination`, so there is no feedback loop.
- `getBands()` and `getWaveform()` read live data from the audio graph — call them inside `requestAnimationFrame`, not in response to React state.

## License

MIT
