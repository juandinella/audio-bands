import { useEffect, useRef, useState } from 'react';
import { useAudioBands } from '@juandinella/audio-bands/react';
import type { ExampleSlug } from './content';
import type { createSculpture } from './three-scene';

const tracks = [
  { name: 'Maple Leaf Rag — Scott Joplin', url: '/audio/maple-leaf-rag.ogg' },
  { name: 'Gymnopédie No. 1 — Erik Satie', url: '/audio/gymnopedie-1.ogg' },
  { name: 'Gnossienne No. 1 — Erik Satie', url: '/audio/gnossienne-1.ogg' },
];
const names = ['bass', 'mid', 'high'] as const;

export default function Demo({ mode = 'bands' }: { mode?: ExampleSlug }) {
  const audio = useAudioBands();
  const [track, setTrack] = useState(0);
  const [loading, setLoading] = useState(false);
  const [micPending, setMicPending] = useState(false);
  const [error, setError] = useState('');
  const [graphicsError, setGraphicsError] = useState('');
  const [reduced, setReduced] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const sculpture = useRef<ReturnType<typeof createSculpture> | null>(null);
  const mic = mode === 'microphone';
  const active = mic ? audio.micActive : audio.isPlaying;
  const { loadTrack, snapshot } = audio;

  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (mic) return;
    let current = true;
    setLoading(true);
    setError('');
    loadTrack(tracks[track].url).catch(() => {
      if (current) setError('This track could not load. Check your connection or choose another track.');
    }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [track, mic, loadTrack]);

  useEffect(() => {
    if (mode !== 'three' || !canvas.current) return;
    let current = true;
    const element = canvas.current;
    import('./three-scene').then(({ createSculpture }) => {
      if (current) sculpture.current = createSculpture(element);
    }).catch(() => {
      if (current) setGraphicsError('The 3D scene needs WebGL. Try a WebGL-enabled browser, or explore the Canvas spectrum.');
    });
    return () => { current = false; sculpture.current?.dispose(); sculpture.current = null; };
  }, [mode]);

  useEffect(() => {
    if (!root.current) return;
    const outputs = names.map(name => root.current!.querySelector<HTMLOutputElement>(`[data-value="${name}"]`)!);
    const meters = names.map(name => root.current!.querySelector<HTMLElement>(`[data-meter="${name}"]`)!);
    const circle = root.current.querySelector<HTMLElement>('.pulse-circle');
    const element = canvas.current;
    const ctx = mode !== 'three' ? element?.getContext('2d') : null;
    let raf = 0;
    let previous = 0;
    let textTime = 0;
    let time = 0;
    function draw(now: number) {
      const delta = previous ? Math.min((now - previous) / 1000, 0.05) : 0;
      previous = now;
      const frame = snapshot(mic ? 'mic' : 'music');
      const bands = active ? frame.bands : { bass: 0, mid: 0, high: 0, overall: 0 };
      if (active && !reduced) time += delta;
      names.forEach((name, i) => {
        meters[i].style.transform = `scaleY(${bands[name]})`;
        if (now - textTime > 100 || !active) outputs[i].textContent = bands[name].toFixed(2);
      });
      if (now - textTime > 100) textTime = now;
      if (circle) circle.style.transform = `scale(${reduced ? 0.8 : 0.6 + bands.bass * 1.4})`;
      if (sculpture.current) sculpture.current.draw(reduced ? { bass: 0, mid: 0, high: 0, overall: 0 } : bands, time, active && !reduced ? delta : 0);
      if (element && ctx) {
        const dpr = Math.min(devicePixelRatio, 2);
        const w = Math.round(element.clientWidth * dpr), h = Math.round(element.clientHeight * dpr);
        if (element.width !== w || element.height !== h) { element.width = w; element.height = h; }
        ctx.clearRect(0, 0, w, h);
        ctx.strokeStyle = '#c8f080';
        ctx.fillStyle = '#c8f080';
        ctx.lineWidth = 2 * dpr;
        if (mode === 'microphone') {
          ctx.beginPath();
          const waveform = active && !reduced ? frame.waveform : null;
          const length = waveform?.length ?? 2;
          for (let i = 0; i < length; i++) {
            const x = (i / (length - 1)) * w;
            const y = waveform ? waveform[i] / 255 * h : h / 2;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.stroke();
        } else {
          const fft = active ? frame.fft : null;
          const count = fft?.length ?? 128;
          const step = w / count;
          for (let i = 0; i < count; i++) {
            const height = Math.max(2 * dpr, ((fft?.[i] ?? 0) / 255) * h * 0.9);
            ctx.fillRect(i * step, h - height, Math.max(1, step - dpr), height);
          }
        }
      }
      // Idle demos draw once. Reduced-motion data updates are limited to 5 Hz.
      if (active) raf = requestAnimationFrame(reduced ? tick : draw);
    }
    let lastTick = 0;
    function tick(now: number) {
      if (now - lastTick >= 200) { lastTick = now; draw(now); }
      else raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(draw);
    const resize = new ResizeObserver(() => { if (!active) { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); } });
    if (element) resize.observe(element);
    return () => { cancelAnimationFrame(raf); resize.disconnect(); };
  }, [mode, mic, active, snapshot, reduced]);

  async function toggle() {
    setError('');
    try {
      if (mic) { setMicPending(true); await audio.toggleMic(); }
      else await audio.togglePlayPause();
    } catch {
      setError(mic ? 'Microphone access failed. Allow microphone access in your browser settings, then try again.' : 'Playback was blocked. Press Play again to start the track.');
    } finally { setMicPending(false); }
  }

  return <div ref={root} className={`instrument instrument-${mode}`}>
    <div className="instrument-heading"><span className="eyebrow">{mic ? 'Microphone → waveform' : 'Audio → data → your idea'}</span><span className="live-status" role="status"><i className={active ? 'is-live' : ''} />{loading ? 'Loading track' : active ? 'Live input' : 'Ready when you are'}</span></div>
    <div className="instrument-stage">
      {mode === 'pulse' && <div className="pulse-wrap"><div className="pulse-circle" /><span>bass → scale</span></div>}
      {(mode === 'spectrum' || mode === 'microphone' || mode === 'three') && <canvas ref={canvas} aria-label={`${mode} audio visualization`} role="img" />}
      <div className="band-meters" aria-label="Audio band values from zero to one">
        {names.map((name, i) => <div className={`band band-${name}`} key={name}>
          <div className="meter-track"><div data-meter={name} className="meter-fill" /></div>
          <div className="band-label"><span>{name}</span><output data-value={name} aria-live="off" aria-label={`${name} energy`}>0.00</output></div>
          {mode === 'bands' && <span className="band-index">0{i + 1} / {['Low', 'Middle', 'High'][i]} energy</span>}
        </div>)}
      </div>
      <p className="demo-hint">{active ? (mic ? 'Your microphone stays on this device.' : 'Listening to the track. Reading its energy.') : mic ? 'Enable your microphone, then make some noise.' : 'Press Play. These are real audio values.'}</p>
    </div>
    {graphicsError && <p role="alert" className="error">{graphicsError} <a href="/examples/spectrum/">Open spectrum →</a></p>}
    <div className="transport">
      <button className="button primary" onClick={toggle} disabled={loading || micPending || (!mic && !audio.hasTrack)} aria-pressed={active}>{micPending ? 'Requesting access…' : loading ? 'Loading…' : active ? (mic ? 'Stop microphone' : 'Ⅱ Pause') : mic ? 'Enable microphone' : '▶ Play track'}</button>
      {!mic && <label className="track-label"><span className="sr-only">Demo track</span><select value={track} onChange={event => setTrack(Number(event.target.value))}>{tracks.map((item, i) => <option value={i} key={item.url}>{item.name}</option>)}</select></label>}
      {mic && <span className="transport-note">Permission required. Not recorded or sent to a server.</span>}
    </div>
    {error && <p role="alert" className="error">{error}</p>}
    {reduced && <p className="motion-note">Reduced motion: spatial animation is paused; meters update at 5 Hz.</p>}
  </div>;
}
