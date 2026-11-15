export const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export function rentalPastOneYear(startedAt: number, now = Date.now()) {
  return startedAt > 0 && now - startedAt >= ONE_YEAR_MS;
}
