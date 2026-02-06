# Technical Structure Improvement

In this implementation, we only cover the updated approach for scraping and scoring findings. We do not define logic for code injection yet. We are stating what to scrape, how to score, and how to identify what's missing and what's OK within the user's technical structure.

## Important Resources

- Structure Data Thesis
- DOM Tree
- Five Dimension Scoring

## Stack Used

1. https://www.firecrawl.dev/
2. https://developer.mozilla.org/en-US/docs/Web/API/DOMParser

---

## Context

To power the Technical Structure Score, enable issues within Mudra, and ensure the platform never runs out of technical structure implementations for the user, we will enhance the scraping system to:

- Discover all pages on the site (sitemap) (Previously only scraping one)
- Scrape each page
- Score its page technical structure
- Surface issues that deliver continuous value to the user, and, AFTER, enabling a one click fix for our agent that will be connected to the GitHub and execute the improvement. So that next time we re-scrape the technical Structure, that fix is resolved.

Single-page scraping creates a finite optimization ceiling—once the homepage is optimized, agents stall. Site-wide scraping multiplies optimizations by 10–20x, enabling ongoing improvements as new pages ship, existing pages update, and schema coverage expands domain-wide.

---

## High-Level Flow

**Identifying → Scraping → Scoring → Rendering**

1. Policy file detection at domain root
2. Sitemap discovery and page URL extraction (Only 20 pages for now)
3. Per-page HTML extraction via Firecrawl
4. Snapshot storage in the database (versioned per page)
5. DOM extraction via DOMParser from each HTML string
6. Per-page scoring via Multi-Dimensional Scoring for AEO
7. Global Technical Structure Score computation and rendering in front end

---

## Detailed Flow & Requirements

### 1. Policy File Detection

**Goal:** Understand the technical baseline and crawl directives at the root level.

- Check for existence of `/robots.txt`, `/sitemap.xml`, `/llms.txt` at domain root.

### 2. Sitemap.xml

**Goal:** Get the full list of pages we care about.

- All Pages: Main Page, Features, Product/Service Page, Solutions, Blog (Blogs), Pricing, Use Cases

### 3. FireCrawl Per Page HTML Extraction

**Goal:** Capture the full HTML for each page so we can analyze, improve, and compare over time.

- Scrape Full HTML Content/Page within Sitemap.xml

### 4. Save Full Per HTML Snapshot in Database

Each scrape creates a versioned snapshot for that page.

- Multiple snapshots over time per `page_url` (to track changes)
- Only one snapshot per page is "current" for scoring

This layer is what lets us say "your score changed because your x Agent pushed X to this page".

### 5. Pass Full HTML String to DOMParser API and Extract All the DOM

**Goal:** Avoid scanning HTML manually. Instead, we convert HTML into a structured, queryable DOM and only capture the elements we care about for Answer Engine Optimization.

- All meta tags (title, description, og:tags, twitter:cards, `link rel="canonical" href`)
- Complete heading hierarchy Structure (H1-H6 with text content and DOM position)
- Semantic HTML Tags: Map the semantic element structure: count instances of `<article>`, `<section>`, `<nav>`, `<aside>`, `<header>`, `<footer>`. Identify heading hierarchy violations (multiple H1s, skipped levels). Extract content from `<article>` elements as primary citation candidates.
- Schema: JSON-LD Blocks - Extract All JSON-LD per page if present. (Organization, WebSite, Product, Service, Article, BlogPosting, FAQPage, BreadcrumbList, HowTo, SoftwareApplication)
- FAQs - FAQ Schema (FAQ Content Discovery - Extract FAQs from three sources: JSON-LD FAQ Schema, HTML `<details>`/`<summary>` elements, and pattern matching for Q:/A: text patterns. Deduplicate across sources and count total FAQ items per page. Extract question text, answer text, and character counts.)

### 6. Score Each Page Using Four-Dimensional Scoring

### 7. Compute Overall Technical Structure Score and Render Frontend in the Overview Metric Technical Structure Score

---

## DOM Parser

### What is DOM, Why We Need It, What to Capture?

Once we scrape multiple pages within the company website of the user, in order to accurately and effectively score them without needing to scan the whole HTML, element by element, we will use https://developer.mozilla.org/en-US/docs/Web/API/DOMParser so that we can only capture the Document Object Model (DOM) of each page, capturing only the fields we want to know if they are present within each page scraped, ensuring we can always score and capture more pages at scale.

