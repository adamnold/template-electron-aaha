#!/usr/bin/env bash
# Clone this generic scaffold into a fresh app project.
#
# Usage:
#   ./new-app.sh "Perplexity" https://www.perplexity.ai
#   ./new-app.sh "Proton Calendar" https://calendar.proton.me "https://.../icon-512.png"
#
# Args:
#   $1  App name (quoted)         e.g. "Proton Calendar"
#   $2  URL to wrap               e.g. https://calendar.proton.me
#   $3  (optional) icon URL       a 512x512 PNG to auto-download
set -euo pipefail
cd "$(dirname "$0")"

NAME="${1:-}"
URL="${2:-}"
ICON_URL="${3:-}"
if [[ -z "$NAME" || -z "$URL" ]]; then
  echo "Usage: ./new-app.sh \"App Name\" https://app.url [https://icon-512.png]"
  exit 1
fi

SLUG="$(echo "$NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')"
DEST="../$SLUG"
APPID="com.adamandhisagents.$(echo "$SLUG" | tr -d '-')"

if [[ -e "$DEST" ]]; then
  echo "ERROR: $DEST already exists. Pick a different name or remove it."
  exit 1
fi

echo ">> Creating $DEST from the generic scaffold..."
mkdir -p "$DEST"
cp -r src build.sh install.sh uninstall.sh new-app.sh package.json app.config.js "$DEST/"
mkdir -p "$DEST/icons"

# Write a fresh app.config.js for the new app.
cat > "$DEST/app.config.js" <<EOF
module.exports = {
  url: "$URL",
  name: "$NAME",
  wmClass: "$NAME",
  appId: "$APPID",
  width: 1280,
  height: 800,
  openExternalInBrowser: true,
  allowedHosts: [],   // tighten to e.g. ["proton.me"] or ["perplexity.ai"] if you want
  userAgent: null,
  disableHardening: false   // privacy hardening ON by default; set true only to debug
};
EOF

# Optionally fetch the icon.
if [[ -n "$ICON_URL" ]]; then
  echo ">> Downloading icon from $ICON_URL ..."
  if curl -fsSL "$ICON_URL" -o "$DEST/icons/icon.png"; then
    echo "   Icon saved to $DEST/icons/icon.png"
  else
    echo "   WARNING: icon download failed. Add a 512x512 PNG manually at $DEST/icons/icon.png"
  fi
else
  echo ">> No icon URL given. Add a 512x512 PNG at $DEST/icons/icon.png before building."
fi

echo
echo ">> Done. Next steps:"
echo "   cd $DEST"
echo "   # (ensure icons/icon.png exists — 512x512 PNG)"
echo "   ./build.sh && ./install.sh"
