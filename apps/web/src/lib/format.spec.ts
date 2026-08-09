import { describe, expect, it } from 'vitest';
import { formatDate, formatDistance, formatDuration, titleCase } from './format';

describe('formatDistance', () => {
  it('formats meters under a kilometer', () => {
    expect(formatDistance(850)).toBe('850 m');
  });
  it('formats kilometers', () => {
    expect(formatDistance(12345)).toBe('12.3 km');
  });
  it('returns an em dash for null', () => {
    expect(formatDistance(null)).toBe('—');
    expect(formatDistance(undefined)).toBe('—');
  });
});

describe('formatDuration', () => {
  it('formats minutes only', () => {
    expect(formatDuration(600)).toBe('10 min');
  });
  it('formats hours and minutes', () => {
    expect(formatDuration(105960)).toBe('29 h 26 min');
  });
  it('returns an em dash for null', () => {
    expect(formatDuration(null)).toBe('—');
  });
});

describe('formatDate', () => {
  it('formats an ISO date', () => {
    expect(formatDate('2025-06-15T00:00:00.000Z')).toContain('2025');
  });
  it('returns an em dash for null', () => {
    expect(formatDate(null)).toBe('—');
  });
});

describe('titleCase', () => {
  it('replaces underscores with spaces and capitalizes', () => {
    expect(titleCase('gas_station')).toBe('Gas Station');
  });
});
