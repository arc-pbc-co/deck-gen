/**
 * =============================================================================
 * Nano Banana Pro Image Generator Agent
 * =============================================================================
 *
 * Phase 4 (Part 2): Image Generation Agent
 * Uses Gemini 3 Pro Image (Nano Banana Pro) to generate charts, diagrams,
 * and graphics for the investor deck.
 */

const { BaseAgent, AgentError } = require("./base-agent");
const fs = require("fs");
const path = require("path");

// =============================================================================
// Rate Limiting Configuration
// =============================================================================

const IMAGE_GENERATION_CONFIG = {
  minDelayBetweenCalls: 3000, // 3 seconds minimum between calls (increased for 12 images)
  maxRetries: 5, // Retry attempts
  baseBackoffMs: 3000, // 3 second base backoff
  maxBackoffMs: 60000, // Max 60 second backoff (increased for more images)
  jitterFactor: 0.2, // Add 20% random jitter to prevent thundering herd
};

// =============================================================================
// Nano Banana Pro Generator Agent
// =============================================================================

class NanoBananaGenerator extends BaseAgent {
  constructor(config = {}) {
    super(config);
    this.agentType = "image-generator";
    this.provider = "google";
    this.model = config.model || "gemini-3-pro-image-preview";
    this.client = null;
    this.generativeModel = null;

    // Rate limiting state
    this.lastCallTime = 0;
    this.imageConfig = { ...IMAGE_GENERATION_CONFIG, ...config.imageConfig };

    // Override retry settings for image generation
    this.retryAttempts = this.imageConfig.maxRetries;
    this.retryDelay = this.imageConfig.baseBackoffMs;

    // Track failed prompts for debugging
    this.failedPrompts = [];
  }

  /**
   * Ensure minimum delay between API calls to avoid rate limiting
   */
  async enforceRateLimit() {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastCallTime;

    if (timeSinceLastCall < this.imageConfig.minDelayBetweenCalls) {
      const waitTime = this.imageConfig.minDelayBetweenCalls - timeSinceLastCall;
      this.log("debug", `Rate limiting: waiting ${waitTime}ms before next call`);
      await this.delay(waitTime);
    }

    this.lastCallTime = Date.now();
  }

  /**
   * Calculate backoff with jitter for retries
   */
  calculateBackoffWithJitter(attempt) {
    const baseDelay =
      this.imageConfig.baseBackoffMs * Math.pow(2, attempt - 1);
    const cappedDelay = Math.min(baseDelay, this.imageConfig.maxBackoffMs);
    const jitter =
      cappedDelay * this.imageConfig.jitterFactor * Math.random();
    return Math.floor(cappedDelay + jitter);
  }

  /**
   * Initialize the Google AI client for image generation
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

    this.log("info", `Initialized Nano Banana Pro with model: ${this.model}`);
  }

  /**
   * Main execution method
   */
  async execute(input) {
    const { imagePromptsPath, outputDir, designConfig, styleGuidePath, storyGuidePath } = input;

    this.log("info", "Starting full slide image generation with Nano Banana Pro...");

    // Initialize client unless dry-run mode is active
    if (!this.shouldSkipAPICall()) {
      await this.initClient();
    }

    // Load image prompts
    const imagePrompts = this.loadJSON(imagePromptsPath);

    // Load style guide and story for consistent prompt building
    this.styleGuide = styleGuidePath ? this.loadText(styleGuidePath) : "";
    this.storyGuide = storyGuidePath ? this.loadText(storyGuidePath) : "";

    // Create assets directory
    const assetsDir = path.join(outputDir, "assets");
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }

    // Generate each image
    const generatedImages = {};
    const imageTypes = Object.keys(imagePrompts);

    this.log("info", `Generating ${imageTypes.length} images...`);

