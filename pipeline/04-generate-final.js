#!/usr/bin/env node
/**
 * =============================================================================
 * Phase 4: Final Generation (Hybrid Text + Image)
 * =============================================================================
 *
 * Uses Gemini 2.0 Flash to polish JSON and generate final deck-config.json,
 * then uses Nano Banana Pro to generate charts, diagrams, and graphics.
 *
 * Inputs:
 *   - intermediate/synthesis-output.json (from Phase 3)
 *   - user-inputs/style-guide.md (style preferences)
 *
 * Outputs:
 *   - output/deck-config.json (final polished config)
 *   - output/assets/*.png (generated graphics)
 *   - intermediate/image-prompts.json (prompts used for image generation)
 *   - intermediate/generated-images.json (manifest of generated images)
 *
 * Usage:
 *   node 04-generate-final.js [options]
 *
 * Options:
 *   --skip-images     Skip image generation (text only)
 *   --verbose, -v     Show detailed progress
 *   --dry-run         Generate prompts without making API calls
 *   --help, -h        Show this help message
 *
 * Environment:
 *   GOOGLE_AI_API_KEY - Required API key for Gemini and Nano Banana Pro
 */

const path = require("path");
const fs = require("fs");

// Load environment variables from .env file
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const { GeminiGenerator } = require("./agents/gemini-generator");
const { NanoBananaGenerator } = require("./agents/nano-banana-generator");
const { PromptLogger } = require("./utils/prompt-logger");

// =============================================================================
// Configuration
// =============================================================================

const SCRIPT_DIR = __dirname;
const PROJECT_ROOT = path.join(SCRIPT_DIR, "..");

const PATHS = {
  synthesisOutput: path.join(PROJECT_ROOT, "intermediate/synthesis-output.json"),
  styleGuide: path.join(PROJECT_ROOT, "user-inputs/style-guide.md"),
  storyGuide: path.join(PROJECT_ROOT, "user-inputs/story.md"),
  intermediateDir: path.join(PROJECT_ROOT, "intermediate"),
  outputDir: path.join(PROJECT_ROOT, "output"),
  config: path.join(SCRIPT_DIR, "config/pipeline-config.json"),
};

// =============================================================================
// CLI Argument Parsing
// =============================================================================

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    skipImages: false,
    verbose: false,
    help: false,
    dryRun: false,
    unknown: [],
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--skip-images":
        options.skipImages = true;
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
Phase 4: Final Generation (Hybrid Text + Image)

Uses Gemini 2.0 Flash to polish JSON and Nano Banana Pro to generate graphics.

Usage:
  node 04-generate-final.js [options]

Options:
  --skip-images      Skip image generation (text polish only)
  --verbose, -v      Show detailed progress
  --dry-run          Generate prompts without making API calls
  --help, -h         Show this help message

Required Files:
  intermediate/synthesis-output.json   Synthesized content (from Phase 3)
  user-inputs/style-guide.md           Style preferences

