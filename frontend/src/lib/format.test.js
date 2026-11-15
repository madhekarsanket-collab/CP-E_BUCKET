import { describe, expect, it } from 'vitest';

import { formatDate, formatPrice, orderStep, statusTone } from './format';

describe('formatPrice', () => {
  it('shows whole rupees without decimals', () => {
    expect(formatPrice(7999)).toBe('₹7,999');
  });
  it('keeps paise and uses Indian digit grouping', () => {
    expect(formatPrice(899.5)).toBe('₹899.50');
    expect(formatPrice(1234567)).toBe('₹12,34,567');
  });
  it('treats junk as zero instead of showing NaN', () => {
    expect(formatPrice(undefined)).toBe('₹0');
  });
});

describe('formatDate', () => {
  it('does not shift the day with timezone', () => {
    expect(formatDate('2026-11-15')).toBe('15 Nov 2026');
    expect(formatDate('2026-01-01T00:00:00')).toBe('1 Jan 2026');
  });
  it('returns an empty string for missing dates', () => {
    expect(formatDate(null)).toBe('');
  });
});

describe('order status helpers', () => {
  it('places statuses on the progress track', () => {
    expect(orderStep('Paid')).toBe(0);
    expect(orderStep('Delivered')).toBe(3);
    expect(orderStep('Cancelled')).toBe(-1);
  });
  it('picks a tone for each status', () => {
    expect(statusTone('Delivered')).toBe('good');
    expect(statusTone('Cancelled')).toBe('bad');
    expect(statusTone('Pending')).toBe('warn');
    expect(statusTone('Shipped')).toBe('info');
  });
});
