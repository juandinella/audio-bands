import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react(), {
    name: 'site-dev-content',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = req.url?.split('?')[0];
        const sources: Record<string, string> = {
          '/docs.md': '../README.md',
          '/source/Demo.tsx': 'src/Demo.tsx',
          '/source/three-scene.ts': 'src/three-scene.ts',
          '/source/content.ts': 'src/content.ts',
        };
        if (!path || !sources[path]) return next();
        const { readFile } = await import('node:fs/promises');
        try {
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.end(await readFile(resolve(__dirname, sources[path]), 'utf8'));
        } catch (error) { next(error); }
      });
    },
    async transformIndexHtml(html, context) {
      if (!context.server) return html;
      const { renderHead } = await context.server.ssrLoadModule('/src/metadata.ts');
      const pathname = (context.originalUrl ?? context.path).split('?')[0];
      const path = `${pathname.replace(/\/+$/, '')}/`;
      return html.replace('<!--page-head-->', renderHead(path));
    },
  }],
  resolve: {
    alias: [
      {
        find: 'react',
        replacement: resolve(__dirname, 'node_modules/react'),
      },
      {
        find: 'react-dom',
        replacement: resolve(__dirname, 'node_modules/react-dom'),
      },
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
