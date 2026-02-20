/**
 * =============================================================================
 * Gemini Generator Agent
 * =============================================================================
 *
 * Phase 4 (Part 1): Final Generation Agent
 * Uses Gemini 3 Pro to polish synthesis output and generate final deck-config.json.
 */

const { BaseAgent, AgentError } = require("./base-agent");
const { SLIDE_TYPES } = require("./claude-classifier");
const path = require("path");

// =============================================================================
// Gemini Generator Agent
// =============================================================================

class GeminiGenerator extends BaseAgent {
  constructor(config = {}) {
    super(config);
    this.agentType = "generator";
    this.provider = "google";
    this.model = config.model || "gemini-3-pro-preview";
    this.maxTokens = config.maxTokens || 8192;
    this.client = null;
    this.generativeModel = null;
  }

  /**
   * Initialize the Google AI client
   */
  async initClient() {
    if (this.client) return;

    if (!process.env.GOOGLE_AI_API_KEY) {
      throw new AgentError(
        "GOOGLE_AI_API_KEY environment variable is required.\n" +
          "Set it with: export GOOGLE_AI_API_KEY='your-api-key'"
      );
    }

    // Dynamic import for ES module
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    this.client = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
    this.generativeModel = this.client.getGenerativeModel({
      model: this.model,
    });

    this.log("info", `Initialized Gemini client with model: ${this.model}`);
  }

  /**
   * Main execution method
   */
  async execute(input) {
    const { synthesisOutputPath, styleGuidePath, storyGuidePath, outputDir, pipelineConfig } = input;

    this.log("info", "Starting final generation (text polish)...");

    // Initialize client unless dry-run mode is active
    if (!this.shouldSkipAPICall()) {
      await this.initClient();
    }

    // Load inputs
    const synthesisOutput = this.loadJSON(synthesisOutputPath);
    const styleGuide = this.loadText(styleGuidePath);
    const storyGuide = storyGuidePath ? this.loadText(storyGuidePath) : "";

    // Load system prompt
    const systemPromptPath = path.join(
      __dirname,
      "../config/agent-prompts/generator-system.md"
    );
    const systemPrompt = this.loadText(systemPromptPath);

    // Build prompt
    const prompt = this.buildPrompt(synthesisOutput, styleGuide, storyGuide, pipelineConfig, systemPrompt);

    this.log("info", `Prompt size: ${Math.round(prompt.length / 1024)}KB`);

    // Call Gemini
    const response = await this.callGemini(prompt);

    // Extract JSON from response
    const deckConfig = this.extractJSON(response);

    // Validate final output
    this.validateDeckConfig(deckConfig);

    // Ensure design settings from config
    if (pipelineConfig?.design) {
      deckConfig.design = { ...pipelineConfig.design, ...deckConfig.design };
    }

    // Save final deck config
    this.saveJSON(path.join(outputDir, "deck-config.json"), deckConfig);

    // Extract image prompts for Nano Banana Pro (all 12 slide types)
    const imagePrompts = this.generateFullSlideImagePrompts(deckConfig, styleGuide, storyGuide);
    this.saveJSON(path.join(outputDir, "image-prompts.json"), imagePrompts);

    this.log("info", "Text generation complete");
    this.log("info", `Cost: $${this.costTracker.totalCost.toFixed(4)}`);

    return { deckConfig, imagePrompts };
  }

  /**
   * Build prompt for Gemini
   */
  buildPrompt(synthesisOutput, styleGuide, storyGuide, pipelineConfig, systemPrompt) {
    const designConfig = pipelineConfig?.design || {};
    const companyConfig = pipelineConfig?.company || {};

    return `
${systemPrompt}

## Design Configuration

\`\`\`json
${JSON.stringify(designConfig, null, 2)}
\`\`\`

## Company Information

Name: ${companyConfig.name || synthesisOutput.company?.name || "[Company Name]"}
Short Name: ${companyConfig.shortName || ""}

## Style Guide

${styleGuide}

## Story Arc & Narrative

${storyGuide}

## Synthesis Output to Polish

\`\`\`json
${JSON.stringify(synthesisOutput, null, 2)}
\`\`\`

## Instructions

1. Polish all slide content for maximum investor impact
2. Ensure cross-slide consistency (names, terms, metrics)
3. Apply style guide constraints strictly
4. Ensure narrative follows the story arc
5. Output the final deck-config.json

Return ONLY valid JSON wrapped in \`\`\`json code blocks.
`;
  }

