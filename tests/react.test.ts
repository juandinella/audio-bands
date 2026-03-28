// @vitest-environment jsdom

import { StrictMode, createElement } from 'react';
import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/core', () => {
  class MockAudioBandsError extends Error {
    kind: string;
    code: string;

    constructor(kind: string, code: string, message: string) {
      super(message);
      this.name = 'AudioBandsError';
      this.kind = kind;
      this.code = code;
    }
  }

  class MockAudioBands {
    static instances: MockAudioBands[] = [];
    static nextPlayError: MockAudioBandsError | null = null;

    readonly options: any;
    destroyed = false;
    readonly state = {
      isPlaying: false,
      micActive: false,
      hasTrack: false,
      loadError: null,
      playbackError: null,
      micError: null,
    };

    constructor(options: any = {}) {
      this.options = options;
      MockAudioBands.instances.push(this);
    }

    private ensureNotDestroyed() {
      if (this.destroyed) {
        throw new MockAudioBandsError(
          'lifecycle',
          'destroyed',
          'This AudioBands instance was destroyed',
        );
      }
    }

    getState = vi.fn(() => {
      this.ensureNotDestroyed();
      return { ...this.state };
    });
    load = vi.fn(async () => {
      this.ensureNotDestroyed();
    });
    play = vi.fn(async () => {
      this.ensureNotDestroyed();
      if (MockAudioBands.nextPlayError) {
        const error = MockAudioBands.nextPlayError;
        MockAudioBands.nextPlayError = null;
        this.state.playbackError = error;
        this.options.onPlaybackError?.(error);
        this.options.onError?.(error);
        this.options.onStateChange?.({ ...this.state });
        throw error;
      }

      this.state.isPlaying = true;
      this.state.playbackError = null;
      this.options.onPlay?.();
      this.options.onStateChange?.({ ...this.state });
    });
    pause = vi.fn(() => {
      this.ensureNotDestroyed();
      this.state.isPlaying = false;
      this.options.onPause?.();
      this.options.onStateChange?.({ ...this.state });
    });
    togglePlayPause = vi.fn(async () => {
      this.ensureNotDestroyed();
    });
    enableMic = vi.fn(async () => {
      this.ensureNotDestroyed();
    });
    disableMic = vi.fn(() => {
      this.ensureNotDestroyed();
    });
    setLoop = vi.fn(() => {
      this.ensureNotDestroyed();
    });
    seek = vi.fn(() => {
      this.ensureNotDestroyed();
    });
    getDuration = vi.fn(() => {
      this.ensureNotDestroyed();
      return 123;
    });
    getCurrentTime = vi.fn(() => {
      this.ensureNotDestroyed();
      return 45;
    });
    snapshot = vi.fn(() => {
      this.ensureNotDestroyed();
      return {
        bands: { bass: 0, mid: 0, high: 0, overall: 0 },
        customBands: {},
        fft: null,
        waveform: null,
      };
    });
    getBands = vi.fn(() => {
      this.ensureNotDestroyed();
      return { bass: 0, mid: 0, high: 0, overall: 0 };
    });
    getCustomBands = vi.fn(() => {
      this.ensureNotDestroyed();
      return {};
    });
    getFftData = vi.fn(() => {
      this.ensureNotDestroyed();
      return null;
    });
    getWaveform = vi.fn(() => {
      this.ensureNotDestroyed();
      return null;
    });
    destroy = vi.fn(() => {
      this.destroyed = true;
    });
  }

  return { AudioBands: MockAudioBands, AudioBandsError: MockAudioBandsError };
});

import { AudioBands, AudioBandsError } from '../src/core';
import { useAudioBands } from '../src/react';

const MockAudioBands = AudioBands as unknown as {
  nextPlayError: InstanceType<typeof AudioBandsError> | null;
  instances: Array<{
    destroy: ReturnType<typeof vi.fn>;
    load: ReturnType<typeof vi.fn>;
    play: ReturnType<typeof vi.fn>;
    togglePlayPause: ReturnType<typeof vi.fn>;
    setLoop: ReturnType<typeof vi.fn>;
    seek: ReturnType<typeof vi.fn>;
    getDuration: ReturnType<typeof vi.fn>;
    getCurrentTime: ReturnType<typeof vi.fn>;
  }>;
};

describe('useAudioBands', () => {
  it('recreates the instance when structural options change', () => {
    MockAudioBands.instances.length = 0;
    MockAudioBands.nextPlayError = null;

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
    MockAudioBands.nextPlayError = null;
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
    MockAudioBands.nextPlayError = null;

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

  it('keeps hook state synchronized with play lifecycle', async () => {
    MockAudioBands.instances.length = 0;
    MockAudioBands.nextPlayError = null;
    const onPlay = vi.fn();

    const { result } = renderHook(() => useAudioBands({ onPlay }));

    expect(result.current.isPlaying).toBe(false);
    expect(result.current.audioError).toBe(false);

    await act(async () => {
      await result.current.play();
    });

    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(result.current.isPlaying).toBe(true);
    expect(result.current.state.isPlaying).toBe(true);
    expect(result.current.playbackError).toBeNull();
  });

  it('surfaces playback errors to hook consumers', async () => {
    MockAudioBands.instances.length = 0;
    const onError = vi.fn();
    const onPlaybackError = vi.fn();
    const playbackError = new AudioBandsError(
      'playback',
      'playback_error',
      'Playback blocked',
    );
    MockAudioBands.nextPlayError = playbackError;

    const { result } = renderHook(() =>
      useAudioBands({ onError, onPlaybackError }),
    );

    await act(async () => {
      await expect(result.current.play()).rejects.toBe(playbackError);
    });

    expect(onPlaybackError).toHaveBeenCalledWith(playbackError);
    expect(onError).toHaveBeenCalledWith(playbackError);
    expect(result.current.audioError).toBe(true);
    expect(result.current.playbackError).toBe(playbackError);
    expect(result.current.state.playbackError).toBe(playbackError);
  });

  it('forwards togglePlayPause as an async contract', async () => {
    MockAudioBands.instances.length = 0;
    MockAudioBands.nextPlayError = null;

    const { result } = renderHook(() => useAudioBands());
    const instance = MockAudioBands.instances[0];
    instance.togglePlayPause.mockResolvedValue(undefined);

    await act(async () => {
      await result.current.togglePlayPause();
    });

    expect(instance.togglePlayPause).toHaveBeenCalledTimes(1);
  });

  it('recreates a usable instance after StrictMode cleanup cycles', async () => {
    MockAudioBands.instances.length = 0;
    MockAudioBands.nextPlayError = null;

    const wrapper = ({ children }: { children: ReactNode }) => (
      createElement(StrictMode, null, children)
    );

    const { result } = renderHook(() => useAudioBands(), { wrapper });

    await act(async () => {
      await expect(result.current.loadTrack('/track.mp3')).resolves.toBeUndefined();
    });

    expect(
      MockAudioBands.instances.some(
        (instance) => !instance.destroyed && instance.load.mock.calls.length > 0,
      ),
    ).toBe(true);
  });
});
