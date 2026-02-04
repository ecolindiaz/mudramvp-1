# Scoring Accuracy Fixes v2

Six scoring accuracy issues discovered via live testing against vercel.com and apollo.io.

---

## Fix 1: Schema Subtypes Not Recognized

**Problem:** Pages using Schema.org subtypes like `TechArticle`, `WebApplication`, or `Corporation` failed J3 (relevant schema) because only exact parent types were checked.

**Solution:**

A subtype map in `dom-extractor.ts` maps parent types to their Schema.org subtypes:

```
Article        → TechArticle, ScholarlyArticle, NewsArticle, ...
BlogPosting    → LiveBlogPosting
SoftwareApp    → MobileApplication, WebApplication, VideoGame
Organization   → LocalBusiness, Corporation, NGO, ...
```

A reverse lookup (`SUBTYPE_TO_PARENT`) is exported for use in the scorer.

**Changes:**
- `dom-extractor.ts`: Added `SCHEMA_SUBTYPE_MAP`, `SUBTYPE_TO_PARENT` (exported), `hasSchemaTypeOrSubtype()` helper. Updated `isRelevantSchemaType()` and `SchemaAnalysis` booleans.
- `five-dimension-scorer.ts`: `getRecommendedSchemas()` expands existing types with parent types before filtering, so a page with `TechArticle` won't get `Article` recommended.

---

## Fix 2: Blog Index Gets BlogPosting Recommendation

**Problem:** `/blog` (the index page listing posts) was recommended `BlogPosting` schema, which is meant for individual posts.

**Solution:**

New `isBlogIndex(url)` function detects index-level blog paths (`/blog`, `/posts`, `/articles`). The heuristic recommender now returns `CollectionPage` for blog indexes, `BlogPosting` for individual posts.

**Changes:**
- `dom-extractor.ts`: Added and exported `isBlogIndex()`.
- `schema-recommender.ts`: Added `CollectionPage` to `VALID_SCHEMA_TYPES`. Updated blog case in `heuristicRecommendedSchemas()` to branch on `isBlogIndex()`.
- `dom-extractor.ts`: Added `CollectionPage` to `RELEVANT_SCHEMA_TYPES`.

---

## Fix 3: Nav/Footer Headings Create False Skipped Levels

**Problem:** Headings inside `<nav>` and `<footer>` (e.g. `<nav><h5>Menu</h5></nav>`) were included in the heading hierarchy, causing false "skipped levels" violations like `h1 -> h5`.

**Solution:**

`extractHeadings()` now skips any heading inside `nav`, `footer`, `[role='navigation']`, or `[role='contentinfo']`.

**Changes:**
- `dom-extractor.ts`: Added `$(el).closest("nav, footer, [role='navigation'], [role='contentinfo']")` filter at the top of the `.each()` callback.

---

## Fix 4: FAQ Weight Per Page Type

**Problem:** Every page was scored on FAQ (15 points max), penalizing pages where FAQ content is irrelevant (about, contact, documentation, other).

**Solution:**

A `FAQ_RELEVANT_PAGE_TYPES` set defines which page types are scored on FAQ: `home`, `pricing`, `features`, `product`, `solutions`, `blog`.

For non-relevant page types:
- `scoreFaq()` returns `{ score: 0, max_score: 0 }` with a `FAQ_not_applicable` check
- `computePageScore()` normalizes the total: `Math.round((rawTotal / maxPossible) * 100)`
- FAQ issues and interventions are suppressed

This means an about page with perfect metadata, headings, semantic, and schema scores 100/100 instead of being capped at 85/100.

**Changes:**
- `five-dimension-scorer.ts`: Added `FAQ_RELEVANT_PAGE_TYPES`. Updated `scoreFaq()`, `computePageScore()`, `generateIssues()`, and `generateInterventions()`.

---

## Fix 5: Redirects Not Detected (Duplicate Scoring)

**Problem:** When a URL redirects (e.g. `http://` → `https://`, or `/product` → `/products`), both the original and redirect target could be scored, inflating page counts.

**Solution:**

Before the scoring loop in `unified-analysis.service.ts`:
1. SHA-256 hash each page's `rawHtml`
2. Skip pages with duplicate hashes
3. Use `page.metadata?.sourceURL || page.url` as the effective URL for extraction

**Changes:**
- `unified-analysis.service.ts`: Added content-hash dedup block and effective URL resolution.

---

## Fix 6: Remove `<header>` from S2 Check

**Problem:** S2 required both `<header>` AND `<footer>`. Many modern sites (apollo.io, clay.com) use only `<footer>` for semantic structure, failing S2 unnecessarily.

**Solution:**

S2 now only checks for `<footer>`. Rationale: `<footer>` is the stronger structural signal for AI systems. `<header>` is nice-to-have but not penalized.

**Changes:**
- `five-dimension-scorer.ts`: S2 condition, rationale, issue message, and intervention updated.
- `issue-from-scoring.service.ts`: Title → "Add Footer Element", description updated.
- `unified-analysis.service.ts`: Action map updated.

---

## Score Normalization

The total score is now computed as:

```
maxPossible = sum of all dimension max_scores
rawTotal    = sum of all dimension scores
total       = round((rawTotal / maxPossible) * 100)
```

When FAQ is excluded (`max_score = 0`), `maxPossible` is 85 instead of 100, so the score is still out of 100.

---

## Files Modified

| File | Fixes |
|---|---|
| `lib/analysis/technical/dom-extractor.ts` | 1, 2, 3 |
| `lib/analysis/technical/five-dimension-scorer.ts` | 1, 4, 6 |
| `lib/analysis/technical/schema-recommender.ts` | 2 |
| `lib/services/unified-analysis.service.ts` | 5, 6 |
| `lib/services/issue-from-scoring.service.ts` | 6 |
| `lib/analysis/technical/__tests__/dom-extractor.test.ts` | 1, 2, 3 |
| `lib/analysis/technical/__tests__/five-dimension-scorer.test.ts` | 1, 4, 6 |

## Test Coverage

128 tests pass across `dom-extractor.test.ts` and `five-dimension-scorer.test.ts`.

New tests added:
- `isRelevantSchemaType` for subtypes (TechArticle, WebApplication, RandomType)
- `isBlogIndex` for index vs post URLs
- Nav/footer heading exclusion
- S2 passes with footer only
- About page FAQ returns 0/0 with normalized total
- TechArticle passes J3
- Perfect score HTML still scores 100/100
