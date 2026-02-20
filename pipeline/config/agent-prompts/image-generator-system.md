# Full Slide Image Generation with Nano Banana Pro

This file contains guidelines for generating complete investor deck slides as images using Gemini 3 Pro Image (Nano Banana Pro).

## Overview

**New Approach**: Generate ALL 12 slides as complete images, not just charts/graphics. Each image should contain the full slide content including headlines, body text, metrics, and visual elements.

## General Style Guidelines

All generated slide images should:
- Be professional and investor-ready
- Use the brand color palette provided in the style guide
- Have clean, minimal designs with 40% minimum negative space
- Render ALL text clearly and legibly (this is critical)
- Use consistent visual language across all 12 slides
- Follow the narrative arc from story.md

## Color Palette (Default)

| Color Name | Hex Code | Usage |
|------------|----------|-------|
| Deep Black | #0A0A0A | Dark backgrounds, primary text on light |
| Soft Black | #111111 | Secondary text |
| Warm Cream | #E8E6E1 | Light backgrounds |
| Pure White | #FFFFFF | Text on dark backgrounds |
| ARC Violet | #5E5CE6 | Accent color, highlights |
| Data Cyan | #00D4FF | Data visualization accents |
| Status Green | #22C55E | Positive indicators |

## Typography Rules

| Element | Font | Weight | Size | Notes |
|---------|------|--------|------|-------|
| Company Name | Inter | 600 | 48-64px | Title slide only |
| Headlines | Inter | 600 | 28-36px | All caps optional |
| Body Text | Inter | 400 | 14-18px | Max 12 words per bullet |
| Large Metrics | IBM Plex Mono | 500 | 48-64px | Dollar amounts, percentages |
| Labels | Inter | 500 | 12px | UPPERCASE, +0.1em spacing |
| Taglines | Newsreader | Italic | 24px | Warm, aspirational tone |

## Layout Rules

- **Resolution**: 1920x1080 (16:9 aspect ratio)
- **Margins**: 0.5 inches (48px) on all sides
- **Negative space**: Minimum 40%
- **Left accent bar**: 0.15in (14px) wide when used
- **Card padding**: 0.15in internal padding

---

## Slide Type Specifications

### 1. Title Slide

**Description**: Hero slide introducing the company with bold visual impact.

