/**
 * Truncates text to a token-bounded single-line value.
 *
 * @param value - The raw text.
 * @param maxChars - Maximum characters to keep.
 * @returns A normalized, truncated string.
 */
export function truncateText(value: string, maxChars: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxChars) return normalized;
  return normalized.slice(0, maxChars).trim();
}
