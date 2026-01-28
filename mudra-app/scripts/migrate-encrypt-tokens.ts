/**
 * Token Encryption Migration Script
 * 
 * Encrypts all plain-text tokens in the database:
 * - OAuth access/refresh tokens (Account table)
 * - GitHub Personal Access Tokens (GitHubIntegration table)
 * 
 * Usage:
 *   tsx mudra-app/scripts/migrate-encrypt-tokens.ts
 * 
 * Prerequisites:
 *   1. Set TOKEN_ENCRYPTION_KEY in .env.local
 *      Generate with: openssl rand -hex 32
 *   2. Backup database before running
 */

import { PrismaClient } from '@prisma/client';
import { encryptToken, isTokenEncrypted } from '../lib/crypto/token-encryption';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const prisma = new PrismaClient();

interface MigrationStats {
  accountsChecked: number;
  accountsEncrypted: number;
  accessTokensEncrypted: number;
  refreshTokensEncrypted: number;
  idTokensEncrypted: number;
  githubIntegrationsChecked: number;
  githubIntegrationsEncrypted: number;
  errors: number;
}

async function migrateTokens() {
  console.log('🔐 Starting token encryption migration...\n');
  
  const stats: MigrationStats = {
    accountsChecked: 0,
    accountsEncrypted: 0,
    accessTokensEncrypted: 0,
    refreshTokensEncrypted: 0,
    idTokensEncrypted: 0,
    githubIntegrationsChecked: 0,
    githubIntegrationsEncrypted: 0,
    errors: 0,
  };

  try {
    // Verify encryption key is set
    if (!process.env.TOKEN_ENCRYPTION_KEY) {
      throw new Error(
        'TOKEN_ENCRYPTION_KEY not found in environment.\n' +
        'Generate with: openssl rand -hex 32\n' +
        'Add to .env.local: TOKEN_ENCRYPTION_KEY=<generated_key>'
      );
    }

    console.log('✓ Encryption key found\n');

    // Migrate OAuth tokens in Account table
    console.log('📋 Migrating OAuth tokens (Account table)...');
    
    const accounts = await prisma.account.findMany({
      where: {
        OR: [
          { access_token: { not: null } },
          { refresh_token: { not: null } },
          { id_token: { not: null } },
        ],
      },
    });

    console.log(`   Found ${accounts.length} accounts with tokens\n`);

    for (const account of accounts) {
      stats.accountsChecked++;
      
      try {
        const updates: {
          access_token?: string;
          refresh_token?: string;
          id_token?: string;
        } = {};
        let needsUpdate = false;

        // Encrypt access_token if not already encrypted
        if (account.access_token && !isTokenEncrypted(account.access_token)) {
          updates.access_token = encryptToken(account.access_token);
          stats.accessTokensEncrypted++;
          needsUpdate = true;
        }

        // Encrypt refresh_token if not already encrypted
        if (account.refresh_token && !isTokenEncrypted(account.refresh_token)) {
          updates.refresh_token = encryptToken(account.refresh_token);
          stats.refreshTokensEncrypted++;
          needsUpdate = true;
        }

        // Encrypt id_token if not already encrypted
        if (account.id_token && !isTokenEncrypted(account.id_token)) {
          updates.id_token = encryptToken(account.id_token);
          stats.idTokensEncrypted++;
          needsUpdate = true;
        }

        if (needsUpdate) {
          await prisma.account.update({
            where: { id: account.id },
            data: updates,
          });
          stats.accountsEncrypted++;
          console.log(`   ✓ Encrypted tokens for account ${account.id} (${account.provider})`);
        }
      } catch (error) {
        stats.errors++;
        console.error(`   ✗ Error encrypting account ${account.id}:`, error);
      }
    }

    console.log(`\n✓ OAuth migration complete:`);
    console.log(`   - ${stats.accountsChecked} accounts checked`);
    console.log(`   - ${stats.accountsEncrypted} accounts updated`);
    console.log(`   - ${stats.accessTokensEncrypted} access tokens encrypted`);
    console.log(`   - ${stats.refreshTokensEncrypted} refresh tokens encrypted`);
    console.log(`   - ${stats.idTokensEncrypted} ID tokens encrypted\n`);

    // Migrate GitHub tokens in GitHubIntegration table
    console.log('🔑 Migrating GitHub tokens (GitHubIntegration table)...');
    
    const githubIntegrations = await prisma.gitHubIntegration.findMany();
    
    console.log(`   Found ${githubIntegrations.length} GitHub integrations\n`);

    for (const integration of githubIntegrations) {
      stats.githubIntegrationsChecked++;
      
      try {
        const updates: {
          accessToken?: string;
          refreshToken?: string;
        } = {};
        let needsUpdate = false;

        // Encrypt accessToken if not already encrypted
        if (integration.accessToken && !isTokenEncrypted(integration.accessToken)) {
          updates.accessToken = encryptToken(integration.accessToken);
          needsUpdate = true;
        }

        // Encrypt refreshToken if not already encrypted
        if (integration.refreshToken && !isTokenEncrypted(integration.refreshToken)) {
          updates.refreshToken = encryptToken(integration.refreshToken);
          needsUpdate = true;
        }

        if (needsUpdate) {
          await prisma.gitHubIntegration.update({
            where: { id: integration.id },
            data: updates,
          });
          stats.githubIntegrationsEncrypted++;
          console.log(`   ✓ Encrypted tokens for GitHub user ${integration.githubUsername}`);
        }
      } catch (error) {
        stats.errors++;
        console.error(`   ✗ Error encrypting GitHub integration ${integration.id}:`, error);
      }
    }

    console.log(`\n✓ GitHub migration complete:`);
    console.log(`   - ${stats.githubIntegrationsChecked} integrations checked`);
    console.log(`   - ${stats.githubIntegrationsEncrypted} integrations updated\n`);

    // Final summary
    console.log('═══════════════════════════════════════');
    console.log('✅ Migration Complete!');
    console.log('═══════════════════════════════════════');
    console.log(`Total accounts checked: ${stats.accountsChecked}`);
    console.log(`Total accounts updated: ${stats.accountsEncrypted}`);
    console.log(`Total GitHub integrations checked: ${stats.githubIntegrationsChecked}`);
    console.log(`Total GitHub integrations updated: ${stats.githubIntegrationsEncrypted}`);
    console.log(`Total errors: ${stats.errors}`);
    console.log('═══════════════════════════════════════\n');

    if (stats.errors > 0) {
      console.warn('⚠️  Some errors occurred during migration. Review logs above.');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateTokens()
  .then(() => {
    console.log('✓ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('✗ Script failed:', error);
    process.exit(1);
  });
