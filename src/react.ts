'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { AudioBands } from './core';
import type {
  AudioBandsOptions,
  AudioBandsSnapshot,
  AudioBandsState,
  AudioSource,
  Bands,
} from './types';
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
  play: () => Promise<void>;
  pause: () => void;
  togglePlayPause: () => void;
  toggleMic: () => Promise<void>;
  snapshot: (source?: AudioSource) => AudioBandsSnapshot;
  getBands: (source?: AudioSource) => Bands;
  getCustomBands: (source?: AudioSource) => Record<string, number>;
  getFftData: (source?: AudioSource) => Uint8Array<ArrayBuffer> | null;
  getWaveform: (source?: AudioSource) => Uint8Array<ArrayBuffer> | null;
};

const INITIAL_STATE: AudioBandsState = {
  isPlaying: false,
  micActive: false,
  hasTrack: false,
  loadError: null,
  micError: null,
};

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nestedValue]) => `${JSON.stringify(key)}:${stableStringify(nestedValue)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value) ?? 'null';
}

function getStructuralOptionsKey(options: AudioBandsOptions): string {
  return stableStringify({
    music: options.music,
    mic: options.mic,
    bandRanges: options.bandRanges,
    customBands: options.customBands,
  });
}

function createAudioBandsInstance(
  options: AudioBandsOptions,
  latestOptions: MutableRefObject<AudioBandsOptions>,
  setState: Dispatch<SetStateAction<AudioBandsState>>,
  instanceRef: MutableRefObject<AudioBands | null>,
): AudioBands {
  const next = new AudioBands({
    ...options,
    onPlay: () => {
      if (instanceRef.current !== next) return;
      latestOptions.current.onPlay?.();
    },
    onPause: () => {
      if (instanceRef.current !== next) return;
      latestOptions.current.onPause?.();
    },
    onError: (error) => {
      if (instanceRef.current !== next) return;
      latestOptions.current.onError?.(error);
    },
    onLoadError: (error) => {
      if (instanceRef.current !== next) return;
      latestOptions.current.onLoadError?.(error);
    },
    onMicError: (error) => {
      if (instanceRef.current !== next) return;
      latestOptions.current.onMicError?.(error);
    },
    onMicStart: () => {
      if (instanceRef.current !== next) return;
      latestOptions.current.onMicStart?.();
    },
    onMicStop: () => {
      if (instanceRef.current !== next) return;
      latestOptions.current.onMicStop?.();
    },
    onStateChange: (nextState) => {
      if (instanceRef.current !== next) return;
      setState(nextState);
      latestOptions.current.onStateChange?.(nextState);
    },
  });

  return next;
}

/**
 * React hook — thin wrapper over AudioBands.
 * Handles lifecycle (destroy on unmount) and exposes state for re-renders.
 */
export function useAudioBands(options: AudioBandsOptions = {}): UseAudioBandsReturn {
  const [state, setState] = useState<AudioBandsState>(INITIAL_STATE);
  const latestOptions = useRef(options);
  const instance = useRef<AudioBands | null>(null);
  const structuralOptionsKey = getStructuralOptionsKey(options);
  const structuralOptionsKeyRef = useRef(structuralOptionsKey);

  latestOptions.current = options;

  if (!instance.current) {
    instance.current = createAudioBandsInstance(options, latestOptions, setState, instance);
  }

  useEffect(() => {
    setState(instance.current!.getState());
    return () => instance.current?.destroy();
  }, []);

  useEffect(() => {
    if (structuralOptionsKeyRef.current === structuralOptionsKey) return;

    const previous = instance.current;
    const next = createAudioBandsInstance(options, latestOptions, setState, instance);
    instance.current = next;
    structuralOptionsKeyRef.current = structuralOptionsKey;
    setState(next.getState());
    previous?.destroy();
  }, [options, structuralOptionsKey]);

  const loadTrack = useCallback(async (url: string) => {
    await instance.current!.load(url);
  }, []);

  const play = useCallback(async () => {
    await instance.current!.play();
  }, []);

  const pause = useCallback(() => {
    instance.current!.pause();
  }, []);

  const togglePlayPause = useCallback(() => {
    instance.current!.togglePlayPause();
  }, []);

  const toggleMic = useCallback(async () => {
    if (instance.current!.getState().micActive) {
      instance.current!.disableMic();
    } else {
      await instance.current!.enableMic();
    }
  }, []);

  const snapshot = useCallback((source?: AudioSource) => {
    return instance.current!.snapshot(source);
  }, []);

  const getBands = useCallback((source?: AudioSource) => {
    return instance.current!.getBands(source);
  }, []);

  const getCustomBands = useCallback((source?: AudioSource) => {
    return instance.current!.getCustomBands(source);
  }, []);

  const getFftData = useCallback((source?: AudioSource) => {
    return instance.current!.getFftData(source);
  }, []);

  const getWaveform = useCallback((source?: AudioSource) => {
    return instance.current!.getWaveform(source);
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
    play,
    pause,
    togglePlayPause,
    toggleMic,
    snapshot,
    getBands,
    getCustomBands,
    getFftData,
    getWaveform,
  };
}
