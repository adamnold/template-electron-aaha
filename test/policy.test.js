"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { classifyNavigation, hostMatches, isBlockedRequest, permissionAllowed, validateConfig } = require("../src/policy.js");
const cfg = {
  schemaVersion: 2, configured: true, repoName: "example-aaha", productName: "Example",
  appId: "com.adamandhisagents.example", executable: "example-aaha", iconName: "example-aaha",
  profileName: "Example", legacyProfileNames: [], compatibilityDesktopIds: [],
  url: "https://app.example.com", trustedNavigationHosts: ["example.com"],
  trustedAuthHosts: ["login.example.net"], permissions: { notifications: ["app.example.com"] },
  blockedHosts: ["tracker.invalid"], externalProtocols: ["https:", "mailto:"],
  openExternalLinks: true, width: 1280, height: 800
};
test("host matching rejects deceptive suffixes", () => {
  assert.equal(hostMatches("sub.example.com", "example.com"), true);
  assert.equal(hostMatches("example.com.attacker.invalid", "example.com"), false);
});
test("navigation separates app, auth, external, and unsafe URLs", () => {
  assert.equal(classifyNavigation("https://app.example.com/page", cfg), "internal");
  assert.equal(classifyNavigation("https://login.example.net/start", cfg), "authentication");
  assert.equal(classifyNavigation("https://external.example.org", cfg), "external");
  assert.equal(classifyNavigation("file:///etc/passwd", cfg), "deny");
  assert.equal(classifyNavigation("javascript:alert(1)", cfg), "deny");
});
test("permissions default deny and require approved HTTPS hosts", () => {
  assert.equal(permissionAllowed("notifications", "https://app.example.com", cfg), true);
  assert.equal(permissionAllowed("media", "https://app.example.com", cfg), false);
  assert.equal(permissionAllowed("notifications", "http://app.example.com", cfg), false);
});
test("blocklist matches subdomains without lookalikes", () => {
  assert.equal(isBlockedRequest("https://a.tracker.invalid/pixel", cfg), true);
  assert.equal(isBlockedRequest("https://tracker.invalid.example.com", cfg), false);
});
test("application validation rejects incomplete templates", () => {
  const incomplete = { ...cfg, configured: false, trustedNavigationHosts: [] };
  assert.ok(validateConfig(incomplete).length >= 2);
  assert.equal(validateConfig(incomplete, { template: true }).length, 0);
});
