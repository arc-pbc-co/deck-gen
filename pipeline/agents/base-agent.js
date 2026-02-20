/**
 * =============================================================================
 * Base Agent Class
 * =============================================================================
 *
 * Abstract base class for all LLM agents in the multi-agent pipeline.
 * Provides common functionality: retry logic, validation, logging, cost tracking.
 */

const fs = require("fs");
const path = require("path");

// =============================================================================
// Cost Tracking
// =============================================================================

class CostTracker {
  constructor(maxCost = 50.0) {
    this.maxCost = maxCost;
    this.totalCost = 0;
    this.breakdown = {};
    this.calls = [];
  }

  /**
   * Add usage for a provider/model call
   */
  addUsage(provider, model, inputTokens, outputTokens) {
    const rates = this.getRates(provider, model);
    const cost =
      (inputTokens / 1000) * rates.input + (outputTokens / 1000) * rates.output;

    this.totalCost += cost;
    this.breakdown[provider] = (this.breakdown[provider] || 0) + cost;

    this.calls.push({
      timestamp: new Date().toISOString(),
      provider,
      model,
      inputTokens,
      outputTokens,
      cost,
    });

    if (this.totalCost > this.maxCost) {
      throw new CostLimitError(
        `Cost limit exceeded: $${this.totalCost.toFixed(2)} > $${this.maxCost}`
      );
    }

    return cost;
  }

  /**
   * Get approximate rates per 1K tokens (as of Jan 2026)
   */
  getRates(provider, model) {
    const rates = {
      anthropic: {
        "claude-sonnet-4-20250514": { input: 0.003, output: 0.015 },
        "claude-3-5-sonnet-20241022": { input: 0.003, output: 0.015 },
      },
      openai: {
        "gpt-5.2": { input: 0.01, output: 0.03 },
        "gpt-4o": { input: 0.005, output: 0.015 },
        "gpt-4-turbo": { input: 0.01, output: 0.03 },
      },
      google: {
        "gemini-2.0-flash": { input: 0.000075, output: 0.0003 },
        "gemini-3-pro-image-preview": { input: 0.00025, output: 0.001 },
      },
    };
    return rates[provider]?.[model] || { input: 0.01, output: 0.03 };
  }

  /**
   * Get summary of costs
   */
  getSummary() {
    return {
      totalCost: this.totalCost,
      breakdown: this.breakdown,
      callCount: this.calls.length,
      averageCostPerCall:
        this.calls.length > 0 ? this.totalCost / this.calls.length : 0,
    };
  }
}

// =============================================================================
// Custom Errors
// =============================================================================

class AgentError extends Error {
  constructor(message, originalError = null, context = {}) {
    super(message);
    this.name = "AgentError";
    this.originalError = originalError;
    this.context = context;
    this.timestamp = new Date().toISOString();
  }
}

class CostLimitError extends AgentError {
  constructor(message) {
    super(message);
    this.name = "CostLimitError";
  }
}

class ValidationError extends AgentError {
  constructor(message, errors = []) {
    super(message);
    this.name = "ValidationError";
    this.errors = errors;
  }
}

class RetryExhaustedError extends AgentError {
  constructor(message, attempts, lastError) {
    super(message, lastError);
    this.name = "RetryExhaustedError";
    this.attempts = attempts;
  }
}

// =============================================================================
// Base Agent Class
// =============================================================================

class BaseAgent {
  constructor(config = {}) {
    this.config = config;
    this.retryAttempts = config.retryAttempts || 3;
    this.retryDelay = config.retryDelay || 1000;
    this.costTracker = new CostTracker(config.maxCost || 50.0);
    this.verbose = config.verbose || false;

    // Agent identification
    this.agentName = this.constructor.name;
    this.agentType = "base";

    // Prompt logging and dry-run support
    this.promptLogger = config.promptLogger || null;
    this.dryRun = config.dryRun || false;
  }

  // ===========================================================================
  // Abstract Methods (to be implemented by subclasses)
  // ===========================================================================

  /**
   * Execute the agent's main task
   * @param {object} input - Input data for the agent
   * @returns {Promise<object>} - Agent output
   */
  async execute(input) {
    throw new Error("execute() must be implemented by subclass");
  }

  // ===========================================================================
  // Prompt Logging & Dry-Run Support
  // ===========================================================================

  /**
   * Log a prompt if prompt logging is enabled
   * @param {string} promptType - Type of prompt ('system', 'user', 'image')
   * @param {string} content - The prompt content
   * @param {object} metadata - Additional metadata
   * @returns {string|null} - Path to saved prompt file, or null if logging disabled
   */
  logPromptIfEnabled(promptType, content, metadata = {}) {
    if (this.promptLogger) {
      return this.promptLogger.logPrompt(this.agentName, promptType, content, {
        model: this.model,
        temperature: this.temperature,
        maxTokens: this.maxTokens,
        ...metadata,
      });
    }
    return null;
  }

  /**
   * Check if API calls should be skipped (dry-run mode)
   * @returns {boolean}
   */
  shouldSkipAPICall() {
    return this.dryRun;
  }

