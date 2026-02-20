---
name: investor-deck-generator
description: "Generate professional investor pitch decks following the Sequoia Capital template structure. Use when creating fundraising presentations, investor decks, or pitch decks from existing company documents. Triggers on: investor deck, pitch deck, Sequoia template, fundraising presentation, Series A deck, seed deck, VC presentation. Analyzes content from a working folder (PDFs, docs, presentations) and generates a consistent 10-12 slide deck with AI-generated images matching a cohesive visual style."
---

# Investor Deck Generator (Sequoia Template)

Generate professional investor pitch decks following the legendary Sequoia Capital template structure used by Airbnb, YouTube, and countless successful startups.

## Quick Start

1. **Analyze source content**: Read all documents in the user's folder
2. **Extract key information**: Map content to Sequoia slide structure
3. **Generate deck**: Use pptxgenjs with consistent styling
4. **Add visuals**: Generate AI images for visual consistency
5. **QA and deliver**: Visual inspection before final output

## Sequoia Slide Structure (10-12 Slides)

| # | Slide | Purpose | Key Content |
|---|-------|---------|-------------|
| 1 | **Title** | First impression | Company name, tagline, logo |
| 2 | **Company Purpose** | Single declarative sentence | What you do in one line |
| 3 | **Problem** | Customer pain | Pain points, current solutions, why they fail |
| 4 | **Solution** | Your value proposition | How you solve it, key benefits |
| 5 | **Why Now** | Market timing | Trends enabling your solution |
| 6 | **Market Size** | Opportunity scale | TAM, SAM, SOM with methodology |
| 7 | **Competition** | Competitive landscape | Positioning matrix, differentiation |
| 8 | **Product** | What you've built | Screenshots, features, architecture |
| 9 | **Business Model** | How you make money | Revenue streams, pricing, unit economics |
| 10 | **Traction** | Proof points | Metrics, customers, milestones |
| 11 | **Team** | Why you'll win | Founders, key hires, advisors |
| 12 | **The Ask** | Call to action | Funding amount, use of funds, timeline |

## Workflow

### Phase 1: Content Analysis

```bash
# Extract text from all PDFs in folder
for f in *.pdf; do python -m markitdown "$f" > "${f%.pdf}.txt"; done

# Extract from PowerPoints
for f in *.pptx; do python -m markitdown "$f" > "${f%.pptx}.txt"; done

# Extract from Word docs
for f in *.docx; do python -m markitdown "$f" > "${f%.docx}.txt"; done
```

Read extracted content and create a structured analysis mapping to each Sequoia slide. See [references/content-mapping.md](references/content-mapping.md) for extraction guidance.

### Phase 1.5: Table of Contents Generation

Before classifying individual documents, the classifier generates a TOC that:

1. **Profiles each document**: Identifies type (pitch_deck, financial_model, market_research, product_docs, team_info, legal, press)
2. **Estimates relevance**: Scores each document's relevance to each of the 12 slide types
3. **Analyzes coverage**: Identifies which slides have strong/weak content
4. **Detects conflicts**: Flags potential data conflicts between documents
5. **Recommends order**: Suggests which documents to process first

The TOC is saved to `intermediate/table-of-contents.json` and used during classification to provide context about the full document set.

### Phase 2: Content Synthesis

For each slide, synthesize information from source documents:

1. **Identify primary sources**: Which documents contain relevant info
2. **Extract key points**: Pull specific data, quotes, metrics
3. **Condense to slide format**: Investor decks use minimal text
4. **Fill gaps**: Flag missing information for user input

### Phase 3: Visual Design

Choose a cohesive design system before generating slides:

**Color Palette Selection** (pick one based on company/industry):

| Theme | Primary | Secondary | Accent | Best For |
|-------|---------|-----------|--------|----------|
| **Tech Navy** | `1E3A5F` | `4A90D9` | `F5A623` | Enterprise SaaS, B2B |
| **Innovation Teal** | `0D9488` | `14B8A6` | `1E293B` | DeepTech, AI, Hardware |
| **Energy Orange** | `EA580C` | `FB923C` | `1F2937` | Climate, Energy, Industrial |
| **Finance Blue** | `1E40AF` | `3B82F6` | `10B981` | Fintech, Payments |
| **Health Green** | `047857` | `10B981` | `0891B2` | HealthTech, BioTech |

