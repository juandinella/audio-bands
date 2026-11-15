import type { ReactNode } from 'react';
import { install, react as reactExample, vanilla as vanillaExample } from '../content';

// One source of documentation for the three treatments. Copy follows the
// current site docs, updated for the live settings in 0.7.0.

export { install, reactExample, vanillaExample };

export const framesCode = `const frame = audio.snapshot();
const { bass, mid, high, overall } = frame.bands;
const fft = frame.fft;           // frequency bytes, 0–255
const waveform = frame.waveform; // time-domain bytes, 0–255`;

export const micCode = `async function startMic() {
  try {
    await audio.enableMic();
  } catch (error) {
    // Show the error beside your microphone button.
    output.textContent = error.message;
  }
}

// In your animation loop:
const frame = audio.snapshot('mic');

// When the user stops:
audio.disableMic();`;

export const liveCode = `// Move the bass/mid edge to ~375 Hz without stopping playback.
const nyquist = audio.getSampleRate() / 2;
audio.setBandRanges({
  bass: { from: 0, to: 375 / nyquist },
  mid: { from: 375 / nyquist, to: 0.4 },
});

// Slower, finer analysis for the music source.
audio.setAnalyserConfig('music', { fftSize: 2048, smoothingTimeConstant: 0.95 });`;

export const optionsCode = `const audio = new AudioBands({
  music: { fftSize: 512, smoothingTimeConstant: 0.7 },
  mic: { fftSize: 256, smoothingTimeConstant: 0.8 },
  customBands: {
    presence: { from: 0.25, to: 0.5 },
    air: { from: 0.5, to: 1 },
  },
  onLoadError: (error) => console.error(error),
  onMicError: (error) => console.error(error),
});`;

export type Method = { name: string; returns: string; does: string; group: string; since?: string };

export const methods: Method[] = [
  { group: 'Playback', name: 'load(url)', returns: 'Promise<void>', does: 'Load a CORS-enabled track. Resolves when ready; does not play.' },
  { group: 'Playback', name: 'play() · pause()', returns: 'Promise<void> · void', does: 'Start or pause the current track. Call play() from a click.' },
  { group: 'Playback', name: 'togglePlayPause()', returns: 'Promise<void>', does: 'Toggle playback. Catch the returned promise.' },
  { group: 'Playback', name: 'setLoop(loop)', returns: 'void', does: 'Loop the current and future tracks.' },
  { group: 'Playback', name: 'seek(seconds)', returns: 'void', does: 'Move the playback position.' },
  { group: 'Playback', name: 'getDuration() · getCurrentTime()', returns: 'number | null', does: 'Read seconds, or null when unavailable.' },
  { group: 'Microphone', name: 'enableMic() · disableMic()', returns: 'Promise<void> · void', does: 'Request microphone access; stop every microphone track.' },
  { group: 'Reading', name: 'snapshot(source?)', returns: '{ bands, customBands, fft, waveform }', does: 'One coherent frame: one frequency read and one time-domain read.' },
  { group: 'Reading', name: 'getBands(source?)', returns: '{ bass, mid, high, overall }', does: 'Each from 0 to 1.' },
  { group: 'Reading', name: 'getCustomBands(source?)', returns: 'Record<string, number>', does: 'Your named spectrum regions, each from 0 to 1.' },
  { group: 'Reading', name: 'getFftData(source?)', returns: 'Uint8Array | null', does: 'fftSize / 2 frequency bins, 0–255. Reused buffer.' },
  { group: 'Reading', name: 'getWaveform(source?)', returns: 'Uint8Array | null', does: 'fftSize time-domain samples, 0–255. Reused buffer.' },
  { group: 'Live settings', name: 'setBandRanges(ranges)', returns: 'void', does: 'Change bass/mid/high regions while playing. Omitted bands keep theirs.', since: '0.7' },
  { group: 'Live settings', name: 'getBandRanges()', returns: '{ bass, mid, high }', does: 'Copies of the current regions.', since: '0.7' },
  { group: 'Live settings', name: 'setAnalyserConfig(source, config)', returns: 'void', does: 'Change fftSize and smoothing for music or mic while playing.', since: '0.7' },
  { group: 'Live settings', name: 'getAnalyserConfig(source?)', returns: '{ fftSize, smoothingTimeConstant }', does: 'The current analyser settings.', since: '0.7' },
  { group: 'Live settings', name: 'getSampleRate()', returns: 'number | null', does: 'The AudioContext rate; null before the first load or mic.', since: '0.7' },
  { group: 'Lifecycle', name: 'getState()', returns: 'AudioBandsState', does: 'isPlaying, hasTrack, micActive and separate load, playback and mic errors.' },
  { group: 'Lifecycle', name: 'destroy()', returns: 'void', does: 'Release the audio context, the track and the microphone stream.' },
];

