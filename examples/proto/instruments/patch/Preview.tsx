import { useEffect, useRef, useState } from 'react';
import { readControls, presets } from './model';
import type { PatchConfig } from './model';
import { silence } from './usePatchAudio';
import type { PatchAudio } from './usePatchAudio';
import { drawWaveform, drawSpectrum } from './render2d';

export default function Preview({ patch, audio, reduced }: { patch: PatchConfig; audio: PatchAudio; reduced: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const circle = useRef<HTMLDivElement>(null);
  const current = useRef({ patch, audio, reduced });
  current.current = { patch, audio, reduced };
  const [error, setError] = useState('');
  const [graphicsReady, setGraphicsReady] = useState(patch.preset !== 'sculpt');

  useEffect(() => {
    let alive = true, raf = 0, time = 0, previous = 0, sampled = 0;
    let scene: { draw: (values: { scale: number; warp: number; spin: number }, time: number) => void; dispose: () => void } | null = null;
    const element = canvas.current;
    const context = patch.preset === 'draw' || patch.preset === 'spectrum' ? element!.getContext('2d')! : null;
    if (patch.preset === 'sculpt') {
      import('./sculpture').then(({ createSculpture }) => {
        if (!alive) return;
        scene = createSculpture(element!);
        setGraphicsReady(true);
      }).catch(() => {
        if (alive) setError('WebGL could not start. Choose Pulse, Draw or Spectrum to continue.');
      });
    }
    function draw(now: number) {
      const state = current.current;
      const delta = previous ? Math.min((now - previous) / 1000, 0.05) : 0;
      previous = now;
      if (!document.hidden && (!state.reduced || now - sampled >= 200)) {
        sampled = now;
        const frame = state.audio.active ? state.audio.audio.current?.snapshot(state.audio.source === 'mic' ? 'mic' : 'music') ?? silence : silence;
        state.audio.frame.current = frame;
        const visualFrame = state.reduced ? silence : frame;
        const controls = readControls(visualFrame, state.patch);
        if (state.audio.active && !state.reduced) time += delta;
        if (circle.current) circle.current.style.transform = `scale(${0.65 + controls.scale})`;
        if (scene) scene.draw(controls, time);
        if (context && element) {
          const dpr = Math.min(devicePixelRatio, 2);
          const width = Math.round(element.clientWidth * dpr), height = Math.round(element.clientHeight * dpr);
          if (element.width !== width || element.height !== height) { element.width = width; element.height = height; }
          if (state.patch.preset === 'draw') drawWaveform(context, visualFrame.waveform ?? silence.waveform!, state.patch.amount);
          else drawSpectrum(context, visualFrame.fft ?? silence.fft!, state.patch.amount);
        }
      }
      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);
    return () => { alive = false; cancelAnimationFrame(raf); scene?.dispose(); };
  }, [patch.preset]);

  return <div className="patch-screen">
    <div className="patch-screen-top"><span>{presets.find(preset => preset.id === patch.preset)!.tech}</span><span>{audio.active ? '● LIVE' : '○ STANDBY'}</span></div>
    <div className="patch-viewport">
      {patch.preset === 'pulse' ? <div className="pulse-target" ref={circle} role="img" aria-label="Circle scaled by the connected audio band"><span /><span /></div> : <canvas ref={canvas} role="img" aria-label={`${patch.preset} visualization driven by the connected audio data`} />}
      {!graphicsReady && !error && <span className="graphics-status" role="status">Loading Three.js…</span>}
      {error && <span className="graphics-status" role="alert">{error}</span>}
    </div>
    <div className="patch-screen-bottom"><span>AB / SIGNAL MONITOR</span><span>{reduced ? 'REDUCED MOTION' : 'REAL INPUT · LIVE MAPPING'}</span></div>
  </div>;
}
