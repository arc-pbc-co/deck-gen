#!/bin/bash
# =============================================================================
# Context Combination Script
# Combines all extracted text files into a single context document
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INPUT_DIR="$SCRIPT_DIR/../extracted-text"
OUTPUT_DIR="$SCRIPT_DIR/../output"
COMBINED_FILE="$OUTPUT_DIR/combined-context.txt"

echo "========================================"
echo "Context Combination"
echo "========================================"
echo "Input:  $INPUT_DIR"
echo "Output: $COMBINED_FILE"
echo ""

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Check for input files
if [ ! -d "$INPUT_DIR" ] || [ -z "$(ls -A "$INPUT_DIR"/*.txt 2>/dev/null)" ]; then
    echo "Error: No text files found in $INPUT_DIR"
    echo "Run 01-extract-pdfs.sh first"
    exit 1
fi

# Start combined file
cat > "$COMBINED_FILE" << 'HEADER'
# Combined ARC Context Documents
# ================================
# This file contains extracted text from all source documents
# for use in investor deck content synthesis.
#
HEADER

echo "Generated: $(date)" >> "$COMBINED_FILE"
echo "" >> "$COMBINED_FILE"

# Count files
FILE_COUNT=$(ls -1 "$INPUT_DIR"/*.txt 2>/dev/null | wc -l | tr -d ' ')
echo "Combining $FILE_COUNT text files..."
echo ""

# Combine all text files
CURRENT=0
for txt in "$INPUT_DIR"/*.txt; do
    CURRENT=$((CURRENT + 1))
    filename=$(basename "$txt")
    lines=$(wc -l < "$txt" | tr -d ' ')

    echo "[$CURRENT/$FILE_COUNT] Adding: $filename ($lines lines)"

    # Add file header
    echo "" >> "$COMBINED_FILE"
    echo "================================================================================" >> "$COMBINED_FILE"
    echo "SOURCE: $filename" >> "$COMBINED_FILE"
    echo "================================================================================" >> "$COMBINED_FILE"
    echo "" >> "$COMBINED_FILE"

    # Add content
    cat "$txt" >> "$COMBINED_FILE"

    # Add separator
    echo "" >> "$COMBINED_FILE"
    echo "--- END: $filename ---" >> "$COMBINED_FILE"
    echo "" >> "$COMBINED_FILE"
done

echo ""
echo "========================================"
echo "Combination complete!"
echo "========================================"

# Summary
total_lines=$(wc -l < "$COMBINED_FILE" | tr -d ' ')
total_size=$(ls -lh "$COMBINED_FILE" | awk '{print $5}')

echo "Combined file: $COMBINED_FILE"
echo "Total lines:   $total_lines"
echo "File size:     $total_size"
echo ""

# Preview
echo "Preview (first 20 lines):"
echo "----------------------------------------"
head -20 "$COMBINED_FILE"
echo "..."
