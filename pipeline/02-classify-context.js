#!/usr/bin/env node
/**
 * =============================================================================
 * Phase 2: Context Classification
 * =============================================================================
 *
 * Uses Claude to analyze extracted PDF texts and classify content
 * relevance to each investor deck slide type.
 *
 * Inputs:
 *   - extracted-text/*.txt (individual PDF extractions)
 *   - user-inputs/story.md (narrative arc)
 *   - user-inputs/style-guide.md (style preferences)
 *
 * Outputs:
 *   - intermediate/classified-context.json
 *   - intermediate/relevance-matrix.json
 *
 * Usage:
 *   node 02-classify-context.js [options]
 *
 * Options:
 *   --verbose, -v    Show detailed progress
 *   --dry-run        Generate prompts without making API calls
 *   --help, -h       Show this help message
 *
 * Environment:
 *   ANTHROPIC_API_KEY - Required API key for Claude
 */

const path = require("path");
const fs = require("fs");

// Load environment variables from .env file
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const { ClaudeClassifier } = require("./agents/claude-classifier");
const { PromptLogger } = require("./utils/prompt-logger");

// =============================================================================
// Configuration
// =============================================================================

const SCRIPT_DIR = __dirname;
const PROJECT_ROOT = path.join(SCRIPT_DIR, "..");

const PATHS = {
  extractedTexts: path.join(PROJECT_ROOT, "extracted-text"),
  story: path.join(PROJECT_ROOT, "user-inputs/story.md"),
  styleGuide: path.join(PROJECT_ROOT, "user-inputs/style-guide.md"),
  output: path.join(PROJECT_ROOT, "intermediate"),
  config: path.join(SCRIPT_DIR, "config/pipeline-config.json"),
};

// =============================================================================
// CLI Argument Parsing
// =============================================================================

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    verbose: false,
    help: false,
    dryRun: false,
    unknown: [],
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--verbose":
      case "-v":
        options.verbose = true;
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      default:
        options.unknown.push(args[i]);
        break;
    }
  }

  return options;
}

function showHelp() {
  console.log(`
Phase 2: Context Classification

Uses Claude to analyze extracted documents and classify content
relevance to each investor deck slide type.

Usage:
  node 02-classify-context.js [options]

Options:
  --verbose, -v    Show detailed progress
  --dry-run        Generate prompts without making API calls
  --help, -h       Show this help message

Required Files:
  extracted-text/*.txt     Extracted PDF text files
  user-inputs/story.md     Narrative arc definition
  user-inputs/style-guide.md   Style preferences

Output Files:
  intermediate/classified-context.json   Classified content by slide
  intermediate/relevance-matrix.json     Document-to-slide relevance scores

Environment Variables:
  ANTHROPIC_API_KEY    Required: Your Anthropic API key
`);
}

function formatConflict(conflict) {
  if (typeof conflict === "string") return conflict;
  if (!conflict || typeof conflict !== "object") return String(conflict);

  const parts = [];
  if (conflict.type) parts.push(`[${conflict.type}]`);
  if (conflict.description) parts.push(conflict.description);
  if (conflict.field && Array.isArray(conflict.values)) {
    parts.push(`${conflict.field}: ${conflict.values.join(" vs ")}`);
  }
  if (conflict.severity) parts.push(`severity=${conflict.severity}`);

  return parts.join(" ") || JSON.stringify(conflict);
}

// =============================================================================
// Validation
// =============================================================================

