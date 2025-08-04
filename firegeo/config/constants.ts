// Application-wide constants
// This file contains all configuration values that were previously hardcoded throughout the codebase

// ============================================
// Feature IDs and Identifiers
// ============================================
export const FEATURE_ID_MESSAGES = 'messages';

// ============================================
// User Roles
// ============================================
export const ROLE_USER = 'user';
export const ROLE_ASSISTANT = 'assistant';
export const ROLE_SYSTEM = 'system';

// ============================================
// Credit/Usage Constants
// ============================================
export const CREDITS_PER_MESSAGE = 1;
export const CREDITS_PER_BRAND_ANALYSIS = 10;
export const FREE_TIER_MESSAGES = 100;
export const STARTER_TIER_MESSAGES = 1000;
export const PRO_TIER_MESSAGES = 10000;

// ============================================
// Time Constants (in milliseconds unless specified)
// ============================================
export const ONE_MINUTE = 60 * 1000;
export const FIVE_MINUTES = 5 * 60 * 1000;
export const ONE_HOUR = 60 * 60 * 1000;
export const ONE_DAY = 24 * 60 * 60 * 1000;
export const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;

// Time in seconds
export const ONE_DAY_SECONDS = 60 * 60 * 24;
export const ONE_WEEK_SECONDS = 60 * 60 * 24 * 7;

// Query client
export const QUERY_STALE_TIME = ONE_MINUTE;
export const QUERY_CACHE_TIME = FIVE_MINUTES;

// SSE and timeouts
export const SSE_HEARTBEAT_INTERVAL = 30000; // 30 seconds
export const SSE_MAX_DURATION = 300; // 5 minutes in seconds
export const DEFAULT_RETRY_AFTER = 60; // seconds

// Animation delays
export const MIN_ANIMATION_DELAY = 500;
export const MAX_ANIMATION_DELAY = 1500;

// ============================================
// Numeric Limits and Thresholds
// ============================================
export const CONTEXT_CHARS_LIMIT = 50;
export const DEFAULT_CONTEXT_WORDS = 10;
export const MAX_COMPANIES_TO_ANALYZE = 10;
export const PROGRESS_MAX_PERCENTAGE = 100;
export const MESSAGE_TITLE_MAX_LENGTH = 50;
export const CONVERSATION_DISPLAY_LIMIT = 50;

// AI Model Limits
export const AI_MAX_RETRIES = 2;
export const AI_DEFAULT_MAX_TOKENS = 800;

// Model-specific token limits
export const MODEL_MAX_TOKENS = {
  'claude-3-5-sonnet': 200000,
  'claude-3-5-haiku': 200000,
  'claude-3-haiku': 200000,
  'gemini-1.5-pro': 1000000,
  'gemini-1.5-flash': 1000000,
  'gemini-2.0-flash-exp': 1000000,
  'gpt-4': 127000,
  'gpt-4o': 127000,
  'gpt-4o-mini': 127000,
  'perplexity-sonar': 32000,
} as const;

// Rate limits (requests per minute)
export const MODEL_RATE_LIMITS = {
  'claude-3-5-sonnet': 500,
  'claude-3-5-haiku': 500,
  'claude-3-haiku': 500,
  'gemini-1.5-pro': 60,
  'gemini-1.5-flash': 120,
  'gemini-2.0-flash-exp': 120,
  'gpt-4': 50,
  'gpt-4o': 60,
  'gpt-4o-mini': 60,
  'perplexity-sonar': 20,
} as const;

// ============================================
// URLs and Endpoints
// ============================================
export const DEFAULT_BASE_URL = 'http://localhost:3000';
export const AUTUMN_API_URL = 'https://api.useautumn.com/v1';
export const GOOGLE_FAVICON_API = 'https://www.google.com/s2/favicons?domain=';

// API Endpoints
export const API_ENDPOINTS = {
  CHAT: '/api/chat',
  CREDITS: '/api/credits',
  USER_PROFILE: '/api/user/profile',
  USER_SETTINGS: '/api/user/settings',
  BRAND_MONITOR_ANALYZE: '/api/brand-monitor/analyze',
  BRAND_MONITOR_SCRAPE: '/api/brand-monitor/scrape',
  BRAND_MONITOR_BATCH_SCRAPE: '/api/brand-monitor/batch-scrape',
  BRAND_MONITOR_WEB_SEARCH: '/api/brand-monitor/web-search',
  BRAND_MONITOR_CHECK_PROVIDERS: '/api/brand-monitor/check-providers',
  CHAT_FEEDBACK: '/api/chat/feedback',
} as const;

