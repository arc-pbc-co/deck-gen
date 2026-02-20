# Quickstart Cheat Sheet

Use this when onboarding a teammate. Commands assume you are in project root:

```bash
cd /Users/bryanwisk/Projects/arc-vdr/deck-generator
```

## 1) One-Time Setup

```bash
# Install deps
npm install
python3 -m pip install --upgrade markitdown

# API keys
cp .env.example .env
# Edit .env and set:
# ANTHROPIC_API_KEY=...
# OPENAI_API_KEY=...
# GOOGLE_AI_API_KEY=...
```

## 2) Add Required Inputs

- Put source docs in `context-refs/` (supported: `.pdf`, `.md`, `.txt`)
- Edit `user-inputs/story.md`
- Edit `user-inputs/style-guide.md`

Quick bootstrap from examples:

```bash
cp user-inputs/examples/story-example.md user-inputs/story.md
cp user-inputs/examples/style-guide-example.md user-inputs/style-guide.md
```

## 3) Sanity Check (No API Spend)

```bash
node pipeline/02-classify-context.js --dry-run
node pipeline/03-synthesize-content.js --dry-run
node pipeline/04-generate-final.js --dry-run
node pipeline/tools/review-prompts.js --list
```

## 4) Run Full Pipeline

```bash
./pipeline/run-pipeline.sh --non-interactive
```

Final outputs:
- `output/investor-deck.pptx`
- `output/deck-config.json`
- `output/assets/*.png`

## 5) Most Common Re-Runs

```bash
# Re-run from synthesis
./pipeline/run-pipeline.sh --from-phase 3 --non-interactive

# Re-run final generation + render
./pipeline/run-pipeline.sh --from-phase 4 --non-interactive

# Re-render only
./pipeline/run-pipeline.sh --from-phase 5 --non-interactive
```

## 6) Useful Flags

```bash
./pipeline/run-pipeline.sh --help
```

Most used:
- `--mode standard|extended_thinking|deep_research`
- `--skip-images`
- `--from-phase 1..5`
- `--non-interactive`
- `--yes`

## 7) Fast Troubleshooting

```bash
# Tooling + inputs
node --version
python3 --version
python3 -m markitdown --help
ls -la .env user-inputs/story.md user-inputs/style-guide.md context-refs

# Verbose per phase
node pipeline/02-classify-context.js --verbose
node pipeline/03-synthesize-content.js --verbose
node pipeline/04-generate-final.js --verbose
```

If images fail but text is fine:

```bash
./pipeline/run-pipeline.sh --skip-images --non-interactive
```
