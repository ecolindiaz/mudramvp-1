import { Company } from './types';

export function validateUrl(url: string): boolean {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    
    // Basic domain validation - must have at least one dot and valid TLD
    const hostname = urlObj.hostname;
    const parts = hostname.split('.');
    
    // Must have at least domain.tld format
    if (parts.length < 2) return false;
    
    // Last part (TLD) must be at least 2 characters and contain only letters
    const tld = parts[parts.length - 1];
    if (tld.length < 2 || !/^[a-zA-Z]+$/.test(tld)) return false;
    
    // Domain parts should contain valid characters (allow numbers and hyphens)
    for (const part of parts) {
      if (!/^[a-zA-Z0-9-]+$/.test(part) || part.startsWith('-') || part.endsWith('-')) {
        return false;
      }
    }
    
    return true;
  } catch (e) {
    console.error('URL validation error:', e);
    return false;
  }
}

export function validateCompetitorUrl(url: string): string | undefined {
  if (!url) return undefined;
  
  // Remove trailing slashes
  let cleanUrl = url.trim().replace(/\/$/, '');
  
  // Ensure the URL has a protocol
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    cleanUrl = 'https://' + cleanUrl;
  }
  
  try {
    const urlObj = new URL(cleanUrl);
    const hostname = urlObj.hostname;
    
    // Return clean URL without protocol for display
    return hostname + (urlObj.pathname !== '/' ? urlObj.pathname : '');
  } catch {
    return undefined;
  }
}

export function normalizeCompetitorName(name: string): string {
  const normalized = name.toLowerCase().trim();
  
  // Normalize common variations to canonical names
  const nameNormalizations: { [key: string]: string } = {
    'amazon web services': 'aws',
    'amazon web services (aws)': 'aws',
    'amazon aws': 'aws',
    'microsoft azure': 'azure',
    'google cloud platform': 'google cloud',
    'google cloud platform (gcp)': 'google cloud',
    'gcp': 'google cloud',
    'digital ocean': 'digitalocean',
    'beautiful soup': 'beautifulsoup',
    'bright data': 'brightdata',
  };
  
  return nameNormalizations[normalized] || normalized;
}

export function assignUrlToCompetitor(competitorName: string): string | undefined {
  // Comprehensive URL mapping for common competitors
  const urlMappings: { [key: string]: string } = {
    // Web scraping tools
    'apify': 'apify.com',
    'scrapy': 'scrapy.org',
    'octoparse': 'octoparse.com',
    'parsehub': 'parsehub.com',
    'diffbot': 'diffbot.com',
    'import.io': 'import.io',
    'bright data': 'brightdata.com',
    'zyte': 'zyte.com',
    'puppeteer': 'pptr.dev',
    'playwright': 'playwright.dev',
    'selenium': 'selenium.dev',
    'beautiful soup': 'pypi.org/project/beautifulsoup4',
    'scrapfly': 'scrapfly.io',
    'crawlbase': 'crawlbase.com',
    'webharvy': 'webharvy.com',
    
    // AI companies
    'openai': 'openai.com',
    'anthropic': 'anthropic.com',
    'google ai': 'ai.google',
    'microsoft azure': 'azure.microsoft.com',
    'ibm watson': 'ibm.com/watson',
    'amazon aws': 'aws.amazon.com',
    'perplexity': 'perplexity.ai',
    'claude': 'anthropic.com',
    'chatgpt': 'openai.com',
    'gemini': 'gemini.google.com',
    
    // SaaS platforms
    'salesforce': 'salesforce.com',
    'hubspot': 'hubspot.com',
    'zendesk': 'zendesk.com',
    'slack': 'slack.com',
    'atlassian': 'atlassian.com',
    'monday.com': 'monday.com',
    'notion': 'notion.so',
    'airtable': 'airtable.com',
    
    // E-commerce
    'shopify': 'shopify.com',
    'woocommerce': 'woocommerce.com',
    'magento': 'magento.com',
    'bigcommerce': 'bigcommerce.com',
    'squarespace': 'squarespace.com',
    'wix': 'wix.com',
    
    // Cloud/hosting
    'vercel': 'vercel.com',
    'netlify': 'netlify.com',
    'aws': 'aws.amazon.com',
    'google cloud': 'cloud.google.com',
    'azure': 'azure.microsoft.com',
    'heroku': 'heroku.com',
    'digitalocean': 'digitalocean.com',
    'cloudflare': 'cloudflare.com'
  };
  
  const normalized = competitorName.toLowerCase().trim();
  return urlMappings[normalized];
}

