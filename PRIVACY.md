# Privacy

The wrapper adds no AAHA telemetry, crash reporting, analytics SDK or background update requests. The remotely loaded service still controls its own network traffic and telemetry. Electron/Chromium may retain upstream network behavior; this is not a claim of a completely Google-free runtime.

Shared defaults block selected telemetry hostnames. Generated definitions inherit them when `blockedHosts` is omitted; an explicit list replaces them and an empty list disables them. Review service compatibility. Request audit output records hostnames only, not full URLs, queries or tokens.

Authentication and service state remain in the app's configured profile under the absolute XDG configuration root, or the user's `.config` fallback. Normal uninstall preserves it. Explicit purge removes that configured profile only; test migration using disposable profiles. Cookie encryption behavior is preserved.

Notifications require the wrapper to remain running. No background notification mechanism is implemented. Service owners must describe upstream traffic and permissions accurately.
