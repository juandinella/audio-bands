import { useEffect, useState } from 'react';
import { useAudioBands } from '@juandinella/audio-bands/react';

export function BasicReactExample() {
  const { loadTrack, togglePlayPause, snapshot, isPlaying, hasTrack } = useAudioBands({
    customBands: {
      presence: { from: 0.25, to: 0.5 },
    },
  });
  const [frame, setFrame] = useState(() => snapshot());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isPlaying) return;
    let raf = 0;

    const loop = () => {
      setFrame(snapshot());
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, snapshot]);

  async function handleLoad() {
    setIsLoading(true);
    setError('');
    try {
      await loadTrack('/audio/gymnopedie-1.ogg');
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
    <div>
      <button onClick={handleLoad} disabled={isLoading}>
        {isLoading ? 'Loading…' : 'Load track'}
      </button>
      <button onClick={handlePlay} disabled={isLoading || !hasTrack}>
        {isPlaying ? 'Pause' : 'Play'}
      </button>
      {error && <p role="alert">{error}</p>}
      <pre>
        {JSON.stringify(
          {
            ...frame.bands,
            ...frame.customBands,
            fftBins: frame.fft?.length ?? 0,
          },
          null,
          2,
        )}
      </pre>
    </div>
  );
}
