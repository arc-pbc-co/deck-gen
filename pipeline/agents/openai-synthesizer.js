/**
 * =============================================================================
 * OpenAI Synthesizer Agent
 * =============================================================================
 *
 * Phase 3: Extended Thinking Synthesis Agent
 * Uses ChatGPT 5.2 with extended_thinking mode to synthesize classified content
 * into detailed slide content with citations.
 */

const { BaseAgent, AgentError } = require("./base-agent");
const { SLIDE_TYPES } = require("./claude-classifier");
const path = require("path");

// =============================================================================
// OpenAI Synthesizer Agent
// =============================================================================

class OpenAISynthesizer extends BaseAgent {
  constructor(config = {}) {
    super(config);
    this.agentType = "synthesizer";
    this.provider = "openai";
    this.model = config.model || "gpt-5.2";
    this.maxTokens = config.maxTokens || 16384;
    this.temperature = config.temperature || 0.3;
    this.reasoningMode = config.reasoningMode || "extended_thinking";
    this.client = null;
  }

  /**
   * Initialize the OpenAI client
   */
  async initClient() {
    if (this.client) return;

    if (!process.env.OPENAI_API_KEY) {
      throw new AgentError(
        "OPENAI_API_KEY environment variable is required.\n" +
          "Set it with: export OPENAI_API_KEY='your-api-key'"
      );
    }

    // Dynamic import for ES module
    const OpenAI = (await import("openai")).default;
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    this.log("info", `Initialized OpenAI client with model: ${this.model}`);
  }

  /**
   * Main execution method
   */
  async execute(input) {
    const { classifiedContextPath, storyPath, styleGuidePath, outputDir, pipelineConfig } =
      input;

    this.log("info", "Starting content synthesis...");

    // Initialize client unless dry-run mode is active
    if (!this.shouldSkipAPICall()) {
      await this.initClient();
    }

    // Load inputs
    const classifiedContext = this.loadJSON(classifiedContextPath);
    const story = this.loadText(storyPath);
    const styleGuide = this.loadText(styleGuidePath);

    // Load system prompt
    const systemPromptPath = path.join(
      __dirname,
      "../config/agent-prompts/synthesizer-system.md"
    );
    const systemPrompt = this.loadText(systemPromptPath);

    // Get reasoning mode suffix
    const reasoningModes = pipelineConfig?.reasoningModes || {};
    const modeSuffix = reasoningModes[this.reasoningMode]?.systemSuffix || "";

    // Build full system prompt with mode
    const fullSystemPrompt = `${systemPrompt}\n\n## Active Reasoning Mode: ${this.reasoningMode}\n${modeSuffix}`;

    // Build user prompt with classified context
    const userPrompt = this.buildUserPrompt(classifiedContext, story, styleGuide, pipelineConfig);

    this.log("info", `Reasoning mode: ${this.reasoningMode}`);
    this.log("info", `Prompt size: ${Math.round(userPrompt.length / 1024)}KB`);

    // Call OpenAI
    const response = await this.callOpenAI(fullSystemPrompt, userPrompt);

    // Extract JSON from response
    const synthesisOutput = this.extractJSON(response);

    // Validate output structure
    this.validateSynthesisOutput(synthesisOutput);

    // Add metadata
    synthesisOutput.metadata = synthesisOutput.metadata || {};
    synthesisOutput.metadata.synthesizedAt = new Date().toISOString();
    synthesisOutput.metadata.reasoningMode = this.reasoningMode;
    synthesisOutput.metadata.costIncurred = this.costTracker.totalCost;

    // Save outputs
    this.saveJSON(path.join(outputDir, "synthesis-output.json"), synthesisOutput);

    // Extract and save citations separately
    const citations = this.extractAllCitations(synthesisOutput);
    this.saveJSON(path.join(outputDir, "citations.json"), citations);

    this.log("info", "Synthesis complete");
    this.log("info", `Cost: $${this.costTracker.totalCost.toFixed(4)}`);

    return synthesisOutput;
  }

