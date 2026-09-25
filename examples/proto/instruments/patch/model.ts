import type { AudioBandsSnapshot } from '../../../../src/types';

export type Scalar = 'bass' | 'mid' | 'high';
export type Output = Scalar | 'waveform' | 'fft';
export type Preset = 'pulse' | 'draw' | 'spectrum' | 'sculpt';
export type Destination = 'scale' | 'warp' | 'spin' | 'trace' | 'bins';
export type PatchConfig = { preset: Preset; amount: number; routes: Record<'scale' | 'warp' | 'spin', Scalar> };

export const outputs: { id: Output; label: string; kind: string; color: string }[] = [
  { id: 'bass', label: 'Bass', kind: 'number · 0–1', color: '#cf6038' },
  { id: 'mid', label: 'Mid', kind: 'number · 0–1', color: '#5993b0' },
  { id: 'high', label: 'High', kind: 'number · 0–1', color: '#bfa640' },
  { id: 'waveform', label: 'Waveform', kind: 'time · Uint8Array', color: '#7f80a1' },
  { id: 'fft', label: 'FFT', kind: 'frequency · Uint8Array', color: '#6b9272' },
];
export const presets: { id: Preset; label: string; symbol: string; tech: string; description: string }[] = [
  { id: 'pulse', label: 'Pulse', symbol: '◉', tech: 'DOM / CSS', description: 'One number becomes one CSS transform.' },
  { id: 'draw', label: 'Draw', symbol: '∿', tech: 'CANVAS 2D', description: 'Time-domain bytes become a continuous trace.' },
  { id: 'spectrum', label: 'Spectrum', symbol: '▥', tech: 'CANVAS 2D', description: 'Frequency bins become the height of each bar.' },
  { id: 'sculpt', label: 'Sculpt', symbol: '✳', tech: 'THREE.JS', description: 'Three bands reshape a three-dimensional wire sculpture.' },
];
export const initialPatch: PatchConfig = { preset: 'pulse', amount: 1.5, routes: { scale: 'bass', warp: 'mid', spin: 'high' } };

export function destinations(preset: Preset): { id: Destination; label: string; type: 'scalar' | 'waveform' | 'fft' }[] {
  if (preset === 'draw') return [{ id: 'trace', label: 'Trace', type: 'waveform' }];
  if (preset === 'spectrum') return [{ id: 'bins', label: 'Bars', type: 'fft' }];
  if (preset === 'sculpt') return [
    { id: 'scale', label: 'Scale', type: 'scalar' },
    { id: 'warp', label: 'Warp', type: 'scalar' },
    { id: 'spin', label: 'Spin', type: 'scalar' },
  ];
  return [{ id: 'scale', label: 'Scale', type: 'scalar' }];
}
export function accepts(type: string, output: Output) {
  return type === 'scalar' ? output === 'bass' || output === 'mid' || output === 'high' : type === output;
}
export function sourceFor(destination: Destination, patch: PatchConfig): Output {
  if (destination === 'trace') return 'waveform';
  if (destination === 'bins') return 'fft';
  return patch.routes[destination];
}
export function readControls(frame: AudioBandsSnapshot, patch: PatchConfig) {
  return {
    scale: frame.bands[patch.routes.scale] * patch.amount,
    warp: frame.bands[patch.routes.warp] * patch.amount,
    spin: frame.bands[patch.routes.spin] * patch.amount,
  };
}
export function patchCode(patch: PatchConfig, source: string) {
  const first = `const frame = audio.snapshot('${source === 'mic' ? 'mic' : 'music'}');\nconst amount = ${patch.amount.toFixed(2)};`;
  if (patch.preset === 'pulse') return `${first}\n\nconst scale = frame.bands.${patch.routes.scale} * amount;\ncircle.style.transform = \`scale(\${0.65 + scale})\`;`;
  if (patch.preset === 'draw') return `${first}\n\nif (frame.waveform) {\n  drawWaveform(ctx, frame.waveform, amount);\n}`;
  if (patch.preset === 'spectrum') return `${first}\n\nif (frame.fft) {\n  drawSpectrum(ctx, frame.fft, amount);\n}`;
  return `${first}\n\nconst controls = {\n  scale: frame.bands.${patch.routes.scale} * amount,\n  warp: frame.bands.${patch.routes.warp} * amount,\n  spin: frame.bands.${patch.routes.spin} * amount,\n};\n\n// scene is created by the renderer below.\nscene.draw(controls, time);`;
}
