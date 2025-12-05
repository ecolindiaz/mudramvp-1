/**
 * Manual GitHub App Integration Creator
 * 
 * This script creates a GitHub App integration record for testing
 * when the automatic installation callback doesn't work (e.g., localhost testing).
 * 
 * You'll need:
 * 1. Your GitHub App installation ID (from the installation URL)
 * 2. Your GitHub username
 * 3. Your user email (from Mudra database)
 */

const { PrismaClient } = require('@prisma/client')
const jwt = require('jsonwebtoken')
const prisma = new PrismaClient()

// Configuration - UPDATE THESE VALUES
const CONFIG = {
  userEmail: 'your-email@example.com',        // Your Mudra login email
  githubUsername: 'your-github-username',      // Your GitHub username
  installationId: 12345678,                    // From GitHub App installation URL
}

async function getInstallationToken(installationId) {
  const appId = process.env.GITHUB_APP_ID
  const privateKey = process.env.GITHUB_PRIVATE_KEY

  if (!appId || !privateKey) {
    throw new Error('Missing GITHUB_APP_ID or GITHUB_PRIVATE_KEY environment variables')
  }

  // Generate JWT
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    iat: now,
    exp: now + 600,
    iss: appId,
  }

  const appJwt = jwt.sign(payload, privateKey.replace(/\\n/g, '\n'), {
    algorithm: 'RS256',
  })

  console.log('Generated GitHub App JWT')

  // Get installation access token
  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${appJwt}`,
        Accept: 'application/vnd.github+json',
      },
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get installation token: ${error}`)
  }

  const data = await response.json()
  return data.token
}

async function main() {
  console.log('GitHub App Integration Creator\n')
  console.log('Configuration:')
  console.log(`  Email: ${CONFIG.userEmail}`)
  console.log(`  GitHub User: ${CONFIG.githubUsername}`)
  console.log(`  Installation ID: ${CONFIG.installationId}\n`)

  // Find user
  const user = await prisma.user.findUnique({
    where: { email: CONFIG.userEmail },
    include: { githubIntegration: true }
  })

  if (!user) {
    throw new Error(`User with email ${CONFIG.userEmail} not found`)
  }

  console.log(`Found user: ${user.name || user.email}`)

  // Check for existing integration
  if (user.githubIntegration) {
    console.log('\n⚠️  Existing GitHub integration found!')
    console.log(`  Type: ${user.githubIntegration.integrationType || 'oauth'}`)
    console.log(`  Username: ${user.githubIntegration.username}`)
    
    const answer = await new Promise((resolve) => {
      process.stdout.write('\nDelete and recreate? (y/n): ')
      process.stdin.once('data', (data) => {
        resolve(data.toString().trim().toLowerCase())
      })
    })

    if (answer !== 'y') {
      console.log('Aborted.')
      return
    }

    await prisma.gitHubIntegration.delete({
      where: { id: user.githubIntegration.id }
    })
    console.log('Deleted existing integration')
  }

  // Get fresh installation token
  console.log('\nFetching installation token from GitHub...')
  const accessToken = await getInstallationToken(CONFIG.installationId)
  console.log('✓ Got installation token')

  // Fetch GitHub user data
  console.log('Fetching GitHub user data...')
  const userResponse = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
    },
  })

  if (!userResponse.ok) {
    throw new Error('Failed to fetch GitHub user data')
  }

  const userData = await userResponse.json()
  console.log(`✓ Verified GitHub user: ${userData.login}`)

  // Create integration
  console.log('\nCreating GitHub App integration...')
  const integration = await prisma.gitHubIntegration.create({
    data: {
      userId: user.id,
      accessToken: accessToken, // Note: In production, this should be encrypted
      refreshToken: null,
      expiresAt: null,
      scope: 'installation',
      githubUserId: userData.id.toString(),
      username: userData.login,
      email: userData.email,
      avatarUrl: userData.avatar_url,
      installationId: CONFIG.installationId,
      integrationType: 'installation',
    }
  })

  console.log('✓ Integration created successfully!\n')
  console.log('Integration Details:')
  console.log(`  ID: ${integration.id}`)
  console.log(`  Type: ${integration.integrationType}`)
  console.log(`  Installation ID: ${integration.installationId}`)
  console.log(`  GitHub User: ${integration.username}`)
  console.log(`  Created: ${integration.createdAt}`)
  console.log('\n✓ You can now deploy Content Optimizer agents!')
}

main()
  .catch((error) => {
    console.error('\n❌ Error:', error.message)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
