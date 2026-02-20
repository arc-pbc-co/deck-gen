#!/usr/bin/env node
/**
 * =============================================================================
 * LLM Content Synthesis Script
 * =============================================================================
 *
 * Uses OpenAI's ChatGPT 5.2 to analyze extracted documents and generate
 * a complete deck-config.json following the Sequoia template structure.
 *
 * Supports three reasoning modes:
 * - standard: Fast generation for quick iterations
 * - extended_thinking: More reasoning steps for better coherence
 * - deep_research: Maximum depth, cross-references all sources
 *
 * Usage:
 *   node 03-generate-config.js [--mode standard|extended_thinking|deep_research]
 *
 * Environment:
 *   OPENAI_API_KEY - Required API key for OpenAI
 */

const fs = require("fs");
const path = require("path");

// Load environment variables from .env file
require("dotenv").config({ path: path.join(__dirname, "../.env") });

// =============================================================================
// Configuration
// =============================================================================

const SCRIPT_DIR = __dirname;
const CONFIG_PATH = path.join(SCRIPT_DIR, "config/pipeline-config.json");
const CONTEXT_FILE = path.join(SCRIPT_DIR, "../output/combined-context.txt");
const OUTPUT_FILE = path.join(SCRIPT_DIR, "../output/deck-config.json");
const SYSTEM_PROMPT_FILE = path.join(SCRIPT_DIR, "prompts/system-prompt.md");
const SLIDE_PROMPTS_FILE = path.join(SCRIPT_DIR, "prompts/slide-prompts.json");
const SAMPLE_CONFIG_FILE = path.join(SCRIPT_DIR, "../investor-deck-generator/assets/sample-deck-config.json");

// =============================================================================
// Parse Command Line Arguments
// =============================================================================

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    mode: "deep_research", // default
    verbose: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--mode":
      case "-m":
        options.mode = args[++i];
        break;
      case "--verbose":
      case "-v":
        options.verbose = true;
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
    }
  }

  return options;
}

function showHelp() {
  console.log(`
LLM Content Synthesis for Deck Generator

Usage:
  node 03-generate-config.js [options]

Options:
  --mode, -m <mode>    Reasoning mode: standard | extended_thinking | deep_research
                       Default: deep_research
  --verbose, -v        Show detailed progress
  --help, -h           Show this help message

Reasoning Modes:
  standard             Fast generation for quick iterations
  extended_thinking    More reasoning steps for better coherence
  deep_research        Maximum depth, cross-references all sources

Environment Variables:
  OPENAI_API_KEY       Required: Your OpenAI API key

Examples:
  node 03-generate-config.js                      # Run with deep_research mode
  node 03-generate-config.js --mode standard      # Quick draft mode
  node 03-generate-config.js -m extended_thinking # Balanced mode
`);
}

// =============================================================================
// Main Functions
// =============================================================================

async function loadInputs() {
  console.log("Loading input files...");

  // Load pipeline config
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`Config not found: ${CONFIG_PATH}`);
  }
  const pipelineConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));

  // Load combined context
  if (!fs.existsSync(CONTEXT_FILE)) {
    throw new Error(`Context file not found: ${CONTEXT_FILE}\nRun 02-combine-context.sh first.`);
  }
  const context = fs.readFileSync(CONTEXT_FILE, "utf-8");
  console.log(`  Context loaded: ${Math.round(context.length / 1024)}KB`);

  // Load system prompt
  if (!fs.existsSync(SYSTEM_PROMPT_FILE)) {
    throw new Error(`System prompt not found: ${SYSTEM_PROMPT_FILE}`);
  }
  const systemPrompt = fs.readFileSync(SYSTEM_PROMPT_FILE, "utf-8");

  // Load slide prompts
  if (!fs.existsSync(SLIDE_PROMPTS_FILE)) {
    throw new Error(`Slide prompts not found: ${SLIDE_PROMPTS_FILE}`);
  }
  const slidePrompts = JSON.parse(fs.readFileSync(SLIDE_PROMPTS_FILE, "utf-8"));

  // Load sample config for schema reference
  if (!fs.existsSync(SAMPLE_CONFIG_FILE)) {
    throw new Error(`Sample config not found: ${SAMPLE_CONFIG_FILE}`);
  }
  const sampleConfig = JSON.parse(fs.readFileSync(SAMPLE_CONFIG_FILE, "utf-8"));

  return { pipelineConfig, context, systemPrompt, slidePrompts, sampleConfig };
}

