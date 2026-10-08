#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

HOME_DIR="${AAHA_HOME:-$HOME}"
[[ "$(id -u)" != 0 ]] || { echo "ERROR: Per-user installation must not run as root." >&2; exit 1; }
node scripts/validate-config.js --template >/dev/null
CONFIG_ROOT="$(node -p "require('./src/profiles.js').profileRoot()")"
LOCAL_BUILD=0
PUBLIC_KEY="$PWD/release.pub"
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
  echo "Usage: ./install.sh [--install-root /absolute/path/$REPO_NAME] [--public-key /trusted/release.pub] [--local-build]"
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
    --local-build)
      [[ "$LOCAL_BUILD" == 0 ]] || { usage >&2; exit 2; }
      LOCAL_BUILD=1; shift ;;
    --public-key)
      [[ $# -ge 2 && "$2" == /* ]] || { usage >&2; exit 2; }
      PUBLIC_KEY="$2"; shift 2 ;;
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
STATE_HOME="${AAHA_STATE_HOME:-${XDG_STATE_HOME:-$HOME_DIR/.local/state}}"
RECEIPT_DIR="$STATE_HOME/aaha/$REPO_NAME"
RECEIPT_FILE="$RECEIPT_DIR/install-root"
[[ ! -L "$RECEIPT_FILE" ]] || { echo "ERROR: linked installation receipt." >&2; exit 1; }
if [[ -z "$REQUESTED_ROOT" && -f "$RECEIPT_FILE" ]]; then
  IFS= read -r REQUESTED_ROOT < "$RECEIPT_FILE" || true
fi
INSTALL_ROOT="$(validate_install_root "${REQUESTED_ROOT:-$DEFAULT_INSTALL_ROOT}")" || exit $?
INSTALL_MARKER="$INSTALL_ROOT/.aaha-install"
APP_DEST="$INSTALL_ROOT/app"
if [[ -e "$APP_DEST" || -L "$APP_DEST" ]]; then
  [[ ! -L "$APP_DEST" && -d "$APP_DEST" && -f "$INSTALL_MARKER" && ! -L "$INSTALL_MARKER" ]] &&
    grep -Fxq 'AAHA_INSTALL_V1' "$INSTALL_MARKER" &&
    grep -Fxq "repo=$REPO_NAME" "$INSTALL_MARKER" &&
    grep -Fxq "app_id=$APP_ID" "$INSTALL_MARKER" || {
      echo "ERROR: Existing installation identity is invalid; refusing replacement." >&2; exit 1;
    }
fi
verify_args=(--public-key "$PUBLIC_KEY")
if [[ "$LOCAL_BUILD" == 1 ]]; then
  verify_args+=(--local-build)
  echo "Local build: publisher authentication was explicitly skipped." >&2
fi
APPIMAGE_NAME="$(node scripts/verify-artifacts.js dist "${verify_args[@]}")"
# Authentication completes before creating/changing the installation root.
mkdir -p "$INSTALL_ROOT"
STAGE_DEST="$(mktemp -d "$INSTALL_ROOT/.stage.XXXXXXXX")"
APP_REPLACED=0
rollback() {
  if [[ "$APP_REPLACED" == 1 ]]; then rm -rf -- "$APP_DEST"; fi
  if [[ -d "$STAGE_DEST/previous" && ! -e "$APP_DEST" ]]; then mv "$STAGE_DEST/previous" "$APP_DEST"; fi
  rm -rf -- "$STAGE_DEST"
}
trap rollback EXIT
cp -P -- "dist/$APPIMAGE_NAME" dist/SHA256SUMS "$STAGE_DEST/"
for metadata in SHA256SUMS.minisig BUILDINFO.json; do
  if [[ -e "dist/$metadata" || -L "dist/$metadata" ]]; then cp -P -- "dist/$metadata" "$STAGE_DEST/"; fi
 done
node scripts/verify-artifacts.js "$STAGE_DEST" "${verify_args[@]}" >/dev/null
chmod 0755 "$STAGE_DEST/$APPIMAGE_NAME"
(cd "$STAGE_DEST" && "./$APPIMAGE_NAME" --appimage-extract >/dev/null)
EXTRACTED="$STAGE_DEST/squashfs-root"
[[ -d "$EXTRACTED" && ! -L "$EXTRACTED" && -f "$EXTRACTED/$EXECUTABLE" && ! -L "$EXTRACTED/$EXECUTABLE" && -x "$EXTRACTED/$EXECUTABLE" ]] || {
  echo "ERROR: Verified image does not contain the expected application launcher." >&2; exit 1;
}
for size in 16 24 32 48 64 96 128 256 512; do
  icon="$EXTRACTED/aaha-icons/${size}x${size}.png"
  [[ -f "$icon" && ! -L "$icon" ]] || { echo "ERROR: Verified image has missing or linked icons." >&2; exit 1; }
done
rm -f -- "$EXTRACTED/chrome-sandbox"
if [[ -d "$APP_DEST" ]]; then mv "$APP_DEST" "$STAGE_DEST/previous"; fi
mv "$EXTRACTED" "$APP_DEST"
APP_REPLACED=1

NEW_PROFILE="$CONFIG_ROOT/$PROFILE_NAME"
if [[ ! -e "$NEW_PROFILE" ]]; then
  while IFS= read -r old_profile; do
    [[ -n "$old_profile" ]] || continue
    OLD_PROFILE="$CONFIG_ROOT/$old_profile"
    if [[ -d "$OLD_PROFILE" ]]; then
      PROFILE_STAGE="$CONFIG_ROOT/.${PROFILE_NAME}.migration-$$"
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
  cp "$APP_DEST/aaha-icons/${size}x${size}.png" "$icon_dir/$ICON_NAME.png"
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
Comment=$COMMENT
Exec="$APP_DEST/$EXECUTABLE"
Icon=$ICON_NAME
Terminal=false
Categories=$CATEGORY
StartupWMClass=$APP_ID
NoDisplay=true
EOF
done < <(node -e "for (const p of require('./app.config.js').compatibilityDesktopIds) console.log(p)")

find "$INSTALL_ROOT" -maxdepth 1 -type f -name "$REPO_NAME-*.AppImage" -delete
cp -- "$STAGE_DEST/$APPIMAGE_NAME" "$INSTALL_ROOT/"
cp -- "$STAGE_DEST/SHA256SUMS" "$INSTALL_ROOT/"
for metadata in SHA256SUMS.minisig BUILDINFO.json; do
  rm -f -- "$INSTALL_ROOT/$metadata"
  if [[ -f "$STAGE_DEST/$metadata" ]]; then cp -- "$STAGE_DEST/$metadata" "$INSTALL_ROOT/"; fi
 done
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
rm -rf -- "$STAGE_DEST"
trap - EXIT
echo "Installed $APP_NAME v$VERSION under $INSTALL_ROOT"
