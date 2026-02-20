# Configuration Guide

## User Inputs

The pipeline uses two user-provided files to guide content generation:

### story.md

Located at: `user-inputs/story.md`

This file defines the narrative arc of your investor deck. It tells the AI agents what story you want to tell and how to structure the flow.

**Template structure:**

```markdown
# Investor Deck Story Arc

## Opening Hook
What's the attention-grabbing opening? What big vision or problem statement?

## Act 1: The Problem
What pain point are you solving? Who experiences it? How severe is it?

## Act 2: The Solution
How does your product/service solve this? What makes it unique?

## Act 3: Why Now
What market timing factors make this the right moment?

## Act 4: The Opportunity
What's the market size? What's the business potential?

## Key Messages to Emphasize
- Message 1
- Message 2
- Message 3

## Things to Avoid
- Don't mention X
- Avoid framing Y as Z

## Target Audience
Who is this deck for? (VCs, angels, strategic partners, etc.)
```

See `user-inputs/examples/story-example.md` for a complete example.

### style-guide.md

Located at: `user-inputs/style-guide.md`

This file defines the tone, terminology, and style preferences for your deck.

**Template structure:**

```markdown
# Style Guide

## Voice & Tone
Authoritative / Visionary / Technical / Approachable
Describe the personality of the writing.

## Preferred Terminology
- Use "platform" not "tool"
- Use "partners" not "customers"
- Use specific industry terms

## Forbidden Terminology
- Avoid buzzwords like "synergy"
- Don't use competitor names
- Avoid uncertain language

## Content Guidelines
- Maximum words per bullet point
- Citation style preferences
- Number formatting (use M/B for millions/billions)

## Visual Preferences
- Color associations
- Chart style preferences
- Image style (photos vs illustrations)
```

See `user-inputs/examples/style-guide-example.md` for a complete example.

## Pipeline Configuration

### pipeline-config.json

Located at: `pipeline/config/pipeline-config.json`

Controls agent models, parameters, and pipeline behavior.

**Key sections:**

```json
{
  "agents": {
    "classifier": {
      "model": "claude-sonnet-4-20250514",
      "maxTokens": 8192,
      "temperature": 0.2
    },
    "synthesizer": {
      "model": "gpt-5.2",
      "reasoningMode": "extended_thinking",
      "maxTokens": 16384,
      "temperature": 0.3
    },
    "generator": {
      "model": "gemini-2.0-flash",
      "maxTokens": 8192
    },
    "imageGenerator": {
      "model": "gemini-3-pro-image-preview"
    }
  }
}
```

### Reasoning Modes

The synthesizer agent supports three reasoning modes:

| Mode | Description | Use Case |
|------|-------------|----------|
| `standard` | Fast generation | Quick iterations, drafts |
| `extended_thinking` | More reasoning steps | **Default** - balanced quality/speed |
| `deep_research` | Maximum depth | Final production, cross-referencing |

Change the mode via command line:

```bash
./pipeline/run-pipeline.sh --mode deep_research
```

### Design Settings

Customize colors and fonts in `pipeline-config.json`:

```json
{
  "design": {
    "primaryColor": "1E3A5F",
    "secondaryColor": "4A90D9",
    "accentColor": "F5A623",
    "fontTitle": "Georgia",
    "fontHeading": "Arial",
    "fontBody": "Calibri"
  }
}
```

### Company Information

```json
{
  "company": {
    "name": "Your Company Name",
    "shortName": "YCN"
  }
}
```

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Claude API key for Phase 2 |
| `OPENAI_API_KEY` | OpenAI API key for Phase 3 |
| `GOOGLE_AI_API_KEY` | Google AI key for Phase 4 |

### Optional Model Overrides

```bash
# Override default models
CLAUDE_MODEL=claude-sonnet-4-20250514
OPENAI_MODEL=gpt-5.2
GEMINI_MODEL=gemini-2.0-flash
NANO_BANANA_MODEL=gemini-3-pro-image-preview
```

### Optional Cost Controls

```bash
# Set cost limits
MAX_TOKENS_PER_CALL=16384
MAX_COST_PER_RUN=25.00
```
