/**
 * =============================================================================
 * Prompt Logger Utility
 * =============================================================================
 *
 * Utility for logging and persisting prompts during pipeline execution.
 * Enables debugging, auditing, and dry-run mode for the multi-agent pipeline.
 */

const fs = require("fs");
const path = require("path");

class PromptLogger {
  constructor(outputDir, options = {}) {
    this.outputDir = outputDir;
    this.dryRun = options.dryRun || false;
    this.prompts = [];
    this.promptsDir = path.join(outputDir, "intermediate", "prompts");

    // Ensure directory exists
    if (!fs.existsSync(this.promptsDir)) {
      fs.mkdirSync(this.promptsDir, { recursive: true });
    }
  }

  /**
   * Log a prompt before sending to LLM
   * @param {string} agentName - Name of the agent (e.g., 'classifier', 'synthesizer')
   * @param {string} promptType - Type of prompt ('system', 'user', 'image')
   * @param {string} content - The prompt content
   * @param {object} metadata - Additional context (model, temperature, etc.)
   * @returns {string} - Path to saved prompt file
   */
  logPrompt(agentName, promptType, content, metadata = {}) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `${timestamp}_${agentName}_${promptType}.md`;
    const filepath = path.join(this.promptsDir, filename);

    const fullContent = this.formatPromptFile(
      agentName,
      promptType,
      content,
      metadata
    );

    fs.writeFileSync(filepath, fullContent);

    const tokenEstimate = Math.ceil(content.length / 4);

    this.prompts.push({
      timestamp: new Date().toISOString(),
      agentName,
      promptType,
      filepath,
      filename,
      metadata,
      tokenEstimate,
      contentLength: content.length,
    });

    return filepath;
  }

  /**
   * Format a prompt file with metadata header
   */
  formatPromptFile(agentName, promptType, content, metadata) {
    const tokenEstimate = Math.ceil(content.length / 4);

    return `# Prompt: ${agentName} - ${promptType}

## Metadata
- **Agent:** ${agentName}
- **Type:** ${promptType}
- **Model:** ${metadata.model || "N/A"}
- **Temperature:** ${metadata.temperature ?? "N/A"}
- **Max Tokens:** ${metadata.maxTokens || "N/A"}
- **Timestamp:** ${new Date().toISOString()}
- **Token Estimate:** ~${tokenEstimate}
- **Character Count:** ${content.length}
${metadata.documentFilename ? `- **Document:** ${metadata.documentFilename}` : ""}
${metadata.imageType ? `- **Image Type:** ${metadata.imageType}` : ""}

## Prompt Content

\`\`\`
${content}
\`\`\`
`;
  }

  /**
   * Save manifest of all logged prompts
   * @returns {string} - Path to manifest file
   */
  saveManifest() {
    const manifestPath = path.join(this.promptsDir, "prompt-manifest.json");
    let existingPrompts = [];

    if (fs.existsSync(manifestPath)) {
      try {
        const existing = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
        if (Array.isArray(existing.prompts)) {
          existingPrompts = existing.prompts;
        }
      } catch (error) {
        // If existing manifest is corrupt, replace it with current data.
      }
    }

    const mergedByFilename = new Map();
    for (const prompt of [...existingPrompts, ...this.prompts]) {
      mergedByFilename.set(prompt.filename, prompt);
    }
    const mergedPrompts = Array.from(mergedByFilename.values()).sort((a, b) =>
      a.timestamp.localeCompare(b.timestamp)
    );

    const manifest = {
      generatedAt: new Date().toISOString(),
      dryRun: this.dryRun,
      totalPrompts: mergedPrompts.length,
      totalTokensEstimate: mergedPrompts.reduce(
        (sum, p) => sum + p.tokenEstimate,
        0
      ),
      totalCharacters: mergedPrompts.reduce(
        (sum, p) => sum + p.contentLength,
        0
      ),
      promptsByAgent: this.getPromptsByAgent(mergedPrompts),
      prompts: mergedPrompts,
    };

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    return manifestPath;
  }

  /**
   * Get prompts grouped by agent name
   */
  getPromptsByAgent(prompts = this.prompts) {
    const byAgent = {};
    for (const prompt of prompts) {
      if (!byAgent[prompt.agentName]) {
        byAgent[prompt.agentName] = {
          count: 0,
          totalTokens: 0,
          prompts: [],
        };
      }
      byAgent[prompt.agentName].count++;
      byAgent[prompt.agentName].totalTokens += prompt.tokenEstimate;
      byAgent[prompt.agentName].prompts.push(prompt.filename);
    }
    return byAgent;
  }

  /**
   * Check if dry-run mode is enabled
   */
  isDryRun() {
    return this.dryRun;
  }

  /**
   * Get all logged prompts
   */
  getPrompts() {
    return this.prompts;
  }

  /**
   * Get total token estimate
   */
  getTotalTokenEstimate() {
    return this.prompts.reduce((sum, p) => sum + p.tokenEstimate, 0);
  }

  /**
   * Clear all logged prompts (useful for testing)
   */
  clear() {
    this.prompts = [];
  }
}

module.exports = { PromptLogger };
