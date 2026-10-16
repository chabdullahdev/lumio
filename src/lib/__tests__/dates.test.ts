/**
 * Unit tests for the pure date/streak helpers used by sample mode (and
 * mirrored by the database trigger in live mode).
 */
import { addDays, countWords, deviceTimezone, estimateMinutes, localDateString, nextStreak } from '../dates';

describe('nextStreak', () => {
  test('starts a streak at 1 on the first completion', () => {
    const result = nextStreak({ current: 0, longest: 0, lastCompletedOn: null }, '2026-10-16');
    expect(result).toEqual({ current: 1, longest: 1, lastCompletedOn: '2026-10-16' });
  });

  test('extends the streak when yesterday was the last completion', () => {
    const result = nextStreak(
      { current: 4, longest: 4, lastCompletedOn: '2026-10-15' },
      '2026-10-16',
    );
    expect(result.current).toBe(5);
    expect(result.longest).toBe(5);
  });

  test('does not double-count the same day', () => {
    const result = nextStreak(
      { current: 4, longest: 4, lastCompletedOn: '2026-10-16' },
      '2026-10-16',
    );
    expect(result.current).toBe(4);
    expect(result.longest).toBe(4);
  });

  test('resets after a missed day but keeps the longest record', () => {
    const result = nextStreak(
      { current: 9, longest: 9, lastCompletedOn: '2026-10-10' },
      '2026-10-16',
    );
    expect(result).toEqual({ current: 1, longest: 9, lastCompletedOn: '2026-10-16' });
  });
});

describe('addDays', () => {
  test('moves forward and backward across month boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-11-01', -1)).toBe('2026-10-31');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  test('handles leap years', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
  });
});

describe('reading-time helpers', () => {
  test('counts words across blocks', () => {
    expect(countWords([{ text: 'one two three' }, { text: 'four' }])).toBe(4);
  });

  test('estimates minutes at ~200 wpm with a floor of 1', () => {
    expect(estimateMinutes(200)).toBe(1);
    expect(estimateMinutes(600)).toBe(3);
    expect(estimateMinutes(0)).toBe(1);
  });
});

describe('deviceTimezone and localDateString', () => {
  test('returns a usable timezone string', () => {
    expect(typeof deviceTimezone()).toBe('string');
    expect(deviceTimezone().length).toBeGreaterThan(0);
  });

  test('formats a date in the requested timezone', () => {
    const date = new Date('2026-10-16T23:30:00Z');
    expect(localDateString(date, 'UTC')).toBe('2026-10-16');
    // Tokyo is +9h, so it is already the next day there.
    expect(localDateString(date, 'Asia/Tokyo')).toBe('2026-10-17');
  });
});
