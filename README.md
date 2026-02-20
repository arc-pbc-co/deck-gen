# Multi-Agent Deck Generator

Generate an investor deck from your source docs using a 5-phase AI pipeline.

## Start Here (First Run)

Run these commands from the project root.

```bash
# 1) Install Node dependencies
npm install

# 2) Ensure Python markitdown is installed (used in Phase 1)
python3 -m pip install --upgrade markitdown

# 3) Configure API keys
cp .env.example .env
# Edit .env and set:
# ANTHROPIC_API_KEY=...
# OPENAI_API_KEY=...
# GOOGLE_AI_API_KEY=...

# 4) Add your source docs
# Supported inputs for extraction: .pdf, .md, .txt
# Place them in context-refs/

# 5) Edit narrative + style inputs
# user-inputs/story.md
# user-inputs/style-guide.md

# 6) (Optional) Dry-run to verify prompts without API calls
node pipeline/02-classify-context.js --dry-run
node pipeline/03-synthesize-content.js --dry-run
node pipeline/04-generate-final.js --dry-run
node pipeline/tools/review-prompts.js --list

# 7) Run full pipeline
./pipeline/run-pipeline.sh --non-interactive
```

Final output:
- `output/investor-deck.pptx`
- `output/deck-config.json`
- `output/assets/*.png`

## What Each Phase Does

| Phase | Script | Purpose | Main Output |
|---|---|---|---|
| 1 | `pipeline/01-extract-pdfs.sh` | Extract text from source docs | `extracted-text/*.txt` |
| 2 | `pipeline/02-classify-context.js` | Classify evidence by slide type | `intermediate/classified-context.json` |
| 3 | `pipeline/03-synthesize-content.js` | Build cited slide content | `intermediate/synthesis-output.json` |
| 4 | `pipeline/04-generate-final.js` | Polish config and generate images | `output/deck-config.json`, `output/assets/*.png` |
| 5 | `pipeline/05-render-deck.sh` | Render PPTX | `output/investor-deck.pptx` |

## Fast Re-Runs

```bash
# Re-run from synthesis onward
./pipeline/run-pipeline.sh --from-phase 3

# Re-run only final generation + rendering
./pipeline/run-pipeline.sh --from-phase 4

# Re-render PPTX only (after manual edits to output/deck-config.json)
./pipeline/run-pipeline.sh --from-phase 5
```

## Useful Flags

### `pipeline/run-pipeline.sh`

- `--mode standard|extended_thinking|deep_research`
- `--skip-extract`
- `--skip-classify`
- `--skip-synthesize`
- `--skip-images`
- `--from-phase 1..5`
- `--non-interactive` (fail instead of prompting)
- `--yes` (auto-continue when warnings occur)

### Phase scripts (`02` / `03` / `04`)

- `--help`
- `--verbose`
- `--dry-run` (no API calls, prompt logging enabled)

## Common First-Run Issues

- Missing API keys: ensure `.env` exists and has all 3 keys.
- `markitdown` not found: `python3 -m pip install markitdown`.
- No source files detected: add `.pdf`, `.md`, or `.txt` files to `context-refs/`.
- Prompt review shows no manifest: run at least one phase with `--dry-run` first.

## Documentation

- [Quickstart Cheat Sheet](docs/quickstart.md)
- [Installation Guide](docs/installation.md)
- [Configuration Guide](docs/configuration.md)
- [Pipeline Reference](docs/pipeline.md)
- [Troubleshooting](docs/troubleshooting.md)
