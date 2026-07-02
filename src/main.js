const { app, BrowserWindow, shell, Menu } = require("electron");
const path = require("path");
const cfg = require("./app.config.js");

// Set the Wayland/X11 app id BEFORE the app is ready so KDE associates
// the window with the correct .desktop entry and keeps your custom icon.
app.setName(cfg.name);
if (process.platform === "linux") {
  // This is what KDE Plasma reads as the WM class on Wayland.
  app.commandLine.appendSwitch("class", cfg.wmClass);
}

// ---------------------------------------------------------------------------
//  PRIVACY HARDENING
//  Electron's embedded Chromium already omits most browser-level Google
//  services (Safe Browsing, sync, GoogleURLTracker, the Chrome updater, etc.)
//  because it is an app runtime, not a browser. These switches make that
//  explicit and shut off the remaining background/phone-home subsystems so
//  the app stays network-silent except for the site it wraps.
//  Set cfg.disableHardening = true in app.config.js to opt out.
// ---------------------------------------------------------------------------
if (!cfg.disableHardening) {
  // Disables several subsystems that make background network requests
  // (metrics, translate, intranet redirect detector, etc.).
  app.commandLine.appendSwitch("disable-background-networking");
  // Stops Chromium's "domain reliability" error-reporting beacons to Google.
  app.commandLine.appendSwitch("disable-domain-reliability");
  // Prevents fetching/updating bundled components from Google servers.
  app.commandLine.appendSwitch("disable-component-update");
  // Turns off network-time queries, translate, and optimization-hint fetches.
  app.commandLine.appendSwitch(
    "disable-features",
    "NetworkTimeServiceQuerying,Translate,OptimizationHints,MediaRouter"
  );
  // No usage/crash metrics.
  app.commandLine.appendSwitch("disable-breakpad");
}

let mainWindow;

function hostMatches(urlString) {
  if (!cfg.allowedHosts || cfg.allowedHosts.length === 0) return true;
  try {
    const host = new URL(urlString).hostname;
    return cfg.allowedHosts.some(
      (h) => host === h || host.endsWith("." + h)
    );
  } catch (e) {
    return false;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: cfg.width,
    height: cfg.height,
    title: cfg.name,
    autoHideMenuBar: true,
    icon: path.join(__dirname, "icon.png"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true
    }
  });

  // Optional custom user-agent (helps sites that sniff for a "real" browser).
  const loadOpts = {};
  if (cfg.userAgent) {
    loadOpts.userAgent = cfg.userAgent;
  }
  mainWindow.loadURL(cfg.url, loadOpts);

  // Links that open a NEW window/tab -> send to system browser if external.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (cfg.openExternalInBrowser && !hostMatches(url)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  // In-page navigation to a foreign host -> bounce to system browser.
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (cfg.openExternalInBrowser && !hostMatches(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}

// Single-instance lock: clicking the panel icon focuses the existing
// window instead of spawning a second copy.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null); // clean, app-like (no menu bar)
    createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
