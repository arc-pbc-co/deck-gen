#!/bin/bash
# =============================================================================
# Context Reference Extraction Script
# Extracts text from PDFs in context-refs using markitdown
# Falls back to OCR (tesseract) for image-based PDFs
# Also copies markdown (.md) and text (.txt) files directly
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="$SCRIPT_DIR/../context-refs"
OUTPUT_DIR="$SCRIPT_DIR/../extracted-text"

# Minimum character threshold - below this, we consider extraction failed
MIN_CHARS=100

echo "========================================"
echo "Context Reference Extraction"
echo "========================================"
echo "Source: $SOURCE_DIR"
echo "Output: $OUTPUT_DIR"
echo ""

# Create output directory
mkdir -p "$OUTPUT_DIR"

# =============================================================================
# Phase 0: Copy text-based files (markdown, txt) directly
# =============================================================================

echo "Processing text files (md, txt)..."

MD_COUNT=0
for file in "$SOURCE_DIR"/*.md "$SOURCE_DIR"/*.txt; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        # For .md files, change extension to .txt for consistency
        if [[ "$filename" == *.md ]]; then
            output_name="${filename%.md}.txt"
        else
            output_name="$filename"
        fi
        cp "$file" "$OUTPUT_DIR/$output_name"
        echo "  Copied: $filename -> $output_name"
        MD_COUNT=$((MD_COUNT + 1))
    fi
done

if [ "$MD_COUNT" -gt 0 ]; then
    echo "  -> $MD_COUNT text files copied"
else
    echo "  -> No text files found"
fi
echo ""

# Check if markitdown is installed
if ! command -v markitdown &> /dev/null && ! python3 -m markitdown --help &> /dev/null 2>&1; then
    echo "Error: markitdown is not installed"
    echo "Install with: pip install markitdown"
    exit 1
fi

# Check if tesseract is installed (for OCR fallback)
OCR_AVAILABLE=false
if command -v tesseract &> /dev/null; then
    # Check if pdf2image and pytesseract are available
    if python3 -c "import pdf2image; import pytesseract" 2>/dev/null; then
        OCR_AVAILABLE=true
        echo "OCR support: enabled (tesseract + pdf2image)"
    else
        echo "OCR support: disabled (missing pdf2image or pytesseract)"
        echo "  Install with: pip install pdf2image pytesseract"
    fi
else
    echo "OCR support: disabled (tesseract not found)"
    echo "  Install with: brew install tesseract"
fi
echo ""

# Python script for OCR extraction
OCR_SCRIPT='
import sys
import os
from pdf2image import convert_from_path
import pytesseract

pdf_path = sys.argv[1]
output_path = sys.argv[2]

# Convert PDF to images
images = convert_from_path(pdf_path, dpi=300)

# Extract text from each page
all_text = []
for i, image in enumerate(images):
    text = pytesseract.image_to_string(image)
    if text.strip():
        all_text.append(f"--- Page {i+1} ---\n{text}")

# Write output
with open(output_path, "w") as f:
    f.write("\n\n".join(all_text))

print(len("\n\n".join(all_text)))
'

# Function to extract text using OCR
extract_with_ocr() {
    local pdf="$1"
    local output="$2"

    if [ "$OCR_AVAILABLE" = true ]; then
        python3 -c "$OCR_SCRIPT" "$pdf" "$output" 2>/dev/null
        return $?
    else
        return 1
    fi
}

# Count PDFs
PDF_COUNT=$(ls -1 "$SOURCE_DIR"/*.pdf 2>/dev/null | wc -l | tr -d ' ')
echo "Found $PDF_COUNT PDF files to process"
echo ""

# Track statistics
MARKITDOWN_SUCCESS=0
OCR_SUCCESS=0
FAILED=0

# Extract text from each PDF
CURRENT=0
for pdf in "$SOURCE_DIR"/*.pdf; do
    if [ ! -f "$pdf" ]; then
        echo "No PDF files found in $SOURCE_DIR"
        exit 1
    fi

    CURRENT=$((CURRENT + 1))
    filename=$(basename "$pdf" .pdf)
    output_file="$OUTPUT_DIR/${filename}.txt"

    echo "[$CURRENT/$PDF_COUNT] Extracting: $filename"

    # Try markitdown first
    if python3 -m markitdown "$pdf" > "$output_file" 2>/dev/null; then
        char_count=$(wc -c < "$output_file" | tr -d ' ')

        if [ "$char_count" -ge "$MIN_CHARS" ]; then
            lines=$(wc -l < "$output_file" | tr -d ' ')
            echo "         -> $lines lines extracted (markitdown)"
            MARKITDOWN_SUCCESS=$((MARKITDOWN_SUCCESS + 1))
        else
            # Text extraction produced minimal content, try OCR
            echo "         -> Only $char_count chars, trying OCR..."

            if extract_with_ocr "$pdf" "$output_file"; then
                char_count=$(wc -c < "$output_file" | tr -d ' ')
                lines=$(wc -l < "$output_file" | tr -d ' ')
                if [ "$char_count" -ge "$MIN_CHARS" ]; then
                    echo "         -> $lines lines extracted (OCR)"
                    OCR_SUCCESS=$((OCR_SUCCESS + 1))
                else
                    echo "         -> OCR produced minimal content ($char_count chars)"
                    FAILED=$((FAILED + 1))
                fi
            else
                echo "         -> OCR failed or unavailable"
                FAILED=$((FAILED + 1))
            fi
        fi
    else
        # markitdown failed entirely, try OCR
        echo "         -> markitdown failed, trying OCR..."

        if extract_with_ocr "$pdf" "$output_file"; then
            char_count=$(wc -c < "$output_file" | tr -d ' ')
            lines=$(wc -l < "$output_file" | tr -d ' ')
            if [ "$char_count" -ge "$MIN_CHARS" ]; then
                echo "         -> $lines lines extracted (OCR)"
                OCR_SUCCESS=$((OCR_SUCCESS + 1))
            else
                echo "         -> OCR produced minimal content ($char_count chars)"
                echo "# Extraction failed for: $filename" > "$output_file"
                FAILED=$((FAILED + 1))
            fi
        else
            echo "         -> OCR failed or unavailable"
            echo "# Extraction failed for: $filename" > "$output_file"
            FAILED=$((FAILED + 1))
        fi
    fi
done

echo ""
echo "========================================"
echo "Extraction complete!"
echo "========================================"
echo "Output directory: $OUTPUT_DIR"
echo ""
echo "Results:"
echo "  - Markitdown success: $MARKITDOWN_SUCCESS"
echo "  - OCR fallback success: $OCR_SUCCESS"
echo "  - Failed: $FAILED"
echo ""

# Summary
total_lines=$(cat "$OUTPUT_DIR"/*.txt 2>/dev/null | wc -l | tr -d ' ')
echo "Total lines extracted: $total_lines"
ls -lh "$OUTPUT_DIR"/*.txt 2>/dev/null | head -5
if [ "$PDF_COUNT" -gt 5 ]; then
    echo "... and $((PDF_COUNT - 5)) more files"
fi
