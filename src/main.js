"use strict";

const { app, BrowserWindow, Menu, session, shell } = require("electron");
const { launchErrors } = require("./launch-policy.js");
const unsafeLaunch = launchErrors();
if (unsafeLaunch.length) {
  console.error(unsafeLaunch.join("\n"));
  process.exit(1);
}
const path = require("node:path");
const fs = require("node:fs");
const { withDefaults } = require("./defaults.js");
const { profileRoot } = require("./profiles.js");
const cfg = withDefaults(require("../app.config.js"));
const {
  classifyNavigation,
  isBlockedRequest,
  parseUrl,
  permissionAllowed,
  permissionOrigin,
  validateConfig
} = require("./policy.js");

const errors = validateConfig(cfg);
if (errors.length) {
  throw new Error(`Invalid app.config.js:\n- ${errors.join("\n- ")}`);
}

app.setName(cfg.productName);
const profile = path.join(process.platform === "linux" ? profileRoot() : app.getPath("appData"), cfg.profileName);
fs.mkdirSync(profile, { recursive: true, mode: 0o700 });
app.setPath("userData", profile);
app.enableSandbox();

if (process.platform === "linux") {
  app.commandLine.appendSwitch("class", cfg.appId);
}

app.commandLine.appendSwitch("disable-background-networking");
app.commandLine.appendSwitch("disable-component-update");
app.commandLine.appendSwitch("disable-domain-reliability");
app.commandLine.appendSwitch("disable-breakpad");
app.commandLine.appendSwitch("dns-over-https-mode", "off");
app.commandLine.appendSwitch(
  "disable-features",
  "NetworkTimeServiceQuerying,Translate,OptimizationHints,MediaRouter"
);

let mainWindow;
const auditedHosts = new Set();

function safeOpenExternal(url) {
  if (classifyNavigation(url, cfg) !== "external") return;
  setImmediate(() => shell.openExternal(url).catch((error) => console.error("[external]", error.message)));
}

function secureWebPreferences() {
  return {
    sandbox: true,
    contextIsolation: true,
    nodeIntegration: false,
    webSecurity: true,
    allowRunningInsecureContent: false,
    spellcheck: true
  };
}

function configureWebContents(contents) {
  contents.on("will-attach-webview", (event) => event.preventDefault());

  for (const eventName of ["will-navigate", "will-redirect"]) {
    contents.on(eventName, (event, url) => {
      const classification = classifyNavigation(url, cfg);
      if (classification === "internal" || classification === "authentication") return;
      event.preventDefault();
      safeOpenExternal(url);
    });
  }

  contents.setWindowOpenHandler(({ url }) => {
    const classification = classifyNavigation(url, cfg);
    if (classification === "internal" || classification === "authentication") {
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          autoHideMenuBar: true,
          parent: mainWindow || undefined,
          webPreferences: secureWebPreferences()
        },
        outlivesOpener: false
      };
    }
    safeOpenExternal(url);
    return { action: "deny" };
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: cfg.width,
    height: cfg.height,
    title: cfg.productName,
    autoHideMenuBar: true,
    icon: path.join(__dirname, "../build/icons/512x512.png"),
    webPreferences: secureWebPreferences()
  });
  mainWindow.loadURL(cfg.url);
}

function configureSession() {
  const ses = session.defaultSession;
  ses.setPermissionCheckHandler((_webContents, permission, requestingOrigin, details) => {
    const origin = permissionOrigin(requestingOrigin, details);
    return permissionAllowed(permission, origin, cfg);
  });
  ses.setPermissionRequestHandler((_webContents, permission, callback, details) => {
    const origin = permissionOrigin("", details);
    callback(permissionAllowed(permission, origin, cfg));
  });

  ses.webRequest.onBeforeRequest((details, callback) => {
    const parsed = parseUrl(details.url);
    if (process.env.AAHA_NETWORK_AUDIT === "1" && parsed && !auditedHosts.has(parsed.hostname)) {
      auditedHosts.add(parsed.hostname);
      console.error(`[network] ${parsed.hostname}`);
    }
    callback({ cancel: isBlockedRequest(details.url, cfg) });
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("web-contents-created", (_event, contents) => configureWebContents(contents));
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    configureSession();
    createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
