/**
 * Sample HTML Test Fixtures for Technical Analysis Validation
 * 
 * Each fixture has known structure and expected score
 * Used to validate scoring accuracy and regression testing
 */

export interface TestFixture {
  name: string;
  html: string;
  expectedScore: {
    overall: number;
    metadata: number;
    headings: number;
    semantic: number;
    schema: number;
    faq: number;
  };
  description: string;
}

/**
 * Perfect Score Page (100/100)
 * All components implemented correctly
 */
export const PERFECT_PAGE: TestFixture = {
  name: 'Perfect Score Page',
  description: 'All technical components perfectly implemented',
  html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Perfect SEO Company - AI-Powered Solutions</title>
  <meta name="description" content="Leading AI-powered SEO solutions with real-time analytics and automated optimization for enterprise businesses.">
  <meta property="og:title" content="Perfect SEO Company - AI-Powered Solutions">
  <meta property="og:description" content="Leading AI-powered SEO solutions with real-time analytics and automated optimization for enterprise businesses.">
  <meta property="og:image" content="https://example.com/og-image.jpg">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Perfect SEO Company - AI-Powered Solutions">
  <link rel="canonical" href="https://example.com/products">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Perfect SEO Company",
    "url": "https://example.com",
    "logo": "https://example.com/logo.png"
  }
  </script>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "What is AI-powered SEO?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "AI-powered SEO uses machine learning algorithms to optimize content for search engines automatically."
        }
      }
    ]
  }
  </script>
</head>
<body>
  <header role="banner">
    <nav aria-label="Main navigation">
      <a href="/">Home</a>
    </nav>
  </header>
  <main role="main">
    <article>
      <h1>Perfect SEO Company - AI-Powered Solutions</h1>
      <section>
        <h2>Our AI Technology</h2>
        <p>Advanced machine learning for search optimization.</p>
        <img src="/tech.jpg" alt="AI technology dashboard showing analytics">
      </section>
      <section>
        <h2>Enterprise Features</h2>
        <h3>Real-time Analytics</h3>
        <p>Track performance metrics in real-time.</p>
      </section>
      <section>
        <h2>Frequently Asked Questions</h2>
        <div itemscope itemtype="https://schema.org/Question">
          <h3 itemprop="name">What is AI-powered SEO?</h3>
          <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
            <p itemprop="text">AI-powered SEO uses machine learning algorithms to optimize content for search engines automatically.</p>
          </div>
        </div>
      </section>
    </article>
  </main>
  <footer role="contentinfo">
    <p>&copy; 2025 Perfect SEO Company</p>
  </footer>
</body>
</html>`,
  expectedScore: {
    overall: 100,
    metadata: 25,  // M1-M5: title, desc, OG, Twitter, canonical
    headings: 20,  // H1-H3: proper hierarchy
    semantic: 15,  // S1-S3: semantic tags, alt text, ARIA
    schema: 25,    // J1-J3: valid JSON-LD (Org + FAQ)
    faq: 15,       // 1+ FAQ items
  },
};

/**
 * Good Page (67.33/100)
 * Missing some advanced features
 */
export const GOOD_PAGE: TestFixture = {
  name: 'Good Score Page',
  description: 'Solid implementation but missing advanced features',
  html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Good Company - Software Solutions</title>
  <meta name="description" content="Software solutions for modern businesses.">
  <meta property="og:title" content="Good Company - Software Solutions">
  <link rel="canonical" href="https://example.com/about">
</head>
<body>
  <h1>Good Company - Software Solutions</h1>
  <section>
    <h2>Our Services</h2>
    <p>We provide software solutions.</p>
    <img src="/service.jpg" alt="Service overview">
  </section>
  <section>
    <h2>About Us</h2>
    <h3>Company History</h3>
    <p>Founded in 2020.</p>
  </section>
</body>
</html>`,
  expectedScore: {
    overall: 40,
    metadata: 10,  // M1-M2: title (5), description (5) - OG title alone doesn't count, needs og:description too
    headings: 20,  // H1 (10), H2 (5), H3 (5)
    semantic: 10,  // semantic tags (5), image alt (5) - 1/1 images have alt
    schema: 0,     // No JSON-LD
    faq: 0,        // No FAQs
  },
};