Crawling the website starts with Firecrawl, which returns HTML for each page. We then run DOM analysis with DOMParsers API on every page to extract and score all the AEO factors; Structured data presence, semantic HTML quality, metadata completeness, FAQ readiness, etc.

This creates a comprehensive audit showing exactly what's missing across the entire site of our users. We build a precise "gap analysis" that says things like: "Homepage missing Organization schema," "All blog posts lack Article schema," "Product pages have no FAQ sections," and "Landing pages missing breadcrumb markup."

For this implementation we will call the API of DOMParser - DOMParser is a native browser API that converts the HTML strings into queryable DOM Documents.

**WE WILL CAPTURE DOM IN CHEERIO-NODE JS.** - Because of NextJS

### What We Capture

- Meta tags (title, description, og:tags, twitter:cards, `link rel="canonical" href`)
- Complete heading hierarchy Structure (H1-H6 with text content and DOM position)
- Semantic HTML Tags: Map the semantic element structure: count instances of `<article>`, `<section>`, `<nav>`, `<aside>`, `<header>`, `<footer>`. Identify heading hierarchy violations (multiple H1s, skipped levels). Extract content from `<article>` elements as primary citation candidates. Flag div-heavy pages lacking semantic structure.
- Schema: JSON-LD Blocks Organization, WebSite, Product, Service, Article, BlogPosting, FAQPage, BreadcrumbList, HowTo, SoftwareApplication.
- FAQs - FAQ Schema (FAQ Content Discovery - Extract FAQs from three sources: JSON-LD FAQ Schema, HTML `<details>`/`<summary>` elements, and pattern matching for Q:/A: text patterns. Deduplicate across sources and count total FAQ items per page. Extract question text, answer text, and character counts.)

### Output Per Page Example

