import { useEffect, useRef, useState, useCallback } from 'react';
import { useAudioBands } from '@juandinella/audio-bands';

// ── Pre-computed log band index ranges ──────────────────────────────────────
// Computed once at module load instead of every animation frame.
// FFT bin count is fixed at 128 (fftSize 256 / 2).
const FFT_BIN_COUNT = 128;

function buildLogRanges(bins: number, n: number): Array<[number, number]> {
  return Array.from({ length: n }, (_, b) => [
    Math.floor(Math.pow(bins, b / n)),
    Math.floor(Math.pow(bins, (b + 1) / n)),
  ] as [number, number]);
}

const LOG_RANGES_64  = buildLogRanges(FFT_BIN_COUNT, 64);
const LOG_RANGES_128 = buildLogRanges(FFT_BIN_COUNT, 128);

// Group FFT bins into logarithmically-spaced bands using pre-computed ranges.
function logBands(fft: Uint8Array<ArrayBuffer>, ranges: Array<[number, number]>): number[] {
  const bins = fft.length;
  return ranges.map(([start, end]) => {
    let sum = 0, count = 0;
    for (let i = start; i <= end && i < bins; i++) { sum += fft[i]; count++; }
    return count > 0 ? sum / count / 255 : 0;
  });
}

// Compute band averages directly from an already-fetched FFT buffer,
// avoiding a second getByteFrequencyData call in the same frame.
function bandsFromFft(fft: Uint8Array<ArrayBuffer>) {
  const len = fft.length;
  let bSum = 0, mSum = 0, hSum = 0;
  const bEnd = Math.floor(len * 0.08);
  const mEnd = Math.floor(len * 0.4);
  for (let i = 0;    i < bEnd; i++) bSum += fft[i];
  for (let i = bEnd; i < mEnd; i++) mSum += fft[i];
  for (let i = mEnd; i < len;  i++) hSum += fft[i];
  const bass = bSum / bEnd / 255;
  const mid  = mSum / (mEnd - bEnd) / 255;
  const high = hSum / (len - mEnd) / 255;
  return { bass, mid, high, overall: bass * 0.5 + mid * 0.3 + high * 0.2 };
}

const ZERO_BANDS = { bass: 0, mid: 0, high: 0, overall: 0 };
const EMPTY_128: number[] = new Array(128).fill(0);

const TRACKS = [
  { name: 'Sabre Dance', composer: 'Marty Paich Piano Quartet', url: 'https://dn721903.ca.archive.org/0/items/JV-38892-1960-QmZBx4kf9ahTkoVGdbQjamPmiwCNq4EGdgJZGdn1Uq6Y3B.mp3/DW524439.mp3' },
  { name: 'Gymnopédie No.1', composer: 'Erik Satie', url: '/audio/gymnopedie-1.ogg' },
  { name: 'Maple Leaf Rag', composer: 'Scott Joplin', url: '/audio/maple-leaf-rag.ogg' },
  { name: 'Gnossienne No.1', composer: 'Erik Satie', url: '/audio/gnossienne-1.ogg' },
];

type Viz = 'bars' | 'spectrum' | 'blob' | 'lissajous';

const VIZS: { key: Viz; label: string }[] = [
  { key: 'bars', label: 'bars' },
  { key: 'spectrum', label: 'spectrum' },
  { key: 'blob', label: 'blob' },
  { key: 'lissajous', label: 'lissajous' },
];