/**
 * Poor Page (20/100)
 * Minimal implementation
 */
export const POOR_PAGE: TestFixture = {
  name: 'Poor Score Page',
  description: 'Minimal implementation with many issues',
  html: `<!DOCTYPE html>
<html>
<head>
  <title>Company</title>
</head>
<body>
  <h1>Welcome</h1>
  <p>We are a company.</p>
  <img src="/logo.png">
</body>
</html>`,
  expectedScore: {
    overall: 15,
    metadata: 5,   // M1 only: title present (5)
    headings: 10,  // H1 present (10) - gets points for H1 even without hierarchy
    semantic: 0,   // No alt text (0/1 images), no semantic tags
    schema: 0,     // No JSON-LD
    faq: 0,        // No FAQs
  },
};

/**
 * Edge Case: Malformed HTML
 * Should handle gracefully without crashing
 */
export const MALFORMED_PAGE: TestFixture = {
  name: 'Malformed HTML Page',
  description: 'Tests error handling for malformed HTML',
  html: `<!DOCTYPE html>
<html>
<head>
  <title>Malformed Page
  <meta name="description" content="Missing closing quote>
</head>
<body>
  <h1>Broken Structure
  <p>Unclosed paragraph
  <div>
    <h2>Nested Heading</h2>
  <h3>Wrong nesting</h3>
  </div>
  <script type="application/ld+json">
  { "invalid": "json syntax",,, }
  </script>
</body>`,
  expectedScore: {
    overall: 5,
    metadata: 5,   // Should extract what it can
    headings: 0,   // Broken hierarchy
    semantic: 0,   // No proper structure
    schema: 0,     // Invalid JSON-LD
    faq: 0,        // No FAQs
  },
};

/**
 * Empty Page
 * Tests handling of completely empty content
 */
export const EMPTY_PAGE: TestFixture = {
  name: 'Empty Page',
  description: 'Tests handling of empty/minimal content',
  html: `<!DOCTYPE html>
<html>
<head></head>
<body></body>
</html>`,
  expectedScore: {
    overall: 0,
    metadata: 0,
    headings: 0,
    semantic: 0,
    schema: 0,
    faq: 0,
  },
};

/**
 * FAQ-Heavy Page (High FAQ Score)
 * Multiple FAQ items with schema
 */
export const FAQ_HEAVY_PAGE: TestFixture = {
  name: 'FAQ-Heavy Page',
  description: 'Page with extensive FAQ content',
  html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>FAQ - Common Questions</title>
  <meta name="description" content="Frequently asked questions about our service.">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "Question 1?",
        "acceptedAnswer": {"@type": "Answer", "text": "Answer 1"}
      },
      {
        "@type": "Question",
        "name": "Question 2?",
        "acceptedAnswer": {"@type": "Answer", "text": "Answer 2"}
      },
      {
        "@type": "Question",
        "name": "Question 3?",
        "acceptedAnswer": {"@type": "Answer", "text": "Answer 3"}
      }
    ]
  }
  </script>
</head>
<body>
  <h1>Frequently Asked Questions</h1>
  <section>
    <h2>Question 1?</h2>
    <p>Answer 1</p>
    <h2>Question 2?</h2>
    <p>Answer 2</p>
    <h2>Question 3?</h2>
    <p>Answer 3</p>
  </section>
</body>
</html>`,
  expectedScore: {
    overall: 55,
    metadata: 10,  // M1-M2: title, description
    headings: 10,  // H1-H2 present
    semantic: 0,   // No semantic tags
    schema: 20,    // J1-J2: valid FAQ schema
    faq: 15,       // 3+ FAQ items
  },
};

// ============================================================================
// NEW FIXTURES FOR GAP 7 — REAL-WORLD PAGE TYPES
// ============================================================================

export const PRICING_PAGE: TestFixture = {
  name: 'Pricing Page',
  description: 'Pricing page with 3 tiers and FAQ section',
  html: `<!DOCTYPE html>
