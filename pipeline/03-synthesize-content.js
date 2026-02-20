#!/usr/bin/env node
/**
 * =============================================================================
 * Phase 3: Content Synthesis
 * =============================================================================
 *
 * Uses ChatGPT 5.2 with extended_thinking mode to synthesize classified content
 * into detailed slide content with citations.
 *
 * Inputs:
 *   - intermediate/classified-context.json (from Phase 2)
 *   - user-inputs/story.md (narrative arc)
 *   - user-inputs/style-guide.md (style preferences)
 *
 * Outputs:
 *   - intermediate/synthesis-output.json
 *   - intermediate/citations.json
 *
 * Usage:
 *   node 03-synthesize-content.js [options]
 *
 * Options:
 *   --mode, -m       Reasoning mode: standard | extended_thinking | deep_research
 *   --verbose, -v    Show detailed progress
 *   --dry-run        Generate prompts without making API calls
 *   --help, -h       Show this help message
 *
 * Environment:
 *   OPENAI_API_KEY - Required API key for OpenAI
 */

const path = require("path");
const fs = require("fs");

// Load environment variables from .env file
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const { OpenAISynthesizer } = require("./agents/openai-synthesizer");
const { PromptLogger } = require("./utils/prompt-logger");

// =============================================================================
// Configuration
// =============================================================================

const SCRIPT_DIR = __dirname;
const PROJECT_ROOT = path.join(SCRIPT_DIR, "..");

const PATHS = {
  classifiedContext: path.join(PROJECT_ROOT, "intermediate/classified-context.json"),
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
    mode: "extended_thinking",
    verbose: false,
    help: false,
    dryRun: false,
    unknown: [],
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--mode":
      case "-m":
        if (i + 1 >= args.length) {
          options.unknown.push(args[i]);
        } else {
          options.mode = args[++i];
        }
        break;
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
Phase 3: Content Synthesis

Uses ChatGPT 5.2 to synthesize classified content
into detailed slide content with citations.

Usage:
  node 03-synthesize-content.js [options]

Options:
  --mode, -m <mode>    Reasoning mode: standard | extended_thinking | deep_research
                       Default: extended_thinking
  --verbose, -v        Show detailed progress
  --dry-run            Generate prompts without making API calls
  --help, -h           Show this help message

Required Files:
  intermediate/classified-context.json   Classified content (from Phase 2)
  user-inputs/story.md                   Narrative arc definition
  user-inputs/style-guide.md             Style preferences

Output Files:
  intermediate/synthesis-output.json     Synthesized slide content
  intermediate/citations.json            All source citations

Reasoning Modes:
  standard             Fast generation for quick iterations
  extended_thinking    More reasoning steps for better coherence
  deep_research        Maximum depth, cross-references all sources (recommended)

Environment Variables:
  OPENAI_API_KEY       Required: Your OpenAI API key
`);
}

// =============================================================================
// Validation
// =============================================================================

function validateInputs({ skipApiKeyCheck = false } = {}) {
  const errors = [];

  // Check classified context
  if (!fs.existsSync(PATHS.classifiedContext)) {
    errors.push(`Classified context not found: ${PATHS.classifiedContext}`);
    errors.push("Run 02-classify-context.js first.");
  }

  // Check story file
  if (!fs.existsSync(PATHS.story)) {
    errors.push(`Story file not found: ${PATHS.story}`);
  }

  // Check style guide file
  if (!fs.existsSync(PATHS.styleGuide)) {
    errors.push(`Style guide not found: ${PATHS.styleGuide}`);
  }

  // Check API key
  if (!skipApiKeyCheck && !process.env.OPENAI_API_KEY) {
    errors.push("OPENAI_API_KEY environment variable not set.");
    errors.push("Set it with: export OPENAI_API_KEY='your-api-key'");
  }

  return errors;
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log("========================================");
  console.log("Phase 3: Content Synthesis");
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

  // Validate mode
  const validModes = ["standard", "extended_thinking", "deep_research"];
  if (!validModes.includes(options.mode)) {
    console.error(`Invalid mode: ${options.mode}`);
    console.error(`Valid modes: ${validModes.join(", ")}`);
    process.exit(1);
  }

  // Validate inputs
  const errors = validateInputs({ skipApiKeyCheck: options.dryRun });
  if (errors.length > 0) {
    console.error("Validation errors:");
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }

  // Load pipeline config
  let pipelineConfig = {};
  let promptLogger = null;
  if (fs.existsSync(PATHS.config)) {
    pipelineConfig = JSON.parse(fs.readFileSync(PATHS.config, "utf-8"));
  }

  if (options.dryRun || pipelineConfig.logging?.prompts === true) {
    promptLogger = new PromptLogger(PROJECT_ROOT, { dryRun: options.dryRun });
  }

  // Build agent config
  const agentConfig = {
    ...(pipelineConfig.agents?.synthesizer || {}),
    verbose: options.verbose,
    reasoningMode: options.mode,
    dryRun: options.dryRun,
    promptLogger,
  };

  // Create synthesizer agent
  const synthesizer = new OpenAISynthesizer(agentConfig);

  console.log(`Reasoning mode: ${options.mode}`);
  console.log(`Dry-run mode: ${options.dryRun ? "enabled" : "disabled"}`);
  console.log(`Model: ${agentConfig.model || "gpt-5.2"}`);
  console.log(`Input: ${PATHS.classifiedContext}`);
  console.log(`Output: ${PATHS.output}\n`);

  try {
    // Run synthesis
    const startTime = Date.now();

    const result = await synthesizer.execute({
      classifiedContextPath: PATHS.classifiedContext,
      storyPath: PATHS.story,
      styleGuidePath: PATHS.styleGuide,
      outputDir: PATHS.output,
      pipelineConfig,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    // Print summary
    console.log("\n========================================");
    console.log("Synthesis Complete");
    console.log("========================================");
    console.log(`Time: ${elapsed}s`);
    console.log(`Slides generated: ${result.slides?.length || 0}`);
    console.log(`Cost: $${result.metadata?.costIncurred?.toFixed(4) || "unknown"}`);

    // Print slide summary
    if (result.slides) {
      console.log("\nSlides generated:");
      for (const slide of result.slides) {
        const citationCount = slide.citations?.length || 0;
        const hasReasoning = slide.reasoningTrace ? "+" : "-";
        console.log(
          `  ${hasReasoning} ${slide.type.padEnd(15)} ${citationCount} citations`
        );
      }
    }

    // Load and print citation summary
    const citationsPath = path.join(PATHS.output, "citations.json");
    if (fs.existsSync(citationsPath)) {
      const citations = JSON.parse(fs.readFileSync(citationsPath, "utf-8"));
      console.log(`\nTotal citations: ${citations.totalCitations}`);

      if (citations.lowConfidence?.length > 0) {
        console.log(`\nLow confidence citations (< 0.7):`);
        citations.lowConfidence.slice(0, 5).forEach((c) => {
          console.log(`  - [${c.slideType}] ${c.fact?.substring(0, 50)}...`);
        });
      }
    }

    console.log("\nOutput files:");
    console.log(`  - ${PATHS.output}/synthesis-output.json`);
    console.log(`  - ${PATHS.output}/citations.json`);

    if (promptLogger && promptLogger.getPrompts().length > 0) {
      const manifestPath = promptLogger.saveManifest();
      console.log(`  - ${manifestPath}`);
    }
  } catch (error) {
    console.error("\n========================================");
    console.error("Synthesis Failed");
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