**Typography**:
- Title font: Georgia or Arial Black (44pt)
- Heading font: Arial Bold (28-32pt)
- Body font: Calibri (16-18pt)
- Accent/stats: Arial Black (48-72pt)

**Layout Patterns** (vary across slides):
- Split: 40% visual / 60% content
- Stats callout: Large number + supporting text
- Grid: 2x2 or 3-column feature blocks
- Timeline: Horizontal progression
- Comparison: Side-by-side columns

### Phase 4: AI Image Generation

For visual consistency, generate images with a unified prompt style.

**Base prompt structure**:
```
[Subject description], [style keywords], [color/mood], corporate presentation style,
clean background, professional, high quality, 16:9 aspect ratio
```

**Style keywords for consistency** (choose one set):
- **Minimal Tech**: "flat vector illustration, geometric shapes, gradient accents"
- **3D Isometric**: "isometric 3D illustration, soft shadows, modern tech"
- **Abstract Data**: "data visualization aesthetic, flowing lines, network nodes"
- **Photorealistic**: "professional photography, shallow depth of field, studio lighting"

**Example prompts per slide**:

| Slide | Prompt Template |
|-------|-----------------|
| Problem | "Person frustrated with [old solution], [style], muted colors, tension" |
| Solution | "Clean interface showing [product], [style], bright colors, success" |
| Why Now | "Timeline visualization showing [trend], [style], forward momentum" |
| Market | "Globe or chart showing [market], [style], scale and opportunity" |
| Product | "Hero shot of [product interface/hardware], [style], professional" |
| Team | "Abstract representation of collaboration, [style], unity theme" |

**Image generation command** (example with model):
```bash
# Using a local model or API - adjust to your available generator
# The key is consistent style keywords across all images
```

### Phase 5: Deck Generation

Use the script at [scripts/generate-deck.js](scripts/generate-deck.js) as a starting point.

```bash
cd /path/to/skill
npm install pptxgenjs react react-dom sharp react-icons
node scripts/generate-deck.js --config deck-config.json --output investor-deck.pptx
```

**Config file structure** (deck-config.json):
```json
{
  "company": {
    "name": "Company Name",
    "tagline": "One-line description",
    "logo": "path/to/logo.png"
  },
  "design": {
    "primaryColor": "1E3A5F",
    "secondaryColor": "4A90D9",
    "accentColor": "F5A623",
    "fontTitle": "Georgia",
    "fontBody": "Calibri"
  },
  "slides": [
    {
      "type": "title",
      "content": { ... }
    },
    {
      "type": "problem",
      "headline": "The Problem",
      "points": ["Pain point 1", "Pain point 2"],
      "image": "path/to/problem-image.png"
    }
    // ... more slides
  ]
}
```

### Phase 6: Quality Assurance

**Content QA**:
```bash
python -m markitdown investor-deck.pptx | head -100
```

**Visual QA** (REQUIRED - use subagent):
```bash
soffice --headless --convert-to pdf investor-deck.pptx
pdftoppm -jpeg -r 150 investor-deck.pdf slide
```

Then visually inspect each slide image for:
- Text overflow or cutoff
- Image positioning issues
- Color contrast problems
- Consistent spacing
- Professional appearance

## Slide Design Specifications

### Slide 1: Title
- Full-bleed background (dark or gradient)
- Company name: 44pt, centered
- Tagline: 24pt, below name
- Logo: Bottom right or top left
- Optional: Subtle background pattern

### Slide 2: Company Purpose
- Large statement: 36-44pt, centered
- Supporting context: 18pt below
- Consider: Icon or simple visual metaphor
- White background with accent border

### Slide 3: Problem
- Headline: "The Problem" or specific pain
- 3 key pain points (icon + text)
- Supporting data/statistic if available
- Muted colors, tension-building

### Slide 4: Solution
- Headline: "Our Solution" or value prop
- Core benefit statement
- 3 feature highlights
- Product visual or conceptual image
- Brighter colors, optimistic