function buildPrompt(context, slidePrompts, sampleConfig, pipelineConfig, reasoningMode) {
  const modeConfig = pipelineConfig.reasoningModes[reasoningMode];
  const modeSuffix = modeConfig?.systemSuffix || "";

  // Truncate context if too large (leave room for response)
  const maxContextChars = 120000; // ~30K tokens
  const truncatedContext = context.length > maxContextChars
    ? context.slice(0, maxContextChars) + "\n\n[... document truncated for length ...]"
    : context;

  // Build slide instructions
  const slideInstructions = Object.entries(slidePrompts)
    .map(([type, info]) => {
      return `### ${type}
${info.prompt}
Required fields: ${info.requiredFields.join(", ")}
Schema: ${JSON.stringify(info.schema, null, 2)}`;
    })
    .join("\n\n");

  return `
## Task

Analyze the following company documents and generate a complete deck-config.json file for Autonomous Resource Corporation (ARC).

${modeSuffix ? `## Reasoning Mode: ${reasoningMode}\n${modeSuffix}\n` : ""}

## Source Documents

${truncatedContext}

## Required Output Schema

Generate a JSON object matching this exact structure:

\`\`\`json
${JSON.stringify(sampleConfig, null, 2)}
\`\`\`

## Company Information

Use these design settings:
\`\`\`json
${JSON.stringify(pipelineConfig.design, null, 2)}
\`\`\`

Company name: "${pipelineConfig.company.name}"
Short name: "${pipelineConfig.company.shortName}"

## Slide-by-Slide Instructions

${slideInstructions}

## Output Instructions

1. Return ONLY valid JSON - no explanatory text outside the JSON
2. Wrap your JSON response in \`\`\`json code blocks
3. Ensure all 12 slide types are included
4. Use actual data from the source documents
5. Flag any missing information with "[TBD - not found in sources]"
6. For competitor positioning, place ARC favorably but realistically

Begin generating the deck-config.json now.
`;
}

async function callOpenAI(systemPrompt, userPrompt, config, mode) {
  // Dynamic import for ES module
  const OpenAI = (await import("openai")).default;

  // Validate API key
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY environment variable is required.\n" +
      "Set it with: export OPENAI_API_KEY='your-api-key'"
    );
  }

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  console.log(`\nCalling OpenAI API...`);
  console.log(`  Model: ${config.openai.model}`);
  console.log(`  Mode: ${mode}`);
  console.log(`  Max tokens: ${config.openai.maxTokens}`);

  const startTime = Date.now();

  try {
    const response = await client.chat.completions.create({
      model: config.openai.model,
      max_completion_tokens: config.openai.maxTokens,
      temperature: config.openai.temperature,
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userPrompt
        }
      ]
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`  Completed in ${elapsed}s`);
    console.log(`  Tokens used: ${response.usage?.total_tokens || "unknown"}`);

    return response.choices[0].message.content;
  } catch (error) {
    if (error.code === "model_not_found") {
      console.error(`\nError: Model '${config.openai.model}' not found.`);
      console.error("Try updating the model in pipeline-config.json to an available model like 'gpt-4o' or 'gpt-4-turbo'.");
    }
    throw error;
  }
}

function extractJSON(responseText) {
  // Try to extract JSON from code blocks first
  const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // Try to find raw JSON object
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }

  throw new Error("Could not extract JSON from response");
}

