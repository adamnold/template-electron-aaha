# Changelog

Last Updated: 2026-09-25

## v2.1.1 — 2026-09-25

- Added a manual-only `Release template` workflow that validates the scaffold
  and attaches `webapp-wrapper-aaha-<tag>.tar.gz` (a `git archive` of the
  release commit) with `webapp-wrapper-aaha-<tag>-SHA256SUMS`, matching the
  v2.0.x release format. v2.1.0 was published without these files.
- Generated apps now receive the manual AppImage Release workflow
  (`templates/app-release.yml` → `.github/workflows/release.yml`) used by the
  existing AAHA apps, and do not inherit the template's archive workflow.
- Fixed stale AppImages being installed next to the new one: `build.sh` now
  clears `dist/` before building, and both `build.sh` and `install.sh` require
  exactly one AppImage.

## v2.1.0 — 2026-09-24

- Updated from exact Electron 43.1.0 to exact Electron 44.4.5 (Chromium
  security fixes); no template source, security policy, or profile changes
  were needed for the Electron 44 breaking changes.
- Refreshed the locked build tooling to clear every `npm audit` finding,
  including the `brace-expansion`, `tar`, `undici`, and `js-yaml` advisories
  that had begun failing the required CI audit step on `master`.
- Supersedes the unmerged Copilot Electron 44.3.0 draft.

## Also shipped in v2.1.0 (prepared 2026-07-23)

- Added explicit current dates to the durable README, privacy, and changelog
  guidance.
- Made validation and generated AppImage builds explicitly non-publishing so
  `electron-builder` cannot infer a GitHub release from CI.
- Updated generated workflows to the Node 24-backed v7 checkout and Node setup
  actions while retaining Node 22 for application validation.
- Changed compatibility desktop aliases to use each application's configured
  description instead of a generic launcher tooltip.
- Added generated-project and installer regressions for the non-publishing
  build command, current workflow actions, and compatibility alias comments.
- Updated the locked build dependency tree to use the patched `fast-uri` 3.1.4
  release.

## v2.0.1 — 2026-07-15

- Added the standard `~/.local/opt/aaha/<repo-name>` default, explicit custom
  roots, guarded XDG-state receipts, and matching installation markers.
- Added regression coverage for default/custom installation, unsafe paths,
  receipt mismatch, marker tampering, profile preservation, and purge.
- Fixed `new-app.sh` so it copies the intended template files instead of
  treating formatting separators as filenames.
- Kept generated `package-lock.json` identity and version synchronized with the
  materialized application definition.
- Made generated icon sets deterministic by removing variable PNG metadata.

## v2.0.0 — 2026-07-11

- Replaced the mutating Electron 31 scaffold with exact Electron 43.1.0 and electron-builder 26.15.3.
- Added explicit renderer sandboxing, permission denial, parsed navigation/authentication policy, safe external-link handling, and hostname audit mode.
- Added reproducible locked builds, multi-size icons, atomic installation, sandbox-helper preservation, profile-preserving uninstall, explicit purge, tests, CI, and privacy documentation.
- Made the template fail production validation until a real service review and icon are supplied.

## v1.0.1

- Original Perplexity Computer scaffold. Preserved by the dedicated legacy branch and release; superseded by v2.0.0.