```json
{
  "page_url": "https://example.com/blog/guide-to-seo",
  "page_type": "blog",
  "crawled_at": "2025-01-15T14:30:00Z",
  "snapshot_id": "snap_abc123xyz",
  
  "extraction": {
    
    "metadata": {
      "title": {
        "present": true,
        "content": "Complete Guide to SEO in 2025 | Example Blog",
        "length": 44
      },
      "meta_description": {
        "present": true,
        "content": "Learn everything about SEO with our comprehensive 2025 guide. Covering technical SEO, content optimization, and link building strategies.",
        "length": 142
      },
      "canonical": {
        "present": true,
        "href": "https://example.com/blog/guide-to-seo"
      },
      "open_graph": {
        "present": true,
        "tags": [
          {
            "property": "og:title",
            "content": "Complete Guide to SEO in 2025"
          },
          {
            "property": "og:description",
            "content": "Learn everything about SEO with our comprehensive 2025 guide."
          },
          {
            "property": "og:image",
            "content": "https://example.com/images/seo-guide.jpg"
          },
          {
            "property": "og:url",
            "content": "https://example.com/blog/guide-to-seo"
          },
          {
            "property": "og:type",
            "content": "article"
          }
        ],
        "count": 5
      },
      "twitter_cards": {
        "present": true,
        "tags": [
          {
            "name": "twitter:card",
            "content": "summary_large_image"
          },
          {
            "name": "twitter:title",
            "content": "Complete Guide to SEO in 2025"
          },
          {
            "name": "twitter:description",
            "content": "Learn everything about SEO with our comprehensive guide."
          },
          {
            "name": "twitter:image",
            "content": "https://example.com/images/seo-guide.jpg"
          }
        ],
        "count": 4
      },
      "other_meta": [
        {
          "name": "author",
          "content": "John Smith"
        },
        {
          "name": "robots",
          "content": "index, follow"
        },
        {
          "name": "viewport",
          "content": "width=device-width, initial-scale=1.0"
        }
      ]
    },

    "headings": {
      "hierarchy": [
        {
          "level": 1,
          "tag": "h1",
          "text": "Complete Guide to SEO in 2025",
          "text_length": 30,
          "dom_position": "body > main > article > header > h1",
          "index": 0
        },
        {
          "level": 2,
          "tag": "h2",
          "text": "What is SEO?",
          "text_length": 12,
          "dom_position": "body > main > article > section:nth-child(1) > h2",
          "index": 1
        },
        {
          "level": 3,
          "tag": "h3",
          "text": "Technical SEO Fundamentals",
          "text_length": 26,
          "dom_position": "body > main > article > section:nth-child(1) > div > h3",
          "index": 2
        },
        {
          "level": 3,
          "tag": "h3",
          "text": "On-Page SEO Best Practices",
          "text_length": 26,
          "dom_position": "body > main > article > section:nth-child(1) > div > h3",
          "index": 3
        },
        {
          "level": 2,
          "tag": "h2",
          "text": "Why SEO Matters in 2025",
          "text_length": 23,
          "dom_position": "body > main > article > section:nth-child(2) > h2",
          "index": 4
        },
        {
          "level": 2,
          "tag": "h2",
          "text": "How to Get Started with SEO",
          "text_length": 27,
          "dom_position": "body > main > article > section:nth-child(3) > h2",
          "index": 5
        }
      ],
      "counts": {
        "h1": 1,
        "h2": 3,
        "h3": 2,
        "h4": 0,
        "h5": 0,
        "h6": 0,
        "total": 6
      },
      "analysis": {
        "has_h1": true,
        "h1_count": 1,
        "h1_is_unique": true,
        "has_h2": true,
        "has_h3": true,
        "max_depth": 3,
        "skipped_levels": [],
        "violations": []
      }
    },

    "semantic_html": {
      "elements": {
        "article": {
          "count": 1,
          "instances": [
            {
              "index": 0,
              "text_length": 4523,
              "child_count": 8,
              "dom_position": "body > main > article",
              "has_header": true,
              "has_footer": true
            }
          ]
        },
        "section": {
          "count": 4,
          "instances": [
            {
              "index": 0,
              "text_length": 892,
              "child_count": 5,
              "dom_position": "body > main > article > section:nth-child(1)"
            },
            {
              "index": 1,
              "text_length": 1240,
              "child_count": 3,
              "dom_position": "body > main > article > section:nth-child(2)"
            },
            {
              "index": 2,
              "text_length": 1580,
              "child_count": 6,
              "dom_position": "body > main > article > section:nth-child(3)"
            },
            {
              "index": 3,
              "text_length": 680,
              "child_count": 4,
              "dom_position": "body > main > article > section:nth-child(4)"
            }
          ]
        },
        "nav": {
          "count": 2,
          "instances": [
            {
              "index": 0,
              "dom_position": "body > header > nav",
              "type": "primary"
            },
            {
              "index": 1,
              "dom_position": "body > aside > nav",
              "type": "secondary"
            }
          ]
        },
        "aside": {
          "count": 1,
          "instances": [
            {
              "index": 0,
              "dom_position": "body > aside",
              "text_length": 320
            }
          ]
        },
        "header": {
          "count": 2,
          "instances": [
            {
              "index": 0,
              "dom_position": "body > header",
              "type": "page_header"
            },
            {
              "index": 1,
              "dom_position": "body > main > article > header",
              "type": "article_header"
            }
          ]
        },
        "footer": {
          "count": 2,
          "instances": [
            {
              "index": 0,
              "dom_position": "body > main > article > footer",
              "type": "article_footer"
            },
            {
              "index": 1,
              "dom_position": "body > footer",
              "type": "page_footer"
            }
          ]
        },
        "main": {
          "count": 1,
          "instances": [
            {
              "index": 0,
              "dom_position": "body > main",
              "text_length": 5240
            }
          ]
        }
      },
      "div_count": 47,
      "semantic_element_count": 11,
      "semantic_richness_ratio": 0.234,
      "analysis": {
        "has_main": true,
        "has_article": true,
        "has_sections": true,
        "has_nav": true,
        "is_div_heavy": false,
        "semantic_quality": "good"
      }
    },

    "schema": {
      "jsonld_blocks": [
        {
          "index": 0,
          "type": "Article",
          "valid": true,
          "dom_position": "head > script:nth-of-type(3)",
          "data": {
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": "Complete Guide to SEO in 2025",
            "description": "Learn everything about SEO with our comprehensive 2025 guide.",
            "image": "https://example.com/images/seo-guide.jpg",
            "datePublished": "2025-01-10T08:00:00Z",
            "dateModified": "2025-01-15T10:30:00Z",
            "author": {
              "@type": "Person",
              "name": "John Smith",
              "url": "https://example.com/author/john-smith"
            },
            "publisher": {
              "@type": "Organization",
              "name": "Example Blog",
              "logo": {
                "@type": "ImageObject",
                "url": "https://example.com/logo.png"
              }
            }
          },
          "completeness": {
            "required_fields": ["headline", "datePublished", "author", "publisher"],
            "present_fields": ["headline", "description", "image", "datePublished", "dateModified", "author", "publisher"],
            "missing_fields": [],
            "completeness_percentage": 100
          }
        },
        {
          "index": 1,
          "type": "BreadcrumbList",
          "valid": true,
          "dom_position": "head > script:nth-of-type(4)",
          "data": {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
              {
                "@type": "ListItem",
                "position": 1,
                "name": "Home",
                "item": "https://example.com"
              },
              {
                "@type": "ListItem",
                "position": 2,
                "name": "Blog",
                "item": "https://example.com/blog"
              },
              {
                "@type": "ListItem",
                "position": 3,
                "name": "SEO Guide",
                "item": "https://example.com/blog/guide-to-seo"
              }
            ]
          }
        }
      ],
      "schema_types": ["Article", "BreadcrumbList"],
      "schema_count": 2,
      "has_schema": true,
      "analysis": {
        "has_article_schema": true,
        "has_faq_schema": false,
        "has_howto_schema": false,
        "has_product_schema": false,
        "has_breadcrumb_schema": true,
        "has_organization_schema": false,
        "has_software_application_schema": false,
        "has_website_schema": false,
        "has_service_schema": false,
        "has_blogPosting_schema": false
      }
    },

    "faqs": {
      "sources": {
        "jsonld_faq_schema": {
          "present": false,
          "faqs": []
        },
        "details_summary_elements": {
          "present": true,
          "faqs": [
            {
              "index": 0,
              "question": "What is the difference between on-page and off-page SEO?",
              "question_length": 58,
              "answer": "On-page SEO refers to optimizations you make directly on your website pages, such as content quality, keywords, meta tags, and internal linking. Off-page SEO involves external factors like backlinks, social signals, and brand mentions across the web.",
              "answer_length": 258,
              "dom_position": "body > main > article > section:nth-child(4) > details:nth-child(1)"
            },
            {
              "index": 1,
              "question": "How long does it take to see SEO results?",
              "question_length": 45,
              "answer": "SEO is a long-term strategy. Typically, you'll start seeing measurable results within 3-6 months for less competitive keywords, while more competitive terms may take 6-12 months or longer. Consistency and quality are key to sustainable results.",
              "answer_length": 248,
              "dom_position": "body > main > article > section:nth-child(4) > details:nth-child(2)"
            },
            {
              "index": 2,
              "question": "Do I need to hire an SEO agency or can I do it myself?",
              "question_length": 61,
              "answer": "It depends on your resources and expertise. Basic SEO can be done yourself with proper learning and tools. However, for competitive industries or if you lack time, hiring an experienced SEO professional or agency can provide faster, more effective results.",
              "answer_length": 272,
              "dom_position": "body > main > article > section:nth-child(4) > details:nth-child(3)"
            }
          ],
          "count": 3
        },
        "pattern_matching": {
          "present": false,
          "faqs": []
        }
      },
      "combined_faqs": [
        {
          "source": "details_summary",
          "question": "What is the difference between on-page and off-page SEO?",
          "answer": "On-page SEO refers to optimizations you make directly on your website pages, such as content quality, keywords, meta tags, and internal linking. Off-page SEO involves external factors like backlinks, social signals, and brand mentions across the web.",
          "question_length": 58,
          "answer_length": 258
        },
        {
          "source": "details_summary",
          "question": "How long does it take to see SEO results?",
          "answer": "SEO is a long-term strategy. Typically, you'll start seeing measurable results within 3-6 months for less competitive keywords, while more competitive terms may take 6-12 months or longer. Consistency and quality are key to sustainable results.",
          "question_length": 45,
          "answer_length": 248
        },
        {
          "source": "details_summary",
          "question": "Do I need to hire an SEO agency or can I do it myself?",
          "answer": "It depends on your resources and expertise. Basic SEO can be done yourself with proper learning and tools. However, for competitive industries or if you lack time, hiring an experienced SEO professional or agency can provide faster, more effective results.",
          "question_length": 61,
          "answer_length": 272
        }
      ],
      "total_faq_count": 3,
      "has_faq_content": true,
      "has_faq_schema": false,
      "has_details_summary": true,
      "analysis": {
        "faq_content_exists": true,
        "faq_schema_implemented": false,
        "uses_semantic_html": true,
        "average_answer_length": 259,
        "schema_gap": true
      }
    },

    "content_snapshot": {
      "total_text_length": 5240,
      "word_count": 982,
      "paragraph_count": 24,
      "list_count": 6,
      "image_count": 4,
      "link_count": {
        "internal": 12,
        "external": 8
      },
      "content_density": "medium",
      "readability_estimate": "moderate"
    }
  },

  "raw_html_hash": "sha256:a3f8d9e7c2b1f4e6...",
  "html_size_bytes": 45320
}
```

