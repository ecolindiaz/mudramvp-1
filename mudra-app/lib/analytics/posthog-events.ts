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
  analysisStarted: (brandProfileId: number, analysisType: string) => {
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
    contentTypeOrCampaignId: string | number, 
    aiModelOrSource?: string, 
    wordCountOrModel?: string | number,
    wordCount?: number
  ) => {
    posthog.capture('content_generated', {
      content_type: typeof contentTypeOrCampaignId === 'string' ? contentTypeOrCampaignId : undefined,
      campaign_id: typeof contentTypeOrCampaignId === 'number' ? contentTypeOrCampaignId : undefined,
      ai_model: aiModelOrSource,
      source: aiModelOrSource,
      word_count: typeof wordCountOrModel === 'number' ? wordCountOrModel : wordCount,
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
  githubIntegrationConnected: (method: string, repoCount?: number) => {
    posthog.capture('github_integration_connected', {
      method,
      repo_count: repoCount,
    })
  },

  /**
   * Track GitHub integration disconnection
   */
  githubIntegrationDisconnected: (method: string) => {
    posthog.capture('github_integration_disconnected', {
      method,
    })
  },

  /**
   * Track tracking script installation
   */
  trackingScriptInstalled: (repoOrBrandId: string | number, method?: string) => {
    posthog.capture('tracking_script_installed', {
      repository: typeof repoOrBrandId === 'string' ? repoOrBrandId : undefined,
      brand_profile_id: typeof repoOrBrandId === 'number' ? repoOrBrandId : undefined,
      method,
    })
  },

  // ==================== Agent Lab Events ====================
  
  /**
   * Track when agent is created/deployed
   */
  agentDeployed: (agentId: string | number, agentType?: string, brandProfileId?: number) => {
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
    agentType: string, 
    metadata?: Record<string, any>
  ) => {
    posthog.capture('agent_executed', {
      agent_type: agentType,
      ...metadata,
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

  // ==================== Auth Events ====================

  loginAttempted: (method: 'credentials' | 'google') => {
    posthog.capture('login_attempted', { method })
  },

  loginSucceeded: (method: 'credentials' | 'google') => {
    posthog.capture('login_succeeded', { method })
  },

  loginFailed: (method: 'credentials' | 'google', error: string) => {
    posthog.capture('login_failed', { method, error_message: error })
  },

  signupAttempted: (method: 'credentials' | 'google') => {
    posthog.capture('signup_attempted', { method })
  },

  signupSucceeded: (method: 'credentials' | 'google') => {
    posthog.capture('signup_succeeded', { method })
  },

  signupFailed: (method: 'credentials' | 'google', error: string) => {
    posthog.capture('signup_failed', { method, error_message: error })
  },

  passwordResetRequested: () => {
    posthog.capture('password_reset_requested')
  },

  passwordResetCompleted: () => {
    posthog.capture('password_reset_completed')
  },

  loggedOut: () => {
    posthog.capture('logged_out')
  },

  // ==================== Navigation Events ====================

  sidebarNavigated: (destination: string) => {
    posthog.capture('sidebar_navigated', { destination })
  },

  monitorSwitched: (monitorId: number, monitorName: string) => {
    posthog.capture('monitor_switched', { monitor_id: monitorId, monitor_name: monitorName })
  },

  // ==================== Prompt Management Events ====================

  promptCreated: (brandProfileId: number, category?: string) => {
    posthog.capture('prompt_created', { brand_profile_id: brandProfileId, category })
  },

  promptEdited: (promptId: number) => {
    posthog.capture('prompt_edited', { prompt_id: promptId })
  },

  promptDeleted: (promptId: number) => {
    posthog.capture('prompt_deleted', { prompt_id: promptId })
  },

  promptsBatchGenerated: (brandProfileId: number, count: number) => {
    posthog.capture('prompts_batch_generated', { brand_profile_id: brandProfileId, count })
  },

  // ==================== Tracked Prompt Events ====================

  trackedPromptAdded: (brandProfileId: number, promptText: string) => {
    posthog.capture('tracked_prompt_added', { brand_profile_id: brandProfileId, prompt_text: promptText })
  },

  trackedPromptDeleted: (promptId: number) => {
    posthog.capture('tracked_prompt_deleted', { prompt_id: promptId })
  },

  trackedPromptExported: (countOrFormat: string | number, count?: number) => {
    posthog.capture('tracked_prompt_exported', {
      format: typeof countOrFormat === 'string' ? countOrFormat : 'csv',
      count: typeof countOrFormat === 'number' ? countOrFormat : count,
    })
  },

  // ==================== Conversation Radar Events ====================

  conversationScanStarted: (brandProfileId: number, platform: string) => {
    posthog.capture('conversation_scan_started', { brand_profile_id: brandProfileId, platform })
  },

  conversationScanCompleted: (brandProfileId: number, resultsCount: number) => {
    posthog.capture('conversation_scan_completed', { brand_profile_id: brandProfileId, results_count: resultsCount })
  },

  opportunityViewed: (opportunityId: string | number, platform?: string) => {
    posthog.capture('opportunity_viewed', { opportunity_id: String(opportunityId), platform })
  },

  opportunityDismissed: (opportunityId: string | number) => {
    posthog.capture('opportunity_dismissed', { opportunity_id: String(opportunityId) })
  },

  opportunityCompleted: (opportunityId: string | number) => {
    posthog.capture('opportunity_completed', { opportunity_id: String(opportunityId) })
  },

  // ==================== Issue Board Events ====================

  issueCreated: (issueIdOrBrandId: string | number, categoryOrPriority?: string) => {
    posthog.capture('issue_created', { id: String(issueIdOrBrandId), category: categoryOrPriority })
  },

  issueStatusChanged: (issueId: string | number, newStatus: string) => {
    posthog.capture('issue_status_changed', { issue_id: String(issueId), new_status: newStatus })
  },

  issueDeleted: (issueId: string | number) => {
    posthog.capture('issue_deleted', { issue_id: String(issueId) })
  },

  // ==================== Technical Analysis Events ====================

  technicalScrapeStarted: (brandProfileId: number, url: string) => {
    posthog.capture('technical_scrape_started', { brand_profile_id: brandProfileId, url })
  },

  technicalScrapeCompleted: (brandProfileId: number, score: number) => {
    posthog.capture('technical_scrape_completed', { brand_profile_id: brandProfileId, score })
  },

  // ==================== Notification Events ====================

  notificationRead: (notificationId: string) => {
    posthog.capture('notification_read', { notification_id: notificationId })
  },

  notificationsAllRead: () => {
    posthog.capture('notifications_all_read')
  },

  notificationSettingsChanged: (category: string, setting: string | boolean, value?: boolean) => {
    posthog.capture('notification_settings_changed', {
      category,
      setting: typeof setting === 'string' ? setting : undefined,
      enabled: typeof setting === 'boolean' ? setting : value,
    })
  },

  // ==================== Billing Events ====================

  planUpgradeClicked: (currentPlan: string, targetPlan: string) => {
    posthog.capture('plan_upgrade_clicked', { current_plan: currentPlan, target_plan: targetPlan })
  },

  // ==================== Account Events ====================

  profileUpdated: (fields?: string[]) => {
    posthog.capture('profile_updated', { fields_changed: fields })
  },

  passwordChanged: () => {
    posthog.capture('password_changed')
  },

  accountDeleted: () => {
    posthog.capture('account_deleted')
  },

  // ==================== Report Events ====================

  reportGenerated: (brandProfileId: number) => {
    posthog.capture('report_generated', { brand_profile_id: brandProfileId })
  },

  reportViewed: (brandProfileId: number) => {
    posthog.capture('report_viewed', { brand_profile_id: brandProfileId })
  },

  // ==================== Content Lab Events ====================

  articleCreated: (brandProfileId: number) => {
    posthog.capture('article_created', { brand_profile_id: brandProfileId })
  },

  articlePublished: (articleId: number, platform: string) => {
    posthog.capture('article_published', { article_id: articleId, platform })
  },

  blogSetupStarted: (brandProfileId: number) => {
    posthog.capture('blog_setup_started', { brand_profile_id: brandProfileId })
  },

  blogSetupCompleted: (brandProfileId: number) => {
    posthog.capture('blog_setup_completed', { brand_profile_id: brandProfileId })
  },

  // ==================== Tasks Events ====================

  taskGenerated: (brandProfileId: number, count: number) => {
    posthog.capture('task_generated', { brand_profile_id: brandProfileId, count })
  },

  taskVerified: (taskId: string) => {
    posthog.capture('task_verified', { task_id: taskId })
  },

  // ==================== Direct GEO Events ====================

  directGeoAnalysisStarted: (companyName: string) => {
    posthog.capture('direct_geo_analysis_started', { company_name: companyName })
  },

  directGeoAnalysisCompleted: (companyName: string, score: number) => {
    posthog.capture('direct_geo_analysis_completed', { company_name: companyName, score })
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
