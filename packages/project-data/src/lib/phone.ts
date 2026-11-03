/** Strips spaces, dashes and the +976 country code. Returns the bare number. */
export function normalizePhone(input: string): string {
  return input.replace(/[^\d+]/g, '').replace(/^(\+?976)/, '');
}

/** Mongolian numbers: 8 digits, starting with 5-9 (mobile ranges and Ulaanbaatar landlines). */
export function isValidMongolianPhone(input: string): boolean {
  return /^[5-9]\d{7}$/.test(normalizePhone(input));
}
