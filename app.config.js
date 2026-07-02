// ============================================================
//  APP CONFIG  —  This is the ONLY file you edit per app.
//  Fill these in, drop a 512x512 icon in icons/icon.png,
//  then run ./build.sh && ./install.sh
// ============================================================
module.exports = {
  // The web app / tool you want to wrap:
  //   e.g. "https://drive.proton.me", "https://www.perplexity.ai",
  //        "https://mail.proton.me", "https://account.proton.me"
  url: "https://example.com",

  // Display name — shows in the title bar, app launcher, and panel tooltip.
  // Use the real product name, e.g. "Proton Calendar", "Perplexity".
  name: "My Web App",

  // Wayland/X11 window identity. Keep this IDENTICAL to `name` unless you
  // have a reason not to. build.sh keeps package.json's StartupWMClass in
  // sync with this so KDE keeps your icon (no flip to a generic icon).
  wmClass: "My Web App",

  // Reverse-DNS app id. Change the last part per app; must be unique per app.
  //   e.g. "com.adamandhisagents.perplexity"
  appId: "com.adamandhisagents.mywebapp",

  // Initial window size:
  width: 1280,
  height: 800,

  // Send links that leave the app's own domain to your real browser instead
  // of opening them inside this app window. Recommended: true.
  openExternalInBrowser: true,

  // Host suffixes that stay INSIDE the app. Anything else opens externally
  // (when openExternalInBrowser is true). Keeps the wrapper feeling like ONE
  // tool. Examples:
  //   Proton apps: ["proton.me"]
  //   Perplexity:  ["perplexity.ai"]
  // Leave as [] to allow all in-app navigation (no external bouncing).
  allowedHosts: [],

  // OPTIONAL — custom user-agent string. Leave null to use Electron's default.
  // Some sites behave better if you present as a normal Chrome browser.
  // Example: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
  userAgent: null,

  // PRIVACY HARDENING (default: ON). The app disables Chromium's background
  // networking, domain-reliability beacons, component updates, network-time
  // queries, translate, optimization hints, and crash metrics — so it only
  // talks to the site you wrap. Set this to true ONLY if a wrapped app breaks
  // and you need those subsystems back.
  disableHardening: false
};
