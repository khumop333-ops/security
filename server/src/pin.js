/**
 * Shared PIN helpers (used by both storage drivers).
 * PINs are stored as scrypt hashes — never in plain text.
 */
import crypto from 'node:crypto';

const PIN_SALT = 'sentinel-panic-demo-salt';

/** Hash a PIN with scrypt. */
export function hashPin(pin) {
  return crypto.scryptSync(String(pin), PIN_SALT, 32).toString('hex');
}

/** Constant-time verification of a candidate PIN against a stored hash. */
export function verifyPin(pin, storedHash) {
  if (!storedHash) return false;
  const candidate = hashPin(pin);
  return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(storedHash));
}
