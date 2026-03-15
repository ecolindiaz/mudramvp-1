/**
 * Structured Logger Utility
 *
 * Lightweight logger for Next.js on Vercel:
 * - Production: JSON output compatible with Vercel log drains
 * - Development: Human-readable output
 * - Sanitizes errors to prevent stack trace / path leaks in production
 *
 * Usage:
 *   import { createLogger } from '@/lib/logger'
 *   const log = createLogger('IssuesAPI')
 *   log.info('Fetching issues', { brandProfileId: 123 })
 *   log.error('Failed to fetch', { error: err })
 */

type LogLevel = 'error' | 'warn' | 'info' | 'debug'

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
}

function getMinLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase()
  if (envLevel && envLevel in LOG_LEVEL_PRIORITY) {
    return envLevel as LogLevel
  }
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug'
}

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

/**
 * Sanitize an error for safe logging.
 * In production: only message (no stack, no internal paths).
 * In development: include full error details for debugging.
 */
function sanitizeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    if (isProduction()) {
      return { message: error.message }
    }
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    }
  }
  if (typeof error === 'string') {
    return { message: error }
  }
  return { message: String(error) }
}

/**
 * Sanitize context values, processing any `error` or `err` key specially.
 */
function sanitizeContext(
  context?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!context) return undefined
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(context)) {
    if (key === 'error' || key === 'err') {
      result[key] = sanitizeError(value)
    } else {
      result[key] = value
    }
  }
  return result
}

interface Logger {
  error(message: string, context?: Record<string, unknown>): void
  warn(message: string, context?: Record<string, unknown>): void
  info(message: string, context?: Record<string, unknown>): void
  debug(message: string, context?: Record<string, unknown>): void
}

export function createLogger(module: string): Logger {
  function shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] <= LOG_LEVEL_PRIORITY[getMinLevel()]
  }

  function log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>
  ): void {
    if (!shouldLog(level)) return

    const sanitized = sanitizeContext(context)

    if (isProduction()) {
      const entry = {
        level,
        module,
        message,
        timestamp: new Date().toISOString(),
        ...sanitized,
      }
      const consoleFn =
        level === 'error'
          ? console.error
          : level === 'warn'
            ? console.warn
            : console.log
      consoleFn(JSON.stringify(entry))
    } else {
      const prefix = `[${module}]`
      const consoleFn =
        level === 'error'
          ? console.error
          : level === 'warn'
            ? console.warn
            : level === 'debug'
              ? console.debug
              : console.log
      if (sanitized && Object.keys(sanitized).length > 0) {
        consoleFn(prefix, `${level}:`, message, sanitized)
      } else {
        consoleFn(prefix, `${level}:`, message)
      }
    }
  }

  return {
    error: (message, context) => log('error', message, context),
    warn: (message, context) => log('warn', message, context),
    info: (message, context) => log('info', message, context),
    debug: (message, context) => log('debug', message, context),
  }
}
