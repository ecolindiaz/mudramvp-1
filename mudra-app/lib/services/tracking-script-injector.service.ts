/**
 * Tracking Script Injector Service
 * 
 * Injects AI referral tracking scripts into codebases based on framework type
 * Handles Next.js (App/Pages Router), React (CRA/Vite), Vue, Angular, and static HTML
 */

import { FrameworkDetectionResult } from './framework-detector.service';

export interface InjectionResult {
  success: boolean;
  modifiedContent: string;
  injectionPoint: string;
  error?: string;
}

/**
 * Main injection function - routes to framework-specific injector
 */
export function injectTrackingScript(
  fileContent: string,
  framework: FrameworkDetectionResult['framework'],
  targetFile: string,
  siteId: string,
  appRouterDetected?: boolean
): InjectionResult {
  const scriptUrl = process.env.NEXT_PUBLIC_TRACKER_URL || 'https://app.mudra.ai/tracker.js';

  try {
    switch (framework) {
      case 'nextjs':
        return injectNextJS(fileContent, targetFile, siteId, scriptUrl, appRouterDetected);
      case 'react':
        return injectReact(fileContent, siteId, scriptUrl);
      case 'vue':
        return injectVue(fileContent, siteId, scriptUrl);
      case 'angular':
        return injectAngular(fileContent, siteId, scriptUrl);
      case 'html':
        return injectHTML(fileContent, siteId, scriptUrl);
      default:
        return {
          success: false,
          modifiedContent: fileContent,
          injectionPoint: 'none',
          error: `Unsupported framework: ${framework}`
        };
    }
  } catch (error: any) {
    return {
      success: false,
      modifiedContent: fileContent,
      injectionPoint: 'none',
      error: error.message
    };
  }
}

/**
 * Next.js injection - handles both App Router and Pages Router
 */
