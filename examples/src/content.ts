export const origin = 'https://audio-bands.juandinella.com';
export const install = 'npm install @juandinella/audio-bands';
export const repo = 'https://github.com/juandinella/audio-bands';

export const examples = [
  { slug: 'pulse', title: 'One number. One pulse.', level: '01 / Start here', tech: 'CSS', description: 'Turn bass energy into the scale of a circle. One value is enough to make an interface listen.', learn: 'Read a single band and map its 0–1 range to a CSS transform.', code: `const { bass } = audio.getBands();\ncircle.style.transform = \`scale(\${0.6 + bass * 1.4})\`;` },
  { slug: 'bands', title: 'See the three bands.', level: '02 / Beginner', tech: 'DOM', description: 'Separate bass, mid and high into three live meters. See exactly what the library gives you.', learn: 'Read a coherent frame and use each band independently.', code: `const { bands } = audio.snapshot();\nfor (const name of ['bass', 'mid', 'high']) {\n  meters[name].style.transform = \`scaleY(\${bands[name]})\`;\n}` },
  { slug: 'spectrum', title: 'Draw the whole spectrum.', level: '03 / Intermediate', tech: 'Canvas 2D', description: 'Go beyond three values. Map raw frequency bins to a detailed, real-time spectrum.', learn: 'Normalize FFT bytes from 0–255 and draw them in a canvas animation loop.', code: `const { fft } = audio.snapshot();\nif (fft) {\n  ctx.clearRect(0, 0, width, height);\n  const step = width / fft.length;\n  fft.forEach((value, i) => {\n    const bar = (value / 255) * height;\n    ctx.fillRect(i * step, height - bar, step - 1, bar);\n  });\n}` },
  { slug: 'microphone', title: 'Give your voice a shape.', level: '04 / Intermediate', tech: 'Microphone + Canvas', description: 'Switch the source from a track to your microphone and draw the waveform of your voice.', learn: 'Request microphone access from a click, read time-domain data and stop the stream when finished.', code: `// Inside a button click handler:\nawait audio.enableMic();\n\n// Inside your animation loop:\nconst { waveform } = audio.snapshot('mic');\n\n// When the user turns the microphone off:\naudio.disableMic();` },
  { slug: 'three', title: 'Build a sound sculpture.', level: '05 / Advanced', tech: 'Three.js', description: 'Deform a particle sphere with bass, twist it with mids and scatter its surface with highs.', learn: 'Drive buffer geometry directly from audio data, without a React render per frame. Three.js is a separate renderer, not a dependency of audio-bands.', code: `const { bass, mid, high } = audio.getBands();\nfor (let i = 0; i < count; i++) {\n  const wave = Math.sin(i * 0.17 + time);\n  const radius = 1 + bass * 0.65 + wave * high * 0.3;\n  positions[i * 3] = base[i * 3] * radius;\n  positions[i * 3 + 1] = base[i * 3 + 1] * radius;\n  positions[i * 3 + 2] = base[i * 3 + 2] * radius;\n}\ngeometry.attributes.position.needsUpdate = true;\npoints.rotation.y += mid * delta;` },
] as const;
export type ExampleSlug = typeof examples[number]['slug'];

export const faqs = [
  ['What is audio-bands?', 'audio-bands is a headless JavaScript library for browser audio analysis. It turns music or microphone input into normalized bass, mid and high values, custom bands, FFT bins and waveform data. You choose how to render them.'],
  ['Does it require React?', 'No. The core works with vanilla JavaScript, Canvas, Three.js or any framework. An optional React hook manages the audio lifecycle for React applications.'],
  ['Does it draw a visualizer for me?', 'No. It provides audio data and playback controls, without a renderer. The examples on this site show how to connect that data to CSS, Canvas and Three.js.'],
  ['Are bass, mid and high fixed frequency ranges?', 'No. They are normalized regions of the analyser spectrum, not fixed bands in Hz. Their frequency boundaries depend on FFT resolution and sample rate. The values range from 0 to 1.'],
  ['Can I use music and a microphone together?', 'Yes. Music and microphone have separate analysers. Read snapshot(\'music\') and snapshot(\'mic\') independently. Microphone access requires permission and HTTPS or localhost.'],
] as const;

export const vanilla = `import { AudioBands } from '@juandinella/audio-bands';

// HTML: <button id="play" disabled>Play</button>
//       <pre id="output"></pre>
const button = document.querySelector('#play');
const output = document.querySelector('#output');
const audio = new AudioBands();
let disposed = false;
let raf = 0;

async function toggle() {
  try {
    await audio.togglePlayPause();
    button.textContent = audio.getState().isPlaying ? 'Pause' : 'Play';
  } catch (error) {
    output.textContent = error.message;
  }
}
button.addEventListener('click', toggle);

audio.load('/track.mp3').then(() => {
  if (!disposed) button.disabled = false;
}).catch(error => { output.textContent = error.message; });

function loop() {
  const { bands } = audio.snapshot();
  output.textContent = JSON.stringify(bands, null, 2);
  raf = requestAnimationFrame(loop);
}
raf = requestAnimationFrame(loop);

// Call when removing this UI.
export function cleanup() {
  disposed = true;
  cancelAnimationFrame(raf);
  button.removeEventListener('click', toggle);
  audio.destroy();
}`;

export const react = `import { useEffect, useRef, useState } from 'react';
import { useAudioBands } from '@juandinella/audio-bands/react';

export function Pulse() {
  const { loadTrack, togglePlayPause, getBands, hasTrack, isPlaying } = useAudioBands();
  const circle = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    loadTrack('/track.mp3').catch(error => {
      if (active) setError(error.message);
    });
    return () => { active = false; };
  }, [loadTrack]);

  useEffect(() => {
    if (!isPlaying) return;
    let raf;
    function draw() {
      const { bass } = getBands();
      circle.current.style.transform = \`scale(\${0.6 + bass * 1.4})\`;
      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, getBands]);

  async function toggle() {
    setError('');
    try { await togglePlayPause(); }
    catch (error) { setError(error.message); }
  }

  return <>
    <button disabled={!hasTrack} onClick={toggle}>
      {isPlaying ? 'Pause' : 'Play'}
    </button>
    <div ref={circle} style={{ width: 80, height: 80,
      borderRadius: '50%', background: '#c8f080' }} />
    {error && <p role="alert">{error}</p>}
  </>;
}`;

export const pages = [
  { path: '/', title: 'audio-bands — Audio in. Numbers out.', description: 'Turn music and microphone input into bass, mid and high values. A headless JavaScript audio analysis library with an optional React hook. Try live examples.' },
  { path: '/docs/', title: 'Documentation — audio-bands', description: 'Install audio-bands, play a track, read audio bands and connect a microphone. JavaScript and React quick starts, API reference and troubleshooting.' },
  { path: '/examples/', title: 'Audio visualization examples — audio-bands', description: 'Learn audio-reactive development step by step: a CSS pulse, live band meters, a Canvas spectrum, microphone waveform and a Three.js particle sculpture.' },
  ...examples.map(example => ({ path: `/examples/${example.slug}/`, title: `${example.title} — audio-bands`, description: example.description })),
];