### Requirements

- DOM extraction should be deterministic (same input → same JSON)
- All extracted data must be stored in structured JSON fields

---

## Four-Dimension Scoring

> **Updated Feb 2026:** Restructured from 5 to 4 dimensions. Headings (20pts) and Semantic HTML (15pts) removed — users on Webflow/Shopify/WordPress often can't control these without breaking their frontend. Content (10pts) added. Schema reweighted to 40pts. 6 new schema types added: WebApplication, OfferCatalog, VideoObject, ItemList, Review, Person.

Once we have the accurate findings from the DOM extraction, displaying if/not present, we will then proceed and score findings. Here, we outline the correct method to score each page and compute the overall Technical Structure Score. Each page will be scored individually, then we'll calculate the average across all pages to ensure simplicity and scalability.

### Complete Per-Page Score Weights

```javascript
page_score = schema_score (0-40) + metadata_score (0-30) + faq_score (0-20) + content_score (0-10) = 0-100 total
```

### Site-Wide Technical Structure Score

```
site_score = average(all page scores)
```

---

## 1. Schema / JSON-LD Score (40 points)

### What We Check

| Check | Points | Criteria |
|-------|--------|----------|
| J1 - JSON-LD present | 10 | At least one `<script type="application/ld+json">` exists |
| J2 - Valid structure | 8 | JSON parses successfully. Contains `@context` AND `@type` |
| J3 - Relevant schema type | 11 | `@type` is AEO-relevant (Organization, WebSite, Product, Service, Article, BlogPosting, FAQPage, BreadcrumbList, HowTo, SoftwareApplication, CollectionPage, WebApplication, OfferCatalog, VideoObject, ItemList, Review, Person) |
| J4 - Schema coverage | 11 | All recommended schemas for page type are present |

