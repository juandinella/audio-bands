import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: '@juandinella/audio-bands/react',
        replacement: resolve(__dirname, '../src/react-entry.ts'),
      },
      {
        find: '@juandinella/audio-bands/core',
        replacement: resolve(__dirname, '../src/core-entry.ts'),
      },
      {
        find: '@juandinella/audio-bands',
        replacement: resolve(__dirname, '../src/index.ts'),
      },
    ],
  },
});
