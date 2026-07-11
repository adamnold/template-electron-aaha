"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { validateConfig } = require("../src/policy.js");
const [destination, definitionPath] = process.argv.slice(2);
if (!destination || !definitionPath) {
  console.error("materialize-app.js requires destination and definition paths.");
  process.exit(2);
}
const definition = JSON.parse(fs.readFileSync(definitionPath, "utf8"));
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
fs.writeFileSync(
  path.join(destination, "app.config.js"),
  '"use strict";\n\nmodule.exports = ' + JSON.stringify(definition, null, 2) + ";\n"
);
