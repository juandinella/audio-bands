// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/core', () => {
  class MockAudioBands {
    static instances: MockAudioBands[] = [];

    readonly options: any;
    readonly state = {
      isPlaying: false,
      micActive: false,
      hasTrack: false,
      loadError: null,
      micError: null,
    };

    constructor(options: any = {}) {
      this.options = options;
      MockAudioBands.instances.push(this);
    }

    getState = vi.fn(() => ({ ...this.state }));
    load = vi.fn(async () => undefined);
    play = vi.fn(async () => {
      this.state.isPlaying = true;
      this.options.onPlay?.();
      this.options.onStateChange?.({ ...this.state });
    });
    pause = vi.fn(() => {
      this.state.isPlaying = false;
      this.options.onPause?.();
      this.options.onStateChange?.({ ...this.state });
    });
    togglePlayPause = vi.fn(() => undefined);
    enableMic = vi.fn(async () => undefined);
    disableMic = vi.fn(() => undefined);
    setLoop = vi.fn(() => undefined);
    seek = vi.fn(() => undefined);
    getDuration = vi.fn(() => 123);
    getCurrentTime = vi.fn(() => 45);
    snapshot = vi.fn(() => ({
      bands: { bass: 0, mid: 0, high: 0, overall: 0 },
      customBands: {},
      fft: null,
      waveform: null,
    }));
    getBands = vi.fn(() => ({ bass: 0, mid: 0, high: 0, overall: 0 }));
    getCustomBands = vi.fn(() => ({}));
    getFftData = vi.fn(() => null);
    getWaveform = vi.fn(() => null);
    destroy = vi.fn(() => undefined);
  }

  return { AudioBands: MockAudioBands };
});

import { AudioBands } from '../src/core';
import { useAudioBands } from '../src/react';

const MockAudioBands = AudioBands as unknown as {
  instances: Array<{
    destroy: ReturnType<typeof vi.fn>;
    play: ReturnType<typeof vi.fn>;
    setLoop: ReturnType<typeof vi.fn>;
    seek: ReturnType<typeof vi.fn>;
    getDuration: ReturnType<typeof vi.fn>;
    getCurrentTime: ReturnType<typeof vi.fn>;
  }>;
};

describe('useAudioBands', () => {
  it('recreates the instance when structural options change', () => {
    MockAudioBands.instances.length = 0;

    const { rerender } = renderHook(
      ({ fftSize }) => useAudioBands({ music: { fftSize } }),
      { initialProps: { fftSize: 256 } },
    );

    expect(MockAudioBands.instances).toHaveLength(1);

    rerender({ fftSize: 512 });

    expect(MockAudioBands.instances).toHaveLength(2);
    expect(MockAudioBands.instances[0].destroy).toHaveBeenCalledTimes(1);
    expect(MockAudioBands.instances[1].destroy).not.toHaveBeenCalled();
  });

  it('uses the latest callback closures without recreating the instance', async () => {
    MockAudioBands.instances.length = 0;
    const firstOnPlay = vi.fn();
    const secondOnPlay = vi.fn();

    const { result, rerender } = renderHook(
      ({ onPlay }) => useAudioBands({ onPlay }),
      { initialProps: { onPlay: firstOnPlay } },
    );

    expect(MockAudioBands.instances).toHaveLength(1);

    rerender({ onPlay: secondOnPlay });

    expect(MockAudioBands.instances).toHaveLength(1);

    await act(async () => {
      await result.current.play();
    });

    expect(firstOnPlay).not.toHaveBeenCalled();
    expect(secondOnPlay).toHaveBeenCalledTimes(1);
  });

  it('forwards transport helpers and destroys the instance on unmount', () => {
    MockAudioBands.instances.length = 0;

    const { result, unmount } = renderHook(() => useAudioBands());
    const instance = MockAudioBands.instances[0];

    result.current.setLoop(true);
    result.current.seek(10);
    expect(result.current.getDuration()).toBe(123);
    expect(result.current.getCurrentTime()).toBe(45);

    expect(instance.setLoop).toHaveBeenCalledWith(true);
    expect(instance.seek).toHaveBeenCalledWith(10);
    expect(instance.getDuration).toHaveBeenCalledTimes(1);
    expect(instance.getCurrentTime).toHaveBeenCalledTimes(1);

    unmount();

    expect(instance.destroy).toHaveBeenCalledTimes(1);
  });
});
