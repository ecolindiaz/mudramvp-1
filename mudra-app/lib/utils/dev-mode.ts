/**
 * Development mode utilities
 */

export const isDevelopment = () => {
  return process.env.NODE_ENV === 'development' || process.env.DEVELOPMENT_MODE === 'true'
}

export const isDevelopmentClient = () => {
  if (typeof window === 'undefined') return false
  return window.location.hostname === 'localhost' || 
         window.location.hostname === '127.0.0.1' ||
         window.location.hostname.includes('localhost')
}

export const isProductionReady = () => {
  return process.env.NODE_ENV === 'production' && 
         process.env.DEVELOPMENT_MODE !== 'true' && 
         !isDevelopmentClient()
}

/**
 * Check if analysis restrictions should be enforced
 * In development mode (NODE_ENV=development OR DEVELOPMENT_MODE=true), we allow unlimited analysis
 * In production, we enforce timer restrictions
 */
export const shouldEnforceAnalysisRestrictions = () => {
  // If DEVELOPMENT_MODE is explicitly set to true, never enforce restrictions
  if (process.env.DEVELOPMENT_MODE === 'true') {
    return false
  }
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
    devModeEnabled: process.env.DEVELOPMENT_MODE === 'true',
  }
}
