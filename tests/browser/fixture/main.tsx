import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AudioBands } from '../../../dist/index.js';
import { useAudioBands } from '../../../dist/react-entry.js';

type SmokeResult = {
  hasTrack: boolean;
  isPlayingAfterPlay: boolean;
  isPlayingAfterPause: boolean;
  fftLength: number;
  waveformLength: number;
};

class MockAnalyser {
  fftSize = 256;
  frequencyBinCount = 128;
  smoothingTimeConstant = 0.8;

  connect(): void {}

  getByteFrequencyData(target: Uint8Array): void {
    target.fill(64);
  }

  getByteTimeDomainData(target: Uint8Array): void {
    target.fill(127);
  }
}

class MockSourceNode {
  connect(): void {}
  disconnect(): void {}
}

class MockAudioContext {
  destination = {};

  async close(): Promise<void> {}

  createAnalyser(): AnalyserNode {
    return new MockAnalyser() as unknown as AnalyserNode;
  }

  createMediaElementSource(): MediaElementAudioSourceNode {
    return new MockSourceNode() as unknown as MediaElementAudioSourceNode;
  }
}

class MockAudioElement extends EventTarget {
  src = '';
  crossOrigin: string | null = null;
  preload = '';
  loop = false;
  duration = 180;
  currentTime = 0;
  paused = true;
  error: unknown = null;

  async play(): Promise<void> {
    this.paused = false;
    this.dispatchEvent(new Event('play'));
  }

  pause(): void {
    this.paused = true;
    this.dispatchEvent(new Event('pause'));
  }

  load(): void {
    queueMicrotask(() => {
      if (!this.src) return;
      this.dispatchEvent(new Event('loadedmetadata'));
      this.dispatchEvent(new Event('canplay'));
    });
  }
}

Object.defineProperty(window, 'AudioContext', {
  configurable: true,
  value: MockAudioContext,
});
Object.defineProperty(window, 'Audio', {
  configurable: true,
  value: MockAudioElement,
});

async function runCoreSmoke(): Promise<SmokeResult> {
  const audio = new AudioBands();
  await audio.load('/track.ogg');
  await audio.play();
  const isPlayingAfterPlay = audio.getState().isPlaying;
  const frame = audio.snapshot();
  audio.pause();

  return {
    hasTrack: audio.getState().hasTrack,
    isPlayingAfterPlay,
    isPlayingAfterPause: audio.getState().isPlaying,
    fftLength: frame.fft?.length ?? 0,
    waveformLength: frame.waveform?.length ?? 0,
  };
}

function HookSmoke() {
  const { loadTrack, play, pause, snapshot, state } = useAudioBands();
  const [phase, setPhase] = useState<'idle' | 'loaded' | 'played' | 'paused'>('idle');
  const [result, setResult] = useState<SmokeResult | null>(null);
  const [frameLengths, setFrameLengths] = useState({ fftLength: 0, waveformLength: 0 });
  const [isPlayingAfterPlay, setIsPlayingAfterPlay] = useState(false);

  useEffect(() => {
    if (phase !== 'idle') return;
    void loadTrack('/track.ogg').then(() => {
      setPhase('loaded');
    });
  }, [loadTrack, phase]);

  useEffect(() => {
    if (phase !== 'loaded' || !state.hasTrack) return;
    void play().then(() => {
      setPhase('played');
    });
  }, [phase, play, state.hasTrack]);

  useEffect(() => {
    if (phase !== 'played' || !state.isPlaying) return;
    const frame = snapshot();
    setIsPlayingAfterPlay(true);
    setFrameLengths({
      fftLength: frame.fft?.length ?? 0,
      waveformLength: frame.waveform?.length ?? 0,
    });
    pause();
    setPhase('paused');
  }, [pause, phase, snapshot, state.isPlaying]);

  useEffect(() => {
    if (phase !== 'paused' || state.isPlaying || result) return;
    setResult({
      hasTrack: state.hasTrack,
      isPlayingAfterPlay,
      isPlayingAfterPause: state.isPlaying,
      fftLength: frameLengths.fftLength,
      waveformLength: frameLengths.waveformLength,
    });
  }, [
    frameLengths.fftLength,
    frameLengths.waveformLength,
    isPlayingAfterPlay,
    phase,
    result,
    state.hasTrack,
    state.isPlaying,
  ]);

  return (
    <pre data-testid="hook-result" data-ready={result ? 'true' : 'false'}>
      {JSON.stringify(result ?? {})}
    </pre>
  );
}

function App() {
  const [coreResult, setCoreResult] = useState<SmokeResult | null>(null);

  useEffect(() => {
    void runCoreSmoke().then(setCoreResult);
  }, []);

  return (
    <main>
      <pre data-testid="core-result" data-ready={coreResult ? 'true' : 'false'}>
        {JSON.stringify(coreResult ?? {})}
      </pre>
      <HookSmoke />
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
