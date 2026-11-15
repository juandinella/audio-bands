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

test('changes a real analyser live without interrupting playback', async ({ page }) => {
  await page.goto('/real.html');
  await expect.poll(() => page.evaluate(() => window.audioTest.loaded)).toBe(true);
  await page.getByRole('button', { name: 'Play track', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.audioTest.core.getState().isPlaying)).toBe(true);

  const result = await page.evaluate(async () => {
    const { core } = window.audioTest;
    const sampleRate = core.getSampleRate();
    core.setAnalyserConfig('music', { fftSize: 2048, smoothingTimeConstant: 0.3 });
    core.setBandRanges({ bass: { from: 0, to: 0.02 }, mid: { from: 0.02, to: 0.2 } });
    await new Promise((resolve) => setTimeout(resolve, 300));
    const frame = core.snapshot();
    return {
      sampleRate,
      playing: core.getState().isPlaying,
      fft: frame.fft?.length,
      waveform: frame.waveform?.length,
      heard: frame.fft?.some((value) => value > 0),
      config: core.getAnalyserConfig('music'),
      bass: core.getBandRanges().bass,
    };
  });

  expect(result.sampleRate).toBeGreaterThan(0);
  expect(result).toMatchObject({
    playing: true,
    fft: 1024,
    waveform: 2048,
    heard: true,
    config: { fftSize: 2048, smoothingTimeConstant: 0.3 },
    bass: { from: 0, to: 0.02 },
  });
  await page.getByRole('button', { name: 'Destroy core' }).click();
});

test('default bands put real tones in bass, mid and high by frequency', async ({ page }) => {
  await page.goto('/real.html');
  await expect.poll(() => page.evaluate(() => window.audioTest.loaded)).toBe(true);
  // A click gives the page user activation, so later play() calls are allowed.
  await page.getByRole('button', { name: 'Play track', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.audioTest.core.getState().isPlaying)).toBe(true);

  const loudest = await page.evaluate(async () => {
    const { core, tone } = window.audioTest;
    const result: Record<number, string> = {};
    for (const frequency of [100, 1000, 8000]) {
      const url = tone(frequency);
      await core.load(url);
      await core.play();
      // Read every frame, as a render loop does: smoothing only advances on reads.
      const until = performance.now() + 500;
      while (performance.now() < until) {
        core.getBands();
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      const { bass, mid, high } = core.getBands();
      const bands = { bass, mid, high };
      result[frequency] = (Object.keys(bands) as (keyof typeof bands)[])
        .reduce((a, b) => (bands[a] >= bands[b] ? a : b));
      URL.revokeObjectURL(url);
    }
    return result;
  });

  expect(loudest).toEqual({ 100: 'bass', 1000: 'mid', 8000: 'high' });
  await page.getByRole('button', { name: 'Destroy core' }).click();
});
