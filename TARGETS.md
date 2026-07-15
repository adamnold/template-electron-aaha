# Ready-to-run targets

Copy-paste `new-app.sh` lines for the tools you mentioned. Run each from the
template folder (`webapp-wrapper-aaha/`). Verify the icon URL still resolves
before relying on it — providers rename icon paths occasionally. If an icon
URL 404s, grab one via DevTools → Application → Manifest → Icons.

> After each `new-app.sh`, do:
> `cd ../<slug> && ./build.sh && ./install.sh`

Use `./install.sh --install-root /absolute/path/<slug>` only when an explicit
per-application location is required. Direct AppImage execution creates no
installation directory.

---

## Proton suite (web-only pieces)

```bash
./new-app.sh "Proton Calendar" https://calendar.proton.me
./new-app.sh "Proton Pass"     https://pass.proton.me
./new-app.sh "Proton Docs"     https://docs.proton.me
./new-app.sh "Proton Wallet"   https://wallet.proton.me
./new-app.sh "Proton Mail"     https://mail.proton.me
./new-app.sh "Proton Drive"    https://drive.proton.me
```

Icon tip: Proton apps expose manifest icons under the app origin, often at
paths like `/assets/android-chrome-512x512.png`. Confirm the exact path in
DevTools → Application → Manifest for each subdomain, then either pass it as
the 3rd arg to `new-app.sh` or `curl` it into `icons/icon.png`.

Suggested `allowedHosts` for Proton apps (edit app.config.js after cloning):
`allowedHosts: ["proton.me"]`

---

## Chatbots / AI tools without a Linux installer

```bash
./new-app.sh "Perplexity" https://www.perplexity.ai
./new-app.sh "Claude"     https://claude.ai
./new-app.sh "ChatGPT"    https://chatgpt.com
```

Suggested `allowedHosts`:
- Perplexity: `["perplexity.ai"]`
- Claude:     `["claude.ai", "anthropic.com"]`
- ChatGPT:    `["chatgpt.com", "openai.com"]`

Note: if a site blocks logins inside an "embedded" view, set a normal
Chrome `userAgent` string in `app.config.js` (there's a ready example in the
file's comments).

---

## Browsers / web tools

Wrapping a *browser's web UI* as an app works only if it's actually a web
app. A native browser like Comet that has no Linux build cannot be "wrapped"
into existence — there's no web URL that IS the browser. Electron can only
wrap something that runs as a website. So:

- If the tool has a usable web app (a URL you can log into and use), wrap it.
- If it's a native-only application with no web version, this scaffold can't
  substitute for it — you'd need the vendor to ship a Linux build (or run it
  another way).

---

## After creating several apps

Your folder layout ends up like:

```
~/Documents/PWA Builders/
├── webapp-wrapper-aaha/     <- keep this pristine as your template
├── proton-calendar/
├── proton-pass/
├── perplexity/
└── ...
```

Keep `webapp-wrapper-aaha/` unbuilt (don't run build.sh inside it) so it
stays a clean template you always clone FROM.