function injectNextJS(
  fileContent: string,
  targetFile: string,
  siteId: string,
  scriptUrl: string,
  appRouterDetected?: boolean
): InjectionResult {
  // Check if tracking script already exists
  if (fileContent.includes('mudra-tracking') || fileContent.includes(siteId)) {
    return {
      success: false,
      modifiedContent: fileContent,
      injectionPoint: 'already_exists',
      error: 'Tracking script already installed'
    };
  }

  const trackingScript = `
      {/* Mudra AI Referral Tracking */}
      <script
        id="mudra-tracking"
        dangerouslySetInnerHTML={{
          __html: \`
            (function() {
              var script = document.createElement('script');
              script.src = '${scriptUrl}';
              script.async = true;
              script.setAttribute('data-site-id', '${siteId}');
              document.head.appendChild(script);
            })();
          \`
        }}
      />`;

  // App Router (app/layout.tsx)
  if (appRouterDetected || targetFile.includes('app/layout')) {
    // Try to inject inside <head> tag
    if (fileContent.includes('<head>')) {
      const modified = fileContent.replace(
        /(<head>)/,
        `$1${trackingScript}`
      );
      
      return {
        success: true,
        modifiedContent: modified,
        injectionPoint: 'head_tag_start'
      };
    }
    
    // Fallback: inject before </head>
    if (fileContent.includes('</head>')) {
      const modified = fileContent.replace(
        /(<\/head>)/,
        `${trackingScript}\n      $1`
      );
      
      return {
        success: true,
        modifiedContent: modified,
        injectionPoint: 'head_tag_end'
      };
    }
  }

  // Pages Router - _document.tsx
  if (targetFile.includes('_document')) {
    // Inject inside <Head> component from next/document
    if (fileContent.includes('<Head>')) {
      const modified = fileContent.replace(
        /(<Head>)/,
        `$1${trackingScript}`
      );
      
      // Ensure next/document import exists
      if (!modified.includes("from 'next/document'") && !modified.includes('from "next/document"')) {
        return {
          success: false,
          modifiedContent: fileContent,
          injectionPoint: 'none',
          error: '_document.tsx is missing next/document imports'
        };
      }
      
      return {
        success: true,
        modifiedContent: modified,
        injectionPoint: 'next_document_head'
      };
    }
  }

  // Pages Router - _app.tsx (fallback)
  if (targetFile.includes('_app')) {
    // Use Next.js Script component approach
    const scriptImport = `import Script from 'next/script';`;
    const scriptComponent = `\n      <Script
        id="mudra-tracking"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: \`
            (function() {
              var script = document.createElement('script');
              script.src = '${scriptUrl}';
              script.async = true;
              script.setAttribute('data-site-id', '${siteId}');
              document.head.appendChild(script);
            })();
          \`
        }}
      />`;

    let modified = fileContent;

    // Add import if not exists
    if (!fileContent.includes("from 'next/script'") && !fileContent.includes('from "next/script"')) {
      const importRegex = /(import .* from ['"]react['"];?)/;
      modified = modified.replace(importRegex, `$1\n${scriptImport}`);
    }

    // Inject Script component after return statement
    if (modified.includes('return (')) {
      modified = modified.replace(
        /(return \(\s*(?:<>|<Fragment>)?)/,
        `$1${scriptComponent}`
      );
      
      return {
        success: true,
        modifiedContent: modified,
        injectionPoint: 'next_app_return'
      };
    }
  }

  return {
    success: false,
    modifiedContent: fileContent,
    injectionPoint: 'none',
    error: 'Could not find suitable injection point in Next.js file'
  };
}

/**
 * React (CRA/Vite) injection - injects into public/index.html or index.html
 */
function injectReact(
  fileContent: string,
  siteId: string,
  scriptUrl: string
): InjectionResult {
  // Check if tracking script already exists
  if (fileContent.includes('mudra-tracking') || fileContent.includes(siteId)) {
    return {
      success: false,
      modifiedContent: fileContent,
      injectionPoint: 'already_exists',
      error: 'Tracking script already installed'
    };
  }

  const trackingScript = `    <!-- Mudra AI Referral Tracking -->
    <script>
      (function() {
        var script = document.createElement('script');
        script.src = '${scriptUrl}';
        script.async = true;
        script.setAttribute('data-site-id', '${siteId}');
        document.head.appendChild(script);
      })();
    </script>`;

  // Inject before </head>
  if (fileContent.includes('</head>')) {
    const modified = fileContent.replace(
      /(\s*<\/head>)/,
      `\n${trackingScript}\n$1`
    );
    
    return {
      success: true,
      modifiedContent: modified,
      injectionPoint: 'html_head_end'
    };
  }

  return {
    success: false,
    modifiedContent: fileContent,
    injectionPoint: 'none',
    error: 'Could not find </head> tag in HTML file'
  };
}

/**
 * Vue injection - same as React (uses public/index.html)
 */
function injectVue(
  fileContent: string,
  siteId: string,
  scriptUrl: string
): InjectionResult {
  return injectReact(fileContent, siteId, scriptUrl);
}

/**
 * Angular injection - injects into src/index.html
 */
function injectAngular(
  fileContent: string,
  siteId: string,
  scriptUrl: string
): InjectionResult {
  return injectReact(fileContent, siteId, scriptUrl);
}

/**
 * Static HTML injection
 */
function injectHTML(
  fileContent: string,
  siteId: string,
  scriptUrl: string
): InjectionResult {
  return injectReact(fileContent, siteId, scriptUrl);
}

/**
 * Validate that injection was successful by checking for tracking script presence
 */
export function validateInjection(content: string, siteId: string): boolean {
  return content.includes(siteId) && 
         (content.includes('mudra-tracking') || content.includes('Mudra AI Referral Tracking'));
}

/**
 * Remove tracking script from content (for rollback/uninstall)
 */
export function removeTrackingScript(
  fileContent: string,
  framework: FrameworkDetectionResult['framework']
): InjectionResult {
  try {
    // Match various tracking script patterns
    const patterns = [
      // HTML comment + script block
      /\s*<!-- Mudra AI Referral Tracking -->[\s\S]*?<\/script>/g,
      // React/Next.js dangerouslySetInnerHTML
      /\s*{\/\* Mudra AI Referral Tracking \*\/}[\s\S]*?\/>/g,
      // Next.js Script component
      /\s*<Script[\s\S]*?id="mudra-tracking"[\s\S]*?\/>/g,
    ];

    let modified = fileContent;
    let removed = false;

    for (const pattern of patterns) {
      if (pattern.test(modified)) {
        modified = modified.replace(pattern, '');
        removed = true;
      }
    }

    return {
      success: removed,
      modifiedContent: modified,
      injectionPoint: removed ? 'removed' : 'not_found',
      error: removed ? undefined : 'Tracking script not found in file'
    };
  } catch (error: any) {
    return {
      success: false,
      modifiedContent: fileContent,
      injectionPoint: 'none',
      error: error.message
    };
  }
}
