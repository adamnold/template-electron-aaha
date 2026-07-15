#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

HOME_DIR="${AAHA_HOME:-$HOME}"
read_cfg() { node -p "require('./app.config.js').$1"; }
APP_NAME="$(read_cfg productName)"
REPO_NAME="$(read_cfg repoName)"
APP_ID="$(read_cfg appId)"
ICON_NAME="$(read_cfg iconName)"
PROFILE_NAME="$(read_cfg profileName)"
STATE_HOME="${AAHA_STATE_HOME:-${XDG_STATE_HOME:-$HOME_DIR/.local/state}}"
RECEIPT_DIR="$STATE_HOME/aaha/$REPO_NAME"
RECEIPT_FILE="$RECEIPT_DIR/install-root"

usage() {
  echo "Usage: ./uninstall.sh [--install-root /absolute/path/$REPO_NAME] [--purge]"
  echo "  no --purge  Remove app files, launchers, and icons; preserve profile."
  echo "  --purge     Also remove the local Electron profile and sessions."
}

PURGE=0
REQUESTED_ROOT=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --install-root)
      [[ -z "$REQUESTED_ROOT" && $# -ge 2 && -n "$2" ]] || { usage >&2; exit 2; }
      REQUESTED_ROOT="$2"
      shift 2
      ;;
    --purge)
      [[ "$PURGE" == "0" ]] || { usage >&2; exit 2; }
      PURGE=1
      shift
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
if [[ -n "$REQUESTED_ROOT" ]]; then
  INSTALL_ROOT="$(validate_install_root "$REQUESTED_ROOT")" || exit $?
elif [[ -f "$RECEIPT_FILE" ]]; then
  IFS= read -r RECORDED_ROOT < "$RECEIPT_FILE" || true
  INSTALL_ROOT="$(validate_install_root "${RECORDED_ROOT:-}")" || exit $?
else
  INSTALL_ROOT="$(validate_install_root "$DEFAULT_INSTALL_ROOT")" || exit $?
fi

[[ -f "$RECEIPT_FILE" ]] || {
  echo "ERROR: Installation receipt is missing; refusing deletion." >&2
  exit 1
}
IFS= read -r RECORDED_ROOT < "$RECEIPT_FILE" || true
RECORDED_ROOT="$(validate_install_root "${RECORDED_ROOT:-}")" || exit $?
[[ "$RECORDED_ROOT" == "$INSTALL_ROOT" ]] || {
  echo "ERROR: Installation receipt does not match the requested root; refusing deletion." >&2
  exit 1
}

INSTALL_MARKER="$INSTALL_ROOT/.aaha-install"
if [[ -e "$INSTALL_ROOT" ]]; then
  [[ -f "$INSTALL_MARKER" ]] &&
    grep -Fxq 'AAHA_INSTALL_V1' "$INSTALL_MARKER" &&
    grep -Fxq "repo=$REPO_NAME" "$INSTALL_MARKER" &&
    grep -Fxq "app_id=$APP_ID" "$INSTALL_MARKER" || {
      echo "ERROR: Installation marker is missing or invalid; refusing deletion." >&2
      exit 1
    }
  rm -rf -- "$INSTALL_ROOT"
fi

rm -f "$HOME_DIR/.local/share/applications/$APP_ID.desktop"
while IFS= read -r old_id; do
  [[ -n "$old_id" ]] && rm -f "$HOME_DIR/.local/share/applications/$old_id.desktop"
done < <(node -e "for (const p of require('./app.config.js').compatibilityDesktopIds) console.log(p)")
for size in 16 24 32 48 64 96 128 256 512; do
  rm -f "$HOME_DIR/.local/share/icons/hicolor/${size}x${size}/apps/$ICON_NAME.png"
done

if [[ "$PURGE" == "1" ]]; then
  rm -rf -- "$HOME_DIR/.config/$PROFILE_NAME"
  echo "Purged local profile: $HOME_DIR/.config/$PROFILE_NAME"
else
  echo "Preserved local profile: $HOME_DIR/.config/$PROFILE_NAME"
fi
rm -f "$RECEIPT_FILE"
rmdir "$RECEIPT_DIR" 2>/dev/null || true

if [[ "${AAHA_SKIP_DESKTOP_REFRESH:-0}" != "1" ]]; then
  update-desktop-database "$HOME_DIR/.local/share/applications" 2>/dev/null || true
  gtk-update-icon-cache "$HOME_DIR/.local/share/icons/hicolor" 2>/dev/null || true
  kbuildsycoca6 2>/dev/null || kbuildsycoca5 2>/dev/null || true
fi
echo "Removed $APP_NAME."
