import { useEffect, useRef, useState } from 'react';
import type { Instrument } from './audio';

export function Header({ manual, setManual, modular = false }: { manual: boolean; setManual: (value: boolean) => void; modular?: boolean }) {
  return <header className="study-header">
    <button className="study-brand" onClick={() => setManual(false)} aria-label="audio-bands instrument"><span className="brand-symbol" aria-hidden="true">∿</span>audio-bands<span className="brand-edition">{modular ? 'MODULAR / 02' : 'POCKET / 01'}</span></button>
    <nav aria-label="Study navigation"><button aria-current={!manual ? 'page' : undefined} onClick={() => setManual(false)}>Instrument</button><button aria-current={manual ? 'page' : undefined} onClick={() => setManual(true)}>Manual <span aria-hidden="true">↗</span></button><a href="https://github.com/juandinella/audio-bands" target="_blank" rel="noreferrer">GitHub ↗</a></nav>
  </header>;
}

export function Knob({ label, value, min, max, step, onChange, unit = '', color = 'orange' }: { label: string; value: number; min: number; max: number; step: number; onChange: (n: number) => void; unit?: string; color?: string }) {
  const drag = useRef<{ y: number; value: number } | null>(null);
  const angle = -135 + ((value - min) / (max - min)) * 270;
  return <label className={`knob-control knob-${color}`} data-instrument-control>
    <span className="knob-label">{label}</span>
    <span className="knob-face" aria-hidden="true"
      onPointerDown={event => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { y: event.clientY, value };
      }}
      onPointerMove={event => {
        if (!drag.current) return;
        const next = drag.current.value + (drag.current.y - event.clientY) / 130 * (max - min);
        onChange(Math.min(max, Math.max(min, Math.round(next / step) * step)));
      }}
      onPointerUp={() => { drag.current = null; }}
      onPointerCancel={() => { drag.current = null; }}
    ><span className="knob-dial" style={{ transform: `rotate(${angle}deg)` }}><i /></span></span>
    <input type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={event => onChange(Number(event.target.value))} />
    <output>{value.toFixed(2)}{unit}</output>
  </label>;
}

