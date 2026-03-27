# Changelog

All notable changes to this project will be documented in this file.

## 0.4.0 - 2026-03-27

### Added

- `getWaveform(source?)` now supports both `'music'` and `'mic'`, with `'music'` as the default source.

### Changed

- Updated the React hook types so `getWaveform(source?)` matches the core API.
- Updated the example app to call `getWaveform('mic')` when rendering mic-driven waveform visuals.
- Refreshed the README and `llms.txt` docs to describe waveform support for both sources.
- Expanded test coverage for waveform reads from music and mic analysers.
