#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
: "${TAG:?TAG required}" "${GITHUB_REPOSITORY:?Repository required}"
[[ "$TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo 'Invalid tag' >&2; exit 1; }
[[ "v$(node -p "require('./package.json').version")" == "$TAG" ]] || { echo 'Package/tag mismatch' >&2; exit 1; }
SHA="$(git rev-parse HEAD)"
[[ "$SHA" == "$(gh api "repos/$GITHUB_REPOSITORY/commits/$TAG" --jq .sha)" ]] || { echo 'Release tag moved or checkout mismatch' >&2; exit 1; }
[[ "$(gh release view "$TAG" --repo "$GITHUB_REPOSITORY" --json isDraft --jq .isDraft)" == true ]] || { echo 'Published releases cannot be replaced' >&2; exit 1; }
[[ "$(gh release view "$TAG" --repo "$GITHUB_REPOSITORY" --json assets --jq '.assets | length')" == 0 ]] || { echo 'Existing assets cannot be replaced; investigate the draft' >&2; exit 1; }
if [[ "${1:-}" == template ]]; then
  npm ci
  npm run check:template
  npm test
  npm audit --audit-level=high
  rm -rf dist
  mkdir dist
  artifact="$(node -p "require('./package.json').name")-$TAG.tar.gz"
  git archive --format=tar.gz -o "dist/$artifact" "$SHA"
  node scripts/build-info.js dist
  (cd dist && sha256sum "$artifact" BUILDINFO.json > SHA256SUMS)
elif [[ "${1:-}" == app ]]; then
  bash build.sh
  npm audit --audit-level=high
else
  echo 'Usage: scripts/release.sh template|app' >&2; exit 2
fi
node -e 'const i=require("./dist/BUILDINFO.json"); if(i.sourceCommit!==process.argv[1] || i.tag!==process.env.TAG || i.workingTreeDirty) throw Error("Unclean or inconsistent provenance")' "$SHA"
# Private material is ephemeral on the runner, never echoed or archived.
umask 077
key="$(mktemp)"
trap 'rm -f "$key"' EXIT
[[ -n "${MINISIGN_SECRET_KEY:-}" ]] || { echo 'Release signing secret missing' >&2; exit 1; }
printf '%s\n' "$MINISIGN_SECRET_KEY" > "$key"
unset MINISIGN_SECRET_KEY
minisign -Sm dist/SHA256SUMS -s "$key" -t "$GITHUB_REPOSITORY $TAG $SHA"
minisign -Vm dist/SHA256SUMS -p release.pub
(cd dist && sha256sum -c SHA256SUMS)
# Recheck immutable identity immediately before publication; never --clobber.
[[ "$SHA" == "$(gh api "repos/$GITHUB_REPOSITORY/commits/$TAG" --jq .sha)" ]] || { echo 'Release tag changed' >&2; exit 1; }
if [[ "$1" == app ]]; then
  artifact="$(node scripts/verify-artifacts.js dist --public-key "$PWD/release.pub")"
fi
artifacts=("dist/$artifact" dist/BUILDINFO.json dist/SHA256SUMS dist/SHA256SUMS.minisig)
gh release upload "$TAG" "${artifacts[@]}" --repo "$GITHUB_REPOSITORY"
if [[ "${PRERELEASE:-false}" == true ]]; then
  gh release edit "$TAG" --draft=false --prerelease --repo "$GITHUB_REPOSITORY"
else
  gh release edit "$TAG" --draft=false --prerelease=false --latest --repo "$GITHUB_REPOSITORY"
fi
