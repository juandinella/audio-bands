import * as React from 'react';
import { NumberInput, NumberInputControl, NumberInputScrubArea } from '@ui-sdk/react/number-input';
import { haptic } from './kit/lib/haptics';

// A crossover knob: the kit's flat knob, turning on a log scale in Hz. The
// cap's position is the only reading on the knob itself; the frequency is
// printed on the LCD beside it, as on a digital crossover.
const ticks = 27;

export function CrossoverKnob({
  label,
  edges,
  valueHz,
  hz,
  onChange,
}: {
  label: string;
  /** The edges the library can use at the current resolution, ascending. */
  edges: number[];
  valueHz: number;
  hz: string;
  onChange: (hz: number) => void;
}) {
  // The knob turns through the reachable edges: one detent per edge.
  const last = Math.max(1, edges.length - 1);
  let index = 0;
  edges.forEach((edge, i) => {
    if (Math.abs(edge - valueHz) < Math.abs(edges[index] - valueHz)) index = i;
  });
  const share = index / last;
  const lit = Math.floor(share * ticks);
  return (
    <NumberInput
      min={0}
      max={last}
      step={1}
      value={index}
      onValueChange={(next) => {
        if (next === null || next === index) return;
        haptic('selection');
        onChange(edges[Math.min(last, Math.max(0, next))]);
      }}
    >
      <div data-kit="knob" data-color="white" style={{ '--turn': `${share * 270 - 135}deg`, '--lit': share } as React.CSSProperties}>
        {/* About 240px of drag for a full turn at any resolution. */}
        <NumberInputScrubArea data-kit="knob-dial" orientation="vertical" pixelsPerStep={Math.max(1, Math.round(240 / last))}>
          <svg data-kit="knob-ticks" viewBox="-50 -50 100 100" aria-hidden>
            {Array.from({ length: ticks + 1 }, (_, i) => {
              const a = ((-135 + (i / ticks) * 270 - 90) * Math.PI) / 180;
              return (
                <line
                  key={i}
                  x1={Math.cos(a) * 40}
                  y1={Math.sin(a) * 40}
                  x2={Math.cos(a) * 50}
                  y2={Math.sin(a) * 50}
                  data-major={i % 9 === 0 || undefined}
                  data-lit={i <= lit || undefined}
                />
              );
            })}
          </svg>
          <span data-kit="knob-cap" />
        </NumberInputScrubArea>
        <NumberInputControl
          data-kit="knob-readout"
          className="ab-sr"
          role="spinbutton"
          aria-label={`${label} crossover`}
          aria-valuemin={0}
          aria-valuemax={last}
          aria-valuenow={index}
          aria-valuetext={`${hz} hertz`}
        />
        <span data-kit="label">{label}</span>
      </div>
    </NumberInput>
  );
}

// A moving-coil meter face: printed scale from 0 to 1 and a needle whose
// pivot sits below the window, as on a real VU. The frame loop turns it
// through a ref.
const PIVOT = { x: 100, y: 150 };
const SWEEP = 40;
export const vuAngle = (v: number) => -SWEEP + Math.min(1, Math.max(0, v)) * SWEEP * 2;

export const VuMeter = React.forwardRef<SVGGElement, { label: string }>(function VuMeter({ label }, needle) {
  const point = (v: number, r: number) => {
    const a = ((vuAngle(v) - 90) * Math.PI) / 180;
    return [PIVOT.x + Math.cos(a) * r, PIVOT.y + Math.sin(a) * r].map((n) => n.toFixed(2));
  };
  const arc = (from: number, to: number, r: number) => `M ${point(from, r).join(' ')} A ${r} ${r} 0 0 1 ${point(to, r).join(' ')}`;
  return (
    <figure className="vu" role="img" aria-label={label}>
      <svg viewBox="0 0 200 92">
        <path d={arc(0, 1, 120)} className="vu-arc" />
        <path d={arc(0.8, 1, 122)} className="vu-arc vu-hot" />
        {Array.from({ length: 21 }, (_, i) => {
          const v = i / 20;
          const major = i % 4 === 0;
          const [x1, y1] = point(v, 120);
          const [x2, y2] = point(v, major ? 111 : 115);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className={major ? 'vu-tick vu-major' : 'vu-tick'} />;
        })}
        {[0, 0.2, 0.4, 0.6, 0.8, 1].map((v) => {
          const [x, y] = point(v, 130);
          return (
            <text key={v} x={x} y={y} className="vu-num">
              {v === 0 ? '0' : v === 1 ? '1' : `.${v * 10}`}
            </text>
          );
        })}
        <text x="100" y="84" className="vu-name">
          overall
        </text>
        <g ref={needle} style={{ transform: `rotate(${vuAngle(0)}deg)`, transformOrigin: `${PIVOT.x}px ${PIVOT.y}px` }}>
          <line x1={PIVOT.x} y1={PIVOT.y - 60} x2={PIVOT.x} y2={PIVOT.y - 126} className="vu-needle" />
        </g>
      </svg>
    </figure>
  );
});

