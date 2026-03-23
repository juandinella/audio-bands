import type { AudioBandsErrorCode, AudioBandsErrorKind } from './types';

export class AudioBandsError extends Error {
  readonly kind: AudioBandsErrorKind;
  readonly code: AudioBandsErrorCode;
  readonly cause?: unknown;

  constructor(
    kind: AudioBandsErrorKind,
    code: AudioBandsErrorCode,
    message: string,
    cause?: unknown,
  ) {
    super(message);
    this.name = 'AudioBandsError';
    this.kind = kind;
    this.code = code;
    this.cause = cause;
  }
}
