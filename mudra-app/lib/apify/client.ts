/**
 * Apify Client Singleton
 * 
 * Provides a singleton instance of the Apify client for scraping
 * Reddit and LinkedIn conversations.
 * 
 * @see docs/conversation-radar/APIFY_INTEGRATION_REFERENCE.md
 */

import { ApifyClient } from 'apify-client';

let apifyClient: ApifyClient | null = null;

/**
 * Get or create the Apify client singleton
 * @throws Error if APIFY_API_KEY is not set
 */
export function getApifyClient(): ApifyClient {
  if (!apifyClient) {
    const token = process.env.APIFY_API_KEY;
    if (!token) {
      throw new Error(
        'APIFY_API_KEY environment variable is not set. ' +
        'Please add it to your .env.local file.'
      );
    }
    apifyClient = new ApifyClient({ token });
  }
  return apifyClient;
}

/**
 * Reset the client (useful for testing)
 */
export function resetApifyClient(): void {
  apifyClient = null;
}

