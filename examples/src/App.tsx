import { useEffect, useRef, useState } from 'react';
import { useAudioBands } from '@juandinella/audio-bands/react';

const FFT_BIN_COUNT = 256;
const ZERO_BANDS = { bass: 0, mid: 0, high: 0, overall: 0 };
const EMPTY_METERS = { presence: 0, air: 0 };

const TRACKS = [
  { name: 'Gymnopédie No.1', composer: 'Erik Satie', url: '/audio/gymnopedie-1.ogg' },
  { name: 'Maple Leaf Rag', composer: 'Scott Joplin', url: '/audio/maple-leaf-rag.ogg' },
  { name: 'Gnossienne No.1', composer: 'Erik Satie', url: '/audio/gnossienne-1.ogg' },
  { name: 'Sabre Dance', composer: 'Marty Paich Piano Quartet', url: 'https://dn721903.ca.archive.org/0/items/JV-38892-1960-QmZBx4kf9ahTkoVGdbQjamPmiwCNq4EGdgJZGdn1Uq6Y3B.mp3/DW524439.mp3' },
];

type Viz = 'bars' | 'ribbon' | 'orbital';
type SnippetTab = 'react' | 'vanilla' | 'custom';

const VIZS: { key: Viz; label: string; detail: string }[] = [
  { key: 'bars', label: 'Bars', detail: 'Raw FFT buckets for spectrum-style renderers' },
  { key: 'ribbon', label: 'Ribbon', detail: 'Smooth area driven by the current analyser curve' },
  { key: 'orbital', label: 'Orbital', detail: 'High-level motion from bands plus mic overlay' },
];

const SNIPPETS: Record<SnippetTab, string> = {
  react: `import { useAudioBands } from '@juandinella/audio-bands/react'

const {
  loadTrack,
  getBands,
  getFftData,
  loadError,
} = useAudioBands()

await loadTrack('/track.mp3')

function frame() {
  const { bass, mid, high } = getBands()
  const fft = getFftData()
}`,
  vanilla: `import { AudioBands } from '@juandinella/audio-bands/core'

const audio = new AudioBands({
  onLoadError: console.error,
  onMicError: console.error,
})

await audio.load('/track.mp3')
const state = audio.getState()
const bands = audio.getBands()`,
  custom: `const audio = new AudioBands({
  music: { fftSize: 512, smoothingTimeConstant: 0.68 },
  customBands: {
    presence: { from: 0.18, to: 0.45 },
    air: { from: 0.62, to: 1 },
  },
})

const { presence, air } = audio.getCustomBands()`,
};

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function blendBands(fft: Uint8Array<ArrayBuffer> | null) {
  if (!fft) return ZERO_BANDS;

  const len = fft.length;
  const bassEnd = Math.max(1, Math.floor(len * 0.08));
  const midEnd = Math.max(bassEnd + 1, Math.floor(len * 0.4));

  let bass = 0;
  let mid = 0;
  let high = 0;

  for (let i = 0; i < bassEnd; i++) bass += fft[i];
  for (let i = bassEnd; i < midEnd; i++) mid += fft[i];
  for (let i = midEnd; i < len; i++) high += fft[i];

  const bassValue = bass / bassEnd / 255;
  const midValue = mid / (midEnd - bassEnd) / 255;
  const highValue = high / (len - midEnd) / 255;

  return {
    bass: bassValue,
    mid: midValue,
    high: highValue,
    overall: bassValue * 0.5 + midValue * 0.3 + highValue * 0.2,
  };
}

function formatValue(value: number): string {
  return value.toFixed(2);
}

