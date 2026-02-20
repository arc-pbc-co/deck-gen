# Installation Guide

## 1. Prerequisites

You need:
- Node.js 18+
- Python 3 (for `markitdown` used in extraction)
- API keys for Anthropic, OpenAI, and Google AI

Check versions:

```bash
node --version
python3 --version
```

## 2. Install Project Dependencies

From project root:

```bash
npm install
python3 -m pip install --upgrade markitdown
```

Optional OCR fallback dependencies (only needed for scanned PDFs):

```bash
# macOS
brew install tesseract
python3 -m pip install --upgrade pdf2image pytesseract
```

## 3. Configure API Keys

```bash
cp .env.example .env
```

Edit `.env` with real values:

```dotenv
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...
GOOGLE_AI_API_KEY=...
```

## 4. Add Inputs

### Source documents

Put files in `context-refs/`.

Supported by the extraction step:
- `.pdf`
- `.md`
- `.txt`

### User guidance files

Edit:
- `user-inputs/story.md`
- `user-inputs/style-guide.md`

Examples are in:
- `user-inputs/examples/story-example.md`
- `user-inputs/examples/style-guide-example.md`

Quick bootstrap (optional):

```bash
cp user-inputs/examples/story-example.md user-inputs/story.md
cp user-inputs/examples/style-guide-example.md user-inputs/style-guide.md
```

## 5. Verify Setup (No API Calls)

Dry-run validates setup and writes prompt logs:

```bash
node pipeline/02-classify-context.js --dry-run
node pipeline/03-synthesize-content.js --dry-run
node pipeline/04-generate-final.js --dry-run
node pipeline/tools/review-prompts.js --list
```

## 6. Run Full Pipeline

```bash
./pipeline/run-pipeline.sh --non-interactive
```

Expected outputs:
- `output/investor-deck.pptx`
- `output/deck-config.json`
- `output/assets/*.png`

## Next

- [Quickstart Cheat Sheet](quickstart.md)
- [Configuration Guide](configuration.md)
- [Pipeline Reference](pipeline.md)
- [Troubleshooting](troubleshooting.md)
