import { describe, it, expect } from 'vitest';
import { analyticsEvents, bucketCount } from './events';

describe('bucketCount', () => {
  it('buckets counts coarsely', () => {
    expect(bucketCount(0)).toBe('0');
    expect(bucketCount(1)).toBe('1');
    expect(bucketCount(3)).toBe('2-3');
    expect(bucketCount(5)).toBe('4-6');
    expect(bucketCount(20)).toBe('7+');
  });
});

describe('analyticsEvents', () => {
  it('runwayViewed carries only bucketed, non-sensitive props', () => {
    const e = analyticsEvents.runwayViewed({
      riskLevel: 'caution',
      daysUntilPayday: 13,
      isStale: false,
    });
    expect(e).toEqual({
      event: 'runway_viewed',
      properties: { risk_level: 'caution', days_until_payday_bucket: '10-14', data_stale: false },
    });
  });

  it('plaidLinkCompleted buckets the account count instead of exposing it', () => {
    const e = analyticsEvents.plaidLinkCompleted(2);
    expect(e.properties).toEqual({ account_count_bucket: '2-3' });
  });

  it('billDecision buckets confidence and routes to confirm/reject events', () => {
    expect(
      analyticsEvents.billDecision({ decision: 'confirmed', confidence: 0.92, cadence: 'monthly' }),
    ).toEqual({
      event: 'bill_confirmed',
      properties: { cadence: 'monthly', confidence_bucket: 'high' },
    });
    expect(
      analyticsEvents.billDecision({ decision: 'rejected', confidence: 0.3, cadence: null }).event,
    ).toBe('bill_rejected');
  });

  it('nudgeSent keeps the copy_key (template id) but no dollar text', () => {
    const e = analyticsEvents.nudgeSent({
      nudgeType: 'danger_state',
      riskLevel: 'danger',
      copyKey: 'danger_state.negative_runway.gentle',
    });
    expect(e.properties).toEqual({
      nudge_type: 'danger_state',
      risk_level: 'danger',
      copy_key: 'danger_state.negative_runway.gentle',
    });
  });

  it('nudgeFeedbackSubmitted omits rating when null', () => {
    expect(
      analyticsEvents.nudgeFeedbackSubmitted({ helpful: true, rating: null }).properties,
    ).toEqual({
      helpful: true,
    });
  });

  it('null risk level degrades to "unknown", never a raw value', () => {
    const e = analyticsEvents.runwayViewed({ riskLevel: null, daysUntilPayday: 0, isStale: true });
    expect(e.properties.risk_level).toBe('unknown');
  });
});
