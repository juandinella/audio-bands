import { useLayoutEffect, useRef, useState } from 'react';
import type { Band } from './audio';
import { useInstrument } from './audio';
import { Header, Install, Knob, Manual, Play, Screen, Screws, ShapeKeys, Source } from './shared';

const bandNames: Band[] = ['bass', 'mid', 'high'];
const destinations = ['size', 'fold', 'spin'] as const;
const colors = { bass: '#e9713d', mid: '#91bce6', high: '#dac95a' };

export default function Modular() {
  const [manual, setManual] = useState(false);
  const [selected, setSelected] = useState<Band>('bass');
  const [paths, setPaths] = useState<{ path: string; color: string }[]>([]);
  const patch = useRef<HTMLDivElement>(null);
  const instrument = useInstrument();
  function openManual(value: boolean) { instrument.instance.current?.pause(); setManual(value); window.scrollTo(0, 0); }

  useLayoutEffect(() => {
    if (!patch.current) return;
    const element = patch.current;
    function measure() {
      const box = element.getBoundingClientRect();
      setPaths(destinations.map((destination, i) => {
        const from = element.querySelector(`[data-jack="${instrument.routing[destination]}"]`)!.getBoundingClientRect();
        const to = element.querySelector(`[data-jack="${destination}"]`)!.getBoundingClientRect();
        const x1 = from.x - box.x + from.width / 2, y1 = from.y - box.y + from.height / 2;
        const x2 = to.x - box.x + to.width / 2, y2 = to.y - box.y + to.height / 2;
        return { path: `M ${x1} ${y1} C ${x1 + 30} ${y1 + 110 + i * 15}, ${x2 - 35} ${y2 + 110}, ${x2} ${y2}`, color: colors[instrument.routing[destination]] };
      }));
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, [instrument.routing, manual]);

  return <div className="modular-study">
    <Header manual={manual} setManual={openManual} modular />
    {manual ? <Manual modular /> : <main>
      <div className="modular-intro"><div><p className="micro">AUDIO-BANDS / AN OPEN SYSTEM FOR PLAY</p><h1>Patch sound<br />into <em>anything.</em></h1></div><div><p>Three signals. Infinite connections.<br />A headless audio analysis library<br />for the things you haven’t made yet.</p><span className="rack-stamp">INPUT → ANALYSIS → POSSIBILITY</span></div></div>
      <section className="rack" aria-label="Modular audio instrument">
        <div className="rack-rail"><span>AB / SYSTEM 02</span><span>48 HP — BROWSER EDITION</span><span className="rack-led">● {instrument.playing ? 'RUNNING' : 'READY'}</span></div>
        <div className="rack-modules">
          <div className="rack-module input-module"><Screws /><div className="module-title"><span>01 / SOURCE</span><h2>Signal in.</h2></div><div className="input-symbol" aria-hidden="true">∿</div><Source instrument={instrument} /><Knob label="Sensitivity" min={0.5} max={3} step={0.05} value={instrument.gain} onChange={instrument.setGain} unit="×" /><Play instrument={instrument} /><span className="module-foot">AUDIO INPUT / MONO TEST SEQUENCE</span></div>
          <div className="rack-module patch-module"><Screws /><div className="module-title"><span>02 / ROUTING</span><h2>Make a connection.</h2></div><p className="patch-help">Pick a band. Then pick what it moves.</p><div className="patch-bay" ref={patch}>
            <svg className="patch-cables" aria-hidden="true"><g>{paths.map((cable, i) => <g key={i}><path d={cable.path} stroke="#0005" strokeWidth="10" transform="translate(0 3)" /><path d={cable.path} stroke={cable.color} strokeWidth="7" /><path d={cable.path} stroke="#ffffff44" strokeWidth="1" transform="translate(-1 -1)" /></g>)}</g></svg>
            <div className="jack-column"><span className="micro">OUTPUT</span>{bandNames.map(band => <button key={band} className="jack-button" onClick={() => setSelected(band)} aria-pressed={selected === band} aria-label={`Select ${band} output`}><span data-jack={band} className="jack-socket" style={{ '--jack-color': colors[band] } as React.CSSProperties} /><span>{band}</span></button>)}</div>
            <div className="jack-column"><span className="micro">DESTINATION</span>{destinations.map(destination => <button key={destination} className="jack-button" onClick={() => instrument.setRouting({ ...instrument.routing, [destination]: selected })} aria-label={`Connect ${selected} to ${destination}`}><span data-jack={destination} className="jack-socket" style={{ '--jack-color': colors[instrument.routing[destination]] } as React.CSSProperties} /><span>{destination}</span></button>)}</div>
          </div><p className="patch-status" role="status">{destinations.map(destination => `${instrument.routing[destination]} → ${destination}`).join(' / ')}</p><button className="reset-patch" onClick={() => instrument.setRouting({ size: 'bass', fold: 'mid', spin: 'high' })}>Reset patch ↺</button></div>
          <div className="rack-module output-module"><Screws /><div className="module-title"><span>03 / OUTPUT</span><h2>Something happens.</h2></div><Screen instrument={instrument} theme="modular" /><ShapeKeys instrument={instrument} /><label className="persistence-control">Persistence <input type="range" min="0" max="0.92" step="0.01" value={instrument.trail} onChange={event => instrument.setTrail(Number(event.target.value))} /><output>{instrument.trail.toFixed(2)}</output></label></div>
        </div><div className="rack-rail bottom-rail"><span>NO RENDERER INCLUDED. NO WRONG CONNECTIONS.</span><span>DESIGNED IN THE BROWSER ↗</span></div>
      </section>
      {instrument.error && <p className="proto-error" role="alert">{instrument.error}</p>}
      <div className="rack-caption"><span>FIG. 01 — A SOUND-TO-SHAPE PATCH</span><span>All connections are live. Rewire freely.</span></div>
      <section className="modular-bottom"><div><p className="micro">THE PATCH IS YOURS.</p><h2>We read the sound.<br />You decide what follows.</h2></div><div><p>Normalized bands, raw FFT and waveform data. Plug them into your own renderer, one connection at a time.</p><Install /><button className="manual-link" onClick={() => openManual(true)}>Read the operator’s manual →</button></div></section>
    </main>}
    <footer className="study-footer"><span>audio-bands / by Juan Di Nella</span><span>Exploration 02 — Modular laboratory</span></footer>
  </div>;
}