export function detectServiceType(company: Company): string {
  const desc = (company.description || '').toLowerCase();
  const content = (company.scrapedData?.mainContent || '').toLowerCase();
  const companyName = (company.name || '').toLowerCase();
  
  // Check for specific industries first
  if (desc.includes('beverage') || desc.includes('drink') || desc.includes('cola') || desc.includes('soda') ||
      content.includes('beverage') || content.includes('refreshment') || companyName.includes('coca') || companyName.includes('pepsi')) {
    return 'beverage brand';
  } else if (desc.includes('restaurant') || desc.includes('food') || desc.includes('dining') ||
      content.includes('menu') || content.includes('restaurant')) {
    return 'restaurant';
  } else if (desc.includes('retail') || desc.includes('store') || desc.includes('shopping') ||
      content.includes('retail') || content.includes('shopping')) {
    return 'retailer';
  } else if (desc.includes('bank') || desc.includes('financial') || desc.includes('finance') ||
      content.includes('banking') || content.includes('financial services')) {
    return 'financial service';
  } else if (desc.includes('scraping') || desc.includes('crawl') || desc.includes('extract') ||
      content.includes('web scraping') || content.includes('data extraction')) {
    return 'web scraper';
  } else if (desc.includes('ai') || desc.includes('artificial intelligence') || desc.includes('llm') ||
      content.includes('machine learning') || content.includes('ai-powered')) {
    return 'AI tool';
  } else if (desc.includes('hosting') || desc.includes('deploy') || desc.includes('cloud') ||
      content.includes('deployment') || content.includes('infrastructure')) {
    return 'hosting platform';
  } else if (desc.includes('e-commerce') || desc.includes('online store') || desc.includes('marketplace')) {
    return 'e-commerce platform';
  } else if (desc.includes('software') || desc.includes('saas') || desc.includes('platform')) {
    return 'software';
  }
  // More generic default
  return 'brand';
}

export function getIndustryCompetitors(industry: string): { name: string; url?: string }[] {
  // Default competitors based on industry with URLs
  const industryDefaults: { [key: string]: { name: string; url?: string }[] } = {
    'web scraping': [
      { name: 'Apify', url: 'apify.com' },
      { name: 'Scrapy', url: 'scrapy.org' },
      { name: 'Octoparse', url: 'octoparse.com' },
      { name: 'ParseHub', url: 'parsehub.com' },
      { name: 'Diffbot', url: 'diffbot.com' },
      { name: 'Import.io', url: 'import.io' },
      { name: 'Bright Data', url: 'brightdata.com' },
      { name: 'Zyte', url: 'zyte.com' }
    ],
    'AI': [
      { name: 'OpenAI', url: 'openai.com' },
      { name: 'Anthropic', url: 'anthropic.com' },
      { name: 'Google AI', url: 'ai.google' },
      { name: 'Microsoft Azure', url: 'azure.microsoft.com' },
      { name: 'IBM Watson', url: 'ibm.com/watson' },
      { name: 'Amazon AWS', url: 'aws.amazon.com' }
    ],
    'SaaS': [
      { name: 'Salesforce', url: 'salesforce.com' },
      { name: 'HubSpot', url: 'hubspot.com' },
      { name: 'Zendesk', url: 'zendesk.com' },
      { name: 'Slack', url: 'slack.com' },
      { name: 'Monday.com', url: 'monday.com' },
      { name: 'Asana', url: 'asana.com' }
    ],
    'E-commerce': [
      { name: 'Shopify', url: 'shopify.com' },
      { name: 'WooCommerce', url: 'woocommerce.com' },
      { name: 'BigCommerce', url: 'bigcommerce.com' },
      { name: 'Magento', url: 'magento.com' },
      { name: 'Squarespace', url: 'squarespace.com' },
      { name: 'Wix', url: 'wix.com' }
    ],
    'Cloud': [
      { name: 'AWS', url: 'aws.amazon.com' },
      { name: 'Google Cloud', url: 'cloud.google.com' },
      { name: 'Microsoft Azure', url: 'azure.microsoft.com' },
      { name: 'DigitalOcean', url: 'digitalocean.com' },
      { name: 'Linode', url: 'linode.com' },
      { name: 'Vultr', url: 'vultr.com' }
    ]
  };
  
  const lowerIndustry = industry.toLowerCase();
  
  // Check for partial matches
  for (const [key, competitors] of Object.entries(industryDefaults)) {
    if (lowerIndustry.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerIndustry)) {
      return competitors;
    }
  }
  
  // Generic default competitors
  return [
    { name: 'Competitor 1' },
    { name: 'Competitor 2' },
    { name: 'Competitor 3' },
    { name: 'Competitor 4' },
    { name: 'Competitor 5' }
  ];
}