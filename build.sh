#!/usr/bin/env bash
# Build the Electron app into an unpacked native dir + AppImage.
# app.config.js is the SINGLE SOURCE OF TRUTH — this script syncs its
# values into package.json and into src/ before building.
#
# Run from the project root:  ./build.sh
set -euo pipefail
cd "$(dirname "$0")"

echo ">> Reading identity from app.config.js..."
NAME="$(node -p "require('./app.config.js').name")"
WMCLASS="$(node -p "require('./app.config.js').wmClass")"
APPID="$(node -p "require('./app.config.js').appId")"
# slug: lowercase, spaces -> dashes (e.g. "Proton Calendar" -> "proton-calendar")
SLUG="$(echo "$NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')"

echo "   name=$NAME  slug=$SLUG  appId=$APPID"

echo ">> Syncing identity into package.json..."
node - "$NAME" "$SLUG" "$APPID" "$WMCLASS" <<'NODE'
const fs = require("fs");
const [name, slug, appId, wmClass] = process.argv.slice(2);
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
pkg.name = slug;
pkg.productName = name;
pkg.description = name + " desktop wrapper (Electron) by Adam And His Agents";
pkg.build.appId = appId;
pkg.build.productName = name;
pkg.build.linux.executableName = slug;
// AppImage filename: lowercase slug + -aaha- + version + arch, no spaces.
pkg.build.linux.artifactName = slug + "-aaha-${version}-${arch}.AppImage";
pkg.build.linux.desktop.Name = name;
pkg.build.linux.desktop.Comment = name + " desktop wrapper";
pkg.build.linux.desktop.StartupWMClass = wmClass;
fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");
NODE

echo ">> Bundling config + icon into src/ (so they pack into app.asar)..."
cp -f app.config.js src/app.config.js
if [ -f icons/icon.png ]; then
  cp -f icons/icon.png src/icon.png
else
  echo "   WARNING: icons/icon.png not found. The app will build but use a"
  echo "            generic icon. Add a 512x512 PNG at icons/icon.png and rebuild."
fi

echo ">> Installing dependencies (first run downloads Electron, ~150MB)..."
npm install

echo ">> Building Linux targets (dir + AppImage)..."
npm run dist

echo
echo ">> Done. Outputs are in ./dist/"
echo "   - Unpacked app:  ./dist/linux-unpacked/"
echo "   - AppImage:      ./dist/*.AppImage"
echo
echo "Next: run ./install.sh to register the app with your desktop."
