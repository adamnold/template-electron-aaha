"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const { verifyArtifacts } = require("../scripts/verify-artifacts.js");
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aaha-signature-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const image = "example-aaha-v1.0.0-x86_64.AppImage";
  fs.writeFileSync(path.join(root,image),"inert payload");
  fs.writeFileSync(path.join(root,"BUILDINFO.json"),JSON.stringify({ repository:"https://github.com/example/example-aaha", app:"example-aaha", version:"1.0.0", templateVersion:"3.0.0", sourceCommit:"a".repeat(40), tag:"v1.0.0", lockfileSha256:"b".repeat(64), tools:{node:"v24.21.0",npm:"11.19.0"},electron:"44.7.0",architecture:"x64" }));
  fs.writeFileSync(path.join(root,"SHA256SUMS"),[image,"BUILDINFO.json"].map(name => `${crypto.createHash("sha256").update(fs.readFileSync(path.join(root,name))).digest("hex")}  ${name}\n`).join(""));
  const key=path.join(root,"key"); const pub=path.join(root,"release.pub");
  let r=spawnSync("minisign",["-G","-W","-s",key,"-p",pub],{encoding:"utf8"}); assert.equal(r.status,0,r.stderr);
  r=spawnSync("minisign",["-S","-s",key,"-m",path.join(root,"SHA256SUMS")],{encoding:"utf8"}); assert.equal(r.status,0,r.stderr);
  return {root,image,pub};
}
test("publisher signature authenticates both payload and build metadata",t => {
  const f=fixture(t);
  assert.equal(verifyArtifacts(f.root,{repoName:"example-aaha"},{publicKey:f.pub,version:"1.0.0"}),f.image);
  fs.appendFileSync(path.join(f.root,f.image),"tamper");
  assert.throws(()=>verifyArtifacts(f.root,{repoName:"example-aaha"},{publicKey:f.pub,version:"1.0.0"}),/checksum/i);
});
test("wrong keys, changed manifests and missing authentication fail",t => {
  const f=fixture(t); const other=path.join(f.root,"other.pub");
  const r=spawnSync("minisign",["-G","-W","-s",path.join(f.root,"other.key"),"-p",other]); assert.equal(r.status,0);
  assert.throws(()=>verifyArtifacts(f.root,{repoName:"example-aaha"},{publicKey:other,version:"1.0.0"}),/signature/i);
  fs.appendFileSync(path.join(f.root,"SHA256SUMS"),"modified\n");
  assert.throws(()=>verifyArtifacts(f.root,{repoName:"example-aaha"},{publicKey:f.pub,version:"1.0.0"}),/signature/i);
  fs.rmSync(path.join(f.root,"SHA256SUMS.minisig"));
  assert.throws(()=>verifyArtifacts(f.root,{repoName:"example-aaha"},{publicKey:f.pub,version:"1.0.0"}));
});
test("local builds are explicit and manifests cannot select external paths",t => {
  const f=fixture(t); fs.rmSync(path.join(f.root,"SHA256SUMS.minisig"));
  assert.equal(verifyArtifacts(f.root,{repoName:"example-aaha"},{localBuild:true}),f.image);
  fs.appendFileSync(path.join(f.root,"SHA256SUMS"),`${"c".repeat(64)}  ../outside\n`);
  assert.throws(()=>verifyArtifacts(f.root,{repoName:"example-aaha"},{localBuild:true}),/manifest/i);
});

test("altered metadata, absent images, duplicate selection and links fail closed",t => {
  const f=fixture(t);fs.appendFileSync(path.join(f.root,"BUILDINFO.json")," ");
  assert.throws(()=>verifyArtifacts(f.root,{repoName:"example-aaha"},{publicKey:f.pub}),/checksum/i);
  fs.copyFileSync(path.join(f.root,f.image),path.join(f.root,"second.AppImage"));
  assert.throws(()=>verifyArtifacts(f.root,{repoName:"example-aaha"},{localBuild:true}),/exactly one/i);
  fs.rmSync(path.join(f.root,"second.AppImage"));fs.renameSync(path.join(f.root,f.image),path.join(f.root,"outside"));
  assert.throws(()=>verifyArtifacts(f.root,{repoName:"example-aaha"},{localBuild:true}),/found 0/i);
  fs.symlinkSync(path.join(f.root,"outside"),path.join(f.root,f.image));
  assert.throws(()=>verifyArtifacts(f.root,{repoName:"example-aaha"},{localBuild:true}),/regular/i);
});
