/**
 * Framework-Aware File Path Resolver Tests
 *
 * Tests the framework-aware path resolution logic that maps
 * agent types + affected URLs → correct file paths for different
 * web frameworks (Next.js App/Pages, Astro, Nuxt, HTML).
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest'
import {
  resolveSourceFilePath,
  getFilePathForAgentType,
  getSafeUrlPathFromAffectedUrl,
  detectFrameworkFromContext,
  formatFrameworkName,
} from '../issue-agent-executor.service'

// ─── getSafeUrlPathFromAffectedUrl ───────────────────────────────────────────

describe('getSafeUrlPathFromAffectedUrl', () => {
  it('extracts path from full URL', () => {
    expect(getSafeUrlPathFromAffectedUrl('https://acme.com/pricing')).toBe('pricing')
  })

  it('handles nested paths', () => {
    expect(getSafeUrlPathFromAffectedUrl('https://acme.com/blog/my-post')).toBe('blog/my-post')
  })

  it('returns empty string for homepage', () => {
    expect(getSafeUrlPathFromAffectedUrl('https://acme.com/')).toBe('')
    expect(getSafeUrlPathFromAffectedUrl('https://acme.com')).toBe('')
  })

  it('strips file extensions', () => {
    expect(getSafeUrlPathFromAffectedUrl('https://acme.com/pricing.html')).toBe('pricing')
  })

  it('normalizes path traversal (URL constructor resolves ..)', () => {
    // URL constructor resolves ../../etc/passwd → /etc/passwd
    // which is safe since it becomes a relative path in the repo
    expect(getSafeUrlPathFromAffectedUrl('https://acme.com/../../etc/passwd')).toBe('etc/passwd')
  })

  it('handles relative paths', () => {
    expect(getSafeUrlPathFromAffectedUrl('/about')).toBe('about')
  })

  it('decodes URI components', () => {
    expect(getSafeUrlPathFromAffectedUrl('https://acme.com/my%20page')).toBe('my page')
  })
})

// ─── resolveSourceFilePath ───────────────────────────────────────────────────

describe('resolveSourceFilePath', () => {
  describe('Next.js App Router (default)', () => {
    it('maps homepage to app/page.tsx', () => {
      expect(resolveSourceFilePath('schema_markup', 'https://acme.com/')).toBe('app/page.tsx')
    })

    it('maps /pricing to app/pricing/page.tsx', () => {
      expect(resolveSourceFilePath('schema_markup', 'https://acme.com/pricing')).toBe('app/pricing/page.tsx')
    })

    it('maps /blog/post to app/blog/post/page.tsx', () => {
      expect(resolveSourceFilePath('schema_markup', 'https://acme.com/blog/post')).toBe('app/blog/post/page.tsx')
    })

    it('returns static default for non-page agents', () => {
      expect(resolveSourceFilePath('llms_txt', 'https://acme.com/pricing')).toBe('public/llms.txt')
    })
  })

  describe('Next.js App Router with src/', () => {
    it('maps homepage to src/app/page.tsx', () => {
      expect(resolveSourceFilePath('schema_markup', 'https://acme.com/', 'nextjs-app', true))
        .toBe('src/app/page.tsx')
    })

    it('maps /pricing to src/app/pricing/page.tsx', () => {
      expect(resolveSourceFilePath('schema_markup', 'https://acme.com/pricing', 'nextjs-app', true))
        .toBe('src/app/pricing/page.tsx')
    })
  })

  describe('Next.js Pages Router', () => {
    it('maps homepage to pages/index.tsx', () => {
      expect(resolveSourceFilePath('schema_markup', 'https://acme.com/', 'nextjs-pages'))
        .toBe('pages/index.tsx')
    })

    it('maps /pricing to pages/pricing.tsx', () => {
      expect(resolveSourceFilePath('schema_markup', 'https://acme.com/pricing', 'nextjs-pages'))
        .toBe('pages/pricing.tsx')
    })

    it('maps /blog/post to pages/blog/post.tsx', () => {
      expect(resolveSourceFilePath('schema_markup', 'https://acme.com/blog/post', 'nextjs-pages'))
        .toBe('pages/blog/post.tsx')
    })
  })

  describe('Next.js Pages Router with src/', () => {
    it('maps homepage to src/pages/index.tsx', () => {
      expect(resolveSourceFilePath('schema_markup', 'https://acme.com/', 'nextjs-pages', true))
        .toBe('src/pages/index.tsx')
    })

    it('maps /pricing to src/pages/pricing.tsx', () => {
      expect(resolveSourceFilePath('schema_markup', 'https://acme.com/pricing', 'nextjs-pages', true))
        .toBe('src/pages/pricing.tsx')
    })
  })

  describe('Astro', () => {
    it('maps homepage to src/pages/index.astro', () => {
      expect(resolveSourceFilePath('schema_markup', 'https://acme.com/', 'astro'))
        .toBe('src/pages/index.astro')
    })

    it('maps /pricing to src/pages/pricing.astro', () => {
      expect(resolveSourceFilePath('schema_markup', 'https://acme.com/pricing', 'astro'))
        .toBe('src/pages/pricing.astro')
    })

    it('maps /blog/post to src/pages/blog/post.astro', () => {
      expect(resolveSourceFilePath('schema_markup', 'https://acme.com/blog/post', 'astro'))
        .toBe('src/pages/blog/post.astro')
    })
  })

  describe('Nuxt', () => {
    it('maps homepage to pages/index.vue', () => {
      expect(resolveSourceFilePath('schema_markup', 'https://acme.com/', 'nuxt'))
        .toBe('pages/index.vue')
    })

    it('maps /pricing to pages/pricing.vue', () => {
      expect(resolveSourceFilePath('schema_markup', 'https://acme.com/pricing', 'nuxt'))
        .toBe('pages/pricing.vue')
    })
  })

  describe('Static HTML', () => {
    it('maps homepage to index.html', () => {
      expect(resolveSourceFilePath('schema_markup', 'https://acme.com/', 'html'))
        .toBe('index.html')
    })

    it('maps /pricing to pricing.html', () => {
      expect(resolveSourceFilePath('schema_markup', 'https://acme.com/pricing', 'html'))
        .toBe('pricing.html')
    })
  })

  describe('standalone agent types', () => {
    it('returns public/robots.txt regardless of framework', () => {
      expect(resolveSourceFilePath('robots_txt', null, 'astro')).toBe('public/robots.txt')
      expect(resolveSourceFilePath('robots_txt', null, 'nuxt')).toBe('public/robots.txt')
    })

    it('returns public/llms.txt regardless of framework', () => {
      expect(resolveSourceFilePath('llms_txt', null, 'astro')).toBe('public/llms.txt')
    })
  })

  describe('null/unsafe URL fallback', () => {
    it('falls back to framework default when URL is null', () => {
      expect(resolveSourceFilePath('schema_markup', null, 'astro')).toBe('src/pages/index.astro')
    })

    it('resolves traversal URL via URL normalization', () => {
      // URL constructor normalizes ../../etc → /etc
      expect(resolveSourceFilePath('schema_markup', 'https://acme.com/../../etc', 'astro'))
        .toBe('src/pages/etc.astro')
    })
  })
})

// ─── getFilePathForAgentType ─────────────────────────────────────────────────

describe('getFilePathForAgentType', () => {
  it('returns Next.js App Router defaults without framework', () => {
    expect(getFilePathForAgentType('schema_markup')).toBe('app/page.tsx')
    expect(getFilePathForAgentType('faq_sections')).toBe('app/page.tsx')
    expect(getFilePathForAgentType('blog_setup')).toBe('app/blog/page.tsx')
  })

  it('returns Astro defaults when framework is astro', () => {
    expect(getFilePathForAgentType('schema_markup', 'astro')).toBe('src/pages/index.astro')
    expect(getFilePathForAgentType('blog_setup', 'astro')).toBe('src/pages/blog/index.astro')
    expect(getFilePathForAgentType('blog_post_publish', 'astro')).toBe('src/pages/blog/[slug].astro')
  })

  it('returns Nuxt defaults when framework is nuxt', () => {
    expect(getFilePathForAgentType('schema_markup', 'nuxt')).toBe('pages/index.vue')
    expect(getFilePathForAgentType('blog_setup', 'nuxt')).toBe('pages/blog/index.vue')
  })

  it('returns Next.js Pages Router defaults', () => {
    expect(getFilePathForAgentType('schema_markup', 'nextjs-pages')).toBe('pages/index.tsx')
    expect(getFilePathForAgentType('blog_setup', 'nextjs-pages')).toBe('pages/blog/index.tsx')
    expect(getFilePathForAgentType('blog_post_publish', 'nextjs-pages')).toBe('pages/blog/[slug].tsx')
  })

  it('returns HTML defaults', () => {
    expect(getFilePathForAgentType('schema_markup', 'html')).toBe('index.html')
    expect(getFilePathForAgentType('blog_setup', 'html')).toBe('blog/index.html')
  })

  it('handles src/ directory for Next.js', () => {
    expect(getFilePathForAgentType('schema_markup', 'nextjs-app', true)).toBe('src/app/page.tsx')
    expect(getFilePathForAgentType('schema_markup', 'nextjs-pages', true)).toBe('src/pages/index.tsx')
  })

  it('standalone types are framework-agnostic', () => {
    expect(getFilePathForAgentType('robots_txt', 'astro')).toBe('public/robots.txt')
    expect(getFilePathForAgentType('sitemap', 'nuxt')).toBe('public/sitemap.xml')
    expect(getFilePathForAgentType('llms_txt', 'html')).toBe('public/llms.txt')
  })
})

// ─── formatFrameworkName ─────────────────────────────────────────────────────

describe('formatFrameworkName', () => {
  it('formats all known framework identifiers', () => {
    expect(formatFrameworkName('nextjs-app')).toBe('Next.js App Router (React/JSX)')
    expect(formatFrameworkName('nextjs-pages')).toBe('Next.js Pages Router (React/JSX)')
    expect(formatFrameworkName('astro')).toBe('Astro')
    expect(formatFrameworkName('nuxt')).toBe('Nuxt.js (Vue)')
    expect(formatFrameworkName('react')).toBe('React (JSX)')
    expect(formatFrameworkName('html')).toBe('HTML')
  })

  it('defaults unknown to HTML', () => {
    expect(formatFrameworkName('unknown')).toBe('HTML')
  })
})

// ─── detectFrameworkFromContext ───────────────────────────────────────────────

describe('detectFrameworkFromContext', () => {
  it('detects Astro from file extension', () => {
    expect(detectFrameworkFromContext('src/pages/index.astro', null)).toBe('Astro')
  })

  it('detects Vue from file extension', () => {
    expect(detectFrameworkFromContext('pages/index.vue', null)).toBe('Vue')
  })

  it('detects Next.js from tsx + app/ path', () => {
    expect(detectFrameworkFromContext('app/page.tsx', null)).toBe('Next.js (React/JSX)')
  })

  it('detects Next.js from tsx + next/ import', () => {
    expect(detectFrameworkFromContext('components/Hero.tsx', 'import Head from "next/head"'))
      .toBe('Next.js (React/JSX)')
  })

  it('detects React from tsx without Next.js signals', () => {
    expect(detectFrameworkFromContext('src/App.tsx', 'import React from "react"'))
      .toBe('React (JSX)')
  })

  it('defaults to HTML when no extension match', () => {
    expect(detectFrameworkFromContext('index.html', null)).toBe('HTML')
    expect(detectFrameworkFromContext(null, null)).toBe('HTML')
  })
})
