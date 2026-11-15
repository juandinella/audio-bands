// These same functions are used in the instrument and exposed in its code panel.
export function drawWaveform(ctx, waveform, amount) {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = '#c4ebad';
  ctx.lineWidth = Math.max(1, width / 240);
  ctx.beginPath();
  for (let i = 0; i < waveform.length; i++) {
    const x = (i / (waveform.length - 1)) * width;
    const signal = (waveform[i] - 128) / 128;
    const y = height / 2 - Math.max(-1, Math.min(1, signal * amount)) * height * 0.42;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

export function drawSpectrum(ctx, fft, amount) {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#c4ebad';
  const step = width / fft.length;
  fft.forEach((value, i) => {
    const bar = Math.max(1, Math.min(1, value / 255 * amount) * height * 0.9);
    ctx.fillRect(i * step, height - bar, Math.max(0.5, step * 0.72), bar);
  });
}
