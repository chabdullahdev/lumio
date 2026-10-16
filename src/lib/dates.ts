/**
 * Date helpers shared by sample mode and the live API.
 *
 * LUMIO counts reading days in the user's local timezone (a V1 product rule):
 * a streak day is a local calendar day with at least one completed lesson.
 * These helpers are pure so they can be unit tested.
 */

/** The device's IANA timezone, falling back to UTC when Intl is unavailable. */
export function deviceTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz && tz.length > 0 ? tz : 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Local ISO date (YYYY-MM-DD) for a Date in a given timezone. */
export function localDateString(date: Date, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
    return parts; // en-CA formats as YYYY-MM-DD
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/** Add days to an ISO date string, returning an ISO date string. */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Streak after completing a lesson on `today`.
 *
 * - already completed something today -> unchanged
 * - last completion was yesterday -> +1
 * - otherwise (gap or first time) -> 1
 */
export function nextStreak(
  current: { current: number; longest: number; lastCompletedOn: string | null },
  today: string,
): { current: number; longest: number; lastCompletedOn: string } {
  let value: number;
  if (current.lastCompletedOn === today) {
    value = Math.max(current.current, 1);
  } else if (current.lastCompletedOn === addDays(today, -1)) {
    value = Math.max(current.current, 0) + 1;
  } else {
    value = 1;
  }
  return {
    current: value,
    longest: Math.max(current.longest, value),
    lastCompletedOn: today,
  };
}

/** Estimate reading minutes from a word count (~200 wpm), min 1. */
export function estimateMinutes(wordCount: number): number {
  return Math.max(1, Math.round(wordCount / 200));
}

/** Count words in a block list (used for the reading-time estimate). */
export function countWords(blocks: { text: string }[]): number {
  return blocks.reduce((total, block) => total + block.text.trim().split(/\s+/).length, 0);
}