<html lang="en">
<head>
  <title>Pricing - Acme Platform</title>
  <meta name="description" content="Choose the right plan for your team. Plans start at $10/mo.">
  <link rel="canonical" href="https://acme.com/pricing">
  <meta property="og:title" content="Pricing - Acme Platform">
  <meta name="twitter:card" content="summary">
</head>
<body>
<header><nav><a href="/">Home</a><a href="/pricing">Pricing</a></nav></header>
<main>
  <h1>Simple, Transparent Pricing</h1>
  <section>
    <h2>Starter Plan - $10/mo</h2>
    <p>Perfect for small teams. Includes 5 users and basic analytics.</p>
  </section>
  <section>
    <h2>Pro Plan - $49/mo</h2>
    <p>For growing businesses. Includes 25 users and advanced analytics.</p>
  </section>
  <section>
    <h2>Enterprise Plan - Custom</h2>
    <p>For large organizations. Unlimited users and dedicated support.</p>
  </section>
  <section id="faq">
    <h2>Frequently Asked Questions</h2>
    <details><summary>Can I switch plans?</summary><p>Yes, you can upgrade or downgrade at any time from your dashboard.</p></details>
    <details><summary>Is there a free trial?</summary><p>Yes, all plans come with a 14-day free trial.</p></details>
    <details><summary>What payment methods do you accept?</summary><p>We accept all major credit cards and wire transfers for enterprise plans.</p></details>
  </section>
</main>
<footer><p>&copy; 2025 Acme Platform</p></footer>
</body>
</html>`,
  expectedScore: { overall: 80, metadata: 20, headings: 20, semantic: 10, schema: 0, faq: 15 },
};

export const FEATURES_PAGE: TestFixture = {
  name: 'Features Page',
  description: 'Feature list page with multiple headings',
  html: `<!DOCTYPE html>
<html lang="en">
<head>
  <title>Features - Acme Platform</title>
  <meta name="description" content="Discover all the powerful features of Acme Platform.">
  <link rel="canonical" href="https://acme.com/features">
  <meta property="og:title" content="Features - Acme Platform">
  <meta property="og:description" content="Discover all the powerful features.">
  <meta name="twitter:card" content="summary">
</head>
<body>
<header><nav><a href="/">Home</a><a href="/features">Features</a></nav></header>
<main>
  <h1>Platform Features</h1>
  <section>
    <h2>Real-time Analytics</h2>
    <p>Track performance metrics in real-time with customizable dashboards and automated reporting for your team.</p>
  </section>
  <section>
    <h2>AI-Powered Insights</h2>
    <p>Leverage machine learning to uncover hidden patterns in your data and get actionable recommendations automatically.</p>
  </section>
  <section>
    <h2>Seamless Integrations</h2>
    <p>Connect with 100+ tools including Salesforce, HubSpot, Slack, and more via our robust API and pre-built connectors.</p>
  </section>
  <section>
    <h2>Enterprise Security</h2>
    <p>SOC 2 Type II certified with role-based access control, SSO, and encrypted data storage for enterprise compliance.</p>
  </section>
</main>
<footer><p>&copy; 2025 Acme Platform</p></footer>
</body>
</html>`,
  expectedScore: { overall: 60, metadata: 25, headings: 20, semantic: 10, schema: 0, faq: 0 },
};

export const USE_CASES_PAGE: TestFixture = {
  name: 'Use Cases Page',
  description: 'Use-case detail page',
  html: `<!DOCTYPE html>
<html lang="en">
<head>
  <title>Account Research Use Case - Acme Platform</title>
  <meta name="description" content="Learn how Acme helps with account research and prospecting.">
  <link rel="canonical" href="https://acme.com/use-cases/account-research">
  <meta property="og:title" content="Account Research - Acme">
  <meta name="twitter:card" content="summary">
</head>
<body>
<header><nav><a href="/">Home</a><a href="/use-cases">Use Cases</a></nav></header>
<main>
  <article>
    <h1>Account Research with Acme</h1>
    <p>Acme streamlines the account research process, enabling sales teams to identify and prioritize high-value prospects efficiently.</p>
    <section>
      <h2>The Challenge</h2>
      <p>Sales teams spend hours manually researching accounts across multiple databases and sources, leading to inconsistent data quality.</p>
    </section>
    <section>
      <h2>How Acme Solves It</h2>
      <p>Our AI-powered platform automatically enriches account data from 50+ sources, providing complete company profiles in seconds.</p>
    </section>
    <section>
      <h2>Results</h2>
      <p>Customers report 3x faster research time and 40% improvement in data accuracy after adopting Acme for account research.</p>
    </section>
  </article>
