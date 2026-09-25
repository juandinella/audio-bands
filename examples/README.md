# Examples

This directory now has two roles:

- `src/App.tsx`: the visual showcase demo
- `snippets/`: minimal copyable examples focused on the public API

Start with the snippets if you want the smallest correct integration:

- `snippets/basic-vanilla.ts`
- `snippets/basic-react.tsx`
- `snippets/mic-input.ts`

Use the showcase app when you want to see the package driving richer visuals.

The vanilla and mic snippets export mount functions that take a button and an output element. Call the returned function when removing that UI to cancel its animation loop and release audio resources. Mic access needs HTTPS or localhost.

The React snippet separates loading from playback so `play()` runs directly from a user gesture. Its animation loop runs during playback and is cancelled on pause or unmount. For canvas visualizations, draw from `snapshot()` inside the loop instead of putting every frame in React state.
