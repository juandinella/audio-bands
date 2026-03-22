'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { AudioBands } from './core';
import type { Bands, AudioSource } from './types';

export type UseAudioBandsReturn = {
  isPlaying: boolean;
  micActive: boolean;
  audioError: boolean;
  loadTrack: (url: string) => Promise<void>;
  togglePlayPause: () => void;
  toggleMic: () => Promise<void>;
  getBands: (source?: AudioSource) => Bands;
  getWaveform: () => Uint8Array<ArrayBuffer> | null;
};

/**
 * React hook — thin wrapper over AudioBands.
 * Handles lifecycle (destroy on unmount) and exposes state for re-renders.
 */
export function useAudioBands(): UseAudioBandsReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [audioError, setAudioError] = useState(false);

  const instance = useRef<AudioBands | null>(null);

  if (!instance.current) {
    instance.current = new AudioBands({
      onPlay: () => setIsPlaying(true),
      onPause: () => setIsPlaying(false),
      onError: () => setAudioError(true),
      onMicStart: () => setMicActive(true),
      onMicStop: () => setMicActive(false),
    });
  }

  useEffect(() => {
    return () => instance.current?.destroy();
  }, []);

  const loadTrack = useCallback(async (url: string) => {
    setAudioError(false);
    await instance.current!.load(url);
  }, []);

  const togglePlayPause = useCallback(() => {
    instance.current!.togglePlayPause();
  }, []);

  const toggleMic = useCallback(async () => {
    if (micActive) {
      instance.current!.disableMic();
    } else {
      await instance.current!.enableMic();
    }
  }, [micActive]);

  const getBands = useCallback((source?: AudioSource) => {
    return instance.current!.getBands(source);
  }, []);

  const getWaveform = useCallback(() => {
    return instance.current!.getWaveform();
  }, []);

  return {
    isPlaying,
    micActive,
    audioError,
    loadTrack,
    togglePlayPause,
    toggleMic,
    getBands,
    getWaveform,
  };
}
