#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
npm ci
npm run check
npm test
npm run icons
npm run dist
appimage="$(find dist -maxdepth 1 -type f -name '*.AppImage' -print -quit)"
if [[ -z "$appimage" ]]; then
  echo "ERROR: electron-builder did not produce an AppImage." >&2
  exit 1
fi
(
  cd dist
  sha256sum "$(basename "$appimage")" > SHA256SUMS
  sha256sum -c SHA256SUMS
)
echo "Build complete: $appimage"
