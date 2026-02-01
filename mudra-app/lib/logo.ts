/**
 * Logo.dev integration for company logos
 * @see https://www.logo.dev/docs
 */

// Map company names to their domains
const COMPANY_DOMAIN_MAP: Record<string, string> = {
  // Cloud & Hosting
  'aws': 'aws.amazon.com',
  'amazon web services': 'aws.amazon.com',
  'google cloud': 'cloud.google.com',
  'gcp': 'cloud.google.com',
  'azure': 'azure.microsoft.com',
  'microsoft azure': 'azure.microsoft.com',
  'vercel': 'vercel.com',
  'netlify': 'netlify.com',
  'heroku': 'heroku.com',
  'railway': 'railway.app',
  'render': 'render.com',
  'fly.io': 'fly.io',
  'digitalocean': 'digitalocean.com',
  'cloudflare': 'cloudflare.com',
  'cloudflare pages': 'cloudflare.com',
  'cloudflare workers': 'cloudflare.com',
  'fastly': 'fastly.com',
  'akamai': 'akamai.com',
  'firebase': 'firebase.google.com',
  'firebase hosting': 'firebase.google.com',
  'supabase': 'supabase.com',
  'planetscale': 'planetscale.com',
  'neon': 'neon.tech',
  'aws amplify': 'aws.amazon.com',
  'aws lambda': 'aws.amazon.com',
  'aws cloudfront': 'aws.amazon.com',
  'github pages': 'github.com',
  'digitalocean app platform': 'digitalocean.com',
  'northflank': 'northflank.com',
  'coolify': 'coolify.io',
  'dokku': 'dokku.com',
  'caprover': 'caprover.com',

  // DevOps & CI/CD
  'github': 'github.com',
  'gitlab': 'gitlab.com',
  'bitbucket': 'bitbucket.org',
  'jenkins': 'jenkins.io',
  'circleci': 'circleci.com',
  'travis ci': 'travis-ci.com',
  'github actions': 'github.com',
  'gitlab ci/cd': 'gitlab.com',
  'teamcity': 'jetbrains.com',
  'bamboo': 'atlassian.com',
  'harness': 'harness.io',
  'docker': 'docker.com',
  'kubernetes': 'kubernetes.io',
  'terraform': 'terraform.io',
  'pulumi': 'pulumi.com',
  'ansible': 'ansible.com',

  // Monitoring & Observability
  'datadog': 'datadoghq.com',
  'new relic': 'newrelic.com',
  'sentry': 'sentry.io',
  'splunk': 'splunk.com',
  'elastic': 'elastic.co',
  'grafana': 'grafana.com',
  'prometheus': 'prometheus.io',
  'dynatrace': 'dynatrace.com',
  'logrocket': 'logrocket.com',
  'fullstory': 'fullstory.com',
  'hotjar': 'hotjar.com',
  'pagerduty': 'pagerduty.com',
  'opsgenie': 'atlassian.com',
  'statuspage': 'atlassian.com',
  'raygun': 'raygun.com',
  'bugsnag': 'bugsnag.com',
  'speedcurve': 'speedcurve.com',
  'debugbear': 'debugbear.com',

  // Databases
  'mongodb': 'mongodb.com',
  'postgresql': 'postgresql.org',
  'mysql': 'mysql.com',
  'redis': 'redis.io',
  'elasticsearch': 'elastic.co',
  'cockroachdb': 'cockroachlabs.com',
  'fauna': 'fauna.com',
  'dynamodb': 'aws.amazon.com',
  'cassandra': 'cassandra.apache.org',
  'snowflake': 'snowflake.com',

  // Frameworks & Tools
  'next.js': 'nextjs.org',
  'nextjs': 'nextjs.org',
  'nuxt': 'nuxt.com',
  'gatsby': 'gatsbyjs.com',
  'remix': 'remix.run',
  'astro': 'astro.build',
  'svelte': 'svelte.dev',
  'vue': 'vuejs.org',
  'react': 'react.dev',
  'angular': 'angular.io',
  'webpack': 'webpack.js.org',
  'vite': 'vitejs.dev',
  'turbopack': 'turbo.build',
  'esbuild': 'esbuild.github.io',

  // AI & ML
  'openai': 'openai.com',
  'anthropic': 'anthropic.com',
  'hugging face': 'huggingface.co',
  'replicate': 'replicate.com',
  'modal': 'modal.com',
  'langchain': 'langchain.com',
  'pinecone': 'pinecone.io',
  'weaviate': 'weaviate.io',
  'cohere': 'cohere.com',
  'stability ai': 'stability.ai',
  'bolt.new': 'bolt.new',
  'lovable': 'lovable.dev',
  'copilotkit': 'copilotkit.ai',
  'botpress': 'botpress.com',
  'v0': 'v0.dev',
  'cursor': 'cursor.com',

  // E-commerce & CMS
  'shopify': 'shopify.com',
  'stripe': 'stripe.com',
  'square': 'squareup.com',
  'paypal': 'paypal.com',
  'contentful': 'contentful.com',
  'sanity': 'sanity.io',
  'strapi': 'strapi.io',
  'wordpress': 'wordpress.com',
  'webflow': 'webflow.com',
  'wix': 'wix.com',
  'squarespace': 'squarespace.com',
  'salesforce commerce cloud': 'salesforce.com',
  'bigcommerce': 'bigcommerce.com',

  // CDN & Performance
  'bunny.net': 'bunny.net',
  'amazon cloudfront': 'aws.amazon.com',
  'keycdn': 'keycdn.com',
  'stackpath': 'stackpath.com',

  // Other tech
  'twilio': 'twilio.com',
  'sendgrid': 'sendgrid.com',
  'mailgun': 'mailgun.com',
  'postmark': 'postmarkapp.com',
  'slack': 'slack.com',
  'discord': 'discord.com',
  'auth0': 'auth0.com',
  'okta': 'okta.com',
  'clerk': 'clerk.com',
  'segment': 'segment.com',
  'amplitude': 'amplitude.com',
  'mixpanel': 'mixpanel.com',
  'launchdarkly': 'launchdarkly.com',
  'split': 'split.io',
  'optimizely': 'optimizely.com',
  'algolia': 'algolia.com',
  'typesense': 'typesense.org',
  'retool': 'retool.com',
  'bubble': 'bubble.io',
  'airtable': 'airtable.com',
  'notion': 'notion.so',
  'coda': 'coda.io',
  'zapier': 'zapier.com',
  'dokploy': 'dokploy.com',
  'zeabur': 'zeabur.com',
  'koyeb': 'koyeb.com',
  'adaptable': 'adaptable.io',
  'cyclic': 'cyclic.sh',
  'deta': 'deta.space',
  'qovery': 'qovery.com',
  'porter': 'porter.run',
  'g2': 'g2.com',
  'gartner': 'gartner.com',
  'gartner peer insights': 'gartner.com',
  'google search console': 'google.com',
}

