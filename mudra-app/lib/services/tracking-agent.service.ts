/**
 * Tracking Installation Agent Service
 * 
 * Automatically installs tracking code on user's website via GitHub PR
 */

import { prisma } from '@/lib/prisma';
import { getOrCreateTrackingCode, generateTrackingScript } from './tracking-code.service';

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
  // Clean up the script for different frameworks
  const scriptOnly = trackingScript
    .replace('<!-- Mudra AI Referral Tracking -->\n', '')
    .trim();

  switch (framework) {
    case 'nextjs-app':
      // For Next.js App Router layout.tsx, add Script component
      if (content.includes('import Script from')) {
        // Script already imported, just add the script
        return injectNextjsScript(content, scriptOnly);
      } else {
        // Add Script import and inject
        const importStatement = "import Script from 'next/script';\n";
        const importIndex = content.lastIndexOf('import');
        const endOfImports = content.indexOf('\n', content.indexOf(';', importIndex));
        
        let newContent = content.slice(0, endOfImports + 1) + importStatement + content.slice(endOfImports + 1);
        return injectNextjsScript(newContent, scriptOnly);
      }

    case 'nextjs-pages':
      // For _document.tsx/js, inject before </body>
      return content.replace(
        '</body>',
        `{/* Mudra AI Referral Tracking */}
        <script dangerouslySetInnerHTML={{ __html: \`${scriptOnly.replace(/<\/?script>/g, '').trim()}\` }} />
        </body>`
      );

    case 'vite':
    case 'cra':
    case 'vue':
    case 'static':
    default:
      // For HTML files, inject before </body>
      return content.replace(
        '</body>',
        `  ${trackingScript}\n  </body>`
      );
  }
}

/**
 * Inject script into Next.js App Router layout
 */
function injectNextjsScript(content: string, script: string): string {
  // Extract just the JS code from the script tag
  const jsCode = script.replace(/<\/?script>/g, '').trim();
  
  // Find the closing of the body or html tag to inject before it
  const bodyCloseRegex = /<\/body>/i;
  const htmlCloseRegex = /<\/html>/i;
  
  if (bodyCloseRegex.test(content)) {
    return content.replace(
      bodyCloseRegex,
      `        <Script id="mudra-tracking" strategy="afterInteractive">
          {\`${jsCode}\`}
        </Script>
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
        `\n        <Script id="mudra-tracking" strategy="afterInteractive">
          {\`${jsCode}\`}
        </Script>\n        ` + 
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

    const accessToken = brandProfile.user.githubIntegration.accessToken;
    const [owner, repo] = repoFullName.split('/');

    if (!owner || !repo) {
      return {
        success: false,
        error: `Invalid repository format: ${repoFullName}. Expected: owner/repo`,
      };
    }

    // Get or create tracking code
    const trackingCode = await getOrCreateTrackingCode(brandProfileId);
    const trackingScript = generateTrackingScript(trackingCode.trackingId);

    // Detect website structure
    const structure = await detectWebsiteStructure(accessToken, owner, repo, branch);
    console.log(`[Tracking Agent] Detected framework: ${structure.framework}, target: ${structure.targetFile}`);

    // Get current file content
    const { content, sha } = await getFileContent(accessToken, owner, repo, structure.targetFile, branch);

    // Check if tracking already installed
    if (content.includes('mudra-tracking') || content.includes(trackingCode.trackingId)) {
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
The lightweight script (~1KB) runs after page load and sends a beacon to Mudra's analytics API. It uses \`navigator.sendBeacon\` for zero impact on page performance.

---

*Generated by Mudra Tracking Agent*  
Tracking ID: \`${trackingCode.trackingId}\`
`,
      branchName,
      branch
    );

    // Update tracking code status
    await prisma.trackingCode.update({
      where: { id: trackingCode.id },
      data: {
        updatedAt: new Date(),
      },
    });

    // Update brand profile tracking status
    await prisma.brandProfile.update({
      where: { id: brandProfileId },
      data: {
        trackingStatus: 'pending',
        trackingSiteId: trackingCode.trackingId,
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
