import { AudioBands } from '@juandinella/audio-bands';

export function mountAudioExample(playButton: HTMLButtonElement, output: HTMLElement) {
  const audio = new AudioBands({
    customBands: { presence: { from: 0.25, to: 0.5 } },
  });
  let raf = 0;
  let disposed = false;
  playButton.disabled = true;

  function frame() {
    const snapshot = audio.snapshot();
    output.textContent = JSON.stringify({
      ...snapshot.bands,
      ...snapshot.customBands,
      fftBins: snapshot.fft?.length ?? 0,
    });
    raf = requestAnimationFrame(frame);
  }

  async function play() {
    try {
      await audio.play();
      if (disposed) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    } catch (error) {
      if (!disposed) output.textContent = error instanceof Error ? error.message : String(error);
    }
  }

  playButton.addEventListener('click', play);
  void audio.load('/audio/gymnopedie-1.ogg').then(() => {
    if (!disposed) playButton.disabled = false;
  }).catch((error: Error) => {
    if (!disposed) output.textContent = error.message;
  });

  return () => {
    disposed = true;
    cancelAnimationFrame(raf);
    playButton.removeEventListener('click', play);
    audio.destroy();
  };
}
