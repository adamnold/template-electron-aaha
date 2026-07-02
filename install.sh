#!/usr/bin/env bash
# Installs the built app into your user environment so KDE/GNOME show it as a
# real, pinnable app with the correct icon on Wayland.
# Run AFTER ./build.sh, from the project root:  ./install.sh
set -euo pipefail
cd "$(dirname "$0")"

APP_NAME="$(node -p "require('./app.config.js').name")"
WM_CLASS="$(node -p "require('./app.config.js').wmClass")"
SLUG="$(echo "$APP_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')"

BIN_DIR="$PWD/dist/linux-unpacked"
BIN_PATH="$BIN_DIR/$SLUG"
if [[ ! -x "$BIN_PATH" ]]; then
  BIN_PATH="$(find "$BIN_DIR" -maxdepth 1 -type f -executable | head -n1 || true)"
fi
if [[ -z "${BIN_PATH:-}" || ! -x "$BIN_PATH" ]]; then
  echo "ERROR: Could not find the built executable in $BIN_DIR"
  echo "Did you run ./build.sh first?"
  exit 1
fi
echo ">> Using binary: $BIN_PATH"

ICON_DEST="$HOME/.local/share/icons/hicolor/512x512/apps"
mkdir -p "$ICON_DEST"
if [ -f icons/icon.png ]; then
  cp "icons/icon.png" "$ICON_DEST/$SLUG.png"
  echo ">> Icon installed: $ICON_DEST/$SLUG.png"
  ICON_LINE="Icon=$SLUG"
else
  echo ">> No icons/icon.png; using a generic icon name."
  ICON_LINE="Icon=application-x-executable"
fi

APPS_DIR="$HOME/.local/share/applications"
mkdir -p "$APPS_DIR"
DESKTOP_FILE="$APPS_DIR/$SLUG.desktop"

cat > "$DESKTOP_FILE" <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=$APP_NAME
Comment=$APP_NAME desktop app
Exec="$BIN_PATH" %U
$ICON_LINE
Terminal=false
Categories=Network;
StartupWMClass=$WM_CLASS
StartupNotify=true
EOF
echo ">> Desktop entry written: $DESKTOP_FILE"

update-desktop-database "$APPS_DIR" 2>/dev/null || true
gtk-update-icon-cache "$HOME/.local/share/icons/hicolor" 2>/dev/null || true
kbuildsycoca6 2>/dev/null || kbuildsycoca5 2>/dev/null || true

echo
echo ">> Installed '$APP_NAME'. Search for it in your app launcher, open it,"
echo "   then pin it to your panel/taskbar. The icon should stick."
