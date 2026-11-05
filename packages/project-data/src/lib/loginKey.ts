// Login keys: the browser stretches the password with PBKDF2 and sends only the result, and the server
// stores a SHA-256 of that. The slow part runs in the browser, so the server's work per login stays tiny,
// which keeps it inside the CPU limit of Cloudflare's free plan, while a leaked database is as hard to
// crack as one hashed with PBKDF2 on the server.

export const LOGIN_KDF = {
  hash: 'SHA-256',
  /** OWASP's 2023 figure for PBKDF2-HMAC-SHA256. */
  iterations: 600_000,
  keyBytes: 32,
  saltBytes: 16,
} as const;

const B64URL = /^[A-Za-z0-9_-]+$/;
export const isSalt = (s: unknown): s is string => typeof s === 'string' && s.length >= 16 && s.length <= 64 && B64URL.test(s);
/** A base64url-encoded 32-byte key is 43 characters. */
export const isLoginKey = (s: unknown): s is string => typeof s === 'string' && s.length === 43 && B64URL.test(s);

export function toBase64Url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(s: string): Uint8Array<ArrayBuffer> {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}

export function newSalt(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(LOGIN_KDF.saltBytes)));
}

/** PBKDF2 through Web Crypto: browsers on https or localhost, Node and Cloudflare Workers. */
export async function deriveLoginKey(password: string, salt: string, iterations: number = LOGIN_KDF.iterations): Promise<string> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: LOGIN_KDF.hash, salt: fromBase64Url(salt), iterations },
    material,
    LOGIN_KDF.keyBytes * 8,
  );
  return toBase64Url(new Uint8Array(bits));
}
