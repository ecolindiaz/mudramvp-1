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

export const ALL_FIXTURES: TestFixture[] = [
  PERFECT_PAGE,
  GOOD_PAGE,
  POOR_PAGE,
  MALFORMED_PAGE,
  EMPTY_PAGE,
  FAQ_HEAVY_PAGE,
];
