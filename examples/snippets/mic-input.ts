import { AudioBands } from '@juandinella/audio-bands';

export function mountMicExample(startButton: HTMLButtonElement, output: HTMLElement) {
  const audio = new AudioBands();
  let raf = 0;
  let disposed = false;

  function frame() {
    const snapshot = audio.snapshot('mic');
    output.textContent = JSON.stringify({
      ...snapshot.bands,
      waveformSize: snapshot.waveform?.length ?? 0,
    });
    raf = requestAnimationFrame(frame);
  }

  async function start() {
    startButton.disabled = true;
    try {
      await audio.enableMic();
      if (disposed || !audio.getState().micActive) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    } catch (error) {
      if (!disposed) output.textContent = error instanceof Error ? error.message : String(error);
    } finally {
      if (!disposed) startButton.disabled = false;
    }
  }

  startButton.addEventListener('click', start);
  return () => {
    disposed = true;
    cancelAnimationFrame(raf);
    startButton.removeEventListener('click', start);
    audio.destroy();
  };
}
