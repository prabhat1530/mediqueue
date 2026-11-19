/**
 * Source of "now". Services ask the clock instead of calling new Date() directly,
 * so tests can swap in a fake clock and control time (Dependency Inversion).
 */
export class SystemClock {
  now() {
    return new Date();
  }
}

/** YYYY-MM-DD in local time. */
export function localDate(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
