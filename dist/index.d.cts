type Bands = {
    bass: number;
    mid: number;
    high: number;
    overall: number;
};
type AudioSource = 'music' | 'mic';
type AudioBandsCallbacks = {
    onPlay?: () => void;
    onPause?: () => void;
    onError?: () => void;
    onMicStart?: () => void;
    onMicStop?: () => void;
};

/**
 * Vanilla JS class — no framework dependency.
 * Works in React, Vue, Svelte, or plain HTML.
 *
 * Call destroy() when done to close the AudioContext and stop the mic.
 */
declare class AudioBands {
    private callbacks;
    private ctx;
    private musicAnalyser;
    private musicData;
    private micAnalyser;
    private micData;
    private audioEl;
    private musicSource;
    private micSource;
    private micStream;
    constructor(callbacks?: AudioBandsCallbacks);
    private ensureCtx;
    load(url: string): Promise<void>;
    togglePlayPause(): void;
    enableMic(): Promise<void>;
    disableMic(): void;
    getBands(source?: AudioSource): Bands;
    getFftData(source?: AudioSource): Uint8Array<ArrayBuffer> | null;
    getWaveform(): Uint8Array<ArrayBuffer> | null;
    destroy(): void;
}

type UseAudioBandsReturn = {
    isPlaying: boolean;
    micActive: boolean;
    audioError: boolean;
    loadTrack: (url: string) => Promise<void>;
    togglePlayPause: () => void;
    toggleMic: () => Promise<void>;
    getBands: (source?: AudioSource) => Bands;
    getFftData: (source?: AudioSource) => Uint8Array<ArrayBuffer> | null;
    getWaveform: () => Uint8Array<ArrayBuffer> | null;
};
/**
 * React hook — thin wrapper over AudioBands.
 * Handles lifecycle (destroy on unmount) and exposes state for re-renders.
 */
declare function useAudioBands(): UseAudioBandsReturn;

export { AudioBands, type AudioBandsCallbacks, type AudioSource, type Bands, type UseAudioBandsReturn, useAudioBands };
