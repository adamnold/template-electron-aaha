#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
usage() {
  echo "Usage: ./uninstall.sh [--purge]"
  echo "  no argument  Remove app files, launchers, and icons; preserve profile."
  echo "  --purge      Also remove the local Electron profile and sessions."
}
PURGE=0
case "${1:-}" in
  "") ;;
  --purge) PURGE=1 ;;
  -h|--help) usage; exit 0 ;;
  *) usage >&2; exit 2 ;;
esac
if [[ $# -gt 1 ]]; then usage >&2; exit 2; fi
HOME_DIR="${AAHA_HOME:-$HOME}"
read_cfg() { node -p "require('./app.config.js').$1"; }
APP_NAME="$(read_cfg productName)"
REPO_NAME="$(read_cfg repoName)"
APP_ID="$(read_cfg appId)"
ICON_NAME="$(read_cfg iconName)"
PROFILE_NAME="$(read_cfg profileName)"
rm -rf "$HOME_DIR/MyApps/$REPO_NAME"
rm -f "$HOME_DIR/.local/share/applications/$APP_ID.desktop"
while IFS= read -r old_id; do
  [[ -n "$old_id" ]] && rm -f "$HOME_DIR/.local/share/applications/$old_id.desktop"
done < <(node -e "for (const p of require('./app.config.js').compatibilityDesktopIds) console.log(p)")
for size in 16 24 32 48 64 96 128 256 512; do
  rm -f "$HOME_DIR/.local/share/icons/hicolor/${size}x${size}/apps/$ICON_NAME.png"
done
if [[ "$PURGE" == "1" ]]; then
  rm -rf "$HOME_DIR/.config/$PROFILE_NAME"
  echo "Purged local profile: $HOME_DIR/.config/$PROFILE_NAME"
else
  echo "Preserved local profile: $HOME_DIR/.config/$PROFILE_NAME"
fi
if [[ "${AAHA_SKIP_DESKTOP_REFRESH:-0}" != "1" ]]; then
  update-desktop-database "$HOME_DIR/.local/share/applications" 2>/dev/null || true
  kbuildsycoca6 2>/dev/null || kbuildsycoca5 2>/dev/null || true
fi
echo "Removed $APP_NAME."