### Slide 5: Why Now
- Timeline or trend visualization
- Key market shifts (technology, regulation, behavior)
- Convergence narrative
- Forward momentum visual

### Slide 6: Market Size
- TAM/SAM/SOM visualization
- Methodology note (bottom-up preferred)
- Market growth rate
- Target segment clarity
- Large numbers prominently displayed

### Slide 7: Competition
- 2x2 positioning matrix OR
- Comparison table (limited competitors)
- Clear differentiation callout
- "Why we win" statement

### Slide 8: Product
- Hero screenshot or product image
- Key features (3-4 max)
- Architecture diagram if B2B/technical
- Customer quote if available

### Slide 9: Business Model
- Revenue model visual
- Pricing tiers or structure
- Unit economics if favorable
- Path to profitability indicators

### Slide 10: Traction
- Key metrics prominently displayed
- Growth chart if impressive
- Customer logos (if permitted)
- Milestone timeline

### Slide 11: Team
- Founder photos (if available) or stylized representation
- Name, title, key credential
- Relevant experience highlights
- Advisory board mentions

### Slide 12: The Ask
- Funding amount
- Use of funds (pie chart or bars)
- Key milestones funding enables
- Contact information
- Clear call to action

## Dependencies

```bash
pip install markitdown --break-system-packages
npm install -g pptxgenjs react react-dom sharp react-icons
```

## References

- [references/content-mapping.md](references/content-mapping.md) - Guide for extracting info from source docs
- [references/slide-examples.md](references/slide-examples.md) - Example content for each slide type
- [references/image-prompts.md](references/image-prompts.md) - AI image generation prompt templates

## Common Issues

| Issue | Solution |
|-------|----------|
| Missing company info | Ask user for company name, tagline, founding date |
| No financial data | Use industry benchmarks or note as TBD |
| Inconsistent visuals | Regenerate images with exact same style keywords |
| Too much text | Ruthlessly cut to key points; details go in appendix |
| No product screenshots | Use conceptual diagrams or architecture visuals |
| Image generation fails | Check `intermediate/failed-image-prompts.json` for errors |
| Content overflows | Check console for `[LAYOUT WARNING]` messages |

## Debugging & Development

### Dry-Run Mode

Test prompts without calling LLM APIs:

```bash
# Generate prompts only (no API calls)
node pipeline/02-classify-context.js --dry-run
node pipeline/03-synthesize-content.js --dry-run
node pipeline/04-generate-final.js --dry-run

# Review saved prompts
node pipeline/tools/review-prompts.js
```

Prompts are saved to `intermediate/prompts/` with metadata including:
- Agent name and model
- Token estimates
- Timestamps
- Full prompt content

### Verbose Logging

Enable detailed logging for any pipeline script:

```bash
node pipeline/02-classify-context.js --verbose
node pipeline/04-generate-final.js --verbose
```

### Image Generation Debugging

If images fail:

1. Check error details: `cat intermediate/failed-image-prompts.json`
2. Review image prompts: `cat intermediate/image-prompts.json`
3. Check generated manifest: `cat output/generated-images.json`

The image generator includes:
- 2-second rate limiting between API calls
- 5 retry attempts with exponential backoff
- Automatic image validation (rejects corrupt/tiny images)
- Informative placeholder images for failures

## Configuration Reference

Edit `pipeline/config/pipeline-config.json`:

```json
{
  "agents": {
    "classifier": {
      "model": "claude-sonnet-4-20250514",
      "maxTokens": 8192
    },
    "synthesizer": {
      "model": "gpt-5.2",
      "reasoningMode": "extended_thinking"
    },
    "generator": {
      "model": "gemini-3-pro-preview"
    },
    "imageGenerator": {
      "model": "gemini-3-pro-image-preview",
      "imageConfig": {
        "minDelayBetweenCalls": 2000,
        "maxRetries": 5,
        "validateImages": true
      }
    }
  },
  "design": {
    "primaryColor": "1E3A5F",
    "secondaryColor": "4A90D9",
    "accentColor": "F5A623"
  }
}
```
