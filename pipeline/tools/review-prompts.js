#!/usr/bin/env node
/**
 * =============================================================================
 * Prompt Review Tool
 * =============================================================================
 *
 * Interactive CLI tool to review prompts generated during dry-run mode.
 * Helps debug and audit what prompts are being sent to LLMs.
 *
 * Usage:
 *   node review-prompts.js [--dir intermediate/prompts]
 *   node review-prompts.js --list
 *   node review-prompts.js --view <filename>
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");

// Default prompts directory (relative to project root)
const DEFAULT_PROMPTS_DIR = path.join(__dirname, "../../intermediate/prompts");

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    dir: DEFAULT_PROMPTS_DIR,
    list: false,
    view: null,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--dir":
      case "-d":
        options.dir = args[++i];
        break;
      case "--list":
      case "-l":
        options.list = true;
        break;
      case "--view":
      case "-v":
        options.view = args[++i];
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
    }
  }

  return options;
}

// Print help message
function printHelp() {
  console.log(`
Prompt Review Tool - Review LLM prompts from dry-run mode

Usage:
  node review-prompts.js [options]

Options:
  --dir, -d <path>    Prompts directory (default: intermediate/prompts)
  --list, -l          List all prompts without interactive mode
  --view, -v <file>   View a specific prompt file
  --help, -h          Show this help message

Examples:
  node review-prompts.js                    # Interactive mode
  node review-prompts.js --list             # List all prompts
  node review-prompts.js --view 2026-01...  # View specific prompt

How to generate prompts:
  Run any pipeline script with --dry-run flag:
  node pipeline/02-classify-context.js --dry-run
  node pipeline/03-synthesize-content.js --dry-run
  node pipeline/04-generate-final.js --dry-run
`);
}

// Load and parse the manifest
function loadManifest(promptsDir) {
  const manifestPath = path.join(promptsDir, "prompt-manifest.json");

  if (!fs.existsSync(manifestPath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
}

// List all prompts
function listPrompts(manifest) {
  console.log("\n=== Prompt Summary ===\n");
  console.log(`Generated: ${manifest.generatedAt}`);
  console.log(`Dry-Run: ${manifest.dryRun ? "Yes" : "No"}`);
  console.log(`Total Prompts: ${manifest.totalPrompts}`);
  console.log(`Total Tokens (est): ~${manifest.totalTokensEstimate.toLocaleString()}`);
  console.log(`Total Characters: ${manifest.totalCharacters.toLocaleString()}`);

  console.log("\n=== Prompts by Agent ===\n");

  for (const [agent, data] of Object.entries(manifest.promptsByAgent || {})) {
    console.log(`${agent}:`);
    console.log(`  Count: ${data.count}`);
    console.log(`  Tokens: ~${data.totalTokens.toLocaleString()}`);
    console.log(`  Files: ${data.prompts.join(", ")}`);
    console.log();
  }

  console.log("=== All Prompts ===\n");

  manifest.prompts.forEach((p, i) => {
    console.log(
      `${(i + 1).toString().padStart(2)}. [${p.agentName}] ${p.promptType} ` +
        `(~${p.tokenEstimate.toLocaleString()} tokens) - ${p.filename}`
    );
  });
}

// View a specific prompt file
function viewPrompt(promptsDir, filename) {
  // Try exact match first
  let filepath = path.join(promptsDir, filename);

  if (!fs.existsSync(filepath)) {
    // Try to find by partial match
    const files = fs.readdirSync(promptsDir).filter((f) => f.includes(filename));
    if (files.length === 1) {
      filepath = path.join(promptsDir, files[0]);
    } else if (files.length > 1) {
      console.log("Multiple matches found:");
      files.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
      return;
    } else {
      console.error(`File not found: ${filename}`);
      return;
    }
  }

  const content = fs.readFileSync(filepath, "utf-8");
  console.log("\n" + "=".repeat(80));
  console.log(content);
  console.log("=".repeat(80) + "\n");
}

// Interactive mode
async function interactiveMode(promptsDir, manifest) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt) =>
    new Promise((resolve) => rl.question(prompt, resolve));

  console.log("\n=== Prompt Review Tool (Interactive Mode) ===\n");
  console.log(`Prompts directory: ${promptsDir}`);
  console.log(`Total prompts: ${manifest.totalPrompts}`);
  console.log(`Estimated tokens: ~${manifest.totalTokensEstimate.toLocaleString()}`);
  console.log();

  // List prompts
  manifest.prompts.forEach((p, i) => {
    console.log(
      `${(i + 1).toString().padStart(2)}. [${p.agentName}] ${p.promptType} ` +
        `(~${p.tokenEstimate.toLocaleString()} tokens)`
    );
  });

  console.log('\nCommands: <number> to view, "s" for summary, "q" to quit\n');

  while (true) {
    const answer = await question("Enter command: ");

    if (answer.toLowerCase() === "q" || answer.toLowerCase() === "quit") {
      break;
    }

    if (answer.toLowerCase() === "s" || answer.toLowerCase() === "summary") {
      listPrompts(manifest);
      continue;
    }

    const index = parseInt(answer) - 1;
    if (index >= 0 && index < manifest.prompts.length) {
      const prompt = manifest.prompts[index];
      viewPrompt(promptsDir, prompt.filename);
    } else {
      console.log(
        `Invalid selection. Enter 1-${manifest.prompts.length}, "s" for summary, or "q" to quit.`
      );
    }
  }

  rl.close();
  console.log("Goodbye!");
}

// Main function
async function main() {
  const options = parseArgs();

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  const promptsDir = path.resolve(options.dir);

  // Check if prompts directory exists
  if (!fs.existsSync(promptsDir)) {
    console.error(`Prompts directory not found: ${promptsDir}`);
    console.log('\nRun the pipeline with --dry-run first to generate prompts:');
    console.log("  node pipeline/02-classify-context.js --dry-run");
    console.log("  node pipeline/03-synthesize-content.js --dry-run");
    console.log("  node pipeline/04-generate-final.js --dry-run");
    process.exit(1);
  }

  // Load manifest
  const manifest = loadManifest(promptsDir);

  if (!manifest) {
    console.error("No prompt-manifest.json found in prompts directory.");
    console.log("Run the pipeline with --dry-run to generate prompts.");
    process.exit(1);
  }

  // Handle different modes
  if (options.view) {
    viewPrompt(promptsDir, options.view);
  } else if (options.list) {
    listPrompts(manifest);
  } else {
    await interactiveMode(promptsDir, manifest);
  }
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
