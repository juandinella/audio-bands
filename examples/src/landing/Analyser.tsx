import { useEffect, useRef, useState } from 'react';
import { Device } from './kit/ui/device';
import { Display } from './kit/ui/display';
import { BarGraph } from './kit/ui/bar-graph';
import { Button } from './kit/ui/button';
import { Lcd, LcdDigits } from './kit/ui/lcd';
import { Segmented } from './kit/ui/segmented-control';
import { SlideSwitch } from './kit/ui/slide-switch';
import {
  crossovers,
  effectiveHz,
  formatHz,
  knobEdges,
  install,
  resolutions,
  responses,
  tracks,
  useDeck,
  useFrame,
  type Input,
  type Resolution,
  type Response,
} from './deck';
import { CrossoverKnob, PlayPauseIcon, SkipIcon, VuMeter, drawScope, logColumns, logPosition, columnCentreHz, vuAngle } from './parts';

const RTA_COLUMNS = 48;

// A print on the panel naming the part of the API a section drives or shows.
function Api({ children }: { children: string }) {
  return <code className="ab-api">{children}</code>;
}

// Indicators print their name and API on one line above the window;
// controls print the API under the part, like a legend.
function Section({
  title,
  api,
  className,
  meter,
  children,
}: {
  title: string;
  api: string;
  className?: string;
  meter?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={`ab-section ${meter ? 'ab-meter' : 'ab-control'} ${className ?? ''}`} aria-label={title}>
      <div className="ab-section-head">
        <h2 className="ab-section-title">{title}</h2>
        {meter && <Api>{api}</Api>}
      </div>
      <div className="ab-section-body">{children}</div>
      {!meter && <Api>{api}</Api>}
    </section>
  );
}

// Fixed-width numbers, so a printed value never moves the panel.
const fixed = (value: number | string, width: number) => String(value).padStart(width, '\u2007');

function CopyInstall() {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef(0);
  const code = useRef<HTMLElement>(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const settle = (next: 'copied' | 'failed') => {
    setState(next);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState('idle'), next === 'copied' ? 1500 : 4000);
  };
  return (
    <div className="ab-install">
      <code ref={code}>{install}</code>
      <Button
        onClick={() => {
          navigator.clipboard
            .writeText(install)
            .then(() => settle('copied'))
            .catch(() => {
              // Clipboard blocked: select the command so a manual copy is one keystroke.
              if (code.current) getSelection()?.selectAllChildren(code.current);
              settle('failed');
            });
        }}
      >
        <span aria-live="polite">{state === 'copied' ? 'Copied' : state === 'failed' ? 'Selected' : 'Copy'}</span>
      </Button>
    </div>
  );
}

