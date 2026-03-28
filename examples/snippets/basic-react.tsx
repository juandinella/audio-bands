import { useEffect, useState } from 'react';
import { useAudioBands } from '@juandinella/audio-bands/react';

export function BasicReactExample() {
  const { loadTrack, play, snapshot, isPlaying, playbackError } = useAudioBands({
    customBands: {
      presence: { from: 0.25, to: 0.5 },
    },
  });
  const [frame, setFrame] = useState(() => snapshot());

  useEffect(() => {
    let raf = 0;

    const loop = () => {
      setFrame(snapshot());
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [snapshot]);

  async function handleLoad() {
    await loadTrack('/audio/gymnopedie-1.ogg');
    await play();
  }

  return (
    <div>
      <button onClick={handleLoad}>{isPlaying ? 'Reload' : 'Load + Play'}</button>
      {playbackError ? <p>{playbackError.message}</p> : null}
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
