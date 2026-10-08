"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { classifyNavigation, hostMatches, isBlockedRequest, permissionAllowed, permissionOrigin, validateConfig } = require("../src/policy.js");
const cfg = {
  schemaVersion: 3, configured: true, repoName: "example-aaha", productName: "Example",
  appId: "com.adamandhisagents.example", executable: "example-aaha", iconName: "example-aaha",
  profileName: "Example", legacyProfileNames: [], compatibilityDesktopIds: [],
  url: "https://app.example.com", trustedNavigationOrigins: ["https://app.example.com"],
  trustedAuthOrigins: ["https://login.example.net"], permissions: { notifications: ["https://app.example.com"] },
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
  const incomplete = { ...cfg, configured: false, trustedNavigationOrigins: [] };
  assert.ok(validateConfig(incomplete).length >= 2);
  assert.equal(validateConfig(incomplete, { template: true }).length, 0);
});
test("navigation and permissions bind exact origins, including ports", () => {
  for (const url of ["https://sibling.example.com", "https://app.example.com:8443", "http://app.example.com", "https://app.example.com.attacker.invalid"]) {
    assert.notEqual(classifyNavigation(url, cfg), "internal", url);
    assert.equal(permissionAllowed("notifications", url, cfg), false, url);
  }
  assert.equal(classifyNavigation("https://app.example.com:443/path", cfg), "internal");
});
test("permission requester identity is explicit and consistent, never a top-level fallback", () => {
  assert.equal(permissionOrigin("", {}), "");
  assert.equal(permissionOrigin("https://app.example.com", { requestingUrl: "https://attacker.invalid/frame" }), "");
  assert.equal(permissionOrigin("", { requestingUrl: "https://app.example.com/frame" }), "https://app.example.com");
  assert.equal(permissionOrigin("https://app.example.com", { requestingUrl: "https://app.example.com/frame", embeddingOrigin: "https://other.invalid" }), "https://app.example.com");
  assert.equal(permissionOrigin("null", { requestingUrl: "https://app.example.com" }), "");
});
test("v3 rejects legacy rules, URL-shaped origins and unsafe profile identities", () => {
  assert.ok(validateConfig({ ...cfg, schemaVersion: 2, trustedNavigationHosts: ["example.com"] }).some(e => /migration|schemaVersion|legacy/i.test(e)));
  for (const origin of ["example.com", "http://app.example.com", "https://user@app.example.com", "https://app.example.com/path", "https://app.example.com?x=1"]) {
    assert.ok(validateConfig({ ...cfg, trustedNavigationOrigins: [origin] }).length, origin);
  }
  assert.ok(validateConfig({ ...cfg, url: "https://sibling.example.com" }).length);
  assert.ok(validateConfig({ ...cfg, profileName: "../outside" }).length);
});

test("null requester details and unsafe desktop identities fail closed", () => {
  assert.equal(permissionOrigin("", null), "");
  assert.ok(validateConfig({ ...cfg, appId: "../../other" }).some(error => /appId/.test(error)));
});
