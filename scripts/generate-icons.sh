#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
SOURCE="assets/icon-source.png"
if [[ ! -f "$SOURCE" ]]; then
  echo "ERROR: $SOURCE is required." >&2
  exit 1
fi
mkdir -p build/icons
if command -v magick >/dev/null 2>&1; then
  resize=(magick)
  identify=(magick identify)
elif command -v convert >/dev/null 2>&1 && command -v identify >/dev/null 2>&1; then
  resize=(convert)
  identify=(identify)
else
  echo "ERROR: ImageMagick 6 or 7 is required to generate icons." >&2
  exit 1
fi
for size in 16 24 32 48 64 96 128 256 512; do
  "${resize[@]}" "$SOURCE" -background none -resize "${size}x${size}" "build/icons/${size}x${size}.png"
done
identify_output="$("${identify[@]}" -format '%m %w %h %[channels]' build/icons/512x512.png)"
if [[ "$identify_output" != PNG*512*512* ]]; then
  echo "ERROR: generated icon validation failed: $identify_output" >&2
  exit 1
fi
echo "Generated icon set from $SOURCE"
