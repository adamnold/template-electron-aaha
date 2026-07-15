#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

HOME_DIR="${AAHA_HOME:-$HOME}"
SKIP_SANDBOX="${AAHA_SKIP_SANDBOX_SETUP:-0}"
read_cfg() { node -p "require('./app.config.js').$1"; }
APP_NAME="$(read_cfg productName)"
REPO_NAME="$(read_cfg repoName)"
APP_ID="$(read_cfg appId)"
EXECUTABLE="$(read_cfg executable)"
ICON_NAME="$(read_cfg iconName)"
PROFILE_NAME="$(read_cfg profileName)"
COMMENT="$(read_cfg comment)"
CATEGORY="$(read_cfg category)"
KEYWORDS="$(read_cfg keywords)"
VERSION="$(node -p "require('./package.json').version")"

usage() {
  echo "Usage: ./install.sh [--install-root /absolute/path/$REPO_NAME]"
  echo "  default         Install under ~/.local/opt/aaha/$REPO_NAME."
  echo "  --install-root  Use an explicit per-application installation directory."
}

REQUESTED_ROOT=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --install-root)
      [[ -z "$REQUESTED_ROOT" && $# -ge 2 && -n "$2" ]] || { usage >&2; exit 2; }
      REQUESTED_ROOT="$2"
      shift 2
      ;;
    -h|--help)
      [[ $# -eq 1 ]] || { usage >&2; exit 2; }
      usage
      exit 0
      ;;
    *)
      usage >&2
      exit 2
      ;;
  esac
done

validate_install_root() {
  local candidate="$1"
  local normalized
  [[ -n "$candidate" && "$candidate" == /* ]] || {
    echo "ERROR: Install root must be an absolute path." >&2
    return 2
  }
  case "/$candidate/" in
    *"/../"*|*"/./"*)
      echo "ERROR: Install root must not contain traversal components." >&2
      return 2
      ;;
  esac
  case "$candidate" in
    *$'\n'*|*$'\r'*|*'"'*|*$'\\'*)
      echo "ERROR: Install root contains unsupported characters." >&2
      return 2
      ;;
  esac
  normalized="$(realpath -m -- "$candidate")"
  [[ "$normalized" != "/" && "$normalized" != "$HOME_DIR" ]] || {
    echo "ERROR: Refusing unsafe install root: $normalized" >&2
    return 2
  }
  [[ "$(basename -- "$normalized")" == "$REPO_NAME" ]] || {
    echo "ERROR: Install root must end with /$REPO_NAME." >&2
    return 2
  }
  printf '%s\n' "$normalized"
}

DEFAULT_INSTALL_ROOT="$HOME_DIR/.local/opt/aaha/$REPO_NAME"
INSTALL_ROOT="$(validate_install_root "${REQUESTED_ROOT:-$DEFAULT_INSTALL_ROOT}")" || exit $?
STATE_HOME="${AAHA_STATE_HOME:-${XDG_STATE_HOME:-$HOME_DIR/.local/state}}"
RECEIPT_DIR="$STATE_HOME/aaha/$REPO_NAME"
RECEIPT_FILE="$RECEIPT_DIR/install-root"
INSTALL_MARKER="$INSTALL_ROOT/.aaha-install"
APP_DEST="$INSTALL_ROOT/app"
STAGE_DEST="$INSTALL_ROOT/.app-new-$$"
BUILT_APP="$PWD/dist/linux-unpacked"

if [[ ! -x "$BUILT_APP/$EXECUTABLE" ]]; then
  echo "ERROR: Built executable not found. Run ./build.sh first." >&2
  exit 1
fi
if [[ -f dist/SHA256SUMS ]]; then
  (cd dist && sha256sum -c SHA256SUMS)
else
  echo "ERROR: dist/SHA256SUMS is missing." >&2
  exit 1
fi

mkdir -p "$INSTALL_ROOT"
rm -rf -- "$STAGE_DEST"
cp -a "$BUILT_APP" "$STAGE_DEST"
PRESERVED_SANDBOX=0
STAGED_SANDBOX="$STAGE_DEST/chrome-sandbox"
INSTALLED_SANDBOX="$APP_DEST/chrome-sandbox"
restore_preserved_sandbox() {
  if [[ "$PRESERVED_SANDBOX" == "1" && -f "$STAGED_SANDBOX" && -d "$APP_DEST" ]]; then
    mv "$STAGED_SANDBOX" "$INSTALLED_SANDBOX" 2>/dev/null || true
  fi
}
trap restore_preserved_sandbox EXIT
if [[ -f "$INSTALLED_SANDBOX" && -f "$STAGED_SANDBOX" ]] &&
   [[ "$(stat -c '%u:%g:%a' "$INSTALLED_SANDBOX")" == "0:0:4755" ]] &&
   cmp -s "$INSTALLED_SANDBOX" "$STAGED_SANDBOX"; then
  rm -f "$STAGED_SANDBOX"
  mv "$INSTALLED_SANDBOX" "$STAGED_SANDBOX"
  PRESERVED_SANDBOX=1
fi
rm -rf -- "$APP_DEST"
mv "$STAGE_DEST" "$APP_DEST"
PRESERVED_SANDBOX=0
trap - EXIT

SANDBOX_HELPER="$APP_DEST/chrome-sandbox"
if [[ -f "$SANDBOX_HELPER" && "$SKIP_SANDBOX" != "1" ]]; then
  if [[ "$(stat -c '%u:%g:%a' "$SANDBOX_HELPER")" != "0:0:4755" ]]; then
    sudo chown root:root "$SANDBOX_HELPER"
    sudo chmod 4755 "$SANDBOX_HELPER"
  fi
fi

NEW_PROFILE="$HOME_DIR/.config/$PROFILE_NAME"
if [[ ! -e "$NEW_PROFILE" ]]; then
  while IFS= read -r old_profile; do
    [[ -n "$old_profile" ]] || continue
    OLD_PROFILE="$HOME_DIR/.config/$old_profile"
    if [[ -d "$OLD_PROFILE" ]]; then
      PROFILE_STAGE="$HOME_DIR/.config/.${PROFILE_NAME}.migration-$$"
      rm -rf -- "$PROFILE_STAGE"
      cp -a "$OLD_PROFILE" "$PROFILE_STAGE"
      mv "$PROFILE_STAGE" "$NEW_PROFILE"
      echo "Migrated profile from $OLD_PROFILE; original retained."
      break
    fi
  done < <(node -e "for (const p of require('./app.config.js').legacyProfileNames) console.log(p)")
fi

for size in 16 24 32 48 64 96 128 256 512; do
  icon_dir="$HOME_DIR/.local/share/icons/hicolor/${size}x${size}/apps"
  mkdir -p "$icon_dir"
  cp "build/icons/${size}x${size}.png" "$icon_dir/$ICON_NAME.png"
done
apps_dir="$HOME_DIR/.local/share/applications"
mkdir -p "$apps_dir"
desktop_file="$apps_dir/$APP_ID.desktop"
cat > "$desktop_file" <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=$APP_NAME
Comment=$COMMENT
Exec="$APP_DEST/$EXECUTABLE"
Icon=$ICON_NAME
Terminal=false
Categories=$CATEGORY
Keywords=$KEYWORDS
StartupWMClass=$APP_ID
StartupNotify=true
X-KDE-StartupNotify=true
EOF
while IFS= read -r old_id; do
  [[ -n "$old_id" ]] || continue
  cat > "$apps_dir/$old_id.desktop" <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=$APP_NAME
Comment=Compatibility launcher for an existing KDE panel pin
Exec="$APP_DEST/$EXECUTABLE"
Icon=$ICON_NAME
Terminal=false
Categories=$CATEGORY
StartupWMClass=$APP_ID
NoDisplay=true
EOF
done < <(node -e "for (const p of require('./app.config.js').compatibilityDesktopIds) console.log(p)")

find "$INSTALL_ROOT" -maxdepth 1 -type f -name '*.AppImage' -delete
cp dist/*.AppImage "$INSTALL_ROOT/"
cp dist/SHA256SUMS "$INSTALL_ROOT/"
printf 'AAHA_INSTALL_V1\nrepo=%s\napp_id=%s\n' "$REPO_NAME" "$APP_ID" > "$INSTALL_MARKER"
chmod 0644 "$INSTALL_MARKER"
mkdir -p "$RECEIPT_DIR"
RECEIPT_STAGE="$RECEIPT_FILE.new-$$"
(umask 077; printf '%s\n' "$INSTALL_ROOT" > "$RECEIPT_STAGE")
mv "$RECEIPT_STAGE" "$RECEIPT_FILE"
chmod 0600 "$RECEIPT_FILE"

if [[ "${AAHA_SKIP_DESKTOP_REFRESH:-0}" != "1" ]]; then
  update-desktop-database "$apps_dir" 2>/dev/null || true
  gtk-update-icon-cache "$HOME_DIR/.local/share/icons/hicolor" 2>/dev/null || true
  kbuildsycoca6 2>/dev/null || kbuildsycoca5 2>/dev/null || true
fi
echo "Installed $APP_NAME v$VERSION under $INSTALL_ROOT"
