/**
 * Token Encryption Utilities
 * 
 * Provides AES-256-GCM encryption for sensitive tokens stored in the database.
 * Used for:
 * - OAuth access/refresh tokens (Account table)
 * - GitHub Personal Access Tokens (GitHubIntegration table)
 * 
 * Environment Variables Required:
 * - TOKEN_ENCRYPTION_KEY: 64-character hex string (32 bytes)
 *   Generate with: openssl rand -hex 32
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // AES-GCM standard

/**
 * Get the encryption key from environment variables
 * @throws {Error} If TOKEN_ENCRYPTION_KEY is not set
 */
function getEncryptionKey(): Buffer {
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  
  if (!key) {
    throw new Error(
      'TOKEN_ENCRYPTION_KEY environment variable is required for token encryption. ' +
      'Generate with: openssl rand -hex 32'
    );
  }
  
  if (key.length !== 64) {
    throw new Error(
      `TOKEN_ENCRYPTION_KEY must be 64 hex characters (32 bytes), got ${key.length} characters`
    );
  }
  
  return Buffer.from(key, 'hex');
}

/**
 * Encrypt a token using AES-256-GCM
 * 
 * Format: iv:authTag:encryptedData (all hex-encoded)
 * 
 * @param token - Plain text token to encrypt
 * @returns Encrypted token in format "iv:authTag:encryptedData"
 */
export function encryptToken(token: string): string {
  if (!token) {
    throw new Error('Cannot encrypt empty token');
  }
  
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Format: iv:authTag:encryptedData
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt a token encrypted with encryptToken()
 * 
 * @param encryptedToken - Token in format "iv:authTag:encryptedData"
 * @returns Decrypted plain text token
 * @throws {Error} If token format is invalid or decryption fails
 */
export function decryptToken(encryptedToken: string): string {
  if (!encryptedToken) {
    throw new Error('Cannot decrypt empty token');
  }
  
  const parts = encryptedToken.split(':');
  
  if (parts.length !== 3) {
    throw new Error(
      `Invalid encrypted token format. Expected "iv:authTag:data", got ${parts.length} parts`
    );
  }
  
  const [ivHex, authTagHex, encrypted] = parts;
  
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Check if a token is already encrypted
 * 
 * @param token - Token to check
 * @returns true if token appears to be encrypted (contains ':' separator)
 */
export function isTokenEncrypted(token: string | null | undefined): boolean {
  if (!token) return false;
  
  // Encrypted tokens have format "iv:authTag:data" with exactly 3 parts
  const parts = token.split(':');
  return parts.length === 3 && parts.every(part => /^[0-9a-f]+$/i.test(part));
}

/**
 * Safely encrypt a token if it's not already encrypted
 * 
 * @param token - Token that may or may not be encrypted
 * @returns Encrypted token
 */
export function ensureEncrypted(token: string | null | undefined): string | null {
  if (!token) return null;
  
  if (isTokenEncrypted(token)) {
    return token; // Already encrypted
  }
  
  return encryptToken(token);
}
