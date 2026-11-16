# Review

What to check when reviewing a change here. Public API in `README.md`, release history in `CHANGELOG.md`.

## What a failure looks like

- A change to the public API (exports from `.`, `./core`, `./react`, hook options, return shapes) without matching updates to `README.md` and `CHANGELOG.md`.
- A breaking change shipped under a patch or minor version.
- A published package missing an entry point or file. `npm run test:release` packs and imports it.
- `AudioContext`s or microphone tracks left open after unmount or reconfiguration.

## Juan always reads

- `.github/workflows/publish.yml` and `release-check.yml`.
- `package.json` fields `version`, `exports`, `files` and `peerDependencies`.
- `scripts/release-check.mjs`.

## Skip

- `examples/proto/`, an in-progress prototype.
- `dist/`, `test-results/`.

## Format

- Open with the number of findings. If there is nothing to fix, say so in one line.
- Every finding with file and line, and what happens if it isn't fixed.
- Separate new bugs from ones that existed before the change.
- Three nits at most.
- If a mistake repeats, name the class of bug and list every place, not just the first.
- After three rounds on the same change, review only the new diff or suggest a different approach.

## When something slips through

A bug that reached a release gets a regression test. If the pattern can recur, add it under "What a failure looks like".
