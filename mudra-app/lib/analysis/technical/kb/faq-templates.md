# FAQ Generation Templates — Page-Type-Aware Question Patterns

> **GROUNDING RULE**: Only generate FAQ questions that a real visitor to this page would ask.
> Pull answers **exclusively** from visible page content. Never fabricate data, pricing,
> features, or capabilities not present on the page. If you cannot answer a question from
> the page content, **skip it**.

## General Constraints

- Generate exactly **3–5 Q&As** per page
- Keep each answer to **1–3 sentences**, directly quotable
- Questions must reflect what an ideal customer would ask on **this specific page type**
- Start answers with a direct response (no preamble like "Great question!")
- Use the company/product name naturally in questions where appropriate

---

## home

**ICP intent**: Understanding what the company does, who it's for, and why it matters

**Question patterns**:
1. "What is {Company}?" → Pull from hero section, tagline, or company description
2. "Who is {Product} built for?" → Pull from target audience signals, use cases mentioned
3. "What makes {Company} different?" → Pull from differentiators, unique value propositions
4. "How does {Product} work?" → Pull from product overview, feature highlights
5. "How do I get started with {Product}?" → Pull from CTA text, onboarding mentions

**Answer guidance**:
- Lead with the company's own positioning language
- Reference specific claims visible on the page
- Keep answers accessible to first-time visitors

**Anti-patterns**:
- Don't ask about specific pricing (that's for the pricing page)
- Don't ask about individual feature details (that's for the features page)
- Don't fabricate founding dates, team size, or funding info not on the page

---

## pricing

**ICP intent**: Evaluating cost, comparing plans, understanding value

**Question patterns**:
1. "How much does {Product} cost?" → Pull from visible plan names and prices
2. "Is there a free trial or free plan?" → Check for "free" / "trial" mentions
3. "What's included in each plan?" → Summarize plan feature differences
4. "Can I change or cancel my plan?" → Reference flexibility/billing terms if visible
5. "Do you offer discounts for annual billing?" → Check for annual/monthly toggle, savings mentions

**Answer guidance**:
- Reference actual plan names and prices visible on the page
- Mention specific features that differentiate tiers
- Include any free trial duration if stated

**Anti-patterns**:
- Don't fabricate prices, plan names, or features not visible on the page
- Don't invent cancellation policies or refund terms not stated
- Don't ask about product capabilities (that's for features/product pages)

---

## features

**ICP intent**: Evaluating capabilities, understanding what the product can do

**Question patterns**:
1. "What are the key features of {Product}?" → Summarize top 3–4 features from the page
2. "Does {Product} support {Capability}?" → Pick a specific capability prominently listed
3. "How does {Feature} work?" → Pull from feature description or explanation section
4. "What integrations does {Product} offer?" → Reference integration logos/names if listed
5. "What's new in {Product}?" → Pull from any "new" or "recently added" badges

**Answer guidance**:
- Use the feature names exactly as they appear on the page
- Reference specific functionality rather than vague benefits
- Mention integration partners by name if listed

**Anti-patterns**:
- Don't ask about pricing (that's for the pricing page)
- Don't fabricate feature capabilities not listed on the page
- Don't ask about company background (that's for home/about pages)

---

## product

**ICP intent**: Deep-diving into a specific product, understanding fit for their use case

**Question patterns**:
1. "What is {Product}?" → Pull from product headline and description
2. "How does {Product} help with {Use Case}?" → Pull from use case or benefit sections
3. "What do I need to get started with {Product}?" → Pull from requirements, prerequisites, or CTA
4. "Is {Product} right for {Audience}?" → Pull from target audience or "built for" sections
5. "How does {Product} compare to alternatives?" → Pull from comparison sections if present

**Answer guidance**:
- Focus on the specific product being described, not the company overall
- Reference concrete outcomes or metrics if stated on the page
- Use the product's own terminology

**Anti-patterns**:
- Don't fabricate comparison data, benchmarks, or metrics not on the page
- Don't ask about other products in the company's portfolio
- Don't invent technical specifications not listed

---

## solutions

**ICP intent**: Understanding how the product solves their specific problem or serves their industry

**Question patterns**:
1. "How does {Company} solve {Problem}?" → Pull from the solution overview or hero section
2. "Who uses {Product} for {Use Case}?" → Pull from customer logos, case study mentions
3. "What results can I expect from {Product}?" → Pull from metrics, outcomes, or ROI claims
4. "How does {Product} work for {Industry}?" → Pull from industry-specific content
5. "How do I implement {Product}?" → Pull from implementation or onboarding sections

**Answer guidance**:
- Match the solution framing used on the page
- Reference specific industries or roles if mentioned
- Include concrete outcomes or metrics if stated

**Anti-patterns**:
- Don't fabricate case study results or customer names
- Don't invent ROI figures or performance metrics not on the page
- Don't ask about pricing or general features

---

## blog

**ICP intent**: Learning about a topic, understanding the company's expertise

**Question patterns**:
1. "What is {Topic}?" → Pull from the article's definition or introduction
2. "Why does {Topic} matter?" → Pull from the article's motivation or context section
3. "How do I {Action described in article}?" → Pull from how-to or step-by-step sections
4. "What are the key takeaways from this article?" → Summarize main points
5. "Where can I learn more about {Topic}?" → Pull from related links or resources mentioned

**Answer guidance**:
- Ground questions in the specific article topic, not generic blog questions
- Use terminology from the article
- Keep answers factual — summarize what the article states

**Anti-patterns**:
- Don't ask generic questions like "What is this blog about?"
- Don't fabricate statistics, research findings, or expert quotes not in the article
- Don't ask about the company's products unless the article discusses them

---

## use-cases

**ICP intent**: Validating that the product fits their specific scenario

**Question patterns**:
1. "How does {Product} help with {Use Case}?" → Pull from the use case description
2. "What results have customers achieved with {Use Case}?" → Pull from metrics or testimonials
3. "What features support {Use Case}?" → Pull from feature highlights specific to this use case
4. "Who typically uses {Product} for {Use Case}?" → Pull from persona or industry mentions
5. "How do I get started with {Use Case}?" → Pull from CTA or next-steps section

**Answer guidance**:
- Focus tightly on the specific use case described on the page
- Reference customer outcomes if stated
- Connect features to the use case context

**Anti-patterns**:
- Don't fabricate customer stories or results
- Don't ask about unrelated use cases
- Don't invent feature capabilities not mentioned in the use case context

---

## customers

**ICP intent**: Building confidence through social proof, understanding who else uses the product

**Question patterns**:
1. "Who uses {Product}?" → Pull from customer logos, names, or industry segments
2. "What results have {Company}'s customers achieved?" → Pull from stated metrics or outcomes
3. "Are there case studies available?" → Reference any case study links or detailed stories
4. "What industries does {Product} serve?" → Pull from industry categories or customer segments
5. "What do customers say about {Product}?" → Pull from testimonial quotes if visible

**Answer guidance**:
- Only name customers explicitly shown on the page
- Only cite metrics that are directly stated
- Reference specific testimonial quotes if visible

**Anti-patterns**:
- Don't fabricate customer names, logos, or testimonials
- Don't invent metrics or ROI figures
- Don't ask about product features or pricing
