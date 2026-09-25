import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AudioBands } from '../../../dist/index.js';
import { useAudioBands } from '../../../dist/react-entry.js';
import type { UseAudioBandsReturn } from '../../../dist/react-entry.js';

declare global {
  interface Window {
    audioTest: {
      core: AudioBands;
      contexts: AudioContext[];
      streams: MediaStream[];
      hook: UseAudioBandsReturn | null;
      loaded: boolean;
    };
  }
}

const contexts: AudioContext[] = [];
const streams: MediaStream[] = [];
const NativeAudioContext = window.AudioContext;
window.AudioContext = class extends NativeAudioContext {
  constructor(options?: AudioContextOptions) {
    super(options);
    contexts.push(this);
  }
};
const getUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
navigator.mediaDevices.getUserMedia = async (constraints) => {
  const stream = await getUserMedia(constraints);
  streams.push(stream);
  return stream;
};

function toneUrl() {
  const sampleRate = 48000;
  const samples = sampleRate * 2;
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  const writeText = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  writeText(0, 'RIFF');
  view.setUint32(4, 36 + samples * 2, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, 'data');
  view.setUint32(40, samples * 2, true);
  for (let i = 0; i < samples; i++) {
    view.setInt16(44 + i * 2, Math.sin(2 * Math.PI * 440 * i / sampleRate) * 16000, true);
  }
  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
}

const core = new AudioBands();
core.setLoop(true);
window.audioTest = { core, contexts, streams, hook: null, loaded: false };
const url = toneUrl();
const loading = core.load(url).then(() => { window.audioTest.loaded = true; });
window.addEventListener('pagehide', () => {
  core.destroy();
  URL.revokeObjectURL(url);
});

function Mic({ fftSize }: { fftSize: number }) {
  const hook = useAudioBands({ mic: { fftSize } });
  const [error, setError] = useState('');
  useEffect(() => { window.audioTest.hook = hook; });
  return (
    <>
      <button onClick={() => { void hook.toggleMic().catch((error: Error) => setError(error.message)); }}>
        Toggle microphone
      </button>
      <output data-testid="mic-active">{String(hook.micActive)}</output>
      <output data-testid="mic-error">{error}</output>
    </>
  );
}

function App() {
  const [fftSize, setFftSize] = useState(256);
  const [mounted, setMounted] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => { void loading.catch((error: Error) => setError(error.message)); }, []);
  return (
    <>
      <button onClick={() => { void core.play().catch((error: Error) => setError(error.message)); }}>Play track</button>
      <button onClick={() => core.pause()}>Pause track</button>
      <button onClick={() => core.destroy()}>Destroy core</button>
      <button onClick={() => setFftSize(512)}>Reconfigure microphone</button>
      <button onClick={() => setMounted(false)}>Unmount microphone</button>
      <output data-testid="core-error">{error}</output>
      {mounted && <Mic fftSize={fftSize} />}
    </>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
