"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { validateConfig } = require("../src/policy.js");
const { withDefaults } = require("../src/defaults.js");
const [destination, definitionPath] = process.argv.slice(2);
if (!destination || !definitionPath) {
  console.error("materialize-app.js requires destination and definition paths.");
  process.exit(2);
}
const definition = withDefaults(JSON.parse(fs.readFileSync(definitionPath, "utf8")));
const errors = validateConfig(definition);
if (errors.length) {
  console.error(errors.map((error) => "- " + error).join("\n"));
  process.exit(1);
}
const packagePath = path.join(destination, "package.json");
const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
pkg.name = definition.repoName;
pkg.productName = definition.productName;
pkg.version = definition.version || "0.1.0";
pkg.description = definition.description;
pkg.private = false;
pkg.templateVersion = "3.0.0";
pkg.repository.url = definition.repository || `https://github.com/adamnold/${definition.repoName}.git`;
pkg.desktopName = definition.appId + ".desktop";
pkg.build.appId = definition.appId;
pkg.build.productName = definition.productName;
pkg.build.linux.executableName = definition.executable;
pkg.build.linux.artifactName = definition.repoName + "-v${version}-${arch}.AppImage";
pkg.build.linux.category = String(definition.category || "Network;").replace(/;$/, "");
pkg.build.linux.desktop.entry.Name = definition.productName;
pkg.build.linux.desktop.entry.Comment = definition.comment;
pkg.build.linux.desktop.entry.Categories = definition.category;
pkg.build.linux.desktop.entry.Keywords = definition.keywords;
pkg.build.linux.desktop.entry.StartupWMClass = definition.appId;
fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + "\n");

const lockPath = path.join(destination, "package-lock.json");
const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
lock.name = pkg.name;
lock.version = pkg.version;
if (lock.packages && lock.packages[""]) {
  lock.packages[""].name = pkg.name;
  lock.packages[""].version = pkg.version;
}
fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + "\n");

fs.writeFileSync(
  path.join(destination, "app.config.js"),
  '"use strict";\n\nmodule.exports = ' + JSON.stringify(definition, null, 2) + ";\n"
);
// Each application owns its release trust. Never inherit the template's key.
fs.writeFileSync(path.join(destination, "release.pub"), definition.releasePublicKey ? definition.releasePublicKey.trim() + "\n" : "");
