# Privacy Model

This template adds no AAHA analytics or telemetry. It disables unnecessary Chromium background networking, component updates, domain-reliability reporting, Breakpad, Translate, Optimization Hints, Media Router, and Chromium Secure DNS.

These safeguards reduce optional background traffic; they do not make Chromium independently auditable, Google-free, anonymous, or network-silent. A generated application must document its service, CDN, authentication-provider, optional integration, and third-party traffic. Host blocklists are defense-in-depth and can become incomplete.

AAHA_NETWORK_AUDIT=1 prints each first-seen hostname. It must never print or commit full URLs, query strings, cookies, tokens, raw netlogs, or profile data.

Electron stores cookies, sessions, caches, preferences, and local storage under the configured profile. Normal uninstall preserves it. uninstall.sh --purge removes the configured local profile but does not delete a cloud account.
