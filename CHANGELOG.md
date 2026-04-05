# Changelog

All notable changes to this project will be documented in this file.

This changelog was reconstructed from release commits and tags for the early versions of the package.

## 0.6.1 - 2026-04-05

### Fixed

- Removed the npm self-update step from the publish workflow so GitHub Actions can publish reliably with the npm version bundled by `actions/setup-node`.

## 0.6.0 - 2026-04-05

### Added

- Browser smoke coverage with Playwright to validate the built core and React bundles in a real Chromium runtime.

### Changed

- `isPlaying` now follows real media-element events, including pause and natural track end.
- README and package metadata were polished for public consumption, including valid repository links and explicit development/release notes.

### Fixed

- `load()` now resolves when the media is actually ready instead of resolving immediately after wiring the element.
- Real track loading failures now surface through `loadError` with state that reflects whether a usable track is present.
- Playwright test artifacts are now ignored in git so local browser runs do not dirty the worktree.

## 0.5.0 - 2026-03-28

### Added

- `snapshot(source?)` as the preferred one-call analysis read for bands, custom bands, FFT data, and waveform data.
- Basic track transport helpers: `play()`, `pause()`, `setLoop()`, `seek()`, `getDuration()`, and `getCurrentTime()`.
- Hook test coverage for structural option changes, latest callback closures, state synchronization, error forwarding, and unmount cleanup.

### Changed

- `load()` now prepares a track without starting playback.
- `togglePlayPause()` now follows the same async contract as `play()` and rejects when playback fails.
- React hook instances are recreated when structural analyser options change.
- Documentation now centers the package around headless analysis, with `snapshot()` as the primary read path.
- Clarified the semantics of `bass`, `mid`, `high`, and `overall` as analyser/UI signals rather than physical loudness metrics.

### Fixed

- Split track load failures from playback failures in state with separate `loadError` and `playbackError` fields.
- Playback failures now surface consistently as `kind: 'playback'` / `code: 'playback_error'`.
- Expanded core tests around empty analysis reads, playback error reset behavior, and async toggle playback behavior.

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