**Layout**: Centered-hero
- Deep Black (#0A0A0A) full-bleed background
- Company name large and centered (Inter 600, 48-64px, white)
- Tagline below in Newsreader italic, 24px, Warm Cream
- Subtle ARC Violet accent line below tagline (2px height)
- Optional: Small subtitle at bottom

**Content Elements**:
- Company name (required)
- Tagline (required)
- Subtitle (optional)

**Prompt Template**:
```
Full title slide with Deep Black background. Center the company name "[NAME]" in large white Inter 600 text (48-64px). Below, render the tagline "[TAGLINE]" in Newsreader italic, warm cream color. Add a subtle 2px ARC Violet accent line below the tagline. Professional investor presentation quality.
```

### 2. Purpose Slide

**Description**: Single powerful statement defining the company's mission.

**Layout**: Statement-hero with left accent bar
- Warm Cream (#E8E6E1) background
- Deep Black accent bar on left edge (0.15in wide, full height)
- Large mission statement centered, Inter 600, 28-36px
- Minimal other elements

**Content Elements**:
- Headline (e.g., "OUR PURPOSE")
- Mission statement (1-2 sentences)

**Prompt Template**:
```
Purpose slide with Warm Cream background. Deep Black vertical accent bar on left edge (0.15in wide). Headline "[HEADLINE]" at top in Inter 600, 24px. Large mission statement "[STATEMENT]" centered on slide, Inter 600, 28-36px. Minimal, impactful design with significant negative space.
```

### 3. Problem Slide

**Description**: Articulates the market problem with urgency.

**Layout**: Headline-bullets-stat
- Warm Cream background with left accent bar
- Bold headline at top
- 3 bullet points (max 12 words each)
- Optional: Large statistic callout in bottom right

**Content Elements**:
- Headline (e.g., "THE PROBLEM")
- 3 bullet points describing pain points
- Optional statistic with label

**Prompt Template**:
```
Problem slide with Warm Cream background. Left accent bar in Deep Black. Headline "[HEADLINE]" at top (Inter 600, 28px). Three bullet points below:
- [BULLET 1]
- [BULLET 2]
- [BULLET 3]
If statistic provided, render large callout: "[STAT]" in IBM Plex Mono 48px with label below.
```

### 4. Solution Slide

**Description**: Presents the company's solution with key benefits.

**Layout**: Value-prop-benefits
- Light background (white or warm cream)
- Bold headline
- Value proposition statement
- 3-4 benefit cards or bullet points

**Content Elements**:
- Headline (e.g., "OUR SOLUTION")
- Value proposition (1-2 sentences)
- Benefits list (3-4 items)

**Prompt Template**:
```
Solution slide with light background. Headline "[HEADLINE]" in Inter 600, 28-36px. Value proposition "[VALUE_PROP]" as prominent subheadline. Three to four benefits listed below with clear visual hierarchy. Use ARC Violet for accent elements.
```

### 5. Why Now Slide

**Description**: Market timing and convergence of trends.

**Layout**: Trend-cards (horizontal)
- Light background
- 3 horizontal trend cards
- Each card: Title + brief description
- Accent color for card headers

**Content Elements**:
- Headline (e.g., "WHY NOW")
- 3 trend items with titles and descriptions

**Prompt Template**:
```
Why Now slide with light background. Headline "[HEADLINE]" at top. Three horizontal trend cards below, each with:
- Title in Inter 600, 18px with ARC Violet accent
- Description in Inter 400, 14px
Cards should have subtle shadows and clean borders. Equal spacing between cards.
```

### 6. Market Size Visualization (TAM/SAM/SOM)

**Description**: Nested concentric circles showing market opportunity layers.

**Layout**: Nested-circles
- White background
- Three concentric circles
- Dollar amounts in IBM Plex Mono
- Clear labels for each tier

**Content Elements**:
- Headline (e.g., "MARKET OPPORTUNITY")
- TAM amount and label
- SAM amount and label
- SOM amount and label

**Prompt Template**:
```
Market size slide with white background. Headline at top. Three nested concentric circles:
- Outer (TAM): [AMOUNT], labeled "[LABEL]"
- Middle (SAM): [AMOUNT], labeled "[LABEL]"
- Inner (SOM): [AMOUNT], labeled "[LABEL]"
Dollar amounts in IBM Plex Mono 32-48px. Use primary color gradient from outer to inner.
```

### 7. Competitive Positioning Matrix

**Description**: 2x2 quadrant chart showing competitive landscape.

**Layout**: 2x2-matrix
- White background
- Clear axis labels
- Company dot in upper-right quadrant (accent color, larger)
- Competitor dots in gray with labels

**Content Elements**:
- Headline (e.g., "COMPETITIVE POSITIONING")
- X-axis label
- Y-axis label
- Company position
- Competitor positions

**Prompt Template**:
```
Competition slide with 2x2 matrix. Headline at top.
X-axis: "[X_LABEL]" (low to high, left to right)
Y-axis: "[Y_LABEL]" (low to high, bottom to top)
Position [COMPANY] in upper-right quadrant with large ARC Violet dot.
Position competitors with smaller gray dots and labels.
Subtle gridlines, professional appearance.
```

### 8. Product Slide

**Description**: Product visualization with key features.

**Layout**: Product-features (two-column)
- Light background
- Left: Product visual/architecture diagram
- Right: Numbered features list

**Content Elements**:
- Headline (e.g., "THE PRODUCT")
- Product description
- Features list (3-5 items)

**Prompt Template**:
```
Product slide with two-column layout. Headline at top. Left side: Clean product/architecture visualization. Right side: Numbered list of [N] key features in Inter 400 with feature titles in Inter 600. Technical but accessible styling.
```

### 9. Business Model Slide

**Description**: Revenue streams and unit economics.

**Layout**: Revenue-cards
- Light background
- Revenue stream cards (2-3)
- Unit economics section below or right

**Content Elements**:
- Headline (e.g., "BUSINESS MODEL")
- Revenue streams with descriptions
- Unit economics metrics

**Prompt Template**:
```
Business model slide showing revenue streams and economics. Headline at top.
Revenue stream cards: [LIST]
Unit economics section: [METRICS in IBM Plex Mono]
Clean financial presentation with clear hierarchy.
```

### 10. Traction / Timeline Slide

**Description**: Key metrics and milestones showing progress.

**Layout**: Metrics-timeline
- Light background
- Large metric callouts at top (2-4 key numbers)
- Horizontal timeline below

**Content Elements**:
- Headline (e.g., "TRACTION")
- Key metrics (2-4 with labels)
- Timeline milestones

**Prompt Template**:
```
Traction slide with metrics and timeline. Headline at top.
Large metric callouts (IBM Plex Mono, 48-64px):
[METRIC 1] - [LABEL]
[METRIC 2] - [LABEL]
Horizontal timeline below with milestone markers at: [DATES/EVENTS]
Use ARC Violet for milestone markers.
```

### 11. Team Slide

**Description**: Founder/leadership team with credentials.

**Layout**: Team-cards (grid)
- Light background
- 3-5 team member cards
- Each card: Photo placeholder circle, name, title, key credential

**Content Elements**:
- Headline (e.g., "THE TEAM")
- Team members with name, title, credential

**Prompt Template**:
```
Team slide with grid of member cards. Headline at top.
For each member, create a card with:
- Circular photo placeholder (gray or company color)
- Name in Inter 600, 16px
- Title in Inter 400, 14px
- Key credential in Inter 400, 12px, muted color
Cards arranged in balanced grid with equal spacing.
```

### 12. Ask / Funding Slide

**Description**: Funding request with use of funds and milestones.

**Layout**: Ask-funds-milestones
- Light background
- Large funding amount as hero element
- Use of funds breakdown (horizontal bar or segments)
- Key milestones below

**Content Elements**:
- Headline (e.g., "THE ASK")
- Funding amount
- Use of funds allocation
- Next milestones

**Prompt Template**:
```
Ask slide with funding request. Headline at top.
Large funding amount "[AMOUNT]" as hero (IBM Plex Mono, 64px, ARC Violet).
Use of funds as horizontal stacked bar or segments:
[CATEGORY]: [PERCENT]%
Key milestones section below showing what funds will achieve.
Professional, confident presentation.
```

---

## Quality Requirements

For ALL generated slides:
1. **Text Rendering**: All text must be perfectly crisp and readable
2. **Color Accuracy**: Use exact hex values from style guide
3. **Consistency**: Maintain visual language across all 12 slides
4. **Resolution**: Output at 1920x1080 (16:9)
5. **No Artifacts**: No watermarks, borders, or stock imagery
6. **Completeness**: Include ALL content elements specified

## Narrative Flow

Slides should reflect their position in the story arc:
- **Slides 1-2** (Title, Purpose): Bold, confident opening
- **Slides 3-5** (Problem, Solution, Why Now): Building urgency then relief
- **Slides 6-9** (Market, Competition, Product, Business): Establishing opportunity
- **Slides 10-11** (Traction, Team): Proof and credibility
- **Slide 12** (Ask): Clear call to action
