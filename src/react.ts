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
  playbackError: AudioBandsError | null;
  micError: AudioBandsError | null;
  state: AudioBandsState;
  loadTrack: (url: string) => Promise<void>;
  play: () => Promise<void>;
  pause: () => void;
  setLoop: (loop: boolean) => void;
  seek: (seconds: number) => void;
  getDuration: () => number | null;
  getCurrentTime: () => number | null;
  togglePlayPause: () => Promise<void>;
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
  playbackError: null,
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
    onPlaybackError: (error) => {
      if (instanceRef.current !== next) return;
      latestOptions.current.onPlaybackError?.(error);
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

  const getOrCreateInstance = (): AudioBands => {
    if (instance.current) return instance.current;

    const next = createAudioBandsInstance(options, latestOptions, setState, instance);
    instance.current = next;
    structuralOptionsKeyRef.current = structuralOptionsKey;
    return next;
  };

  getOrCreateInstance();

  useEffect(() => {
    const current = getOrCreateInstance();
    setState(current.getState());

    return () => {
      if (instance.current !== current) return;
      current.destroy();
      instance.current = null;
    };
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
    await getOrCreateInstance().load(url);
  }, []);

  const play = useCallback(async () => {
    await getOrCreateInstance().play();
  }, []);

  const pause = useCallback(() => {
    getOrCreateInstance().pause();
  }, []);

  const setLoop = useCallback((loop: boolean) => {
    getOrCreateInstance().setLoop(loop);
  }, []);

  const seek = useCallback((seconds: number) => {
    getOrCreateInstance().seek(seconds);
  }, []);

  const getDuration = useCallback(() => {
    return getOrCreateInstance().getDuration();
  }, []);

  const getCurrentTime = useCallback(() => {
    return getOrCreateInstance().getCurrentTime();
  }, []);

  const togglePlayPause = useCallback(async () => {
    await getOrCreateInstance().togglePlayPause();
  }, []);

  const toggleMic = useCallback(async () => {
    const current = getOrCreateInstance();
    if (current.getState().micActive) {
      current.disableMic();
    } else {
      await current.enableMic();
    }
  }, []);

  const snapshot = useCallback((source?: AudioSource) => {
    return getOrCreateInstance().snapshot(source);
  }, []);

  const getBands = useCallback((source?: AudioSource) => {
    return getOrCreateInstance().getBands(source);
  }, []);

  const getCustomBands = useCallback((source?: AudioSource) => {
    return getOrCreateInstance().getCustomBands(source);
  }, []);

  const getFftData = useCallback((source?: AudioSource) => {
    return getOrCreateInstance().getFftData(source);
  }, []);

  const getWaveform = useCallback((source?: AudioSource) => {
    return getOrCreateInstance().getWaveform(source);
  }, []);

  return {
    isPlaying: state.isPlaying,
    micActive: state.micActive,
    hasTrack: state.hasTrack,
    audioError: Boolean(state.loadError || state.playbackError || state.micError),
    loadError: state.loadError,
    playbackError: state.playbackError,
    micError: state.micError,
    state,
    loadTrack,
    play,
    pause,
    setLoop,
    seek,
    getDuration,
    getCurrentTime,
    togglePlayPause,
    toggleMic,
    snapshot,
    getBands,
    getCustomBands,
    getFftData,
    getWaveform,
  };
}
