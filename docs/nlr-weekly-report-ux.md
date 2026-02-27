# Weekly Report — What the User Sees

## One Report Per Monitor

Each monitor (domain) the user tracks gets its own independent weekly report. If a user monitors three websites — say `acme.com`, `blog.acme.com`, and `acme.io` — they receive three separate reports, each with data specific to that domain.

The user selects which monitor they're viewing from the sidebar. The report shown always corresponds to the active monitor.

---

## Report Structure

When the user opens the Weekly Report section on their dashboard, they see a single-page summary broken into clear sections:

### 1. What's Changed

A short list (3–4 items) of the most important things that happened this week, ranked by significance. Each item has a label and an importance tag (high, medium, or low).

Example:
- **AI Visibility score jumped from 58 to 71** — high
- **12 new AI referral visits this week (+40%)** — medium
- **Conversation Radar found 2 new Reddit threads** — medium

This is the first thing the user reads. It answers: *"What moved the needle this week?"*

### 2. This Week's Highlights

Two or three quick wins or notable observations pulled from AI visibility changes. Plain sentences, not metrics.

Example:
- Your site now appears in position 2 for "best project management tools" on ChatGPT
- Perplexity started citing your pricing page this week

### 3. AI Visibility

How visible the user's site is to AI assistants (ChatGPT, Perplexity, Gemini, Claude).

Shows:
- **Score** — current vs. previous week, with direction arrow and percentage change
- **Average Position** — where the site ranks in AI responses, with week-over-week trend
- Brief notes explaining what drove the change

If the user tracks multiple countries, they can switch the country selector to see that country's specific AI visibility data overlaid on the base report.

### 4. Average Position

A focused view of ranking position across AI platforms.

Shows:
- **Current position** vs. previous week
- **Direction** — improving, declining, or stable
- **Delta** — how many positions moved

### 5. AI Referral Traffic

Real visits coming from AI platforms to the user's site.

Shows:
- **Total AI visits this week**
- **Weekly change** — how many more or fewer visits compared to last week
- **Breakdown by provider** — visits from ChatGPT, Perplexity, Gemini, Claude, etc.

### 6. Opportunities (Conversation Radar)

Relevant conversations found on Reddit where the user's brand could participate.

Shows:
- **New opportunities this week** — freshly discovered conversations
- **Active opportunities** — still open for engagement
- **Engaged this week** — how many the user acted on

### 7. Issues

Actionable problems and improvements discovered by the platform.

Shows:
- **New issues this week** — freshly identified
- **Resolved this week** — issues completed or merged
- **Top open issues** — the most important items to tackle next

---

## Multi-Monitor Experience

- The **sidebar** shows all monitors. Each has a name (usually the domain) and an order.
- Switching monitors switches the entire dashboard — scores, prompts, issues, and the weekly report.
- Reports are generated independently. Monitor A's report contains zero data from Monitor B.
- The weekly cron generates a report for every monitor that has a website configured.
- If a monitor was just created and has no data yet, the report section shows "No report available yet."

---

## Multi-Country Experience

- A single monitor can track multiple countries (e.g., US, ES, MX).
- The base report is generated once per monitor per week.
- When the user selects a different country from the country picker, the AI Visibility section updates with that country's specific scores overlaid on the base report.
- All other sections remain the same regardless of country selection.

---

## Timing

- Reports are generated automatically every Monday at 6 AM UTC.
- A report is also generated immediately after the user's first analysis completes (so they don't have to wait until Monday).
- If no new data exists since the last report, the previous report is shown.

---

## What the User Does NOT See

- Which AI model generated the report
- Token counts or cost
- Internal IDs
- Raw JSON — everything is rendered as readable text and visuals
