#!/bin/bash

# Script to collect all code content from src directory only into a single file

OUTPUT_FILE="all_code.txt"
PROJECT_ROOT="."
SRC_DIR="$PROJECT_ROOT/src"  # Específicamente apuntando al directorio src

echo "Recopilando código solo de src/ en $OUTPUT_FILE..."

# Clear the output file if it exists
: > "$OUTPUT_FILE"

# Check if src directory exists
if [ ! -d "$SRC_DIR" ]; then
    echo "Error: directorio src/ no encontrado!"
    exit 1
fi

# Find all files within src, excluding specified directories/files
find "$SRC_DIR" \
    \( -name "node_modules" -o -name ".DS_Store" -o -name "dist" -o -name "build" \) -prune \
    -o -type f -print0 | while IFS= read -r -d $'\0' file; do
    # Remove leading ./ or PROJECT_ROOT/ for cleaner output path
    relative_path="${file#$PROJECT_ROOT/}"
    if [[ "$relative_path" == "$file" ]]; then # Handle files directly in PROJECT_ROOT
        relative_path="${file#./}"
    fi

    # Skip the output file itself
    if [[ "$file" == "./$OUTPUT_FILE" ]]; then
        continue
    fi

    echo "Procesando: ${relative_path}" # Optional: show progress

    # Append header and content to the output file
    echo "---- ${relative_path} ----" >> "$OUTPUT_FILE"
    cat "$file" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE" # Add a newline separator

done

echo "Recopilación de código completada. Output guardado en $OUTPUT_FILE."

