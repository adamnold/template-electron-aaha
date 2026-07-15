"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");

test("new-app creates a clean scaffold with synchronized locked identity", (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "aaha-new-app-"));
  const destination = path.join(temporary, "generated-aaha");
  const definitionPath = path.join(temporary, "definition.json");
  const definition = JSON.parse(
    fs.readFileSync(path.join(root, "templates", "app-definition.example.json"), "utf8")
  );
  definition.repoName = "generated-aaha";
  definition.productName = "Generated";
  definition.appId = "com.adamandhisagents.generated";
  definition.executable = "generated-aaha";
  definition.iconName = "generated-aaha";
  definition.profileName = "Generated";
  definition.version = "0.2.0";
  fs.writeFileSync(definitionPath, JSON.stringify(definition, null, 2) + "\n");
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));

  const result = spawnSync("bash", ["new-app.sh", destination, definitionPath], {
    cwd: root,
    encoding: "utf8"
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(path.join(destination, "+")), false);
  assert.equal(fs.existsSync(path.join(destination, "package-lock.json")), true);

  const pkg = JSON.parse(fs.readFileSync(path.join(destination, "package.json"), "utf8"));
  const lock = JSON.parse(fs.readFileSync(path.join(destination, "package-lock.json"), "utf8"));
  assert.equal(pkg.name, definition.repoName);
  assert.equal(pkg.version, definition.version);
  assert.equal(lock.name, definition.repoName);
  assert.equal(lock.version, definition.version);
  assert.equal(lock.packages[""].name, definition.repoName);
  assert.equal(lock.packages[""].version, definition.version);
});
