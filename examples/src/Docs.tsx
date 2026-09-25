import { useState } from 'react';
import Code from './Code';
import { install, react, vanilla, repo } from './content';

const sections = [['start', 'Quick start'], ['react', 'React'], ['frames', 'Reading audio'], ['microphone', 'Microphone'], ['api', 'API reference'], ['options', 'Configuration'], ['troubleshooting', 'Troubleshooting']];
const methods = [
  ['load(url)', 'Load a CORS-enabled track. Resolves when ready; does not play.'],
  ['play() / pause()', 'Start or pause the current track. play() returns a promise.'],
  ['togglePlayPause()', 'Toggle playback. Catch the returned promise.'],
  ['snapshot(source?)', 'Read { bands, customBands, fft, waveform } as one coherent frame.'],
  ['getBands(source?)', 'Read bass, mid, high and overall, each from 0 to 1.'],
  ['getCustomBands(source?)', 'Read your configured, named spectrum regions.'],
  ['getFftData(source?)', 'Read frequency bins as Uint8Array, or null before setup.'],
  ['getWaveform(source?)', 'Read time-domain bytes as Uint8Array, or null before setup.'],
  ['enableMic() / disableMic()', 'Request microphone access / stop all microphone tracks.'],
  ['setLoop(boolean)', 'Set whether the current and future tracks loop.'],
  ['seek(seconds)', 'Move the playback position.'],
  ['getDuration() / getCurrentTime()', 'Read seconds, or null when unavailable.'],
  ['getState()', 'Read isPlaying, hasTrack, micActive and separate load, playback and mic errors.'],
  ['destroy()', 'Release the audio context, track and microphone stream.'],
];

