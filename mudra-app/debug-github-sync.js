/**
 * Debug GitHub Sync - Find out why installation isn't being matched
 * 
 * This script shows all GitHub App installations and helps debug
 * why the sync might be failing to find a match.
 */

require('dotenv').config({ path: '.env.local' })
const jwt = require('jsonwebtoken')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const colors = {
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  cyan: (text) => `\x1b[36m${text}\x1b[0m`,
  gray: (text) => `\x1b[90m${text}\x1b[0m`,
}

async function main() {
  console.log(colors.blue('\n═══════════════════════════════════════════════════════'))
  console.log(colors.blue('  GitHub Sync Debug - Installation Matcher'))
  console.log(colors.blue('═══════════════════════════════════════════════════════\n'))

  // Step 1: Check App Configuration
  const appId = process.env.GITHUB_APP_ID
  const privateKeyRaw = process.env.GITHUB_PRIVATE_KEY
  const appName = process.env.NEXT_PUBLIC_GITHUB_APP_NAME

  console.log(colors.cyan('📱 App Configuration:'))
  console.log(`   App ID: ${appId || colors.red('NOT SET')}`)
  console.log(`   App Name: ${appName || colors.yellow('NOT SET')}`)
  console.log(`   Private Key: ${privateKeyRaw ? colors.green('SET') : colors.red('NOT SET')}\n`)

  if (!appId || !privateKeyRaw) {
    console.log(colors.red('❌ Missing GitHub App credentials'))
    return
  }

  // Step 2: Generate JWT and fetch installations
  const privateKey = privateKeyRaw.replace(/\\n/g, '\n').trim()
  const now = Math.floor(Date.now() / 1000)
  const appJwt = jwt.sign({ iat: now, exp: now + 600, iss: appId }, privateKey, { algorithm: 'RS256' })

  console.log(colors.cyan('🔍 Fetching all GitHub App installations...\n'))

  const installationsResponse = await fetch('https://api.github.com/app/installations', {
    headers: {
      Authorization: `Bearer ${appJwt}`,
      Accept: 'application/vnd.github+json',
    },
  })

  if (!installationsResponse.ok) {
    console.log(colors.red(`❌ Failed to fetch installations: ${installationsResponse.status}`))
    console.log(await installationsResponse.text())
    return
  }

  const installations = await installationsResponse.json()
  console.log(colors.green(`✅ Found ${installations.length} installation(s)\n`))

  if (installations.length === 0) {
    console.log(colors.yellow('⚠️  No installations found. The GitHub App has not been installed by anyone.'))
    console.log(colors.yellow(`   Install it at: https://github.com/apps/${appName || 'your-app-name'}`))
    return
  }

  // Step 3: Get user info for each installation
  console.log(colors.cyan('📋 Installation Details:\n'))

  for (const installation of installations) {
    console.log(colors.blue(`── Installation ${installation.id} ──`))
    console.log(`   Account: ${installation.account?.login} (${installation.account?.type})`)
    console.log(`   Created: ${installation.created_at}`)
    console.log(`   Target Type: ${installation.target_type}`)

    // Get installation token
    try {
      const tokenResponse = await fetch(
        `https://api.github.com/app/installations/${installation.id}/access_tokens`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${appJwt}`,
            Accept: 'application/vnd.github+json',
          },
        }
      )

      if (tokenResponse.ok) {
        const tokenData = await tokenResponse.json()

        // Get GitHub user info
        const userResponse = await fetch('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${tokenData.token}`,
            Accept: 'application/vnd.github+json',
          },
        })

        if (userResponse.ok) {
          const githubUser = await userResponse.json()
          console.log(`   GitHub User: ${githubUser.login}`)
          console.log(`   GitHub Email: ${githubUser.email || colors.yellow('(private/not set)')}`)
          console.log(`   GitHub User ID: ${githubUser.id}`)
        } else {
          console.log(`   ${colors.yellow('Could not fetch user info (might be org installation)')}`)
        }
      }
    } catch (err) {
      console.log(`   ${colors.red('Error getting installation details:')} ${err.message}`)
    }
    console.log('')
  }

  // Step 4: Show database users for comparison
  console.log(colors.cyan('👥 Database Users (for matching):\n'))

  const users = await prisma.user.findMany({
    include: { githubIntegration: true },
    take: 10,
  })

  for (const user of users) {
    console.log(colors.blue(`── User: ${user.email} ──`))
    if (user.githubIntegration) {
      console.log(`   GitHub Username: ${user.githubIntegration.githubUsername || 'N/A'}`)
      console.log(`   GitHub User ID: ${user.githubIntegration.githubUserId || 'N/A'}`)
      console.log(`   Installation ID: ${user.githubIntegration.installationId || 'N/A'}`)
      console.log(`   Integration Type: ${user.githubIntegration.integrationType || 'oauth'}`)
    } else {
      console.log(`   ${colors.yellow('No GitHub integration yet')}`)
    }
    console.log('')
  }

  // Step 5: Matching Analysis
  console.log(colors.cyan('🔗 Matching Analysis:\n'))

  for (const user of users) {
    console.log(colors.blue(`Checking matches for: ${user.email}`))
    
    for (const installation of installations) {
      try {
        const tokenResponse = await fetch(
          `https://api.github.com/app/installations/${installation.id}/access_tokens`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${appJwt}`,
              Accept: 'application/vnd.github+json',
            },
          }
        )

        if (!tokenResponse.ok) continue

        const tokenData = await tokenResponse.json()
        const userResponse = await fetch('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${tokenData.token}`,
            Accept: 'application/vnd.github+json',
          },
        })

        if (!userResponse.ok) continue

        const githubUser = await userResponse.json()

        // Check all matching conditions
        const emailMatches = githubUser.email?.toLowerCase() === user.email?.toLowerCase()
        const usernameMatches = user.githubIntegration && 
          githubUser.login === user.githubIntegration.githubUsername
        
        let accountLoginMatches = false
        if (installation.account?.type === 'User') {
          if (user.githubIntegration?.githubUsername) {
            accountLoginMatches = installation.account.login === user.githubIntegration.githubUsername
          }
          accountLoginMatches = accountLoginMatches || (githubUser.login === installation.account.login)
        }

        const isMatch = emailMatches || usernameMatches || accountLoginMatches

        console.log(`   Installation ${installation.id} (${installation.account?.login}):`)
        console.log(`     Email match: ${emailMatches ? colors.green('YES') : 'no'} ` +
          `(${githubUser.email || 'private'} vs ${user.email})`)
        console.log(`     Username match: ${usernameMatches ? colors.green('YES') : 'no'} ` +
          `(${githubUser.login} vs ${user.githubIntegration?.githubUsername || 'none'})`)
        console.log(`     Account login match: ${accountLoginMatches ? colors.green('YES') : 'no'} ` +
          `(${installation.account?.login} vs ${user.githubIntegration?.githubUsername || 'none'})`)
        console.log(`     ${isMatch ? colors.green('✅ WOULD MATCH') : colors.red('✗ No match')}`)
      } catch (err) {
        continue
      }
    }
    console.log('')
  }

  console.log(colors.blue('═══════════════════════════════════════════════════════'))
  console.log(colors.yellow('\n💡 If no match is found, you need to:'))
  console.log('   1. Make sure the user\'s GitHub email matches their app email, OR')
  console.log('   2. The user has a previous integration with the correct GitHub username, OR')
  console.log('   3. Use OAuth first to establish the username link\n')

  await prisma.$disconnect()
}

main().catch(console.error)
