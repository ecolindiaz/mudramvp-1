# Schema Markup Knowledge Base — JSON-LD Injection Reference

> **GROUNDING RULE**: Only generate schema properties for data that **actually exists on the page**.
> Never fabricate URLs, ratings, prices, dates, authors, or any other property values.
> If a property's value cannot be determined from the page content, **omit it**.

## Quick Decision Tree

```
Homepage?
├── YES → Organization + WebSite (always both)
└── NO → Continue below

Blog/article page?
├── YES → Article or BlogPosting + BreadcrumbList + Person (author)
└── NO → Continue

Product page (purchasable item)?
├── YES → Product (with Offer) + BreadcrumbList
└── NO → Continue

Service/solutions page?
├── YES → Service + BreadcrumbList
└── NO → Continue

Pricing page with multiple tiers?
├── SaaS/software? → SoftwareApplication + OfferCatalog (nested via offers) + BreadcrumbList
├── Physical goods/e-commerce? → Product + OfferCatalog (nested via offers) + BreadcrumbList
└── NO → Continue

SaaS/web tool (interactive, browser-based)?
├── YES → WebApplication + BreadcrumbList
└── NO → Continue

Downloadable/installable app?
├── YES → SoftwareApplication + BreadcrumbList
└── NO → Continue

Page has on-page FAQ section?
├── YES → Add FAQPage alongside primary type
└── NO → Continue

Page is a step-by-step guide/tutorial?
├── YES → HowTo + BreadcrumbList
└── NO → Continue

Page has embedded video?
├── YES → Add VideoObject alongside primary type
└── NO → Continue

Page has customer testimonials?
├── YES → Add Review(s) alongside primary type
└── NO → Continue

Page is a listing/index (blog index, category, directory)?
├── YES → CollectionPage + ItemList + BreadcrumbList
└── NO → Continue

About page (/about, /company, /team)?
├── YES → AboutPage + Organization + Person + BreadcrumbList
└── NO → Continue

Page is a team/about page with people profiles?
├── YES → ProfilePage + Person
└── NO → Use BreadcrumbList at minimum
```

## Universal Rules

1. **Always use JSON-LD** format: `<script type="application/ld+json">`
2. **Always include** `"@context": "https://schema.org"` and `"@type"`
3. **Use ISO 8601** for dates: `YYYY-MM-DD` or `YYYY-MM-DDTHH:MM:SS+HH:MM`
4. **Use ISO 4217** for currency: `USD`, `EUR`, etc.
5. **Use ISO 8601 durations**: `PT30M` (30 min), `PT1H` (1 hour), `P1D` (1 day)
6. **Prefer structured objects** over plain text (e.g., `{"@type":"Person","name":"..."}` not `"author":"John"`)
7. **Multiple JSON-LD blocks** on one page are valid
8. **Use `@id`** to cross-reference entities across blocks on the same page
9. **Markup must reflect visible content** — hidden/misleading markup violates Google guidelines
10. **One primary entity per page** + supporting types (BreadcrumbList, Organization)

---

## 1. Organization

**Hierarchy**: `Thing > Organization`
**When**: Homepage (required), About page (optional). Never on every page.
**Google Rich Result**: Knowledge Panel, Logo, Social Links, Corporate Contacts

### Google Required
| Property | Type | Notes |
|---|---|---|
| `name` | Text | Organization name |
| `url` | URL | Official homepage URL |

### Google Recommended
| Property | Type | Notes |
|---|---|---|
| `logo` | URL | Min 112x112px, JPG/PNG/SVG/WebP, crawlable URL (not data URI) |
| `description` | Text | Short company description |
| `sameAs` | URL[] | Official social profiles: Facebook, Twitter/X, LinkedIn, Instagram, YouTube, Wikipedia |
| `contactPoint` | ContactPoint | `contactType` must be: "customer service", "technical support", "billing support", "sales", etc. |
| `address` | PostalAddress | `streetAddress`, `addressLocality`, `addressRegion`, `postalCode`, `addressCountry` |
| `email` | Text | Contact email |
| `foundingDate` | Date | ISO 8601 |
| `alternateName` | Text | Abbreviations or alternative names |

### Optional (Useful)
`legalName`, `numberOfEmployees`, `areaServed`, `parentOrganization`, `subOrganization`, `taxID`, `hasOfferCatalog`, `hasMerchantReturnPolicy`

### JSON-LD Example
```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Example Corp",
  "url": "https://www.example.com",
  "logo": "https://www.example.com/logo.png",
  "description": "Example Corp provides enterprise solutions.",
  "foundingDate": "2020-03-15",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "123 Main St",
    "addressLocality": "San Francisco",
    "addressRegion": "CA",
    "postalCode": "94105",
    "addressCountry": "US"
  },
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "+1-800-555-0123",
    "contactType": "customer service",
    "availableLanguage": ["English"]
  },
  "sameAs": [
    "https://twitter.com/example",
    "https://www.linkedin.com/company/example",
    "https://www.facebook.com/example"
  ]
}
```

