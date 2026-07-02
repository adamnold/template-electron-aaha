#!/usr/bin/env bash
# Removes the installed .desktop entry and icon for this app.
set -euo pipefail
cd "$(dirname "$0")"
APP_NAME="$(node -p "require('./app.config.js').name")"
SLUG="$(echo "$APP_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')"
rm -f "$HOME/.local/share/applications/$SLUG.desktop"
rm -f "$HOME/.local/share/icons/hicolor/512x512/apps/$SLUG.png"
update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
kbuildsycoca6 2>/dev/null || kbuildsycoca5 2>/dev/null || true
echo ">> Removed '$APP_NAME' launcher and icon."
