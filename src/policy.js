"use strict";

const REQUIRED_STRINGS = [
  "repoName",
  "productName",
  "appId",
  "executable",
  "iconName",
  "profileName",
  "url"
];

function parseUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function normalizeHost(value) {
  return String(value || "").trim().toLowerCase().replace(/^\.+/, "");
}

function hostMatches(hostname, rule) {
  const host = normalizeHost(hostname);
  const wanted = normalizeHost(rule);
  return Boolean(host && wanted && (host === wanted || host.endsWith(`.${wanted}`)));
}

function hostInRules(hostname, rules = []) {
  return Array.isArray(rules) && rules.some((rule) => hostMatches(hostname, rule));
}

function isHttpsHost(urlString, rules) {
  const parsed = parseUrl(urlString);
  return Boolean(parsed && parsed.protocol === "https:" && hostInRules(parsed.hostname, rules));
}

function isTrustedNavigation(urlString, cfg) {
  return isHttpsHost(urlString, cfg.trustedNavigationHosts);
}

function isTrustedAuthentication(urlString, cfg) {
  return isHttpsHost(urlString, cfg.trustedAuthHosts);
}

function isSafeExternal(urlString, cfg) {
  const parsed = parseUrl(urlString);
  return Boolean(
    parsed &&
      cfg.openExternalLinks &&
      Array.isArray(cfg.externalProtocols) &&
      cfg.externalProtocols.includes(parsed.protocol)
  );
}

function classifyNavigation(urlString, cfg) {
  if (isTrustedNavigation(urlString, cfg)) return "internal";
  if (isTrustedAuthentication(urlString, cfg)) return "authentication";
  if (isSafeExternal(urlString, cfg)) return "external";
  return "deny";
}

function permissionAllowed(permission, urlString, cfg) {
  const parsed = parseUrl(urlString);
  const rules = cfg.permissions && cfg.permissions[permission];
  return Boolean(
    parsed &&
      parsed.protocol === "https:" &&
      Array.isArray(rules) &&
      hostInRules(parsed.hostname, rules)
  );
}

function isBlockedRequest(urlString, cfg) {
  const parsed = parseUrl(urlString);
  return Boolean(parsed && hostInRules(parsed.hostname, cfg.blockedHosts));
}

function validateConfig(cfg, { template = false } = {}) {
  const errors = [];
  if (!cfg || typeof cfg !== "object") return ["Configuration must export an object."];
  if (cfg.schemaVersion !== 2) errors.push("schemaVersion must be 2.");
  if (!template && cfg.configured !== true) errors.push("configured must be true for an application build.");

  for (const key of REQUIRED_STRINGS) {
    if (typeof cfg[key] !== "string" || !cfg[key].trim()) errors.push(`${key} must be a non-empty string.`);
  }

  const url = parseUrl(cfg.url);
  if (!template && (!url || url.protocol !== "https:")) errors.push("url must be a valid HTTPS URL.");
  if (!template && (!Array.isArray(cfg.trustedNavigationHosts) || cfg.trustedNavigationHosts.length === 0)) {
    errors.push("trustedNavigationHosts must contain at least one host.");
  }

  for (const key of [
    "legacyProfileNames",
    "compatibilityDesktopIds",
    "trustedNavigationHosts",
    "trustedAuthHosts",
    "blockedHosts",
    "externalProtocols"
  ]) {
    if (!Array.isArray(cfg[key])) errors.push(`${key} must be an array.`);
  }

  if (!cfg.permissions || typeof cfg.permissions !== "object" || Array.isArray(cfg.permissions)) {
    errors.push("permissions must be an object.");
  } else {
    for (const [permission, rules] of Object.entries(cfg.permissions)) {
      if (!permission || !Array.isArray(rules)) errors.push(`permissions.${permission} must be an array.`);
    }
  }

  if (!Number.isInteger(cfg.width) || cfg.width < 640) errors.push("width must be an integer of at least 640.");
  if (!Number.isInteger(cfg.height) || cfg.height < 480) errors.push("height must be an integer of at least 480.");
  if (cfg.openExternalLinks !== true && cfg.openExternalLinks !== false) {
    errors.push("openExternalLinks must be boolean.");
  }
  return errors;
}

module.exports = {
  classifyNavigation,
  hostMatches,
  isBlockedRequest,
  isSafeExternal,
  isTrustedAuthentication,
  isTrustedNavigation,
  parseUrl,
  permissionAllowed,
  validateConfig
};
