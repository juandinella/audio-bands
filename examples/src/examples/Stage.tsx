import { useEffect, useRef, useState } from 'react';
import { useAudioBands } from '@juandinella/audio-bands/react';
import type { ExampleSlug } from '../content';
import { tracks } from '../landing/deck';
import type { createSculpture } from './sculpture';

const names = ['bass', 'mid', 'high'] as const;
// The library's default band regions, as shares of the FFT bins.
const DEFAULT_EDGES = { bass: 0.08, mid: 0.4 };

function readVar(el: Element, name: string) {
  return getComputedStyle(el).getPropertyValue(name).trim();
}

// One live example: a dark stage with the renderer, the three values under it,
// and plain controls. Each mode is one renderer reading audio-bands.
export default function Stage({ mode }: { mode: ExampleSlug }) {
  const audio = useAudioBands();
  const mic = mode === 'microphone';
  const [track, setTrack] = useState(0);
  const [loading, setLoading] = useState(!mic);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [reduced, setReduced] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const sculpture = useRef<ReturnType<typeof createSculpture> | null>(null);
  const active = mic ? audio.micActive : audio.isPlaying;
  const { loadTrack, snapshot } = audio;

  useEffect(() => {
    const q = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(q.matches);
    update();
    q.addEventListener('change', update);
    return () => q.removeEventListener('change', update);
  }, []);

  // Changing track while one plays starts the new one, as any player does.
  const resume = useRef(false);
  useEffect(() => {
    if (mic) return;
    let current = true;
    const wasPlaying = resume.current;
    resume.current = false;
    setLoading(true);
    setError('');
    loadTrack(tracks[track].url)
      .then(() => (current && wasPlaying ? audio.play().catch(() => {}) : undefined))
      .catch(() => current && setError('This track could not load. Choose another track.'))
      .finally(() => current && setLoading(false));
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track, mic, loadTrack]);

  useEffect(() => {
    if (mode !== 'three' || !canvas.current) return;
    let current = true;
    const el = canvas.current;
    import('./sculpture')
      .then(({ createSculpture }) => {
        if (current) sculpture.current = createSculpture(el);
      })
      .catch(() => current && setError('The 3D scene needs WebGL. Try the spectrum example instead.'));
    return () => {
      current = false;
      sculpture.current?.dispose();
      sculpture.current = null;
    };
  }, [mode]);

  // The animation loop: reads one frame, writes it straight to the DOM.
  useEffect(() => {
    const root = stage.current;
    if (!root) return;
    const outputs = names.map((n) => root.querySelector<HTMLElement>(`[data-value="${n}"]`)!);
    const meters = names.map((n) => root.querySelector<HTMLElement>(`[data-meter="${n}"]`));
    const circle = root.querySelector<HTMLElement>('.x-pulse');
    const el = canvas.current;
    const ctx = mode === 'spectrum' || mode === 'microphone' ? el?.getContext('2d') : null;
    const colors = {
      bass: readVar(root, '--c-bass'),
      mid: readVar(root, '--c-mid'),
      high: readVar(root, '--c-high'),
      trace: readVar(root, '--c-trace'),
    };
    let raf = 0;
    let prev = 0;
    let text = 0;
    let time = 0;
    let lastTick = 0;

    const draw = (now: number) => {
      const delta = prev ? Math.min((now - prev) / 1000, 0.05) : 0;
      prev = now;
      const frame = snapshot(mic ? 'mic' : 'music');
      const bands = active ? frame.bands : { bass: 0, mid: 0, high: 0, overall: 0 };
      if (active && !reduced) time += delta;

      names.forEach((n, i) => {
        meters[i]?.style.setProperty('--v', String(bands[n]));
        if (now - text > 100 || !active) outputs[i].textContent = bands[n].toFixed(2);
      });
      if (now - text > 100) text = now;
      if (circle) circle.style.transform = `scale(${reduced ? 0.8 : 0.6 + bands.bass * 1.4})`;
      sculpture.current?.draw(reduced ? { bass: 0, mid: 0, high: 0, overall: 0 } : bands, time, active && !reduced ? delta : 0);

      if (el && ctx) {
        const dpr = Math.min(devicePixelRatio, 2);
        const w = Math.round(el.clientWidth * dpr);
        const h = Math.round(el.clientHeight * dpr);
        if (el.width !== w || el.height !== h) {
          el.width = w;
          el.height = h;
        }
        ctx.clearRect(0, 0, w, h);
        if (mode === 'microphone') {
          const wave = active && !reduced ? frame.waveform : null;
          const len = wave?.length ?? 2;
          ctx.strokeStyle = colors.trace;
          ctx.lineWidth = 2 * dpr;
          ctx.beginPath();
          for (let i = 0; i < len; i++) {
            const x = (i / (len - 1)) * w;
            const y = wave ? (wave[i] / 255) * h : h / 2;
            if (i) ctx.lineTo(x, y);
            else ctx.moveTo(x, y);
          }
          ctx.stroke();
        } else {
          // Raw bins on a linear axis, each bar in the colour of the band it falls in.
          const fft = active ? frame.fft : null;
          const count = fft?.length ?? 128;
          const step = w / count;
          for (let i = 0; i < count; i++) {
            const share = i / count;
            ctx.fillStyle = share < DEFAULT_EDGES.bass ? colors.bass : share < DEFAULT_EDGES.mid ? colors.mid : colors.high;
            const bar = Math.max(2 * dpr, ((fft?.[i] ?? 0) / 255) * h * 0.92);
            ctx.fillRect(i * step, h - bar, Math.max(1, step - dpr), bar);
          }
        }
      }
      // Idle demos draw once; reduced motion updates at 5 Hz.
      if (active) raf = requestAnimationFrame(reduced ? tick : draw);
    };
    const tick = (now: number) => {
      if (now - lastTick >= 200) {
        lastTick = now;
        draw(now);
      } else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(draw);
    const resize = new ResizeObserver(() => {
      if (!active) {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(draw);
      }
    });
    if (el) resize.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      resize.disconnect();
    };
  }, [mode, mic, active, snapshot, reduced]);

  const toggle = async () => {
    setError('');
    try {
      if (mic) {
        setPending(true);
        await audio.toggleMic();
      } else await audio.togglePlayPause();
    } catch {
      setError(mic ? 'Microphone access failed. Allow it in your browser settings and try again.' : 'Playback was blocked. Press Play again.');
    } finally {
      setPending(false);
    }
  };

  const label = pending ? 'Requesting access…' : loading ? 'Loading…' : active ? (mic ? 'Stop microphone' : 'Pause') : mic ? 'Enable microphone' : 'Play';

  return (
    <div className={`x-demo x-mode-${mode}`} ref={stage}>
      <div className="x-stage">
        {mode === 'pulse' && <div className="x-pulse" role="img" aria-label="Circle scaled by bass" />}
        {mode === 'bands' && (
          <div className="x-meters" aria-hidden>
            {names.map((n) => (
              <div key={n} className="x-meter" data-band={n}>
                <span data-meter={n} />
              </div>
            ))}
          </div>
        )}
        {(mode === 'spectrum' || mode === 'microphone' || mode === 'three') && (
          <canvas ref={canvas} role="img" aria-label={`${mode === 'three' ? 'Particle sculpture' : mode === 'microphone' ? 'Microphone waveform' : 'Frequency spectrum'}`} />
        )}
      </div>

      <dl className="x-values" aria-label="Values from zero to one">
        {names.map((n) => (
          <div key={n} data-band={n}>
            <dt>{n}</dt>
            <dd data-value={n} aria-live="off">
              0.00
            </dd>
          </div>
        ))}
      </dl>

      <div className="x-controls">
        <button
          type="button"
          className="x-play"
          onClick={toggle}
          aria-pressed={active}
          disabled={pending || (!mic && (loading || !audio.hasTrack))}
        >
          {label}
        </button>
        {!mic && (
          <label className="x-track">
            <span className="x-sr">Track</span>
            <select
              value={track}
              onChange={(e) => {
                resume.current = audio.isPlaying;
                setTrack(Number(e.target.value));
              }}
            >
              {tracks.map((t, i) => (
                <option key={t.url} value={i}>
                  {t.name} · {t.by}
                </option>
              ))}
            </select>
          </label>
        )}
        {mic && <span className="x-note">Analysed in your browser. Not recorded or sent anywhere.</span>}
        <span className="x-sr" role="status">
          {active ? (mic ? 'Microphone on' : 'Playing') : ''}
        </span>
      </div>
      {error && (
        <p role="alert" className="x-error">
          {error}
        </p>
      )}
      {reduced && <p className="x-note">Reduced motion: movement is paused and values update five times a second.</p>}
    </div>
  );
}
