'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import type { Bands, AudioSource, UseAudioBandsReturn } from './types';

const ZERO: Bands = { bass: 0, mid: 0, high: 0, overall: 0 };

function avg(arr: Uint8Array, from: number, to: number): number {
  let sum = 0;
  for (let i = from; i < to; i++) sum += arr[i];
  return sum / (to - from);
}

function computeBands(analyser: AnalyserNode, data: Uint8Array<ArrayBuffer>): Bands {
  analyser.getByteFrequencyData(data);
  const len = data.length;
  const bass = avg(data, 0, Math.floor(len * 0.08));
  const mid = avg(data, Math.floor(len * 0.08), Math.floor(len * 0.4));
  const high = avg(data, Math.floor(len * 0.4), len);
  return {
    bass: bass / 255,
    mid: mid / 255,
    high: high / 255,
    overall: (bass * 0.5 + mid * 0.3 + high * 0.2) / 255,
  };
}

function createAudioContext(): AudioContext {
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  return new Ctx();
}

export function useAudioBands(): UseAudioBandsReturn {
  // AudioContext and nodes — useRef because they don't need to trigger re-renders
  const ctxRef = useRef<AudioContext | null>(null);
  const musicAnalyserRef = useRef<AnalyserNode | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const musicDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const micDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const musicSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [audioError, setAudioError] = useState(false);

  // Lazy init — AudioContext must be created after a user gesture
  function ensureCtx(): AudioContext {
    if (ctxRef.current) return ctxRef.current;

    const ctx = createAudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.85;
    analyser.connect(ctx.destination);

    ctxRef.current = ctx;
    musicAnalyserRef.current = analyser;
    musicDataRef.current = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>;

    return ctx;
  }

  const loadTrack = useCallback(async (url: string): Promise<void> => {
    const ctx = ensureCtx();

    // Clean up previous track
    audioElRef.current?.pause();
    if (audioElRef.current) audioElRef.current.src = '';
    try { musicSourceRef.current?.disconnect(); } catch {}

    setAudioError(false);

    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.src = url;
    audio.loop = true;
    audioElRef.current = audio;

    const source = ctx.createMediaElementSource(audio);
    source.connect(musicAnalyserRef.current!);
    musicSourceRef.current = source;

    try {
      await audio.play();
      setIsPlaying(true);
    } catch {
      setAudioError(true);
      setIsPlaying(false);
    }
  }, []);

  const togglePlayPause = useCallback((): void => {
    const audio = audioElRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play();
      setIsPlaying(true);
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }, []);

  const toggleMic = useCallback(async (): Promise<void> => {
    const ctx = ensureCtx();

    if (micActive) {
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
      try { micSourceRef.current?.disconnect(); } catch {}
      micSourceRef.current = null;
      micAnalyserRef.current = null;
      micDataRef.current = null;
      setMicActive(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      micStreamRef.current = stream;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      micAnalyserRef.current = analyser;
      micDataRef.current = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>;

      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      // Not connected to destination — prevents mic feedback
      micSourceRef.current = source;

      setMicActive(true);
    } catch {
      console.warn('[use-audio-bands] Mic access denied');
    }
  }, [micActive]);

  // Call this inside requestAnimationFrame to get current frequency data
  const getBands = useCallback((source: AudioSource = 'music'): Bands => {
    if (source === 'mic') {
      if (!micAnalyserRef.current || !micDataRef.current) return { ...ZERO };
      return computeBands(micAnalyserRef.current, micDataRef.current);
    }
    if (!musicAnalyserRef.current || !musicDataRef.current) return { ...ZERO };
    return computeBands(musicAnalyserRef.current, musicDataRef.current);
  }, []);

  // Call this inside requestAnimationFrame to get raw time-domain waveform
  const getWaveform = useCallback((): Uint8Array<ArrayBuffer> | null => {
    if (!micAnalyserRef.current) return null;
    const data = new Uint8Array(micAnalyserRef.current.fftSize) as Uint8Array<ArrayBuffer>;
    micAnalyserRef.current.getByteTimeDomainData(data);
    return data;
  }, []);

  // Cleanup on unmount — stops mic, closes AudioContext
  useEffect(() => {
    return () => {
      audioElRef.current?.pause();
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      ctxRef.current?.close();
    };
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