/**
 * Get the domain for a company name
 */
export function getCompanyDomain(companyName: string): string {
  if (!companyName) return ''

  const normalized = companyName.toLowerCase().trim()

  // Check known mapping first
  if (COMPANY_DOMAIN_MAP[normalized]) {
    return COMPANY_DOMAIN_MAP[normalized]
  }

  // If it looks like a domain already, use it
  if (normalized.includes('.') && !normalized.includes(' ')) {
    return normalized
  }

  // Fallback: convert company name to likely domain
  const cleaned = normalized
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '')

  return `${cleaned}.com`
}

/**
 * Get Logo.dev CDN URL for a company
 */
export function getLogoUrl(
  companyNameOrDomain: string,
  options: {
    size?: number
    format?: 'png' | 'jpg' | 'webp'
    theme?: 'light' | 'dark' | 'auto'
    fallback?: 'monogram' | '404'
    retina?: boolean
  } = {}
): string {
  const {
    size = 64,
    format = 'png',
    theme = 'dark',
    fallback = 'monogram',
    retina = true,
  } = options

  const token = process.env.NEXT_PUBLIC_LOGO_DEV_KEY
  if (!token) {
    console.warn('NEXT_PUBLIC_LOGO_DEV_KEY not set')
    return ''
  }

  // Determine if input is domain or company name
  const isDomain = companyNameOrDomain.includes('.') && !companyNameOrDomain.includes(' ')
  const domain = isDomain ? companyNameOrDomain : getCompanyDomain(companyNameOrDomain)

  if (!domain) return ''

  const params = new URLSearchParams({
    token,
    size: size.toString(),
    format,
    theme,
    fallback,
    ...(retina && { retina: 'true' }),
  })

  return `https://img.logo.dev/${domain}?${params.toString()}`
}

/**
 * Extract domain from a URL
 */
export function extractDomainFromUrl(url: string): string {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`)
    return parsed.hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