  /**
   * Call Gemini API
   */
  async callGemini(prompt) {
    // Log prompt for debugging/auditing
    this.logPromptIfEnabled("user", prompt);

    // Check for dry-run mode
    if (this.shouldSkipAPICall()) {
      this.logDryRun("call Gemini generator", this.estimateTokens(prompt));
      return this.generateMockGeneratorResponse();
    }

    return await this.withRetry(async () => {
      this.log("info", "Calling Gemini API...");
      const startTime = Date.now();

      const result = await this.generativeModel.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      this.log("info", `API call completed in ${elapsed}s`);

      // Estimate tokens (Gemini doesn't always return usage)
      const inputTokens = this.estimateTokens(prompt);
      const outputTokens = this.estimateTokens(text);
      this.costTracker.addUsage(this.provider, this.model, inputTokens, outputTokens);

      return text;
    });
  }

  /**
   * Generate mock generator response for dry-run mode
   */
  generateMockGeneratorResponse() {
    const slides = SLIDE_TYPES.map((type) => ({
      type,
      headline: `[DRY-RUN] Mock ${type} headline`,
      content: `[DRY-RUN] Mock content for ${type}`,
    }));

    return JSON.stringify({
      company: { name: "[DRY-RUN] Mock Company" },
      design: {
        primaryColor: "1E3A5F",
        secondaryColor: "4A90D9",
        accentColor: "F5A623",
      },
      slides,
      imagePrompts: {
        marketSize: {
          description: "[DRY-RUN] Mock market size image prompt",
          style: "Professional",
          dimensions: "1920x1080",
        },
      },
      metadata: {
        dryRun: true,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Validate final deck config
   */
  validateDeckConfig(config) {
    const errors = [];
    const warnings = [];

    // Check required fields
    if (!config.company?.name) errors.push("Missing company.name");
    if (!config.design) warnings.push("Missing design object");
    if (!config.slides || !Array.isArray(config.slides)) {
      errors.push("Missing or invalid slides array");
    }

    // Check all slide types present
    if (config.slides) {
      const foundTypes = new Set(config.slides.map((s) => s.type));
      for (const type of SLIDE_TYPES) {
        if (!foundTypes.has(type)) {
          warnings.push(`Missing slide type: ${type}`);
        }
      }

      // Check for TBD entries
      const tbdCount = JSON.stringify(config.slides).match(/\[TBD/g)?.length || 0;
      if (tbdCount > 0) {
        warnings.push(`Found ${tbdCount} [TBD] entries in slides`);
      }
    }

    if (errors.length > 0) {
      throw new AgentError(`Deck config validation failed: ${errors.join(", ")}`);
    }

    if (warnings.length > 0) {
      this.log("warn", "Validation warnings:", { warnings });
    }

    return { valid: true, errors, warnings };
  }

  /**
   * Generate full slide image prompts for all 12 slide types
   * Each prompt includes complete content for Nano Banana Pro to render as a full slide image
   */
  generateFullSlideImagePrompts(deckConfig, styleGuide, storyGuide) {
    const design = deckConfig.design || {};
    const primaryColor = design.primaryColor || "0A0A0A";
    const secondaryColor = design.secondaryColor || "1E3A5F";
    const accentColor = design.accentColor || "5E5CE6";
    const company = deckConfig.company || {};

    const prompts = {};
    const slides = deckConfig.slides || [];

    // Define story arc positions for each slide type
    const storyArcPositions = {
      title: { position: 1, phase: "Opening Hook", tone: "Bold, confident" },
      purpose: { position: 2, phase: "Opening Hook", tone: "Mission-driven, authoritative" },
      problem: { position: 3, phase: "Act 1: The Problem", tone: "Urgent, compelling" },
      solution: { position: 4, phase: "Act 2: The Solution", tone: "Confident, clear" },
      whyNow: { position: 5, phase: "Act 3: Why Now", tone: "Timely, opportunistic" },
      marketSize: { position: 6, phase: "Act 4: The Opportunity", tone: "Ambitious, data-driven" },
      competition: { position: 7, phase: "Act 4: The Opportunity", tone: "Strategic, differentiated" },
      product: { position: 8, phase: "Act 2: The Solution", tone: "Technical, innovative" },
      businessModel: { position: 9, phase: "Act 4: The Opportunity", tone: "Pragmatic, scalable" },
      traction: { position: 10, phase: "Validation", tone: "Proven, momentum-driven" },
      team: { position: 11, phase: "Validation", tone: "Credible, experienced" },
      ask: { position: 12, phase: "Call to Action", tone: "Direct, compelling" },
    };

    // Generate prompts for each slide type
    for (const slide of slides) {
      const slideType = slide.type;
      const arcInfo = storyArcPositions[slideType] || { position: 0, phase: "General", tone: "Professional" };

      // Build narrative context
      const narrativeContext = `
## NARRATIVE CONTEXT
Slide position: ${arcInfo.position} of 12
Story arc phase: ${arcInfo.phase}
Emotional tone: ${arcInfo.tone}
`;

      // Generate type-specific prompt
      const typePrompt = this.buildSlideTypePrompt(slideType, slide, company, design);

      prompts[slideType] = {
        slideType,
        description: typePrompt.description,
        content: typePrompt.content,
        layout: typePrompt.layout,
        style: `Professional investor presentation. Use exact colors: primary #${primaryColor}, secondary #${secondaryColor}, accent #${accentColor}. ${typePrompt.styleNotes || ""}`,
        dimensions: "1920x1080",
        narrativeContext: narrativeContext.trim(),
        styleGuideReference: this.extractStyleGuideEssentials(styleGuide),
      };
    }

    return prompts;
  }

  /**
   * Build slide-type-specific prompt content
   */
  buildSlideTypePrompt(slideType, slide, company, design) {
    const templates = {
      title: () => ({
        description: "Full title slide with company name and tagline centered on dark background",
        content: {
          companyName: company.name || slide.companyName || "[Company Name]",
          tagline: slide.tagline || "",
          subtitle: slide.subtitle || "",
        },
        layout: "centered-hero",
        styleNotes: "Deep black background (#0A0A0A). Company name in large white text (Inter 600, 48-64px). Tagline in warm cream italic (Newsreader, 24px). Subtle accent line below tagline.",
      }),

      purpose: () => ({
        description: "Purpose/mission statement slide with left accent bar",
        content: {
          headline: slide.headline || "OUR PURPOSE",
          statement: slide.statement || slide.mission || "",
        },
        layout: "statement-hero",
        styleNotes: "Warm cream background (#E8E6E1). Left accent bar in deep black (0.15in wide). Large statement text centered. Minimal, impactful.",
      }),

      problem: () => ({
        description: "Problem slide with headline, bullets, and optional statistic callout",
        content: {
          headline: slide.headline || "THE PROBLEM",
          bullets: slide.bullets || slide.painPoints || [],
          statistic: slide.statistic || null,
          statisticLabel: slide.statisticLabel || null,
        },
        layout: "headline-bullets-stat",
        styleNotes: "Warm cream background. Left accent bar. 3 bullets max, 12 words each. Statistic callout in IBM Plex Mono (48px) if present.",
      }),

      solution: () => ({
        description: "Solution slide with value proposition and key benefits",
        content: {
          headline: slide.headline || "OUR SOLUTION",
          valueProp: slide.valueProp || slide.description || "",
          benefits: slide.benefits || slide.keyPoints || [],
        },
        layout: "value-prop-benefits",
        styleNotes: "Light background. Bold headline. Value prop in larger text. 3-4 benefits with visual hierarchy.",
      }),

      whyNow: () => ({
        description: "Why Now slide with trend cards showing market timing",
        content: {
          headline: slide.headline || "WHY NOW",
          trends: slide.trends || slide.drivers || [],
        },
        layout: "trend-cards",
        styleNotes: "3 horizontal trend cards. Each card has title + description. Clean card styling with subtle shadows. Accent color for card headers.",
      }),

      marketSize: () => ({
        description: "Market size slide with TAM/SAM/SOM visualization",
        content: {
          headline: slide.headline || "MARKET OPPORTUNITY",
          tam: slide.tam || "",
          tamLabel: slide.tamLabel || "Total Addressable Market",
          sam: slide.sam || "",
          samLabel: slide.samLabel || "Serviceable Addressable Market",
          som: slide.som || "",
          somLabel: slide.somLabel || "Serviceable Obtainable Market",
        },
        layout: "nested-circles",
        styleNotes: "White background. Nested concentric circles: TAM (outer), SAM (middle), SOM (inner). Large dollar amounts in IBM Plex Mono. Clear labels.",
      }),

      competition: () => ({
        description: "Competitive positioning 2x2 matrix",
        content: {
          headline: slide.headline || "COMPETITIVE POSITIONING",
          xAxisLabel: slide.xAxisLabel || "Feature A",
          yAxisLabel: slide.yAxisLabel || "Feature B",
          competitors: slide.competitors || [],
          companyPosition: { x: 0.85, y: 0.85 },
        },
        layout: "2x2-matrix",
        styleNotes: "White background. Clear axis labels. Company dot in upper-right quadrant with accent color. Competitors as gray dots with labels.",
      }),

      product: () => ({
        description: "Product slide with architecture or feature visualization",
        content: {
          headline: slide.headline || "THE PRODUCT",
          description: slide.description || "",
          features: slide.features || [],
        },
        layout: "product-features",
        styleNotes: "Clean product visualization. Numbered features on right side. Technical but accessible styling.",
      }),

      businessModel: () => ({
        description: "Business model slide with revenue streams and unit economics",
        content: {
          headline: slide.headline || "BUSINESS MODEL",
          revenueStreams: slide.revenueStreams || [],
          unitEconomics: slide.unitEconomics || [],
        },
        layout: "revenue-cards",
        styleNotes: "Revenue stream cards with descriptions. Unit economics as key metrics. Clean financial presentation styling.",
      }),

      traction: () => ({
        description: "Traction slide with key metrics and timeline",
        content: {
          headline: slide.headline || "TRACTION",
          metrics: slide.metrics || [],
          milestones: slide.milestones || [],
        },
        layout: "metrics-timeline",
        styleNotes: "Large metric callouts (IBM Plex Mono, 48-64px). Horizontal timeline below. Accent color for milestone markers.",
      }),

      team: () => ({
        description: "Team slide with founder/leadership cards",
        content: {
          headline: slide.headline || "THE TEAM",
          members: slide.members || slide.team || [],
        },
        layout: "team-cards",
        styleNotes: "Team member cards with photo placeholder circles, name, title, and key credential. Clean, professional layout.",
      }),

      ask: () => ({
        description: "Ask slide with funding amount, use of funds, and milestones",
        content: {
          headline: slide.headline || "THE ASK",
          amount: slide.amount || slide.fundingAmount || "",
          useOfFunds: slide.useOfFunds || [],
          milestones: slide.milestones || slide.nextMilestones || [],
        },
        layout: "ask-funds-milestones",
        styleNotes: "Large funding amount hero (IBM Plex Mono, 64px). Use of funds as horizontal bar or segments. Key milestones below.",
      }),
    };

    const templateFn = templates[slideType];
    if (templateFn) {
      return templateFn();
    }

    // Default template for unknown types
    return {
      description: `Full slide for ${slideType}`,
      content: slide,
      layout: "generic",
      styleNotes: "Professional investor presentation styling.",
    };
  }

  /**
   * Extract essential style guide elements for injection into prompts
   */
  extractStyleGuideEssentials(styleGuide) {
    if (!styleGuide) return "";

    // Extract key sections from style guide (colors, typography, layout rules)
    return `
## MANDATORY VISUAL SPECIFICATIONS (from style guide)

### Colors
- Deep Black: #0A0A0A (dark backgrounds)
- Soft Black: #111111 (text on light)
- Warm Cream: #E8E6E1 (light backgrounds)
- Pure White: #FFFFFF (text on dark)
- ARC Violet: #5E5CE6 (accent, highlights)
- Status Green: #22C55E (positive indicators)
- Data Cyan: #00D4FF (data visualization)

### Typography
- Headlines: Inter 600, 28-36px
- Body text: Inter 400, 14-18px
- Metrics: IBM Plex Mono 500, 48-64px
- Labels: Inter 500 UPPERCASE, 12px, letter-spacing +0.1em
- Taglines: Newsreader italic, 24px

### Layout Rules
- Margins: 0.5 inches on all sides
- 40% minimum negative space
- Left accent bar: 0.15in wide when used
- Card padding: 0.15in internal

### Content Constraints
- Headlines: max 10 words
- Bullets: max 3 per slide, 12 words each
- Metrics: whole numbers (92% not 92.3%)
- Currency: $1.2B format
`;
  }

  /**
   * Generate default image prompts if not provided by Gemini
   * @deprecated Use generateFullSlideImagePrompts instead
   */
  generateDefaultImagePrompts(deckConfig) {
    const design = deckConfig.design || {};
    const primaryColor = design.primaryColor || "1E3A5F";
    const accentColor = design.accentColor || "F5A623";

    const prompts = {};

    // Find relevant slides
    const slides = deckConfig.slides || [];

    // Market size visualization
    const marketSlide = slides.find((s) => s.type === "marketSize");
    if (marketSlide) {
      prompts.marketSize = {
        description: `Professional nested concentric circles diagram showing market size. TAM (largest outer circle): ${marketSlide.tam || "$XXB"}. SAM (middle circle): ${marketSlide.sam || "$XXB"}. SOM (inner circle): ${marketSlide.som || "$XXB"}.`,
        style: `Clean, minimal business graphic. Use colors: primary #${primaryColor}, accent #${accentColor}. White background. Sans-serif labels. No decorative elements.`,
        dimensions: "1920x1080",
        textElements: [
          `TAM: ${marketSlide.tam || "TBD"}`,
          `SAM: ${marketSlide.sam || "TBD"}`,
          `SOM: ${marketSlide.som || "TBD"}`,
        ],
      };
    }

    // Competition matrix
    const competitionSlide = slides.find((s) => s.type === "competition");
    if (competitionSlide) {
      prompts.competition = {
        description: `2x2 competitive positioning matrix. X-axis: "${competitionSlide.xAxisLabel || "Feature A"}". Y-axis: "${competitionSlide.yAxisLabel || "Feature B"}". Company logo/dot in upper right quadrant.`,
        style: `Clean business graphic with subtle gridlines. Primary color #${primaryColor} for company dot. Gray dots for competitors. White background.`,
        dimensions: "1920x1080",
        positions: (competitionSlide.competitors || []).map((c) => ({
          name: c.name,
          x: c.x,
          y: c.y,
          highlight: c.isUs,
        })),
      };
    }

    // Traction timeline
    const tractionSlide = slides.find((s) => s.type === "traction");
    if (tractionSlide && tractionSlide.milestones) {
      prompts.traction = {
        description: `Horizontal timeline showing company milestones. Clean, professional style with milestone markers and brief labels.`,
        style: `Minimal timeline design. Accent color #${accentColor} for milestone dots. Dark text on white background.`,
        dimensions: "1920x1080",
        milestones: tractionSlide.milestones.slice(0, 5),
      };
    }

    // Use of funds
    const askSlide = slides.find((s) => s.type === "ask");
    if (askSlide && askSlide.useOfFunds) {
      prompts.useOfFunds = {
        description: `Horizontal stacked bar chart or pie chart showing use of funds allocation. Professional investor-ready style.`,
        style: `Clean financial graphic. Use brand color palette. Clear percentage labels.`,
        dimensions: "1920x1080",
        segments: askSlide.useOfFunds.map((u) => ({
          category: u.category,
          percent: u.percent,
        })),
      };
    }

    return prompts;
  }
}

// =============================================================================
// Exports
// =============================================================================

module.exports = { GeminiGenerator };