### Restrictions
- Place on **homepage only** (not every page)
- `sameAs` URLs must be profiles the org actually controls
- Use the most specific subtype: `Corporation`, `LocalBusiness`, `Restaurant`, etc.
- `contactType` is enumerated — arbitrary strings won't work
- Logo must be a crawlable HTTPS URL, min 112x112px

---

## 2. WebSite

**Hierarchy**: `Thing > CreativeWork > WebSite`
**When**: Homepage only, alongside Organization
**Google Rich Result**: Site Name in search results, Sitelinks Search Box

### Google Required
| Property | Type | Notes |
|---|---|---|
| `name` | Text | Site name (concise, matches branding, not generic) |
| `url` | URL | Root URL of the site homepage |

### Google Recommended
| Property | Type | Notes |
|---|---|---|
| `alternateName` | Text | Abbreviation or commonly known shorter name |
| `potentialAction` | SearchAction | For sitelinks search box (requires working site search) |

### JSON-LD Example
```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Example Website",
  "alternateName": "Example",
  "url": "https://www.example.com/",
  "potentialAction": {
    "@type": "SearchAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": "https://www.example.com/search?q={search_term_string}"
    },
    "query-input": "required name=search_term_string"
  }
}
```

### Restrictions
- **Homepage only** — never on interior pages
- `name` must not be generic ("Home", "Website")
- `url` must be the root URL
- Each subdomain needs its own WebSite markup
- SearchAction requires a working internal search engine
- `{search_term_string}` in urlTemplate must match the name in query-input

---

## 3. Product

**Hierarchy**: `Thing > Product`
**When**: Product pages (e-commerce), product review pages
**Google Rich Result**: Product Snippets, Merchant Listings, Shopping, Price Drop

### Google Required (Snippets)
| Property | Type | Notes |
|---|---|---|
| `name` | Text | Product name (no promotional text like "Sale!") |
| `image` | URL/URL[] | Min 50K pixels. Multiple aspect ratios: 16:9, 4:3, 1:1 |
| One of: `review`, `aggregateRating`, or `offers` | Object | At least one required for eligibility |

### Google Required (Merchant Listings)
All of the above, plus:
| Property | Type | Notes |
|---|---|---|
| `offers.price` | Number | Actual current price |
| `offers.priceCurrency` | Text | ISO 4217 (e.g., "USD") |
| `offers.availability` | ItemAvailability | `https://schema.org/InStock`, `OutOfStock`, etc. |

### Google Recommended
`brand.name`, `description`, `gtin`/`mpn`/`sku`, `aggregateRating` (with `ratingValue` + `ratingCount`), `review` (with `author.name`, `reviewRating.ratingValue`), `offers.url`, `offers.priceValidUntil`, `offers.itemCondition`, `hasMerchantReturnPolicy`, `shippingDetails`

### JSON-LD Example
```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Executive Anvil",
  "image": ["https://example.com/photos/16x9/anvil.jpg"],
  "description": "Sleek anvil for business travelers.",
  "sku": "0446310786",
  "brand": {"@type": "Brand", "name": "ACME"},
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.4",
    "reviewCount": "89"
  },
  "offers": {
    "@type": "Offer",
    "url": "https://example.com/anvil",
    "priceCurrency": "USD",
    "price": 119.99,
    "availability": "https://schema.org/InStock",
    "itemCondition": "https://schema.org/NewCondition"
  }
}
```

### Restrictions
- Do NOT add promotional text to `name`
- Do NOT use for non-product pages
- Do NOT use for mobile apps (use SoftwareApplication)
- Price must be the actual current price
- Availability must reflect actual stock status
- Self-serving reviews violate guidelines
- Images must represent the actual product
- `bestRating` defaults to 5, `worstRating` defaults to 1

---

## 4. Service

**Hierarchy**: `Thing > Intangible > Service`
**When**: Solutions pages, service pages, consulting/agency pages
**Google Rich Result**: None dedicated. Valuable for AI/LLM understanding.

### Key Properties
| Property | Type | Notes |
|---|---|---|
| `name` | Text | Service name |
| `description` | Text | Service description |
| `provider` | Organization | Who provides the service |
| `areaServed` | Text/Place | Geographic coverage |
| `serviceType` | Text | Category of service |
| `offers` | Offer | Pricing information |
| `aggregateRating` | AggregateRating | Ratings if available |
| `hasOfferCatalog` | OfferCatalog | For multiple service tiers |
| `hoursAvailable` | OpeningHoursSpecification | Availability hours |
| `availableChannel` | ServiceChannel | Access methods (web, phone) |