**Scoring:** `schema_score = sum of passed checks (max 40)`

### Issue/Agent Interventions

- `J1 false` → Inject appropriate JSON-LD schema block into `<head>`
- `J2 false` → Fix JSON syntax errors in existing schema
- `J3 false` → Replace generic schema with page-type-specific schema
- `J4 false` → Add missing recommended schemas for page type:
  - Homepage → Organization + WebSite
  - Blog posts → BlogPosting + Person
  - Products → Product
  - Pricing → Product + OfferCatalog
  - FAQ pages → FAQPage

---

## 2. Metadata Score (30 points)

### What We Check

| Check | Points | Criteria |
|-------|--------|----------|
| M1 - Title tag present | 8 | `<title>` exists and is non-empty |
| M2 - Meta description present | 8 | `<meta name="description">` exists and is non-empty |
| M3 - Canonical URL present | 6 | `<link rel="canonical">` exists with href |
| M4 - Open Graph present | 4 | At least `og:title` OR `og:description` exists |
| M5 - Twitter Cards present | 4 | At least `twitter:card` OR `twitter:title` exists |

**Scoring:** `metadata_score = sum of passed checks (max 30)`

### Issue/Agent Interventions

- `M1 false` → Inject `<title>{page_topic}</title>` into `<head>`
- `M2 false` → Inject `<meta name="description" content="{summary}">` into `<head>`
- `M3 false` → Inject `<link rel="canonical" href="{current_url}">` into `<head>`
- `M4 false` → Inject Open Graph meta tags into `<head>`
- `M5 false` → Inject Twitter Card meta tags into `<head>`

---

## 3. FAQ Score (20 points)

