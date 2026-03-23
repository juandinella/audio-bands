import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/core-entry.ts', 'src/react-entry.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  external: ['react'],
  sourcemap: true,
});
