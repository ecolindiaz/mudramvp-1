/**
 * Framework Detector Service
 * 
 * Detects framework type and determines optimal injection target files
 * for AI referral tracking script installation
 */

export interface FrameworkDetectionResult {
  framework: 'nextjs' | 'react' | 'vue' | 'angular' | 'html' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
  targetFiles: string[]; // Primary file(s) for script injection
  appRouterDetected?: boolean; // Next.js specific
  detectionMethod: string;
  frameworkVersion?: string;
}

interface GitHubFileContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  content?: string;
  encoding?: string;
}

/**
 * Main framework detection function
 * Attempts multiple detection methods and returns best match
 */
export async function detectFramework(
  githubToken: string,
  repoName: string,
  branch: string = 'main'
): Promise<FrameworkDetectionResult> {
  console.log(`[FrameworkDetector] Analyzing repository: ${repoName}`);

  try {
    // Method 1: Analyze package.json (most reliable)
    const packageJsonResult = await detectFromPackageJson(githubToken, repoName, branch);
    if (packageJsonResult.confidence === 'high') {
      console.log(`[FrameworkDetector] ✅ Detected ${packageJsonResult.framework} via package.json`);
      return packageJsonResult;
    }

    // Method 2: Analyze file structure
    const fileStructureResult = await detectFromFileStructure(githubToken, repoName, branch);
    if (fileStructureResult.confidence !== 'low') {
      console.log(`[FrameworkDetector] ✅ Detected ${fileStructureResult.framework} via file structure`);
      return fileStructureResult;
    }

    // Method 3: Check for HTML files (fallback)
    const htmlResult = await detectHtmlFiles(githubToken, repoName, branch);
    console.log(`[FrameworkDetector] ⚠️ Defaulting to HTML detection`);
    return htmlResult;

  } catch (error: any) {
    console.error('[FrameworkDetector] Error:', error.message);
    return {
      framework: 'unknown',
      confidence: 'low',
      targetFiles: [],
      detectionMethod: 'error',
    };
  }
}

/**
 * Method 1: Detect framework from package.json dependencies
 */
async function detectFromPackageJson(
  githubToken: string,
  repoName: string,
  branch: string
): Promise<FrameworkDetectionResult> {
  try {
    const packageJson = await fetchGitHubFile(githubToken, repoName, 'package.json', branch);
    if (!packageJson) {
      return { framework: 'unknown', confidence: 'low', targetFiles: [], detectionMethod: 'no_package_json' };
    }

    const pkg = JSON.parse(packageJson);
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    // Check Next.js
    if (deps.next) {
      const version = deps.next.replace(/[\^~]/, '');
      const appRouterDetected = await checkNextJsAppRouter(githubToken, repoName, branch);
      
      return {
        framework: 'nextjs',
        confidence: 'high',
        targetFiles: appRouterDetected 
          ? ['app/layout.tsx', 'app/layout.js']
          : ['pages/_document.tsx', 'pages/_document.js', 'pages/_app.tsx', 'pages/_app.js'],
        appRouterDetected,
        detectionMethod: 'package_json',
        frameworkVersion: version
      };
    }

    // Check React (CRA or Vite)
    if (deps.react || deps['react-dom']) {
      const isVite = deps.vite !== undefined;
      return {
        framework: 'react',
        confidence: 'high',
        targetFiles: isVite ? ['index.html'] : ['public/index.html'],
        detectionMethod: 'package_json',
        frameworkVersion: deps.react?.replace(/[\^~]/, '')
      };
    }

    // Check Vue
    if (deps.vue) {
      return {
        framework: 'vue',
        confidence: 'high',
        targetFiles: ['public/index.html', 'index.html'],
        detectionMethod: 'package_json',
        frameworkVersion: deps.vue.replace(/[\^~]/, '')
      };
    }

    // Check Angular
    if (deps['@angular/core']) {
      return {
        framework: 'angular',
        confidence: 'high',
        targetFiles: ['src/index.html'],
        detectionMethod: 'package_json',
        frameworkVersion: deps['@angular/core'].replace(/[\^~]/, '')
      };
    }

    return { framework: 'unknown', confidence: 'low', targetFiles: [], detectionMethod: 'no_framework_deps' };

  } catch (error: any) {
    console.error('[FrameworkDetector] package.json parse error:', error.message);
    return { framework: 'unknown', confidence: 'low', targetFiles: [], detectionMethod: 'package_json_error' };
  }
}

/**
 * Method 2: Detect framework from file structure
 */