### What We Check

FAQ scoring uses simple linear scale:

```
faq_items = count of unique (question, answer) pairs found via:
  - JSON-LD FAQPage schema
  - <details>/<summary> elements
  - Q:/A: text patterns

faq_score = min(faq_items × 5, 20)
```

**Examples:**
- 0 FAQs → 0 points
- 1 FAQ → 5 points
- 2 FAQs → 10 points
- 3 FAQs → 15 points
- 4+ FAQs → 20 points (capped)

**Scoring:** `faq_score = min(faq_items × 5, 20)`

Only scored for relevant page types: home, pricing, features, product, solutions, blog. Non-FAQ pages (about, contact, docs) get 0/0 and the score normalizes.

### Issue/Agent Interventions

- `faq_items = 0` → Generate FAQ section with 4+ Q&As + inject FAQPage schema
- `faq_items = 1-3` → Expand existing FAQs to at least 4 items
- `FAQ content exists BUT no schema` → Inject FAQPage JSON-LD for existing Q&As
- `Has <details> but no schema` → Add FAQPage schema matching the `<details>` content

---

## 4. Content Score (10 points)

### What We Check

| Check | Points | Criteria |
|-------|--------|----------|
| C1 - Word count | 5 | Page has 300+ words of content |
| C2 - Paragraph structure | 5 | Page has 3+ paragraphs (`<p>` elements) |

**Scoring:** `content_score = sum of passed checks (max 10)`

### Issue/Agent Interventions

- `C1 false` → Add substantive content to reach 300+ words
- `C2 false` → Break content into 3+ well-structured paragraphs

---

## Scoring Output Example

```json
{
  "page_url": "https://example.com/blog/post",
  "page_type": "blog",
  "crawled_at": "2026-02-05T10:30:00Z",

  "scores": {
    "schema": 29,
    "metadata": 22,
    "faq": 0,
    "content": 10,
    "total": 61,
    "status": "good"
  },

  "dimension_details": {
    "schema": {
      "J1_present": { "passed": true, "points": 10 },
      "J2_valid": { "passed": true, "points": 8 },
      "J3_relevant": { "passed": true, "points": 11 },
      "J4_coverage": { "passed": false, "points": 0, "rationale": "Missing: Person" }
    },
    "metadata": {
      "M1_title": { "passed": true, "points": 8 },
      "M2_description": { "passed": true, "points": 8 },
      "M3_canonical": { "passed": false, "points": 0 },
      "M4_opengraph": { "passed": true, "points": 4 },
      "M5_twitter": { "passed": false, "points": 0 }
    },
    "faq": { "FAQ_count": { "passed": false, "points": 0 } },
    "content": {
      "C1_word_count": { "passed": true, "points": 5 },
      "C2_paragraph_structure": { "passed": true, "points": 5 }
    }
  },

  "interventions": [
    {
      "check": "J4_coverage",
      "priority": "medium",
      "action": "inject_jsonld_schema",
      "estimated_impact": "+11 points"
    },
    {
      "check": "M3_canonical",
      "priority": "medium",
      "action": "inject_canonical_tag",
      "estimated_impact": "+6 points"
    },
    {
      "check": "M5_twitter",
      "priority": "low",
      "action": "inject_twitter_cards",
      "estimated_impact": "+4 points"
    },
    {
      "check": "FAQ_count",
      "priority": "high",
      "action": "generate_faq_section",
      "estimated_impact": "+20 points"
    }
  ]
}
```

---

## Structured Data Thesis

### Metadata

Metadata is the "entry point" for AI systems. Before a model ever reads paragraphs, crawlers look at the title, description, canonical URL, and Open Graph data to decide **what this page is about**, **which entity it represents**, and **when it should be a candidate answer**.

For Answer Engine Optimization strong metadata is how we tell models:

- "This page is *about* AI Visibility Infrastructure for B2B SaaS."
- "This is the canonical URL you should associate with that topic."
- "Here's the short, clean summary you can safely reuse in an answer."

When metadata is missing, generic, or misaligned with the actual content, AI search systems either **don't surface the brand at all** or treat the brand as a weak candidate compared to a competitor with clearer signals. Good metadata makes it cheaper and safer for AI models to retrieve, summarize, and cite a page instead of guessing.

#### How to Implement It Accurately

