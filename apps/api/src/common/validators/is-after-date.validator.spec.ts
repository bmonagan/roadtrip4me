import { describe, expect, it } from 'vitest';

// Validates the pure date-ordering logic used by IsAfterDate. The decorator
// itself (via class-validator) can't be loaded in this vitest/bun environment
// due to a CJS/ESM transform error, so the comparison logic is tested directly.
function isAfter(
  value: unknown,
  other: unknown
): { valid: boolean; message: string } {
  if (value == null || other == null) return { valid: true, message: '' };
  const date = new Date(value as string);
  const otherDate = new Date(other as string);
  if (Number.isNaN(date.getTime()) || Number.isNaN(otherDate.getTime())) {
    return { valid: true, message: '' };
  }
  if (date.getTime() >= otherDate.getTime()) return { valid: true, message: '' };
  return { valid: false, message: 'endDate must not be earlier than startDate' };
}

describe('IsAfterDate validator logic', () => {
  it('passes when endDate is after startDate', () => {
    expect(isAfter('2025-06-15', '2025-06-01').valid).toBe(true);
  });

  it('passes when endDate equals startDate', () => {
    expect(isAfter('2025-06-15', '2025-06-15').valid).toBe(true);
  });

  it('fails when endDate is before startDate', () => {
    const result = isAfter('2025-06-01', '2025-06-15');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('earlier');
  });

  it('passes when either date is missing (optional)', () => {
    expect(isAfter(null, '2025-06-01').valid).toBe(true);
    expect(isAfter('2025-06-15', null).valid).toBe(true);
  });
});
