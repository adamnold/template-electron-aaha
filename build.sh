#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
npm ci
npm run check
npm test
npm run icons
# Start from an empty dist/ so stale AppImages from older builds are never
# checksummed, installed, or uploaded alongside the new one.
rm -rf dist
npm run dist
mapfile -t appimages < <(find dist -maxdepth 1 -type f -name '*.AppImage')
if [[ ${#appimages[@]} -ne 1 ]]; then
  echo "ERROR: expected exactly one AppImage in dist/, found ${#appimages[@]}." >&2
  exit 1
fi
appimage="${appimages[0]}"
(
  cd dist
  sha256sum "$(basename "$appimage")" > SHA256SUMS
  sha256sum -c SHA256SUMS
)
echo "Build complete: $appimage"
