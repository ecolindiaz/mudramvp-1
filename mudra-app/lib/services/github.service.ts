import { prisma } from '@/lib/prisma'
import jwt from 'jsonwebtoken'
import { decryptToken } from '@/lib/crypto/token-encryption'

/**
 * Refresh GitHub App installation token
 */
async function refreshInstallationToken(installationId: number): Promise<string> {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_PRIVATE_KEY;
  
  if (!appId || !privateKey) {
    console.error('[GitHubService] Missing credentials:', { 
      hasAppId: !!appId, 
      hasPrivateKey: !!privateKey 
    });
    throw new Error('GitHub App credentials not configured. Set GITHUB_APP_ID and GITHUB_PRIVATE_KEY in Vercel.');
  }
  
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now - 60,
    exp: now + 600,
    iss: appId,
  };
  
  try {
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
      const errorBody = await response.text();
      console.error('[GitHubService] Token refresh failed:', {
        status: response.status,
        statusText: response.statusText,
        body: errorBody,
        installationId
      });
      throw new Error(`Failed to refresh installation token: ${response.status} - ${errorBody}`);
    }
    
    const data = await response.json();
    return data.token;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Failed to refresh')) {
      throw error; // Re-throw our custom error
    }
    // JWT signing error (likely bad private key format)
    console.error('[GitHubService] JWT signing failed:', error);
    throw new Error(`GitHub token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get a valid GitHub token for API calls
 */
async function getValidGitHubToken(integration: any): Promise<string> {
  if (integration.integrationType === 'installation' && integration.installationId) {
    const tokenExpiresAt = integration.tokenExpiresAt;
    const now = new Date();
    
    if (tokenExpiresAt && new Date(tokenExpiresAt).getTime() - now.getTime() < 5 * 60 * 1000) {
      return await refreshInstallationToken(integration.installationId);
    }
    
    try {
      return decryptToken(integration.accessToken);
    } catch {
      return await refreshInstallationToken(integration.installationId);
    }
  }
  
  return decryptToken(integration.accessToken);
}

/**
 * Detect content type from the generated code
 */
type ContentType = 'json-ld' | 'meta-tags' | 'nav-links' | 'faq-section' | 'generic-html' | 'generic-jsx';

function detectContentType(code: string): ContentType {
  if (code.includes('application/ld+json') || code.includes('"@context"') || code.includes("'@context'")) {
    return 'json-ld';
  }
  if (code.includes('<meta ') || code.includes('og:') || code.includes('twitter:')) {
    return 'meta-tags';
  }
  if (code.includes('<nav') || (code.includes('<a href') && code.includes('<ul'))) {
    return 'nav-links';
  }
  if (code.toLowerCase().includes('faq') || code.includes('itemtype="https://schema.org/FAQPage"')) {
    return 'faq-section';
  }
  if (code.includes('<') && code.includes('>')) {
    return 'generic-html';
  }
  return 'generic-jsx';
}

/**
 * Detect framework from file path and content
 */
type FrameworkType = 'nextjs-app' | 'nextjs-pages' | 'react' | 'html' | 'astro' | 'vue';

function detectFramework(filePath: string, content: string): FrameworkType {
  if (filePath.includes('app/layout')) return 'nextjs-app';
  if (filePath.includes('pages/_app') || filePath.includes('pages/_document')) return 'nextjs-pages';
  if (filePath.endsWith('.astro')) return 'astro';
  if (filePath.endsWith('.vue')) return 'vue';
  if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
    if (content.includes('next/head') || content.includes('next/script')) return 'nextjs-app';
    return 'react';
  }
  return 'html';
}

/**
 * Check if similar optimization already exists in the file
 */
function hasExistingOptimization(content: string, newCode: string, contentType: ContentType): boolean {
  // Check for Mudra markers
  if (content.includes('Mudra GEO') || content.includes('mudra-geo')) {
    console.log('[GitHub] Found existing Mudra optimization marker');
    return true;
  }
  
  // Check for specific schema types already present
  if (contentType === 'json-ld') {
    const schemaTypes = ['Organization', 'Product', 'FAQPage', 'Article', 'WebSite', 'BreadcrumbList'];
    for (const schemaType of schemaTypes) {
      if (newCode.includes(`"@type":"${schemaType}"`) || newCode.includes(`"@type": "${schemaType}"`)) {
        // Check if this schema type already exists in the file
        if (content.includes(`"@type":"${schemaType}"`) || content.includes(`"@type": "${schemaType}"`)) {
          console.log(`[GitHub] Schema type ${schemaType} already exists`);
          return true;
        }
      }
    }
  }
  
  // Check for meta tag duplicates
  if (contentType === 'meta-tags') {
    const metaPropertyMatch = newCode.match(/property="([^"]+)"/);
    if (metaPropertyMatch && content.includes(`property="${metaPropertyMatch[1]}"`)) {
      console.log(`[GitHub] Meta property ${metaPropertyMatch[1]} already exists`);
      return true;
    }
  }
  
  return false;
}

/**
 * Repo structure cache to avoid repeated API calls
 */
interface RepoStructure {
  framework: 'nextjs-app' | 'nextjs-pages' | 'astro' | 'nuxt' | 'react' | 'html' | 'unknown'
  hasAppDir: boolean
  hasPagesDir: boolean
  hasSrcDir: boolean
  pageFiles: string[]  // All page/route files found
  layoutFiles: string[]  // All layout files found
  timestamp: number
}

const repoStructureCache = new Map<string, RepoStructure>()
const CACHE_TTL = 5 * 60 * 1000  // 5 minutes

/**
 * Fetch and analyze repo structure
 */
async function getRepoStructure(
  accessToken: string,
  owner: string,
  repo: string,
  branch: string
): Promise<RepoStructure> {
  const cacheKey = `${owner}/${repo}/${branch}`
  const cached = repoStructureCache.get(cacheKey)
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[GitHub] Using cached repo structure for ${cacheKey}`)
    return cached
  }
  
  console.log(`[GitHub] Fetching repo tree for ${owner}/${repo}...`)
  
  try {
    // Get the default branch SHA
    const refResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${branch}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    )
    
    if (!refResponse.ok) {
      console.log(`[GitHub] Failed to get branch ref: ${refResponse.status}`)
      return createFallbackStructure()
    }
    
    const refData = await refResponse.json()
    const sha = refData.object.sha
    
    // Fetch the tree recursively (limited to reasonable size)
    const treeResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${sha}?recursive=1`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    )
    
    if (!treeResponse.ok) {
      console.log(`[GitHub] Failed to get tree: ${treeResponse.status}`)
      return createFallbackStructure()
    }
    
    const treeData = await treeResponse.json()
    
    // Check if tree is truncated (very large repo)
    if (treeData.truncated) {
      console.log(`[GitHub] Tree truncated - large repo detected. Using heuristic detection.`)
      // For large repos, we'll do targeted checks instead
      return await detectStructureFromTargetedChecks(accessToken, owner, repo, branch)
    }
    
    const files = treeData.tree.filter((item: any) => item.type === 'blob').map((item: any) => item.path)
    
    const structure = analyzeRepoFiles(files)
    structure.timestamp = Date.now()
    
    repoStructureCache.set(cacheKey, structure)
    console.log(`[GitHub] Detected framework: ${structure.framework}, pages: ${structure.pageFiles.length}`)
    
    return structure
    
  } catch (error) {
    console.error(`[GitHub] Error fetching repo structure:`, error)
    return createFallbackStructure()
  }
}

/**
 * For large repos, do targeted checks instead of full tree
 */
async function detectStructureFromTargetedChecks(
  accessToken: string,
  owner: string,
  repo: string,
  branch: string
): Promise<RepoStructure> {
  const checkPaths = ['app', 'src/app', 'pages', 'src/pages', 'src']
  
  let hasAppDir = false
  let hasPagesDir = false
  let hasSrcDir = false
  
  for (const path of checkPaths) {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }
      )
      
      if (response.ok) {
        if (path.includes('app')) hasAppDir = true
        if (path.includes('pages')) hasPagesDir = true
        if (path === 'src') hasSrcDir = true
      }
    } catch {
      // Ignore errors, just means path doesn't exist
    }
  }
  
  const framework = hasAppDir ? 'nextjs-app' : hasPagesDir ? 'nextjs-pages' : 'unknown'
  
  return {
    framework,
    hasAppDir,
    hasPagesDir,
    hasSrcDir,
    pageFiles: [],  // Can't enumerate in large repos
    layoutFiles: [],
    timestamp: Date.now()
  }
}

/**
 * Analyze file list to determine repo structure
 */
function analyzeRepoFiles(files: string[]): RepoStructure {
  const hasAppDir = files.some(f => f.startsWith('app/') || f.startsWith('src/app/'))
  const hasPagesDir = files.some(f => f.startsWith('pages/') || f.startsWith('src/pages/'))
  const hasSrcDir = files.some(f => f.startsWith('src/'))
  
  // Find all page files
  const pageFiles = files.filter(f => {
    // Next.js App Router
    if (f.match(/app\/.*\/page\.(tsx?|jsx?)$/) || f.match(/app\/page\.(tsx?|jsx?)$/)) return true
    // Next.js Pages Router
    if (f.match(/pages\/.*\.(tsx?|jsx?)$/) && !f.includes('_app') && !f.includes('_document')) return true
    // Astro
    if (f.match(/src\/pages\/.*\.astro$/)) return true
    // Static HTML
    if (f.endsWith('.html') && !f.includes('node_modules')) return true
    return false
  })
  
  // Find all layout files
  const layoutFiles = files.filter(f => {
    if (f.match(/app\/.*\/layout\.(tsx?|jsx?)$/) || f.match(/app\/layout\.(tsx?|jsx?)$/)) return true
    if (f.includes('_app.') || f.includes('_document.')) return true
    if (f.match(/layouts\/.*\.(tsx?|jsx?|astro)$/)) return true
    return false
  })
  
  // Determine framework
  let framework: RepoStructure['framework'] = 'unknown'
  if (hasAppDir && files.some(f => f.includes('next.config'))) {
    framework = 'nextjs-app'
  } else if (hasPagesDir && files.some(f => f.includes('next.config'))) {
    framework = 'nextjs-pages'
  } else if (files.some(f => f.includes('astro.config'))) {
    framework = 'astro'
  } else if (files.some(f => f.includes('nuxt.config'))) {
    framework = 'nuxt'
  } else if (files.some(f => f.includes('package.json'))) {
    framework = 'react'  // Generic React/Node project
  } else if (files.some(f => f.endsWith('.html'))) {
    framework = 'html'
  }
  
  return {
    framework,
    hasAppDir,
    hasPagesDir,
    hasSrcDir,
    pageFiles,
    layoutFiles,
    timestamp: 0
  }
}

function createFallbackStructure(): RepoStructure {
  return {
    framework: 'unknown',
    hasAppDir: false,
    hasPagesDir: false,
    hasSrcDir: false,
    pageFiles: [],
    layoutFiles: [],
    timestamp: Date.now()
  }
}

/**
 * Map a URL path to the best file in the repo
 * E.g., /pricing → app/pricing/page.tsx or pages/pricing.tsx
 */
function mapUrlToFile(
  urlPath: string,
  structure: RepoStructure,
  contentType: ContentType,
  isGlobalContent: boolean
): string[] {
  // Clean up URL path
  let cleanPath = urlPath
    .replace(/^https?:\/\/[^/]+/, '')  // Remove domain
    .replace(/^\//, '')                 // Remove leading slash
    .replace(/\/$/, '')                 // Remove trailing slash
    .replace(/\.[^/.]+$/, '')           // Remove file extension
  
  if (!cleanPath || cleanPath === '') cleanPath = ''  // Homepage
  
  console.log(`[GitHub] Mapping URL "${urlPath}" → path "${cleanPath}" (framework: ${structure.framework})`)
  
  // For global content, always use layout/document files
  if (isGlobalContent) {
    return getGlobalFiles(structure)
  }
  
  // For page-specific content, find the matching page file
  const candidates: string[] = []
  
  if (structure.framework === 'nextjs-app') {
    const prefix = structure.hasSrcDir ? 'src/app' : 'app'
    
    if (cleanPath === '') {
      // Homepage
      candidates.push(`${prefix}/page.tsx`, `${prefix}/page.jsx`)
    } else {
      // Specific page - check if it exists in pageFiles
      const matchingPages = structure.pageFiles.filter(f => 
        f.includes(`/${cleanPath}/page.`) || f.endsWith(`/${cleanPath}/page.tsx`) || f.endsWith(`/${cleanPath}/page.jsx`)
      )
      candidates.push(...matchingPages)
      
      // Fallback: construct expected path
      candidates.push(`${prefix}/${cleanPath}/page.tsx`, `${prefix}/${cleanPath}/page.jsx`)
    }
    
    // Always include root page as fallback
    candidates.push(`${prefix}/page.tsx`)
    
  } else if (structure.framework === 'nextjs-pages') {
    const prefix = structure.hasSrcDir ? 'src/pages' : 'pages'
    
    if (cleanPath === '') {
      candidates.push(`${prefix}/index.tsx`, `${prefix}/index.jsx`)
    } else {
      const matchingPages = structure.pageFiles.filter(f => 
        f.includes(`/${cleanPath}.`) || f.endsWith(`/${cleanPath}/index.tsx`)
      )
      candidates.push(...matchingPages)
      candidates.push(`${prefix}/${cleanPath}.tsx`, `${prefix}/${cleanPath}/index.tsx`)
    }
    
    candidates.push(`${prefix}/index.tsx`)
    
  } else if (structure.framework === 'astro') {
    if (cleanPath === '') {
      candidates.push('src/pages/index.astro')
    } else {
      candidates.push(`src/pages/${cleanPath}.astro`, `src/pages/${cleanPath}/index.astro`)
    }
    
  } else {
    // Static HTML or unknown
    if (cleanPath === '') {
      candidates.push('index.html', 'public/index.html')
    } else {
      candidates.push(`${cleanPath}.html`, `${cleanPath}/index.html`, 'index.html')
    }
  }
  
  return [...new Set(candidates)]
}

/**
 * Get global/layout files for site-wide content
 */
function getGlobalFiles(structure: RepoStructure): string[] {
  const files: string[] = []
  
  if (structure.framework === 'nextjs-app') {
    const prefix = structure.hasSrcDir ? 'src/app' : 'app'
    files.push(`${prefix}/layout.tsx`, `${prefix}/layout.jsx`)
  } else if (structure.framework === 'nextjs-pages') {
    const prefix = structure.hasSrcDir ? 'src/pages' : 'pages'
    files.push(`${prefix}/_document.tsx`, `${prefix}/_app.tsx`)
  } else if (structure.framework === 'astro') {
    // Find layout files from cache
    files.push(...structure.layoutFiles.filter(f => f.includes('Layout')))
    files.push('src/layouts/Layout.astro')
  } else {
    files.push('index.html', 'public/index.html')
  }
  
  return files
}

/**
 * Convert HTML to JSX-compatible format
 */
function htmlToJsx(html: string): string {
  return html
    .replace(/class=/g, 'className=')
    .replace(/for=/g, 'htmlFor=')
    .replace(/<!--[\s\S]*?-->/g, '') // Remove HTML comments
    .replace(/(<\w+[^>]*)\s*>/g, (match, tag) => {
      // Self-closing tags
      if (tag.match(/<(meta|link|img|br|hr|input)/i)) {
        return tag + ' />';
      }
      return match;
    });
}

/**
 * Parse HTML meta tags and convert to Next.js metadata object format
 */
function parseMetaTagsToNextJsMetadata(htmlCode: string): { metadataCode: string; fields: string[] } {
  const fields: string[] = [];
  
  // Extract title
  const titleMatch = htmlCode.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) {
    fields.push(`  title: "${titleMatch[1].replace(/"/g, '\\"')}",`);
  }
  
  // Extract meta name="description"
  const descMatch = htmlCode.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
  if (descMatch) {
    fields.push(`  description: "${descMatch[1].replace(/"/g, '\\"')}",`);
  }
  
  // Extract canonical URL
  const canonicalMatch = htmlCode.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
  
  // Extract Open Graph tags
  const ogTags: string[] = [];
  const ogMatches = htmlCode.matchAll(/<meta\s+property=["'](og:[^"']+)["']\s+content=["']([^"']+)["']/gi);
  for (const match of ogMatches) {
    const prop = match[1].replace('og:', '');
    const value = match[2];
    if (prop === 'title') ogTags.push(`    title: "${value.replace(/"/g, '\\"')}",`);
    else if (prop === 'description') ogTags.push(`    description: "${value.replace(/"/g, '\\"')}",`);
    else if (prop === 'url') ogTags.push(`    url: "${value}",`);
    else if (prop === 'type') ogTags.push(`    type: "${value}",`);
    else if (prop === 'image') ogTags.push(`    images: ["${value}"],`);
    else if (prop === 'site_name') ogTags.push(`    siteName: "${value.replace(/"/g, '\\"')}",`);
  }
  
  if (ogTags.length > 0) {
    fields.push(`  openGraph: {\n${ogTags.join('\n')}\n  },`);
  }
  
  // Extract Twitter tags
  const twitterTags: string[] = [];
  const twitterMatches = htmlCode.matchAll(/<meta\s+name=["'](twitter:[^"']+)["']\s+content=["']([^"']+)["']/gi);
  for (const match of twitterMatches) {
    const prop = match[1].replace('twitter:', '');
    const value = match[2];
    if (prop === 'card') twitterTags.push(`    card: "${value}",`);
    else if (prop === 'title') twitterTags.push(`    title: "${value.replace(/"/g, '\\"')}",`);
    else if (prop === 'description') twitterTags.push(`    description: "${value.replace(/"/g, '\\"')}",`);
    else if (prop === 'image') twitterTags.push(`    images: ["${value}"],`);
    else if (prop === 'site') twitterTags.push(`    site: "${value}",`);
    else if (prop === 'creator') twitterTags.push(`    creator: "${value}",`);
  }
  
  if (twitterTags.length > 0) {
    fields.push(`  twitter: {\n${twitterTags.join('\n')}\n  },`);
  }
  
  // Extract author
  const authorMatch = htmlCode.match(/<meta\s+name=["']author["']\s+content=["']([^"']+)["']/i);
  if (authorMatch) {
    fields.push(`  authors: [{ name: "${authorMatch[1].replace(/"/g, '\\"')}" }],`);
  }
  
  // Extract keywords
  const keywordsMatch = htmlCode.match(/<meta\s+name=["']keywords["']\s+content=["']([^"']+)["']/i);
  if (keywordsMatch) {
    const keywords = keywordsMatch[1].split(',').map(k => `"${k.trim()}"`).join(', ');
    fields.push(`  keywords: [${keywords}],`);
  }
  
  // Add alternates with canonical if found
  if (canonicalMatch) {
    fields.push(`  alternates: {\n    canonical: "${canonicalMatch[1]}",\n  },`);
  }
  
  const metadataCode = fields.length > 0 ? `{\n${fields.join('\n')}\n}` : '';
  return { metadataCode, fields };
}

/**
 * Merge new metadata fields into existing metadata export
 */
function mergeNextJsMetadata(existingContent: string, newMetadataFields: string[]): string {
  // Find the existing metadata export
  const metadataMatch = existingContent.match(/export\s+const\s+metadata:\s*Metadata\s*=\s*\{/);
  
  if (!metadataMatch) {
    // No existing metadata, we'll add it
    return existingContent;
  }
  
  // Find where the metadata object starts
  const metadataStart = existingContent.indexOf(metadataMatch[0]);
  const openBraceIndex = existingContent.indexOf('{', metadataStart);
  
  // Find the matching closing brace
  let braceCount = 1;
  let i = openBraceIndex + 1;
  while (braceCount > 0 && i < existingContent.length) {
    if (existingContent[i] === '{') braceCount++;
    if (existingContent[i] === '}') braceCount--;
    i++;
  }
  const metadataEnd = i;
  
  // Get the existing metadata content
  const existingMetadata = existingContent.slice(openBraceIndex, metadataEnd);
  
  // Filter out fields that already exist
  const fieldsToAdd: string[] = [];
  for (const field of newMetadataFields) {
    const fieldName = field.match(/^\s*(\w+):/)?.[1];
    if (fieldName && !existingMetadata.includes(`${fieldName}:`)) {
      fieldsToAdd.push(field);
    }
  }
  
  if (fieldsToAdd.length === 0) {
    console.log('[GitHub] All metadata fields already exist, skipping insertion');
    return existingContent;
  }
  
  // Insert the new fields after the opening brace
  const insertPoint = openBraceIndex + 1;
  const newFieldsStr = `\n  // Mudra GEO: Enhanced Metadata\n${fieldsToAdd.join('\n')}\n`;
  
  return existingContent.slice(0, insertPoint) + newFieldsStr + existingContent.slice(insertPoint);
}

/**
 * Intelligently insert generated code into existing file
 * Uses framework-specific injection patterns
 */
function insertCodeIntoFile(existingContent: string, newCode: string, filePath: string): string {
  const contentType = detectContentType(newCode);
  const framework = detectFramework(filePath, existingContent);
  
  console.log(`[GitHub] Inserting ${contentType} into ${framework} file: ${filePath}`);
  
  // Check for existing optimizations
  if (hasExistingOptimization(existingContent, newCode, contentType)) {
    console.log('[GitHub] Similar optimization already exists, updating instead of adding');
    // For now, still add - but we could implement update logic here
  }
  
  // Clean up the code - remove instruction comments
  let cleanCode = newCode
    .replace(/<!--\s*Add this to.*?-->\n?/gi, '')
    .replace(/<!--\s*Example of.*?-->\n?/gi, '')
    .replace(/<!--\s*Instructions:.*?-->\n?/gi, '')
    .trim();
  
  // ==================================
  // HTML FILES
  // ==================================
  if (framework === 'html') {
    switch (contentType) {
      case 'json-ld': {
        // Extract or wrap in script tag
        let scriptTag = cleanCode;
        if (!cleanCode.includes('<script')) {
          const jsonMatch = cleanCode.match(/\{[\s\S]*"@context"[\s\S]*\}/);
          if (jsonMatch) {
            scriptTag = `<script type="application/ld+json">\n${jsonMatch[0]}\n</script>`;
          }
        }
        // Insert before </head>
        if (existingContent.includes('</head>')) {
          return existingContent.replace('</head>', `  <!-- Mudra GEO: Structured Data -->\n  ${scriptTag}\n</head>`);
        }
        break;
      }
      
      case 'meta-tags': {
        // Insert in <head> section
        if (existingContent.includes('</head>')) {
          return existingContent.replace('</head>', `  <!-- Mudra GEO: Meta Tags -->\n  ${cleanCode}\n</head>`);
        }
        break;
      }
      
      case 'nav-links':
      case 'faq-section':
      case 'generic-html': {
        // Insert before </body> - these are visible content
        if (existingContent.includes('</body>')) {
          return existingContent.replace('</body>', `\n<!-- Mudra GEO: Content Enhancement -->\n${cleanCode}\n</body>`);
        }
        // Or before </main> if it exists
        if (existingContent.includes('</main>')) {
          return existingContent.replace('</main>', `\n<!-- Mudra GEO: Content Enhancement -->\n${cleanCode}\n</main>`);
        }
        break;
      }
    }
    
    // HTML fallback: append before </body> or at end
    if (existingContent.includes('</body>')) {
      return existingContent.replace('</body>', `\n<!-- Mudra GEO Optimization -->\n${cleanCode}\n</body>`);
    }
    return existingContent + `\n\n<!-- Mudra GEO Optimization -->\n${cleanCode}`;
  }
  
  // ==================================
  // NEXT.JS APP ROUTER (app/layout.tsx)
  // ==================================
  if (framework === 'nextjs-app') {
    const jsxCode = htmlToJsx(cleanCode);
    
    switch (contentType) {
      case 'json-ld': {
        // Extract JSON and create a script with dangerouslySetInnerHTML
        let jsonContent = cleanCode;
        const jsonMatch = cleanCode.match(/\{[\s\S]*"@context"[\s\S]*\}/);
        if (jsonMatch) {
          jsonContent = jsonMatch[0];
        }
        
        const schemaScript = `
        {/* Mudra GEO: Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: \`${jsonContent.replace(/`/g, '\\`')}\` }}
        />`;
        
        // Try to insert before </head> if using Head component
        if (existingContent.includes('</Head>')) {
          return existingContent.replace('</Head>', `${schemaScript}\n      </Head>`);
        }
        
        // Insert before </body> in the layout
        if (existingContent.includes('</body>')) {
          return existingContent.replace('</body>', `${schemaScript}\n      </body>`);
        }
        
        // Insert before {children} as a sibling
        if (existingContent.includes('{children}')) {
          return existingContent.replace('{children}', `${schemaScript}\n        {children}`);
        }
        
        // Insert before </html>
        if (existingContent.includes('</html>')) {
          return existingContent.replace('</html>', `${schemaScript}\n      </html>`);
        }
        
        // Last resort: find return statement and insert
        const returnMatch = existingContent.match(/return\s*\(\s*<(\w+)[^>]*>/);
        if (returnMatch) {
          return existingContent.replace(returnMatch[0], `${returnMatch[0]}\n        ${schemaScript}`);
        }
        
        // Fall through to ultimate fallback
        break;
      }
      
      case 'meta-tags': {
        // For Next.js App Router, convert HTML meta tags to Next.js metadata format
        const { metadataCode, fields } = parseMetaTagsToNextJsMetadata(cleanCode);
        
        if (fields.length > 0 && existingContent.includes('export const metadata')) {
          // Merge new fields into existing metadata export
          console.log(`[GitHub] Merging ${fields.length} metadata fields into existing export`);
          return mergeNextJsMetadata(existingContent, fields);
        }
        
        // If no existing metadata export, create one
        if (fields.length > 0) {
          // Add the Metadata import if not present
          let content = existingContent;
          if (!content.includes("import type { Metadata }") && !content.includes("import { Metadata }")) {
            // Try to add after existing next imports, or at the top
            if (content.match(/^import .* from ['"]next/m)) {
              content = content.replace(
                /^(import .* from ['"]next[^'"\n]*['"];?\n)/m,
                "$1import type { Metadata } from 'next';\n"
              );
            } else {
              content = "import type { Metadata } from 'next';\n" + content;
            }
          }
          
          // Add the metadata export
          const metadataExport = `\n// Mudra GEO: Enhanced Metadata\nexport const metadata: Metadata = ${metadataCode};\n`;
          
          // Insert before export default, or before the first function/component
          if (content.includes('export default')) {
            return content.replace('export default', `${metadataExport}\nexport default`);
          }
          
          // Insert at end of imports section
          const lastImportMatch = content.match(/^import .+$/gm);
          if (lastImportMatch) {
            const lastImport = lastImportMatch[lastImportMatch.length - 1];
            const insertPoint = content.lastIndexOf(lastImport) + lastImport.length;
            return content.slice(0, insertPoint) + '\n' + metadataExport + content.slice(insertPoint);
          }
          
          // Fallback: add at top after any existing content
          return metadataExport + content;
        }
        
        // If we couldn't parse meta tags, fall through to generic handling
        break;
      }
      
      case 'nav-links':
      case 'faq-section':
      case 'generic-html': {
        // Convert to JSX and insert in the layout
        // Don't wrap in extra div - insert the content directly
        const component = `
        {/* Mudra GEO: Content Enhancement */}
        ${jsxCode}`;
        
        // For navigation, insert before main content
        if (existingContent.includes('{children}')) {
          return existingContent.replace('{children}', `${component}\n        {children}`);
        }
        
        // Or insert before </body>
        if (existingContent.includes('</body>')) {
          return existingContent.replace('</body>', `${component}\n      </body>`);
        }
        
        // Or insert before </html>
        if (existingContent.includes('</html>')) {
          return existingContent.replace('</html>', `${component}\n      </html>`);
        }
        
        // Insert in return statement
        const returnMatch = existingContent.match(/return\s*\(\s*<(\w+)[^>]*>/);
        if (returnMatch) {
          return existingContent.replace(returnMatch[0], `${returnMatch[0]}\n        ${component}`);
        }
        
        // Fall through to ultimate fallback
        break;
      }
    }
  }
  
  // ==================================
  // NEXT.JS PAGES ROUTER
  // ==================================
  if (framework === 'nextjs-pages') {
    const jsxCode = htmlToJsx(cleanCode);
    
    if (contentType === 'json-ld') {
      let jsonContent = cleanCode;
      const jsonMatch = cleanCode.match(/\{[\s\S]*"@context"[\s\S]*\}/);
      if (jsonMatch) {
        jsonContent = jsonMatch[0];
      }
      
      // Check if Script is imported
      let content = existingContent;
      if (!content.includes("from 'next/script'")) {
        content = content.replace(
          /^(import .* from ['"]next)/m,
          "import Script from 'next/script';\n$1"
        );
      }
      
      const scriptComponent = `
        {/* Mudra GEO: Structured Data */}
        <Script
          id="mudra-schema"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: \`${jsonContent.replace(/`/g, '\\`')}\` }}
        />`;
      
      // Insert before </body>
      if (content.includes('</body>')) {
        return content.replace('</body>', `${scriptComponent}\n      </body>`);
      }
      
      // Insert before </html>
      if (content.includes('</html>')) {
        return content.replace('</html>', `${scriptComponent}\n      </html>`);
      }
      
      // Insert in return statement
      const returnMatch = content.match(/return\s*\(\s*<(\w+)[^>]*>/);
      if (returnMatch) {
        return content.replace(returnMatch[0], `${returnMatch[0]}\n        ${scriptComponent}`);
      }
    }
    
    // For other content types, insert in the component
    const jsxCodePages = htmlToJsx(cleanCode);
    
    if (existingContent.includes('</Head>')) {
      return existingContent.replace('</Head>', `        {/* Mudra GEO */}\n        ${jsxCodePages}\n      </Head>`);
    }
    
    // Insert before </body>
    if (existingContent.includes('</body>')) {
      return existingContent.replace('</body>', `        {/* Mudra GEO */}\n        ${jsxCodePages}\n      </body>`);
    }
    
    // Insert in return statement  
    const pagesReturnMatch = existingContent.match(/return\s*\(\s*<(\w+)[^>]*>/);
    if (pagesReturnMatch) {
      return existingContent.replace(pagesReturnMatch[0], `${pagesReturnMatch[0]}\n        {/* Mudra GEO */}\n        ${jsxCodePages}`);
    }
  }
  
  // ==================================
  // REACT (generic)
  // ==================================
  if (framework === 'react') {
    const jsxCode = htmlToJsx(cleanCode);
    
    // Try to insert in the return statement
    const returnMatch = existingContent.match(/return\s*\(\s*/);
    if (returnMatch) {
      const insertPoint = existingContent.indexOf(returnMatch[0]) + returnMatch[0].length;
      const afterReturn = existingContent.slice(insertPoint);
      const firstTag = afterReturn.match(/<\w+[^>]*>/);
      
      if (firstTag) {
        const tagEnd = insertPoint + afterReturn.indexOf(firstTag[0]) + firstTag[0].length;
        return existingContent.slice(0, tagEnd) + 
          `\n      {/* Mudra GEO */}\n      ${jsxCode}\n      ` + 
          existingContent.slice(tagEnd);
      }
    }
    
    // Fallback: insert before closing tag
    const lastJsxClose = existingContent.lastIndexOf('</');
    if (lastJsxClose > 0) {
      return existingContent.slice(0, lastJsxClose) +
        `\n      {/* Mudra GEO */}\n      ${jsxCode}\n      ` +
        existingContent.slice(lastJsxClose);
    }
  }
  
  // ==================================
  // ASTRO
  // ==================================
  if (framework === 'astro') {
    // Astro uses HTML-like syntax
    if (contentType === 'json-ld') {
      let scriptTag = cleanCode;
      if (!cleanCode.includes('<script')) {
        const jsonMatch = cleanCode.match(/\{[\s\S]*"@context"[\s\S]*\}/);
        if (jsonMatch) {
          scriptTag = `<script type="application/ld+json">\n${jsonMatch[0]}\n</script>`;
        }
      }
      if (existingContent.includes('</head>')) {
        return existingContent.replace('</head>', `  <!-- Mudra GEO: Structured Data -->\n  ${scriptTag}\n</head>`);
      }
    }
    
    // Insert before </body> for other content
    if (existingContent.includes('</body>')) {
      return existingContent.replace('</body>', `\n<!-- Mudra GEO -->\n${cleanCode}\n</body>`);
    }
  }
  
  // ==================================
  // VUE
  // ==================================
  if (framework === 'vue') {
    // Insert in template section
    if (existingContent.includes('</template>')) {
      return existingContent.replace('</template>', `\n  <!-- Mudra GEO -->\n  ${cleanCode}\n</template>`);
    }
  }
  
  // ==================================
  // ULTIMATE FALLBACK: Actually insert the code directly
  // ==================================
  console.log(`[GitHub] Using fallback insertion for ${framework}/${contentType}`);
  
  // For JSX/TSX files, convert and insert
  if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
    const jsxCode = htmlToJsx(cleanCode);
    
    // Strategy 1: Find the return statement and insert after the opening tag
    const returnMatch = existingContent.match(/return\s*\(\s*<(\w+)/);
    if (returnMatch) {
      const componentTag = returnMatch[1];
      const tagPattern = new RegExp(`return\\s*\\(\\s*<${componentTag}[^>]*>`);
      const match = existingContent.match(tagPattern);
      if (match) {
        return existingContent.replace(
          match[0],
          `${match[0]}\n      {/* Mudra GEO */}\n      ${jsxCode}`
        );
      }
    }
    
    // Strategy 2: Insert before {children}
    if (existingContent.includes('{children}')) {
      return existingContent.replace(
        '{children}',
        `{/* Mudra GEO */}\n        ${jsxCode}\n        {children}`
      );
    }
    
    // Strategy 3: Insert before </body>
    if (existingContent.includes('</body>')) {
      return existingContent.replace(
        '</body>',
        `{/* Mudra GEO */}\n        ${jsxCode}\n      </body>`
      );
    }
    
    // Strategy 4: Insert before closing html tag
    if (existingContent.includes('</html>')) {
      return existingContent.replace(
        '</html>',
        `{/* Mudra GEO */}\n        ${jsxCode}\n      </html>`
      );
    }
    
    // Strategy 5: Insert before export default as an inline component
    if (existingContent.includes('export default')) {
      // Find the default export and wrap the content
      const exportMatch = existingContent.match(/export default function (\w+)/);
      if (exportMatch) {
        const funcName = exportMatch[1];
        // Insert at the start of the function body
        const funcBodyMatch = existingContent.match(new RegExp(`export default function ${funcName}[^{]*\\{`));
        if (funcBodyMatch) {
          const insertPoint = existingContent.indexOf(funcBodyMatch[0]) + funcBodyMatch[0].length;
          return existingContent.slice(0, insertPoint) +
            `\n  // Mudra GEO Content\n  const mudraGeoContent = (\n    <>\n      ${jsxCode}\n    </>\n  );\n` +
            existingContent.slice(insertPoint);
        }
      }
    }
    
    // Strategy 6: Append before final closing brace/tag
    const lastClosingTag = existingContent.lastIndexOf('</');
    if (lastClosingTag > 0) {
      return existingContent.slice(0, lastClosingTag) +
        `{/* Mudra GEO */}\n      ${jsxCode}\n      ` +
        existingContent.slice(lastClosingTag);
    }
  }
  
  // For HTML files, find the best insertion point
  if (filePath.endsWith('.html')) {
    // For JSON-LD and meta content, insert in head
    if (contentType === 'json-ld' || contentType === 'meta-tags') {
      if (existingContent.includes('</head>')) {
        return existingContent.replace('</head>', `  <!-- Mudra GEO -->\n  ${cleanCode}\n</head>`);
      }
    }
    // For visible content, insert before </body>
    if (existingContent.includes('</body>')) {
      return existingContent.replace('</body>', `\n<!-- Mudra GEO -->\n${cleanCode}\n</body>`);
    }
    // Append at end
    return existingContent + `\n\n<!-- Mudra GEO -->\n${cleanCode}`;
  }
  
  // For Astro files
  if (filePath.endsWith('.astro')) {
    if (existingContent.includes('</head>')) {
      return existingContent.replace('</head>', `  <!-- Mudra GEO -->\n  ${cleanCode}\n</head>`);
    }
    if (existingContent.includes('</body>')) {
      return existingContent.replace('</body>', `\n<!-- Mudra GEO -->\n${cleanCode}\n</body>`);
    }
    return existingContent + `\n\n<!-- Mudra GEO -->\n${cleanCode}`;
  }
  
  // For Vue files
  if (filePath.endsWith('.vue')) {
    if (existingContent.includes('</template>')) {
      return existingContent.replace('</template>', `\n  <!-- Mudra GEO -->\n  ${cleanCode}\n</template>`);
    }
    return existingContent + `\n\n<!-- Mudra GEO -->\n${cleanCode}`;
  }
  
  // Absolute fallback - just append the code
  console.log(`[GitHub] Absolute fallback - appending code to end of file`);
  return existingContent + `\n\n/* Mudra GEO */\n${cleanCode}`;
}

interface CreateOptimizationPRInput {
  brandProfileId: number
  pageUrl: string
  improvements: Array<{
    type: string
    description: string
    code: string
    impact: string
    filePath?: string
  }>
  title: string
  description: string
  issueTitle?: string // Used for branch naming - more descriptive than pageUrl
}

interface PRResult {
  prUrl: string
  prNumber: number
}

/**
 * Create a GitHub PR with GEO optimization improvements
 * This properly creates a branch, commits files, then opens a PR
 */
export async function createOptimizationPR(input: CreateOptimizationPRInput): Promise<PRResult> {
  const { brandProfileId, pageUrl, improvements, title, description, issueTitle } = input

  // Get brand profile to access GitHub integration
  const brandProfile = await prisma.brandProfile.findUnique({
    where: { id: brandProfileId },
    include: {
      user: {
        include: {
          githubIntegration: true,
        },
      },
    },
  })

  if (!brandProfile || !brandProfile.user?.githubIntegration) {
    throw new Error('GitHub integration not found. Please connect your GitHub account in Settings → Integrations.')
  }

  const githubIntegration = brandProfile.user.githubIntegration

  // Get valid (decrypted and refreshed if needed) access token
  const accessToken = await getValidGitHubToken(githubIntegration)

  // Get repository information - try multiple sources
  let repoName: string | undefined
  let baseBranch = 'main'

  // 1. Try to get from agent schedule config (if content_optimizer is configured)
  const agentSchedule = await prisma.agentSchedule.findFirst({
    where: {
      brandProfileId,
      isEnabled: true,
    },
    orderBy: { createdAt: 'desc' }
  })

  if (agentSchedule?.config) {
    const config = agentSchedule.config as any
    if (config.githubRepo) {
      repoName = config.githubRepo
      baseBranch = config.githubBranch || 'main'
    }
  }

  // 2. Fall back to first repository from GitHub integration
  if (!repoName && githubIntegration.repositories) {
    const repos = githubIntegration.repositories as string[]
    if (repos.length > 0) {
      repoName = repos[0]
      console.log(`[GitHub] Using first available repo from integration: ${repoName}`)
    }
  }

  if (!repoName) {
    throw new Error('No GitHub repository configured. Please go to Settings → Integrations and ensure a repository is connected.')
  }

  // Parse owner/repo
  const [owner, repo] = repoName.split('/')

  if (!owner || !repo) {
    throw new Error(`Invalid repository format: ${repoName}. Expected format: owner/repo`)
  }

  // Create a new branch name - prefer issue title for better readability
  const slugSource = issueTitle || pageUrl
  const branchSlug = slugSource
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric with dashes
    .replace(/^-|-$/g, '')         // Remove leading/trailing dashes
    .slice(0, 40)                  // Limit length
  const branchName = `mudra/${branchSlug}-${Date.now().toString(36)}`
  console.log(`[GitHub] Branch name: ${branchName} (from: ${issueTitle ? 'issueTitle' : 'pageUrl'})`)

  // Prepare PR body with all improvements
  const prBody = `${description}

## Improvements

${improvements.map((imp, idx) => `
### ${idx + 1}. ${imp.description}
**Impact:** ${imp.impact.toUpperCase()}
**File:** \`${imp.filePath || 'index.html'}\`

\`\`\`html
${imp.code}
\`\`\`
`).join('\n')}

---
*Generated by Mudra Content Optimizer Agent*
`

  try {
    // Step 1: Get the SHA of the base branch
    console.log(`[GitHub] Getting ref for ${owner}/${repo}:${baseBranch}`)
    const refResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${baseBranch}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    )

    if (!refResponse.ok) {
      const error = await refResponse.json()
      throw new Error(`Failed to get base branch: ${error.message || refResponse.statusText}`)
    }

    const refData = await refResponse.json()
    const baseSha = refData.object.sha

    // Step 2: Create a new branch from base
    console.log(`[GitHub] Creating branch ${branchName} from ${baseSha}`)
    const createBranchResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/refs`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({
          ref: `refs/heads/${branchName}`,
          sha: baseSha,
        }),
      }
    )

    if (!createBranchResponse.ok) {
      const error = await createBranchResponse.json()
      throw new Error(`Failed to create branch: ${error.message || createBranchResponse.statusText}`)
    }

    // Step 3: SMART file detection based on repo structure and issue context
    const improvement = improvements[0] // Primary improvement
    const requestedFilePath = improvement.filePath || 'app/page.tsx'
    let targetFilePath = requestedFilePath
    
    // Detect content type to determine appropriate file placement
    const contentType = detectContentType(improvement.code)
    
    // Smarter global detection - only truly site-wide content goes in layout
    const isGlobalContent = contentType === 'json-ld' && 
      (improvement.code.includes('"Organization"') || improvement.code.includes('"WebSite"'))
    
    // Check if it's a standalone file type that should be created new
    const isStandaloneFile = requestedFilePath.includes('public/') || 
      requestedFilePath.endsWith('.txt') ||
      requestedFilePath.endsWith('.xml') ||
      requestedFilePath === 'robots.txt' ||
      requestedFilePath === 'sitemap.xml' ||
      requestedFilePath === 'llms.txt'
    
    console.log(`[GitHub] Content type: ${contentType}, isGlobal: ${isGlobalContent}, isStandalone: ${isStandaloneFile}`)
    console.log(`[GitHub] Requested file path: ${requestedFilePath}`)
    
    // Get repo structure to understand the project layout
    const repoStructure = await getRepoStructure(accessToken, owner, repo, baseBranch)
    console.log(`[GitHub] Repo structure: framework=${repoStructure.framework}, hasAppDir=${repoStructure.hasAppDir}, pages=${repoStructure.pageFiles.length}`)
    
    // Build file search list based on content type, URL, and repo structure
    let searchPaths: string[]
    
    if (isStandaloneFile) {
      // Standalone files - only look for the exact path
      searchPaths = [requestedFilePath]
    } else {
      // Use smart URL-to-file mapping based on repo structure
      const urlBasedPaths = mapUrlToFile(pageUrl, repoStructure, contentType, isGlobalContent)
      
      // Combine: requested path first, then URL-based paths, then fallbacks
      searchPaths = [
        requestedFilePath,
        ...urlBasedPaths,
        // Fallbacks based on detected framework
        ...(repoStructure.framework === 'nextjs-app' 
          ? ['app/page.tsx', 'src/app/page.tsx'] 
          : []),
        ...(repoStructure.framework === 'nextjs-pages' 
          ? ['pages/index.tsx', 'src/pages/index.tsx'] 
          : []),
        'index.html',
        'public/index.html',
      ]
      
      // For global content, add layout files at the beginning (after requested)
      if (isGlobalContent) {
        const layoutPaths = getGlobalFiles(repoStructure)
        // Insert layout paths right after requestedFilePath
        searchPaths = [requestedFilePath, ...layoutPaths, ...searchPaths.slice(1)]
      }
    }
    
    // Remove duplicates while preserving order
    const allPaths = [...new Set(searchPaths)]

    // Try to find an existing file to modify
    let existingFileSha: string | undefined
    let existingFileContent: string | undefined
    
    console.log(`[GitHub] Searching for target file in ${owner}/${repo}...`)
    console.log(`[GitHub] Checking ${allPaths.length} possible paths: ${allPaths.slice(0, 5).join(', ')}...`)
    
    for (const candidatePath of allPaths) {
      try {
        const url = `https://api.github.com/repos/${owner}/${repo}/contents/${candidatePath}?ref=${baseBranch}`
        const fileResponse = await fetch(url, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        })
        
        if (fileResponse.ok) {
          const fileData = await fileResponse.json()
          // Ensure it's a file, not a directory
          if (fileData.type === 'file') {
            existingFileSha = fileData.sha
            existingFileContent = Buffer.from(fileData.content, 'base64').toString('utf-8')
            targetFilePath = candidatePath
            console.log(`[GitHub] ✅ Found existing file to modify: ${targetFilePath}`)
            break
          } else {
            console.log(`[GitHub] ⚠️ ${candidatePath} is a ${fileData.type}, skipping`)
          }
        } else {
          // Log the status for debugging (404 = file not found, which is normal)
          if (fileResponse.status !== 404) {
            console.log(`[GitHub] ⚠️ ${candidatePath}: ${fileResponse.status} ${fileResponse.statusText}`)
          }
        }
      } catch (fetchError) {
        // Network error or parsing issue
        console.log(`[GitHub] ⚠️ Error checking ${candidatePath}:`, fetchError instanceof Error ? fetchError.message : fetchError)
      }
    }

    let fileContent: string
    let commitMessage: string

    if (existingFileContent && existingFileSha) {
      // SMART INSERT: Modify existing file
      fileContent = insertCodeIntoFile(existingFileContent, improvement.code, targetFilePath)
      commitMessage = `Add GEO optimization: ${improvement.description}`
      console.log(`[GitHub] Modifying existing file: ${targetFilePath}`)
    } else {
      // NO EXISTING FILE: Create index.html with the optimization code
      console.log(`[GitHub] ❌ No existing file found in any of the ${allPaths.length} checked paths`)
      console.log(`[GitHub] Creating index.html with optimization content...`)
      
      // Determine the content type to create appropriate file
      const contentType = detectContentType(improvement.code)
      
      // Create a proper HTML file (not a suggestion file)
      targetFilePath = 'index.html'
      
      // Build a minimal but valid HTML document with the optimization
      let optimizationContent = improvement.code
      
      // If it's JSON-LD, wrap it properly
      if (contentType === 'json-ld') {
        const jsonMatch = improvement.code.match(/\{[\s\S]*"@context"[\s\S]*\}/)
        if (jsonMatch && !improvement.code.includes('<script')) {
          optimizationContent = `<script type="application/ld+json">\n${jsonMatch[0]}\n  </script>`
        }
      }
      
      // Determine where to insert based on content type
      let headContent = ''
      let bodyContent = ''
      
      if (contentType === 'json-ld' || contentType === 'meta-tags') {
        headContent = `  <!-- Mudra GEO: ${improvement.description} -->\n  ${optimizationContent}`
      } else {
        bodyContent = `  <!-- Mudra GEO: ${improvement.description} -->\n  ${optimizationContent}`
      }
      
      fileContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${brandProfile.companyName || 'Website'}</title>
${headContent}
</head>
<body>
  <main>
    <h1>Welcome to ${brandProfile.companyName || 'Our Website'}</h1>
    <p>${brandProfile.companyDescription || 'Your content goes here.'}</p>
${bodyContent}
  </main>
</body>
</html>
`
      commitMessage = `Create index.html with GEO optimization: ${improvement.description}`
      console.log(`[GitHub] Created new index.html with ${contentType} content`)
    }

    console.log(`[GitHub] Creating/updating file ${targetFilePath}`)
    const createFileResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${targetFilePath}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({
          message: commitMessage,
          content: Buffer.from(fileContent).toString('base64'),
          branch: branchName,
          ...(existingFileSha ? { sha: existingFileSha } : {}),
        }),
      }
    )

    if (!createFileResponse.ok) {
      const error = await createFileResponse.json()
      throw new Error(`Failed to create file: ${error.message || createFileResponse.statusText}`)
    }

    // Step 4: Create the PR
    console.log(`[GitHub] Creating PR from ${branchName} to ${baseBranch}`)
    const prResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({
        title,
        body: prBody,
        head: branchName,
        base: baseBranch,
      }),
    })

    if (!prResponse.ok) {
      const error = await prResponse.json()
      throw new Error(`GitHub API error: ${error.message || prResponse.statusText}`)
    }

    const pr = await prResponse.json()
    console.log(`[GitHub] PR created successfully: ${pr.html_url}`)

    return {
      prUrl: pr.html_url,
      prNumber: pr.number,
    }
  } catch (error) {
    console.error('[GitHub] Error creating optimization PR:', error)
    if (error instanceof Error) {
      throw error
    }
    throw new Error(`Failed to create PR: ${String(error)}`)
  }
}

/**
 * Get GitHub integration status for a user
 */
export async function getGitHubIntegrationStatus(userId: string) {
  const integration = await prisma.gitHubIntegration.findUnique({
    where: { userId },
  })

  return {
    isConnected: !!integration,
    username: integration?.githubUsername,
    avatarUrl: integration?.avatarUrl,
  }
}

/**
 * Input for creating a blog post PR
 */
interface CreateBlogPostPRInput {
  brandProfileId: number
  title: string
  body: string
  branch: string
  files: Array<{
    path: string
    content: string
  }>
}

/**
 * Create a GitHub PR with blog post files
 * Creates new files in the repository (doesn't modify existing files)
 */
export async function createBlogPostPR(input: CreateBlogPostPRInput): Promise<PRResult> {
  const { brandProfileId, title, body, branch, files } = input

  // Get brand profile to access GitHub integration
  const brandProfile = await prisma.brandProfile.findUnique({
    where: { id: brandProfileId },
    include: {
      user: {
        include: {
          githubIntegration: true,
        },
      },
    },
  })

  if (!brandProfile || !brandProfile.user?.githubIntegration) {
    throw new Error('GitHub integration not found. Please connect your GitHub account in Settings → Integrations.')
  }

  const githubIntegration = brandProfile.user.githubIntegration

  // Get valid access token
  const accessToken = await getValidGitHubToken(githubIntegration)

  // Get repository information
  let repoName: string | undefined
  let baseBranch = 'main'

  // Try to get from agent schedule config
  const agentSchedule = await prisma.agentSchedule.findFirst({
    where: {
      brandProfileId,
      isEnabled: true,
    },
    orderBy: { createdAt: 'desc' }
  })

  if (agentSchedule?.config) {
    const config = agentSchedule.config as Record<string, unknown>
    if (config.githubRepo) {
      repoName = config.githubRepo as string
      baseBranch = (config.githubBranch as string) || 'main'
    }
  }

  // Fall back to first repository from GitHub integration
  if (!repoName && githubIntegration.repositories) {
    const repos = githubIntegration.repositories as string[]
    if (repos.length > 0) {
      repoName = repos[0]
      console.log(`[GitHub] Using first available repo from integration: ${repoName}`)
    }
  }

  if (!repoName) {
    throw new Error('No GitHub repository configured. Please go to Settings → Integrations and ensure a repository is connected.')
  }

  // Parse owner/repo
  const [owner, repo] = repoName.split('/')

  if (!owner || !repo) {
    throw new Error(`Invalid repository format: ${repoName}. Expected format: owner/repo`)
  }

  try {
    // Step 1: Get the SHA of the base branch
    console.log(`[GitHub] Getting ref for ${owner}/${repo}:${baseBranch}`)
    const refResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${baseBranch}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    )

    if (!refResponse.ok) {
      const error = await refResponse.json()
      throw new Error(`Failed to get base branch: ${error.message || refResponse.statusText}`)
    }

    const refData = await refResponse.json()
    const baseSha = refData.object.sha

    // Step 2: Create a new branch from base
    console.log(`[GitHub] Creating branch ${branch} from ${baseSha}`)
    const createBranchResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/refs`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({
          ref: `refs/heads/${branch}`,
          sha: baseSha,
        }),
      }
    )

    if (!createBranchResponse.ok) {
      const error = await createBranchResponse.json()
      throw new Error(`Failed to create branch: ${error.message || createBranchResponse.statusText}`)
    }

    // Step 3: Create each file in the branch
    for (const file of files) {
      console.log(`[GitHub] Creating file ${file.path}`)
      const createFileResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${file.path}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/vnd.github.v3+json',
          },
          body: JSON.stringify({
            message: `Add ${file.path}`,
            content: Buffer.from(file.content).toString('base64'),
            branch: branch,
          }),
        }
      )

      if (!createFileResponse.ok) {
        const error = await createFileResponse.json()
        console.error(`[GitHub] Failed to create file ${file.path}:`, error)
        // Continue with other files even if one fails
      }
    }

    // Step 4: Create the PR
    console.log(`[GitHub] Creating PR from ${branch} to ${baseBranch}`)
    const prResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({
        title,
        body,
        head: branch,
        base: baseBranch,
      }),
    })

    if (!prResponse.ok) {
      const error = await prResponse.json()
      throw new Error(`GitHub API error: ${error.message || prResponse.statusText}`)
    }

    const pr = await prResponse.json()
    console.log(`[GitHub] Blog post PR created successfully: ${pr.html_url}`)

    return {
      prUrl: pr.html_url,
      prNumber: pr.number,
    }
  } catch (error) {
    console.error('[GitHub] Error creating blog post PR:', error)
    if (error instanceof Error) {
      throw error
    }
    throw new Error(`Failed to create blog post PR: ${String(error)}`)
  }
}

/**
 * Save GitHub integration for a user
 */
export async function saveGitHubIntegration(data: {
  userId: string
  accessToken: string
  refreshToken?: string
  githubUserId: string
  githubUsername: string
  avatarUrl?: string
  scope?: string
}) {
  return prisma.gitHubIntegration.upsert({
    where: { userId: data.userId },
    create: {
      userId: data.userId,
      accessToken: data.accessToken, // TODO: Add encryption
      refreshToken: data.refreshToken,
      githubUserId: data.githubUserId,
      githubUsername: data.githubUsername,
      avatarUrl: data.avatarUrl,
      scope: data.scope,
      repositories: [],
    },
    update: {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      githubUsername: data.githubUsername,
      avatarUrl: data.avatarUrl,
      scope: data.scope,
      updatedAt: new Date(),
    },
  })
}
