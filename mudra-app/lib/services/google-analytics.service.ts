/**
 * Google Analytics & Search Console Integration Service
 * 
 * This service provides methods to fetch real traffic data from:
 * - Google Analytics 4 (GA4) API
 * - Google Search Console API
 * 
 * Setup Requirements:
 * 1. Create a Google Cloud Project
 * 2. Enable Google Analytics Data API v1
 * 3. Enable Google Search Console API
 * 4. Create OAuth 2.0 credentials or Service Account
 * 5. Add environment variables to .env.local
 */

import { google } from 'googleapis';
import { BetaAnalyticsDataClient } from '@google-analytics/data';

// Environment variables needed:
// GOOGLE_CLIENT_EMAIL - Service account email
// GOOGLE_PRIVATE_KEY - Service account private key
// GOOGLE_ANALYTICS_PROPERTY_ID - GA4 property ID (format: properties/123456789)

/**
 * Initialize Google Auth with Service Account
 * Returns null if credentials are not configured
 */
function getGoogleAuth(): any | null {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!clientEmail || !privateKey) {
    console.warn('⚠️ Missing Google service account credentials. Traffic metrics will use defaults.');
    return null;
  }

  return new google.auth.JWT(
    clientEmail,
    undefined,
    privateKey,
    [
      'https://www.googleapis.com/auth/analytics.readonly',
      'https://www.googleapis.com/auth/webmasters.readonly',
    ]
  );
}

/**
 * Interface for traffic metrics
 */
export interface TrafficMetrics {
  monthlyVisitors: number;
  pageViews: number;
  avgSessionDuration: number;
  bounceRate: number;
  organicTrafficShare: number;
  topKeywords: string[];
  weekOverWeekGrowth: number;
  monthOverMonthGrowth: number;
}

/**
 * Fetch traffic data from Google Analytics 4
 */
export async function fetchGoogleAnalyticsData(
  propertyId?: string,
  startDate: Date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  endDate: Date = new Date()
): Promise<Partial<TrafficMetrics>> {
  try {
    const credentials = {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };

    if (!credentials.client_email || !credentials.private_key) {
      console.warn('[GA4] Missing credentials, skipping Google Analytics fetch');
      return {};
    }

    const analyticsDataClient = new BetaAnalyticsDataClient({
      credentials,
    });

    const gaPropertyId = propertyId || process.env.GOOGLE_ANALYTICS_PROPERTY_ID;
    if (!gaPropertyId) {
      console.warn('[GA4] No property ID provided');
      return {};
    }

    const formatDate = (date: Date) => date.toISOString().split('T')[0];

    // Fetch current period metrics
    const [currentResponse] = await analyticsDataClient.runReport({
      property: gaPropertyId,
      dateRanges: [
        {
          startDate: formatDate(startDate),
          endDate: formatDate(endDate),
        },
      ],
      dimensions: [
        { name: 'sessionDefaultChannelGroup' },
      ],
      metrics: [
        { name: 'activeUsers' },
        { name: 'screenPageViews' },
        { name: 'averageSessionDuration' },
        { name: 'bounceRate' },
      ],
    });

    // Calculate total metrics
    let totalUsers = 0;
    let totalPageViews = 0;
    let totalSessionDuration = 0;
    let totalBounceRate = 0;
    let organicUsers = 0;
    let rowCount = 0;

    currentResponse.rows?.forEach((row) => {
      const channelGroup = row.dimensionValues?.[0]?.value || '';
      const users = parseInt(row.metricValues?.[0]?.value || '0');
      const pageViews = parseInt(row.metricValues?.[1]?.value || '0');
      const sessionDuration = parseFloat(row.metricValues?.[2]?.value || '0');
      const bounceRate = parseFloat(row.metricValues?.[3]?.value || '0');

      totalUsers += users;
      totalPageViews += pageViews;
      totalSessionDuration += sessionDuration;
      totalBounceRate += bounceRate;
      rowCount++;

      // Count organic traffic
      if (channelGroup.toLowerCase().includes('organic')) {
        organicUsers += users;
      }
    });

    const avgSessionDuration = rowCount > 0 ? Math.floor(totalSessionDuration / rowCount) : 0;
    const avgBounceRate = rowCount > 0 ? Math.floor(totalBounceRate / rowCount) : 0;
    const organicTrafficShare = totalUsers > 0 ? Math.floor((organicUsers / totalUsers) * 100) : 0;

    // Fetch previous period for growth calculation
    const previousStartDate = new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime()));
    const previousEndDate = startDate;

    const [previousResponse] = await analyticsDataClient.runReport({
      property: gaPropertyId,
      dateRanges: [
        {
          startDate: formatDate(previousStartDate),
          endDate: formatDate(previousEndDate),
        },
      ],
      metrics: [{ name: 'activeUsers' }],
    });

    const previousUsers = parseInt(previousResponse.rows?.[0]?.metricValues?.[0]?.value || '0');
    const monthOverMonthGrowth = previousUsers > 0
      ? Math.floor(((totalUsers - previousUsers) / previousUsers) * 100)
      : 0;

    console.log('[GA4] Fetched analytics data:', {
      monthlyVisitors: totalUsers,
      pageViews: totalPageViews,
      organicTrafficShare,
    });

    return {
      monthlyVisitors: totalUsers,
      pageViews: totalPageViews,
      avgSessionDuration,
      bounceRate: avgBounceRate,
      organicTrafficShare,
      monthOverMonthGrowth,
    };
  } catch (error) {
    console.error('[GA4] Error fetching Google Analytics data:', error);
    return {};
  }
}

