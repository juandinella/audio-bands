import { AudioBands } from '@juandinella/audio-bands';

const audio = new AudioBands({
  customBands: {
    presence: { from: 0.25, to: 0.5 },
  },
});

await audio.load('/audio/gymnopedie-1.ogg');
await audio.play();

function frame() {
  const snapshot = audio.snapshot();
  const { bass, mid, high, overall } = snapshot.bands;

  console.log({
    bass,
    mid,
    high,
    overall,
    presence: snapshot.customBands.presence,
    fftBins: snapshot.fft?.length ?? 0,
  });

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