### JSON-LD Example
```json
{
  "@context": "https://schema.org",
  "@type": "Service",
  "name": "SEO Optimization Service",
  "description": "AI-powered SEO analysis and optimization for SaaS websites.",
  "provider": {
    "@type": "Organization",
    "name": "Example Agency",
    "url": "https://www.example.com"
  },
  "areaServed": "Worldwide",
  "serviceType": "SEO Consulting",
  "offers": {
    "@type": "Offer",
    "price": "499",
    "priceCurrency": "USD"
  }
}
```

### Guidelines
- Always include `provider` linking to the Organization
- Use `areaServed` (not deprecated `serviceArea`)
- Pair with LocalBusiness when applicable (which does have Google rich results)
- Use specific subtypes: `FinancialProduct`, `GovernmentService`, `FoodService`, etc.
- For software solutions pages on SaaS companies, prefer SoftwareApplication over Service

---

## 5. Article

**Hierarchy**: `Thing > CreativeWork > Article`
**When**: General articles, magazine pieces, feature content, non-blog formal content
**Google Rich Result**: Article rich results, Top Stories, Google Discover

### Google Recommended (no strictly required properties)
| Property | Type | Notes |
|---|---|---|
| `headline` | Text | Under 110 characters |
| `image` | URL[] | Min 696px wide. For Discover: 1200px+. Multiple ratios (16:9, 4:3, 1:1) |
| `datePublished` | DateTime | ISO 8601 |
| `dateModified` | DateTime | Must be ≥ datePublished |
| `author` | Person/Org | Must include `author.name`. Include `author.url` for E-E-A-T |
| `publisher` | Organization | With `publisher.name` and `publisher.logo` |
| `description` | Text | Short summary |

### JSON-LD Example
```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "How to Optimize Your Website for AI Search",
  "image": [
    "https://example.com/photos/16x9/article.jpg",
    "https://example.com/photos/4x3/article.jpg"
  ],
  "datePublished": "2024-01-05T08:00:00+00:00",
  "dateModified": "2024-02-05T09:20:00+00:00",
  "author": {
    "@type": "Person",
    "name": "Jane Doe",
    "url": "https://example.com/authors/jane-doe",
    "jobTitle": "Senior SEO Consultant"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Example Publisher",
    "logo": {"@type": "ImageObject", "url": "https://example.com/logo.png"}
  }
}
```

### Restrictions
- Do NOT use for non-article content (products, recipes, forums)
- Headline must accurately represent content (no clickbait)
- Images must be relevant to the article
- Do NOT fabricate author info
- `dateModified` must not be earlier than `datePublished`
- `author.name` should be a real person/org name (not "admin" or "Staff")
- For multiple authors: use array of Person objects

---

## 6. BlogPosting

**Hierarchy**: `Thing > CreativeWork > Article > SocialMediaPosting > BlogPosting`
**When**: Blog posts on personal or organizational blogs
**Google Rich Result**: Same as Article

### Usage
Identical properties to Article. Use BlogPosting when:
- Content is published on a blog (personal, company blog)
- URL/page structure is clearly a blog
- Tone is more informal/personal

Use Article when:
- Content is more formal/editorial
- Published by a news/magazine outlet

### JSON-LD Example
```json
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "5 Ways to Improve Your SEO in 2024",
  "image": ["https://example.com/blog/seo-tips.jpg"],
  "datePublished": "2024-03-01T10:00:00+00:00",
  "dateModified": "2024-03-15T14:30:00+00:00",
  "author": {
    "@type": "Person",
    "name": "Jane Doe",
    "url": "https://example.com/team/jane-doe"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Example Blog",
    "logo": {"@type": "ImageObject", "url": "https://example.com/logo.png"}
  }
}
```

---

## 7. FAQPage

**Hierarchy**: `Thing > CreativeWork > WebPage > FAQPage`
**When**: Pages with an FAQ section (questions authored by the site, not user-submitted)
**Google Rich Result**: **DEPRECATED Aug 2023** (only gov/health sites). Still valuable for AI/LLM/AEO.

### Google Required
| Property | Type | Notes |
|---|---|---|
| `mainEntity` | Question[] | Array of Question objects |
| `Question.name` | Text | Full question text |
| `Question.acceptedAnswer` | Answer | Must contain one Answer |
| `Answer.text` | Text | Full answer text. May contain HTML: `<a>`, `<b>`, `<br>`, `<ol>`, `<ul>`, `<li>`, `<p>` |

### JSON-LD Example
```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is your return policy?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Items can be returned within 90 days for a full refund."
      }
    },
    {
      "@type": "Question",
      "name": "How long does shipping take?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Standard shipping takes 3-5 business days."
      }
    }
  ]
}
```