function validateConfig(config) {
  const errors = [];
  const warnings = [];

  // Required top-level fields
  if (!config.company?.name) errors.push("Missing company.name");
  if (!config.company?.tagline) warnings.push("Missing company.tagline");
  if (!config.design) errors.push("Missing design object");
  if (!config.slides || !Array.isArray(config.slides)) {
    errors.push("Missing or invalid slides array");
    return { valid: false, errors, warnings };
  }

  // Validate each slide type
  const validators = {
    title: (s) => s.tagline || s.subtitle,
    purpose: (s) => s.statement,
    problem: (s) => s.points?.length >= 1,
    solution: (s) => s.valueProposition && s.benefits?.length >= 1,
    whyNow: (s) => s.trends?.length >= 1,
    marketSize: (s) => s.tam && s.sam && s.som,
    competition: (s) => s.competitors?.length >= 1,
    product: (s) => s.features?.length >= 1,
    businessModel: (s) => s.model || s.revenueStreams?.length >= 1,
    traction: (s) => s.metrics?.length >= 1 || s.milestones?.length >= 1,
    team: (s) => s.members?.length >= 1,
    ask: (s) => s.amount && s.useOfFunds?.length >= 1
  };

  for (const slide of config.slides) {
    const validator = validators[slide.type];
    if (!validator) {
      warnings.push(`Unknown slide type: ${slide.type}`);
    } else if (!validator(slide)) {
      errors.push(`Invalid ${slide.type} slide: missing required content`);
    }
  }

  // Check for missing slides
  const foundTypes = new Set(config.slides.map(s => s.type));
  const requiredTypes = Object.keys(validators);
  for (const type of requiredTypes) {
    if (!foundTypes.has(type)) {
      warnings.push(`Missing slide type: ${type}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    slideCount: config.slides.length
  };
}

// =============================================================================
// Main Entry Point
// =============================================================================

async function main() {
  console.log("========================================");
  console.log("LLM Content Synthesis");
  console.log("========================================\n");

  // Parse arguments
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  // Validate mode
  const validModes = ["standard", "extended_thinking", "deep_research"];
  if (!validModes.includes(options.mode)) {
    console.error(`Invalid mode: ${options.mode}`);
    console.error(`Valid modes: ${validModes.join(", ")}`);
    process.exit(1);
  }

  console.log(`Reasoning mode: ${options.mode}`);

  try {
    // Load all inputs
    const { pipelineConfig, context, systemPrompt, slidePrompts, sampleConfig } = await loadInputs();

    // Build the prompt
    console.log("\nBuilding prompt...");
    const userPrompt = buildPrompt(context, slidePrompts, sampleConfig, pipelineConfig, options.mode);
    console.log(`  Prompt size: ${Math.round(userPrompt.length / 1024)}KB`);

    // Call OpenAI
    const responseText = await callOpenAI(systemPrompt, userPrompt, pipelineConfig, options.mode);

    // Extract and parse JSON
    console.log("\nParsing response...");
    const jsonText = extractJSON(responseText);
    let deckConfig;

    try {
      deckConfig = JSON.parse(jsonText);
    } catch (parseError) {
      console.error("Failed to parse JSON response:");
      console.error(parseError.message);
      console.error("\nRaw response (first 1000 chars):");
      console.error(responseText.slice(0, 1000));
      process.exit(1);
    }

    // Validate the config
    console.log("\nValidating configuration...");
    const validation = validateConfig(deckConfig);

    if (validation.warnings.length > 0) {
      console.log("\nWarnings:");
      validation.warnings.forEach(w => console.log(`  - ${w}`));
    }

    if (!validation.valid) {
      console.error("\nValidation errors:");
      validation.errors.forEach(e => console.error(`  - ${e}`));
      console.error("\nConfig saved despite errors for manual review.");
    } else {
      console.log(`  Validation passed: ${validation.slideCount} slides`);
    }

    // Write output
    const outputDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(deckConfig, null, 2));

    console.log("\n========================================");
    console.log("Synthesis complete!");
    console.log("========================================");
    console.log(`Output: ${OUTPUT_FILE}`);
    console.log(`Slides: ${deckConfig.slides?.length || 0}`);

    // Show slide summary
    if (deckConfig.slides) {
      console.log("\nSlide types generated:");
      deckConfig.slides.forEach((slide, i) => {
        console.log(`  ${i + 1}. ${slide.type}`);
      });
    }

  } catch (error) {
    console.error("\n========================================");
    console.error("Error during synthesis");
    console.error("========================================");
    console.error(error.message);

    if (options.verbose) {
      console.error("\nStack trace:");
      console.error(error.stack);
    }

    process.exit(1);
  }
}

main();
