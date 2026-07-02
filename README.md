# Web App Wrapper (AAHA)

A generic, software-agnostic **Electron wrapper scaffold** by
**Adam And His Agents (AAHA)**. Turn any web app or web-only tool into a
real Linux desktop application with a **stable taskbar icon that KDE Plasma
on Wayland won't swap for a generic browser icon**.

This is the reusable template — it is NOT tied to any one product. Point it
at a URL, give it a name and icon, and build. Ideal for:

- Proton suite pieces that only ship a web app (Calendar, Pass, Docs, etc.)
- Chatbots without a Linux installer (e.g. Perplexity)
- Web-only browsers/tools you want as their own windowed app
- Any productivity/utility web app

Not intended for games or heavy apps like video editors (Electron wraps a
web view; it won't help native/GPU-heavy software).

---

## The single source of truth: `app.config.js`

You only ever edit **one file per app**: `app.config.js`. `build.sh` reads
it and syncs everything (name, window class, appId, `.desktop` fields) into
`package.json` automatically — so you never hand-edit `package.json`.

| Field                   | What it does                                                  |
|-------------------------|---------------------------------------------------------------|
| `url`                   | The web app to load.                                          |
| `name`                  | Display name (title, launcher, tooltip).                     |
| `wmClass`               | Window id — keep identical to `name` (keeps the icon).       |
| `appId`                 | Reverse-DNS id, unique per app.                               |
| `width` / `height`      | Initial window size.                                          |
| `openExternalInBrowser` | Send off-domain links to your real browser.                  |
| `allowedHosts`          | Host suffixes kept in-app; `[]` = allow all in-app.          |
| `userAgent`             | Optional custom UA string; `null` = Electron default.        |

---

## Two ways to make an app

### A. Clone with `new-app.sh` (recommended)

From this template folder:

```bash
./new-app.sh "Perplexity" https://www.perplexity.ai
# optionally pass a 512x512 icon URL as a 3rd arg:
./new-app.sh "Proton Calendar" https://calendar.proton.me "https://calendar.proton.me/assets/android-chrome-512x512.png"

cd ../perplexity          # (or ../proton-calendar)
# make sure icons/icon.png exists (512x512 PNG)
./build.sh && ./install.sh
```

`new-app.sh` copies the scaffold to a sibling folder, writes a fresh
`app.config.js`, and (if you pass an icon URL) downloads the icon for you.

### B. Copy the folder manually

1. Copy this whole folder to a new name.
2. Edit `app.config.js` (url, name, wmClass, appId).
3. Put a 512x512 PNG at `icons/icon.png`.
4. `./build.sh && ./install.sh`.

---

## Getting an icon

Open the site in a Chromium-based browser → DevTools (F12) → Application →
Manifest → Icons. Find a 512x512 PNG, note its `src`, build the full URL
(origin + src), open it in a tab, Save As `icons/icon.png`. Or directly:

```bash
curl -fsSL "https://the-site/path/to/icon-512.png" -o icons/icon.png
```

---

## Requirements (Fedora example)

```bash
sudo dnf install nodejs npm fuse fuse-libs
```
(Debian/Ubuntu: `sudo apt install nodejs npm libfuse2`.)

---

## Quick reference for your target apps

See `TARGETS.md` for ready-to-run `new-app.sh` lines for the Proton suite,
Perplexity, and others, plus notes on where to grab each icon.

---

## Privacy hardening (on by default)

Electron's embedded Chromium is an app runtime, not a full browser, so it
already omits most browser-level Google services (Safe Browsing, sync,
GoogleURLTracker, the Chrome updater). On top of that, these apps launch with
hardening switches that shut off the remaining background/phone-home paths:

- `disable-background-networking` — kills the metrics/translate/intranet-
  redirector subsystems.
- `disable-domain-reliability` — no error-reporting beacons to Google.
- `disable-component-update` — no component fetches from Google servers.
- `disable-features=NetworkTimeServiceQuerying,Translate,OptimizationHints,MediaRouter`
- `disable-breakpad` — no crash metrics.

Net effect: the app should only talk to the site you wrap. To opt out (e.g.
if a wrapped app misbehaves), set `disableHardening: true` in `app.config.js`.

### Verify it yourself

Watch for any Google-owned connections while the app runs:

```bash
sudo tcpdump -n -i any 'port 53 or port 443' | grep -Ei 'google|gstatic|gvt|1e100'
# then launch the app; idle traffic to those hosts should be silent
```

(Note: if the wrapped *site* itself loads Google Fonts/reCAPTCHA/Analytics,
that is the site's traffic and would occur in any browser too.)

---

## Notes / gotchas

- **Disk:** each app bundles its own Electron runtime (~150–250 MB). Fine
  for a handful of pinned apps; don't wrap dozens.
- **Session data** lives per-app in `~/.config/<App Name>/`, NOT in the
  project folder — your logins are never committed to git or shipped.
- **Single instance:** clicking the icon focuses the existing window.
- **Updates:** the bundled Electron does not auto-update. To refresh:
  `npm install electron@latest --save-dev` then rebuild.
- **The engine is Chromium** (see TARGETS.md / your notes) — not Firefox,
  not your system browser. It's fixed per app and set by the Electron version.

---

## License

Copyright 2026 **Adam And His Agents (AAHA)**. Wrapper code licensed under
the **Apache License, Version 2.0** (see `LICENSE`). Each wrapped service
remains subject to its own provider's terms and trademarks.
