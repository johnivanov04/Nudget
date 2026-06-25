/**
 * Nudge copy catalog — renders a privacy-safe `copyKey` into the title/body of
 * a push notification.
 *
 * The nudge engine deliberately emits only a stable `copyKey` (e.g.
 * `morning_runway.caution.gentle`) and NEVER a rendered string with dollar
 * amounts, so nudges carry no sensitive financial data. This module is the one
 * place that turns a key into human text — and that text stays amount-free and
 * non-shaming by design. The actual numbers live behind the tap, in the app.
 *
 * Pure + deterministic: a key in, two strings out. Unknown keys fall back to a
 * generic prompt rather than throwing, so a new engine variant can never crash
 * delivery.
 */

export interface NudgeCopy {
  title: string;
  body: string;
}

type ToneCopy = Record<'gentle' | 'direct' | 'minimal', NudgeCopy>;

const GENERIC_FALLBACK: NudgeCopy = {
  title: 'Nudget',
  body: 'Open Nudget to check your runway.',
};

/**
 * catalog[type][variant] → copy per tone. The first variant listed for a type
 * is its default when the engine emits a variant we don't have explicit copy
 * for (e.g. a new danger reason key).
 */
const CATALOG: Record<string, Record<string, ToneCopy>> = {
  morning_runway: {
    safe: {
      gentle: { title: 'Good morning ☀️', body: "You're on track to payday. Tap to see what's safe to spend." },
      direct: { title: 'Morning runway', body: "You're on track to payday. Open Nudget for your number." },
      minimal: { title: 'On track', body: 'Safe to spend through payday.' },
    },
    caution: {
      gentle: { title: 'Morning check-in', body: "Things are a little tight before payday. Tap to see what's safe." },
      direct: { title: 'Morning runway', body: "It's tight before payday. Open Nudget for your number." },
      minimal: { title: 'Getting tight', body: "Check what's safe before payday." },
    },
    danger: {
      gentle: { title: 'Morning heads-up', body: "You're cutting it close before payday. Tap to see what's safe to spend." },
      direct: { title: 'Morning runway', body: "You're past budget before payday. Open Nudget now." },
      minimal: { title: 'Over the line', body: 'Check your runway before payday.' },
    },
    stale: {
      gentle: { title: 'Refresh your runway', body: "Open Nudget to update today's numbers." },
      direct: { title: 'Runway needs a refresh', body: "Open Nudget to sync today's spending." },
      minimal: { title: 'Tap to refresh', body: 'Your runway is out of date.' },
    },
  },
  bill_approach: {
    single: {
      gentle: { title: "A bill's coming up", body: "You've a bill due before payday. Tap to check you're covered." },
      direct: { title: 'Bill due soon', body: "A bill lands before payday. Open Nudget to confirm you're covered." },
      minimal: { title: 'Bill due soon', body: "Check you're covered before payday." },
    },
    multiple: {
      gentle: { title: 'Bills coming up', body: "A few bills are due before payday. Tap to check you're covered." },
      direct: { title: 'Bills due soon', body: 'Several bills land before payday. Open Nudget to confirm.' },
      minimal: { title: 'Bills due soon', body: "Check you're covered before payday." },
    },
  },
  danger_state: {
    // default variant (first listed) covers any riskReasonKey we don't special-case.
    negative_runway: {
      gentle: { title: 'Heads-up on your runway', body: "You're close to the edge before payday. Tap to see what's safe to spend." },
      direct: { title: 'Runway alert', body: "You're past budget before payday. Open Nudget now." },
      minimal: { title: 'Runway alert', body: "Check what's safe before payday." },
    },
  },
};

/** Render a nudge copyKey (`type.variant.tone`) into a notification title/body. */
export function renderNudgeCopy(copyKey: string): NudgeCopy {
  const parts = copyKey.split('.');
  if (parts.length < 2) return GENERIC_FALLBACK;

  const type = parts[0] ?? '';
  const tone = parts[parts.length - 1] ?? 'gentle';
  const variant = parts.slice(1, -1).join('.');

  const variants = CATALOG[type];
  if (!variants) return GENERIC_FALLBACK;

  // Exact variant, else the type's default (first declared) variant.
  const defaultKey = Object.keys(variants)[0] ?? '';
  const toneCopy = variants[variant] ?? variants[defaultKey];
  if (!toneCopy) return GENERIC_FALLBACK;

  return toneCopy[tone as keyof ToneCopy] ?? toneCopy.gentle;
}