export default function Analyser() {
  const deck = useDeck();
  const ladders = useRef<HTMLDivElement>(null);
  const rta = useRef<HTMLDivElement>(null);
  const scope = useRef<HTMLCanvasElement>(null);
  const needle = useRef<SVGGElement>(null);
  const readouts = useRef<HTMLDListElement>(null);
  const lastText = useRef(0);
  const lastSlow = useRef(0);
  const latestNyquist = useRef(deck.nyquist);
  latestNyquist.current = deck.nyquist;

  // The meters' nodes and the scope colours, read once rather than every frame.
  const nodes = useRef<{ ladders: HTMLElement[]; rta: HTMLElement[]; dds: HTMLElement[]; trace: string; grid: string } | null>(null);
  useEffect(() => {
    const style = scope.current ? getComputedStyle(scope.current) : null;
    nodes.current = {
      ladders: [...(ladders.current?.querySelectorAll<HTMLElement>('[data-kit="bar-graph-bar"]') ?? [])],
      rta: [...(rta.current?.querySelectorAll<HTMLElement>('[data-kit="bar-graph-bar"]') ?? [])],
      dds: [...(readouts.current?.querySelectorAll<HTMLElement>('dd') ?? [])],
      trace: style?.color ?? '#fff',
      grid: style?.getPropertyValue('--scope-grid').trim() || 'rgb(255 255 255 / 0.1)',
    };
  }, []);

  useFrame(deck, (frame, now) => {
    // Reduced motion: readings still update, four times a second.
    if (deck.reduced && now - lastSlow.current < 250) return;
    lastSlow.current = now;
    const n = nodes.current;
    if (!n) return;
    const { bass, mid, high, overall } = frame.bands;
    const levels = [bass, mid, high];
    n.ladders.forEach((bar, i) => bar.style.setProperty('--v', String(levels[i])));
    const cols = logColumns(frame.fft, RTA_COLUMNS, latestNyquist.current);
    n.rta.forEach((bar, i) => bar.style.setProperty('--v', String(cols[i])));
    if (needle.current) needle.current.style.transform = `rotate(${vuAngle(overall)}deg)`;
    if (scope.current) drawScope(scope.current, frame.waveform, n.trace, n.grid);
    if (now - lastText.current > 100) {
      lastText.current = now;
      n.dds.forEach((dd, i) => (dd.textContent = levels[i].toFixed(2)));
    }
  });

  const lowFrac = deck.xLow / deck.nyquist;
  const highFrac = deck.xHigh / deck.nyquist;

  // The edges the library actually uses, snapped to whole bins.
  const lowHz = effectiveHz(lowFrac, deck.bins, deck.nyquist);
  const highHz = effectiveHz(highFrac, deck.bins, deck.nyquist);
  const lowEdge = formatHz(lowHz);
  const highEdge = formatHz(highHz);

  // Each spectrum column belongs to the band its centre frequency falls in,
  // so the matrix is coloured by band and the crossover visibly moves the split.
  useEffect(() => {
    rta.current?.querySelectorAll<HTMLElement>('[data-kit="bar-graph-bar"]').forEach((bar, i) => {
      const hz = columnCentreHz(i, RTA_COLUMNS, deck.nyquist);
      bar.dataset.band = hz < lowHz ? 'bass' : hz < highHz ? 'mid' : 'high';
    });
  }, [lowHz, highHz, deck.nyquist]);
  const mic = deck.input === 'Mic';
  const status = deck.error
    ? deck.error
    : mic
      ? deck.live
        ? 'Mic in'
        : 'Mic off'
      : deck.loading
        ? 'Loading'
        : deck.live
          ? 'Playing'
          : 'Stopped';

  return (
    <div className="ab-page">
      <header className="ab-masthead">
        <p className="ab-kicker">audio-bands · headless audio analysis for the browser</p>
        <h1>Audio in. Numbers out.</h1>
      </header>

      <main id="main" className="ab-main">
      <Device model="AB-1" name="Analyser" on={deck.live}>
        <div className="ab-panel">
          {/* Indicators first, then the controls; on wide screens the secondary meters sit beside the primary ones. */}
          <Section title="Spectrum" api="snapshot().fft" className="ab-rta" meter>
            <Display aspect="auto">
              <div className="ab-screen ab-rta-screen" style={{ '--x1': logPosition(lowHz, deck.nyquist), '--x2': logPosition(highHz, deck.nyquist) } as React.CSSProperties}>
                <div ref={rta}>
                  <BarGraph label="Frequency spectrum, 20 Hz to 20 kHz, log axis" values={new Array(RTA_COLUMNS).fill(0)} segments={20} />
                </div>
                <span className="ab-xmark" data-mark="1" aria-hidden />
                <span className="ab-xmark" data-mark="2" aria-hidden />
                <div className="ab-axis" aria-hidden>
                  {[20, 100, 1000, 10000].map((hz) => (
                    <span key={hz} style={{ '--at': logPosition(hz, deck.nyquist) } as React.CSSProperties}>
                      {hz >= 1000 ? `${hz / 1000}k` : hz}
                    </span>
                  ))}
                  <span className="ab-axis-unit">Hz</span>
                </div>
              </div>
            </Display>
          </Section>

          <Section title="Bands" api="bands.bass · mid · high" className="ab-ladders" meter>
            <Display aspect="auto">
              <div className="ab-screen ab-ladder-screen">
                <div ref={ladders}>
                  <BarGraph label="Bass, mid and high levels" values={[0, 0, 0]} segments={20} />
                </div>
                <dl ref={readouts} className="ab-readouts">
                  {['bass', 'mid', 'high'].map((b) => (
                    <div key={b}>
                      <dt>{b}</dt>
                      <dd>0.00</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </Display>
          </Section>

          {/* Controls */}
          <div className="ab-controls">
            <Section title="Input" api={mic ? 'enableMic()' : 'load(url)'} className="ab-input">
              <SlideSwitch
                label="Source"
                options={['Line', 'Mic']}
                value={deck.input}
                onValueChange={(v) => deck.setInput(v as Input)}
              />
            </Section>

            <Section title="Deck" api="play() · pause()" className="ab-deck">
              <span className="ab-sr" role="status">
                {status === 'Playing' ? `Playing ${tracks[deck.track].name} by ${tracks[deck.track].by}` : status}
              </span>
              <Lcd tag={status} size="sm" aria-hidden>
                <LcdDigits value={String(deck.track + 1).padStart(2, '0')} />
                <span className="ab-track">
                  {tracks[deck.track].name} · {tracks[deck.track].by}
                </span>
              </Lcd>
              <div className="ab-keys">
                <Button aria-label="Previous track" disabled={mic} onClick={() => deck.step(-1)}>
                  <SkipIcon dir="prev" />
                </Button>
                <Button tone="primary" aria-label={deck.live && !mic ? 'Pause' : 'Play'} disabled={mic || deck.loading} onClick={deck.togglePlay}>
                  <PlayPauseIcon playing={deck.live && !mic} />
                </Button>
                <Button aria-label="Next track" disabled={mic} onClick={() => deck.step(1)}>
                  <SkipIcon dir="next" />
                </Button>
              </div>
            </Section>

            <Section title="Response" api={`smoothingTimeConstant ${responses[deck.response].toFixed(2)}`} className="ab-response">
              <Segmented
                label="Ballistics"
                options={Object.keys(responses)}
                defaultValue={deck.response}
                onValueChange={(v) => deck.setResponse(v as Response)}
              />
            </Section>

            <Section title="Resolution" api={`fftSize ${fixed(resolutions[deck.resolution], 4)}`} className="ab-resolution">
              <SlideSwitch
                label="Bins"
                options={Object.keys(resolutions)}
                value={deck.resolution}
                onValueChange={(v) => deck.setResolution(v as Resolution)}
              />
            </Section>

            <Section title="Crossover" api="setBandRanges()" className="ab-xover">
              <div className="ab-xover-pair">
                <div className="ab-xover-ch" data-band="bass">
                  <CrossoverKnob
                    label="Bass | mid"
                    hz={lowEdge}
                    edges={knobEdges(crossovers.low, deck.bins, deck.nyquist)}
                    valueHz={lowHz}
                    onChange={deck.setXLow}
                  />
                  <Lcd size="sm">
                    <LcdDigits value={lowEdge} />
                    <span className="ab-unit">Hz</span>
                  </Lcd>
                </div>
                <div className="ab-xover-ch" data-band="high">
                  <CrossoverKnob
                    label="Mid | high"
                    hz={highEdge}
                    edges={knobEdges(crossovers.high, deck.bins, deck.nyquist)}
                    valueHz={highHz}
                    onChange={deck.setXHigh}
                  />
                  <Lcd size="sm">
                    <LcdDigits value={highEdge} />
                    <span className="ab-unit">Hz</span>
                  </Lcd>
                </div>
              </div>
            </Section>
          </div>
          <Section title="Waveform" api="snapshot().waveform" className="ab-scope" meter>
            <Display aspect="auto">
              <div className="ab-screen">
                <canvas ref={scope} className="ab-scope-canvas" role="img" aria-label="Oscilloscope trace of the waveform" />
              </div>
            </Display>
          </Section>

          <Section title="Level" api="bands.overall" className="ab-vu" meter>
            <VuMeter ref={needle} label="Overall level meter" />
          </Section>
        </div>
      </Device>
      </main>

      <footer className="ab-foot">
        <div className="ab-foot-group">
        <p className="ab-lede">
          A music track or a microphone becomes bass, mid and high levels from 0 to 1, plus the raw spectrum and
          waveform. This panel is the library: every control sets one of its options, every meter reads one of its
          values.
        </p>
        <p className="ab-note">
          Bands are shares of the spectrum in equal-width bins, so a crossover snaps to the nearest bin: at {deck.bins} bins
          each one spans {formatHz(deck.nyquist / deck.bins)} Hz. More bins, finer edges.
        </p>
        </div>
        <div className="ab-foot-group">
        <CopyInstall />
        <nav className="ab-links" aria-label="Project links">
          <a href="/docs/">Docs</a>
          <a href="/examples/">Examples</a>
          <a href="https://github.com/juandinella/audio-bands">GitHub ↗</a>
          <a href="https://www.npmjs.com/package/@juandinella/audio-bands">npm ↗</a>
        </nav>
        </div>
        <p className="ab-credits">
          Music:{' '}
          {tracks.map((t, i) => (
            <span key={t.url}>
              <a href={t.page}>{t.name}</a> by {t.by}
              {t.featuring && ` feat. ${t.featuring}`}
              {i < tracks.length - 1 ? ' · ' : ''}
            </span>
          ))}
          . From ccMixter, under <a href={tracks[0].license}>CC BY 3.0</a>.
        </p>
      </footer>
    </div>
  );
}