### Restrictions
- All FAQ content **must be visible** on the page
- Questions must be authored by the site (not user-submitted — use QAPage for that)
- Do NOT use for single Q&A (use QAPage)
- Do NOT use for advertising
- No duplicate questions

---

## 8. BreadcrumbList

**Hierarchy**: `Thing > Intangible > ItemList > BreadcrumbList`
**When**: Every interior page (always recommended)
**Google Rich Result**: **ACTIVE** — breadcrumb trail replaces URL in search results

### Google Required
| Property | Type | Notes |
|---|---|---|
| `itemListElement` | ListItem[] | Array of breadcrumb items |
| `ListItem.position` | Integer | 1-indexed sequential position |
| `ListItem.name` | Text | Display text for breadcrumb |
| `ListItem.item` | URL | Page URL. Required for all items EXCEPT the last (current page) |

### JSON-LD Example
```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://example.com"},
    {"@type": "ListItem", "position": 2, "name": "Blog", "item": "https://example.com/blog"},
    {"@type": "ListItem", "position": 3, "name": "SEO Tips"}
  ]
}
```

### Restrictions
- Must represent actual site hierarchy (not arbitrary nav)
- Last item = current page, no `item` URL needed
- Must match visual breadcrumbs on the page
- Use multiple BreadcrumbList objects (array) for pages reachable via multiple paths

---

## 9. HowTo

**Hierarchy**: `Thing > CreativeWork > HowTo`
**When**: Step-by-step guides, tutorials, instructions
**Google Rich Result**: **DEPRECATED Aug 2023** (completely removed). Still valuable for AI/LLM/AEO.

### Google Required
| Property | Type | Notes |
|---|---|---|
| `name` | Text | Title of the how-to |
| `step` | HowToStep[] | Array of step objects |
| `HowToStep.text` | Text | Full instruction text for the step |

### Google Recommended
`totalTime` (ISO 8601 duration), `estimatedCost` (MonetaryAmount), `supply` (HowToSupply[]), `tool` (HowToTool[]), `image`, `video`, `HowToStep.name`, `HowToStep.image`, `HowToStep.url`

### JSON-LD Example
```json
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to Set Up Google Analytics",
  "totalTime": "PT15M",
  "step": [
    {
      "@type": "HowToStep",
      "position": 1,
      "name": "Create a Google Analytics account",
      "text": "Go to analytics.google.com and sign in with your Google account. Click 'Start measuring'."
    },
    {
      "@type": "HowToStep",
      "position": 2,
      "name": "Set up a property",
      "text": "Enter your website name, URL, industry category, and reporting time zone."
    },
    {
      "@type": "HowToStep",
      "position": 3,
      "name": "Install the tracking code",
      "text": "Copy the Global Site Tag (gtag.js) and paste it into the <head> of every page."
    }
  ]
}
```

### Restrictions
- Do NOT use for recipes (use Recipe type)
- Each step must be a distinct action
- Do NOT include "Introduction" or "Summary" as steps
- Duration values in ISO 8601: `PT30M`, `PT1H30M`, `P2D`
- All step content must be visible on the page

---

## 10. SoftwareApplication

**Hierarchy**: `Thing > CreativeWork > SoftwareApplication`
**When**: SaaS platforms, software products, mobile apps, desktop apps, browser extensions
**Google Rich Result**: Software App snippet with ratings, price, app info

### Google Required
| Property | Type | Notes |
|---|---|---|
| `name` | Text | App name |
| `offers.price` | Text/Number | Price. Use `"0"` for free apps |
| `offers.priceCurrency` | Text | ISO 4217 |

### Google Recommended
`applicationCategory` (e.g., "GameApplication", "BusinessApplication"), `operatingSystem`, `aggregateRating` (with `ratingValue` + `ratingCount`), `review`, `screenshot`, `softwareVersion`, `downloadUrl`, `description`

### JSON-LD Example
```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Angry Birds",
  "operatingSystem": "ANDROID",
  "applicationCategory": "GameApplication",
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.6",
    "ratingCount": "8864"
  },
  "offers": {
    "@type": "Offer",
    "price": "1.00",
    "priceCurrency": "USD"
  }
}
```

### Restrictions
- Parent type for all software: SaaS, downloadable, or installable
- Must represent a specific product, not a category
- `offers` is required even for free apps (`"price": "0"`)
- Do NOT use fake ratings
- Only one page per app
- Do NOT use `hasOfferCatalog` — this is a Service-only property. Use `offers` with OfferCatalog instead.
- Do NOT use `brand` on SoftwareApplication — it is not a valid schema.org property for this type. Place `brand` on a Product entity instead.

