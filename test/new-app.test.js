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
  const workflow = fs.readFileSync(
    path.join(destination, ".github", "workflows", "ci.yml"),
    "utf8"
  );
  assert.equal(pkg.name, definition.repoName);
  assert.equal(pkg.version, definition.version);
  assert.equal(pkg.scripts.dist, "electron-builder --linux --publish never");
  assert.equal(lock.name, definition.repoName);
  assert.equal(lock.version, definition.version);
  assert.equal(lock.packages[""].name, definition.repoName);
  assert.equal(lock.packages[""].version, definition.version);
  assert.match(workflow, /actions\/checkout@v7/);
  assert.match(workflow, /actions\/setup-node@v7/);
  const workflows = path.join(destination, ".github", "workflows");
  assert.equal(fs.existsSync(path.join(workflows, "release-template.yml")), false);
  const release = fs.readFileSync(path.join(workflows, "release.yml"), "utf8");
  assert.match(release, /workflow_dispatch:/);
  assert.match(release, /^\s*- run: \.\/build\.sh$/m);
});

test("template release workflow is manual-only and archives the target commit", () => {
  const wf = fs.readFileSync(path.join(root, ".github", "workflows", "release-template.yml"), "utf8");
  const trigger = wf.slice(wf.indexOf("\non:"), wf.indexOf("\npermissions:"));
  assert.match(trigger, /workflow_dispatch:/);
  assert.doesNotMatch(trigger, /\b(push|pull_request|release|schedule):/);
  assert.match(wf, /git archive --format=tar\.gz/);
  assert.match(wf, /webapp-wrapper-aaha-\$TAG-SHA256SUMS/);
});
