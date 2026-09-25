import { test, expect } from '@playwright/test';
import { pages } from '../src/content';

test('every route has crawlable HTML and unique metadata before JavaScript', async ({ browser, request }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  const titles = new Set<string>();
  for (const route of pages) {
    await page.goto(`http://127.0.0.1:4175${route.path}`);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).not.toBeEmpty();
    await expect(page).toHaveTitle(route.title);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://audio-bands.juandinella.com${route.path}`);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', route.description);
    const schema = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent() ?? '{}');
    expect(schema['@graph'].length).toBeGreaterThan(1);
    titles.add(await page.title());
  }
  expect(titles.size).toBe(pages.length);
  for (const asset of ['/robots.txt', '/sitemap.xml', '/llms.txt', '/docs.md', '/social.png', '/source/Demo.tsx', '/source/three-scene.ts']) {
    const response = await request.get(asset);
    expect(response.ok(), asset).toBeTruthy();
    expect((await response.body()).length).toBeGreaterThan(30);
  }
  await context.close();
});

test('all examples render on mobile without overflow or hydration errors', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const route of pages) {
    await page.goto(route.path);
    await expect(page.locator('h1')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), route.path).toBeTruthy();
    if (route.path === '/') await page.screenshot({ path: 'test-results/home-mobile.png', fullPage: true });
  }
  expect(errors).toEqual([]);
});

test('playback produces data, pauses and resumes without reloading', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      Object.assign(window, { demoMedia: this });
      return original.call(this);
    };
  });
  await page.goto('/');
  const play = page.getByRole('button', { name: 'Play track' });
  await expect(play).toBeEnabled();
  await play.click();
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  await expect.poll(async () => Number(await page.locator('[data-value="bass"]').textContent())).toBeGreaterThan(0);
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Pause' }).click();
  const time = await page.evaluate(() => (window as Window & { demoMedia: HTMLMediaElement }).demoMedia.currentTime);
  await page.getByRole('button', { name: 'Play track' }).click();
  const resumed = await page.evaluate(() => (window as Window & { demoMedia: HTMLMediaElement }).demoMedia.currentTime);
  expect(resumed).toBeGreaterThanOrEqual(time);
  await page.getByLabel('Demo track').selectOption('1');
  await expect(page.getByRole('button', { name: 'Play track' })).toBeEnabled();
  await expect(page.locator('[data-value="bass"]')).toHaveText('0.00');
});

test('microphone starts and stops with a real analyser', async ({ page, context }) => {
  await context.grantPermissions(['microphone']);
  await page.goto('/examples/microphone/');
  await page.getByRole('button', { name: 'Enable microphone' }).click();
  await expect(page.getByRole('button', { name: 'Stop microphone' })).toBeVisible();
  await expect.poll(async () => Number(await page.locator('[data-value="bass"]').textContent())).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Stop microphone' }).click();
  await expect(page.getByRole('button', { name: 'Enable microphone' })).toBeVisible();
  await expect(page.locator('[data-value="bass"]')).toHaveText('0.00');
});

test('Three.js is lazy and its scene renders during playback', async ({ page }) => {
  const errors: string[] = [];
  const requests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(request.url()));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Play track' })).toBeEnabled();
  expect(requests.some(url => url.includes('three-scene-'))).toBeFalsy();
  await page.goto('/examples/three/');
  await expect.poll(() => requests.some(url => url.includes('three-scene-'))).toBeTruthy();
  await page.getByRole('button', { name: 'Play track' }).click();
  await expect.poll(async () => Number(await page.locator('[data-value="bass"]').textContent())).toBeGreaterThan(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/three-desktop.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('docs copy, keyboard navigation and reduced motion work', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/docs/');
  await page.getByRole('button', { name: 'Copy Terminal' }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('npm install @juandinella/audio-bands');
  await page.getByRole('button', { name: 'React', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Copy Pulse.jsx' })).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/examples/pulse/');
  await expect(page.getByText('Reduced motion:', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Play track' }).click();
  await expect.poll(async () => Number(await page.locator('[data-value="bass"]').textContent())).toBeGreaterThan(0);
  await expect(page.locator('.pulse-circle')).toHaveCSS('transform', 'matrix(0.8, 0, 0, 0.8, 0, 0)');
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByText('Skip to content', { exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'test-results/home-desktop.png', fullPage: true });
});

test('load and microphone failures have actionable feedback', async ({ page, context }) => {
  await page.route('**/audio/*.ogg', route => route.abort());
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('could not load');
  await page.unroute('**/audio/*.ogg');
  await page.getByLabel('Demo track').selectOption('1');
  await expect(page.getByRole('button', { name: 'Play track' })).toBeEnabled();
  await context.clearPermissions();
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Denied', 'NotAllowedError'));
  });
  await page.goto('/examples/microphone/');
  await page.getByRole('button', { name: 'Enable microphone' }).click();
  await expect(page.getByRole('alert')).toContainText('Allow microphone access');
});
