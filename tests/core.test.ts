// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioBands } from '../src/core';
import { AudioBandsError } from '../src/errors';

class MockAnalyser {
  private _fftSize = 256;

  smoothingTimeConstant = 0.8;
  frequencyBinCount = 128;
  frequencyData = new Uint8Array(128) as Uint8Array<ArrayBuffer>;
  waveformData = new Uint8Array(256) as Uint8Array<ArrayBuffer>;
  connect = vi.fn();
  disconnect = vi.fn();

  get fftSize(): number {
    return this._fftSize;
  }

  set fftSize(value: number) {
    this._fftSize = value;
    this.frequencyBinCount = value / 2;
    this.frequencyData = new Uint8Array(value / 2) as Uint8Array<ArrayBuffer>;
    this.waveformData = new Uint8Array(value) as Uint8Array<ArrayBuffer>;
  }

  getByteFrequencyData(target: Uint8Array): void {
    target.set(this.frequencyData.subarray(0, target.length));
  }

  getByteTimeDomainData(target: Uint8Array): void {
    target.set(this.waveformData.subarray(0, target.length));
  }
}

class MockSourceNode {
  connect = vi.fn();
  disconnect = vi.fn();
}

class MockTrack {
  stop = vi.fn();
}

class MockMediaStream {
  readonly tracks = [new MockTrack()];

  getTracks(): MediaStreamTrack[] {
    return this.tracks as unknown as MediaStreamTrack[];
  }
}

class MockAudioContext {
  static instances: MockAudioContext[] = [];

  destination = {};
  analysers: MockAnalyser[] = [];
  close = vi.fn(async () => undefined);
  state: AudioContextState = 'running';
  resume = vi.fn(async () => { this.state = 'running'; });

  constructor() {
    MockAudioContext.instances.push(this);
  }

  createAnalyser(): AnalyserNode {
    const analyser = new MockAnalyser();
    this.analysers.push(analyser);
    return analyser as unknown as AnalyserNode;
  }

  createMediaElementSource(): MediaElementAudioSourceNode {
    return new MockSourceNode() as unknown as MediaElementAudioSourceNode;
  }

  createMediaStreamSource(): MediaStreamAudioSourceNode {
    return new MockSourceNode() as unknown as MediaStreamAudioSourceNode;
  }
}

class MockAudioElement {
  static instances: MockAudioElement[] = [];
  static nextPlayError: unknown = null;
  static nextLoadError: unknown = null;

  src = '';
  crossOrigin: string | null = null;
  preload = '';
  loop = false;
  duration = 180;
  currentTime = 0;
  paused = true;
  error: unknown = null;
  private readonly listeners = new Map<string, Set<(event?: Event) => void>>();
  play = vi.fn(async () => {
    if (MockAudioElement.nextPlayError) {
      const error = MockAudioElement.nextPlayError;
      MockAudioElement.nextPlayError = null;
      throw error;
    }
    this.paused = false;
    this.emit('play');
  });
  pause = vi.fn(() => {
    this.paused = true;
    this.emit('pause');
  });
  load = vi.fn(() => {
    queueMicrotask(() => {
      if (this.src === '') return;

      if (MockAudioElement.nextLoadError) {
        const error = MockAudioElement.nextLoadError;
        MockAudioElement.nextLoadError = null;
        this.error = error;
        this.emit('error', { target: this } as Event);
        return;
      }

      this.emit('loadedmetadata', { target: this } as Event);
      this.emit('canplay', { target: this } as Event);
    });
  });

  constructor() {
    MockAudioElement.instances.push(this);
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const handler =
      typeof listener === 'function'
        ? listener
        : listener.handleEvent.bind(listener);
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(handler);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const handler =
      typeof listener === 'function'
        ? listener
        : listener.handleEvent.bind(listener);
    this.listeners.get(type)?.delete(handler);
  }

  emit(type: string, event?: Event): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

const mediaDevices = {
  getUserMedia: vi.fn(),
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  MockAudioContext.instances = [];
  MockAudioElement.instances = [];
  MockAudioElement.nextPlayError = null;
  MockAudioElement.nextLoadError = null;
  mediaDevices.getUserMedia.mockReset();

  vi.stubGlobal('Audio', MockAudioElement);
  vi.stubGlobal('AudioContext', MockAudioContext);
  Object.defineProperty(window, 'AudioContext', {
    configurable: true,
    value: MockAudioContext,
  });
  Object.defineProperty(window, 'webkitAudioContext', {
    configurable: true,
    value: undefined,
  });
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: mediaDevices,
  });
});