async function detectFromFileStructure(
  githubToken: string,
  repoName: string,
  branch: string
): Promise<FrameworkDetectionResult> {
  try {
    const rootFiles = await listGitHubDirectory(githubToken, repoName, '', branch);
    const fileNames = rootFiles.map(f => f.name);

    // Next.js indicators
    if (fileNames.includes('next.config.js') || fileNames.includes('next.config.ts')) {
      const appRouterDetected = await checkNextJsAppRouter(githubToken, repoName, branch);
      
      return {
        framework: 'nextjs',
        confidence: 'high',
        targetFiles: appRouterDetected
          ? ['app/layout.tsx', 'app/layout.js']
          : ['pages/_document.tsx', 'pages/_document.js', 'pages/_app.tsx', 'pages/_app.js'],
        appRouterDetected,
        detectionMethod: 'file_structure'
      };
    }

    // Vite React indicators
    if (fileNames.includes('vite.config.ts') || fileNames.includes('vite.config.js')) {
      return {
        framework: 'react',
        confidence: 'medium',
        targetFiles: ['index.html'],
        detectionMethod: 'file_structure'
      };
    }

    // CRA indicators
    if (fileNames.includes('public') && rootFiles.some(f => f.name === 'src')) {
      return {
        framework: 'react',
        confidence: 'medium',
        targetFiles: ['public/index.html'],
        detectionMethod: 'file_structure'
      };
    }

    // Vue CLI indicators
    if (fileNames.includes('vue.config.js')) {
      return {
        framework: 'vue',
        confidence: 'high',
        targetFiles: ['public/index.html'],
        detectionMethod: 'file_structure'
      };
    }

    // Angular indicators
    if (fileNames.includes('angular.json')) {
      return {
        framework: 'angular',
        confidence: 'high',
        targetFiles: ['src/index.html'],
        detectionMethod: 'file_structure'
      };
    }

    return { framework: 'unknown', confidence: 'low', targetFiles: [], detectionMethod: 'no_framework_indicators' };

  } catch (error: any) {
    console.error('[FrameworkDetector] file structure error:', error.message);
    return { framework: 'unknown', confidence: 'low', targetFiles: [], detectionMethod: 'file_structure_error' };
  }
}

/**
 * Method 3: Detect HTML files (fallback for static sites)
 */
async function detectHtmlFiles(
  githubToken: string,
  repoName: string,
  branch: string
): Promise<FrameworkDetectionResult> {
  try {
    const rootFiles = await listGitHubDirectory(githubToken, repoName, '', branch);
    const htmlFiles = rootFiles
      .filter(f => f.name.endsWith('.html'))
      .map(f => f.name);

    if (htmlFiles.length > 0) {
      // Prioritize index.html
      const targetFiles = htmlFiles.includes('index.html')
        ? ['index.html', ...htmlFiles.filter(f => f !== 'index.html')]
        : htmlFiles;

      return {
        framework: 'html',
        confidence: 'medium',
        targetFiles,
        detectionMethod: 'html_files'
      };
    }

    return {
      framework: 'unknown',
      confidence: 'low',
      targetFiles: [],
      detectionMethod: 'no_html_files'
    };

  } catch (error: any) {
    console.error('[FrameworkDetector] HTML detection error:', error.message);
    return { framework: 'unknown', confidence: 'low', targetFiles: [], detectionMethod: 'html_detection_error' };
  }
}

/**
 * Check if Next.js project uses App Router (app/) or Pages Router (pages/)
 */
async function checkNextJsAppRouter(
  githubToken: string,
  repoName: string,
  branch: string
): Promise<boolean> {
  try {
    const rootFiles = await listGitHubDirectory(githubToken, repoName, '', branch);
    const hasAppDir = rootFiles.some(f => f.name === 'app' && f.type === 'dir');
    
    if (hasAppDir) {
      // Check if app/layout.tsx or app/layout.js exists
      const appFiles = await listGitHubDirectory(githubToken, repoName, 'app', branch);
      return appFiles.some(f => f.name === 'layout.tsx' || f.name === 'layout.js');
    }
    
    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Fetch file content from GitHub
 */
async function fetchGitHubFile(
  githubToken: string,
  repoName: string,
  filePath: string,
  branch: string
): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${repoName}/contents/${filePath}?ref=${branch}`,
      {
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data: GitHubFileContent = await response.json();
    
    if (data.content && data.encoding === 'base64') {
      return Buffer.from(data.content, 'base64').toString('utf-8');
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * List directory contents from GitHub
 */
async function listGitHubDirectory(
  githubToken: string,
  repoName: string,
  path: string,
  branch: string
): Promise<Array<{ name: string; type: 'file' | 'dir' }>> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${repoName}/contents/${path}?ref=${branch}`,
      {
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    
    if (Array.isArray(data)) {
      return data.map((item: any) => ({
        name: item.name,
        type: item.type === 'dir' ? 'dir' : 'file'
      }));
    }

    return [];
  } catch (error) {
    return [];
  }
}

/**
 * Find first existing target file from list
 */
export async function findExistingTargetFile(
  githubToken: string,
  repoName: string,
  targetFiles: string[],
  branch: string = 'main'
): Promise<string | null> {
  for (const filePath of targetFiles) {
    const content = await fetchGitHubFile(githubToken, repoName, filePath, branch);
    if (content !== null) {
      console.log(`[FrameworkDetector] Found existing file: ${filePath}`);
      return filePath;
    }
  }
  
  console.log(`[FrameworkDetector] No target files found from: ${targetFiles.join(', ')}`);
  return null;
}
