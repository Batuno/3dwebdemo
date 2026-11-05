// The browser stretches passwords before they leave it (see LOGIN_KDF in project-data). Web Crypto does it in
// a fraction of a second, but browsers only offer it on https and localhost; an office computer serving the
// admin over plain http on the local network falls back to the same PBKDF2 in JavaScript, which is slower.
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { deriveLoginKey, fromBase64Url, LOGIN_KDF, newSalt as webSalt, toBase64Url } from '@bair/project-data';

const hasWebCrypto = () => typeof crypto !== 'undefined' && !!crypto.subtle;

export async function stretch(password: string, salt: string, iterations: number = LOGIN_KDF.iterations): Promise<string> {
  if (hasWebCrypto()) return deriveLoginKey(password, salt, iterations);
  const key = await pbkdf2Async(sha256, new TextEncoder().encode(password), fromBase64Url(salt), { c: iterations, dkLen: LOGIN_KDF.keyBytes, asyncTick: 20 });
  return toBase64Url(key);
}

/** crypto.getRandomValues, unlike crypto.subtle, works on plain http too. */
export const newSalt = webSalt;

/** A salt and stretched key for a new password, ready to send. */
export async function newPasswordKey(password: string): Promise<{ salt: string; key: string }> {
  const salt = newSalt();
  return { salt, key: await stretch(password, salt) };
}
