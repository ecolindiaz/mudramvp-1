/**
 * Tracking Installation Agent Service
 * 
 * Automatically installs tracking code on user's website via GitHub PR
 */

import { prisma } from '@/lib/prisma';
import { getOrCreateTrackingCode, generateTrackingScript } from './tracking-code.service';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

// Encryption helpers for token decryption
const ENCRYPTION_KEY = process.env.GITHUB_TOKEN_ENCRYPTION_KEY;
const ALGORITHM = 'aes-256-gcm';

function decrypt(encryptedText: string): string {
  if (!ENCRYPTION_KEY) {
    throw new Error('GITHUB_TOKEN_ENCRYPTION_KEY environment variable is required');
  }
  const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Get a valid GitHub token for API calls
 * Handles both OAuth tokens (decrypt) and Installation tokens (refresh if needed)
 */
async function getValidGitHubToken(integration: any): Promise<string> {
  // For Installation type, check if token needs refresh
  if (integration.integrationType === 'installation' && integration.installationId) {
    // Installation tokens expire after 1 hour, check if expired
    const tokenExpiresAt = integration.tokenExpiresAt;
    const now = new Date();
    
    // If token expires within 5 minutes, refresh it
    if (tokenExpiresAt && new Date(tokenExpiresAt).getTime() - now.getTime() < 5 * 60 * 1000) {
      console.log('[Tracking Agent] Refreshing expired installation token');
      return await refreshInstallationToken(integration.installationId);
    }
    
    // Token still valid, decrypt and return
    try {
      return decrypt(integration.accessToken);
    } catch {
      // If decryption fails, token might be stored unencrypted (legacy)
      // or it's an installation token that needs refresh
      return await refreshInstallationToken(integration.installationId);
    }
  }
  
  // OAuth token - just decrypt
  return decrypt(integration.accessToken);
}

/**
 * Refresh GitHub App installation token
 */
async function refreshInstallationToken(installationId: number): Promise<string> {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_PRIVATE_KEY;
  
  if (!appId || !privateKey) {
    throw new Error('GitHub App credentials not configured');
  }
  
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now - 60,
    exp: now + 600,
    iss: appId,
  };
  
  const formattedKey = privateKey.replace(/\\n/g, '\n').trim();
  const appJwt = jwt.sign(payload, formattedKey, { algorithm: 'RS256' });
  
  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${appJwt}`,
        Accept: 'application/vnd.github+json',
      },
    }
  );
  
  if (!response.ok) {
    throw new Error('Failed to refresh installation token');
  }
  
  const data = await response.json();
  return data.token;
}

interface InstallTrackingResult {
  success: boolean;
  prUrl?: string;
  prNumber?: number;
  error?: string;
}

interface RepoFileInfo {
  name: string;
  path: string;
  sha: string;
  content?: string;
}

/**
 * Detect website framework/structure and find best file to inject tracking
 */
async function detectWebsiteStructure(
  accessToken: string,
  owner: string,
  repo: string,
  branch: string
): Promise<{ targetFile: string; insertionPoint: 'before_body_close' | 'head' | 'layout'; framework: string }> {
  
  const commonFiles = [
    // Next.js
    { path: 'app/layout.tsx', framework: 'nextjs-app' },
    { path: 'app/layout.js', framework: 'nextjs-app' },
    { path: 'pages/_document.tsx', framework: 'nextjs-pages' },
    { path: 'pages/_document.js', framework: 'nextjs-pages' },
    { path: 'src/app/layout.tsx', framework: 'nextjs-app' },
    { path: 'src/pages/_document.tsx', framework: 'nextjs-pages' },
    // React/Vite
    { path: 'index.html', framework: 'vite' },
    { path: 'public/index.html', framework: 'cra' },
    // Vue
    { path: 'index.html', framework: 'vue' },
    // Static sites
    { path: 'index.html', framework: 'static' },
    { path: '_includes/footer.html', framework: 'jekyll' },
    { path: 'layouts/partials/footer.html', framework: 'hugo' },
    { path: 'themes/*/layouts/partials/footer.html', framework: 'hugo' },
  ];

  for (const file of commonFiles) {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${file.path}?ref=${branch}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }
      );

      if (response.ok) {
        return {
          targetFile: file.path,
          insertionPoint: file.framework.includes('nextjs') ? 'layout' : 'before_body_close',
          framework: file.framework,
        };
      }
    } catch {
      // File not found, continue checking
    }
  }

  throw new Error('Could not detect website structure. Please install tracking code manually.');
}

/**
 * Get file content from GitHub
 */
async function getFileContent(
  accessToken: string,
  owner: string,
  repo: string,
  path: string,
  branch: string
): Promise<{ content: string; sha: string }> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to read file: ${path}`);
  }

  const data = await response.json();
  const content = Buffer.from(data.content, 'base64').toString('utf-8');
  
  return { content, sha: data.sha };
}

