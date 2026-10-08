"use strict";
const blockedHosts = Object.freeze([
  "clients2.google.com", "clients4.google.com", "update.googleapis.com",
  "safebrowsing.googleapis.com", "optimizationguide-pa.googleapis.com",
  "redirector.gvt1.com", "google-analytics.com", "www.google-analytics.com",
  "stats.g.doubleclick.net"
]);
function withDefaults(config) {
  return { ...config, blockedHosts: config.blockedHosts === undefined ? [...blockedHosts] : config.blockedHosts };
}
module.exports = { blockedHosts, withDefaults };
