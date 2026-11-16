import { Fragment, useEffect, useRef, useState } from 'react';
import {
  framesCode,
  install,
  liveCode,
  methods,
  micCode,
  options,
  optionsCode,
  questions,
  reactExample,
  sections,
  vanillaExample,
} from './content';

// A small JS/JSX highlighter: comments, strings, keywords, numbers and
// punctuation. Enough for these examples; production would use Shiki at build.
const KEYWORDS = new Set(
  'import from export const let var function async await return if else try catch finally new typeof of in for while break continue true false null undefined this class extends default'.split(' '),
);
const TOKEN = /(\/\/[^\n]*)|('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|([{}()[\];,.:?=<>+\-*/!&|]+)/g;

function highlight(code: string) {
  const out: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of code.matchAll(TOKEN)) {
    if (m.index! > last) out.push(code.slice(last, m.index));
    const [text, comment, string, number, word, punct] = m;
    const kind = comment ? 'c' : string ? 's' : number ? 'n' : word ? (KEYWORDS.has(word) ? 'k' : null) : punct ? 'p' : null;
    out.push(kind ? (
      <span key={i++} className={`t-${kind}`}>
        {text}
      </span>
    ) : (
      text
    ));
    last = m.index! + text.length;
  }
  if (last < code.length) out.push(code.slice(last));
  return out;
}

// A code block with a plain copy button. If the clipboard is blocked, the
// code is selected so a manual copy is one keystroke.
export function Code({ label, children }: { label: string; children: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const pre = useRef<HTMLPreElement>(null);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  const settle = (next: 'copied' | 'failed') => {
    setState(next);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState('idle'), 1500);
  };
  return (
    <figure className="d-code">
      <figcaption>
        <span>{label}</span>
        <button
          type="button"
          className="d-copy"
          aria-label={`Copy ${label}`}
          onClick={() =>
            navigator.clipboard
              .writeText(children)
              .then(() => settle('copied'))
              .catch(() => {
                if (pre.current) getSelection()?.selectAllChildren(pre.current);
                settle('failed');
              })
          }
        >
          <span aria-live="polite">{state === 'copied' ? 'Copied' : state === 'failed' ? 'Selected' : 'Copy'}</span>
        </button>
      </figcaption>
      <pre ref={pre}>
        <code>{highlight(children)}</code>
      </pre>
    </figure>
  );
}

function Heading({ id }: { id: string }) {
  const s = sections.find((x) => x.id === id)!;
  return (
    <h2>
      <span className="d-num">{s.n}</span>
      {s.title}
    </h2>
  );
}

const groups = [...new Set(methods.map((m) => m.group))];
const examples = { 'Vanilla JS': { file: 'main.js', code: vanillaExample }, React: { file: 'Pulse.jsx', code: reactExample } };
type Example = keyof typeof examples;