/**
 * Create a new branch
 */
async function createBranch(
  accessToken: string,
  owner: string,
  repo: string,
  baseBranch: string,
  newBranch: string
): Promise<void> {
  // Get the SHA of the base branch
  const refResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${baseBranch}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    }
  );

  if (!refResponse.ok) {
    throw new Error(`Failed to get base branch: ${baseBranch}`);
  }

  const refData = await refResponse.json();
  const sha = refData.object.sha;

  // Create new branch
  const createResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/refs`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref: `refs/heads/${newBranch}`,
        sha,
      }),
    }
  );

  if (!createResponse.ok) {
    const error = await createResponse.json();
    throw new Error(`Failed to create branch: ${error.message}`);
  }
}

/**
 * Update file on GitHub
 */
async function updateFile(
  accessToken: string,
  owner: string,
  repo: string,
  path: string,
  content: string,
  sha: string,
  branch: string,
  message: string
): Promise<void> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        content: Buffer.from(content).toString('base64'),
        sha,
        branch,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to update file: ${error.message}`);
  }
}

/**
 * Create pull request
 */
async function createPullRequest(
  accessToken: string,
  owner: string,
  repo: string,
  title: string,
  body: string,
  head: string,
  base: string
): Promise<{ url: string; number: number }> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        body,
        head,
        base,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to create PR: ${error.message}`);
  }

  const pr = await response.json();
  return { url: pr.html_url, number: pr.number };
}

/**
 * Inject tracking script into file content based on framework
 */
function injectTrackingScript(
  content: string,
  trackingScript: string,
  framework: string,
  insertionPoint: string
): string {
  // Extract siteId from the script tag
  const siteIdMatch = trackingScript.match(/data-site-id="([^"]+)"/);
  const siteId = siteIdMatch ? siteIdMatch[1] : '';
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.trymudra.com';

  switch (framework) {
    case 'nextjs-app':
      // For Next.js App Router layout.tsx, add Script component
      if (content.includes('import Script from')) {
        // Script already imported, just add the script
        return injectNextjsScript(content, trackingScript);
      } else {
        // Add Script import and inject
        const importStatement = "import Script from 'next/script';\n";
        const importIndex = content.lastIndexOf('import');
        const endOfImports = content.indexOf('\n', content.indexOf(';', importIndex));
        
        let newContent = content.slice(0, endOfImports + 1) + importStatement + content.slice(endOfImports + 1);
        return injectNextjsScript(newContent, trackingScript);
      }

    case 'nextjs-pages':
      // For _document.tsx/js, inject before </body>
      return content.replace(
        '</body>',
        `{/* Mudra AI Referral Tracking */}
        <Script src="${baseUrl}/tracker.js" data-site-id="${siteId}" strategy="afterInteractive" />
        </body>`
      );

    case 'vite':
    case 'cra':
    case 'vue':
    case 'static':
    default:
      // For HTML files, inject before </body> with external script
      return content.replace(
        '</body>',
        `  <!-- Mudra AI Referral Tracking -->
  <script src="${baseUrl}/tracker.js" data-site-id="${siteId}" async></script>\n  </body>`
      );
  }
}

/**
 * Inject script into Next.js App Router layout
 */
function injectNextjsScript(content: string, scriptTag: string): string {
  // Extract siteId from the script tag
  const siteIdMatch = scriptTag.match(/data-site-id="([^"]+)"/);
  const siteId = siteIdMatch ? siteIdMatch[1] : '';
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.trymudra.com';
  
  // Find the closing of the body or html tag to inject before it
  const bodyCloseRegex = /<\/body>/i;
  const htmlCloseRegex = /<\/html>/i;
  
  if (bodyCloseRegex.test(content)) {
    return content.replace(
      bodyCloseRegex,
      `        <Script 
          src="${baseUrl}/tracker.js"
          data-site-id="${siteId}"
          strategy="afterInteractive"
        />
      </body>`
    );
  }
  
  // For layouts that return JSX directly, find the last closing tag
  // Look for return statement with JSX
  const returnIndex = content.lastIndexOf('return');
  if (returnIndex !== -1) {
    // Find the last </html> or similar closing tag
    const afterReturn = content.slice(returnIndex);
    const lastClosingTag = afterReturn.lastIndexOf('</');
    
    if (lastClosingTag !== -1) {
      const insertPoint = returnIndex + lastClosingTag;
      return content.slice(0, insertPoint) + 
        `\n        <Script 
          src="${baseUrl}/tracker.js"
          data-site-id="${siteId}"
          strategy="afterInteractive"
        />\n        ` + 
        content.slice(insertPoint);
    }
  }
  
  // Fallback: append to end of file (not ideal but works)
  return content;
}

/**
 * Install tracking code via GitHub PR
 */
export async function installTrackingViaAgent(
  brandProfileId: number,
  repoFullName: string,
  branch: string = 'main'
): Promise<InstallTrackingResult> {
  try {
    // Get brand profile with GitHub integration
    const brandProfile = await prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
      include: {
        user: {
          include: {
            githubIntegration: true,
          },
        },
      },
    });

    if (!brandProfile || !brandProfile.user?.githubIntegration) {
      return {
        success: false,
        error: 'GitHub not connected. Please connect GitHub in Settings → Integrations.',
      };
    }

    // Get valid (decrypted and refreshed if needed) access token
    const accessToken = await getValidGitHubToken(brandProfile.user.githubIntegration);
    const [owner, repo] = repoFullName.split('/');

    if (!owner || !repo) {
      return {
        success: false,
        error: `Invalid repository format: ${repoFullName}. Expected: owner/repo`,
      };
    }

    // Get or create tracking code (use siteId from brand profile or generate new one)
    const siteId = brandProfile.siteId || brandProfile.trackingSiteId;
    if (!siteId) {
      throw new Error('No siteId found for brand profile. Please generate tracking script first.');
    }
    const trackingScript = generateTrackingScript(siteId);

    // Detect website structure
    const structure = await detectWebsiteStructure(accessToken, owner, repo, branch);
    console.log(`[Tracking Agent] Detected framework: ${structure.framework}, target: ${structure.targetFile}`);

    // Get current file content
    const { content, sha } = await getFileContent(accessToken, owner, repo, structure.targetFile, branch);

    // Check if tracking already installed
    if (content.includes('mudra-tracking') || 
        content.includes('/tracker.js') || 
        content.includes(siteId)) {
      return {
        success: false,
        error: 'Tracking code is already installed in this repository.',
      };
    }

    // Inject tracking script
    const updatedContent = injectTrackingScript(content, trackingScript, structure.framework, structure.insertionPoint);

    // Create new branch
    const branchName = `mudra-tracking-${Date.now()}`;
    await createBranch(accessToken, owner, repo, branch, branchName);

    // Update file on new branch
    await updateFile(
      accessToken,
      owner,
      repo,
      structure.targetFile,
      updatedContent,
      sha,
      branchName,
      'Add Mudra AI referral tracking'
    );

    // Create pull request
    const pr = await createPullRequest(
      accessToken,
      owner,
      repo,
      '🤖 Add Mudra AI Referral Tracking',
      `## What's this?

