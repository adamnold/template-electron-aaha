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

function httpsOrigin(urlString) {
  const parsed = parseUrl(urlString);
  return parsed && parsed.protocol === "https:" && !parsed.username && !parsed.password ? parsed.origin : "";
}

function originInRules(urlString, rules) {
  const origin = httpsOrigin(urlString);
  return Boolean(origin && Array.isArray(rules) && rules.some(rule => httpsOrigin(rule) === origin));
}

function permissionOrigin(requestingOrigin, details = {}) {
  details = details && typeof details === "object" ? details : {};
  const values = [requestingOrigin, details.requestingUrl, details.securityOrigin].filter(value => value !== undefined && value !== "");
  if (!values.length) return "";
  const origins = values.map(httpsOrigin);
  return origins.every(origin => origin && origin === origins[0]) ? origins[0] : "";
}

function isTrustedNavigation(urlString, cfg) {
  return originInRules(urlString, cfg.trustedNavigationOrigins);
}

function isTrustedAuthentication(urlString, cfg) {
  return originInRules(urlString, cfg.trustedAuthOrigins);
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
  const rules = cfg.permissions && cfg.permissions[permission];
  return permission !== "unknown" && originInRules(urlString, rules);
}

function isBlockedRequest(urlString, cfg) {
  const parsed = parseUrl(urlString);
  return Boolean(parsed && hostInRules(parsed.hostname, cfg.blockedHosts));
}

function validateConfig(cfg, { template = false } = {}) {
  const errors = [];
  if (!cfg || typeof cfg !== "object") return ["Configuration must export an object."];
  if (cfg.schemaVersion !== 3) errors.push("schemaVersion must be 3; see MIGRATION.md for v2 migration.");
  for (const key of ["trustedNavigationHosts", "trustedAuthHosts", "allowedHosts"]) {
    if (Object.hasOwn(cfg, key)) errors.push(`Legacy ${key} is unsupported; migrate to explicit HTTPS origins.`);
  }
  if (!template && cfg.configured !== true) errors.push("configured must be true for an application build.");

  for (const key of REQUIRED_STRINGS) {
    if (typeof cfg[key] !== "string" || !cfg[key].trim()) errors.push(`${key} must be a non-empty string.`);
  }
  const safeName = value => typeof value === "string" && value !== "." && value !== ".." && !/[\/\\\r\n\0"]/u.test(value) && value.trim().length > 0;
  for (const key of ["repoName", "appId", "executable", "iconName", "profileName"]) {
    if (!safeName(cfg[key])) errors.push(`${key} must be a safe single path component.`);
  }
  for (const key of ["legacyProfileNames", "compatibilityDesktopIds"]) {
    if (Array.isArray(cfg[key]) && !cfg[key].every(safeName)) errors.push(`${key} contains an unsafe identity.`);
  }

  const url = parseUrl(cfg.url);
  if (!template && (!url || url.protocol !== "https:")) errors.push("url must be a valid HTTPS URL.");
  if (!template && (!Array.isArray(cfg.trustedNavigationOrigins) || cfg.trustedNavigationOrigins.length === 0)) {
    errors.push("trustedNavigationOrigins must contain at least one origin.");
  }
  const validOrigin = value => {
    const parsed = parseUrl(value);
    return Boolean(httpsOrigin(value) && parsed.pathname === "/" && !parsed.search && !parsed.hash);
  };

  for (const key of [
    "legacyProfileNames",
    "compatibilityDesktopIds",
    "trustedNavigationOrigins",
    "trustedAuthOrigins",
    "externalProtocols"
  ]) {
    if (!Array.isArray(cfg[key])) errors.push(`${key} must be an array.`);
  }
  for (const key of ["trustedNavigationOrigins", "trustedAuthOrigins"]) {
    if (Array.isArray(cfg[key]) && !cfg[key].every(validOrigin)) errors.push(`${key} must contain HTTPS origins without paths, credentials, queries or fragments.`);
  }
  if (!template && !isTrustedNavigation(cfg.url, cfg)) errors.push("url must belong to a trustedNavigationOrigins entry.");
  if (cfg.blockedHosts !== undefined && (!Array.isArray(cfg.blockedHosts) || !cfg.blockedHosts.every(host => typeof host === "string" && /^[a-z0-9.-]+$/i.test(host)))) errors.push("blockedHosts must contain hostname rules.");
  if (Array.isArray(cfg.externalProtocols) && !cfg.externalProtocols.every(value => ["http:", "https:", "mailto:"].includes(value))) errors.push("externalProtocols supports only http:, https: and mailto:.");

  if (!cfg.permissions || typeof cfg.permissions !== "object" || Array.isArray(cfg.permissions)) {
    errors.push("permissions must be an object.");
  } else {
    for (const [permission, rules] of Object.entries(cfg.permissions)) {
      if (!permission || permission === "unknown" || !Array.isArray(rules) || !rules.every(validOrigin)) errors.push(`permissions.${permission} must contain explicit HTTPS origins.`);
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
  permissionOrigin,
  httpsOrigin,
  validateConfig
};
