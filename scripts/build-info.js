"use strict";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { digest } = require("./verify-artifacts.js");
function command(cmd, args, env = process.env) {
  const r = spawnSync(cmd, args, { encoding: "utf8", env });
  if (r.status !== 0) throw new Error(`Cannot record ${cmd}: ${r.stderr || r.error || r.status}`);
  return r.stdout.trim();
}
function packageVersion(name) {
  let directory = path.dirname(require.resolve(name));
  while (!fs.existsSync(path.join(directory, "package.json"))) directory = path.dirname(directory);
  return JSON.parse(fs.readFileSync(path.join(directory, "package.json"), "utf8")).version;
}
async function main() {
  const pkg = require(path.resolve("package.json"));
  const git = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" });
  const sourceCommit = git.status === 0 ? git.stdout.trim() : (process.env.AAHA_SOURCE_COMMIT || null);
  const versions = JSON.parse(command(require("electron"), ["-p", "JSON.stringify(process.versions)"], { ...process.env, ELECTRON_RUN_AS_NODE: "1" }));
  const info = {
    schemaVersion: 1, app: pkg.name, version: pkg.version, templateVersion: pkg.templateVersion,
    repository: process.env.GITHUB_REPOSITORY ? `https://github.com/${process.env.GITHUB_REPOSITORY}` : pkg.repository.url,
    sourceCommit, tag: process.env.TAG || null,
    workingTreeDirty: git.status === 0 ? command("git", ["status", "--porcelain"]).length > 0 : true,
    architecture: process.arch, lockfileSha256: digest("package-lock.json"),
    electron: { version: versions.electron, chromium: versions.chrome, node: versions.node },
    tools: { node: process.version, npm: command("npm", ["--version"]),
      electronBuilder: require("electron-builder/package.json").version,
      electronFuses: packageVersion("@electron/fuses"),
      builderUtil: packageVersion("builder-util"),
      minisign: command("minisign", ["-v"]),
      imageMagick: command(fs.existsSync("/usr/bin/magick") ? "magick" : "convert", ["-version"]).split("\n")[0] },
    runner: { os: os.platform(), release: os.release(), image: process.env.ImageOS || null, imageVersion: process.env.ImageVersion || null },
    builtAt: new Date().toISOString()
  };
  const directory = process.argv[2] || "dist";
  if (fs.readdirSync(directory).some(n => n.endsWith(".AppImage"))) {
    const toolset = pkg.build.toolsets?.appimage || "0.0.0";
    const tools = await require("app-builder-lib/out/toolsets/linux.js").getAppImageTools(toolset, require("builder-util").Arch[process.arch === "arm" ? "armv7l" : process.arch]);
    info.tools.appImage = { toolset, mksquashfs: command(tools.mksquashfs, ["-version"]).split("\n")[0], mksquashfsSha256: digest(tools.mksquashfs), runtimeSha256: digest(tools.runtime) };
  }
  fs.writeFileSync(path.join(directory, "BUILDINFO.json"), JSON.stringify(info, null, 2) + "\n");
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
