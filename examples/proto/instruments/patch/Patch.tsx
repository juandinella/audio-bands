import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Install, Knob, Manual, Screws } from '../shared';
import Preview from './Preview';
import { usePatchAudio } from './usePatchAudio';
import type { Source } from './usePatchAudio';
import { accepts, destinations, initialPatch, outputs, patchCode, presets, sourceFor } from './model';
import type { Output, PatchConfig, Preset, Scalar } from './model';
import renderer2d from './render2d.js?raw';
import renderer3d from './sculpture.js?raw';
import './patch.css';

function Copy({ text, label = 'Copy code' }: { text: string; label?: string }) {
  const [state, setState] = useState(label);
  useEffect(() => setState(label), [text, label]);
  async function copy() {
    try { await navigator.clipboard.writeText(text); setState('Copied ✓'); }
    catch { setState('Select text to copy'); }
  }
  return <button className="patch-copy" aria-label={label} onClick={copy}><span role="status">{state}</span></button>;
}

export default function Patch() {
  const [patch, setPatch] = useState<PatchConfig>(initialPatch);
  const [selected, setSelected] = useState<Output>('bass');
  const [manual, setManual] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [message, setMessage] = useState('Ready-made patch. Press Play, then try a different band.');
  const [reduced, setReduced] = useState(false);
  const [paths, setPaths] = useState<{ d: string; color: string }[]>([]);
  const bay = useRef<HTMLDivElement>(null);
  const meterBank = useRef<HTMLDivElement>(null);
  const audio = usePatchAudio();
  const visibleDestinations = destinations(patch.preset);
  const preset = presets.find(item => item.id === patch.preset)!;
  const code = patchCode(patch, audio.source);
  const renderer = patch.preset === 'sculpt' ? renderer3d : renderer2d;

  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    function update() { setReduced(query.matches); }
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (manual) return;
    const timer = setInterval(() => {
      const frame = audio.frame.current;
      for (const output of outputs) {
        const element = meterBank.current?.querySelector<HTMLOutputElement>(`[data-value="${output.id}"]`);
        if (!element) continue;
        const scalar = output.id === 'bass' || output.id === 'mid' || output.id === 'high';
        element.textContent = scalar ? frame.bands[output.id as Scalar].toFixed(2) : `${frame[output.id as 'fft' | 'waveform']?.length ?? 0} B`;
        if (scalar) element.style.setProperty('--level', String(frame.bands[output.id as Scalar]));
      }
    }, 100);
    return () => clearInterval(timer);
  }, [audio.frame, manual]);

  useLayoutEffect(() => {
    if (!bay.current) return;
    const element = bay.current;
    function measure() {
      const bounds = element.getBoundingClientRect();
      const next = destinations(patch.preset).map((destination, i) => {
        const source = sourceFor(destination.id, patch);
        const from = element.querySelector(`[data-port="${source}"]`)!.getBoundingClientRect();
        const to = element.querySelector(`[data-destination="${destination.id}"]`)!.getBoundingClientRect();
        const x1 = from.x - bounds.x + from.width / 2, y1 = from.y - bounds.y + from.height / 2;
        const x2 = to.x - bounds.x + to.width / 2, y2 = to.y - bounds.y + to.height / 2;
        const drop = 56 + i * 18;
        return { d: `M ${x1} ${y1} C ${x1 + 26} ${y1 + drop}, ${x2 - 30} ${y2 + drop}, ${x2} ${y2}`, color: outputs.find(output => output.id === source)!.color };
      });
      setPaths(next);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, [patch.preset, patch.routes, manual]);

  function choosePreset(id: Preset) {
    setPatch(previous => ({ ...previous, preset: id }));
    setSelected(id === 'draw' ? 'waveform' : id === 'spectrum' ? 'fft' : 'bass');
    setMessage(`${presets.find(item => item.id === id)!.label} loaded. ${id === 'draw' ? 'Waveform bytes are connected to the trace.' : id === 'spectrum' ? 'FFT frequency bins are connected to the bars.' : 'Pick a band output, then a destination to repatch.'}`);
  }
  function openManual(value: boolean) {
    audio.stop();
    setManual(value);
    window.scrollTo(0, 0);
  }
  function selectOutput(id: Output) {
    setSelected(id);
    if (id === 'fft' && patch.preset !== 'spectrum') setMessage('FFT is a frequency array. Choose the Spectrum preset to use it.');
    else if (id === 'waveform' && patch.preset !== 'draw') setMessage('Waveform is a time-domain array. Choose the Draw preset to use it.');
    else if (!visibleDestinations.some(destination => accepts(destination.type, id))) setMessage('This is a number from 0–1. Choose Pulse or Sculpt to connect a band.');
    else setMessage(`${outputs.find(output => output.id === id)!.label} selected. Click a matching destination.`);
  }

  return <div className="patch-study">
    <header className="study-header">
      <button className="study-brand" onClick={() => openManual(false)} aria-label="audio-bands instrument"><span className="brand-symbol" aria-hidden="true">∿</span>audio-bands<span className="brand-edition">PATCH / 03</span></button>
      <nav aria-label="Patch navigation"><button aria-current={!manual ? 'page' : undefined} onClick={() => openManual(false)}>Instrument</button><button aria-current={manual ? 'page' : undefined} onClick={() => openManual(true)}>Manual ↗</button><a href="https://github.com/juandinella/audio-bands" target="_blank" rel="noreferrer">GitHub ↗</a></nav>
    </header>
    {manual ? <><Manual /><div className="patch-manual-note"><h2>The instrument is a worked example.</h2><p>audio-bands supplies the data. Patch cables assign that data to a renderer. Amount multiplies visual influence; it does not change audio volume. The test sequence, CSS, Canvas and Three.js renderers belong to this demo.</p><p>Number ports accept bass, mid or high. The Draw and Spectrum ports accept different kinds of byte arrays. Their values are not interchangeable with a scalar.</p><button onClick={() => openManual(false)}>Return to your patch →</button></div></> : <main>
      <section className="patch-intro"><div><p className="micro">A SMALL LIBRARY. AN OPEN CIRCUIT.</p><h1>Sound goes in.<br /><span>Your idea comes out.</span></h1></div><div className="patch-intro-copy"><p>Turn music or a microphone into data.<br />Connect a signal. Make something move.</p><span className="micro">JAVASCRIPT · OPTIONAL REACT HOOK · MIT</span></div></section>

      <section className="patch-case" aria-label="Audio to visual patch instrument">
        <Screws />
        <div className="patch-case-label"><span><b>ab.</b><span>signal translator<br /><strong>MODEL P—03</strong></span></span><span className="patch-power"><i data-on={audio.active} />{audio.active ? 'SIGNAL PRESENT' : 'AWAITING INPUT'}</span></div>
        <div className="patch-modules">
          <section className="patch-input-module">
            <div className="patch-module-heading"><span>01 / INPUT</span><h2>Listen.</h2></div>
            <div className="patch-input-art" aria-hidden="true"><span>∿</span><div /><div /><div /><div /><div /><div /></div>
            <label className="patch-source"><span>SOURCE</span><select aria-label="Input source" value={audio.source} onChange={event => audio.setSource(event.target.value as Source)}><option value="sequence">Test sequence</option><option value="music">Music track</option><option value="mic">Microphone</option></select></label>
            <p className="patch-source-note">{audio.source === 'sequence' ? 'A quiet oscillator phrase, generated by this demo.' : audio.source === 'music' ? 'Maple Leaf Rag / Scott Joplin. A same-origin audio file.' : 'Permission required. Input stays on your device.'}</p>
            <button className="patch-play" onClick={audio.toggle} disabled={!audio.ready || audio.busy} aria-pressed={audio.active}><span aria-hidden="true">{audio.active ? 'Ⅱ' : '▶'}</span>{audio.busy ? (audio.source === 'mic' ? 'Requesting…' : 'Starting…') : !audio.ready ? 'Loading…' : audio.active ? (audio.source === 'mic' ? 'Stop mic' : 'Pause') : audio.source === 'mic' ? 'Enable mic' : 'Play'}</button>
            <span className="patch-input-foot">{audio.source === 'mic' ? 'LIVE INPUT / NO SPEAKER FEEDBACK' : 'PRESS PLAY TO HEAR THE INPUT'}</span>
          </section>

          <section className="patch-signal-module">
            <div className="patch-module-heading"><span>02 / ANALYSIS → MAPPING</span><h2>Connect.</h2></div>
            <div className="typed-bay" ref={bay}>
              <svg className="typed-cables" aria-hidden="true">{paths.map((path, i) => <g key={i}><path d={path.d} stroke="#0004" strokeWidth="10" transform="translate(0 3)" /><path d={path.d} stroke={path.color} strokeWidth="7" /><path d={path.d} stroke="#ffffff44" strokeWidth="1.5" transform="translate(-1 -1)" /></g>)}</svg>
              <div className="patch-output-bank" ref={meterBank}><span className="port-bank-label">LIBRARY OUTPUTS</span>{outputs.map(output => <button key={output.id} className="typed-output" aria-label={`Select ${output.label} output`} aria-pressed={selected === output.id} onClick={() => selectOutput(output.id)} style={{ '--port-color': output.color } as CSSProperties}>
                <span className="output-caption"><b>{output.label}</b><small>{output.kind}</small><output data-value={output.id} aria-live="off" aria-label={`${output.label} value`}>{output.id === 'fft' ? '256 B' : output.id === 'waveform' ? '512 B' : '0.00'}</output></span><i className={`typed-socket ${output.id === 'fft' || output.id === 'waveform' ? 'array-socket' : ''}`} data-port={output.id} />
              </button>)}</div>
              <div className="patch-destination-bank"><span className="port-bank-label">YOUR RENDERER</span>{visibleDestinations.map(destination => {
                const source = sourceFor(destination.id, patch);
                const compatible = accepts(destination.type, selected);
                return <button key={destination.id} className="typed-destination" aria-label={`Connect ${selected} to ${destination.label}`} disabled={!compatible} style={{ '--port-color': outputs.find(output => output.id === source)!.color } as CSSProperties} onClick={() => {
                  if (!compatible) return;
                  if (destination.type === 'scalar') setPatch(previous => ({ ...previous, routes: { ...previous.routes, [destination.id]: selected as Scalar } }));
                  setMessage(`${selected} → ${destination.label}. The visual and code now use this connection.`);
                }}><i className={`typed-socket ${destination.type !== 'scalar' ? 'array-socket' : ''}`} data-destination={destination.id} /><span><b>{destination.label}</b><small>{destination.type === 'scalar' ? 'number' : destination.type === 'fft' ? 'frequency bytes' : 'time bytes'}</small></span></button>;
              })}<div className="patch-port-legend"><span>○ number</span><span>□ byte array</span></div></div>
            </div>
            <div className="patch-bank-footer"><span>audio-bands</span><span>your code →</span></div>
          </section>

          <section className="patch-render-module">
            <div className="patch-module-heading"><span>03 / OUTPUT</span><h2>Make something.</h2></div>
            <Preview key={patch.preset} patch={patch} audio={audio} reduced={reduced} />
            <div className="patch-output-controls"><div><span className="port-bank-label">PATCH PRESETS</span><div className="patch-preset-keys" role="group" aria-label="Patch presets">{presets.map((item, index) => <button key={item.id} aria-pressed={patch.preset === item.id} onClick={() => choosePreset(item.id)}><span aria-hidden="true">{item.symbol}</span><b>{item.label}</b><small>0{index + 1}</small></button>)}</div></div><Knob label="Amount" value={patch.amount} min={0} max={2} step={0.05} unit="×" onChange={amount => setPatch(previous => ({ ...previous, amount }))} /></div>
            <div className="patch-output-caption"><span>{preset.description}</span><span>Amount = visual influence</span></div>
          </section>
        </div>
        <div className="patch-machine-footer"><p role="status">{message}</p><button onClick={() => { setPatch(previous => ({ ...initialPatch, preset: previous.preset })); setSelected(patch.preset === 'draw' ? 'waveform' : patch.preset === 'spectrum' ? 'fft' : 'bass'); setMessage('Default connections restored.'); }}>Reset patch ↺</button></div>
      </section>
      {audio.error && <p className="proto-error" role="alert">{audio.error}</p>}
      {reduced && <p className="patch-accessibility-note">Reduced motion: the visual is at rest. Audio meters still update.</p>}
      <div className="patch-under-machine"><span>FIG. 03 — AUDIO → DATA → YOUR RENDERER</span><button aria-expanded={showCode} aria-controls="patch-code" onClick={() => setShowCode(!showCode)}>{showCode ? 'Hide' : 'See'} the code behind this patch <span aria-hidden="true">{showCode ? '−' : '+'}</span></button></div>

      {showCode && <section id="patch-code" className="patch-code-panel"><div className="patch-code-intro"><p className="micro">THE CONNECTION, TRANSLATED.</p><h2>This is your patch.</h2><p>Change a cable or turn Amount. The code updates with the instrument.</p><p className="patch-code-disclaimer">Animation-loop excerpt. <a href="/docs/#start" target="_blank" rel="noreferrer">Get the complete audio setup ↗</a></p><div className="patch-contract">{patch.preset === 'draw' || patch.preset === 'spectrum' ? <><b>Uint8Array · values 0–255</b><span>{patch.preset === 'draw' ? 'Time-domain samples. Silence is centered at 128.' : 'Frequency bins. Normalize each byte by 255.'}</span></> : <><b>number · range 0–1</b><span>Normalized analyser regions, not fixed Hz bands.</span></>}</div></div><div className="patch-code-body"><div className="patch-code-heading"><span>{preset.label.toLowerCase()}.js / animation loop</span><Copy text={code} /></div><pre><code>{code}</code></pre>{patch.preset !== 'pulse' && <details className="patch-renderer-source"><summary>Renderer implementation · used by this demo</summary><div className="patch-code-heading"><span>{patch.preset === 'sculpt' ? 'npm install three · createSculpture(canvas)' : 'Canvas drawing helpers'}</span><Copy text={renderer} label="Copy renderer" /></div><pre><code>{renderer}</code></pre></details>}</div></section>}

      <section className="patch-explainer"><div><p className="micro">THE LIBRARY IS THE SMALL PART.</p><h2>We read the sound.<br />You decide what it does.</h2><p>The instrument is one example. Use the same data to animate a button, draw a waveform or build your own Three.js scene.</p></div><div><Install /><div className="bottom-links"><button onClick={() => openManual(true)}>Read the operator’s manual ↗</button><a href="/examples/" target="_blank" rel="noreferrer">Explore examples ↗</a></div><p className="patch-boundary">Analysis and playback by <b>audio-bands</b>.<br />Test sequence, connections and renderers by this demo.</p></div></section>
    </main>}
    <footer className="study-footer"><span>audio-bands / Juan Di Nella</span><span>Study 03 — An instrument and its manual</span></footer>
  </div>;
}
