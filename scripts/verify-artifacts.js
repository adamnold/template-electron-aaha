"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
function regular(file) {
  if (!fs.lstatSync(file).isFile()) throw new Error(`Expected a regular file: ${path.basename(file)}`);
}
function digest(file) {
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    if (!fs.fstatSync(fd).isFile()) throw new Error("Artifact must be a regular file.");
    const hash = crypto.createHash("sha256"); const buffer = Buffer.alloc(1024 * 1024);
    let n; while ((n = fs.readSync(fd, buffer, 0, buffer.length, null))) hash.update(buffer.subarray(0, n));
    return hash.digest("hex");
  } finally { fs.closeSync(fd); }
}
function verifyArtifacts(directory, cfg, { localBuild = false, publicKey = path.resolve("release.pub"), version } = {}) {
  const images = fs.readdirSync(directory).filter(name => name.endsWith(".AppImage"));
  if (images.length !== 1) throw new Error(`Expected exactly one AppImage; found ${images.length}.`);
  const image = images[0];
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*\.AppImage$/.test(image) || !image.startsWith(cfg.repoName + "-")) throw new Error("Unexpected AppImage identity.");
  regular(path.join(directory, image));
  const manifest = path.join(directory, "SHA256SUMS"); regular(manifest);
  if (!localBuild) {
    regular(path.join(directory, "SHA256SUMS.minisig")); regular(publicKey);
    const key = fs.readFileSync(publicKey, "utf8").split(/\r?\n/).find(line => /^[A-Za-z0-9+/]{56}$/.test(line));
    if (!key) throw new Error("Release public key is not configured; obtain it independently from the publisher.");
    const result = spawnSync("minisign", ["-Vm", manifest, "-x", path.join(directory, "SHA256SUMS.minisig"), "-P", key], { encoding: "utf8" });
    if (result.status !== 0) throw new Error("Release signature verification failed (minisign is required).");
  }
  const entries = new Map();
  for (const line of fs.readFileSync(manifest, "utf8").trim().split(/\r?\n/)) {
    const match = /^([a-f0-9]{64})  ([A-Za-z0-9][A-Za-z0-9._-]*)$/.exec(line);
    if (!match || entries.has(match[2]) || ![image, "BUILDINFO.json"].includes(match[2])) throw new Error("Invalid checksum manifest.");
    entries.set(match[2], match[1]);
  }
  if (!entries.has(image) || (!localBuild && !entries.has("BUILDINFO.json"))) throw new Error("Checksum manifest must cover the AppImage and build metadata.");
  for (const [name, expected] of entries) {
    regular(path.join(directory, name));
    if (digest(path.join(directory, name)) !== expected) throw new Error(`Checksum mismatch: ${name}`);
  }
  if (entries.has("BUILDINFO.json")) {
    const info = JSON.parse(fs.readFileSync(path.join(directory, "BUILDINFO.json"), "utf8"));
    if (info.app !== cfg.repoName || (version && info.version !== version)) throw new Error("Build metadata does not match this application's identity/version.");
    if (!localBuild && (!/^[a-f0-9]{40}$/.test(info.sourceCommit) || info.tag !== `v${info.version}` || !/^[a-f0-9]{64}$/.test(info.lockfileSha256) || !info.repository || !info.tools || !info.electron || !info.templateVersion || !info.architecture)) throw new Error("Incomplete signed build provenance.");
  }
  return image;
}
if (require.main === module) {
  try {
    const [directory, ...args] = process.argv.slice(2);
    let publicKey = path.resolve("release.pub"); let localBuild = false;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === "--local-build") localBuild = true;
      else if (args[i] === "--public-key" && args[i + 1]) publicKey = path.resolve(args[++i]);
      else throw new Error("Unknown artifact verification option.");
    }
    const cfg = require(path.resolve("app.config.js"));
    console.log(verifyArtifacts(directory, cfg, { localBuild, publicKey, version: require(path.resolve("package.json")).version }));
  } catch (error) { console.error(`ERROR: ${error.message}`); process.exitCode = 1; }
}
module.exports = { digest, verifyArtifacts };