export type Option = { name: string; type: string; fallback: string; range: string };

export const options: Option[] = [
  { name: 'music.fftSize', type: 'number', fallback: '256', range: 'power of two, 32–32768' },
  { name: 'music.smoothingTimeConstant', type: 'number', fallback: '0.85', range: '0–1' },
  { name: 'mic.fftSize', type: 'number', fallback: '256', range: 'power of two, 32–32768' },
  { name: 'mic.smoothingTimeConstant', type: 'number', fallback: '0.8', range: '0–1' },
  { name: 'bandRanges.bass', type: '{ from, to }', fallback: '0 – 0.08', range: '0 ≤ from < to ≤ 1' },
  { name: 'bandRanges.mid', type: '{ from, to }', fallback: '0.08 – 0.4', range: '0 ≤ from < to ≤ 1' },
  { name: 'bandRanges.high', type: '{ from, to }', fallback: '0.4 – 1', range: '0 ≤ from < to ≤ 1' },
  { name: 'customBands', type: 'Record<string, { from, to }>', fallback: '{}', range: '0 ≤ from < to ≤ 1' },
  { name: 'on…', type: 'callbacks', fallback: '—', range: 'Error, LoadError, PlaybackError, MicError, StateChange, Play, Pause, MicStart, MicStop' },
];

export const questions: [string, ReactNode][] = [
  ['Why does playback fail?', <>Browsers require a user gesture. Load the track first, then call <code>play()</code> directly from a click or tap. Awaiting a network load before playing can lose user activation.</>],
  ['Why is my remote track silent?', <>The audio server must allow cross-origin access with CORS headers. A URL that plays in a browser tab may still be unavailable to Web Audio. Test with a same-origin file first.</>],
  ['Why is the microphone unavailable?', <>Use HTTPS or localhost, grant permission, and check that no other application holds the device. Show microphone errors apart from track errors.</>],
  ['Why are my saved FFT frames changing?', <>The typed-array buffers are reused on every read, and replaced when <code>fftSize</code> changes. Copy with <code>.slice()</code> before storing a frame.</>],
  ['Why is high always low?', <>Ranges are shares of the spectrum up to half the sample rate. Compressed audio is nearly empty above ~16 kHz, which pulls the average of a wide high band down. Narrow it with <code>setBandRanges()</code> or add a custom band.</>],
  ['Can this run on the server?', <>Analysis needs the browser’s Web Audio API. Render the page on the server, but load tracks and start audio from effects or event handlers.</>],
];

export const sections = [
  { id: 'start', n: '01', title: 'Quick start' },
  { id: 'react', n: '02', title: 'React' },
  { id: 'reading', n: '03', title: 'Reading audio' },
  { id: 'microphone', n: '04', title: 'Microphone' },
  { id: 'live', n: '05', title: 'Live settings' },
  { id: 'api', n: '06', title: 'API reference' },
  { id: 'options', n: '07', title: 'Configuration' },
  { id: 'troubleshooting', n: '08', title: 'Troubleshooting' },
];
