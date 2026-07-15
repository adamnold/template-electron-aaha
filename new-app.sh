#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [[ $# -ne 2 ]]; then
  echo "Usage: ./new-app.sh /absolute/destination /absolute/app-definition.json" >&2
  exit 2
fi
DEST="$1"
DEFINITION="$2"
if [[ "$DEST" != /* || "$DEFINITION" != /* ]]; then
  echo "ERROR: destination and definition must be absolute paths." >&2
  exit 2
fi
if [[ -e "$DEST" ]]; then
  echo "ERROR: destination already exists: $DEST" >&2
  exit 1
fi
if [[ ! -f "$DEFINITION" ]]; then
  echo "ERROR: definition file not found: $DEFINITION" >&2
  exit 1
fi
mkdir -p "$DEST"
cp -a .github LICENSE NOTICE README.md PRIVACY.md CONTRIBUTING.md CHANGELOG.md \
  package.json package-lock.json app.config.js src scripts test templates \
  build.sh install.sh uninstall.sh new-app.sh "$DEST/"
node scripts/materialize-app.js "$DEST" "$DEFINITION"
echo "Created $DEST. Add assets/icon-source.png, review policy, then run ./build.sh."