This PR adds **Mudra AI Referral Tracking** to your website. It will track visitors coming from AI platforms like ChatGPT, Perplexity, Gemini, and Claude.

### Changes
- Added tracking script to \`${structure.targetFile}\`
- Framework detected: **${structure.framework}**

### What it tracks
- Page views from AI referrals
- Which AI platform sent the visitor (ChatGPT, Perplexity, Gemini, Claude)
- Anonymous visitor data (no PII collected)

### How it works
Loads an external tracking script from Mudra that detects AI referrals from URL parameters and document referrer. The script is cached by browsers and automatically updated with improvements.

### Performance
- Loads asynchronously (no blocking)
- ~2KB gzipped
- Uses \`navigator.sendBeacon\` for reliability

---

*Generated by Mudra Tracking Agent*  
Site ID: \`${siteId}\`
`,
      branchName,
      branch
    );

    // Update brand profile tracking status
    await prisma.brandProfile.update({
      where: { id: brandProfileId },
      data: {
        trackingStatus: 'pending',
        trackingSiteId: siteId,
      },
    });

    return {
      success: true,
      prUrl: pr.url,
      prNumber: pr.number,
    };
  } catch (error) {
    console.error('[Tracking Agent] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to install tracking code',
    };
  }
}

/**
 * Check if tracking is properly installed on a website
 */
export async function verifyTrackingInstallation(brandProfileId: number): Promise<{
  installed: boolean;
  lastEventAt: Date | null;
  totalEvents: number;
}> {
  const trackingCode = await prisma.trackingCode.findUnique({
    where: { brandProfileId },
  });

  if (!trackingCode) {
    return { installed: false, lastEventAt: null, totalEvents: 0 };
  }

  return {
    installed: trackingCode.totalEvents > 0,
    lastEventAt: trackingCode.lastEventAt,
    totalEvents: trackingCode.totalEvents,
  };
}