function validateInputs({ skipApiKeyCheck = false } = {}) {
  const errors = [];

  // Check extracted texts directory
  if (!fs.existsSync(PATHS.extractedTexts)) {
    errors.push(`Extracted texts directory not found: ${PATHS.extractedTexts}`);
    errors.push("Run 01-extract-pdfs.sh first.");
  } else {
    const txtFiles = fs
      .readdirSync(PATHS.extractedTexts)
      .filter((f) => f.endsWith(".txt"));
    if (txtFiles.length === 0) {
      errors.push(`No .txt files found in ${PATHS.extractedTexts}`);
    }
  }

  // Check story file
  if (!fs.existsSync(PATHS.story)) {
    errors.push(`Story file not found: ${PATHS.story}`);
    errors.push("Create user-inputs/story.md with your narrative arc.");
  }

  // Check style guide file
  if (!fs.existsSync(PATHS.styleGuide)) {
    errors.push(`Style guide not found: ${PATHS.styleGuide}`);
    errors.push("Create user-inputs/style-guide.md with your style preferences.");
  }

  // Check API key
  if (!skipApiKeyCheck && !process.env.ANTHROPIC_API_KEY) {
    errors.push("ANTHROPIC_API_KEY environment variable not set.");
    errors.push("Set it with: export ANTHROPIC_API_KEY='your-api-key'");
  }

  return errors;
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log("========================================");
  console.log("Phase 2: Context Classification");
  console.log("========================================\n");

  // Parse arguments
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  if (options.unknown.length > 0) {
    console.error(`Unknown option(s): ${options.unknown.join(", ")}`);
    console.error("Use --help to see available options.");
    process.exit(1);
  }

  // Validate inputs
  const errors = validateInputs({ skipApiKeyCheck: options.dryRun });
  if (errors.length > 0) {
    console.error("Validation errors:");
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }

  // Load config if available
  let agentConfig = {
    verbose: options.verbose,
    dryRun: options.dryRun,
  };
  let promptLogger = null;

  if (fs.existsSync(PATHS.config)) {
    const pipelineConfig = JSON.parse(fs.readFileSync(PATHS.config, "utf-8"));
    if (pipelineConfig.agents?.classifier) {
      agentConfig = { ...agentConfig, ...pipelineConfig.agents.classifier };
    }

    if (options.dryRun || pipelineConfig.logging?.prompts === true) {
      promptLogger = new PromptLogger(PROJECT_ROOT, { dryRun: options.dryRun });
      agentConfig.promptLogger = promptLogger;
    }
  } else if (options.dryRun) {
    promptLogger = new PromptLogger(PROJECT_ROOT, { dryRun: true });
    agentConfig.promptLogger = promptLogger;
  }

  // Create classifier agent
  const classifier = new ClaudeClassifier(agentConfig);

  // Count documents
  const txtFiles = fs
    .readdirSync(PATHS.extractedTexts)
    .filter((f) => f.endsWith(".txt"));
  console.log(`Documents to classify: ${txtFiles.length}`);
  console.log(`Dry-run mode: ${options.dryRun ? "enabled" : "disabled"}`);
  console.log(`Story file: ${PATHS.story}`);
  console.log(`Style guide: ${PATHS.styleGuide}`);
  console.log(`Output directory: ${PATHS.output}\n`);

  try {
    // Run classification
    const startTime = Date.now();

    const result = await classifier.execute({
      extractedTextsDir: PATHS.extractedTexts,
      storyPath: PATHS.story,
      styleGuidePath: PATHS.styleGuide,
      outputDir: PATHS.output,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    // Print summary
    console.log("\n========================================");
    console.log("Classification Complete");
    console.log("========================================");
    console.log(`Time: ${elapsed}s`);
    console.log(`Documents processed: ${result.metadata.totalDocuments}`);
    console.log(`Cost: $${result.metadata.costIncurred.toFixed(4)}`);

    // Print slide coverage
    console.log("\nSlide Coverage:");
    for (const [slideType, data] of Object.entries(result.slides)) {
      const sourceCount = data.dataQuality.sourceCount;
      const completeness = (data.dataQuality.completeness * 100).toFixed(0);
      const status = sourceCount >= 3 ? "+" : sourceCount >= 1 ? "~" : "-";
      console.log(
        `  ${status} ${slideType.padEnd(15)} ${sourceCount} sources (${completeness}% complete)`
      );
    }

    // Print missing critical
    if (result.missingCritical.length > 0) {
      console.log("\nMissing Critical Information:");
      result.missingCritical.forEach((m) => console.log(`  - ${m}`));
    }

    // Print conflicts
    if (result.globalConflicts.length > 0) {
      console.log("\nData Conflicts Found:");
      result.globalConflicts
        .slice(0, 5)
        .forEach((c) => console.log(`  - ${formatConflict(c)}`));
      if (result.globalConflicts.length > 5) {
        console.log(`  ... and ${result.globalConflicts.length - 5} more`);
      }
    }

    if (promptLogger && promptLogger.getPrompts().length > 0) {
      const manifestPath = promptLogger.saveManifest();
      console.log(`\nPrompt manifest: ${manifestPath}`);
    }

    console.log("\nOutput files:");
    console.log(`  - ${PATHS.output}/classified-context.json`);
    console.log(`  - ${PATHS.output}/relevance-matrix.json`);
  } catch (error) {
    console.error("\n========================================");
    console.error("Classification Failed");
    console.error("========================================");
    console.error(error.message);

    if (options.verbose && error.stack) {
      console.error("\nStack trace:");
      console.error(error.stack);
    }

    if (promptLogger && promptLogger.getPrompts().length > 0) {
      const manifestPath = promptLogger.saveManifest();
      console.error(`\nPrompt manifest: ${manifestPath}`);
    }

    process.exit(1);
  }
}

main();
