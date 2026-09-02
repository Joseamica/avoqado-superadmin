/** Leaves enough entropy for an operator to compare, without exposing a full identifier. */
export function maskFingerprint(value: string): string {
  if (value.length <= 12) return value
  return `${value.slice(0, 8)}…${value.slice(-4)}`
}
