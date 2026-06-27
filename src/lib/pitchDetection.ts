const MIN_RMS = 0.02;

/**
 * Autocorrelation-based pitch detection tuned for guitar (60–1400 Hz).
 * Returns the detected fundamental in Hz, or null if the signal is too
 * quiet or lacks a clear periodic component.
 */
export function detectPitch(buffer: Float32Array, sampleRate: number): number | null {
  const SIZE = buffer.length;

  // Silence gate
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < MIN_RMS) return null;

  // Lag bounds for guitar strings: ~60 Hz (below open E2) to 1400 Hz
  const minLag = Math.floor(sampleRate / 1400);
  const maxLag = Math.min(SIZE - 1, Math.ceil(sampleRate / 60));

  // Zero-lag self-correlation — used as normalisation reference
  let zeroCorr = 0;
  for (let i = 0; i < SIZE; i++) zeroCorr += buffer[i] * buffer[i];

  // Scan for the lag with maximum autocorrelation in the guitar range
  let bestLag = minLag;
  let bestVal = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i + lag < SIZE; i++) sum += buffer[i] * buffer[i + lag];
    if (sum > bestVal) { bestVal = sum; bestLag = lag; }
  }

  // Reject weak / noisy signals
  if (bestVal < zeroCorr * 0.4) return null;

  // Octave correction: if the lag at 2× also has strong correlation,
  // the initial peak was the 2nd harmonic — prefer the true fundamental.
  if (bestLag * 2 <= maxLag) {
    let doubleCorr = 0;
    for (let i = 0; i + bestLag * 2 < SIZE; i++) doubleCorr += buffer[i] * buffer[i + bestLag * 2];
    if (doubleCorr > bestVal * 0.8) {
      bestLag *= 2;
      bestVal = doubleCorr;
    }
  }

  // Parabolic interpolation around the peak for sub-sample frequency accuracy
  if (bestLag > minLag && bestLag < maxLag) {
    let prev = 0, next = 0;
    for (let i = 0; i + bestLag - 1 < SIZE; i++) prev += buffer[i] * buffer[i + bestLag - 1];
    for (let i = 0; i + bestLag + 1 < SIZE; i++) next += buffer[i] * buffer[i + bestLag + 1];
    const denom = 2 * bestVal - prev - next;
    if (denom > 0) return sampleRate / (bestLag + (next - prev) / (2 * denom));
  }

  return sampleRate / bestLag;
}
