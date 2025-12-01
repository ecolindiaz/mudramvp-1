/**
 * Mudra AI Referral Tracking Script
 * Version: 1.0.0
 * 
 * This script tracks visitors referred from AI search engines and chatbots.
 * Tracked sources: ChatGPT, Perplexity, Claude, Gemini
 */

(function() {
  'use strict';
  
  // Get siteId from script tag data attribute
  var script = document.currentScript || document.querySelector('script[data-site-id]');
  var siteId = script ? script.getAttribute('data-site-id') : null;
  
  if (!siteId) {
    console.warn('[Mudra] No site ID found. Please add data-site-id attribute to the script tag.');
    return;
  }
  
  // API endpoint - will be your actual domain
  var API_ENDPOINT = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000/api/analytics/track'
    : 'https://mudra.vercel.app/api/analytics/track';
  
  // AI referrer domains to track
  var AI_REFERRERS = {
    'chatgpt.com': 'chatgpt',
    'chat.openai.com': 'chatgpt',
    'perplexity.ai': 'perplexity',
    'www.perplexity.ai': 'perplexity',
    'claude.ai': 'claude',
    'gemini.google.com': 'gemini',
    'bard.google.com': 'gemini' // Legacy Bard domain
  };
  
  /**
   * Extract domain from URL
   */
  function getDomain(url) {
    try {
      var parser = document.createElement('a');
      parser.href = url;
      return parser.hostname;
    } catch (e) {
      return '';
    }
  }
  
  /**
   * Check if referrer is from an AI source
   */
  function getAIProvider(referrer) {
    if (!referrer) return null;
    
    var domain = getDomain(referrer);
    return AI_REFERRERS[domain] || null;
  }
  
  /**
   * Generate session ID
   */
  function getSessionId() {
    var sessionKey = 'mudra_session_' + siteId;
    var sessionId = sessionStorage.getItem(sessionKey);
    
    if (!sessionId) {
      sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      sessionStorage.setItem(sessionKey, sessionId);
    }
    
    return sessionId;
  }
  
  /**
   * Send tracking data to API
   */
  function trackVisit(data) {
    // Use sendBeacon for reliability (works even when page unloads)
    if (navigator.sendBeacon) {
      var blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      navigator.sendBeacon(API_ENDPOINT, blob);
    } else {
      // Fallback to fetch
      fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        keepalive: true
      }).catch(function(err) {
        console.warn('[Mudra] Tracking failed:', err);
      });
    }
  }
  
  /**
   * Main tracking function
   */
  function init() {
    var referrer = document.referrer;
    var aiProvider = getAIProvider(referrer);
    
    // Only track if from AI source
    if (!aiProvider) {
      return;
    }
    
    var trackingData = {
      siteId: siteId,
      referrer: referrer,
      aiProvider: aiProvider,
      path: window.location.pathname,
      userAgent: navigator.userAgent,
      sessionId: getSessionId(),
      timestamp: new Date().toISOString(),
      // Additional metadata
      metadata: {
        screen: {
          width: window.screen.width,
          height: window.screen.height
        },
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    };
    
    // Send tracking data
    trackVisit(trackingData);
    
    // Store in localStorage for debugging (optional)
    if (window.localStorage) {
      try {
        var visits = JSON.parse(localStorage.getItem('mudra_visits_' + siteId) || '[]');
        visits.push({
          provider: aiProvider,
          path: window.location.pathname,
          timestamp: new Date().toISOString()
        });
        // Keep only last 10 visits
        if (visits.length > 10) visits = visits.slice(-10);
        localStorage.setItem('mudra_visits_' + siteId, JSON.stringify(visits));
      } catch (e) {
        // Ignore localStorage errors
      }
    }
  }
  
  // Run tracking when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  // Expose tracking status for verification
  window.mudraTracking = {
    version: '1.0.0',
    siteId: siteId,
    isActive: true,
    lastCheck: new Date().toISOString()
  };
  
})();