// ============================================
// HTTP Constants
// ============================================
export const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  RATE_LIMIT: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

export const HTTP_METHODS = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE',
  PATCH: 'PATCH',
} as const;

export const CONTENT_TYPES = {
  JSON: 'application/json',
  SSE: 'text/event-stream',
  FORM: 'application/x-www-form-urlencoded',
  MULTIPART: 'multipart/form-data',
} as const;

// ============================================
// SSE Event Types
// ============================================
export const SSE_EVENTS = {
  START: 'start',
  STAGE: 'stage',
  PROGRESS: 'progress',
  PARTIAL_RESULT: 'partial-result',
  COMPLETE: 'complete',
  ERROR: 'error',
  CREDITS: 'credits',
  COMPETITOR_FOUND: 'competitor-found',
  PROMPT_GENERATED: 'prompt-generated',
  ANALYSIS_PROGRESS: 'analysis-progress',
} as const;

export const SSE_PREFIXES = {
  EVENT: 'event:',
  DATA: 'data:',
} as const;

// ============================================
// Brand Monitor Stages
// ============================================
export const ANALYSIS_STAGES = {
  INITIALIZING: 'initializing',
  IDENTIFYING_COMPETITORS: 'identifying-competitors',
  GENERATING_PROMPTS: 'generating-prompts',
  ANALYZING: 'analyzing',
  SCORING: 'scoring',
  FINALIZING: 'finalizing',
  ERROR: 'error',
} as const;

// ============================================
// Scoring Constants
// ============================================
export const SENTIMENT_SCORES = {
  POSITIVE: 100,
  NEUTRAL: 50,
  NEGATIVE: 0,
} as const;

export const POSITION_SCORE_THRESHOLDS = {
  MIN: 10,
  MAX: 11,
} as const;

export const SCORING_WEIGHTS = {
  RANK: 0.1,
  MENTIONS: 0.3,
  SENTIMENT: 0.4,
  RECOMMENDED: 0.2,
} as const;

// ============================================
// Database Constants
// ============================================
export const DB_TABLES = {
  MESSAGES: 'messages',
  CONVERSATIONS: 'conversations',
  FEEDBACK: 'feedback',
  USER_SETTINGS: 'userSettings',
} as const;

// ============================================
// UI/Display Constants
// ============================================
export const UI_LIMITS = {
  MESSAGE_PREVIEW_LENGTH: 100,
  TITLE_MAX_LENGTH: 50,
  PROGRESS_ROUNDING: 10,
} as const;

// ============================================
// AI Model Names
// ============================================
export const AI_MODELS = {
  CLAUDE_SONNET: 'claude-3-5-sonnet-latest',
  CLAUDE_HAIKU: 'claude-3-5-haiku-latest',
  GEMINI_FLASH: 'gemini-2.0-flash-exp',
  GPT_4O_MINI: 'gpt-4o-mini',
  PERPLEXITY_SONAR: 'sonar',
} as const;

// ============================================
// Error Messages
// ============================================
export const ERROR_MESSAGES = {
  UNAUTHORIZED: 'Unauthorized',
  MESSAGE_ID_REQUIRED: 'Message ID required',
  CONVERSATION_NOT_FOUND: 'Conversation not found',
  INVALID_THEME: 'Invalid theme value',
  NO_VALID_FIELDS: 'No valid fields to update',
  COMPANY_INFO_REQUIRED: 'Company information is required',
  INVALID_MESSAGE: 'Invalid message',
  FAILED_TO_CHECK_ACCESS: 'Failed to check access',
  FAILED_TO_TRACK_USAGE: 'Failed to track usage',
  NO_CREDITS_REMAINING: 'No credits remaining. Please upgrade your plan',
  INSUFFICIENT_CREDITS_BRAND_ANALYSIS: 'You need at least 10 credits for a brand analysis',
} as const;

// ============================================
// Cache Keys
// ============================================
export const CACHE_KEYS = {
  USER_PROFILE: 'user-profile',
  USER_SETTINGS: 'user-settings',
  CONVERSATIONS: 'conversations',
  CREDITS: 'credits',
} as const;