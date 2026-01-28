/**
 * NextAuth Callbacks with Token Encryption
 * 
 * This file extends NextAuth callbacks to automatically encrypt
 * OAuth tokens (access_token, refresh_token, id_token) before
 * storing them in the database.
 * 
 * IMPORTANT: Import these callbacks in your lib/auth.ts:
 * 
 * import { encryptedCallbacks } from './auth/encrypted-callbacks';
 * 
 * export const authOptions: NextAuthOptions = {
 *   // ... other options
 *   callbacks: {
 *     ...encryptedCallbacks,
 *     // ... your other callbacks
 *   },
 * };
 */

import { Account } from 'next-auth';
import { encryptToken, ensureEncrypted } from '@/lib/crypto/token-encryption';

/**
 * NextAuth callbacks that encrypt OAuth tokens before database storage
 */
export const encryptedCallbacks = {
  /**
   * This callback is called whenever an account is linked to a user
   * We intercept it to encrypt tokens before they reach the database
   */
  async signIn({ account }: { account: Account | null }) {
    if (!account) return true;

    try {
      // Encrypt OAuth tokens if present
      if (account.access_token) {
        account.access_token = ensureEncrypted(account.access_token) || account.access_token;
      }

      if (account.refresh_token) {
        account.refresh_token = ensureEncrypted(account.refresh_token) || account.refresh_token;
      }

      if (account.id_token) {
        account.id_token = ensureEncrypted(account.id_token) || account.id_token;
      }

      console.log('[Auth] Encrypted OAuth tokens for provider:', account.provider);
    } catch (error) {
      console.error('[Auth] Error encrypting tokens during sign-in:', error);
      // Don't block sign-in on encryption errors
      // Tokens will still be stored (unencrypted) and can be encrypted later via migration
    }

    return true;
  },
};

/**
 * Helper to decrypt tokens when needed in session callbacks
 * 
 * Example usage in session callback:
 * 
 * async session({ session, token }) {
 *   if (token.accessToken) {
 *     session.accessToken = decryptSessionToken(token.accessToken);
 *   }
 *   return session;
 * }
 */
export function decryptSessionToken(encryptedToken: string | undefined): string | undefined {
  if (!encryptedToken) return undefined;

  try {
    // Import here to avoid circular dependencies
    const { decryptToken, isTokenEncrypted } = require('@/lib/crypto/token-encryption');
    
    if (isTokenEncrypted(encryptedToken)) {
      return decryptToken(encryptedToken);
    }
    
    return encryptedToken;
  } catch (error) {
    console.error('[Auth] Error decrypting session token:', error);
    return undefined;
  }
}