**Always have a unique `<title>` tag**

- 45–65 characters, human-readable, not keyword stuffing.
- Include: core topic + brand when useful.
- Example:

```html
<title>Engineering Background Agents for B2B SaaS | Acme Corp</title>
```

---

### Heading Hierarchy

AI systems use heading hierarchy to understand document structure and extract relevant sections for answers. Poor hierarchy confuses parsing and reduces citation likelihood.

When AI encounters proper H1→H2→H3 structure, it can accurately extract specific sections to answer queries. Broken hierarchy (like jumping from H1 to H4) makes content unscannable and reduces your chances of being cited by 60-70%.

**Example:**

- Find the "How it works" section when the question is procedural.
- Jump to "Pricing" when the query is commercial.
- Extract a specific explanation ("Why structured data matters") instead of the whole page.

#### How to Implement It Accurately

**One H1 per page**

- This is your page title/main topic
- Should match or closely align with your title tag
- Example: `<h1>Enterprise Financial Planning Solutions</h1>`

**H2s for major sections**

- Each major topic gets an H2
- Should be descriptive and keyword-rich
- Example, like chapters of content page, questions, etc:

```html
<h2>How AI Models Read Your Website</h2>
<h2>What Answer Engine Optimization Changes</h2>
<h2>How Mudra Automates the Technical Work</h2>
```

**Use `<h3>` and below for subsections**

- Never skip from H1 to H3
- Each H3 must belong to an H2
- Example:

```html
<h2>How AI Models Read Your Website</h2>
  <h3>Structured vs Unstructured Content</h3>
  <h3>Why llms.txt and Schema Matter</h3>
```

**H4-H6 for deeper nesting**

- Use sparingly
- Maintain logical flow
- Most pages shouldn't need beyond H3

**Anti-patterns to avoid:**

- Multiple H1s on one page
- Skipping heading levels (H2 to H4)
- Using headings for styling instead of structure
- Non-descriptive headings like "Learn More" or "Details"

#### Ultimate Example

```html
<h1>Mudra Enterprise: AI-Powered Financial Workflow Platform</h1>

<h2>What is Mudra Enterprise?</h2>
<p>Description content...</p>

<h2>Core Features</h2>
  <h3>Automated Financial Reporting</h3>
  <p>Feature description...</p>
  
  <h3>Real-Time Budget Tracking</h3>
  <p>Feature description...</p>
  
  <h3>AI-Powered Forecasting</h3>
    <h4>Short-Term Forecasting</h4>
    <h4>Long-Term Strategic Planning</h4>

<h2>Integration Options</h2>
  <h3>ERP Systems</h3>
  <h3>Accounting Software</h3>
  <h3>Business Intelligence Tools</h3>
```

---

### Semantic HTML5 Structure

Semantic HTML5 is how you tell machines, "this is the main article, this is navigation, this is a sidebar, this is the footer." AI crawlers and content extractors rely heavily on these landmarks to strip away noise (nav, CTAs, footers) and focus on the **primary content** that should power answers.

#### How to Implement It Accurately (Use Semantic Containers for Every Page)

**Wrap the core content in `<main>`**

```html
<body>
  <header>...</header>
  <nav>...</nav>
  <main>
    <!-- primary content about the page's main topic -->
  </main>
  <footer>...</footer>
</body>
```

**Use `<article>` for standalone pieces of content**

- Blog posts, docs, product detail pages, case studies.

```html
<main>
  <article>
    <header>
      <h1>AI Visibility Infrastructure for B2B SaaS</h1>
      <p>Updated: <time datetime="2025-11-10">November 10, 2025</time></p>
    </header>
    <section>
      <h2>Why AI Search Needs a New Layer</h2>
      <p>...</p>
    </section>
  </article>
</main>
```

#### Key Semantic Elements

**`<main>` - Use once per page**

- Contains the primary content
- Everything else is supporting material
- AI prioritizes content within `<main>`

**`<article>` - For standalone content**

- Blog posts
- Product descriptions
- Case studies
- News articles
- Any content that could be distributed independently

**`<section>` - For thematic groupings**

- Major content blocks within an article
- Feature lists
- Benefit sections
- Each section should have a heading (H2-H6)

**`<aside>` - For tangential content**

- Sidebars
- Related links
- Call-out boxes
- Content related but not essential to main content