Output Files:
  output/deck-config.json              Final polished deck configuration
  output/assets/*.png                  Generated charts and diagrams
  intermediate/image-prompts.json      Image generation prompts
  intermediate/generated-images.json   Manifest of generated images

Environment Variables:
  GOOGLE_AI_API_KEY  Required: Your Google AI API key (for Gemini + Nano Banana Pro)
`);
}

// =============================================================================
// Validation
// =============================================================================

function validateInputs({ skipApiKeyCheck = false } = {}) {
  const errors = [];

  // Check synthesis output
  if (!fs.existsSync(PATHS.synthesisOutput)) {
    errors.push(`Synthesis output not found: ${PATHS.synthesisOutput}`);
    errors.push("Run 03-synthesize-content.js first.");
  }

  // Check style guide file
  if (!fs.existsSync(PATHS.styleGuide)) {
    errors.push(`Style guide not found: ${PATHS.styleGuide}`);
  }

  // Check API key
  if (!skipApiKeyCheck && !process.env.GOOGLE_AI_API_KEY) {
    errors.push("GOOGLE_AI_API_KEY environment variable not set.");
    errors.push("Set it with: export GOOGLE_AI_API_KEY='your-api-key'");
  }

  return errors;
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log("========================================");
  console.log("Phase 4: Final Generation");
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

  // Ensure output directories exist
  if (!fs.existsSync(PATHS.outputDir)) {
    fs.mkdirSync(PATHS.outputDir, { recursive: true });
  }
  const assetsDir = path.join(PATHS.outputDir, "assets");
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
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

  console.log(`Skip images: ${options.skipImages}`);
  console.log(`Dry-run mode: ${options.dryRun ? "enabled" : "disabled"}`);
  console.log(`Input: ${PATHS.synthesisOutput}`);
  console.log(`Output: ${PATHS.outputDir}\n`);

  const startTime = Date.now();
  let totalCost = 0;

  try {
    // =========================================================================
    // Part 1: Text Polish with Gemini 2.0 Flash
    // =========================================================================
    console.log("----------------------------------------");
    console.log("Part 1: Text Polish (Gemini 2.0 Flash)");
    console.log("----------------------------------------\n");

    const textGeneratorConfig = {
      ...(pipelineConfig.agents?.generator || {}),
      verbose: options.verbose,
      dryRun: options.dryRun,
      promptLogger,
    };

    const textGenerator = new GeminiGenerator(textGeneratorConfig);

    const textResult = await textGenerator.execute({
      synthesisOutputPath: PATHS.synthesisOutput,
      styleGuidePath: PATHS.styleGuide,
      storyGuidePath: PATHS.storyGuide,
      outputDir: PATHS.outputDir,
      pipelineConfig,
    });

    totalCost += textGenerator.costTracker.totalCost;

    console.log(`\n  Slides: ${textResult.deckConfig.slides?.length || 0}`);
    console.log(`  Image prompts: ${Object.keys(textResult.imagePrompts || {}).length}`);
    console.log(`  Cost: $${textGenerator.costTracker.totalCost.toFixed(4)}`);

    // =========================================================================
    // Part 2: Image Generation with Nano Banana Pro
    // =========================================================================
    if (!options.skipImages && Object.keys(textResult.imagePrompts || {}).length > 0) {
      console.log("\n----------------------------------------");
      console.log("Part 2: Image Generation (Nano Banana Pro)");
      console.log("----------------------------------------\n");

      const imageGeneratorConfig = {
        ...(pipelineConfig.agents?.imageGenerator || {}),
        verbose: options.verbose,
        dryRun: options.dryRun,
        promptLogger,
      };

      const imageGenerator = new NanoBananaGenerator(imageGeneratorConfig);

      // Save image prompts to intermediate directory first
      const imagePromptsPath = path.join(PATHS.intermediateDir, "image-prompts.json");
      fs.writeFileSync(imagePromptsPath, JSON.stringify(textResult.imagePrompts, null, 2));
      console.log(`  Saved image prompts to: ${imagePromptsPath}`);

      const imageResult = await imageGenerator.execute({
        imagePromptsPath,
        outputDir: PATHS.outputDir,
        designConfig: pipelineConfig.design || textResult.deckConfig.design,
        styleGuidePath: PATHS.styleGuide,
        storyGuidePath: PATHS.storyGuide,
      });

      totalCost += imageGenerator.costTracker.totalCost;

      // Update deck config with generated image paths
      const deckConfigPath = path.join(PATHS.outputDir, "deck-config.json");
      const deckConfig = JSON.parse(fs.readFileSync(deckConfigPath, "utf-8"));

      // Map generated images to slides
      for (const [imageType, imagePath] of Object.entries(imageResult.images)) {
        if (!imagePath) continue;

        const relativePath = path.relative(PATHS.outputDir, imagePath);

        // Find slides that might use this image
        for (const slide of deckConfig.slides || []) {
          if (slide.type === imageType) {
            slide.image = relativePath;
          } else if (slide.type === "ask" && imageType === "useOfFunds") {
            slide.useOfFundsImage = relativePath;
          }
        }
      }

      // Save updated deck config
      fs.writeFileSync(deckConfigPath, JSON.stringify(deckConfig, null, 2));

      const generated = Object.values(imageResult.images).filter(Boolean).length;
      console.log(`\n  Images generated: ${generated}/${Object.keys(imageResult.images).length}`);
      console.log(`  Cost: $${imageGenerator.costTracker.totalCost.toFixed(4)}`);
    } else if (options.skipImages) {
      console.log("\n[Skipping image generation as requested]");
    } else {
      console.log("\n[No image prompts to generate]");
    }

    // =========================================================================
    // Summary
    // =========================================================================
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log("\n========================================");
    console.log("Generation Complete");
    console.log("========================================");
    console.log(`Time: ${elapsed}s`);
    console.log(`Total cost: $${totalCost.toFixed(4)}`);

    // List generated files
    console.log("\nGenerated files:");
    console.log(`  - ${PATHS.outputDir}/deck-config.json`);

    const assetFiles = fs.existsSync(assetsDir)
      ? fs.readdirSync(assetsDir).filter((f) => f.endsWith(".png"))
      : [];
    for (const file of assetFiles) {
      console.log(`  - ${PATHS.outputDir}/assets/${file}`);
    }

    // Show slide summary
    const finalConfig = JSON.parse(
      fs.readFileSync(path.join(PATHS.outputDir, "deck-config.json"), "utf-8")
    );
    if (finalConfig.slides) {
      console.log("\nFinal deck slides:");
      finalConfig.slides.forEach((slide, i) => {
        const hasImage = slide.image ? "[img]" : "     ";
        console.log(`  ${i + 1}. ${slide.type.padEnd(15)} ${hasImage}`);
      });
    }

    if (promptLogger && promptLogger.getPrompts().length > 0) {
      const manifestPath = promptLogger.saveManifest();
      console.log(`\nPrompt manifest: ${manifestPath}`);
    }
  } catch (error) {
    console.error("\n========================================");
    console.error("Generation Failed");
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