export default function Docs() {
  const [language, setLanguage] = useState<'vanilla' | 'react'>('vanilla');
  return <>
    <div className="page-intro"><p className="eyebrow">Documentation</p><h1>From sound to<br />your first value.</h1><p>Load a track. Read its energy. Make something respond.</p><a href="/docs.md">Read as Markdown ↗</a></div>
    <div className="docs-layout">
      <nav className="docs-nav" aria-label="Documentation sections">{sections.map(([id, name]) => <a key={id} href={`#${id}`}>{name}</a>)}<a href={`${repo}#readme`}>Full package reference ↗</a></nav>
      <article className="prose">
        <section id="start"><h2>Quick start</h2><p>audio-bands is a browser audio analysis library. It exposes numbers you can use in any renderer. React is optional; Web Audio runs in the browser.</p><Code label="Terminal">{install}</Code><p>Create a button and an output element, and put an audio file at <code>/track.mp3</code>. This complete example loads the file first, then starts playback from a click.</p>
          <div className="segmented" aria-label="Quick start language">{(['vanilla', 'react'] as const).map(value => <button key={value} aria-pressed={language === value} onClick={() => setLanguage(value)}>{value === 'vanilla' ? 'Vanilla JavaScript' : 'React'}</button>)}</div>
          <Code label={language === 'vanilla' ? 'main.js' : 'Pulse.jsx'}>{language === 'vanilla' ? vanilla : react}</Code>
          <p>The animation loop reads current values. In a canvas or 3D scene, update the renderer directly rather than putting every frame in React state. Cancel the loop when the view is removed.</p>
        </section>
        <section id="react"><h2>Using React</h2><p>Import <code>useAudioBands</code> from <code>@juandinella/audio-bands/react</code>. It owns the audio instance and releases it on unmount. The root and <code>/core</code> exports do not require React.</p><p>The hook exposes <code>loadTrack</code> instead of <code>load</code>, and <code>toggleMic</code> instead of separate microphone methods. It returns <code>isPlaying</code>, <code>hasTrack</code>, <code>micActive</code>, <code>loadError</code>, <code>playbackError</code> and <code>micError</code>. Your effect still owns its animation loop.</p><p>Changing analyser settings or band ranges recreates the audio instance. Keep those settings stable during playback.</p></section>
        <section id="frames"><h2>What do the values mean?</h2><p><code>bass</code>, <code>mid</code> and <code>high</code> are normalized analyser regions, each from 0 to 1. They are control signals for visuals, not calibrated measurements of loudness.</p><ul><li>Default regions cover 0–8%, 8–40% and 40–100% of the FFT bins.</li><li>They are not fixed frequency ranges in Hz. Boundaries depend on FFT resolution and the audio context sample rate.</li><li><code>overall = bass × 0.5 + mid × 0.3 + high × 0.2</code>.</li></ul><Code>{`const frame = audio.snapshot('music');
const { bass, mid, high, overall } = frame.bands;
const fft = frame.fft;           // frequency bytes, 0–255
const waveform = frame.waveform; // time-domain bytes, 0–255`}</Code><p>Use <code>getBands()</code> for a simple control signal. Use <code>snapshot()</code> when you need several views of the same frame: it performs one frequency read and one time-domain read.</p><aside className="note">FFT and waveform buffers are reused. Copy with <code>frame.fft?.slice()</code> if you need to keep a frame. Before the source is initialized, these buffers are <code>null</code>.</aside></section>
        <section id="microphone"><h2>Microphone input</h2><p>Call <code>enableMic()</code> from a click handler. The browser asks for permission; HTTPS or localhost is required. The microphone is not connected to the speakers.</p><Code>{`async function startMicrophone() {
  try {
    await audio.enableMic();
  } catch (error) {
    // Show the error beside your microphone button.
    output.textContent = error.message;
  }
}

// In your animation loop:
const frame = audio.snapshot('mic');

// When the user stops:
audio.disableMic();`}</Code><p>Music and microphone have separate analysers and can run simultaneously. Read each source explicitly with <code>snapshot('music')</code> and <code>snapshot('mic')</code>.</p><a href="/examples/microphone/">Try the microphone example →</a></section>
        <section id="api"><h2>Core API reference</h2><p>Create an instance with <code>new AudioBands(options?)</code>. Analysis methods accept <code>'music'</code> (default) or <code>'mic'</code>.</p><div className="table-scroll"><table><thead><tr><th>Method</th><th>What it does</th></tr></thead><tbody>{methods.map(([method, description]) => <tr key={method}><td><code>{method}</code></td><td>{description}</td></tr>)}</tbody></table></div><p>Async load, playback and microphone methods reject with an <code>AudioBandsError</code>. Catch promises even when using error callbacks. Error fields distinguish loading failures, playback policy failures and microphone failures.</p></section>
        <section id="options"><h2>Configuration</h2><Code>{`const audio = new AudioBands({
  music: { fftSize: 512, smoothingTimeConstant: 0.7 },
  mic: { fftSize: 256, smoothingTimeConstant: 0.8 },
  customBands: {
    presence: { from: 0.25, to: 0.5 },
    air: { from: 0.5, to: 1 },
  },
  onLoadError: error => console.error(error),
  onMicError: error => console.error(error),
});`}</Code><p><code>fftSize</code> is a power of two from 32 to 32768 (default 256). Frequency data contains <code>fftSize / 2</code> bins. Smoothing ranges from 0 to 1; higher values soften changes.</p><p><code>bandRanges</code> overrides bass/mid/high regions. <code>customBands</code> defines additional named regions. Both use normalized <code>from</code>/<code>to</code> positions between 0 and 1, not Hz.</p><p>Callbacks include <code>onError</code>, <code>onLoadError</code>, <code>onPlaybackError</code>, <code>onMicError</code>, <code>onStateChange</code>, <code>onPlay</code>, <code>onPause</code>, <code>onMicStart</code> and <code>onMicStop</code>.</p></section>
        <section id="troubleshooting"><h2>Troubleshooting</h2><h3>Why does playback fail?</h3><p>Browsers require a user gesture. Load the track first, then call <code>play()</code> directly from a click or tap. Awaiting a network load before playing can lose user activation.</p><h3>Why is my remote track silent?</h3><p>The audio server must allow cross-origin access with CORS headers. A URL that plays in a browser tab may still be unavailable for Web Audio analysis. Test with a same-origin file first.</p><h3>Why is the microphone unavailable?</h3><p>Use HTTPS or localhost, grant permission and check that another application has not locked the device. Show microphone errors separately from track errors.</p><h3>Why are my saved FFT frames changing?</h3><p>The typed-array buffers are reused for each read. Make a copy with <code>.slice()</code> before storing a historical frame.</p><h3>Can this run on the server?</h3><p>Audio analysis requires browser Web Audio APIs. Render your page on the server, but load tracks and start audio from browser effects or event handlers.</p></section>
      </article>
    </div>
  </>;
}