### applicationCategory Values
`GameApplication`, `BusinessApplication`, `FinanceApplication`, `HealthApplication`, `EducationalApplication`, `UtilitiesApplication`, `MultimediaApplication`, `DeveloperApplication`, `SocialNetworkingApplication`, `CommunicationApplication`, `TravelApplication`, `ShoppingApplication`, `LifestyleApplication`, `DesignApplication`, `EntertainmentApplication`, `SecurityApplication`

### SaaS vs Product Decision
- **SaaS/cloud/API/CLI/platform companies → always use SoftwareApplication** (not Product or Service)
- **Product is for physical goods** with SKU, GTIN, or MPN — not for software
- `applicationCategory` is critical for SaaS. Common values: `DeveloperApplication` (dev tools, APIs, infrastructure), `BusinessApplication` (SaaS platforms, analytics, CRM)
- `operatingSystem`: use `"Web"` for SaaS/cloud products, `"Any"` for cross-platform
- `featureList`: include 3-5 key features as a comma-separated string when visible on the page

### SaaS JSON-LD Example
```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Modal",
  "url": "https://modal.com",
  "applicationCategory": "DeveloperApplication",
  "operatingSystem": "Web",
  "description": "Serverless cloud platform for AI and ML workloads.",
  "featureList": "GPU compute, serverless containers, model inference, batch jobs",
  "offers": {
    "@type": "AggregateOffer",
    "lowPrice": "0",
    "priceCurrency": "USD"
  },
  "provider": {
    "@type": "Organization",
    "name": "Modal",
    "url": "https://modal.com"
  }
}
```

---

## 11. WebApplication

**Hierarchy**: `Thing > CreativeWork > SoftwareApplication > WebApplication`
**When**: SaaS products, browser-based tools, web dashboards, online editors
**Google Rich Result**: Same as SoftwareApplication

Inherits all SoftwareApplication properties. Unique addition:

| Property | Type | Notes |
|---|---|---|
| `browserRequirements` | Text | e.g., "Requires JavaScript. Chrome 90+, Firefox 90+." |

### JSON-LD Example
```json
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "Mudra SEO Platform",
  "url": "https://www.mudra.so",
  "applicationCategory": "BusinessApplication",
  "browserRequirements": "Requires JavaScript",
  "description": "AI-powered SEO and GEO optimization platform.",
  "offers": {
    "@type": "AggregateOffer",
    "lowPrice": "0",
    "highPrice": "299",
    "priceCurrency": "USD",
    "offerCount": "3"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.8",
    "ratingCount": "156"
  }
}
```

### Key Distinction
- **SoftwareApplication**: Parent type for any software product (SaaS, desktop, mobile). Default choice.
- **WebApplication**: Subtype of SoftwareApplication. Use when page emphasizes browser-based interactive functionality (editors, dashboards, in-browser tools). Adds `browserRequirements`.
- Do NOT use WebApplication for static marketing sites

---

## 12. OfferCatalog

**Hierarchy**: `Thing > Intangible > ItemList > OfferCatalog`
**When**: Pricing pages with multiple tiers/plans. Usually nested inside WebApplication or Product.
**Google Rich Result**: None dedicated. Valuable for AI/LLM pricing comprehension.

### Key Properties
| Property | Type | Notes |
|---|---|---|
| `name` | Text | e.g., "Pricing Plans" |
| `url` | URL | Pricing page URL |
| `numberOfItems` | Integer | Number of plans |
| `itemListElement` | Offer[] | Array of Offer objects with `name`, `description`, `price`, `priceCurrency` |

For subscription pricing, use `UnitPriceSpecification` inside each Offer:
`price`, `priceCurrency`, `unitText` ("month"/"year"), `billingDuration` ("P1M")

### JSON-LD Example (nested in WebApplication)
```json
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "Example Platform",
  "offers": {
    "@type": "OfferCatalog",
    "name": "Pricing Plans",
    "itemListElement": [
      {
        "@type": "Offer",
        "name": "Free",
        "description": "Basic features, 1 project",
        "price": "0",
        "priceCurrency": "USD"
      },
      {
        "@type": "Offer",
        "name": "Pro",
        "description": "Advanced features, 10 projects",
        "price": "49",
        "priceCurrency": "USD",
        "priceSpecification": {
          "@type": "UnitPriceSpecification",
          "price": "49",
          "priceCurrency": "USD",
          "unitText": "month"
        }
      }
    ]
  }
}
```