</main>
<footer><p>&copy; 2025 Acme Platform</p></footer>
</body>
</html>`,
  expectedScore: { overall: 55, metadata: 25, headings: 20, semantic: 10, schema: 0, faq: 0 },
};

export const SOLUTIONS_PAGE: TestFixture = {
  name: 'Solutions Page',
  description: 'Solution/service page',
  html: `<!DOCTYPE html>
<html lang="en">
<head>
  <title>Enterprise Solutions - Acme Platform</title>
  <meta name="description" content="Enterprise-grade solutions for scaling your business operations.">
  <link rel="canonical" href="https://acme.com/solutions/enterprise">
  <meta property="og:title" content="Enterprise Solutions">
  <meta name="twitter:card" content="summary">
</head>
<body>
<header><nav><a href="/">Home</a><a href="/solutions">Solutions</a></nav></header>
<main>
  <h1>Enterprise Solutions</h1>
  <section>
    <h2>Scalable Infrastructure</h2>
    <p>Built to handle millions of records with 99.9% uptime guarantee and automatic scaling for peak workloads.</p>
  </section>
  <section>
    <h2>Dedicated Support</h2>
    <p>Get a dedicated customer success manager and 24/7 priority support for your enterprise team.</p>
  </section>
  <section>
    <h2>Custom Integrations</h2>
    <p>Work with our engineering team to build custom integrations tailored to your specific workflow requirements.</p>
  </section>
</main>
<footer><p>&copy; 2025 Acme Platform</p></footer>
</body>
</html>`,
  expectedScore: { overall: 55, metadata: 25, headings: 20, semantic: 10, schema: 0, faq: 0 },
};

export const BLOG_INDEX_PAGE: TestFixture = {
  name: 'Blog Index Page',
  description: 'Blog listing page (CollectionPage)',
  html: `<!DOCTYPE html>
<html lang="en">
<head>
  <title>Blog - Acme Platform</title>
  <meta name="description" content="Latest news, tutorials, and insights from the Acme team.">
  <link rel="canonical" href="https://acme.com/blog">
  <meta property="og:title" content="Acme Blog">
  <meta name="twitter:card" content="summary">
</head>
<body>
<header><nav><a href="/">Home</a><a href="/blog">Blog</a></nav></header>
<main>
  <h1>Acme Blog</h1>
  <article>
    <h2>Introducing AI Lead Scoring</h2>
    <p>We're excited to announce our new AI-powered lead scoring feature that helps sales teams prioritize prospects.</p>
  </article>
  <article>
    <h2>How to Build Better Data Pipelines</h2>
    <p>A comprehensive guide to designing efficient data pipelines for modern SaaS applications.</p>
  </article>
  <article>
    <h2>Customer Spotlight: How TechCorp Uses Acme</h2>
    <p>Learn how TechCorp increased their outbound efficiency by 200% using Acme Platform.</p>
  </article>
</main>
<footer><p>&copy; 2025 Acme Platform</p></footer>
</body>
</html>`,
  expectedScore: { overall: 55, metadata: 25, headings: 20, semantic: 10, schema: 0, faq: 0 },
};

export const INTEGRATIONS_PAGE: TestFixture = {
  name: 'Integrations Page',
  description: 'Integration directory page',
  html: `<!DOCTYPE html>
<html lang="en">
<head>
  <title>Integrations - Acme Platform</title>
  <meta name="description" content="Connect Acme with your favorite tools. 100+ integrations available.">
  <link rel="canonical" href="https://acme.com/integrations">
  <meta property="og:title" content="Integrations - Acme">
  <meta property="og:description" content="Connect with 100+ tools.">
  <meta name="twitter:card" content="summary">
