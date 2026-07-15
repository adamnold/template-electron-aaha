"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const sourceRoot = path.resolve(__dirname, "..");
const config = require("../app.config.js");

function createFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `${config.repoName}-installer-`));
  const repo = path.join(root, "repo");
  const home = path.join(root, "home");
  const stateHome = path.join(home, ".local", "state");
  fs.cpSync(sourceRoot, repo, {
    recursive: true,
    filter(source) {
      return ![".git", "node_modules", "dist"].includes(path.basename(source));
    }
  });
  const unpacked = path.join(repo, "dist", "linux-unpacked");
  fs.mkdirSync(unpacked, { recursive: true });
  const executable = path.join(unpacked, config.executable);
  fs.writeFileSync(executable, "#!/usr/bin/env bash\nexit 0\n");
  fs.chmodSync(executable, 0o755);
  fs.writeFileSync(path.join(unpacked, "chrome-sandbox"), "sandbox\n");
  for (const size of [16, 24, 32, 48, 64, 96, 128, 256, 512]) {
    const icon = path.join(repo, "build", "icons", `${size}x${size}.png`);
    fs.mkdirSync(path.dirname(icon), { recursive: true });
    if (!fs.existsSync(icon)) fs.writeFileSync(icon, `icon-${size}\n`);
  }
  const appImageName = `${config.repoName}-test-x86_64.AppImage`;
  const appImage = path.join(repo, "dist", appImageName);
  fs.writeFileSync(appImage, "test AppImage\n");
  const digest = crypto.createHash("sha256").update(fs.readFileSync(appImage)).digest("hex");
  fs.writeFileSync(path.join(repo, "dist", "SHA256SUMS"), `${digest}  ${appImageName}\n`);
  fs.mkdirSync(home, { recursive: true });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { repo, home, stateHome };
}

function run(fixture, script, args = []) {
  return spawnSync("bash", [script, ...args], {
    cwd: fixture.repo,
    encoding: "utf8",
    env: {
      ...process.env,
      AAHA_HOME: fixture.home,
      AAHA_STATE_HOME: fixture.stateHome,
      AAHA_SKIP_SANDBOX_SETUP: "1",
      AAHA_SKIP_DESKTOP_REFRESH: "1"
    }
  });
}

function receiptPath(fixture) {
  return path.join(fixture.stateHome, "aaha", config.repoName, "install-root");
}

test("default install uses the standards-oriented per-user root and writes safety metadata", (t) => {
  const fixture = createFixture(t);
  const expectedRoot = path.join(fixture.home, ".local", "opt", "aaha", config.repoName);
  const result = run(fixture, "install.sh");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(path.join(expectedRoot, "app", config.executable)), true);
  assert.equal(fs.readFileSync(receiptPath(fixture), "utf8"), `${expectedRoot}\n`);
  assert.match(fs.readFileSync(path.join(expectedRoot, ".aaha-install"), "utf8"), new RegExp(`repo=${config.repoName}`));
  assert.match(
    fs.readFileSync(path.join(fixture.home, ".local", "share", "applications", `${config.appId}.desktop`), "utf8"),
    new RegExp(`Exec="${expectedRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/app/${config.executable}"`)
  );
});

test("custom install root is recorded and normal uninstall preserves the profile", (t) => {
  const fixture = createFixture(t);
  const installRoot = path.join(fixture.home, "MyLocalApps", config.repoName);
  const profile = path.join(fixture.home, ".config", config.profileName);
  fs.mkdirSync(profile, { recursive: true });
  fs.writeFileSync(path.join(profile, "cookie"), "preserve");
  const install = run(fixture, "install.sh", ["--install-root", installRoot]);
  assert.equal(install.status, 0, install.stderr);
  const uninstall = run(fixture, "uninstall.sh", ["--install-root", installRoot]);
  assert.equal(uninstall.status, 0, uninstall.stderr);
  assert.equal(fs.existsSync(installRoot), false);
  assert.equal(fs.existsSync(profile), true);
});

test("--purge removes only the configured profile", (t) => {
  const fixture = createFixture(t);
  const installRoot = path.join(fixture.home, "MyLocalApps", config.repoName);
  const profile = path.join(fixture.home, ".config", config.profileName);
  const unrelated = path.join(fixture.home, ".config", "Unrelated");
  fs.mkdirSync(profile, { recursive: true });
  fs.mkdirSync(unrelated, { recursive: true });
  assert.equal(run(fixture, "install.sh", ["--install-root", installRoot]).status, 0);
  const result = run(fixture, "uninstall.sh", ["--purge", "--install-root", installRoot]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(profile), false);
  assert.equal(fs.existsSync(unrelated), true);
});

test("unknown arguments fail before changing anything", (t) => {
  const fixture = createFixture(t);
  const marker = path.join(fixture.home, "marker");
  fs.writeFileSync(marker, "safe");
  const install = run(fixture, "install.sh", ["--unknown"]);
  const uninstall = run(fixture, "uninstall.sh", ["--destroy-everything"]);
  assert.equal(install.status, 2);
  assert.equal(uninstall.status, 2);
  assert.equal(fs.readFileSync(marker, "utf8"), "safe");
});

test("dangerous and malformed install roots are rejected", (t) => {
  const fixture = createFixture(t);
  const candidates = [
    "/",
    fixture.home,
    config.repoName,
    path.join(fixture.home, "MyLocalApps", "wrong-name"),
    `${fixture.home}/MyLocalApps/../${config.repoName}`
  ];
  for (const candidate of candidates) {
    const result = run(fixture, "install.sh", ["--install-root", candidate]);
    assert.equal(result.status, 2, `${candidate}: ${result.stderr}`);
  }
});

test("receipt mismatch refuses deletion", (t) => {
  const fixture = createFixture(t);
  const installRoot = path.join(fixture.home, "MyLocalApps", config.repoName);
  assert.equal(run(fixture, "install.sh", ["--install-root", installRoot]).status, 0);
  fs.writeFileSync(receiptPath(fixture), `${path.join(fixture.home, "Other", config.repoName)}\n`);
  const result = run(fixture, "uninstall.sh", ["--install-root", installRoot]);
  assert.equal(result.status, 1);
  assert.equal(fs.existsSync(installRoot), true);
});

test("missing or tampered marker refuses deletion", (t) => {
  const fixture = createFixture(t);
  const installRoot = path.join(fixture.home, "MyLocalApps", config.repoName);
  assert.equal(run(fixture, "install.sh", ["--install-root", installRoot]).status, 0);
  fs.writeFileSync(path.join(installRoot, ".aaha-install"), "tampered\n");
  const result = run(fixture, "uninstall.sh", ["--install-root", installRoot]);
  assert.equal(result.status, 1);
  assert.equal(fs.existsSync(installRoot), true);
});