### Restrictions
- Include `description` on each Offer (LLMs need this to distinguish tiers)
- Always include `priceCurrency`
- Use `priceSpecification` for recurring pricing (price alone doesn't indicate frequency)
- Nest inside the parent entity (WebApplication, Product, Service) via `offers`
- `hasOfferCatalog` is a Service-only property. For Product/SoftwareApplication, nest OfferCatalog via `offers` instead.
- Always nest OfferCatalog inside its parent entity — do NOT emit as a standalone @graph entry with cross-references.
- Always include actual `price` values when prices are visible on the page. Empty UnitPriceSpecification without a price violates the grounding rule.

---

## 13. ItemList

**Hierarchy**: `Thing > Intangible > ItemList`
**When**: Feature comparison tables, integration directories, product catalogs, carousels
**Google Rich Result**: **ACTIVE** — Carousel/List rich result (host carousel)

### Google Required
| Property | Type | Notes |
|---|---|---|
| `itemListElement` | ListItem[] | Array of items |
| `ListItem.position` | Integer | 1-indexed position |
| `ListItem.url` | URL | URL of the item's detail page |

### Google Recommended
`ListItem.name`, `itemListOrder` (`ItemListOrderAscending`, `ItemListOrderDescending`, `ItemListUnordered`)

### JSON-LD Example
```json
{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "itemListElement": [
    {"@type": "ListItem", "position": 1, "url": "https://example.com/product/widget-a"},
    {"@type": "ListItem", "position": 2, "url": "https://example.com/product/widget-b"},
    {"@type": "ListItem", "position": 3, "url": "https://example.com/product/widget-c"}
  ]
}
```

### Restrictions
- Each `url` must point to a page with its own structured data
- Items must be from the same site
- ItemList is for the summary page; each linked page needs its own schema
- For carousel eligibility: list must contain 2+ items

---

## 14. VideoObject

**Hierarchy**: `Thing > CreativeWork > MediaObject > VideoObject`
**When**: Pages with prominent video content (demos, tutorials, webinars)
**Google Rich Result**: **ACTIVE** — Video rich result, Video carousel

### Google Required
| Property | Type | Notes |
|---|---|---|
| `name` | Text | Video title |
| `thumbnailUrl` | URL | Thumbnail image URL (must be crawlable) |
| `uploadDate` | Date | ISO 8601 |

### Google Recommended
| Property | Type | Notes |
|---|---|---|
| `description` | Text | Video description |
| `contentUrl` | URL | Direct URL to the video file |
| `embedUrl` | URL | Embed URL (e.g., YouTube embed) |
| `duration` | Duration | ISO 8601 (e.g., "PT1H30M") |
| `interactionStatistic` | InteractionCounter | View count |
| `expires` | Date | If video expires |
| `hasPart` | Clip[] | Key moments / chapters with `startOffset`, `endOffset`, `name` |

### JSON-LD Example
```json
{
  "@context": "https://schema.org",
  "@type": "VideoObject",
  "name": "How to Use Our Platform",
  "description": "A 5-minute walkthrough of key features.",
  "thumbnailUrl": "https://example.com/video-thumb.jpg",
  "uploadDate": "2024-06-15",
  "duration": "PT5M30S",
  "contentUrl": "https://example.com/videos/demo.mp4",
  "embedUrl": "https://www.youtube.com/embed/abc123"
}
```

### Restrictions
- Thumbnail must be crawlable (not blocked by robots.txt)
- `uploadDate` must not be in the future
- Video must be publicly accessible (not behind login)
- Do NOT mark up videos that are not the main content of the page
- Provide `contentUrl` OR `embedUrl` (or both)

---

## 15. Review

**Hierarchy**: `Thing > CreativeWork > Review`
**When**: Testimonial sections, product review pages
**Google Rich Result**: **ACTIVE** — Review snippet with star rating, pros/cons

### Google Required (Individual Review)
| Property | Type | Notes |
|---|---|---|
| `author.name` | Text | Review author name |
| `itemReviewed.name` | Text | Name of reviewed item |
| `reviewRating.ratingValue` | Number/Text | Numeric rating |

### Google Required (Aggregate Rating)
| Property | Type | Notes |
|---|---|---|
| `itemReviewed.name` | Text | Name of reviewed item |
| `aggregateRating.ratingValue` | Number/Text | Overall rating |
| `aggregateRating.ratingCount` or `reviewCount` | Integer | At least one required |

### Google Recommended
`reviewRating.bestRating` (required if not 1-5 scale), `reviewRating.worstRating`, `datePublished`, `reviewBody`, `publisher.name`, `positiveNotes` (ItemList), `negativeNotes` (ItemList)

### JSON-LD Example
```json
{
  "@context": "https://schema.org",
  "@type": "Review",
  "author": {"@type": "Person", "name": "Jane Smith"},
  "datePublished": "2024-03-15",
  "reviewBody": "Excellent tool for SEO optimization.",
  "reviewRating": {
    "@type": "Rating",
    "ratingValue": "5",
    "bestRating": "5"
  },
  "itemReviewed": {
    "@type": "Product",
    "name": "Example SEO Tool"
  }
}
```

### Restrictions
- Do NOT mark up non-review content as reviews
- The author must be a real, identifiable person/org
- Do NOT fabricate reviews or ratings
- AggregateRating must reflect actual user ratings
- Self-serving reviews (reviewing your own product) are scrutinized by Google
- If not using 1-5 scale, MUST specify `bestRating` and `worstRating`
- Do NOT use on category/listing pages — use on individual item pages
- Each review MUST have `ratingValue`

---

## 16. Person

**Hierarchy**: `Thing > Person`
**When**: Blog author markup, team/about pages, profile pages
**Google Rich Result**: Profile page rich result (within ProfilePage), Author credibility (E-E-A-T)

### Key Properties
| Property | Type | Notes |
|---|---|---|
| `name` | Text | Full name |
| `jobTitle` | Text | Professional title |
| `url` | URL | Profile page or personal site |
| `image` | URL | Real photo (not generic avatar) |
| `sameAs` | URL[] | Social profiles: LinkedIn, Twitter, GitHub |
| `worksFor` | Organization | Current employer |
| `alumniOf` | EducationalOrganization | Education |
| `knowsAbout` | Text[] | Expertise areas |
| `description` | Text | Bio |

### ProfilePage Wrapper (for profile/team pages)
```json
{
  "@context": "https://schema.org",
  "@type": "ProfilePage",
  "dateModified": "2024-06-15",
  "mainEntity": {
    "@type": "Person",
    "name": "Jane Smith",
    "jobTitle": "Senior SEO Consultant",
    "url": "https://example.com/team/jane-smith",
    "image": "https://example.com/photos/jane.jpg",
    "sameAs": [
      "https://twitter.com/janesmith",
      "https://linkedin.com/in/janesmith"
    ],
    "worksFor": {"@type": "Organization", "name": "Example Corp"}
  }
}
```

### As Article Author (embedded within Article/BlogPosting)
```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Example Article",
  "author": {
    "@type": "Person",
    "name": "Jane Smith",
    "jobTitle": "Senior SEO Consultant",
    "url": "https://example.com/team/jane-smith",
    "image": "https://example.com/photos/jane.jpg",
    "sameAs": ["https://linkedin.com/in/janesmith"],
    "worksFor": {"@type": "Organization", "name": "Example Corp"}
  }
}
```

### Restrictions
- Person alone does NOT trigger rich results — must be within ProfilePage or as author in Article
- `sameAs` links must be authoritative (LinkedIn, Twitter, Wikipedia, etc.)
- `name` must be the person's real, publicly known name
- Do NOT fabricate interaction statistics
- `image` should be a real photo
- ProfilePage markup only on actual profile pages

---

## 17. AboutPage

**Hierarchy**: `Thing > CreativeWork > WebPage > AboutPage`
**When**: About pages (`/about`, `/company`, `/team`). Signals to AI systems that the page describes the organization itself.
**Google Rich Result**: None dedicated. Helps AI/LLM systems understand page purpose.

### Key Properties
| Property | Type | Notes |
|---|---|---|
| `name` | Text | Page title (e.g., "About Acme Inc.") |
| `url` | URL | Page URL |
| `description` | Text | Short description of the about page |
| `about` | Organization | Reference to the Organization entity via `@id` |
| `breadcrumb` | BreadcrumbList | Navigation hierarchy |

### JSON-LD Example
```json
{
  "@context": "https://schema.org",
  "@type": "AboutPage",
  "name": "About Example Corp",
  "url": "https://example.com/about",
  "description": "Learn about Example Corp's mission, team, and values.",
  "about": {
    "@type": "Organization",
    "@id": "https://example.com/#organization",
    "name": "Example Corp"
  }
}
```

### Restrictions
- Use only on pages primarily **about** the company/organization
- Do NOT use on generic pages that merely mention the company
- Pair with Organization schema for full entity coverage
- `name` and `url` are required properties
- Do NOT fabricate descriptions — use the page's meta description or title

---

## 18. CollectionPage

**Hierarchy**: `Thing > CreativeWork > WebPage > CollectionPage`
**When**: Blog index, category pages, portfolio galleries, resource directories
**Google Rich Result**: None dedicated. Helps search engines understand page as an index/listing.

### Key Properties
| Property | Type | Notes |
|---|---|---|
| `name` | Text | Collection title |
| `description` | Text | Collection description |
| `url` | URL | Page URL |
| `isPartOf` | WebSite | Parent website |
| `mainEntity` | ItemList | The list of items in the collection |
| `breadcrumb` | BreadcrumbList | Navigation hierarchy |
| `publisher` | Organization | Publisher |

### JSON-LD Example
```json
{
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "name": "Engineering Blog",
  "description": "Technical articles on software engineering and architecture.",
  "url": "https://example.com/blog",
  "isPartOf": {
    "@type": "WebSite",
    "name": "Example Inc.",
    "url": "https://example.com"
  },
  "mainEntity": {
    "@type": "ItemList",
    "itemListElement": [
      {"@type": "ListItem", "position": 1, "url": "https://example.com/blog/post-1"},
      {"@type": "ListItem", "position": 2, "url": "https://example.com/blog/post-2"}
    ]
  }
}
```

### Guidelines
- Use for pages that aggregate/list other content items
- Combine with ItemList to enumerate items
- Individual linked pages should have their own structured data (BlogPosting, Product, etc.)
- Do NOT use for single-content pages (use Article, WebPage instead)

---

## Deprecation Status Summary

| Type | Google Rich Result | AI/LLM/AEO Value |
|---|---|---|
| Organization | ACTIVE — Knowledge Panel | High |
| WebSite | ACTIVE — Site Name, Sitelinks Search | High |
| Product | ACTIVE — Snippets, Merchant, Shopping | High |
| Service | No dedicated rich result | High |
| Article | ACTIVE — Article rich result, Discover | High |
| BlogPosting | ACTIVE — Same as Article | High |
| FAQPage | **DEPRECATED** Aug 2023 (gov/health only) | **Still high for AI** |
| BreadcrumbList | ACTIVE — Breadcrumb trail | High |
| HowTo | **DEPRECATED** Aug 2023 (fully removed) | **Still high for AI** |
| SoftwareApplication | ACTIVE — App snippet | High |
| WebApplication | ACTIVE — Same as SoftwareApp | High |
| OfferCatalog | No dedicated rich result | High for pricing |
| ItemList | ACTIVE — Carousel | Medium |
| VideoObject | ACTIVE — Video rich result | High |
| Review | ACTIVE — Review snippet | High |
| Person | Via ProfilePage or Article author | High for E-E-A-T |
| AboutPage | No dedicated rich result | High for AI |
| CollectionPage | No dedicated rich result | Medium |

---

## Compact Generation Skeletons

```
Organization:  {"@context":"https://schema.org","@type":"Organization","name":"{name}","url":"{url}","logo":"{logo}","sameAs":["{social1}"]}
WebSite:       {"@context":"https://schema.org","@type":"WebSite","name":"{name}","url":"{url}"}
Product:       {"@context":"https://schema.org","@type":"Product","name":"{name}","image":"{img}","offers":{"@type":"Offer","price":"{price}","priceCurrency":"{cur}"}}
Service:       {"@context":"https://schema.org","@type":"Service","name":"{name}","provider":{"@type":"Organization","name":"{org}"},"serviceType":"{type}"}
Article:       {"@context":"https://schema.org","@type":"Article","headline":"{title}","datePublished":"{date}","author":{"@type":"Person","name":"{author}"}}
BlogPosting:   {"@context":"https://schema.org","@type":"BlogPosting","headline":"{title}","datePublished":"{date}","author":{"@type":"Person","name":"{author}"}}
FAQPage:       {"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"{Q}","acceptedAnswer":{"@type":"Answer","text":"{A}"}}]}
BreadcrumbList:{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"{crumb}","item":"{url}"}]}
HowTo:         {"@context":"https://schema.org","@type":"HowTo","name":"{title}","step":[{"@type":"HowToStep","text":"{instruction}"}]}
SoftwareApp:   {"@context":"https://schema.org","@type":"SoftwareApplication","name":"{name}","offers":{"@type":"Offer","price":"{price}","priceCurrency":"{cur}"}}
WebApplication:{"@context":"https://schema.org","@type":"WebApplication","name":"{name}","url":"{url}","offers":{"@type":"Offer","price":"{price}","priceCurrency":"{cur}"}}
VideoObject:   {"@context":"https://schema.org","@type":"VideoObject","name":"{title}","thumbnailUrl":"{thumb}","uploadDate":"{date}"}
Review:        {"@context":"https://schema.org","@type":"Review","author":{"@type":"Person","name":"{author}"},"reviewRating":{"@type":"Rating","ratingValue":"{rating}"},"itemReviewed":{"@type":"{type}","name":"{item}"}}
ItemList:      {"@context":"https://schema.org","@type":"ItemList","itemListElement":[{"@type":"ListItem","position":1,"url":"{url}"}]}
Person:        {"@type":"Person","name":"{name}","jobTitle":"{title}","url":"{url}","sameAs":["{social}"]}
CollectionPage:{"@context":"https://schema.org","@type":"CollectionPage","name":"{name}","url":"{url}","mainEntity":{"@type":"ItemList","itemListElement":[]}}
AboutPage:     {"@context":"https://schema.org","@type":"AboutPage","name":"{name}","url":"{url}","description":"{desc}","about":{"@id":"{org_id}"}}
OfferCatalog:  {"@type":"OfferCatalog","name":"{name}","itemListElement":[{"@type":"Offer","name":"{plan}","price":"{price}","priceCurrency":"{cur}"}]}
```
