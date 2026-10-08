"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aaha-launch space-"));
  const launcher = path.join(root, "app");
  fs.copyFileSync(path.join(__dirname, "../scripts/launch.sh"), launcher);
  fs.writeFileSync(launcher + ".bin", '#!/bin/sh\nprintf "%s\\n" "$@"\n'); fs.chmodSync(launcher + ".bin", 0o755);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, launcher };
}
function run(f, args = [], env = {}) {
  return spawnSync("bash", [f.launcher, ...args], { encoding: "utf8", env: { ...process.env, ...env } });
}
test("launcher selects namespace sandbox before native execution and preserves URL arguments", t => {
  const f = fixture(t); const r = run(f, ["https://example.com/path?q=space value"]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, "--disable-setuid-sandbox\nhttps://example.com/path?q=space value\n");
});
test("launcher refuses sandbox-disabling switches and environment presence", t => {
  const f = fixture(t);
  for (const flag of ["-no-sandbox", "-no-sandbox=true", "-disable-seccomp-filter-sandbox", "--disable-namespace-sandbox", "--no-sandbox", "--no-sandbox=true", "--disable-seccomp-filter-sandbox", "--disable-gpu-sandbox", "--single-process", "--no-zygote"]) {
    const r = run(f, [flag]); assert.notEqual(r.status, 0, flag); assert.equal(r.stdout, "");
    assert.ok(require("../src/launch-policy.js").launchErrors([flag], {}, 1000).length > 0, flag);
  }
  for (const key of ["ELECTRON_DISABLE_SANDBOX", "ELECTRON_RUN_AS_NODE"]) {
    const r = run(f, [], { [key]: "0" }); assert.notEqual(r.status, 0, key); assert.equal(r.stdout, "");
  }
});
test("namespace failure stops before the native executable runs", t => {
  const f = fixture(t); const bin = path.join(f.root, "bin"); fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, "unshare"), "#!/bin/sh\nexit 1\n"); fs.chmodSync(path.join(bin, "unshare"), 0o755);
  const r = run(f, [], { PATH: `${bin}:${process.env.PATH}` });
  assert.notEqual(r.status, 0); assert.equal(r.stdout, ""); assert.match(r.stderr, /namespace/i);
});

test("root execution fails before native code",t => {
  const f=fixture(t);const bin=path.join(f.root,"bin");fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin,"id"),"#!/bin/sh\necho 0\n");fs.chmodSync(path.join(bin,"id"),0o755);
  const r=run(f,[],{PATH:`${bin}:${process.env.PATH}`});assert.notEqual(r.status,0);assert.equal(r.stdout,"");
  assert.deepEqual(require("../src/launch-policy.js").launchErrors([],{},0),["Run this per-user application without root privileges."]);
});
