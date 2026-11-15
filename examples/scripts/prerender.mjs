import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { render, pages } from '../.ssr/entry-server.js';

const dist = resolve('dist');
await sharp(resolve('public/social.svg')).png().toFile(resolve(dist, 'social.png'));
// iOS ignores SVG icons and rounds the corners itself: a full-bleed square.
await sharp(resolve('public/favicon.svg'), { density: 360 }).resize(180, 180).flatten({ background: '#0d0f12' }).png().toFile(resolve(dist, 'apple-touch-icon.png'));
const template = await readFile(resolve(dist, 'index.html'), 'utf8');
for (const { path } of [...pages, { path: '/404/' }]) {
  const { html, head } = render(path);
  const directory = resolve(dist, `.${path}`);
  await mkdir(directory, { recursive: true });
  const output = template.replace('<!--page-head-->', head).replace('<div id="root"></div>', `<div id="root">${html}</div>`);
  await writeFile(resolve(directory, 'index.html'), output);
  if (path === '/404/') await writeFile(resolve(dist, '404.html'), output);
}
const origin = 'https://audio-bands.juandinella.com';
await writeFile(resolve(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pages.map(({ path }) => `<url><loc>${origin}${path}</loc></url>`).join('')}</urlset>\n`);
await copyFile(resolve('../README.md'), resolve(dist, 'docs.md'));
await mkdir(resolve(dist, 'source'), { recursive: true });
for (const file of ['examples/Stage.tsx', 'examples/sculpture.ts', 'content.ts']) {
  await copyFile(resolve('src', file), resolve(dist, 'source', file.split('/').pop()));
}
console.log(`Prerendered ${pages.length} pages, a 404 page, sitemap, Markdown documentation and example sources.`);
