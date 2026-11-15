# audio-bands website

The Vite + React site includes the landing page, documentation and five live examples. Copyable package integrations also live in `snippets/`.

```sh
npm install
npm run dev
npm run typecheck
npm run build
npm run test:site
```

Run these commands from `examples/`. Browser checks use the repository's Playwright installation; install Chromium with `npx playwright install chromium` from the repository root first.

## Pages

- `/`: introduction and live bass/mid/high meters
- `/docs/`: quick starts, concepts, API, configuration and troubleshooting
- `/examples/`: ordered example collection
- `/examples/pulse/`: one band driving CSS scale
- `/examples/bands/`: three independent DOM meters
- `/examples/spectrum/`: FFT bins drawn on Canvas
- `/examples/microphone/`: microphone waveform
- `/examples/three/`: dynamically imported Three.js particle sculpture

Playback starts from an explicit click after the selected same-origin track has loaded. Microphone access requires HTTPS or localhost. Pausing preserves the track position. Audio resources, animation loops and WebGL resources are released on unmount. Reduced-motion users get static spatial visuals and slower data updates.

## Static publishing

`npm run build` builds the browser bundle, renders each route to HTML, and writes `dist/`. Deploy that directory as a static site. Each route has an `index.html`; there is no SPA catch-all requirement. Configure the host to serve `404.html` with a 404 status for missing routes.

The build also generates a sitemap, PNG social image, `/docs.md` from the package README, and downloadable demo source. Page titles, canonical URLs, descriptions, Open Graph and JSON-LD are derived from `src/content.ts` and `src/metadata.ts`. The canonical domain is `https://audio-bands.juandinella.com`; update it in the content, build script and `public/robots.txt` when changing domains.

`public/llms.txt` links to documentation and examples and explains the API's limits. Keep it aligned with the package README. Structured data and machine-readable text help discovery; they do not guarantee search rankings or citations.

## Source

- `src/Demo.tsx`: shared playback, mic controls, DOM meters and Canvas renderers
- `src/three-scene.ts`: Three.js renderer and resource cleanup
- `src/content.ts`: example descriptions, teaching excerpts and complete quick starts
- `src/Docs.tsx`: browser documentation

The site aliases audio-bands to the repository source. Three.js and Sharp are website-only dependencies; neither is added to the published library. Three.js is loaded only on the advanced example route. Sharp generates the social image at build time.