    for (const imageType of imageTypes) {
      const promptData = imagePrompts[imageType];
      this.log("info", `Generating: ${imageType}`);

      try {
        // Enforce rate limiting between calls
        await this.enforceRateLimit();

        const imagePath = await this.generateImage(
          imageType,
          promptData,
          designConfig,
          assetsDir
        );
        generatedImages[imageType] = imagePath;
        this.log("info", `  -> ${path.basename(imagePath)}`);
      } catch (error) {
        this.log("error", `Failed to generate ${imageType}`, {
          error: error.message,
        });
        generatedImages[imageType] = null;

        // Track failed prompt for debugging
        this.failedPrompts.push({
          imageType,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Save failed prompts for debugging if any failures occurred
    if (this.failedPrompts.length > 0) {
      const failedPromptsPath = path.join(
        outputDir,
        "..",
        "intermediate",
        "failed-image-prompts.json"
      );
      this.saveJSON(failedPromptsPath, {
        generatedAt: new Date().toISOString(),
        model: this.model,
        failures: this.failedPrompts,
      });
      this.log("warn", `Saved ${this.failedPrompts.length} failed prompts to ${failedPromptsPath}`);
    }

    // Save manifest of generated images
    const manifest = {
      generatedAt: new Date().toISOString(),
      model: this.model,
      images: generatedImages,
      costIncurred: this.costTracker.totalCost,
    };
    this.saveJSON(path.join(outputDir, "generated-images.json"), manifest);

    this.log("info", "Image generation complete");
    this.log("info", `Generated: ${Object.values(generatedImages).filter(Boolean).length}/${imageTypes.length}`);
    this.log("info", `Cost: $${this.costTracker.totalCost.toFixed(4)}`);

    return manifest;
  }

  /**
   * Generate a single image
   */
  async generateImage(imageType, promptData, designConfig, outputDir) {
    // Build the generation prompt
    const prompt = this.buildImagePrompt(imageType, promptData, designConfig);

    // Log the prompt for debugging
    this.logPromptIfEnabled("image", prompt, { imageType });

    // Check for dry-run mode
    if (this.shouldSkipAPICall()) {
      this.logDryRun(`generate ${imageType} image`, this.estimateTokens(prompt));
      return this.generateMockImagePath(imageType, outputDir);
    }

    // Call Nano Banana Pro
    const imageData = await this.callNanoBanana(prompt, imageType);

    // Validate the image data
    const validation = this.validateImageData(imageData);
    if (!validation.valid) {
      throw new AgentError(`Image validation failed: ${validation.reason}`);
    }

    // Save the image
    const filename = `${imageType.toLowerCase().replace(/\s+/g, "-")}.png`;
    const filepath = path.join(outputDir, filename);

    // Decode base64 and save
    const buffer = Buffer.from(imageData, "base64");
    fs.writeFileSync(filepath, buffer);

    return filepath;
  }

  /**
   * Generate a mock image path for dry-run mode
   */
  generateMockImagePath(imageType, outputDir) {
    const filename = `${imageType.toLowerCase().replace(/\s+/g, "-")}.png`;
    return path.join(outputDir, filename);
  }

  /**
   * Validate image data is usable
   */
  validateImageData(base64Data) {
    try {
      const buffer = Buffer.from(base64Data, "base64");

      // Check minimum size (1KB - reject tiny/placeholder images)
      if (buffer.length < 1024) {
        return { valid: false, reason: "Image too small (likely placeholder)" };
      }

      // Check for valid PNG header (89 50 4E 47)
      const pngHeader = buffer.slice(0, 4).toString("hex");
      if (pngHeader !== "89504e47") {
        // Check for JPEG header (FF D8)
        const jpegHeader = buffer.slice(0, 2).toString("hex");
        if (jpegHeader !== "ffd8") {
          return { valid: false, reason: "Invalid image format (not PNG or JPEG)" };
        }
      }

      return { valid: true, size: buffer.length };
    } catch (e) {
      return { valid: false, reason: `Validation error: ${e.message}` };
    }
  }

  /**
   * Build comprehensive full-slide image generation prompt
   * Includes style guide essentials, narrative context, and complete slide content
   */
  buildImagePrompt(imageType, promptData, designConfig) {
    const colors = designConfig || {};
    const primaryColor = colors.primaryColor || "0A0A0A";
    const secondaryColor = colors.secondaryColor || "1E3A5F";
    const accentColor = colors.accentColor || "5E5CE6";

    // Start with style guide reference if available
    let prompt = "";

    if (promptData.styleGuideReference) {
      prompt += promptData.styleGuideReference + "\n\n";
    } else {
      // Inline essential style guide rules
      prompt += `## MANDATORY VISUAL SPECIFICATIONS

### Colors (use EXACT hex values)
- Deep Black: #0A0A0A (dark backgrounds)
- Soft Black: #111111 (text on light backgrounds)
- Warm Cream: #E8E6E1 (light backgrounds)
- Pure White: #FFFFFF (text on dark backgrounds)
- ARC Violet: #5E5CE6 (accent color, highlights)
- Data Cyan: #00D4FF (data visualization)
- Status Green: #22C55E (positive indicators)

### Typography (render ALL text crisply)
- Headlines: Inter 600 weight, 28-36px
- Body text: Inter 400 weight, 14-18px
- Large metrics: IBM Plex Mono 500 weight, 48-64px
- Labels: Inter 500 UPPERCASE, 12px, letter-spacing +0.1em

### Layout Rules
- Full slide dimensions: 1920x1080 (16:9)
- Margins: 0.5 inches (48px) on all sides
- Maintain 40% minimum negative space
- Left accent bar when used: 0.15in (14px) wide

`;
    }

    // Add narrative context if available
    if (promptData.narrativeContext) {
      prompt += promptData.narrativeContext + "\n\n";
    }

    // Add slide type and main description
    prompt += `## SLIDE TYPE: ${imageType.toUpperCase()}\n\n`;
    prompt += `${promptData.description || `Generate a complete ${imageType} slide`}\n\n`;

    // Add complete slide content to render
    if (promptData.content) {
      prompt += `## SLIDE CONTENT (render ALL text exactly as shown)\n\n`;
      prompt += this.formatContentForPrompt(promptData.content) + "\n\n";
    }

    // Add layout specification
    if (promptData.layout) {
      prompt += `## LAYOUT: ${promptData.layout}\n\n`;
    }

    // Add style notes
    prompt += `## STYLE NOTES\n${promptData.style || "Professional, minimal, corporate design."}\n\n`;

    // Add specific elements based on slide type
    if (promptData.textElements && promptData.textElements.length > 0) {
      prompt += `## KEY TEXT ELEMENTS\n${promptData.textElements.join("\n")}\n\n`;
    }

    // Add positions for competition matrix
    if (promptData.positions && promptData.positions.length > 0) {
      prompt += `## POSITIONING (for 2x2 matrix)\n`;
      for (const p of promptData.positions) {
        const highlight = p.highlight ? " [HIGHLIGHT WITH ACCENT COLOR]" : "";
        prompt += `- ${p.name}: position (${p.x}, ${p.y})${highlight}\n`;
      }
      prompt += "\n";
    }

    // Add milestones for timeline
    if (promptData.milestones && promptData.milestones.length > 0) {
      prompt += `## MILESTONES (for timeline)\n`;
      for (const m of promptData.milestones) {
        if (typeof m === "object") {
          prompt += `- ${m.date || m.year}: ${m.event || m.description}\n`;
        } else {
          prompt += `- ${m}\n`;
        }
      }
      prompt += "\n";
    }

    // Add segments for use of funds
    if (promptData.segments && promptData.segments.length > 0) {
      prompt += `## FUND ALLOCATION SEGMENTS\n`;
      for (const s of promptData.segments) {
        prompt += `- ${s.category}: ${s.percent}%\n`;
      }
      prompt += "\n";
    }

    // Final rendering requirements
    prompt += `## OUTPUT REQUIREMENTS
- Resolution: ${promptData.dimensions || "1920x1080"} (16:9 aspect ratio)
- All text MUST be crisp, sharp, and perfectly readable
- Use exact colors from style guide specifications above
- Professional investor presentation quality
- No watermarks, decorative borders, or stock imagery
- This is a COMPLETE slide image - include ALL visual elements

Generate the full slide now.`;

    return prompt;
  }

  /**
   * Format slide content object into readable prompt text
   */
  formatContentForPrompt(content) {
    if (!content || typeof content !== "object") return "";

    let formatted = "";

    for (const [key, value] of Object.entries(content)) {
      if (value === null || value === undefined || value === "") continue;

      const label = key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (str) => str.toUpperCase())
        .trim();

      if (Array.isArray(value)) {
        if (value.length > 0) {
          formatted += `${label}:\n`;
          for (const item of value) {
            if (typeof item === "object") {
              // Handle nested objects (e.g., team members, revenue streams)
              const itemStr = Object.entries(item)
                .filter(([, v]) => v)
                .map(([k, v]) => `${k}: ${v}`)
                .join(", ");
              formatted += `  - ${itemStr}\n`;
            } else {
              formatted += `  - ${item}\n`;
            }
          }
        }
      } else if (typeof value === "object") {
        formatted += `${label}:\n`;
        for (const [subKey, subValue] of Object.entries(value)) {
          if (subValue) {
            formatted += `  ${subKey}: ${subValue}\n`;
          }
        }
      } else {
        formatted += `${label}: ${value}\n`;
      }
    }

    return formatted;
  }

  /**
   * Call Nano Banana Pro API for image generation
   */
  async callNanoBanana(prompt, imageType = "unknown") {
    return await this.withRetry(async () => {
      this.log("debug", `Calling Nano Banana Pro API for ${imageType}...`);
      const startTime = Date.now();

      try {
        // Use Gemini's image generation capability
        const result = await this.generativeModel.generateContent({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            responseModalities: ["IMAGE", "TEXT"],
          },
        });

        const response = result.response;
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        this.log("debug", `API call completed in ${elapsed}s`);

        // Extract image data from response
        // The response format may vary - handle different possibilities
        let imageData = null;

        // Check for inline data in parts
        for (const candidate of response.candidates || []) {
          for (const part of candidate.content?.parts || []) {
            if (part.inlineData?.data) {
              imageData = part.inlineData.data;
              break;
            }
          }
          if (imageData) break;
        }

        // Alternative: check for image in response directly
        if (!imageData && response.inlineData?.data) {
          imageData = response.inlineData.data;
        }

        if (!imageData) {
          // Log the full response for debugging
          this.log("error", `No image data in response for ${imageType}`, {
            hasResponse: !!response,
            candidateCount: response?.candidates?.length || 0,
            responseKeys: response ? Object.keys(response) : [],
          });
          throw new AgentError(
            `No image data in response for ${imageType}. ` +
            `Response had ${response?.candidates?.length || 0} candidates.`
          );
        }

        // Track costs (approximate for image generation)
        const inputTokens = this.estimateTokens(prompt);
        const outputTokens = 1000; // Approximate for image
        this.costTracker.addUsage(this.provider, this.model, inputTokens, outputTokens);

        this.log("debug", `Successfully received image data for ${imageType}`);
        return imageData;
      } catch (error) {
        // Log detailed error information
        this.log("error", `API error for ${imageType}`, {
          errorMessage: error.message,
          errorCode: error.code,
          errorName: error.name,
        });

        // Handle specific API errors
        if (error.message?.includes("not supported")) {
          this.log("warn", `Image generation not supported for ${imageType}, generating placeholder`);
          return this.generatePlaceholderImage(imageType, "Image generation not supported by API");
        }
        throw error;
      }
    });
  }

  /**
   * Generate a placeholder image (base64 PNG) when API fails
   * Returns a pre-generated gray placeholder image (no external dependencies)
   */
  generatePlaceholderImage(imageType = "Unknown", errorMessage = "Generation failed") {
    this.log("info", `Generating placeholder for ${imageType}: ${errorMessage}`);
    // Pre-generated 400x225 light gray PNG with border (16:9 aspect ratio)
    // This is a simple but visible placeholder that works without canvas
    return this.generateBasicPlaceholder();
  }

  /**
   * Generate a basic gray placeholder
   * Pre-encoded PNG that renders as a visible light gray rectangle with border
   */
  generateBasicPlaceholder() {
    // This is a pre-generated 400x225 PNG (16:9 aspect ratio)
    // Light gray (#f3f4f6) background with darker gray (#d1d5db) border
    // Generated once and encoded as base64 to avoid external dependencies
    return (
      "iVBORw0KGgoAAAANSUhEUgAAAZAAAADhCAIAAADKjSE+AAAABGdBTUEAALGPC/xhBQAAAAlwS" +
      "FlzAAAOwgAADsIBFShKgAAAABl0RVh0U29mdHdhcmUAcGFpbnQubmV0IDQuMC4xNkRpr/UAAA" +
      "NzSURBVHic7dIxAQAADMOg+0/f3hgEPQkAAPibBgAAMJkAAIBJAACYBACASwAAmAQAgEkAAJg" +
      "EAIBJAACYBACASQCA/7YBADCZAACASQCA/7YBAIB/twEAMMa2AQAwxrYBADDGtgEAMMa2AQAw" +
      "xrYBADDGtgEAMMa2AQAwxrYBADDGtgEAMMa2AQAwxrYBADDGtgEAMMa2AQAwxrYBADDGtgEAM" +
      "Ma2AQAwxrYBADDGtgEAMMa2AQAwxrYBADDGtgEAMMa2AQAwxrYBADDGtgEAMMa2AQAwxrYBAD" +
      "DGtgEAMMa2AQAwxrYBADDGtgEAMMa2AQAwxrYBADDGtgEAMMa2AQAwxrYBADDGtgEAMMa2AQA" +
      "wxrYBADDGtgEAMMa2AQAwxrYBADDGtgEAMMa2AQAwxrYBADDGtgEAMMa2AQAwxrYBADDGtgEA" +
      "MMa2AQAwxrYBADDGtgEAMMa2AQAwxrYBADDGtgEAMMa2AQAwxrYBADDGtgEAMMa2AQAwxrYBA" +
      "DDGtgEAMMa2AQAwxrYBADDGtgEAMMa2AQAwxrYBADDGtgEAMMa2AQAwxrYBADDGtgEAMMa2AQ" +
      "AwxrYBADDGtgEAMJkAAJNJAABY2wYAwNg2AAC+bQMA4Ns2AAC+bQMA4Ns2AAC+bQMA4Ns2AAC" +
      "+bQMA4Ns2AAC+bQMA4Ns2AAC+bQMA4Ns2AAC+bQMA4Ns2AAC+bQMA4Ns2AAC+bQMA4Ns2AAC+" +
      "bQMA4Ns2AAC+bQMA4Ns2AAC+bQMA4Ns2AAC+bQMA4Ns2AAC+bQMA4Ns2AAC+bQMA4Ns2AAC+b" +
      "QMA4Ns2AAC+bQMA4Ns2AAC+bQMA4Ns2AAC+bQMA4Ns2AAC+bQMA4Ns2AAC+bQMA4Ns2AAC+bQ" +
      "MA4Ns2AAC+bQMA4Ns2AAC+bQMA4Ns2AAC+bQMA4Ns2AAC+bQMA4Ns2AAC+bQMA4Ns2AAC+bQM" +
      "A4Ns2AAC+bQMA4Ns2AAC+bQMA4Ns2AAC+bQMA4Ns2AAC+bQMAYGwbAACTSQAAWNsGAMDYNgAA" +
      "vm0DAODbNgAAvm0DAODbNgAAvm0DAODbNgAAvm0DAODbNgAAvm0DAODbNgAAvm0DAODbNgAAvm0" +
      "DAODbNgAAvm0DAODbNgAAvm0DAODbNgAAvm0DAODbNgAAvm0DAODbNgAAvm0DAODbNgAAvm0DAO" +
      "DbNgAAxrYBADC2DQCAsW0AAIxtAwBgbBsAAGPbAAAY2wYAwNg2AADGtgEAMLYNAICxbQAAjG0" +
      "DAGBsGwAAY9sAABj7AEn6Ac+lqzJUAAAAAElFTkSuQmCC"
    );
  }

  /**
   * Generate all images from a deck config (convenience method)
   */
  async generateFromDeckConfig(deckConfig, outputDir) {
    const imagePrompts = deckConfig.imagePrompts || {};
    const designConfig = deckConfig.design || {};

    // Create temporary prompts file
    const promptsPath = path.join(outputDir, "temp-image-prompts.json");
    this.saveJSON(promptsPath, imagePrompts);

    try {
      const result = await this.execute({
        imagePromptsPath: promptsPath,
        outputDir,
        designConfig,
      });

      // Clean up temp file
      fs.unlinkSync(promptsPath);

      return result;
    } catch (error) {
      // Clean up temp file on error
      if (fs.existsSync(promptsPath)) {
        fs.unlinkSync(promptsPath);
      }
      throw error;
    }
  }
}

// =============================================================================
// Exports
// =============================================================================

module.exports = { NanoBananaGenerator };
