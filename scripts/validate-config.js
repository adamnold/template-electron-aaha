"use strict";

const cfg = require("../app.config.js");
const { validateConfig } = require("../src/policy.js");

const template = process.argv.includes("--template");
const errors = validateConfig(cfg, { template });
if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}
console.log(template ? "Template structure is valid." : "Application configuration is valid.");
