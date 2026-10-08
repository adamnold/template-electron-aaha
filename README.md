# template-electron-aaha

AAHA's Apache-2.0 template for Linux Electron web application wrappers. Template version **3.0.0**. A generated wrapper has its own version; the remote service has a separate release cycle.

The scaffold uses plain JavaScript, Electron **44.7.0**, electron-builder **26.17.0**, and AppImage distribution. Build with **Node 24.21.0 / npm 11.19.0**, committed lockfiles and `npm ci`. Electron's bundled Node is distinct from build-time Node. Exact bundled runtime and actual runner/tool versions are recorded in `BUILDINFO.json`.

1. Copy `templates/app-definition.example.json` and choose application identity and exact HTTPS navigation, authentication and permission origins.
2. Run `bash new-app.sh /absolute/new-repo /absolute/definition.json`.
3. Add `assets/icon-source.png`, review [hardening](HARDENING.md) and [privacy](PRIVACY.md), and configure an independent [release signing identity](SIGNING.md).
4. Run `bash build.sh`. Ordinary builds explicitly disable publication and start with an empty `dist/`.
5. For an explicitly unsigned development build only, run `bash install.sh --local-build`. For releases, verify the independently trusted public key and use `bash install.sh --public-key /trusted/app-release.pub`.

The installer selects exactly one AppImage, verifies its signed checksum manifest, stages and verifies it again, and extracts that same image. It never copies `dist/linux-unpacked` or elevates a sandbox helper. Linux launches require working unprivileged user namespaces. Root execution and sandbox-disabling inputs are rejected; unsupported hosts fail closed.

See [dated dependency validation](DEPENDENCIES.md) for the remaining moderate build advisories.

Default installation: `~/.local/opt/aaha/<repoName>`. Validated custom roots remain supported with `--install-root /absolute/path/<repoName>`. Receipts and identity markers protect removal. `bash uninstall.sh` preserves profiles; `--purge` explicitly removes the configured profile only. Profiles use absolute `$XDG_CONFIG_HOME/<profileName>` or `$HOME/.config/<profileName>`. Configured legacy names migrate within that same root.

Updates are manual: obtain a signed new release and its matching source/configuration, verify with the independently trusted key, rerun the installer, and restart. There is no background updater or update traffic. Already installed applications need an owner-managed rollout.

See [template validation](VALIDATION.md), [v2 migration](MIGRATION.md), [signing and releases](SIGNING.md), and [the Proton owner handback](PROTON-HANDBACK.md). Historical commits, tags, releases and scan records retain their original names.

Validation commands: `npm run check:template`, `npm test`, `npm audit --audit-level=high`. Generated apps use `npm run check`. Builds are repeatable from locked dependencies; bit-for-bit reproducibility is not established. Runtime GUI validation and per-app signed-in tests are separate requirements.
