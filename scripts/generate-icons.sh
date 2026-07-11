#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
SOURCE="assets/icon-source.png"
if [[ ! -f "$SOURCE" ]]; then
  echo "ERROR: $SOURCE is required." >&2
  exit 1
fi
mkdir -p build/icons
for size in 16 24 32 48 64 96 128 256 512; do
  magick "$SOURCE" -background none -resize "${size}x${size}" "build/icons/${size}x${size}.png"
done
identify_output="$(magick identify -format '%m %w %h %[channels]' build/icons/512x512.png)"
if [[ "$identify_output" != PNG*512*512* ]]; then
  echo "ERROR: generated icon validation failed: $identify_output" >&2
  exit 1
fi
echo "Generated icon set from $SOURCE"