**`<nav>` - For navigation blocks**

- Main site navigation
- Table of contents
- Pagination
- Breadcrumbs

**`<header>` and `<footer>`**

#### Anti-patterns to Avoid

- Using `<div>` for everything
- Multiple `<main>` elements
- Nesting `<article>` inside `<section>` incorrectly
- Empty semantic elements
- Using semantic tags for styling only

---

### Schema Markup

Schema is the gold standard for AI readable content. It explicitly defines entities, relationships, and metadata that AI systems can confidently cite and reference. Without schema, AI must interpret your content from HTML and text alone, with schema, you're providing a structured data layer that tells AI exactly what everything means. Pages with proper schema markup are 40% more likely to be cited by AI engines.

#### How to Implement It Accurately

- **Organization**: https://schema.org/Organization
- **WebSite**: https://schema.org/WebSite
- **Product**: https://schema.org/Product
- **Service**: https://schema.org/Service
- **Article**: https://schema.org/Article
- **BlogPosting**: https://schema.org/BlogPosting
- **FAQPage**: https://schema.org/FAQPage
- **BreadcrumbList**: https://schema.org/BreadcrumbList
- **HowTo**: https://schema.org/HowTo
- **SoftwareApplication**: https://schema.org/SoftwareApplication

---

### FAQ

FAQs are the closest natural format to how users actually talk to AI: **short, explicit questions and direct answers.** When a page has well-structured FAQs, it's essentially pre-building the exact Q&A pairs that generative engines want to retrieve and reuse.

**What do they do:**

- They give models **ready-made answer snippets** that can be dropped into an AI response with minimal rewriting.
- They capture **long-tail, intent-rich questions** ("How does Mudra help me rank in AI search?") that generic content often misses.

#### How to Implement It Accurately

**Write FAQs as standalone Q&A units**

- Each question should make sense without prior context.
  - Good: "How does Mudra help my startup rank in AI search?"
  - Bad: "How does it work?"
- Answers should be direct in the first 1–2 sentences, then expand if needed.

```html
<section aria-labelledby="faq-heading">
  <h2 id="faq-heading">FAQ</h2>

  <article>
    <h3>How does Mudra help my startup rank in AI search?</h3>
    <p>Mudra fixes your structured data, llms.txt files, and technical signals so AI models can understand, trust, and cite your website inside AI answers.</p>
  </article>

  <article>
    <h3>Do I need to change my existing content?</h3>
    <p>Not necessarily. Mudra focuses first on the technical layer—schema, policy files, and structure—and then suggests content improvements only where needed.</p>
  </article>
</section>
```

**JSON-LD FAQ Schema (recommended - add to `<head>` or end of `<body>`):**

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "How does Mudra help my startup rank in AI search?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Mudra fixes your structured data, llms.txt files, and technical signals so AI models can understand, trust, and cite your website inside AI answers."
      }
    },
    {
      "@type": "Question",
      "name": "Do I need to change my existing content?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Not necessarily. Mudra focuses first on the technical layer—schema, policy files, and structure—and then suggests content improvements only where needed."
      }
    }
  ]
}
</script>
```

#### FAQ Content Best Practices

**Question format**

- Write questions as users would ask them
- Use natural language, not corporate speak
- Include relevant keywords naturally
- Examples:
  - ✅ "How much does Mudra cost?"
  - ✅ "What integrations does Mudra support?"
  - ❌ "Regarding pricing information"
  - ❌ "Integration capabilities"

**Answer format**

- First sentence should directly answer the question
- Follow with 1-2 sentences of supporting detail
- Keep answers to 2-4 sentences (40-100 words)
- Be specific with numbers, names, timeframes
- Avoid vague language like "various options" or "multiple features"

#### Example of Strong vs Weak FAQ Pairs

**Strong:**

- Q: "How long does Mudra implementation take?"
- A: "Most clients complete Mudra implementation in 2-4 weeks. This includes initial setup, data migration, team training, and integration with existing systems. Enterprise customers with complex requirements may take 6-8 weeks."

**Weak:**

- Q: "Implementation timeframe?"
- A: "Implementation time varies depending on your needs and organizational complexity. Contact us to learn more."

#### FAQ Topics

1. Products basics
2. Pricing & Plans
3. Technical
4. Implementation
5. Security and Compliance
6. Comparison