  /**
   * Build user prompt with classified context
   */
  buildUserPrompt(classifiedContext, story, styleGuide, pipelineConfig) {
    // Build slide-by-slide context
    const slideContexts = [];

    for (const slideType of SLIDE_TYPES) {
      const slideData = classifiedContext.slides?.[slideType];
      if (!slideData) continue;

      const relevantContent = this.formatSlideContext(slideType, slideData);
      slideContexts.push(relevantContent);
    }

    // Company info from config
    const companyInfo = pipelineConfig?.company || {};
    const designInfo = pipelineConfig?.design || {};

    return `
## Company Information

Name: ${companyInfo.name || "[Company Name]"}
Short Name: ${companyInfo.shortName || ""}

Design Settings:
\`\`\`json
${JSON.stringify(designInfo, null, 2)}
\`\`\`

## User's Desired Story Arc

${story}

## Style Guide Constraints

${styleGuide}

## Classified Context by Slide Type

${slideContexts.join("\n\n---\n\n")}

## Missing Critical Information

The classifier identified these gaps:
${(classifiedContext.missingCritical || []).map((m) => `- ${m}`).join("\n") || "- None identified"}

	## Data Conflicts

	The classifier found these conflicts to resolve:
	${(classifiedContext.globalConflicts || [])
    .slice(0, 10)
    .map((c) => `- ${this.formatConflict(c)}`)
    .join("\n") || "- None identified"}

## Instructions

Synthesize the classified content above into a complete deck-config.json with all 12 slides.

For each slide:
1. Use the most relevant content from the classified sources
2. Ensure every fact/metric has a citation
3. Include a reasoningTrace explaining your decisions
4. Apply the style guide constraints
5. Support the user's story arc narrative

	Return ONLY valid JSON wrapped in \`\`\`json code blocks.
	`;
  }

  /**
   * Format conflict objects for prompt readability
   */
  formatConflict(conflict) {
    if (typeof conflict === "string") return conflict;
    if (!conflict || typeof conflict !== "object") return String(conflict);

    const parts = [];
    if (conflict.type) parts.push(`[${conflict.type}]`);
    if (conflict.description) parts.push(conflict.description);
    if (conflict.field && Array.isArray(conflict.values)) {
      parts.push(`${conflict.field}: ${conflict.values.join(" vs ")}`);
    }
    if (conflict.recommendation) parts.push(`recommendation: ${conflict.recommendation}`);
    if (conflict.severity) parts.push(`severity=${conflict.severity}`);

    return parts.join(" ") || JSON.stringify(conflict);
  }

  /**
   * Format context for a single slide type
   */
  formatSlideContext(slideType, slideData) {
    const sources = slideData.relevantSources || [];
    const quality = slideData.dataQuality || {};

    let output = `### ${slideType.toUpperCase()}

Data Quality: ${(quality.completeness * 100).toFixed(0)}% complete, ${quality.sourceCount} sources

`;

    // Add content from each source
    for (const source of sources.slice(0, 5)) {
      // Limit to top 5 sources
      output += `**Source: ${source.filename}** (relevance: ${source.relevanceScore.toFixed(2)})\n`;

      const content = source.allContent || [];
      for (const item of content.slice(0, 10)) {
        // Limit items per source
        output += `- [${item.type}] ${item.content}`;
        if (item.confidence) {
          output += ` (confidence: ${item.confidence.toFixed(2)})`;
        }
        output += "\n";
      }
      output += "\n";
    }

    // Add conflicts if any
    const conflicts = slideData.conflicts || [];
    if (conflicts.length > 0) {
      output += "**Conflicts to resolve:**\n";
      for (const conflict of conflicts) {
        output += `- ${conflict.field}: ${conflict.values?.join(" vs ")} (${conflict.recommendation || "choose most recent"})\n`;
      }
    }

    return output;
  }

