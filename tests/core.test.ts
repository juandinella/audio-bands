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

  src = '';
  crossOrigin: string | null = null;
  loop = false;
  paused = true;
  play = vi.fn(async () => {
    if (MockAudioElement.nextPlayError) {
      const error = MockAudioElement.nextPlayError;
      MockAudioElement.nextPlayError = null;
      throw error;
    }
    this.paused = false;
  });
  pause = vi.fn(() => {
    this.paused = true;
  });
  load = vi.fn();

  constructor() {
    MockAudioElement.instances.push(this);
  }
}

const mediaDevices = {
  getUserMedia: vi.fn(),
};

beforeEach(() => {
  MockAudioContext.instances = [];
  MockAudioElement.instances = [];
  MockAudioElement.nextPlayError = null;
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
  it('supports configurable analysers and custom band ranges', async () => {
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

    const musicWaveform = new Uint8Array(512);
    musicWaveform.fill(127);
    musicWaveform[0] = 10;
    musicWaveform[1] = 240;
    musicAnalyser.waveformData = musicWaveform as Uint8Array<ArrayBuffer>;

    expect(audio.getWaveform()).toEqual(musicWaveform);
    expect(audio.getWaveform('music')).toEqual(musicWaveform);
    expect(audio.getWaveform('mic')).toBeNull();

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
  });

  it('tracks separate load and mic errors and cleans up lifecycle resources', async () => {
    const onError = vi.fn();
    const onLoadError = vi.fn();
    const onMicError = vi.fn();
    const onStateChange = vi.fn();

    const audio = new AudioBands({
      onError,
      onLoadError,
      onMicError,
      onStateChange,
    });

    MockAudioElement.nextPlayError = new Error('blocked');
    await audio.load('/blocked.mp3');
    await expect(audio.play()).rejects.toBeInstanceOf(AudioBandsError);

    expect(onLoadError).toHaveBeenCalledTimes(1);
    expect(onMicError).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(audio.getState().loadError?.kind).toBe('load');
    expect(audio.getState().hasTrack).toBe(true);
    expect(audio.getState().isPlaying).toBe(false);

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
    expect(onStateChange).toHaveBeenCalled();
  });
});
