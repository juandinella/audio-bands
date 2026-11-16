# audio-bands

Headless browser audio analysis, published on npm as `@juandinella/audio-bands`. Usage and API in `README.md`; release history in `CHANGELOG.md`.

## Commands

- `npm run build` (tsup), `npm test` (build + vitest), `npm run test:browser` (Playwright), `npm run test:release`.

## Verify

Before calling a change done, run these checks and paste the output; saying they pass isn't enough:

- `npm test`.
- Audio, microphone or React hook changes: `npm run test:browser`.
- Anything that touches exports, `package.json` or the build: `npm run test:release`.

To review a diff, follow `REVIEW.md`.

## Rules

- Public package and public repo: keep the README API in sync and log user-facing changes in `CHANGELOG.md`.
- Don't publish to npm or tag a release without an explicit request.
