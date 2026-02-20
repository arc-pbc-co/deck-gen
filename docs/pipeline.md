# Pipeline Reference

## End-to-End Command

Run the full workflow from project root:

```bash
./pipeline/run-pipeline.sh --non-interactive
```

Use `--non-interactive` for predictable behavior in terminals/CI (no prompts).

## Pipeline Phases

| Phase | Script | Input | Output |
|---|---|---|---|
| 1 | `pipeline/01-extract-pdfs.sh` | `context-refs/*` | `extracted-text/*.txt` |
| 2 | `pipeline/02-classify-context.js` | extracted text + story/style | `intermediate/classified-context.json`, `intermediate/relevance-matrix.json` |
| 3 | `pipeline/03-synthesize-content.js` | classified context + story/style | `intermediate/synthesis-output.json`, `intermediate/citations.json` |
| 4 | `pipeline/04-generate-final.js` | synthesis output + style | `output/deck-config.json`, `output/assets/*.png` |
| 5 | `pipeline/05-render-deck.sh` | final config + assets | `output/investor-deck.pptx` |

## Run Individual Phases

```bash
./pipeline/01-extract-pdfs.sh
node pipeline/02-classify-context.js
node pipeline/03-synthesize-content.js --mode extended_thinking
node pipeline/04-generate-final.js
./pipeline/05-render-deck.sh
```

## Dry-Run Mode (No API Calls)

Use dry-run to inspect prompts and validate flow before spending API credits:

```bash
node pipeline/02-classify-context.js --dry-run
node pipeline/03-synthesize-content.js --dry-run
node pipeline/04-generate-final.js --dry-run
node pipeline/tools/review-prompts.js --list
```

Prompt files are saved under `intermediate/prompts/`.

## Common Re-Run Patterns

```bash
# Re-run from phase 3 onward
./pipeline/run-pipeline.sh --from-phase 3 --non-interactive

# Re-run from phase 4 onward
./pipeline/run-pipeline.sh --from-phase 4 --non-interactive

# Re-render PPTX only
./pipeline/run-pipeline.sh --from-phase 5 --non-interactive
```

## `run-pipeline.sh` Flags

- `--mode standard|extended_thinking|deep_research`
- `--skip-extract`
- `--skip-classify`
- `--skip-synthesize`
- `--skip-images`
- `--from-phase 1..5`
- `--non-interactive`
- `--yes`
- `--help`

## Reasoning Modes (Phase 3)

- `standard`: fastest draft mode
- `extended_thinking`: balanced quality/speed (default)
- `deep_research`: most thorough

## Output Checklist

After a successful run, verify:

- `output/investor-deck.pptx` exists
- `output/deck-config.json` exists
- `output/assets/` contains generated images
