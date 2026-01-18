/**
 * Verify GitHub RS256 Private Key Fix
 * 
 * This script tests if the private key format is correct for JWT signing.
 * Run this after deploying the fix to verify it works.
 */

require('dotenv').config({ path: '.env.local' })
const jwt = require('jsonwebtoken')

const colors = {
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  gray: (text) => `\x1b[90m${text}\x1b[0m`,
}

async function verifyGitHubPrivateKey() {
  console.log(colors.blue('\n🔐 Verifying GitHub App Private Key Configuration\n'))

  const appId = process.env.GITHUB_APP_ID
  const privateKey = process.env.GITHUB_PRIVATE_KEY

  // Check if credentials exist
  if (!appId) {
    console.log(colors.red('❌ GITHUB_APP_ID is not set'))
    return false
  }
  console.log(colors.green(`✅ GITHUB_APP_ID is set: ${appId}`))

  if (!privateKey) {
    console.log(colors.red('❌ GITHUB_PRIVATE_KEY is not set'))
    return false
  }
  console.log(colors.green('✅ GITHUB_PRIVATE_KEY is set'))

  // Check key format
  console.log(colors.blue('\n📋 Checking Private Key Format:\n'))
  
  const hasEscapedNewlines = privateKey.includes('\\n')
  const hasActualNewlines = privateKey.includes('\n')
  const startsCorrectly = privateKey.replace(/\\n/g, '\n').trim().startsWith('-----BEGIN')
  const endsCorrectly = privateKey.replace(/\\n/g, '\n').trim().endsWith('-----')

  console.log(`   Has escaped newlines (\\n): ${hasEscapedNewlines ? colors.yellow('Yes - will be converted') : 'No'}`)
  console.log(`   Has actual newlines: ${hasActualNewlines ? 'Yes' : colors.yellow('No')}`)
  console.log(`   Starts with BEGIN marker: ${startsCorrectly ? colors.green('Yes') : colors.red('No')}`)
  console.log(`   Ends with KEY marker: ${endsCorrectly ? colors.green('Yes') : colors.red('No')}`)

  // Format the key (same as production code)
  const formattedKey = privateKey
    .replace(/\\n/g, '\n')  // Replace escaped newlines with actual newlines
    .trim()

  console.log(colors.blue('\n🔑 Attempting RS256 JWT Signing:\n'))

  try {
    const now = Math.floor(Date.now() / 1000)
    const payload = {
      iat: now,
      exp: now + 600, // 10 minutes
      iss: appId,
    }

    const token = jwt.sign(payload, formattedKey, {
      algorithm: 'RS256',
    })

    console.log(colors.green('✅ JWT signing SUCCESSFUL!'))
    console.log(colors.gray(`   Token preview: ${token.substring(0, 50)}...`))

    // Verify we can decode it
    const decoded = jwt.decode(token)
    console.log(colors.gray(`   Issued at: ${new Date(decoded.iat * 1000).toISOString()}`))
    console.log(colors.gray(`   Expires at: ${new Date(decoded.exp * 1000).toISOString()}`))
    console.log(colors.gray(`   Issuer (App ID): ${decoded.iss}`))

    return true
  } catch (error) {
    console.log(colors.red(`❌ JWT signing FAILED: ${error.message}`))
    console.log(colors.yellow('\n📝 Common causes:'))
    console.log('   1. Private key has wrong format (missing newlines)')
    console.log('   2. Private key is not a valid RSA private key')
    console.log('   3. Key was corrupted during copy/paste')
    
    if (error.message.includes('PEM')) {
      console.log(colors.yellow('\n💡 PEM format hint:'))
      console.log('   The key should start with: -----BEGIN RSA PRIVATE KEY-----')
      console.log('   or: -----BEGIN PRIVATE KEY-----')
    }

    return false
  }
}

async function testGitHubAPIConnection() {
  console.log(colors.blue('\n🌐 Testing GitHub API Connection:\n'))

  const appId = process.env.GITHUB_APP_ID
  const privateKey = process.env.GITHUB_PRIVATE_KEY

  if (!appId || !privateKey) {
    console.log(colors.yellow('⚠️  Skipping API test - credentials not available'))
    return
  }

  const formattedKey = privateKey.replace(/\\n/g, '\n').trim()

  try {
    const now = Math.floor(Date.now() / 1000)
    const token = jwt.sign({ iat: now, exp: now + 600, iss: appId }, formattedKey, { algorithm: 'RS256' })

    // Test the JWT against GitHub API
    const response = await fetch('https://api.github.com/app', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    })

    if (response.ok) {
      const app = await response.json()
      console.log(colors.green('✅ GitHub API authentication SUCCESSFUL!'))
      console.log(colors.gray(`   App Name: ${app.name}`))
      console.log(colors.gray(`   App ID: ${app.id}`))
      console.log(colors.gray(`   Owner: ${app.owner?.login || 'N/A'}`))
    } else {
      const error = await response.text()
      console.log(colors.red(`❌ GitHub API authentication FAILED (${response.status})`))
      console.log(colors.gray(`   Error: ${error}`))
    }
  } catch (error) {
    console.log(colors.red(`❌ GitHub API connection error: ${error.message}`))
  }
}

async function main() {
  console.log(colors.blue('═'.repeat(60)))
  console.log(colors.blue('  GitHub Integration Fix Verification'))
  console.log(colors.blue('  Issue: EN-27 - Private key format invalid for RS256'))
  console.log(colors.blue('═'.repeat(60)))

  const signingWorks = await verifyGitHubPrivateKey()
  
  if (signingWorks) {
    await testGitHubAPIConnection()
  }

  console.log(colors.blue('\n' + '═'.repeat(60)))
  if (signingWorks) {
    console.log(colors.green('  ✅ VERIFICATION PASSED - Fix is working!'))
  } else {
    console.log(colors.red('  ❌ VERIFICATION FAILED - Check the issues above'))
  }
  console.log(colors.blue('═'.repeat(60) + '\n'))
}

main().catch(console.error)