// Oscilloscope trace on a printed graticule: 10 by 8 divisions.
export function drawScope(canvas: HTMLCanvasElement, waveform: Uint8Array | null, trace: string, grid: string) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = Math.min(devicePixelRatio, 2);
  const w = Math.round(canvas.clientWidth * dpr);
  const h = Math.round(canvas.clientHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 1; i < 10; i++) {
    const x = Math.round((i / 10) * w) + 0.5;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
  }
  for (let i = 1; i < 8; i++) {
    const y = Math.round((i / 8) * h) + 0.5;
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }
  ctx.stroke();

  ctx.strokeStyle = trace;
  ctx.lineWidth = 1.5 * dpr;
  ctx.shadowColor = trace;
  ctx.shadowBlur = 6 * dpr;
  ctx.beginPath();
  const len = waveform?.length ?? 2;
  for (let i = 0; i < len; i++) {
    const x = (i / (len - 1)) * w;
    const y = waveform ? (waveform[i] / 255) * h : h / 2;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
}

// The spectrum on a log frequency axis, as a real-time analyser shows it:
// every octave gets the same width. Columns finer than one FFT bin repeat
// that bin, so a low Resolution shows up as blocky lows.
export const RTA_MIN_HZ = 20;
export const rtaMaxHz = (nyquist: number) => Math.min(20000, nyquist);
export const logPosition = (hz: number, nyquist: number) =>
  Math.min(1, Math.max(0, Math.log(hz / RTA_MIN_HZ) / Math.log(rtaMaxHz(nyquist) / RTA_MIN_HZ)));
export const columnCentreHz = (i: number, n: number, nyquist: number) =>
  RTA_MIN_HZ * Math.pow(rtaMaxHz(nyquist) / RTA_MIN_HZ, (i + 0.5) / n);

export function logColumns(fft: Uint8Array | null, n: number, nyquist: number) {
  const out = new Array<number>(n).fill(0);
  if (!fft) return out;
  const ratio = rtaMaxHz(nyquist) / RTA_MIN_HZ;
  const toBin = (hz: number) => (hz / nyquist) * fft.length;
  for (let i = 0; i < n; i++) {
    const from = Math.min(fft.length - 1, Math.floor(toBin(RTA_MIN_HZ * Math.pow(ratio, i / n))));
    const to = Math.min(fft.length, Math.max(from + 1, Math.floor(toBin(RTA_MIN_HZ * Math.pow(ratio, (i + 1) / n)))));
    let sum = 0;
    for (let j = from; j < to; j++) sum += fft[j];
    out[i] = sum / (to - from) / 255;
  }
  return out;
}

export function PlayPauseIcon({ playing }: { playing: boolean }) {
  return playing ? (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
      <rect x="3.5" y="3" width="3" height="10" rx="0.5" fill="currentColor" />
      <rect x="9.5" y="3" width="3" height="10" rx="0.5" fill="currentColor" />
    </svg>
  ) : (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
      <path d="M4.5 2.8v10.4a.5.5 0 0 0 .77.42l8-5.2a.5.5 0 0 0 0-.84l-8-5.2a.5.5 0 0 0-.77.42Z" fill="currentColor" />
    </svg>
  );
}

export function SkipIcon({ dir }: { dir: 'prev' | 'next' }) {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden style={dir === 'prev' ? { transform: 'scaleX(-1)' } : undefined}>
      <path d="M3 3.5v9l6-4.5-6-4.5Z M9 3.5v9l6-4.5-6-4.5Z" fill="currentColor" />
    </svg>
  );
}
