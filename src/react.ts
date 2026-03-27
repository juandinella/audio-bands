'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { AudioBands } from './core';
import type { AudioBandsOptions, AudioBandsState, AudioSource, Bands } from './types';
import type { AudioBandsError } from './errors';

export type UseAudioBandsReturn = {
  isPlaying: boolean;
  micActive: boolean;
  hasTrack: boolean;
  audioError: boolean;
  loadError: AudioBandsError | null;
  micError: AudioBandsError | null;
  state: AudioBandsState;
  loadTrack: (url: string) => Promise<void>;
  togglePlayPause: () => void;
  toggleMic: () => Promise<void>;
  getBands: (source?: AudioSource) => Bands;
  getCustomBands: (source?: AudioSource) => Record<string, number>;
  getFftData: (source?: AudioSource) => Uint8Array<ArrayBuffer> | null;
  getWaveform: () => Uint8Array<ArrayBuffer> | null;
};

const INITIAL_STATE: AudioBandsState = {
  isPlaying: false,
  micActive: false,
  hasTrack: false,
  loadError: null,
  micError: null,
};

/**
 * React hook — thin wrapper over AudioBands.
 * Handles lifecycle (destroy on unmount) and exposes state for re-renders.
 */
export function useAudioBands(options: AudioBandsOptions = {}): UseAudioBandsReturn {
  const [state, setState] = useState<AudioBandsState>(INITIAL_STATE);
  const latestOptions = useRef(options);
  const instance = useRef<AudioBands | null>(null);

  latestOptions.current = options;

  const getInstance = () => {
    if (instance.current) return instance.current;

    instance.current = new AudioBands({
      ...options,
      onPlay: () => {
        latestOptions.current.onPlay?.();
      },
      onPause: () => {
        latestOptions.current.onPause?.();
      },
      onError: (error) => {
        latestOptions.current.onError?.(error);
      },
      onLoadError: (error) => {
        latestOptions.current.onLoadError?.(error);
      },
      onMicError: (error) => {
        latestOptions.current.onMicError?.(error);
      },
      onMicStart: () => {
        latestOptions.current.onMicStart?.();
      },
      onMicStop: () => {
        latestOptions.current.onMicStop?.();
      },
      onStateChange: (nextState) => {
        setState(nextState);
        latestOptions.current.onStateChange?.(nextState);
      },
    });

    return instance.current;
  };

  const currentInstance = getInstance();

  useEffect(() => {
    setState(currentInstance.getState());
    return () => {
      const next = instance.current;
      instance.current = null;
      next?.destroy();
    };
  }, []);

  const loadTrack = useCallback(async (url: string) => {
    await getInstance().load(url);
  }, []);

  const togglePlayPause = useCallback(() => {
    getInstance().togglePlayPause();
  }, []);

  const toggleMic = useCallback(async () => {
    const next = getInstance();
    if (next.getState().micActive) {
      next.disableMic();
    } else {
      await next.enableMic();
    }
  }, []);

  const getBands = useCallback((source?: AudioSource) => {
    return getInstance().getBands(source);
  }, []);

  const getCustomBands = useCallback((source?: AudioSource) => {
    return getInstance().getCustomBands(source);
  }, []);

  const getFftData = useCallback((source?: AudioSource) => {
    return getInstance().getFftData(source);
  }, []);

  const getWaveform = useCallback(() => {
    return getInstance().getWaveform();
  }, []);

  return {
    isPlaying: state.isPlaying,
    micActive: state.micActive,
    hasTrack: state.hasTrack,
    audioError: Boolean(state.loadError || state.micError),
    loadError: state.loadError,
    micError: state.micError,
    state,
    loadTrack,
    togglePlayPause,
    toggleMic,
    getBands,
    getCustomBands,
    getFftData,
    getWaveform,
  };
}
