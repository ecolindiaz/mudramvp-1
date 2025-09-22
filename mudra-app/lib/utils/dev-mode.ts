/**
 * Development mode utilities
 */

export const isDevelopment = () => {
  return process.env.NODE_ENV === 'development'
}

export const isDevelopmentClient = () => {
  if (typeof window === 'undefined') return false
  return window.location.hostname === 'localhost' || 
         window.location.hostname === '127.0.0.1' ||
         window.location.hostname.includes('localhost')
}

export const isProductionReady = () => {
  return process.env.NODE_ENV === 'production' && !isDevelopmentClient()
}

/**
 * Check if analysis restrictions should be enforced
 * In development, we allow unlimited analysis
 * In production, we enforce timer restrictions
 */
export const shouldEnforceAnalysisRestrictions = () => {
  return isProductionReady()
}

/**
 * Get the development mode status for the client
 */
export const getDevModeStatus = () => {
  return {
    isDev: isDevelopment() || isDevelopmentClient(),
    isProduction: isProductionReady(),
    shouldEnforceRestrictions: shouldEnforceAnalysisRestrictions(),
  }
}
