# Hardening

The launcher selects `--disable-setuid-sandbox` before Chromium starts and probes Linux user namespaces. It refuses root, sandbox-disabling flags, `ELECTRON_DISABLE_SANDBOX`, and `ELECTRON_RUN_AS_NODE`. Development, installed and direct AppImage entry points share this policy. The AppImage builder arguments override its unsandboxed default; a fallback that adds `--no-sandbox` is rejected. The native entry point also rejects unsafe launch inputs before loading remote content.

The renderer retains `sandbox: true`, context isolation, disabled Node integration, web security, blocked insecure content and webview rejection. Remote content receives no preload or native IPC bridge. Exact HTTPS origins govern navigation, authentication windows and permissions. Missing, malformed or conflicting permission requester identity denies access; it never substitutes the top-level page for a requesting frame.

Packaging disables RunAsNode, Node-options and Node-inspection fuses and enables ASAR-only loading. Cookie encryption is unchanged pending profile migration testing. These fuses and ASAR packaging do **not** authenticate a Linux AppImage. Release authenticity comes from independently trusted Minisign keys and signed manifests.

Installation needs no sudo, root-owned helper or setuid promotion. Sandbox helpers are unlinked without following links. An attacker who can modify unsigned local builds controls their application payload; `--local-build` deliberately waives publisher authentication and is unsuitable for downloaded releases. User-owned installations do not protect against another process already operating as that user.

No wallet transaction, signing, seed, private-key or key-management functionality belongs in this template. Service owners must validate their authentication, desktop and notification behavior independently.
