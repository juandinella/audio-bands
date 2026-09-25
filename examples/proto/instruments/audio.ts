import { useEffect, useRef, useState } from 'react';
import { AudioBands } from '@juandinella/audio-bands';

export type Band = 'bass' | 'mid' | 'high';
export type Routing = Record<'size' | 'fold' | 'spin', Band>;
export const initialRouting: Routing = { size: 'bass', fold: 'mid', spin: 'high' };

// A quiet, repeating test phrase. This source belongs to the demo, not the library.
export function oscillatorFile() {
  const rate = 24000, duration = 4, samples = rate * duration;
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  function word(offset: number, text: string) {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  }
  word(0, 'RIFF'); view.setUint32(4, 36 + samples * 2, true);
  word(8, 'WAVE'); word(12, 'fmt '); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  word(36, 'data'); view.setUint32(40, samples * 2, true);
  const notes = [110, 130.81, 164.81, 146.83, 110, 220, 164.81, 130.81];
  for (let i = 0; i < samples; i++) {
    const t = i / rate, step = Math.floor(t * 2), local = t % 0.5;
    const frequency = notes[step];
    const envelope = Math.min(1, local * 100) * Math.exp(-local * 7);
    const tone = Math.sin(2 * Math.PI * frequency * t) * 0.28
      + Math.sin(2 * Math.PI * frequency * 8 * t) * 0.05
      + Math.sin(2 * Math.PI * 4400 * t) * 0.018 * Math.exp(-local * 30);
    view.setInt16(44 + i * 2, tone * envelope * 32767, true);
  }
  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
}

export function useInstrument() {
  const instance = useRef<AudioBands | null>(null);
  const [source, setSource] = useState('sequence');
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [gain, setGain] = useState(1.5);
  const [trail, setTrail] = useState(0.65);
  const [shape, setShape] = useState('orbit');
  const [routing, setRouting] = useState<Routing>(initialRouting);
  const [frozen, setFrozen] = useState(false);

  useEffect(() => {
    const audio = new AudioBands({ music: { fftSize: 512 }, onStateChange: state => setPlaying(state.isPlaying) });
    instance.current = audio;
    audio.setLoop(true);
    return () => { instance.current = null; audio.destroy(); };
  }, []);

  useEffect(() => {
    const audio = instance.current!;
    let current = true;
    const url = source === 'sequence' ? oscillatorFile() : '/audio/maple-leaf-rag.ogg';
    audio.pause();
    setReady(false);
    setError('');
    audio.load(url).then(() => { if (current) setReady(true); }).catch(() => {
      if (current) setError('Could not load the source. Switch sources to try again.');
    });
    return () => { current = false; if (source === 'sequence') URL.revokeObjectURL(url); };
  }, [source]);

  async function toggle() {
    setError('');
    try { await instance.current?.togglePlayPause(); }
    catch { setError('Playback was blocked. Press Play to try again.'); }
  }
  return { instance, source, setSource, playing, ready, error, toggle, gain, setGain, trail, setTrail, shape, setShape, routing, setRouting, frozen, setFrozen };
}
export type Instrument = ReturnType<typeof useInstrument>;