describe('AudioBands', () => {
  it.each(['disableMic', 'destroy'] as const)('stops a late microphone stream after %s', async (cancel) => {
    const permission = deferred<MockMediaStream>();
    const stream = new MockMediaStream();
    const onMicStart = vi.fn();
    mediaDevices.getUserMedia.mockReturnValue(permission.promise);
    const audio = new AudioBands({ onMicStart });

    const enabling = audio.enableMic();
    audio[cancel]();
    permission.resolve(stream);
    await enabling;

    expect(stream.tracks[0].stop).toHaveBeenCalledTimes(1);
    expect(audio.getState().micActive).toBe(false);
    expect(audio.getFftData('mic')).toBeNull();
    expect(onMicStart).not.toHaveBeenCalled();
    audio.destroy();
  });

  it('shares concurrent microphone requests and stops the resulting stream', async () => {
    const permission = deferred<MockMediaStream>();
    const stream = new MockMediaStream();
    const onMicStart = vi.fn();
    mediaDevices.getUserMedia.mockReturnValue(permission.promise);
    const audio = new AudioBands({ onMicStart });

    const first = audio.enableMic();
    const second = audio.enableMic();
    expect(mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    permission.resolve(stream);
    await Promise.all([first, second]);

    expect(onMicStart).toHaveBeenCalledTimes(1);
    expect(audio.getState().micActive).toBe(true);
    audio.disableMic();
    expect(stream.tracks[0].stop).toHaveBeenCalledTimes(1);
    audio.destroy();
  });

  it.each(['resolve', 'reject'] as const)('ignores a cancelled request that later %ss while a new mic is active', async (settle) => {
    const oldPermission = deferred<MockMediaStream>();
    const oldStream = new MockMediaStream();
    const newStream = new MockMediaStream();
    const onMicError = vi.fn();
    mediaDevices.getUserMedia
      .mockReturnValueOnce(oldPermission.promise)
      .mockResolvedValueOnce(newStream);
    const audio = new AudioBands({ onMicError });

    const oldRequest = audio.enableMic();
    audio.disableMic();
    await audio.enableMic();
    if (settle === 'resolve') oldPermission.resolve(oldStream);
    else oldPermission.reject(new Error('old permission denied'));
    await oldRequest;

    expect(audio.getState().micActive).toBe(true);
    expect(newStream.tracks[0].stop).not.toHaveBeenCalled();
    expect(onMicError).not.toHaveBeenCalled();
    if (settle === 'resolve') expect(oldStream.tracks[0].stop).toHaveBeenCalledTimes(1);
    audio.destroy();
    expect(newStream.tracks[0].stop).toHaveBeenCalledTimes(1);
  });

  it('cleans up an acquired stream when connecting the microphone fails and can retry', async () => {
    const stream = new MockMediaStream();
    const audio = new AudioBands();
    await audio.load('/track.mp3');
    const ctx = MockAudioContext.instances[0];
    const source = new MockSourceNode();
    source.connect.mockImplementationOnce(() => { throw new Error('connect failed'); });
    vi.spyOn(ctx, 'createMediaStreamSource').mockReturnValueOnce(source as unknown as MediaStreamAudioSourceNode);
    mediaDevices.getUserMedia.mockResolvedValueOnce(stream);

    await expect(audio.enableMic()).rejects.toMatchObject({ code: 'mic_error' });
    expect(stream.tracks[0].stop).toHaveBeenCalledTimes(1);
    expect(source.disconnect).toHaveBeenCalledTimes(1);
    expect(audio.getState().micActive).toBe(false);
    expect(audio.getFftData('mic')).toBeNull();

    mediaDevices.getUserMedia.mockResolvedValueOnce(new MockMediaStream());
    await audio.enableMic();
    expect(audio.getState().micActive).toBe(true);
    expect(audio.getState().micError).toBeNull();
    audio.destroy();
  });

  it('resumes a suspended context for playback', async () => {
    const audio = new AudioBands();
    await audio.load('/track.mp3');
    const ctx = MockAudioContext.instances[0];
    ctx.state = 'suspended';

    await audio.play();
    expect(ctx.resume).toHaveBeenCalledTimes(1);
    expect(audio.getState().isPlaying).toBe(true);
    audio.destroy();
  });

  it('pauses playback and reports a failed context resume', async () => {
    const audio = new AudioBands();
    await audio.load('/track.mp3');
    const ctx = MockAudioContext.instances[0];
    ctx.state = 'suspended';
    ctx.resume.mockRejectedValueOnce(new Error('resume blocked'));

    await expect(audio.play()).rejects.toMatchObject({ code: 'playback_error' });
    expect(MockAudioElement.instances[0].paused).toBe(true);
    expect(audio.getState().isPlaying).toBe(false);
    audio.destroy();
  });

  it('rejects interrupted playback without overwriting a replacement track state', async () => {
    const audio = new AudioBands();
    await audio.load('/first.mp3');
    const playback = deferred<void>();
    MockAudioElement.instances[0].play.mockReturnValueOnce(playback.promise);
    const playing = audio.play();
    const rejection = expect(playing).rejects.toMatchObject({ code: 'playback_error' });
    await audio.load('/second.mp3');
    await audio.play();
    playback.reject(new Error('old playback interrupted'));
    await rejection;

    expect(audio.getState().playbackError).toBeNull();
    expect(audio.getState().isPlaying).toBe(true);
    audio.destroy();
  });

  it('resumes the context when enabling microphone analysis', async () => {
    const audio = new AudioBands();
    await audio.load('/track.mp3');
    const ctx = MockAudioContext.instances[0];
    ctx.state = 'suspended';
    mediaDevices.getUserMedia.mockResolvedValue(new MockMediaStream());

    await audio.enableMic();
    expect(ctx.resume).toHaveBeenCalledTimes(1);
    expect(audio.getState().micActive).toBe(true);
    audio.destroy();
  });

  it('stops a stream received after context resume has failed', async () => {
    const audio = new AudioBands();
    await audio.load('/track.mp3');
    const ctx = MockAudioContext.instances[0];
    ctx.state = 'suspended';
    ctx.resume.mockRejectedValueOnce(new Error('resume failed'));
    const permission = deferred<MockMediaStream>();
    const stream = new MockMediaStream();
    mediaDevices.getUserMedia.mockReturnValue(permission.promise);

    await expect(audio.enableMic()).rejects.toMatchObject({ code: 'mic_error' });
    permission.resolve(stream);
    await permission.promise;
    expect(stream.tracks[0].stop).toHaveBeenCalledTimes(1);
    expect(audio.getState().micActive).toBe(false);
    audio.destroy();
  });

  it('stops an acquired stream while context resumption is still pending', async () => {
    const audio = new AudioBands();
    await audio.load('/track.mp3');
    const ctx = MockAudioContext.instances[0];
    const resumption = deferred<void>();
    ctx.state = 'suspended';
    ctx.resume.mockReturnValueOnce(resumption.promise);
    const stream = new MockMediaStream();
    mediaDevices.getUserMedia.mockResolvedValue(stream);

    const enabling = audio.enableMic();
    await Promise.resolve();
    audio.disableMic();
    expect(stream.tracks[0].stop).toHaveBeenCalledTimes(1);
    resumption.resolve();
    await enabling;
    expect(audio.getState().micActive).toBe(false);
    expect(audio.getFftData('mic')).toBeNull();
    audio.destroy();
  });

  it.each([NaN, Infinity, -Infinity])('rejects non-finite analyser settings and range endpoints: %s', (value) => {
    expect(() => new AudioBands({ music: { smoothingTimeConstant: value } })).toThrow(AudioBandsError);
    expect(() => new AudioBands({ mic: { smoothingTimeConstant: value } })).toThrow(AudioBandsError);
    expect(() => new AudioBands({ bandRanges: { bass: { from: value, to: 1 } } })).toThrow(AudioBandsError);
    expect(() => new AudioBands({ customBands: { test: { from: 0, to: value } } })).toThrow(AudioBandsError);
  });

  it('supports configurable analysers and custom band ranges after load readiness', async () => {
    mediaDevices.getUserMedia.mockResolvedValue(new MockMediaStream());

    const audio = new AudioBands({
      music: { fftSize: 512, smoothingTimeConstant: 0.6 },
      mic: { fftSize: 1024, smoothingTimeConstant: 0.3 },
      bandRanges: {
        bass: { from: 0, to: 0.25 },
        mid: { from: 0.25, to: 0.5 },
        high: { from: 0.5, to: 1 },
      },
      customBands: {
        presence: { from: 0.25, to: 0.5 },
        air: { from: 0.5, to: 1 },
      },
    });

    await audio.load('/track.mp3');
    await audio.play();

    const ctx = MockAudioContext.instances[0];
    const musicAnalyser = ctx.analysers[0];
    expect(musicAnalyser.fftSize).toBe(512);
    expect(musicAnalyser.smoothingTimeConstant).toBe(0.6);

    const musicData = new Uint8Array(256);
    musicData.fill(255, 0, 64);
    musicData.fill(128, 64, 128);
    musicAnalyser.frequencyData = musicData as Uint8Array<ArrayBuffer>;

    const bands = audio.getBands();
    expect(bands.bass).toBeCloseTo(1, 4);
    expect(bands.mid).toBeCloseTo(128 / 255, 4);
    expect(bands.high).toBeCloseTo(0, 4);

    const customBands = audio.getCustomBands();
    expect(customBands.presence).toBeCloseTo(128 / 255, 4);
    expect(customBands.air).toBeCloseTo(0, 4);

    const snapshot = audio.snapshot();
    expect(snapshot.fft).toEqual(musicData);
    expect(snapshot.bands).toEqual(bands);
    expect(snapshot.customBands).toEqual(customBands);

    expect(audio.getDuration()).toBe(180);
    expect(audio.getCurrentTime()).toBe(0);
    audio.seek(12.5);
    expect(audio.getCurrentTime()).toBe(12.5);
    audio.seek(999);
    expect(audio.getCurrentTime()).toBe(180);
    audio.setLoop(true);
    expect(MockAudioElement.instances[0].loop).toBe(true);

    const musicWaveform = new Uint8Array(512);
    musicWaveform.fill(127);
    musicWaveform[0] = 10;
    musicWaveform[1] = 240;
    musicAnalyser.waveformData = musicWaveform as Uint8Array<ArrayBuffer>;

    expect(audio.getWaveform()).toEqual(musicWaveform);
    expect(audio.getWaveform('music')).toEqual(musicWaveform);
    expect(audio.getWaveform('mic')).toBeNull();
    expect(audio.snapshot().waveform).toEqual(musicWaveform);

    await audio.enableMic();

    const micAnalyser = ctx.analysers[1];
    expect(micAnalyser.fftSize).toBe(1024);
    expect(micAnalyser.smoothingTimeConstant).toBe(0.3);

    const micWaveform = new Uint8Array(1024);
    micWaveform.fill(127);
    micWaveform[0] = 20;
    micWaveform[1] = 220;
    micAnalyser.waveformData = micWaveform as Uint8Array<ArrayBuffer>;

    expect(audio.getWaveform('mic')).toEqual(micWaveform);
    expect(audio.snapshot('mic').waveform).toEqual(micWaveform);
  });

  it('tracks separate load and mic errors and cleans up lifecycle resources', async () => {
    const onError = vi.fn();
    const onLoadError = vi.fn();
    const onPlaybackError = vi.fn();
    const onMicError = vi.fn();
    const onStateChange = vi.fn();

    const audio = new AudioBands({
      onError,
      onLoadError,
      onPlaybackError,
      onMicError,
      onStateChange,
    });

    MockAudioElement.nextPlayError = new Error('blocked');
    await audio.load('/blocked.mp3');
    await expect(audio.play()).rejects.toBeInstanceOf(AudioBandsError);

    expect(onLoadError).not.toHaveBeenCalled();
    expect(onPlaybackError).toHaveBeenCalledTimes(1);
    expect(onMicError).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(audio.getState().loadError).toBeNull();
    expect(audio.getState().playbackError?.kind).toBe('playback');
    expect(audio.getState().playbackError?.code).toBe('playback_error');
    expect(audio.getState().hasTrack).toBe(true);
    expect(audio.getState().isPlaying).toBe(false);

    MockAudioElement.nextLoadError = new Error('network');
    await expect(audio.load('/missing.mp3')).rejects.toBeInstanceOf(AudioBandsError);
    expect(onLoadError).toHaveBeenCalledTimes(1);
    expect(audio.getState().loadError?.kind).toBe('load');
    expect(audio.getState().loadError?.code).toBe('load_error');
    expect(audio.getState().hasTrack).toBe(false);

    mediaDevices.getUserMedia.mockRejectedValue(new Error('denied'));
    await expect(audio.enableMic()).rejects.toBeInstanceOf(AudioBandsError);

    expect(onMicError).toHaveBeenCalledTimes(1);
    expect(audio.getState().micError?.kind).toBe('mic');

    const stream = new MockMediaStream();
    mediaDevices.getUserMedia.mockResolvedValue(stream);
    await audio.enableMic();

    expect(audio.getState().micActive).toBe(true);

    audio.disableMic();
    expect(stream.tracks[0].stop).toHaveBeenCalledTimes(1);
    expect(audio.getState().micActive).toBe(false);

    const ctx = MockAudioContext.instances[0];
    audio.destroy();

    expect(ctx.close).toHaveBeenCalledTimes(1);
    expect(audio.getState().hasTrack).toBe(false);
    await expect(audio.load('/after-destroy.mp3')).rejects.toMatchObject({
      code: 'destroyed',
    });
    expect(() => audio.seek(-1)).toThrowError(AudioBandsError);
    expect(onStateChange).toHaveBeenCalled();
  });

  it('returns empty analysis before sources are ready and resets playback errors on new load', async () => {
    const audio = new AudioBands({
      customBands: {
        presence: { from: 0.25, to: 0.5 },
      },
    });

    expect(audio.getBands()).toEqual({ bass: 0, mid: 0, high: 0, overall: 0 });
    expect(audio.getCustomBands()).toEqual({ presence: 0 });
    expect(audio.getFftData()).toBeNull();
    expect(audio.getWaveform()).toBeNull();
    expect(audio.snapshot()).toEqual({
      bands: { bass: 0, mid: 0, high: 0, overall: 0 },
      customBands: { presence: 0 },
      fft: null,
      waveform: null,
    });

    MockAudioElement.nextPlayError = new Error('blocked');
    await audio.load('/blocked.mp3');
    await expect(audio.play()).rejects.toBeInstanceOf(AudioBandsError);
    expect(audio.getState().playbackError?.code).toBe('playback_error');

    await audio.load('/fresh.mp3');
    expect(audio.getState().playbackError).toBeNull();
    expect(audio.getState().loadError).toBeNull();
    expect(audio.getState().hasTrack).toBe(true);
  });

  it('keeps playback state synchronized with media element events', async () => {
    const onPlay = vi.fn();
    const onPause = vi.fn();
    const audio = new AudioBands({ onPlay, onPause });

    await audio.load('/track.mp3');
    const element = MockAudioElement.instances[0];

    await audio.play();
    expect(audio.getState().isPlaying).toBe(true);
    expect(onPlay).toHaveBeenCalledTimes(1);

    element.emit('ended');
    expect(audio.getState().isPlaying).toBe(false);

    element.paused = false;
    audio.pause();
    expect(audio.getState().isPlaying).toBe(false);
    expect(onPause).toHaveBeenCalledTimes(1);
  });

  it('detaches old media listeners when loading a replacement track', async () => {
    const audio = new AudioBands();

    await audio.load('/first.mp3');
    const first = MockAudioElement.instances[0];
    await audio.play();
    expect(audio.getState().isPlaying).toBe(true);

    await audio.load('/second.mp3');
    const second = MockAudioElement.instances[1];
    expect(audio.getState().isPlaying).toBe(false);

    first.emit('play');
    expect(audio.getState().isPlaying).toBe(false);

    second.emit('play');
    expect(audio.getState().isPlaying).toBe(true);
  });

  it('keeps hasTrack false until the track is actually ready', async () => {
    const audio = new AudioBands();

    const loading = audio.load('/track.mp3');
    expect(audio.getState().hasTrack).toBe(false);

    await loading;
    expect(audio.getState().hasTrack).toBe(true);
  });

  it('makes togglePlayPause follow the same async playback contract as play', async () => {
    const audio = new AudioBands();

    await audio.load('/blocked.mp3');
    MockAudioElement.nextPlayError = new Error('blocked');

    await expect(audio.togglePlayPause()).rejects.toBeInstanceOf(AudioBandsError);
    expect(audio.getState().playbackError?.code).toBe('playback_error');
  });
});
