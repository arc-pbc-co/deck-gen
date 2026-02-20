#!/bin/bash
# =============================================================================
# Master Pipeline Script (v2.0 - Multi-Agent)
# =============================================================================
#
# Runs the complete multi-agent deck generation pipeline:
#   1. Extract text from PDFs (markitdown)
#   2. Classify context by slide type (Claude)
#   3. Synthesize content (ChatGPT 5.2 extended_thinking)
#   4. Generate final config + images (Gemini + Nano Banana Pro)
#   5. Render PowerPoint deck (pptxgenjs)
#
# Usage:
#   ./run-pipeline.sh [options]
#
# Options:
#   --mode <mode>       Reasoning mode: standard | extended_thinking | deep_research
#   --skip-extract      Skip PDF extraction (Phase 1)
#   --skip-classify     Skip classification (Phase 2)
#   --skip-synthesize   Skip synthesis (Phase 3)
#   --skip-images       Skip image generation in Phase 4
#   --from-phase <n>    Start from phase n (1-5)
#   --yes, -y           Continue on missing API-key warnings without prompting
#   --non-interactive   Fail instead of prompting when warnings occur
#   --help              Show this help message
#
# Environment Variables:
#   ANTHROPIC_API_KEY   Required for Phase 2 (Claude)
#   OPENAI_API_KEY      Required for Phase 3 (ChatGPT)
#   GOOGLE_AI_API_KEY   Required for Phase 4 (Gemini + Nano Banana Pro)
#
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Load .env file if it exists
ENV_FILE="$SCRIPT_DIR/../.env"
if [ -f "$ENV_FILE" ]; then
    # Export variables from .env file (skip comments and empty lines)
    while IFS='=' read -r key value || [ -n "$key" ]; do
        # Skip comments and empty lines
        [[ "$key" =~ ^[[:space:]]*# ]] && continue
        [[ -z "$key" ]] && continue
        # Remove leading/trailing whitespace from key
        key=$(echo "$key" | xargs)
        # Skip if key is empty after trimming
        [[ -z "$key" ]] && continue
        # Remove quotes from value if present
        value="${value%\"}"
        value="${value#\"}"
        value="${value%\'}"
        value="${value#\'}"
        # Export the variable
        export "$key=$value"
    done < "$ENV_FILE"
fi

# Default options
MODE="extended_thinking"
SKIP_EXTRACT=false
SKIP_CLASSIFY=false
SKIP_SYNTHESIZE=false
SKIP_IMAGES=false
FROM_PHASE=1
AUTO_YES=false
NON_INTERACTIVE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --mode|-m)
            MODE="$2"
            shift 2
            ;;
        --skip-extract)
            SKIP_EXTRACT=true
            shift
            ;;
        --skip-classify)
            SKIP_CLASSIFY=true
            shift
            ;;
        --skip-synthesize)
            SKIP_SYNTHESIZE=true
            shift
            ;;
        --skip-images)
            SKIP_IMAGES=true
            shift
            ;;
        --from-phase)
            FROM_PHASE="$2"
            shift 2
            ;;
        --yes|-y)
            AUTO_YES=true
            shift
            ;;
        --non-interactive)
            NON_INTERACTIVE=true
            shift
            ;;
        --help|-h)
            echo "Usage: ./run-pipeline.sh [options]"
            echo ""
            echo "Multi-Agent Deck Generation Pipeline v2.0"
            echo ""
            echo "Options:"
            echo "  --mode <mode>       Reasoning mode: standard | extended_thinking | deep_research"
            echo "  --skip-extract      Skip PDF extraction (Phase 1)"
            echo "  --skip-classify     Skip classification (Phase 2)"
            echo "  --skip-synthesize   Skip synthesis (Phase 3)"
            echo "  --skip-images       Skip image generation in Phase 4"
            echo "  --from-phase <n>    Start from phase n (1-5)"
            echo "  --yes, -y           Continue on missing API-key warnings without prompting"
            echo "  --non-interactive   Fail instead of prompting when warnings occur"
            echo "  --help              Show this help message"
            echo ""
            echo "Phases:"
            echo "  1. Extract     - Extract text from PDFs using markitdown"
            echo "  2. Classify    - Classify content by slide type using Claude"
            echo "  3. Synthesize  - Synthesize slides using ChatGPT 5.2"
            echo "  4. Generate    - Polish JSON + generate images (Gemini + Nano Banana Pro)"
            echo "  5. Render      - Generate PowerPoint with pptxgenjs"
            echo ""
            echo "Environment Variables Required:"
            echo "  ANTHROPIC_API_KEY   For Phase 2 (Claude classifier)"
            echo "  OPENAI_API_KEY      For Phase 3 (ChatGPT synthesizer)"
            echo "  GOOGLE_AI_API_KEY   For Phase 4 (Gemini + Nano Banana Pro)"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Validate mode
case $MODE in
    standard|extended_thinking|deep_research)
        ;;
    *)
        echo "Invalid mode: $MODE"
        echo "Valid modes: standard, extended_thinking, deep_research"
        exit 1
        ;;
esac

# Check user inputs exist
check_user_inputs() {
    if [ ! -f "../user-inputs/story.md" ]; then
        echo "Error: user-inputs/story.md not found"
        echo ""
        echo "Create this file with your investor deck narrative arc."
        echo "See user-inputs/examples/story-example.md for a template."
        exit 1
    fi
    if [ ! -f "../user-inputs/style-guide.md" ]; then
        echo "Error: user-inputs/style-guide.md not found"
        echo ""
        echo "Create this file with your style preferences."
        echo "See user-inputs/examples/style-guide-example.md for a template."
        exit 1
    fi
}

