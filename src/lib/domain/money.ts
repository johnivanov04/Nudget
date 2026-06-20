/** Round a dollar amount to whole cents, avoiding binary float drift. */
export function roundCents(amount: number): number {
  if (!Number.isFinite(amount)) {
    throw new TypeError(`Cannot round non-finite amount: ${amount}`);
  }
  // Add a tiny epsilon in the rounding domain to counter values like 0.005.
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}
