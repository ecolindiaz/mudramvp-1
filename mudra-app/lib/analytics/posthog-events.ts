import posthog from 'posthog-js'

/**
 * PostHog Event Tracking Utilities
 * 
 * Centralized tracking functions for custom events throughout the app.
 * All events follow a consistent naming convention: <category>_<action>
 * 
 * Usage:
 * ```tsx
 * import { trackEvent } from '@/lib/analytics/posthog-events'
 * 
 * trackEvent.analysisStarted(brandProfileId, 'unified')
 * ```
 */

export const trackEvent = {
  // ==================== Analysis Events ====================
  
  /**
   * Track when user starts any analysis
   */
  analysisStarted: (brandProfileId: number, analysisType: 'geo' | 'technical' | 'unified') => {
    posthog.capture('analysis_started', {
      brand_profile_id: brandProfileId,
      analysis_type: analysisType,
      timestamp: new Date().toISOString(),
    })
  },

  /**
   * Track when analysis completes successfully
   */
  analysisCompleted: (
    brandProfileId: number, 
    analysisType: string, 
    durationMs: number,
    metadata?: Record<string, any>
  ) => {
    posthog.capture('analysis_completed', {
      brand_profile_id: brandProfileId,
      analysis_type: analysisType,
      duration_ms: durationMs,
      duration_seconds: Math.round(durationMs / 1000),
      ...metadata,
    })
  },

  /**
   * Track analysis failures
   */
  analysisFailed: (brandProfileId: number, analysisType: string, error: string) => {
    posthog.capture('analysis_failed', {
      brand_profile_id: brandProfileId,
      analysis_type: analysisType,
      error_message: error,
    })
  },

  /**
   * Track when user views analysis results
   */
  analysisResultsViewed: (brandProfileId: number, analysisType: string) => {
    posthog.capture('analysis_results_viewed', {
      brand_profile_id: brandProfileId,
      analysis_type: analysisType,
    })
  },

  // ==================== Campaign Events ====================
  
  /**
   * Track campaign creation
   */
  campaignCreated: (campaignId: number, campaignType: string, targetPlatform?: string) => {
    posthog.capture('campaign_created', {
      campaign_id: campaignId,
      campaign_type: campaignType,
      target_platform: targetPlatform,
    })
  },

  /**
   * Track content generation via AI
   */
  contentGenerated: (
    campaignId: number, 
    contentType: string, 
    aiModel: string,
    wordCount?: number
  ) => {
    posthog.capture('content_generated', {
      campaign_id: campaignId,
      content_type: contentType,
      ai_model: aiModel,
      word_count: wordCount,
    })
  },

  /**
   * Track when content is published
   */
  contentPublished: (campaignId: number, platform: string, contentType: string) => {
    posthog.capture('content_published', {
      campaign_id: campaignId,
      platform: platform,
      content_type: contentType,
    })
  },

  // ==================== Onboarding Events ====================
  
  /**
   * Track onboarding step completion
   */
  onboardingStepCompleted: (step: number, stepName: string) => {
    posthog.capture('onboarding_step_completed', {
      step_number: step,
      step_name: stepName,
    })
  },

  /**
   * Track onboarding completion
   */
  onboardingCompleted: (totalSteps: number, durationMs: number) => {
    posthog.capture('onboarding_completed', {
      total_steps: totalSteps,
      duration_ms: durationMs,
    })
  },

  /**
   * Track onboarding abandonment
   */
  onboardingAbandoned: (lastStep: number, stepName: string) => {
    posthog.capture('onboarding_abandoned', {
      last_step: lastStep,
      step_name: stepName,
    })
  },

  // ==================== AI Referral Events ====================
  
  /**
   * Track when AI referral is detected
   */
  aiReferralDetected: (
    brandProfileId: number, 
    source: string, 
    query?: string
  ) => {
    posthog.capture('ai_referral_detected', {
      brand_profile_id: brandProfileId,
      referral_source: source,
      search_query: query,
    })
  },

  /**
   * Track AI citation found
   */
  aiCitationFound: (
    brandProfileId: number, 
    platform: string,
    citationType: string
  ) => {
    posthog.capture('ai_citation_found', {
      brand_profile_id: brandProfileId,
      platform: platform,
      citation_type: citationType,
    })
  },

  // ==================== Integration Events ====================
  
  /**
   * Track GitHub integration connection
   */
  githubIntegrationConnected: (brandProfileId: number, repoCount?: number) => {
    posthog.capture('github_integration_connected', {
      brand_profile_id: brandProfileId,
      repo_count: repoCount,
    })
  },

  /**
   * Track GitHub integration disconnection
   */
  githubIntegrationDisconnected: (brandProfileId: number) => {
    posthog.capture('github_integration_disconnected', {
      brand_profile_id: brandProfileId,
    })
  },

  /**
   * Track tracking script installation
   */
  trackingScriptInstalled: (brandProfileId: number, websiteUrl: string) => {
    posthog.capture('tracking_script_installed', {
      brand_profile_id: brandProfileId,
      website_url: websiteUrl,
    })
  },

  // ==================== Agent Lab Events ====================
  
  /**
   * Track when agent is created/deployed
   */
  agentDeployed: (agentId: number, agentType: string, brandProfileId: number) => {
    posthog.capture('agent_deployed', {
      agent_id: agentId,
      agent_type: agentType,
      brand_profile_id: brandProfileId,
    })
  },

  /**
   * Track agent execution
   */
  agentExecuted: (
    agentId: number, 
    agentType: string, 
    durationMs: number,
    status: 'success' | 'failed'
  ) => {
    posthog.capture('agent_executed', {
      agent_id: agentId,
      agent_type: agentType,
      duration_ms: durationMs,
      status: status,
    })
  },

  // ==================== User Actions ====================
  
  /**
   * Track feature usage
   */
  featureUsed: (featureName: string, metadata?: Record<string, any>) => {
    posthog.capture('feature_used', {
      feature_name: featureName,
      ...metadata,
    })
  },

  /**
   * Track settings changes
   */
  settingsChanged: (settingName: string, newValue: any) => {
    posthog.capture('settings_changed', {
      setting_name: settingName,
      new_value: newValue,
    })
  },

  /**
   * Track export actions
   */
  dataExported: (exportType: string, format: string, recordCount?: number) => {
    posthog.capture('data_exported', {
      export_type: exportType,
      format: format,
      record_count: recordCount,
    })
  },

  // ==================== Site Scraping Events ====================
  
  /**
   * Track site scraping job start
   */
  siteScrapeStarted: (brandProfileId: number, domain: string, maxPages?: number) => {
    posthog.capture('site_scrape_started', {
      brand_profile_id: brandProfileId,
      domain: domain,
      max_pages: maxPages,
    })
  },

  /**
   * Track site scraping completion
   */
  siteScrapeCompleted: (
    brandProfileId: number, 
    domain: string, 
    pagesScraped: number,
    durationMs: number
  ) => {
    posthog.capture('site_scrape_completed', {
      brand_profile_id: brandProfileId,
      domain: domain,
      pages_scraped: pagesScraped,
      duration_ms: durationMs,
    })
  },
}

/**
 * Set user properties (supplement to PostHogProvider's identify)
 */
export const setUserProperties = (properties: Record<string, any>) => {
  posthog.setPersonProperties(properties)
}

/**
 * Set brand-specific properties
 */
export const setBrandProperties = (brandProfileId: number, properties: {
  brandName?: string
  websiteUrl?: string
  industry?: string
  plan?: string
}) => {
  posthog.setPersonProperties({
    current_brand_id: brandProfileId,
    brand_name: properties.brandName,
    website_url: properties.websiteUrl,
    industry: properties.industry,
    plan: properties.plan,
  })
}

/**
 * Track page section visibility
 */
export const trackSectionViewed = (sectionName: string, metadata?: Record<string, any>) => {
  posthog.capture('section_viewed', {
    section_name: sectionName,
    ...metadata,
  })
}
