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
  
  // API endpoint - detect from script source or use defaults
  var scriptSrc = script ? script.src : '';
  var scriptOrigin = '';
  
  try {
    var url = new URL(scriptSrc);
    scriptOrigin = url.origin;
  } catch (e) {
    // Fallback to defaults
    scriptOrigin = window.location.hostname === 'localhost' 
      ? 'http://localhost:3000'
      : 'https://app.trymudra.com';
  }
  
  var API_ENDPOINT = scriptOrigin + '/api/analytics/track';
  
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
   * Check URL parameters for AI source
   */
  function getAIProviderFromURL() {
    try {
      var urlParams = new URLSearchParams(window.location.search);
      var source = urlParams.get('source') || urlParams.get('ref') || urlParams.get('utm_source');
      
      if (source) {
        var lowerSource = source.toLowerCase();
        if (lowerSource.includes('chatgpt') || lowerSource.includes('openai')) return 'chatgpt';
        if (lowerSource.includes('perplexity')) return 'perplexity';
        if (lowerSource.includes('claude')) return 'claude';
        if (lowerSource.includes('gemini') || lowerSource.includes('bard')) return 'gemini';
      }
    } catch (e) {
      // Ignore errors
    }
    return null;
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
    console.log('[Mudra] Sending tracking data to:', API_ENDPOINT);
    console.log('[Mudra] Data:', JSON.stringify(data, null, 2));
    
    // Use sendBeacon for reliability (works even when page unloads)
    if (navigator.sendBeacon) {
      var blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      var sent = navigator.sendBeacon(API_ENDPOINT, blob);
      console.log('[Mudra] Beacon sent:', sent);
    } else {
      // Fallback to fetch
      fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        keepalive: true
      })
      .then(function(response) {
        console.log('[Mudra] Tracking response:', response.status, response.statusText);
        return response.json();
      })
      .then(function(result) {
        console.log('[Mudra] Tracking result:', result);
      })
      .catch(function(err) {
        console.error('[Mudra] Tracking failed:', err);
      });
    }
  }
  
  /**
   * Main tracking function
   */
  function init() {
    var referrer = document.referrer;
    var aiProvider = getAIProvider(referrer);
    
    // If no referrer detected, check URL parameters
    if (!aiProvider) {
      aiProvider = getAIProviderFromURL();
    }
    
    // Only track if from AI source
    if (!aiProvider) {
      console.log('[Mudra] No AI referrer detected');
      return;
    }
    
    console.log('[Mudra] AI referrer detected:', aiProvider, 'from', referrer || 'URL parameter');
    
    var trackingData = {
      siteId: siteId,
      referrer: referrer || window.location.href, // Use full URL if no referrer
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
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        urlParams: window.location.search // Store URL parameters for debugging
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
