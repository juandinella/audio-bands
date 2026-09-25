import { expect, test } from '@playwright/test';
import type {} from './fixture/real';

test('resumes a preloaded real AudioContext on click and reads a decoded tone', async ({ page }) => {
  await page.goto('/real.html');
  await expect.poll(() => page.evaluate(() => window.audioTest.loaded)).toBe(true);
  expect(await page.evaluate(() => window.audioTest.contexts[0].state)).toBe('suspended');

  await page.getByRole('button', { name: 'Play track', exact: true }).click();
  await expect.poll(() => page.evaluate(() => {
    const { core, contexts } = window.audioTest;
    const frame = core.snapshot();
    return contexts[0].state === 'running' && core.getState().isPlaying &&
      frame.fft?.some((value) => value > 0) && frame.waveform?.some((value) => value !== 128);
  })).toBe(true);
  await expect(page.getByTestId('core-error')).toBeEmpty();

  await page.getByRole('button', { name: 'Pause track' }).click();
  await expect.poll(() => page.evaluate(() => window.audioTest.core.getState().isPlaying)).toBe(false);
  await page.getByRole('button', { name: 'Destroy core' }).click();
  await expect.poll(() => page.evaluate(() => window.audioTest.contexts[0].state)).toBe('closed');
});

test('releases real microphone tracks and contexts after hook reconfiguration and unmount', async ({ page }) => {
  await page.goto('/real.html');
  await expect.poll(() => page.evaluate(() => window.audioTest.loaded)).toBe(true);
  await page.getByRole('button', { name: 'Toggle microphone' }).click();
  await expect.poll(() => page.evaluate(() => ({
    active: window.audioTest.hook?.micActive,
    error: String(window.audioTest.hook?.micError?.cause ?? ''),
  }))).toEqual({ active: true, error: '' });
  await expect(page.getByTestId('mic-active')).toHaveText('true');
  expect(await page.evaluate(() => window.audioTest.streams[0].getTracks()[0].readyState)).toBe('live');
  expect(await page.evaluate(() => window.audioTest.contexts[1].state)).toBe('running');

  await page.getByRole('button', { name: 'Reconfigure microphone' }).click();
  await expect(page.getByTestId('mic-active')).toHaveText('false');
  await expect.poll(() => page.evaluate(() => window.audioTest.contexts[1].state)).toBe('closed');
  expect(await page.evaluate(() => window.audioTest.streams[0].getTracks()[0].readyState)).toBe('ended');

  await page.getByRole('button', { name: 'Toggle microphone' }).click();
  await expect(page.getByTestId('mic-active')).toHaveText('true');
  expect(await page.evaluate(() => window.audioTest.hook?.snapshot('mic').fft?.length)).toBe(256);
  await expect(page.getByTestId('mic-error')).toBeEmpty();
  await page.getByRole('button', { name: 'Unmount microphone' }).click();
  await expect.poll(() => page.evaluate(() => window.audioTest.contexts.slice(1).every((ctx) => ctx.state === 'closed'))).toBe(true);
  expect(await page.evaluate(() => window.audioTest.streams.every((stream) => stream.getTracks().every((track) => track.readyState === 'ended')))).toBe(true);
});
