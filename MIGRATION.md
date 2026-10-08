# Configuration v3 migration

This is a breaking template release. Version 2 host-based configurations are rejected with migration instructions. Review every required flow and replace `trustedNavigationHosts` / `trustedAuthHosts` with `trustedNavigationOrigins` / `trustedAuthOrigins` containing exact HTTPS origins, for example `https://app.example.com` or `https://app.example.com:8443`. Sibling subdomains and different ports are separate identities. The starting URL must match a navigation origin. Permission lists also contain exact HTTPS origins. Empty lists deny access.

Do not mechanically copy broad parent-domain permissions. Authentication and notification rules require service-owner testing. Origins cannot contain credentials, paths, queries or fragments.

Omitting `blockedHosts` inherits the shared privacy defaults. An explicit list replaces the defaults; `[]` explicitly disables that blocklist. Blocking is a privacy mitigation and is not proof that the upstream service or Chromium makes no other network requests.

Preserve existing generated application identities and profile names during template upgrades. Profiles, migration and purge now share the absolute XDG configuration root. Normal uninstall preserves profiles. Validate with disposable profiles before enabling legacy-name migration.

Old setuid sandbox helpers are not preserved during upgrades. Hosts that prohibit unprivileged user namespaces must have their administrator enable a supported sandbox configuration; this template supplies no unsandboxed fallback. `AAHA_SKIP_SANDBOX_SETUP` has been removed.

Generated apps must configure their own release key and refresh their own lockfile. Template signatures do not authorize application releases. Old release artifacts remain immutable; publish a new app version containing the changes.
