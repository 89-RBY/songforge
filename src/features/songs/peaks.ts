// Reduces audio samples to one height per bar (0 to 1), used to draw the waveform.
export function computePeaks(samples: ArrayLike<number>, bars: number): number[] {
  if (bars <= 0 || samples.length === 0) return [];
  const size = Math.max(1, Math.floor(samples.length / bars));
  const raw: number[] = [];
  for (let bar = 0; bar < bars; bar++) {
    const start = bar * size;
    const end = Math.min(samples.length, start + size);
    let max = 0;
    for (let i = start; i < end; i++) {
      const value = Math.abs(samples[i]);
      if (value > max) max = value;
    }
    raw.push(max);
  }
  let top = 0;
  for (const value of raw) if (value > top) top = value;
  if (top === 0) return raw;
  return raw.map((value) => Math.round((value / top) * 100) / 100);
}