export function Prose() {
  const [example, setExample] = useState<Example>('Vanilla JS');
  return (
    <>
      <section id="start">
        <Heading id="start" />
        <p>
          audio-bands is a browser audio analysis library. It turns a track or a microphone into numbers you can use in
          any renderer. React is optional; Web Audio runs in the browser.
        </p>
        <Code label="Terminal">{install}</Code>
        <p>
          Put an audio file at <code>/track.mp3</code>, add a button and an output element. This complete example loads
          the file first, then starts playback from a click.
        </p>
        <div className="d-tabs" role="group" aria-label="Example language">
          {(Object.keys(examples) as Example[]).map((name) => (
            <button key={name} type="button" aria-pressed={example === name} onClick={() => setExample(name)}>
              {name}
            </button>
          ))}
        </div>
        <Code label={examples[example].file}>{examples[example].code}</Code>
        <p>
          The animation loop reads current values. In a canvas or 3D scene, update the renderer directly rather than
          putting every frame in React state, and cancel the loop when the view is removed.
        </p>
      </section>

      <section id="react">
        <Heading id="react" />
        <p>
          Import <code>useAudioBands</code> from <code>@juandinella/audio-bands/react</code>. It owns the audio instance
          and releases it on unmount. The root and <code>/core</code> exports do not require React.
        </p>
        <p>
          The hook exposes <code>loadTrack</code> instead of <code>load</code>, and <code>toggleMic</code> instead of
          separate microphone methods. It returns <code>isPlaying</code>, <code>hasTrack</code>, <code>micActive</code>{' '}
          and separate <code>loadError</code>, <code>playbackError</code> and <code>micError</code>. Your effect still owns
          its animation loop.
        </p>
        <p>
          Changing the <code>music</code>, <code>mic</code>, <code>bandRanges</code> or <code>customBands</code> options
          recreates the instance and stops playback. To adjust analysis while audio plays, keep options stable and use the{' '}
          <a href="#live">live settings</a>.
        </p>
      </section>

      <section id="reading">
        <Heading id="reading" />
        <p>
          <code>bass</code>, <code>mid</code> and <code>high</code> are normalized regions of the analyser spectrum, each
          from 0 to 1. They are control signals for visuals, not calibrated loudness. <code>overall</code> is bass × 0.5 +
          mid × 0.3 + high × 0.2.
        </p>
        <Code label="Inside your animation loop">{framesCode}</Code>
        <p>
          Use <code>getBands()</code> for one control signal. Use <code>snapshot()</code> when you need several views of
          the same frame. FFT and waveform buffers are reused: copy with <code>frame.fft?.slice()</code> to keep a frame.
          Before a source starts they are <code>null</code>.
        </p>
      </section>

      <section id="microphone">
        <Heading id="microphone" />
        <p>
          Call <code>enableMic()</code> from a click. The browser asks for permission; HTTPS or localhost is required. The
          microphone is never connected to the speakers.
        </p>
        <Code label="mic.js">{micCode}</Code>
        <p>
          Music and microphone have separate analysers and can run at once. Read each explicitly with{' '}
          <code>snapshot('music')</code> and <code>snapshot('mic')</code>; the library does not mix them.
        </p>
      </section>

      <section id="live">
        <Heading id="live" />
        <p>
          <span className="d-since">New in 0.7</span> Band regions, <code>fftSize</code> and smoothing can change on a
          running instance without stopping the audio. Invalid input throws <code>invalid_config</code> and keeps the
          previous settings.
        </p>
        <Code label="Adjusting while it plays">{liveCode}</Code>
        <p>
          Ranges are shares of the spectrum from 0 Hz to half the sample rate, in equal-width bins. A share times{' '}
          <code>getSampleRate() / 2</code> gives Hz; each edge snaps to a whole bin, so more bins give finer edges. A new{' '}
          <code>fftSize</code> replaces the buffers <code>snapshot()</code> returns.
        </p>
        <p>
          <span className="d-since">New in 0.8</span> The default ranges are set in Hz: bass 0–250, mid 250–4000 and
          high 4000–16000, at whatever sample rate the device runs. The defaults also moved to <code>fftSize</code>{' '}
          1024 and, for music, smoothing 0.7, so the bands follow the music more closely. Ranges you pass are still
          shares of the spectrum.
        </p>
      </section>

      <section id="api" className="d-wide">
        <Heading id="api" />
        <p>
          Create an instance with <code>new AudioBands(options?)</code>. Reading methods take <code>'music'</code> (the
          default) or <code>'mic'</code>. Async methods reject with an <code>AudioBandsError</code>; catch them even when
          you use callbacks.
        </p>
        <div className="d-table">
          <table>
            <thead>
              <tr>
                <th scope="col">Method</th>
                <th scope="col">Returns</th>
                <th scope="col">What it does</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <Fragment key={g}>
                  <tr className="d-group">
                    <th scope="colgroup" colSpan={3}>
                      {g}
                    </th>
                  </tr>
                  {methods
                    .filter((m) => m.group === g)
                    .map((m) => (
                      <tr key={m.name}>
                        <th scope="row">
                          <code>{m.name}</code>
                          {m.since && <span className="d-since">{m.since}</span>}
                        </th>
                        <td>
                          <code>{m.returns}</code>
                        </td>
                        <td>{m.does}</td>
                      </tr>
                    ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="options" className="d-wide">
        <Heading id="options" />
        <Code label="Constructor options">{optionsCode}</Code>
        <div className="d-table">
          <table>
            <thead>
              <tr>
                <th scope="col">Option</th>
                <th scope="col">Type</th>
                <th scope="col">Default</th>
                <th scope="col">Range</th>
              </tr>
            </thead>
            <tbody>
              {options.map((o) => (
                <tr key={o.name}>
                  <th scope="row">
                    <code>{o.name}</code>
                  </th>
                  <td>
                    <code>{o.type}</code>
                  </td>
                  <td className="d-tnum">{o.fallback}</td>
                  <td>{o.range}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="troubleshooting">
        <Heading id="troubleshooting" />
        {questions.map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </section>
    </>
  );
}
