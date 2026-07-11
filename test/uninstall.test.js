"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const profileName = require("../app.config.js").profileName;
function run(home, args = []) {
  return spawnSync("bash", ["uninstall.sh", ...args], {
    cwd: root,
    env: { ...process.env, AAHA_HOME: home, AAHA_SKIP_DESKTOP_REFRESH: "1" },
    encoding: "utf8"
  });
}
test("normal uninstall preserves profile", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "aaha-uninstall-"));
  const profile = path.join(home, ".config", profileName);
  fs.mkdirSync(profile, { recursive: true });
  fs.writeFileSync(path.join(profile, "cookie"), "preserve");
  const result = run(home);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(profile), true);
});
test("--purge removes only configured profile", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "aaha-purge-"));
  const profile = path.join(home, ".config", profileName);
  const unrelated = path.join(home, ".config", "Unrelated");
  fs.mkdirSync(profile, { recursive: true });
  fs.mkdirSync(unrelated, { recursive: true });
  const result = run(home, ["--purge"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(profile), false);
  assert.equal(fs.existsSync(unrelated), true);
});
test("unknown arguments fail without deleting", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "aaha-unknown-"));
  const marker = path.join(home, "marker");
  fs.writeFileSync(marker, "safe");
  const result = run(home, ["--destroy-everything"]);
  assert.equal(result.status, 2);
  assert.equal(fs.existsSync(marker), true);
});