# Check required API keys based on phases to run
check_api_keys() {
    local errors=0

    if [ "$FROM_PHASE" -le 2 ] && [ "$SKIP_CLASSIFY" = false ]; then
        if [ -z "$ANTHROPIC_API_KEY" ]; then
            echo "Warning: ANTHROPIC_API_KEY not set (required for Phase 2)"
            errors=$((errors + 1))
        fi
    fi

    if [ "$FROM_PHASE" -le 3 ] && [ "$SKIP_SYNTHESIZE" = false ]; then
        if [ -z "$OPENAI_API_KEY" ]; then
            echo "Warning: OPENAI_API_KEY not set (required for Phase 3)"
            errors=$((errors + 1))
        fi
    fi

    if [ "$FROM_PHASE" -le 4 ]; then
        if [ -z "$GOOGLE_AI_API_KEY" ]; then
            echo "Warning: GOOGLE_AI_API_KEY not set (required for Phase 4)"
            errors=$((errors + 1))
        fi
    fi

    if [ $errors -gt 0 ]; then
        echo ""
        echo "Set missing API keys with:"
        echo "  export ANTHROPIC_API_KEY='sk-ant-...'"
        echo "  export OPENAI_API_KEY='sk-...'"
        echo "  export GOOGLE_AI_API_KEY='AIza...'"
        echo ""
        if [ "$AUTO_YES" = true ]; then
            echo "Continuing due to --yes"
        elif [ "$NON_INTERACTIVE" = true ] || [ ! -t 0 ]; then
            echo "Non-interactive mode: refusing to continue with missing API keys."
            echo "Pass --yes to override."
            exit 1
        else
            read -p "Continue anyway? (y/N) " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                exit 1
            fi
        fi
    fi
}

echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║         ARC Multi-Agent Deck Generator Pipeline v2.0            ║"
echo "╠══════════════════════════════════════════════════════════════════╣"
echo "║  Mode: $(printf '%-56s' "$MODE") ║"
echo "║  Starting from Phase: $(printf '%-44s' "$FROM_PHASE") ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

# Pre-flight checks
check_user_inputs
check_api_keys

# Track timing
START_TIME=$(date +%s)

# Create intermediate directory if needed
mkdir -p ../intermediate
mkdir -p ../output/assets

# =============================================================================
# Phase 1: Extract PDFs
# =============================================================================

if [ "$FROM_PHASE" -le 1 ]; then
    if [ "$SKIP_EXTRACT" = true ]; then
        echo "[1/5] Skipping PDF extraction (--skip-extract)"
    else
        echo "[1/5] Extracting PDF content..."
        echo "────────────────────────────────────────"
        ./01-extract-pdfs.sh
    fi
    echo ""
fi

# =============================================================================
# Phase 2: Classify Context (Claude)
# =============================================================================

if [ "$FROM_PHASE" -le 2 ]; then
    if [ "$SKIP_CLASSIFY" = true ]; then
        echo "[2/5] Skipping context classification (--skip-classify)"
    else
        echo "[2/5] Classifying context with Claude..."
        echo "────────────────────────────────────────"
        node 02-classify-context.js
    fi
    echo ""
fi

# =============================================================================
# Phase 3: Synthesize Content (ChatGPT 5.2)
# =============================================================================

if [ "$FROM_PHASE" -le 3 ]; then
    if [ "$SKIP_SYNTHESIZE" = true ]; then
        echo "[3/5] Skipping content synthesis (--skip-synthesize)"
    else
        echo "[3/5] Synthesizing content with ChatGPT 5.2..."
        echo "────────────────────────────────────────"
        node 03-synthesize-content.js --mode "$MODE"
    fi
    echo ""
fi

# =============================================================================
# Phase 4: Generate Final (Gemini + Nano Banana Pro)
# =============================================================================

if [ "$FROM_PHASE" -le 4 ]; then
    echo "[4/5] Generating final config + images..."
    echo "────────────────────────────────────────"
    if [ "$SKIP_IMAGES" = true ]; then
        node 04-generate-final.js --skip-images
    else
        node 04-generate-final.js
    fi
    echo ""
fi

# =============================================================================
# Phase 5: Render Deck (pptxgenjs)
# =============================================================================

if [ "$FROM_PHASE" -le 5 ]; then
    echo "[5/5] Rendering PowerPoint deck..."
    echo "────────────────────────────────────────"
    ./05-render-deck.sh
    echo ""
fi

# =============================================================================
# Summary
# =============================================================================

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))
MINUTES=$((ELAPSED / 60))
SECONDS=$((ELAPSED % 60))

echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║                    Pipeline Complete!                            ║"
echo "╠══════════════════════════════════════════════════════════════════╣"
echo "║  Duration: $(printf '%dm %02ds' $MINUTES $SECONDS)                                              ║"
echo "╠══════════════════════════════════════════════════════════════════╣"
echo "║  Output Files:                                                   ║"
echo "║    • Deck:    output/investor-deck.pptx                          ║"
echo "║    • Config:  output/deck-config.json                            ║"
echo "║    • Assets:  output/assets/*.png                                ║"
echo "╠══════════════════════════════════════════════════════════════════╣"
echo "║  Intermediate Files:                                             ║"
echo "║    • Classified: intermediate/classified-context.json            ║"
echo "║    • Synthesis:  intermediate/synthesis-output.json              ║"
echo "║    • Citations:  intermediate/citations.json                     ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo "  1. Review the generated deck:"
echo "     open ../output/investor-deck.pptx"
echo ""
echo "  2. Review/edit the config if needed:"
echo "     code ../output/deck-config.json"
echo ""
echo "  3. Re-run just the deck rendering after edits:"
echo "     ./05-render-deck.sh"
echo ""
echo "  4. Re-run from a specific phase:"
echo "     ./run-pipeline.sh --from-phase 4"
echo ""
