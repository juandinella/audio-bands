# Changelog

All notable changes to this project will be documented in this file.

This changelog was reconstructed from release commits and tags for the early versions of the package.

## 0.4.0 - 2026-03-27

### Added

- `getWaveform(source?)` now supports both `'music'` and `'mic'`, with `'music'` as the default source.

### Changed

- Updated the React hook types so `getWaveform(source?)` matches the core API.
- Updated the example app to call `getWaveform('mic')` when rendering mic-driven waveform visuals.
- Updated the README and `llms.txt` docs to describe waveform support for both sources.
- Expanded test coverage for waveform reads from music and mic analysers.

## 0.3.0 - 2026-03-23

### Added

- Configurable analyser settings for music and mic inputs.
- Configurable classic band ranges and named custom band ranges.
- Structured `AudioBandsError` handling for load, playback, mic, lifecycle, and config failures.
- Test coverage for the core package and published package entrypoints.

### Changed

- Refined the core API and React wrapper around explicit state and error callbacks.
- Updated documentation and examples to reflect configuration and error-handling support.

## 0.2.0 - 2026-03-23

### Added

- Explicit package entrypoints for the framework-agnostic core and React hook.
- `react-entry` / `core-entry` exports to support package splitting cleanly.
- `llms.txt` in the example app for machine-readable package guidance.

### Changed

- Reworked packaging so consumers can import the core and React APIs separately.
- Updated the example app and docs to match the split package structure.

## 0.1.1 - 2026-03-22

### Changed

- Updated the example app to consume the published npm package instead of local source imports.
- Bumped the package version for the first post-release distribution update.

## 0.1.0 - 2026-03-22

### Added

- Initial release of `@juandinella/audio-bands`.
- Framework-agnostic audio analysis for browser music playback and microphone input.
- React hook wrapper for the core analyser.
- Normalized `bass`, `mid`, `high`, and `overall` band outputs.
- `getFftData(source?)` for raw FFT bins.
- Demo/example visualizer app with multiple visualizations and sample tracks.
- README package documentation and published build artifacts.