export default function App() {
  const { isPlaying, micActive, getBands, getFftData, getWaveform, loadTrack, togglePlayPause, toggleMic } =
    useAudioBands();

  const [currentTrack, setCurrentTrack] = useState(0);
  const [viz, setViz] = useState<Viz>('bars');
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText('npm install @juandinella/audio-bands');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  // Cached bar gradient — recreated only when canvas height changes
  const barGradRef = useRef<{ h: number; grad: CanvasGradient | null }>({ h: 0, grad: null });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function resize() {
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      barGradRef.current.grad = null; // invalidate cached gradient on resize
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Read design tokens from CSS custom properties — keeps canvas colours
    // in sync with the design system without hardcoding hex values here.
    const cssVars = getComputedStyle(document.documentElement);
    const accent = cssVars.getPropertyValue('--accent').trim();
    const pink   = cssVars.getPropertyValue('--accent-2').trim();

    function loop() {
      if (!canvas) return;
      const ctx = canvas.getContext('2d')!;
      const w = canvas.width;
      const h = canvas.height;
      const dpr = window.devicePixelRatio || 1;
      const t = Date.now() / 1000;

      // Fetch only what the active visualization needs — avoids redundant
      // getByteFrequencyData calls for data the current viz won't use.
      const needsFft  = viz === 'bars' || viz === 'spectrum' || viz === 'blob';
      const needsMic  = micActive && (viz === 'bars' || viz === 'spectrum');
      const fft       = needsFft ? getFftData('music') : null;
      const fftMic    = needsMic ? getFftData('mic') : null;
      // For blob, derive bands from the already-fetched fft (no second read).
      // For lissajous, call getBands directly (no fft needed).
      const music = viz === 'lissajous'
        ? getBands('music')
        : (fft ? bandsFromFft(fft) : ZERO_BANDS);
      const mic = micActive && (viz === 'blob' || viz === 'lissajous')
        ? getBands('mic')
        : ZERO_BANDS;
      const waveform = (viz === 'blob' && micActive) ? getWaveform() : null;

      ctx.clearRect(0, 0, w, h);

      if (viz === 'bars') {
        // ── Logarithmic bands ─────────────────────────────────────
        if (!fft) { rafRef.current = requestAnimationFrame(loop); return; }
        const N = 64;
        const musicBands = logBands(fft, LOG_RANGES_64);
        const micBands = fftMic ? logBands(fftMic, LOG_RANGES_64) : null;
        const gap = 2 * dpr;
        const barW = (w - gap * (N - 1)) / N;
        const labelH = 20 * dpr;
        const maxH = h - labelH;

        // Cache the gradient — recreate only when canvas height changes
        if (barGradRef.current.h !== maxH || !barGradRef.current.grad) {
          const grad = ctx.createLinearGradient(0, 0, 0, maxH);
          grad.addColorStop(0,    accent);
          grad.addColorStop(0.6,  accent + '99');
          grad.addColorStop(1,    accent + '22');
          barGradRef.current = { h: maxH, grad };
        }
        ctx.fillStyle = barGradRef.current.grad!;

        for (let i = 0; i < N; i++) {
          const x = i * (barW + gap);
          const musicH = Math.max(2 * dpr, musicBands[i] * maxH);
          ctx.fillRect(x, maxH - musicH, barW, musicH);
        }

        if (micBands) {
          ctx.fillStyle = pink + '88';
          for (let i = 0; i < N; i++) {
            const x = i * (barW + gap);
            const micH = Math.max(2 * dpr, micBands[i] * maxH);
            ctx.fillRect(x, maxH - micH, barW, micH);
          }
        }

        ctx.fillStyle = 'rgba(232,230,223,0.2)';
        ctx.font = `${9 * dpr}px DM Mono, monospace`;
        ctx.textAlign = 'left';  ctx.fillText('BASS', 2 * dpr, h - 6 * dpr);
        ctx.textAlign = 'center'; ctx.fillText('MID', w / 2, h - 6 * dpr);
        ctx.textAlign = 'right';  ctx.fillText('HIGH', w - 2 * dpr, h - 6 * dpr);

      } else if (viz === 'spectrum') {
        // ── Log-scaled smooth area ────────────────────────────────
        if (!fft) { rafRef.current = requestAnimationFrame(loop); return; }
        const N = 128;
        const musicBands = logBands(fft, LOG_RANGES_128);
        const micBands = fftMic ? logBands(fftMic, LOG_RANGES_128) : null;
        const step = w / (N - 1);

        const drawArea = (bands: number[], color: string, fill: boolean) => {
          ctx.beginPath();
          ctx.moveTo(0, h);
          bands.forEach((v, i) => {
            const x = i * step;
            const y = h - v * h * 0.92;
            if (i === 0) ctx.lineTo(x, y);
            else {
              const px = (i - 1) * step;
              const py = h - bands[i - 1] * h * 0.92;
              ctx.bezierCurveTo((px + x) / 2, py, (px + x) / 2, y, x, y);
            }
          });
          ctx.lineTo(w, h);
          ctx.closePath();
          if (fill) {
            const grad = ctx.createLinearGradient(0, 0, 0, h);
            grad.addColorStop(0, color + 'ee');
            grad.addColorStop(0.5, color + '66');
            grad.addColorStop(1, color + '00');
            ctx.fillStyle = grad;
            ctx.fill();
          } else {
            ctx.strokeStyle = color + 'bb';
            ctx.lineWidth = 1.5 * dpr;
            ctx.stroke();
          }
        };

        drawArea(musicBands, accent, true);
        if (micBands) drawArea(micBands, pink, false);

      } else if (viz === 'blob') {
        // ── Blob distorted by log bands + mic ring ────────────────
        const cx = w / 2;
        const cy = h / 2;
        const baseR = Math.min(w, h) * 0.22;
        const N = 128;
        const bands = fft ? logBands(fft, LOG_RANGES_128) : EMPTY_128;

        // glow
        const glowR = baseR * (1.3 + music.bass * 0.7);
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR * 1.8);
        glow.addColorStop(0, accent + '1a');
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(cx, cy, glowR * 1.8, 0, Math.PI * 2);
        ctx.fill();

        // blob — each angle uses its log band
        ctx.beginPath();
        for (let i = 0; i <= N; i++) {
          const angle = (i / N) * Math.PI * 2 - Math.PI / 2;
          const v = bands[i % N];
          const wobble = Math.sin(angle * 4 + t * 1.5) * music.mid * 0.12;
          const r = baseR * (0.75 + v * 0.7 + wobble);
          const x = cx + Math.cos(angle) * r;
          const y = cy + Math.sin(angle) * r;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.closePath();
        const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR * 1.6);
        bg.addColorStop(0, accent + 'ff');
        bg.addColorStop(0.4, accent + 'aa');
        bg.addColorStop(1, accent + '00');
        ctx.fillStyle = bg;
        ctx.fill();

        // mic waveform as outer ring
        if (waveform && micActive) {
          ctx.beginPath();
          const micR = baseR * (1.45 + mic.overall * 0.4);
          for (let i = 0; i <= waveform.length; i++) {
            const idx = i % waveform.length;
            const angle = (i / waveform.length) * Math.PI * 2 - Math.PI / 2;
            const v = (waveform[idx] / 255) * 2 - 1;
            const r = micR + v * baseR * 0.3;
            const x = cx + Math.cos(angle) * r;
            const y = cy + Math.sin(angle) * r;
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.strokeStyle = pink + 'cc';
          ctx.lineWidth = 1.5 * dpr;
          ctx.stroke();
        }

      } else if (viz === 'lissajous') {
        // ── Parametric lissajous modulated by audio ───────────────
        const cx = w / 2;
        const cy = h / 2;
        const rx = w * 0.42;
        const ry = h * 0.42;

        // frequency ratios shift with bands — creates evolving figures
        const freqX = 2 + Math.round(music.bass * 3);
        const freqY = 3 + Math.round(music.high * 2);
        const phase = music.mid * Math.PI;
        const micPhase = micActive ? mic.overall * Math.PI * 0.5 : 0;

        // sample the full curve
        const pts = 512;
        ctx.beginPath();
        for (let i = 0; i <= pts; i++) {
          const p = (i / pts) * Math.PI * 2;
          const x = cx + Math.sin(freqX * p + phase + t * 0.3) * rx * (0.5 + music.overall * 0.5);
          const y = cy + Math.sin(freqY * p + micPhase + t * 0.15) * ry * (0.5 + music.overall * 0.5);
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.strokeStyle = micActive ? pink : accent;
        ctx.lineWidth = 1.5 * dpr;
        ctx.globalAlpha = 0.85;
        ctx.stroke();
        ctx.globalAlpha = 1;

        // dot at current parametric position
        const x = cx + Math.sin(freqX * (t * 0.3 % (Math.PI * 2)) + phase) * rx * (0.5 + music.overall * 0.5);
        const y = cy + Math.sin(freqY * (t * 0.3 % (Math.PI * 2)) + micPhase) * ry * (0.5 + music.overall * 0.5);
        ctx.beginPath();
        ctx.arc(x, y, 3 * dpr, 0, Math.PI * 2);
        ctx.fillStyle = micActive ? pink : accent;
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [getBands, getFftData, getWaveform, micActive, viz]);

  async function handleTrack(i: number) {
    setCurrentTrack(i);
    setIsLoading(true);
    try {
      await loadTrack(TRACKS[i].url);
    } finally {
      setIsLoading(false);
    }
  }

  function handlePlay() {
    if (isLoading) return;
    if (isPlaying) togglePlayPause();
    else handleTrack(currentTrack);
  }

  return (
    <div style={s.page}>
      <header style={s.header}>
        <span style={s.pkg}>@juandinella/audio-bands</span>
        <a href="https://github.com/juandinella/audio-bands" target="_blank" rel="noreferrer" className="header-link">
          github →
        </a>
      </header>

      <main style={s.main}>
        <p style={s.description}>
          Headless audio frequency analysis for the browser. Get real-time{' '}
          <span style={s.hi}>bass</span>, <span style={s.hi}>mid</span>, and{' '}
          <span style={s.hi}>high</span> values normalized to 0–1 from a music
          track or microphone — simultaneously. No renderer included.
        </p>

        <div style={s.installWrap}>
          <code style={s.installCode}>npm install @juandinella/audio-bands</code>
          <button style={s.copyBtn} onClick={handleCopy} aria-label={copied ? 'Copied' : 'Copy install command'}>
            {copied ? (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1.5,6 4.5,9 10.5,3" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="4" width="7" height="7" rx="1" />
                <path d="M8 4V2.5A1 1 0 0 0 7 1.5H1.5A1 1 0 0 0 0.5 2.5V8A1 1 0 0 0 1.5 9H4" />
              </svg>
            )}
          </button>
        </div>

        {/* Viz switcher */}
        <div style={s.vizTabs}>
          {VIZS.map(({ key, label }) => (
            <button
              key={key}
              style={{ ...s.vizTab, ...(viz === key ? s.vizTabActive : {}) }}
              onClick={() => setViz(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Canvas */}
        <canvas ref={canvasRef} style={s.canvas} role="img" aria-label={`${viz} audio frequency visualization`} />

        {/* Controls */}
        <div style={s.controls}>
          <button
            style={{ ...s.btnPlay, opacity: isLoading ? 0.5 : 1 }}
            onClick={handlePlay}
            aria-pressed={isPlaying}
            aria-label={isLoading ? 'loading' : isPlaying ? 'pause' : 'play'}
            disabled={isLoading}
          >
            {isLoading ? 'loading…' : isPlaying ? 'pause' : 'play'}
          </button>

          <div style={s.selectWrap}>
            <select
              style={s.select}
              value={currentTrack}
              onChange={(e) => handleTrack(Number(e.target.value))}
            >
              {TRACKS.map((t, i) => (
                <option key={i} value={i}>{t.name} — {t.composer}</option>
              ))}
            </select>
            <svg style={s.chevron} width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="2,3.5 5,6.5 8,3.5" />
            </svg>
          </div>

          <button
            style={{ ...s.btnMic, color: micActive ? 'var(--accent-2)' : 'var(--muted)' }}
            onClick={toggleMic}
            aria-pressed={micActive}
            aria-label={micActive ? 'disable microphone' : 'enable microphone'}
          >
            {micActive ? 'mic on' : 'mic'}
          </button>
        </div>

        {/* Error state */}
        {audioError && (
          <div style={s.errorMsg} role="alert">
            failed to load track — check your connection and try again
          </div>
        )}

        {/* Snippet */}
        <div style={s.snippetWrap}>
          <div style={s.snippetHeader}>
            <span style={s.snippetLabel}>example</span>
            <span style={s.snippetFile}>visualizer.tsx</span>
          </div>
          <pre style={s.snippet}>
            <span style={s.cMuted}>{'import '}</span>
            <span style={s.cText}>{'{ useAudioBands }'}</span>
            <span style={s.cMuted}>{' from '}</span>
            <span style={s.cAccent}>{`'@juandinella/audio-bands'\n\n`}</span>
            <span style={s.cMuted}>{'const '}</span>
            <span style={s.cText}>{'{ getBands }'}</span>
            <span style={s.cMuted}>{' = '}</span>
            <span style={s.cAccent}>{'useAudioBands'}</span>
            <span style={s.cText}>{'()\n\n'}</span>
            <span style={s.cComment}>{'// inside your animation loop:\n'}</span>
            <span style={s.cMuted}>{'const '}</span>
            <span style={s.cText}>{'{ bass, mid, high }'}</span>
            <span style={s.cMuted}>{' = '}</span>
            <span style={s.cAccent}>{'getBands'}</span>
            <span style={s.cText}>{"('music')\n"}</span>
            <span style={s.cMuted}>{'const '}</span>
            <span style={s.cText}>{'mic'}</span>
            <span style={s.cMuted}>{' = '}</span>
            <span style={s.cAccent}>{'getBands'}</span>
            <span style={s.cText}>{"('mic')"}</span>
          </pre>
        </div>
      </main>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', display: 'flex', flexDirection: 'column' },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 24px', borderBottom: '1px solid var(--border)',
  },
  pkg: { fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.08em', color: 'var(--muted)' },
  main: {
    flex: 1, maxWidth: 640, margin: '0 auto', width: '100%',
    padding: '64px 24px', display: 'flex', flexDirection: 'column', gap: 24,
  },
  description: { fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--muted)', lineHeight: 1.8 },
  hi: { color: 'var(--accent)' },
  installWrap: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: 'var(--accent-tint)', border: '1px solid var(--border)',
    padding: '10px 16px',
  },
  installCode: {
    fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--accent)',
  },
  copyBtn: {
    background: 'transparent', border: 'none', padding: '10px 12px',
    minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--muted)',
    transition: 'color 0.15s',
  },

  // Viz tabs
  vizTabs: { display: 'flex', border: '1px solid var(--border)' },
  vizTab: {
    flex: 1, fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.1em',
    textTransform: 'uppercase' as const, background: 'transparent', border: 'none',
    borderRight: '1px solid var(--border)', padding: '9px 0',
    color: 'var(--muted)', transition: 'color 0.15s',
  },
  vizTabActive: { color: 'var(--accent)' },

  // Canvas
  canvas: { width: '100%', height: 280, display: 'block', border: '1px solid var(--border)', borderTop: 'none' },

  // Controls
  controls: { display: 'flex', border: '1px solid var(--border)' },
  btnPlay: {
    fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.08em',
    background: 'transparent', border: 'none', borderRight: '1px solid var(--border)',
    padding: '12px 20px', color: 'var(--accent)',
  },
  selectWrap: { flex: 1, position: 'relative' as const, display: 'flex', alignItems: 'center' },
  select: {
    fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.06em',
    background: 'transparent', border: 'none', padding: '12px 36px 12px 16px',
    color: 'var(--muted)', width: '100%', outline: 'none', appearance: 'none' as const,
  },
  chevron: { position: 'absolute' as const, right: 14, color: 'var(--muted)', pointerEvents: 'none' as const },
  btnMic: {
    fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.08em',
    background: 'transparent', border: 'none', borderLeft: '1px solid var(--border)',
    padding: '12px 20px', transition: 'color 0.15s',
  },

  // Snippet
  snippetWrap: { border: '1px solid var(--border)' },
  snippetHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 16px', borderBottom: '1px solid var(--border)',
    background: 'var(--surface)',
  },
  snippetLabel: { fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: 'rgba(232,230,223,0.45)' },
  snippetFile: { fontFamily: 'var(--mono)', fontSize: 10, color: 'rgba(232,230,223,0.4)' },
  snippet: { fontFamily: 'var(--mono)', fontSize: 12, lineHeight: 1.8, padding: '20px 24px', whiteSpace: 'pre' as const, overflowX: 'auto' as const, margin: 0 },
  cText: { color: 'var(--text)' },
  cMuted: { color: 'var(--muted)' },
  cAccent: { color: 'var(--accent)' },
  cComment: { color: 'rgba(232,230,223,0.45)', fontStyle: 'italic' as const },
  errorMsg: {
    fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.04em',
    color: 'var(--error)', padding: '10px 16px',
    border: '1px solid color-mix(in srgb, var(--error) 30%, transparent)',
  },
};