export default function App() {
  const {
    isPlaying,
    micActive,
    hasTrack,
    loadError,
    micError,
    state,
    loadTrack,
    togglePlayPause,
    toggleMic,
    getBands,
    getCustomBands,
    getFftData,
    getWaveform,
  } = useAudioBands({
    music: { fftSize: 512, smoothingTimeConstant: 0.68 },
    mic: { fftSize: 1024, smoothingTimeConstant: 0.45 },
    customBands: {
      presence: { from: 0.18, to: 0.45 },
      air: { from: 0.62, to: 1 },
    },
  });

  const [currentTrack, setCurrentTrack] = useState(0);
  const [viz, setViz] = useState<Viz>('bars');
  const [snippetTab, setSnippetTab] = useState<SnippetTab>('react');
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [liveBands, setLiveBands] = useState(ZERO_BANDS);
  const [liveMicBands, setLiveMicBands] = useState(ZERO_BANDS);
  const [customBands, setCustomBands] = useState<Record<string, number>>(EMPTY_METERS);
  const [fftPeek, setFftPeek] = useState<number[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
    }

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);

    function render() {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width;
      const height = canvas.height;
      const time = performance.now() / 1000;

      const musicFft = getFftData('music');
      const micFft = micActive ? getFftData('mic') : null;
      const waveform = micActive ? getWaveform() : null;
      const musicBands = musicFft ? blendBands(musicFft) : getBands('music');
      const micBands = micActive ? getBands('mic') : ZERO_BANDS;
      const custom = getCustomBands('music');

      setLiveBands(musicBands);
      setLiveMicBands(micBands);
      setCustomBands(Object.keys(custom).length > 0 ? custom : EMPTY_METERS);
      setFftPeek(musicFft ? Array.from(musicFft.slice(0, 12), (value) => value / 255) : []);

      ctx.clearRect(0, 0, width, height);

      const accent = '#d7ff74';
      const accentSoft = 'rgba(215,255,116,0.3)';
      const micColor = '#ff8bd2';
      const gridColor = 'rgba(255,255,255,0.06)';

      ctx.fillStyle = '#081018';
      ctx.fillRect(0, 0, width, height);

      for (let i = 1; i < 5; i++) {
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, (height / 5) * i);
        ctx.lineTo(width, (height / 5) * i);
        ctx.stroke();
      }

      if (viz === 'bars') {
        const bins = musicFft ?? new Uint8Array(FFT_BIN_COUNT / 2);
        const count = 48;
        const gap = 4 * dpr;
        const barWidth = (width - gap * (count - 1)) / count;

        for (let i = 0; i < count; i++) {
          const start = Math.floor((bins.length / count) * i);
          const end = Math.max(start + 1, Math.floor((bins.length / count) * (i + 1)));
          let sum = 0;
          for (let j = start; j < end; j++) sum += bins[j] ?? 0;
          const value = sum / (end - start) / 255;
          const x = i * (barWidth + gap);
          const h = Math.max(6 * dpr, value * height * 0.88);

          const grad = ctx.createLinearGradient(0, height - h, 0, height);
          grad.addColorStop(0, accent);
          grad.addColorStop(1, accentSoft);
          ctx.fillStyle = grad;
          ctx.fillRect(x, height - h, barWidth, h);
        }

        if (micFft) {
          ctx.strokeStyle = 'rgba(255,139,210,0.9)';
          ctx.lineWidth = 1.25 * dpr;
          ctx.beginPath();
          for (let i = 0; i < count; i++) {
            const idx = Math.min(micFft.length - 1, Math.floor((micFft.length / count) * i));
            const x = i * (barWidth + gap) + barWidth / 2;
            const y = height - (micFft[idx] / 255) * height * 0.92;
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }

      if (viz === 'ribbon') {
        const bins = musicFft ?? new Uint8Array(FFT_BIN_COUNT / 2);
        const points = 64;
        const step = width / (points - 1);

        ctx.beginPath();
        ctx.moveTo(0, height);
        for (let i = 0; i < points; i++) {
          const idx = Math.min(bins.length - 1, Math.floor((bins.length / points) * i));
          const value = bins[idx] / 255;
          const x = i * step;
          const y = height - value * height * 0.84;
          if (i === 0) ctx.lineTo(x, y);
          else {
            const px = (i - 1) * step;
            const py = height - (bins[Math.min(bins.length - 1, Math.floor((bins.length / points) * (i - 1)))] / 255) * height * 0.84;
            ctx.bezierCurveTo((px + x) / 2, py, (px + x) / 2, y, x, y);
          }
        }
        ctx.lineTo(width, height);
        ctx.closePath();

        const fill = ctx.createLinearGradient(0, 0, 0, height);
        fill.addColorStop(0, 'rgba(215,255,116,0.95)');
        fill.addColorStop(0.45, 'rgba(215,255,116,0.3)');
        fill.addColorStop(1, 'rgba(215,255,116,0)');
        ctx.fillStyle = fill;
        ctx.fill();

        if (micFft) {
          ctx.beginPath();
          for (let i = 0; i < points; i++) {
            const idx = Math.min(micFft.length - 1, Math.floor((micFft.length / points) * i));
            const x = i * step;
            const y = height - (micFft[idx] / 255) * height * 0.74;
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
          ctx.strokeStyle = 'rgba(255,139,210,0.8)';
          ctx.lineWidth = 1.5 * dpr;
          ctx.stroke();
        }
      }

      if (viz === 'orbital') {
        const cx = width / 2;
        const cy = height / 2;
        const radius = Math.min(width, height) * 0.18;
        const points = 72;

        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 2.4);
        glow.addColorStop(0, 'rgba(215,255,116,0.18)');
        glow.addColorStop(1, 'rgba(215,255,116,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 2.4, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        for (let i = 0; i <= points; i++) {
          const angle = (i / points) * Math.PI * 2;
          const wave =
            Math.sin(angle * 2 + time * 1.4) * liveBands.bass * 0.18 +
            Math.cos(angle * 3 - time * 0.6) * liveBands.mid * 0.14 +
            Math.sin(angle * 5 + time * 0.9) * liveBands.high * 0.08;
          const r = radius * (1 + liveBands.overall * 0.45 + wave);
          const x = cx + Math.cos(angle) * r;
          const y = cy + Math.sin(angle) * r;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(215,255,116,0.18)';
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.5 * dpr;
        ctx.fill();
        ctx.stroke();

        if (waveform && micActive) {
          ctx.beginPath();
          for (let i = 0; i <= waveform.length; i++) {
            const idx = i % waveform.length;
            const angle = (i / waveform.length) * Math.PI * 2;
            const offset = (waveform[idx] / 255) * 2 - 1;
            const r = radius * (1.55 + liveMicBands.overall * 0.25) + offset * radius * 0.18;
            const x = cx + Math.cos(angle) * r;
            const y = cy + Math.sin(angle) * r;
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.strokeStyle = micColor;
          ctx.lineWidth = 1.2 * dpr;
          ctx.stroke();
        }
      }

      rafRef.current = requestAnimationFrame(render);
    }

    rafRef.current = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(rafRef.current);
      resizeObserver.disconnect();
    };
  }, [getBands, getCustomBands, getFftData, getWaveform, micActive, viz]);

  async function handleTrack(index: number) {
    setCurrentTrack(index);
    setIsLoading(true);
    try {
      await loadTrack(TRACKS[index].url);
    } finally {
      setIsLoading(false);
    }
  }

  function handlePlay() {
    if (isLoading) return;
    if (isPlaying) {
      togglePlayPause();
      return;
    }
    void handleTrack(currentTrack);
  }

  function copyInstall() {
    navigator.clipboard.writeText('npm install @juandinella/audio-bands');
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  const errorMessage = loadError
    ? 'Track failed to load or start playback'
    : micError
      ? 'Mic permission was denied or the input failed'
      : null;

  return (
    <div className="page-shell">
      <div className="bg-grid" />
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-chip">audio-bands</span>
          <span className="brand-sub">headless browser audio analysis</span>
        </a>
        <div className="topbar-links">
          <a href="https://www.npmjs.com/package/@juandinella/audio-bands" target="_blank" rel="noreferrer">npm</a>
          <a href="https://github.com/juandinella/audio-bands" target="_blank" rel="noreferrer">github</a>
        </div>
      </header>

      <main className="layout">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">React hook + framework-agnostic core</p>
            <h1>
              Audio analysis for the browser.
            </h1>
            <p className="lead">
              Get real-time <span className="lead-accent">bass</span>, <span className="lead-accent-2">mid</span>, <span className="lead-accent">high</span>, custom bands or raw FFT data from a track, a microphone, or both at once. No renderer included.
            </p>

            <div className="cta-row">
              <button className="cta-primary" onClick={copyInstall}>
                {copied ? 'copied' : 'copy install'}
              </button>
              <code className="install-line">npm install @juandinella/audio-bands</code>
            </div>

            <div className="feature-row">
              <div className="feature-card">
                <strong>Headless</strong>
                <span>No renderer included. Only usable audio data.</span>
              </div>
              <div className="feature-card">
                <strong>Music + mic</strong>
                <span>Analyze a track, live input, or both at the same time.</span>
              </div>
              <div className="feature-card">
                <strong>Three levels</strong>
                <span>`getBands()`, `getCustomBands()`, or `getFftData()`.</span>
              </div>
            </div>
          </div>
        </section>

        <section className="demo-panel">
          <div className="demo-head">
            <div>
              <p className="panel-label">live demo</p>
              <h2>{VIZS.find((item) => item.key === viz)?.detail}</h2>
            </div>
            <div className="viz-switch">
              {VIZS.map((item) => (
                <button
                  key={item.key}
                  className={viz === item.key ? 'viz-btn active' : 'viz-btn'}
                  onClick={() => setViz(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <canvas className="demo-canvas" ref={canvasRef} />

          <div className="controls">
            <button className="control primary" disabled={isLoading} onClick={handlePlay}>
              {isLoading ? 'loading…' : isPlaying ? 'pause' : 'play'}
            </button>
            <label className="select-wrap">
              <span>track</span>
              <select value={currentTrack} onChange={(event) => void handleTrack(Number(event.target.value))}>
                {TRACKS.map((track, index) => (
                  <option key={track.name} value={index}>
                    {track.name} — {track.composer}
                  </option>
                ))}
              </select>
            </label>
            <button className={micActive ? 'control mic active' : 'control mic'} onClick={toggleMic}>
              {micActive ? 'mic on' : 'toggle mic'}
            </button>
          </div>

          {errorMessage ? (
            <div className="error-banner" role="alert">
              {errorMessage}
            </div>
          ) : null}
        </section>

        <section className="inspector">
          <div className="section-head">
            <div>
              <p className="panel-label">what the library returns</p>
              <h2>Live values, not just motion.</h2>
            </div>
            <p className="section-copy">
              The visualizer is only a demonstration. The useful part is the data underneath it.
            </p>
          </div>

          <div className="metrics-grid">
            <MetricCard
              title="getBands()"
              note="High-level control signals for product UI and simple motion."
              rows={[
                ['bass', liveBands.bass],
                ['mid', liveBands.mid],
                ['high', liveBands.high],
                ['overall', liveBands.overall],
              ]}
              accent="primary"
            />
            <MetricCard
              title="getCustomBands()"
              note="Semantic buckets tuned to your own renderer."
              rows={Object.entries(customBands)}
              accent="secondary"
            />
            <MetricCard
              title="getState()"
              note="Useful for UI flow, status labels and error handling."
              textRows={[
                ['isPlaying', String(state.isPlaying)],
                ['hasTrack', String(state.hasTrack)],
                ['micActive', String(state.micActive)],
                ['errors', errorMessage ?? 'none'],
              ]}
              accent="neutral"
            />
            <MetricCard
              title="FFT peek"
              note="Bin-level detail for full visualizers."
              rows={fftPeek.map((value, index) => [`bin ${index}`, value])}
              accent="neutral"
            />
          </div>
        </section>

        <section className="snippet-panel">
          <div className="section-head compact">
            <div>
              <p className="panel-label">copyable examples</p>
              <h2>Choose the abstraction level you need.</h2>
            </div>
            <div className="snippet-tabs">
              {(['react', 'vanilla', 'custom'] as const).map((tab) => (
                <button
                  key={tab}
                  className={snippetTab === tab ? 'snippet-tab active' : 'snippet-tab'}
                  onClick={() => setSnippetTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="snippet-body">
            <pre>{SNIPPETS[snippetTab]}</pre>
          </div>
        </section>

        <section className="explainers">
          <article className="explainer-card">
            <p className="panel-label">when to use it</p>
            <h3>`getBands()`</h3>
            <p>Use this when you want a stable pulse for UI, layout or motion. Think blobs, buttons, copy emphasis, scene intensity, or typography.</p>
          </article>
          <article className="explainer-card">
            <p className="panel-label">when to use it</p>
            <h3>`getCustomBands()`</h3>
            <p>Use this when `bass/mid/high` is too generic. Define buckets like `presence`, `air`, or `sub` and keep your render code semantic.</p>
          </article>
          <article className="explainer-card">
            <p className="panel-label">when to use it</p>
            <h3>`getFftData()`</h3>
            <p>Use this when you are drawing a real visualizer: bars, spectrums, log curves, wave fields, particle systems or shaders.</p>
          </article>
        </section>
      </main>
    </div>
  );
}

function MetricCard(
  props: {
    title: string;
    note: string;
    rows?: Array<[string, number]>;
    textRows?: Array<[string, string]>;
    accent: 'primary' | 'secondary' | 'neutral';
  },
) {
  return (
    <article className={`metric-card ${props.accent}`}>
      <div className="metric-head">
        <h3>{props.title}</h3>
        <p>{props.note}</p>
      </div>

      {props.rows ? (
        <div className="metric-list">
          {props.rows.map(([label, value]) => (
            <div key={label} className="metric-row">
              <span>{label}</span>
              <div className="meter">
                <div className="meter-fill" style={{ transform: `scaleX(${clamp(value)})` }} />
              </div>
              <strong>{formatValue(value)}</strong>
            </div>
          ))}
        </div>
      ) : null}

      {props.textRows ? (
        <div className="text-list">
          {props.textRows.map(([label, value]) => (
            <div key={label} className="text-row">
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}
