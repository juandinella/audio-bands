import { AudioBands } from '@juandinella/audio-bands';

const audio = new AudioBands();

await audio.enableMic();

function frame() {
  const snapshot = audio.snapshot('mic');

  console.log({
    ...snapshot.bands,
    waveformSize: snapshot.waveform?.length ?? 0,
  });

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
