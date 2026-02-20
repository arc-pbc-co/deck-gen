#!/bin/bash
# =============================================================================
# Deck Generator Execution Script
# Runs the pptxgenjs deck generator with the synthesized config
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_PATH="$SCRIPT_DIR/../output/deck-config.json"
OUTPUT_PATH="$SCRIPT_DIR/../output/investor-deck.pptx"
GENERATOR="$SCRIPT_DIR/../investor-deck-generator/scripts/generate-deck.js"

echo "========================================"
echo "Deck Generator"
echo "========================================"
echo "Config: $CONFIG_PATH"
echo "Output: $OUTPUT_PATH"
echo ""

# Check if config exists
if [ ! -f "$CONFIG_PATH" ]; then
    echo "Error: Config file not found at $CONFIG_PATH"
    echo ""
    echo "Run the generation steps first:"
    echo "  node 03-synthesize-content.js"
    echo "  node 04-generate-final.js"
    exit 1
fi

# Check if generator exists
if [ ! -f "$GENERATOR" ]; then
    echo "Error: Generator script not found at $GENERATOR"
    exit 1
fi

# Check for pptxgenjs
if ! npm list pptxgenjs >/dev/null 2>&1; then
    echo "Warning: pptxgenjs may not be installed"
    echo "Installing dependencies..."
    npm install pptxgenjs --save 2>/dev/null || {
        echo "Error: Failed to install pptxgenjs"
        echo "Try: npm install pptxgenjs"
        exit 1
    }
fi

# Run the generator
echo "Generating PowerPoint deck..."
echo ""

node "$GENERATOR" --config "$CONFIG_PATH" --output "$OUTPUT_PATH"

# Check result
if [ -f "$OUTPUT_PATH" ]; then
    echo ""
    echo "========================================"
    echo "Generation complete!"
    echo "========================================"

    # File info
    size=$(ls -lh "$OUTPUT_PATH" | awk '{print $5}')
    echo "Output file: $OUTPUT_PATH"
    echo "File size:   $size"

    # Try to get slide count from config
    if command -v jq &> /dev/null; then
        slides=$(jq '.slides | length' "$CONFIG_PATH" 2>/dev/null || echo "unknown")
        echo "Slides:      $slides"
    fi

    echo ""
    echo "Open the deck with:"
    echo "  open \"$OUTPUT_PATH\""
else
    echo ""
    echo "Error: Deck generation failed"
    echo "Check the output above for errors"
    exit 1
fi
