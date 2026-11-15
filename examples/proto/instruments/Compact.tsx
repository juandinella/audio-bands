import { useState } from 'react';
import { useInstrument } from './audio';
import { Header, Install, Knob, Manual, Play, Screen, Screws, ShapeKeys, Source } from './shared';

export default function Compact() {
  const [manual, setManual] = useState(false);
  const instrument = useInstrument();
  function openManual(value: boolean) { instrument.instance.current?.pause(); setManual(value); window.scrollTo(0, 0); }
  return <div className="compact-study">
    <Header manual={manual} setManual={openManual} />
    {manual ? <Manual /> : <main>
      <div className="pocket-intro"><div><p className="micro">SMALL LIBRARY. BIG FEELINGS.</p><h1>A little sound.<br /><span>A lot of possibility.</span></h1></div><div className="pocket-description"><p>Music in. Numbers out.<br />Make anything move with a tiny<br className="desktop-break" /> audio analysis library.</p><a href="#pocket">Go on, press play <span>↘</span></a></div></div>
      <section className="pocket-stage" id="pocket" aria-label="Pocket audio instrument">
        <div className="pocket-annotation annotation-left">a signal you can see <span>⤵</span></div>
        <div className="pocket-device">
          <Screws />
          <div className="device-brand"><span><b>ab.</b> <span>pocket signal machine</span></span><span className="device-model">AB—01 <i /></span></div>
          <div className="device-body"><div className="speaker-grille" aria-hidden="true" /><Screen instrument={instrument} /><div className="device-controls"><Knob label="Sensitivity" min={0.5} max={3} step={0.05} value={instrument.gain} onChange={instrument.setGain} unit="×" /><Knob label="Afterglow" min={0} max={0.92} step={0.01} value={instrument.trail} onChange={instrument.setTrail} color="cream" /></div></div>
          <div className="device-bottom"><div className="preset-group"><span className="micro">MAKE IT LOOK LIKE</span><ShapeKeys instrument={instrument} /></div><div className="pocket-transport"><Source instrument={instrument} /><div className="transport-row"><button className="hold-key" aria-pressed={instrument.frozen} onClick={() => instrument.setFrozen(!instrument.frozen)}>{instrument.frozen ? 'Release' : 'Hold'}</button><Play instrument={instrument} /></div></div></div>
          <div className="device-footer"><span>HEADLESS AUDIO ANALYSIS</span><span>DESIGNED TO BE PLAYED WITH.</span><span>0.00 — 1.00</span></div>
        </div>
        <div className="pocket-annotation annotation-right">tiny knobs, real consequences <span>↖</span></div>
      </section>
      <div className="instrument-notes"><span role="status">{instrument.playing ? '● Listening. Try a different shape.' : '○ Sound starts when you press Play.'}</span><span>Headphones optional. Curiosity required.</span></div>
      {instrument.error && <p className="proto-error" role="alert">{instrument.error}</p>}
      <section className="pocket-bottom"><div><p className="micro">THE MAGIC IS JUST THREE NUMBERS.</p><h2>You bring the idea.<br />We’ll bring the signal.</h2><p>Bass, mid and high. Ready for CSS, Canvas, Three.js or whatever you’re thinking of.</p></div><div><Install /><div className="bottom-links"><button onClick={() => openManual(true)}>Open the manual ↗</button><a href="/examples/" target="_blank">Five working examples ↗</a></div><span className="micro">VANILLA JS · OPTIONAL REACT HOOK · MIT LICENSE</span></div></section>
    </main>}
    <footer className="study-footer"><span>audio-bands / by Juan Di Nella</span><span>Exploration 01 — Pocket instrument</span></footer>
  </div>;
}
