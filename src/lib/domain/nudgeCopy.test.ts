import { describe, it, expect } from 'vitest';
import { renderNudgeCopy } from './nudgeCopy';

describe('renderNudgeCopy', () => {
  it('renders the exact (type, variant, tone) entry', () => {
    const copy = renderNudgeCopy('morning_runway.safe.gentle');
    expect(copy.title).toBe('Good morning ☀️');
    expect(copy.body).toContain('safe to spend');
  });

  it('varies copy by tone', () => {
    const gentle = renderNudgeCopy('morning_runway.caution.gentle');
    const minimal = renderNudgeCopy('morning_runway.caution.minimal');
    expect(gentle).not.toEqual(minimal);
  });

  it('never includes a dollar sign or digit (no amounts in nudges)', () => {
    const keys = [
      'morning_runway.safe.gentle',
      'morning_runway.caution.direct',
      'morning_runway.danger.minimal',
      'morning_runway.stale.gentle',
      'bill_approach.single.gentle',
      'bill_approach.multiple.direct',
      'danger_state.negative_runway.minimal',
    ];
    for (const k of keys) {
      const { title, body } = renderNudgeCopy(k);
      expect(`${title} ${body}`).not.toMatch(/[$\d]/);
    }
  });

  it('falls back to the default variant for an unknown danger reason key', () => {
    const known = renderNudgeCopy('danger_state.negative_runway.gentle');
    const unknown = renderNudgeCopy('danger_state.some_new_reason.gentle');
    expect(unknown).toEqual(known);
  });

  it('falls back to gentle when the tone is unknown', () => {
    const gentle = renderNudgeCopy('bill_approach.single.gentle');
    const weird = renderNudgeCopy('bill_approach.single.shouty');
    expect(weird).toEqual(gentle);
  });

  it('returns a generic fallback for an unknown type or malformed key', () => {
    expect(renderNudgeCopy('totally_unknown.foo.gentle').title).toBe('Nudget');
    expect(renderNudgeCopy('nope').title).toBe('Nudget');
  });
});
