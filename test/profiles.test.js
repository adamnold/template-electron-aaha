"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { profileRoot } = require("../src/profiles.js");
const { withDefaults } = require("../src/defaults.js");
test("profile root follows absolute XDG config and an explicit fixture home", () => {
  assert.equal(profileRoot({ XDG_CONFIG_HOME: "/tmp/config space", AAHA_HOME: "/tmp/home" }), "/tmp/config space");
  assert.equal(profileRoot({ XDG_CONFIG_HOME: "relative", AAHA_HOME: "/tmp/home" }), "/tmp/home/.config");
  assert.throws(() => profileRoot({ AAHA_HOME: "relative" }));
});
test("generated privacy defaults are inherited while explicit replacements are honored", () => {
  assert.ok(withDefaults({}).blockedHosts.includes("google-analytics.com"));
  assert.deepEqual(withDefaults({ blockedHosts: [] }).blockedHosts, []);
  const first = withDefaults({}); first.blockedHosts.length = 0;
  assert.ok(withDefaults({}).blockedHosts.length > 0);
});