export function Screen({ instrument, theme = 'pocket' }: { instrument: Instrument; theme?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const outputs = useRef<HTMLDivElement>(null);
  const config = useRef(instrument);
  config.current = instrument;
  useEffect(() => {
    const element = canvas.current!;
    const ctx = element.getContext('2d')!;
    const values = [...outputs.current!.querySelectorAll<HTMLOutputElement>('output')];
    let raf = 0, last = 0, textAt = 0, time = 0;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const bg = theme === 'pocket' ? '#202c2d' : '#0c211b';
    const color = theme === 'pocket' ? '#caf6c3' : '#a6f48d';
    function draw(now: number) {
      const state = config.current;
      const dpr = Math.min(devicePixelRatio, 2);
      const width = Math.round(element.clientWidth * dpr), height = Math.round(element.clientHeight * dpr);
      const resized = element.width !== width || element.height !== height;
      if (resized) { element.width = width; element.height = height; }
      const step = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (!state.frozen && !document.hidden) {
        const bands = state.playing ? state.instance.current?.getBands() : { bass: 0, mid: 0, high: 0, overall: 0 };
        if (bands) {
          if (now - textAt > 100) {
            ['bass', 'mid', 'high'].forEach((name, i) => { values[i].textContent = bands[name as 'bass' | 'mid' | 'high'].toFixed(2); });
            textAt = now;
          }
          if (!reduced.matches || now - textAt < 5 || resized) {
            if (state.playing && !reduced.matches) time += step;
            ctx.globalAlpha = reduced.matches || !state.playing || resized ? 1 : 1 - state.trail * 0.88;
            ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height); ctx.globalAlpha = 1;
            ctx.strokeStyle = theme === 'pocket' ? '#354543' : '#1b3a2c';
            ctx.lineWidth = dpr * 0.6;
            ctx.beginPath();
            for (let x = 0; x <= width; x += 28 * dpr) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
            for (let y = 0; y <= height; y += 28 * dpr) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
            ctx.stroke();
            const size = (reduced.matches ? 0.2 : bands[state.routing.size]) * state.gain;
            const fold = (reduced.matches ? 0.2 : bands[state.routing.fold]) * state.gain;
            const spin = (reduced.matches ? 0.2 : bands[state.routing.spin]) * state.gain;
            ctx.strokeStyle = color; ctx.lineWidth = 1.6 * dpr;
            ctx.beginPath();
            for (let i = 0; i <= 640; i++) {
              const p = i / 640 * Math.PI * 2;
              let x = 0, y = 0;
              if (state.shape === 'orbit') {
                const r = Math.min(width, height) * (0.24 + Math.min(size, 1.5) * 0.1);
                const modulation = 1 + Math.sin(p * 6 + time) * Math.min(fold, 1) * 0.3;
                x = Math.cos(p + time * 0.18) * r * modulation;
                y = Math.sin(p + time * 0.18) * r * modulation * (0.7 + spin * 0.2);
              } else if (state.shape === 'ribbon') {
                x = Math.sin(p * 3 + time * 0.2) * width * 0.35;
                y = Math.sin(p * 2 + fold * 2 + time * 0.13) * height * (0.14 + Math.min(size, 1.5) * 0.12);
              } else {
                x = (i / 640 - 0.5) * width * 0.87;
                y = Math.sin(p * (3 + fold * 4) + time * 2) * Math.sin(p / 2) * height * (0.1 + Math.min(size, 1.5) * 0.13);
              }
              const angle = spin * 0.5;
              const px = width / 2 + x * Math.cos(angle) - y * Math.sin(angle);
              const py = height / 2 + x * Math.sin(angle) + y * Math.cos(angle);
              if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [theme]);
  return <div className={`scope-screen scope-${theme}`}>
    <div className="scope-top"><span>XY / {instrument.shape.toUpperCase()}</span><span className={instrument.playing ? 'signal-live' : ''}>● {instrument.frozen ? 'HOLD' : instrument.playing ? 'SIGNAL' : 'STANDBY'}</span></div>
    <canvas ref={canvas} aria-label="Audio-reactive oscilloscope illustration" role="img" />
    <div className="scope-readings" ref={outputs}>{['bass', 'mid', 'high'].map((band, index) => <span key={band}><i>{['L', 'M', 'H'][index]}</i><span>{band}</span><output aria-label={`${band} energy`} aria-live="off">0.00</output></span>)}</div>
  </div>;
}

export function Source({ instrument }: { instrument: Instrument }) {
  return <label className="source-control"><span>Audio source</span><select value={instrument.source} onChange={event => instrument.setSource(event.target.value)}><option value="sequence">01 — Oscillator sequence</option><option value="music">02 — Maple Leaf Rag / Scott Joplin</option></select></label>;
}

export function ShapeKeys({ instrument }: { instrument: Instrument }) {
  return <div className="shape-keys" role="group" aria-label="Visual presets">{['orbit', 'ribbon', 'wave'].map((shape, index) => <button key={shape} aria-pressed={instrument.shape === shape} onClick={() => instrument.setShape(shape)}><span aria-hidden="true">{['◎', '⋈', '∿'][index]}</span><small>{shape}</small></button>)}</div>;
}

export function Play({ instrument }: { instrument: Instrument }) {
  return <button className="transport-play" onClick={instrument.toggle} disabled={!instrument.ready} aria-pressed={instrument.playing}><span aria-hidden="true">{instrument.playing ? 'Ⅱ' : '▶'}</span>{!instrument.ready ? 'Loading' : instrument.playing ? 'Pause' : 'Play'}</button>;
}

export function Install() {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText('npm install @juandinella/audio-bands'); setCopied(true); }
    catch { setError(true); }
  }
  return <div className="install-strip"><code>npm install @juandinella/audio-bands</code><button onClick={copy}>{copied ? 'Copied ✓' : 'Copy ↗'}</button>{error && <span role="status">Select the command to copy it manually.</span>}</div>;
}

export function Screws() {
  return <div className="screws" aria-hidden="true">{[0, 1, 2, 3].map(n => <i key={n} />)}</div>;
}

export function Manual({ modular }: { modular?: boolean }) {
  return <main className={`manual-preview ${modular ? 'manual-modular' : ''}`}>
    <aside><p className="micro">OPERATOR’S MANUAL</p><a href="#introduction">01 — Introduction</a><a href="#installation">02 — Installation</a><a href="#reading">03 — Reading a signal</a><a href="/docs/#api" target="_blank">Full API reference ↗</a><a href="/examples/" target="_blank">Working examples ↗</a></aside>
    <article><div className="manual-label"><span>audio-bands</span><span>REFERENCE / 001</span></div><section id="introduction"><p className="micro">GETTING STARTED</p><h1>Sound, in numbers.</h1><p>audio-bands is a small JavaScript library for browser audio analysis. It turns a track or microphone input into values you can use in any renderer.</p><div className="manual-diagram"><span>Audio input</span><b>→</b><span>Analysis</span><b>→</b><span>Your renderer</span></div></section><section id="installation"><h2>Installation</h2><p>Use the core with vanilla JavaScript, or the optional React hook.</p><Install /></section><section id="reading"><h2>Reading a signal</h2><p>Read a coherent frame inside your animation loop. The three bands are normalized from 0 to 1.</p><pre><code>{`const { bands } = audio.snapshot();\n\nconst { bass, mid, high } = bands;\ncircle.scale.setScalar(1 + bass);`}</code></pre><p className="manual-note">These are regions of the analyser spectrum, not fixed frequency ranges in Hz. You decide how each value maps to a visual.</p><a className="manual-next" href="/docs/" target="_blank">Continue to the complete documentation →</a></section></article>
  </main>;
}
