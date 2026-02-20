# Troubleshooting

## Fast First-Run Diagnostic

Run this sequence from project root:

```bash
# 1) Check tooling
node --version
python3 --version
python3 -m markitdown --help

# 2) Confirm required files
ls -la .env
ls -la user-inputs/story.md user-inputs/style-guide.md
ls -la context-refs

# 3) Run dry-run phases (no API calls)
node pipeline/02-classify-context.js --dry-run
node pipeline/03-synthesize-content.js --dry-run
node pipeline/04-generate-final.js --dry-run

# 4) Inspect prompts
node pipeline/tools/review-prompts.js --list
```

If all of the above work, run:

```bash
./pipeline/run-pipeline.sh --non-interactive
```

## Common Issues

### Missing API key warnings

Symptom:
```text
Warning: ANTHROPIC_API_KEY not set...
```

Fix:
- Ensure `.env` exists in project root.
- Ensure it contains all 3 keys: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_AI_API_KEY`.
- Re-run with `--non-interactive` to fail fast if keys are missing.

### `markitdown` not found

Symptom:
```text
Error: markitdown is not installed
```

Fix:

```bash
python3 -m pip install --upgrade markitdown
```

### No input files detected

Symptom:
```text
No PDF files found in context-refs
```
or no extracted content generated.

Fix:
- Add source files to `context-refs/`.
- Supported extraction inputs: `.pdf`, `.md`, `.txt`.

### Phase 2/3/4 API failures

Fixes to try:
- Validate key values in `.env`.
- Retry later (rate limits/service issues).
- Use smaller input set and re-run from earlier phase.
- Use faster synthesis mode for iteration:

```bash
./pipeline/run-pipeline.sh --mode standard --non-interactive
```

### Image generation failures

Fixes:

```bash
# Generate deck without images
./pipeline/run-pipeline.sh --skip-images --non-interactive

# Check failed prompt log (if present)
cat intermediate/failed-image-prompts.json
```

### PPTX render issues

Fixes:

```bash
# Re-render from existing final config/assets
./pipeline/run-pipeline.sh --from-phase 5 --non-interactive

# Validate JSON quickly
node -e "JSON.parse(require('fs').readFileSync('output/deck-config.json','utf8')); console.log('ok')"
```

## Useful Recovery Commands

```bash
# Re-run from phase 2
./pipeline/run-pipeline.sh --from-phase 2 --non-interactive

# Re-run from phase 3
./pipeline/run-pipeline.sh --from-phase 3 --non-interactive

# Re-run from phase 4
./pipeline/run-pipeline.sh --from-phase 4 --non-interactive
```

## Debugging Commands

```bash
node pipeline/02-classify-context.js --verbose
node pipeline/03-synthesize-content.js --verbose
node pipeline/04-generate-final.js --verbose
```
