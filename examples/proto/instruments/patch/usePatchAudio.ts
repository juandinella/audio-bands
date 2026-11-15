import { useEffect, useRef, useState } from 'react';
import { AudioBands } from '@juandinella/audio-bands';
import type { AudioBandsSnapshot } from '../../../../src/types';
import { oscillatorFile } from '../audio';

export type Source = 'sequence' | 'music' | 'mic';
export const silence: AudioBandsSnapshot = {
  bands: { bass: 0, mid: 0, high: 0, overall: 0 }, customBands: {},
  fft: new Uint8Array(256), waveform: new Uint8Array(512).fill(128),
};

export function usePatchAudio() {
  const audio = useRef<AudioBands | null>(null);
  const frame = useRef(silence);
  const [source, setSource] = useState<Source>('sequence');
  const [active, setActive] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const pending = useRef(false);

  useEffect(() => {
    let mounted = true;
    const instance = new AudioBands({ music: { fftSize: 512 }, mic: { fftSize: 512 }, onStateChange: state => {
      if (mounted) setActive(state.isPlaying || state.micActive);
    } });
    instance.setLoop(true);
    audio.current = instance;
    return () => { mounted = false; generation.current++; audio.current = null; instance.destroy(); };
  }, []);

  useEffect(() => {
    const instance = audio.current!;
    const token = ++generation.current;
    instance.pause();
    instance.disableMic();
    pending.current = false;
    setBusy(false);
    setError('');
    setReady(source === 'mic');
    frame.current = silence;
    if (source === 'mic') return;
    const url = source === 'sequence' ? oscillatorFile() : '/audio/maple-leaf-rag.ogg';
    instance.load(url).then(() => {
      if (generation.current === token) setReady(true);
    }).catch(() => {
      if (generation.current === token) setError('Source unavailable. Choose another input to try again.');
    });
    return () => {
      generation.current++;
      if (source === 'sequence') URL.revokeObjectURL(url);
    };
  }, [source]);

  function stop() { audio.current?.pause(); audio.current?.disableMic(); frame.current = silence; }
  async function toggle() {
    if (!audio.current || pending.current) return;
    const token = generation.current;
    setError('');
    if (source === 'mic' && active) { stop(); return; }
    pending.current = true;
    setBusy(true);
    try {
      if (source === 'mic') await audio.current.enableMic();
      else await audio.current.togglePlayPause();
    } catch {
      if (generation.current === token) setError(source === 'mic'
        ? 'Microphone unavailable. Allow access in browser settings, or choose the test sequence.'
        : 'Playback was blocked. Press Play again to retry.');
    } finally {
      if (generation.current === token) { pending.current = false; setBusy(false); }
    }
  }
  return { audio, frame, source, setSource, active, ready, busy, error, toggle, stop };
}
export type PatchAudio = ReturnType<typeof usePatchAudio>;