  /**
   * Call OpenAI API
   */
  async callOpenAI(systemPrompt, userPrompt) {
    // Log prompts for debugging/auditing
    this.logPromptIfEnabled("system", systemPrompt);
    this.logPromptIfEnabled("user", userPrompt);

    // Check for dry-run mode
    if (this.shouldSkipAPICall()) {
      const totalTokens = this.estimateTokens(systemPrompt) + this.estimateTokens(userPrompt);
      this.logDryRun("call OpenAI synthesis", totalTokens);
      return this.generateMockSynthesisResponse();
    }

    return await this.withRetry(async () => {
      this.log("info", "Calling OpenAI API...");
      const startTime = Date.now();

      try {
        const response = await this.client.chat.completions.create({
          model: this.model,
          max_completion_tokens: this.maxTokens,
          temperature: this.temperature,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        });

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        this.log("info", `API call completed in ${elapsed}s`);

        // Track costs
        const inputTokens = response.usage?.prompt_tokens || 0;
        const outputTokens = response.usage?.completion_tokens || 0;
        this.costTracker.addUsage(this.provider, this.model, inputTokens, outputTokens);

        this.log("info", `Tokens: ${inputTokens} in, ${outputTokens} out`);

        return response.choices[0].message.content;
      } catch (error) {
        if (error.code === "model_not_found") {
          this.log(
            "error",
            `Model '${this.model}' not found. Try 'gpt-4o' or 'gpt-4-turbo'.`
          );
        }
        throw error;
      }
    });
  }

  /**
   * Generate mock synthesis response for dry-run mode
   */
  generateMockSynthesisResponse() {
    const slides = SLIDE_TYPES.map((type) => ({
      type,
      content: {
        headline: `[DRY-RUN] Mock ${type} headline`,
        body: `[DRY-RUN] Mock content for ${type} slide`,
      },
      citations: [
        {
          fact: `[DRY-RUN] Mock citation for ${type}`,
          source: "mock-source.txt",
          confidence: 0.5,
        },
      ],
      reasoningTrace: `[DRY-RUN] Mock reasoning for ${type}`,
    }));

    return JSON.stringify({
      company: { name: "[DRY-RUN] Mock Company" },
      slides,
      metadata: {
        dryRun: true,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Validate synthesis output structure
   */
  validateSynthesisOutput(output) {
    const errors = [];
    const warnings = [];

    // Check required top-level fields
    if (!output.company?.name) warnings.push("Missing company.name");
    if (!output.slides || !Array.isArray(output.slides)) {
      errors.push("Missing or invalid slides array");
      return { valid: false, errors, warnings };
    }

    // Check slide types
    const foundTypes = new Set(output.slides.map((s) => s.type));
    for (const type of SLIDE_TYPES) {
      if (!foundTypes.has(type)) {
        warnings.push(`Missing slide type: ${type}`);
      }
    }

    // Check each slide has citations
    for (const slide of output.slides) {
      if (!slide.citations || slide.citations.length === 0) {
        warnings.push(`Slide '${slide.type}' has no citations`);
      }
    }

    if (errors.length > 0) {
      throw new AgentError(`Synthesis output validation failed: ${errors.join(", ")}`);
    }

    if (warnings.length > 0) {
      this.log("warn", "Validation warnings:", { warnings });
    }

    return { valid: true, errors, warnings };
  }

  /**
   * Extract all citations from synthesis output
   */
  extractAllCitations(output) {
    const citations = {
      extractedAt: new Date().toISOString(),
      totalCitations: 0,
      bySlide: {},
      bySource: {},
      lowConfidence: [],
    };

    for (const slide of output.slides || []) {
      citations.bySlide[slide.type] = [];

      for (const citation of slide.citations || []) {
        citations.totalCitations++;
        citations.bySlide[slide.type].push(citation);

        // Group by source
        const source = citation.source || "unknown";
        if (!citations.bySource[source]) {
          citations.bySource[source] = [];
        }
        citations.bySource[source].push({
          ...citation,
          slideType: slide.type,
        });

        // Track low confidence
        if (citation.confidence && citation.confidence < 0.7) {
          citations.lowConfidence.push({
            ...citation,
            slideType: slide.type,
          });
        }
      }
    }

    return citations;
  }
}

// =============================================================================
// Exports
// =============================================================================

module.exports = { OpenAISynthesizer };
