import { environment } from '@env/environment';

// Random delay in the configured range, used to make mock responses feel real.
export function randomDelay(): number {
  const { min, max } = environment.mockDelayMs;
  return min + Math.random() * (max - min);
}
