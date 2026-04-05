import { expect, test } from '@playwright/test';

test('loads the built core and react bundles in a real browser', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByTestId('core-result')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByTestId('hook-result')).toHaveAttribute('data-ready', 'true');

  const coreResult = JSON.parse(
    (await page.getByTestId('core-result').textContent()) ?? '{}',
  ) as {
    hasTrack: boolean;
    isPlayingAfterPlay: boolean;
    isPlayingAfterPause: boolean;
    fftLength: number;
    waveformLength: number;
  };

  const hookResult = JSON.parse(
    (await page.getByTestId('hook-result').textContent()) ?? '{}',
  ) as {
    hasTrack: boolean;
    isPlayingAfterPlay: boolean;
    isPlayingAfterPause: boolean;
    fftLength: number;
    waveformLength: number;
  };

  expect(coreResult.hasTrack).toBe(true);
  expect(coreResult.isPlayingAfterPlay).toBe(true);
  expect(coreResult.isPlayingAfterPause).toBe(false);
  expect(coreResult.fftLength).toBeGreaterThan(0);
  expect(coreResult.waveformLength).toBeGreaterThan(0);

  expect(hookResult.hasTrack).toBe(true);
  expect(hookResult.isPlayingAfterPlay).toBe(true);
  expect(hookResult.isPlayingAfterPause).toBe(false);
  expect(hookResult.fftLength).toBeGreaterThan(0);
  expect(hookResult.waveformLength).toBeGreaterThan(0);
});
