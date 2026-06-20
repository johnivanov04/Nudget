import { describe, it, expect } from 'vitest';
import {
  bucketAmount,
  bucketConfidence,
  bucketDaysUntilPayday,
  buildAnalyticsEvent,
  FORBIDDEN_KEYS,
} from './sanitize';

describe('analytics sanitization', () => {
  it('buckets dollar amounts instead of exposing them', () => {
    expect(bucketAmount(0)).toBe('0');
    expect(bucketAmount(7.5)).toBe('<10');
    expect(bucketAmount(42)).toBe('25-50');
    expect(bucketAmount(-300)).toBe('250-500'); // absolute value
    expect(bucketAmount(5000)).toBe('1000+');
  });

  it('buckets confidence into coarse bands', () => {
    expect(bucketConfidence(0.2)).toBe('low');
    expect(bucketConfidence(0.65)).toBe('medium');
    expect(bucketConfidence(0.95)).toBe('high');
  });

  it('buckets days until payday', () => {
    expect(bucketDaysUntilPayday(0)).toBe('0');
    expect(bucketDaysUntilPayday(2)).toBe('1-2');
    expect(bucketDaysUntilPayday(13)).toBe('10-14');
    expect(bucketDaysUntilPayday(30)).toBe('15+');
  });

  it('drops forbidden keys defensively', () => {
    const evt = buildAnalyticsEvent('runway_viewed', {
      risk_level: 'caution',
      days_until_payday_bucket: '10-14',
      // These must never make it into analytics:
      merchant_name: 'Whole Foods',
      amount: 123.45,
      balance: 998.12,
      transaction_id: 'txn_123',
      email: 'user@example.com',
    });
    expect(evt.properties).toEqual({
      risk_level: 'caution',
      days_until_payday_bucket: '10-14',
    });
    for (const k of FORBIDDEN_KEYS) {
      expect(evt.properties).not.toHaveProperty(k);
    }
  });

  it('keeps the event name and safe properties', () => {
    const evt = buildAnalyticsEvent('widget_setup_confirmed', {
      widget_size: 'medium',
      privacy_mode: true,
    });
    expect(evt.event).toBe('widget_setup_confirmed');
    expect(evt.properties.widget_size).toBe('medium');
    expect(evt.properties.privacy_mode).toBe(true);
  });
});