</head>
<body>
<header><nav><a href="/">Home</a><a href="/integrations">Integrations</a></nav></header>
<main>
  <h1>Integrations</h1>
  <section>
    <h2>CRM Integrations</h2>
    <p>Connect with Salesforce, HubSpot, and Pipedrive to sync your customer data automatically.</p>
  </section>
  <section>
    <h2>Communication Tools</h2>
    <p>Integrate with Slack, Microsoft Teams, and email to get real-time notifications and updates.</p>
  </section>
  <section>
    <h2>Data Sources</h2>
    <p>Pull data from LinkedIn, Clearbit, ZoomInfo, and 50+ other enrichment providers.</p>
  </section>
</main>
<footer><p>&copy; 2025 Acme Platform</p></footer>
</body>
</html>`,
  expectedScore: { overall: 60, metadata: 25, headings: 20, semantic: 10, schema: 0, faq: 0 },
};

export const GRAPH_SCHEMA_PAGE: TestFixture = {
  name: 'Graph Schema Page',
  description: 'Page using @graph wrapper with Organization + WebSite inside',
  html: `<!DOCTYPE html>
<html lang="en">
<head>
  <title>Acme Platform</title>
  <meta name="description" content="AI-powered data enrichment platform.">
  <link rel="canonical" href="https://acme.com/">
  <meta property="og:title" content="Acme Platform">
  <meta name="twitter:card" content="summary">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "name": "Acme Corp",
        "url": "https://acme.com"
      },
      {
        "@type": "WebSite",
        "name": "Acme Platform",
        "url": "https://acme.com"
      }
    ]
  }
  </script>
</head>
<body>
<header><nav><a href="/">Home</a></nav></header>
<main>
  <h1>Acme Platform</h1>
  <p>AI-powered data enrichment for modern sales teams. Automate your prospecting workflow.</p>
  <p>Join thousands of companies using Acme to close more deals faster with better data.</p>
  <p>Our platform processes millions of data points daily to keep your records fresh and accurate.</p>
</main>
<footer><p>&copy; 2025 Acme Corp</p></footer>
</body>
</html>`,
  expectedScore: { overall: 70, metadata: 25, headings: 10, semantic: 10, schema: 25, faq: 0 },
};

export const ARRAY_SCHEMA_PAGE: TestFixture = {
  name: 'Array Schema Page',
  description: 'Page with array-root JSON-LD [Organization, BreadcrumbList]',
  html: `<!DOCTYPE html>
<html lang="en">
<head>
  <title>About - Acme Platform</title>
  <meta name="description" content="Learn about Acme, the AI-powered platform.">
  <link rel="canonical" href="https://acme.com/about">
  <meta property="og:title" content="About Acme">
  <meta name="twitter:card" content="summary">
  <script type="application/ld+json">
  [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "Acme Corp",
      "url": "https://acme.com"
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://acme.com"},
        {"@type": "ListItem", "position": 2, "name": "About"}
      ]
    }
  ]
  </script>
</head>
<body>
<header><nav><a href="/">Home</a><a href="/about">About</a></nav></header>
<main>
  <h1>About Acme</h1>
  <p>Acme was founded in 2020 with a mission to democratize data enrichment through AI technology.</p>
  <p>Today we serve over 5,000 companies worldwide and process billions of data points monthly.</p>
  <p>Our team of 200+ engineers and data scientists is dedicated to building the future of sales intelligence.</p>
</main>
<footer><p>&copy; 2025 Acme Corp</p></footer>
</body>
</html>`,
  expectedScore: { overall: 75, metadata: 25, headings: 10, semantic: 10, schema: 25, faq: 0 },
};

export const ALL_FIXTURES: TestFixture[] = [
  PERFECT_PAGE,
  GOOD_PAGE,
  POOR_PAGE,
  MALFORMED_PAGE,
  EMPTY_PAGE,
  FAQ_HEAVY_PAGE,
  PRICING_PAGE,
  FEATURES_PAGE,
  USE_CASES_PAGE,
  SOLUTIONS_PAGE,
  BLOG_INDEX_PAGE,
  INTEGRATIONS_PAGE,
  GRAPH_SCHEMA_PAGE,
  ARRAY_SCHEMA_PAGE,
];