/**
 * Fetch search console data including top keywords
 */
export async function fetchSearchConsoleData(
  websiteUrl: string,
  startDate: Date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  endDate: Date = new Date()
): Promise<Partial<TrafficMetrics>> {
  try {
    const auth = getGoogleAuth();
    
    // Return empty data if no auth available
    if (!auth) {
      console.log('[Search Console] No credentials configured, returning empty data');
      return { topKeywords: [] };
    }
    
    const searchConsole = google.searchconsole({ version: 'v1', auth });

    const formatDate = (date: Date) => date.toISOString().split('T')[0];

    // Normalize URL format for Search Console
    let siteUrl = websiteUrl;
    if (!siteUrl.startsWith('http://') && !siteUrl.startsWith('https://')) {
      siteUrl = `https://${siteUrl}`;
    }
    if (!siteUrl.endsWith('/')) {
      siteUrl += '/';
    }

    // Fetch top queries (keywords)
    const response = await searchConsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        dimensions: ['query'],
        rowLimit: 10,
        aggregationType: 'auto',
      },
    });

    const topKeywords = response.data.rows?.map((row) => row.keys?.[0] || '') || [];

    // Fetch week-over-week data for growth calculation
    const oneWeekAgo = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(endDate.getTime() - 14 * 24 * 60 * 60 * 1000);

    const [currentWeek, previousWeek] = await Promise.all([
      searchConsole.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate: formatDate(oneWeekAgo),
          endDate: formatDate(endDate),
          aggregationType: 'auto',
        },
      }),
      searchConsole.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate: formatDate(twoWeeksAgo),
          endDate: formatDate(oneWeekAgo),
          aggregationType: 'auto',
        },
      }),
    ]);

    const currentClicks = currentWeek.data.rows?.[0]?.clicks || 0;
    const previousClicks = previousWeek.data.rows?.[0]?.clicks || 0;

    const weekOverWeekGrowth = previousClicks > 0
      ? Math.floor(((currentClicks - previousClicks) / previousClicks) * 100)
      : 0;

    console.log('[Search Console] Fetched search data:', {
      topKeywords: topKeywords.slice(0, 5),
      weekOverWeekGrowth,
    });

    return {
      topKeywords,
      weekOverWeekGrowth,
    };
  } catch (error) {
    console.error('[Search Console] Error fetching data:', error);
    return {};
  }
}

/**
 * Fetch complete traffic metrics from both GA4 and Search Console
 */
export async function fetchCompleteTrafficMetrics(
  websiteUrl: string,
  gaPropertyId?: string
): Promise<TrafficMetrics> {
  console.log('[Traffic Service] Fetching complete metrics for:', websiteUrl);

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Fetch from both sources in parallel
  const [gaData, searchConsoleData] = await Promise.all([
    fetchGoogleAnalyticsData(gaPropertyId, thirtyDaysAgo, now),
    fetchSearchConsoleData(websiteUrl, thirtyDaysAgo, now),
  ]);

  // Merge data, using defaults if APIs fail
  return {
    monthlyVisitors: gaData.monthlyVisitors || 0,
    pageViews: gaData.pageViews || 0,
    avgSessionDuration: gaData.avgSessionDuration || 0,
    bounceRate: gaData.bounceRate || 0,
    organicTrafficShare: gaData.organicTrafficShare || 0,
    topKeywords: searchConsoleData.topKeywords || [],
    weekOverWeekGrowth: searchConsoleData.weekOverWeekGrowth || 0,
    monthOverMonthGrowth: gaData.monthOverMonthGrowth || 0,
  };
}
