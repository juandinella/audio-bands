"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  AudioBands: () => AudioBands,
  useAudioBands: () => useAudioBands
});
module.exports = __toCommonJS(index_exports);

// src/core.ts
var ZERO = { bass: 0, mid: 0, high: 0, overall: 0 };
function avg(arr, from, to) {
  let sum = 0;
  for (let i = from; i < to; i++) sum += arr[i];
  return sum / (to - from);
}
function computeBands(analyser, data) {
  analyser.getByteFrequencyData(data);
  const len = data.length;
  const bass = avg(data, 0, Math.floor(len * 0.08));
  const mid = avg(data, Math.floor(len * 0.08), Math.floor(len * 0.4));
  const high = avg(data, Math.floor(len * 0.4), len);
  return {
    bass: bass / 255,
    mid: mid / 255,
    high: high / 255,
    overall: (bass * 0.5 + mid * 0.3 + high * 0.2) / 255
  };
}
var AudioBands = class {
  constructor(callbacks = {}) {
    this.ctx = null;
    this.musicAnalyser = null;
    this.musicData = null;
    this.micAnalyser = null;
    this.micData = null;
    this.audioEl = null;
    this.musicSource = null;
    this.micSource = null;
    this.micStream = null;
    this.callbacks = callbacks;
  }
  // Lazy — AudioContext must be created after a user gesture
  ensureCtx() {
    if (this.ctx) return this.ctx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.85;
    analyser.connect(ctx.destination);
    this.ctx = ctx;
    this.musicAnalyser = analyser;
    this.musicData = new Uint8Array(analyser.frequencyBinCount);
    return ctx;
  }
  async load(url) {
    const ctx = this.ensureCtx();
    this.audioEl?.pause();
    if (this.audioEl) this.audioEl.src = "";
    try {
      this.musicSource?.disconnect();
    } catch {
    }
    const audio = new Audio();
    audio.crossOrigin = "anonymous";
    audio.src = url;
    audio.loop = true;
    this.audioEl = audio;
    const source = ctx.createMediaElementSource(audio);
    source.connect(this.musicAnalyser);
    this.musicSource = source;
    try {
      await audio.play();
      this.callbacks.onPlay?.();
    } catch {
      this.callbacks.onError?.();
    }
  }
  togglePlayPause() {
    const audio = this.audioEl;
    if (!audio) return;
    if (audio.paused) {
      audio.play();
      this.callbacks.onPlay?.();
    } else {
      audio.pause();
      this.callbacks.onPause?.();
    }
  }
  async enableMic() {
    const ctx = this.ensureCtx();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.micStream = stream;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      this.micAnalyser = analyser;
      this.micData = new Uint8Array(analyser.frequencyBinCount);
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      this.micSource = source;
      this.callbacks.onMicStart?.();
    } catch {
      console.warn("[audio-bands] Mic access denied");
    }
  }
  disableMic() {
    this.micStream?.getTracks().forEach((t) => t.stop());
    this.micStream = null;
    try {
      this.micSource?.disconnect();
    } catch {
    }
    this.micSource = null;
    this.micAnalyser = null;
    this.micData = null;
    this.callbacks.onMicStop?.();
  }
  // Call inside requestAnimationFrame to get current frequency data
  getBands(source = "music") {
    if (source === "mic") {
      if (!this.micAnalyser || !this.micData) return { ...ZERO };
      return computeBands(this.micAnalyser, this.micData);
    }
    if (!this.musicAnalyser || !this.musicData) return { ...ZERO };
    return computeBands(this.musicAnalyser, this.musicData);
  }
  // Call inside requestAnimationFrame to get raw time-domain waveform
  getWaveform() {
    if (!this.micAnalyser) return null;
    const data = new Uint8Array(this.micAnalyser.fftSize);
    this.micAnalyser.getByteTimeDomainData(data);
    return data;
  }
  // Call when done — stops mic, closes AudioContext
  destroy() {
    this.audioEl?.pause();
    this.micStream?.getTracks().forEach((t) => t.stop());
    this.ctx?.close();
  }
};

// src/react.ts
var import_react = require("react");
function useAudioBands() {
  const [isPlaying, setIsPlaying] = (0, import_react.useState)(false);
  const [micActive, setMicActive] = (0, import_react.useState)(false);
  const [audioError, setAudioError] = (0, import_react.useState)(false);
  const instance = (0, import_react.useRef)(null);
  if (!instance.current) {
    instance.current = new AudioBands({
      onPlay: () => setIsPlaying(true),
      onPause: () => setIsPlaying(false),
      onError: () => setAudioError(true),
      onMicStart: () => setMicActive(true),
      onMicStop: () => setMicActive(false)
    });
  }
  (0, import_react.useEffect)(() => {
    return () => instance.current?.destroy();
  }, []);
  const loadTrack = (0, import_react.useCallback)(async (url) => {
    setAudioError(false);
    await instance.current.load(url);
  }, []);
  const togglePlayPause = (0, import_react.useCallback)(() => {
    instance.current.togglePlayPause();
  }, []);
  const toggleMic = (0, import_react.useCallback)(async () => {
    if (micActive) {
      instance.current.disableMic();
    } else {
      await instance.current.enableMic();
    }
  }, [micActive]);
  const getBands = (0, import_react.useCallback)((source) => {
    return instance.current.getBands(source);
  }, []);
  const getWaveform = (0, import_react.useCallback)(() => {
    return instance.current.getWaveform();
  }, []);
  return {
    isPlaying,
    micActive,
    audioError,
    loadTrack,
    togglePlayPause,
    toggleMic,
    getBands,
    getWaveform
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AudioBands,
  useAudioBands
});
//# sourceMappingURL=index.cjs.map