import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128-bit auth tag

// Unambiguous prefix for all values produced by encrypt().
// Using a fixed prefix makes detection a simple startsWith() with no false-positive
// risk from plaintext values that happen to match a hex-triplet pattern, and makes
// the format forward-compatible if the algorithm changes (bump to enc2: etc.).
const ENCRYPTION_PREFIX = 'enc1:';

// Validate and cache the key at module load time so a missing or malformed
// ENCRYPTION_KEY fails fast on startup rather than on the first user interaction.
function loadKey(): Buffer {
  // Trim to guard against trailing newlines/spaces from env files or copy-paste;
  // JS regex $ matches before a trailing \n, so without trim a 64-hex + \n string
  // would pass the pattern check but Buffer.from would include the garbage byte.
  const raw = (process.env.ENCRYPTION_KEY ?? '').trim();
  if (!raw) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error('ENCRYPTION_KEY must be exactly a 64-character hex string (32 bytes for AES-256)');
  }
  return Buffer.from(raw, 'hex');
}

const KEY: Buffer = loadKey();

/**
 * Returns true if the value was produced by `encrypt()`, false if it is plaintext.
 * Used to migrate rows that were stored before encryption was introduced.
 */
export function isEncrypted(value: string): boolean {
  return value.startsWith(ENCRYPTION_PREFIX);
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns `enc1:<iv_hex>:<authTag_hex>:<ciphertext_hex>`.
 */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, KEY, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${ENCRYPTION_PREFIX}${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts a value produced by `encrypt`.
 * Throws if the value lacks the expected prefix or the GCM auth tag mismatches.
 */
export function decrypt(ciphertext: string): string {
  if (!ciphertext.startsWith(ENCRYPTION_PREFIX)) {
    throw new Error('Invalid encrypted value format');
  }
  const body = ciphertext.slice(ENCRYPTION_PREFIX.length);
  const parts = body.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted value format');
  }
  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, KEY, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}