  /**
   * Log dry-run information
   * @param {string} operation - Description of the operation that would be performed
   * @param {number} tokenEstimate - Estimated tokens for the operation
   */
  logDryRun(operation, tokenEstimate = 0) {
    this.log("info", `[DRY-RUN] Would ${operation} (~${tokenEstimate} tokens)`);
  }

  // ===========================================================================
  // Retry Logic
  // ===========================================================================

  /**
   * Execute a function with retry logic and exponential backoff
   */
  async withRetry(fn, context = {}) {
    let lastError;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        if (this.isRetryable(error)) {
          this.log(
            "warn",
            `Attempt ${attempt}/${this.retryAttempts} failed, retrying...`,
            {
              error: error.message,
              code: error.code,
            }
          );

          if (attempt < this.retryAttempts) {
            await this.delay(this.retryDelay * Math.pow(2, attempt - 1));
          }
        } else {
          // Non-retryable error, throw immediately
          throw new AgentError(
            `Non-retryable error: ${error.message}`,
            error,
            context
          );
        }
      }
    }

    throw new RetryExhaustedError(
      `All ${this.retryAttempts} attempts failed`,
      this.retryAttempts,
      lastError
    );
  }

  /**
   * Determine if an error is retryable
   */
  isRetryable(error) {
    const retryableCodes = [
      "rate_limit_exceeded",
      "server_error",
      "timeout",
      "ECONNRESET",
      "ETIMEDOUT",
      "ENOTFOUND",
      "overloaded_error",
      "service_unavailable",
    ];

    const retryableMessages = [
      "timeout",
      "rate limit",
      "overloaded",
      "503",
      "502",
      "500",
      "temporarily unavailable",
    ];

    if (error.code && retryableCodes.includes(error.code)) {
      return true;
    }

    const messageLower = (error.message || "").toLowerCase();
    return retryableMessages.some((msg) => messageLower.includes(msg));
  }

  /**
   * Delay for a specified number of milliseconds
   */
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ===========================================================================
  // Validation
  // ===========================================================================

  /**
   * Validate input against a schema
   */
  validateInput(input, schema) {
    const errors = this.validateObject(input, schema, "input");
    if (errors.length > 0) {
      throw new ValidationError("Input validation failed", errors);
    }
    return true;
  }

  /**
   * Validate output against a schema
   */
  validateOutput(output, schema) {
    const errors = this.validateObject(output, schema, "output");
    if (errors.length > 0) {
      throw new ValidationError("Output validation failed", errors);
    }
    return true;
  }

  /**
   * Simple schema validation (can be extended with ajv for full JSON Schema)
   */
  validateObject(obj, schema, context = "") {
    const errors = [];

    if (!schema) return errors;

    // Check required fields
    if (schema.required) {
      for (const field of schema.required) {
        if (obj[field] === undefined || obj[field] === null) {
          errors.push(`${context}.${field} is required`);
        }
      }
    }

    // Check field types
    if (schema.properties) {
      for (const [field, fieldSchema] of Object.entries(schema.properties)) {
        if (obj[field] !== undefined) {
          const fieldType = Array.isArray(obj[field])
            ? "array"
            : typeof obj[field];

          if (fieldSchema.type && fieldType !== fieldSchema.type) {
            errors.push(
              `${context}.${field} should be ${fieldSchema.type}, got ${fieldType}`
            );
          }
        }
      }
    }

    return errors;
  }

  // ===========================================================================
  // Logging
  // ===========================================================================

  /**
   * Structured logging
   */
  log(level, message, data = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      agent: this.agentName,
      level,
      message,
      ...data,
    };

    const prefix = `[${this.agentName}]`;

    switch (level) {
      case "error":
        console.error(`${prefix} ERROR: ${message}`, data);
        break;
      case "warn":
        console.warn(`${prefix} WARN: ${message}`, data);
        break;
      case "info":
        console.log(`${prefix} ${message}`);
        break;
      case "debug":
        if (this.verbose) {
          console.log(`${prefix} DEBUG: ${message}`, data);
        }
        break;
      default:
        console.log(`${prefix} ${message}`);
    }

    return logEntry;
  }

  // ===========================================================================
  // File Operations
  // ===========================================================================

  /**
   * Load a JSON file
   */
  loadJSON(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new AgentError(`File not found: ${filePath}`);
    }
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content);
  }

  /**
   * Save a JSON file
   */
  saveJSON(filePath, data) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    this.log("info", `Saved: ${filePath}`);
  }

  /**
   * Load a text/markdown file
   */
  loadText(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new AgentError(`File not found: ${filePath}`);
    }
    return fs.readFileSync(filePath, "utf-8");
  }

  /**
   * Save a text file
   */
  saveText(filePath, content) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content);
    this.log("info", `Saved: ${filePath}`);
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Extract JSON from LLM response (handles code blocks)
   */
  extractJSON(responseText) {
    let jsonStr = null;

    // Try to extract JSON from code blocks first
    const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    } else {
      // Try to find raw JSON object
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }
    }

    if (!jsonStr) {
      throw new AgentError("Could not extract JSON from response");
    }

    // Try parsing as-is first
    try {
      return JSON.parse(jsonStr);
    } catch (e) {
      // Try to fix common JSON issues from LLMs
      this.log("debug", `Initial JSON parse failed: ${e.message}, attempting repair...`);
    }

    // Attempt to repair common JSON issues
    let repaired = this.repairJSON(jsonStr);

    // Try parsing repaired JSON
    try {
      const result = JSON.parse(repaired);
      this.log("info", "Successfully repaired and parsed JSON");
      return result;
    } catch (e2) {
      // Log the problematic JSON for debugging
      this.log("error", `JSON repair failed: ${e2.message}`);

      // Save problematic JSON to file for debugging
      const debugPath = `/tmp/json-parse-error-${Date.now()}.json`;
      try {
        fs.writeFileSync(debugPath, jsonStr);
        this.log("info", `Saved problematic JSON to: ${debugPath}`);
      } catch (writeErr) {
        // Ignore write errors
      }

      throw new AgentError(`Could not parse JSON from response: ${e2.message}`);
    }
  }

  /**
   * Attempt to repair malformed JSON from LLM responses
   */
  repairJSON(jsonStr) {
    let repaired = jsonStr;

    // 1. Remove trailing commas before ] or }
    repaired = repaired.replace(/,(\s*[\]}])/g, "$1");

    // 2. Fix missing commas between array elements or object properties
    // Pattern: "value" followed by whitespace then another "key" or value
    // e.g., "foo" \n "bar" should be "foo", \n "bar"
    repaired = repaired.replace(/("|\d|true|false|null|\]|\})(\s*\n\s*)("|\[|\{)/g, "$1,$2$3");

    // 3. Fix missing commas between } and { in arrays
    repaired = repaired.replace(/\}(\s*)\{/g, "},$1{");

    // 4. Fix missing commas between ] and [ in arrays
    repaired = repaired.replace(/\](\s*)\[/g, "],$1[");

    // 5. Fix missing commas between ] and {
    repaired = repaired.replace(/\](\s*)\{/g, "],$1{");

    // 6. Fix missing commas between } and [
    repaired = repaired.replace(/\}(\s*)\[/g, "},$1[");

    // 7. Fix double commas
    repaired = repaired.replace(/,\s*,/g, ",");

    // 8. Process the JSON character by character to fix string escaping issues
    repaired = this.fixStringEscaping(repaired);

    // 9. Ensure JSON is properly closed (truncated responses)
    repaired = this.closeOpenBrackets(repaired);

    return repaired;
  }

  /**
   * Fix string escaping issues in JSON
   */
  fixStringEscaping(jsonStr) {
    let result = "";
    let inString = false;
    let escapeNext = false;

    for (let i = 0; i < jsonStr.length; i++) {
      const char = jsonStr[i];

      if (escapeNext) {
        result += char;
        escapeNext = false;
        continue;
      }

      if (char === "\\") {
        escapeNext = true;
        result += char;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        result += char;
        continue;
      }

      if (inString) {
        // Escape control characters within strings
        if (char === "\n") {
          result += "\\n";
        } else if (char === "\r") {
          result += "\\r";
        } else if (char === "\t") {
          result += "\\t";
        } else if (char.charCodeAt(0) < 32) {
          // Other control characters - escape as unicode
          result += "\\u" + char.charCodeAt(0).toString(16).padStart(4, "0");
        } else {
          result += char;
        }
      } else {
        result += char;
      }
    }

    return result;
  }

  /**
   * Close any open brackets/braces in truncated JSON
   */
  closeOpenBrackets(jsonStr) {
    const stack = [];
    let inString = false;
    let escapeNext = false;

    for (let i = 0; i < jsonStr.length; i++) {
      const char = jsonStr[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === "\\") {
        escapeNext = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === "{") stack.push("}");
        else if (char === "[") stack.push("]");
        else if (char === "}" || char === "]") {
          if (stack.length > 0 && stack[stack.length - 1] === char) {
            stack.pop();
          }
        }
      }
    }

    // Close any unclosed string
    if (inString) {
      jsonStr += '"';
    }

    // Close any unclosed brackets
    while (stack.length > 0) {
      jsonStr += stack.pop();
    }

    return jsonStr;
  }

  /**
   * Truncate text to a maximum length
   */
  truncateText(text, maxLength, suffix = "\n\n[... truncated ...]") {
    if (text.length <= maxLength) {
      return text;
    }
    return text.slice(0, maxLength - suffix.length) + suffix;
  }

  /**
   * Get token estimate (rough approximation: ~4 chars per token)
   */
  estimateTokens(text) {
    return Math.ceil(text.length / 4);
  }

  /**
   * Get cost summary
   */
  getCostSummary() {
    return this.costTracker.getSummary();
  }
}

// =============================================================================
// Exports
// =============================================================================

module.exports = {
  BaseAgent,
  CostTracker,
  AgentError,
  CostLimitError,
  ValidationError,
  RetryExhaustedError,
};
