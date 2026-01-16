/**
 * Test Script for GitHub Integration Cross-Account Bug Fix
 * 
 * This script helps verify that the GitHub sync endpoint correctly
 * matches installations to the current user and doesn't leak data
 * between accounts.
 * 
 * SETUP REQUIRED:
 * 1. Two separate user accounts in the app (Account A, Account B)
 * 2. Two separate GitHub accounts with the app installed
 * 3. Both users signed in (in different browsers or incognito windows)
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// Simple console colors
const colors = {
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  cyan: (text) => `\x1b[36m${text}\x1b[0m`,
  gray: (text) => `\x1b[90m${text}\x1b[0m`,
}

async function testGitHubIntegrationIsolation() {
  console.log(colors.blue('\n🔍 Testing GitHub Integration User Isolation\n'))

  try {
    // Fetch all GitHub integrations
    const integrations = await prisma.gitHubIntegration.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          }
        }
      }
    })

    console.log(colors.yellow(`Found ${integrations.length} GitHub integration(s)\n`))

    if (integrations.length === 0) {
      console.log(colors.red('❌ No GitHub integrations found. Please connect GitHub for at least one user.'))
      return
    }

    // Display each integration
    integrations.forEach((integration, index) => {
      console.log(colors.cyan(`\n--- Integration ${index + 1} ---`))
      console.log(`User ID: ${integration.userId}`)
      console.log(`User Email: ${integration.user.email}`)
      console.log(`GitHub Username: ${integration.githubUsername}`)
      console.log(`GitHub User ID: ${integration.githubUserId}`)
      console.log(`Installation ID: ${integration.installationId || 'N/A'}`)
      console.log(`Integration Type: ${integration.integrationType}`)
      console.log(`Created: ${integration.createdAt}`)
      console.log(`Updated: ${integration.updatedAt}`)
    })

    // Check for duplicates
    console.log(colors.blue('\n\n🔍 Checking for Duplicate Installations\n'))
    
    const installationIds = integrations
      .filter(i => i.installationId)
      .map(i => i.installationId)
    
    const duplicates = installationIds.filter(
      (id, index) => installationIds.indexOf(id) !== index
    )

    if (duplicates.length > 0) {
      console.log(colors.red(`❌ CRITICAL: Found duplicate installation IDs: ${duplicates.join(', ')}`))
      console.log(colors.red('This indicates multiple users are sharing the same GitHub installation!'))
    } else {
      console.log(colors.green('✅ No duplicate installation IDs found'))
    }

    // Check for user isolation
    console.log(colors.blue('\n\n🔍 Checking User Isolation\n'))
    
    const userIds = integrations.map(i => i.userId)
    const uniqueUserIds = [...new Set(userIds)]

    if (userIds.length !== uniqueUserIds.length) {
      console.log(colors.red('❌ CRITICAL: Multiple integrations for the same user found!'))
    } else {
      console.log(colors.green(`✅ Each user has exactly one integration (${uniqueUserIds.length} users)`))
    }

    // Verify email matching
    console.log(colors.blue('\n\n🔍 Verifying Email Matching Logic\n'))
    
    for (const integration of integrations) {
      const userEmail = integration.user.email?.toLowerCase()
      const githubEmail = integration.email?.toLowerCase()
      
      if (githubEmail && userEmail !== githubEmail) {
        console.log(colors.yellow(`⚠️  User ${integration.user.email} has different GitHub email: ${integration.email}`))
        console.log(colors.yellow('   This may cause sync issues if using email matching'))
      } else if (!githubEmail) {
        console.log(colors.gray(`ℹ️  User ${integration.user.email}: No GitHub email stored (will use username matching)`))
      } else {
        console.log(colors.green(`✅ User ${integration.user.email}: Email matches GitHub email`))
      }
    }

    console.log(colors.green('\n\n✅ Isolation check complete!\n'))

  } catch (error) {
    console.error(colors.red('\n❌ Error running tests:'), error)
  } finally {
    await prisma.$disconnect()
  }
}

async function simulateSyncForUser(userEmail) {
  console.log(colors.blue(`\n🔄 Simulating sync for user: ${userEmail}\n`))

  try {
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
      include: { githubIntegration: true }
    })

    if (!user) {
      console.log(colors.red(`❌ User not found: ${userEmail}`))
      return
    }

    console.log(colors.cyan('User Details:'))
    console.log(`ID: ${user.id}`)
    console.log(`Email: ${user.email}`)
    console.log(`Name: ${user.name}`)

    if (user.githubIntegration) {
      console.log(colors.cyan('\nExisting GitHub Integration:'))
      console.log(`GitHub Username: ${user.githubIntegration.githubUsername}`)
      console.log(`GitHub User ID: ${user.githubIntegration.githubUserId}`)
      console.log(`Installation ID: ${user.githubIntegration.installationId}`)
      console.log(`Integration Type: ${user.githubIntegration.integrationType}`)
    } else {
      console.log(colors.yellow('\nNo existing GitHub integration'))
    }

    console.log(colors.blue('\n📋 Matching Criteria for Sync:'))
    console.log(`✓ GitHub email must match: ${userEmail}`)
    if (user.githubIntegration) {
      console.log(`✓ OR GitHub username must match: ${user.githubIntegration.githubUsername}`)
    }

  } catch (error) {
    console.error(colors.red('\n❌ Error:'), error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run tests
const args = process.argv.slice(2)

if (args.length > 0) {
  const userEmail = args[0]
  simulateSyncForUser(userEmail)
} else {
  testGitHubIntegrationIsolation()
}
