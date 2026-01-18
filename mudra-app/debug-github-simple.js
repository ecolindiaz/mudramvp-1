/**
 * Debug GitHub Sync - Direct API test (no Prisma)
 */

require('dotenv').config({ path: '.env.local' })
const jwt = require('jsonwebtoken')

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
  console.log(colors.blue('  GitHub App Installations Debug'))
  console.log(colors.blue('═══════════════════════════════════════════════════════\n'))

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

  // Generate JWT
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
    console.log(colors.yellow(`   Install it at: https://github.com/apps/${appName || 'your-app-name'}\n`))
    
    console.log(colors.blue('📋 Possible reasons:'))
    console.log('   1. You installed a DIFFERENT GitHub App (mudra-production vs mudra-development)')
    console.log('   2. The app was uninstalled')
    console.log('   3. The GITHUB_APP_ID points to the wrong app\n')
    return
  }

  console.log(colors.cyan('📋 Installation Details:\n'))

  for (const installation of installations) {
    console.log(colors.blue(`── Installation ${installation.id} ──`))
    console.log(`   Account: ${installation.account?.login}`)
    console.log(`   Account Type: ${installation.account?.type}`)
    console.log(`   Created: ${installation.created_at}`)
    console.log(`   Target Type: ${installation.target_type}`)
    console.log(`   HTML URL: ${installation.account?.html_url}`)

    // Get installation token to fetch user info
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

        // Get authenticated user for this installation
        const userResponse = await fetch('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${tokenData.token}`,
            Accept: 'application/vnd.github+json',
          },
        })

        if (userResponse.ok) {
          const githubUser = await userResponse.json()
          console.log(`   GitHub User: ${colors.green(githubUser.login)}`)
          console.log(`   GitHub Email: ${githubUser.email || colors.yellow('(private/not set)')}`)
          console.log(`   GitHub User ID: ${githubUser.id}`)
        } else {
          console.log(`   ${colors.yellow('Could not fetch user info (might be org installation)')}`)
        }
      } else {
        console.log(`   ${colors.yellow('Could not get installation token')}`)
      }
    } catch (err) {
      console.log(`   ${colors.red('Error:')} ${err.message}`)
    }
    console.log('')
  }

  console.log(colors.blue('═══════════════════════════════════════════════════════'))
  console.log(colors.yellow('\n💡 To fix "No GitHub App installation found":'))
  console.log('')
  console.log('   1. Check if you installed the RIGHT app:')
  console.log(`      - Local/Dev: https://github.com/apps/mudra-development`)
  console.log(`      - Production: https://github.com/apps/mudra-production`)
  console.log('')
  console.log('   2. Make sure GITHUB_APP_ID matches the app you installed')
  console.log(`      - Current GITHUB_APP_ID: ${appId}`)
  console.log('')
  console.log('   3. Your email must match or you need prior OAuth integration')
  console.log('')
}

main().catch(console.error)
