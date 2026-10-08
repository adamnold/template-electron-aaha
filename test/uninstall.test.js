"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const sourceRoot = path.resolve(__dirname, "..");
const config = require("../app.config.js");

function createFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `${config.repoName}-installer-`));
  const repo = path.join(root, "repo");
  const home = path.join(root, "home");
  const stateHome = path.join(home, ".local", "state");
  fs.cpSync(sourceRoot, repo, {
    recursive: true,
    filter(source) {
      return ![".git", "node_modules", "dist", ".superpowers"].includes(path.basename(source));
    }
  });
  const unpacked = path.join(repo, "dist", "linux-unpacked");
  fs.mkdirSync(unpacked, { recursive: true });
  const executable = path.join(unpacked, config.executable);
  fs.writeFileSync(executable, "#!/usr/bin/env bash\nexit 0\n");
  fs.chmodSync(executable, 0o755);
  fs.writeFileSync(path.join(unpacked, "chrome-sandbox"), "sandbox\n");
  for (const size of [16, 24, 32, 48, 64, 96, 128, 256, 512]) {
    const icon = path.join(repo, "build", "icons", `${size}x${size}.png`);
    fs.mkdirSync(path.dirname(icon), { recursive: true });
    if (!fs.existsSync(icon)) fs.writeFileSync(icon, `icon-${size}\n`);
  }
  const appImageName = `${config.repoName}-test-x86_64.AppImage`;
  const appImage = path.join(repo, "dist", appImageName);
  fs.writeFileSync(appImage, `#!/usr/bin/env bash
set -eu
[[ "$1" == --appimage-extract ]]
mkdir squashfs-root
printf '#!/bin/sh\\nexit 0\\n' > squashfs-root/${config.executable}
chmod 755 squashfs-root/${config.executable}
printf 'authenticated fixture' > squashfs-root/payload.txt
mkdir squashfs-root/aaha-icons
for size in 16 24 32 48 64 96 128 256 512; do printf icon > squashfs-root/aaha-icons/\${size}x\${size}.png; done
`);
  fs.chmodSync(appImage, 0o755);
  const digest = crypto.createHash("sha256").update(fs.readFileSync(appImage)).digest("hex");
  fs.writeFileSync(path.join(repo, "dist", "SHA256SUMS"), `${digest}  ${appImageName}\n`);
  fs.mkdirSync(home, { recursive: true });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const bin = path.join(root, "bin"); fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, "sudo"), "#!/bin/sh\necho forbidden-privilege >&2\nexit 97\n");
  fs.chmodSync(path.join(bin, "sudo"), 0o755);
  return { repo, home, stateHome, root, bin, appImage };
}

function run(fixture, script, args = []) {
  return spawnSync("bash", [script, ...(script === "install.sh" ? ["--local-build"] : []), ...args], {
    cwd: fixture.repo,
    encoding: "utf8",
    env: {
      ...process.env,
      AAHA_HOME: fixture.home,
      AAHA_STATE_HOME: fixture.stateHome,
      PATH: `${fixture.bin}:${process.env.PATH}`,
      XDG_CONFIG_HOME: fixture.xdg || "",
      AAHA_SKIP_DESKTOP_REFRESH: "1"
    }
  });
}

function receiptPath(fixture) {
  return path.join(fixture.stateHome, "aaha", config.repoName, "install-root");
}

test("default install uses the standards-oriented per-user root and writes safety metadata", (t) => {
  const fixture = createFixture(t);
  const expectedRoot = path.join(fixture.home, ".local", "opt", "aaha", config.repoName);
  const result = run(fixture, "install.sh");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(path.join(expectedRoot, "app", config.executable)), true);
  assert.equal(fs.readFileSync(receiptPath(fixture), "utf8"), `${expectedRoot}\n`);
  assert.match(fs.readFileSync(path.join(expectedRoot, ".aaha-install"), "utf8"), new RegExp(`repo=${config.repoName}`));
  assert.match(
    fs.readFileSync(path.join(fixture.home, ".local", "share", "applications", `${config.appId}.desktop`), "utf8"),
    new RegExp(`Exec="${expectedRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/app/${config.executable}"`)
  );
});

test("custom install root is recorded and normal uninstall preserves the profile", (t) => {
  const fixture = createFixture(t);
  const installRoot = path.join(fixture.home, "MyLocalApps", config.repoName);
  const profile = path.join(fixture.home, ".config", config.profileName);
  fs.mkdirSync(profile, { recursive: true });
  fs.writeFileSync(path.join(profile, "cookie"), "preserve");
  const install = run(fixture, "install.sh", ["--install-root", installRoot]);
  assert.equal(install.status, 0, install.stderr);
  const uninstall = run(fixture, "uninstall.sh", ["--install-root", installRoot]);
  assert.equal(uninstall.status, 0, uninstall.stderr);
  assert.equal(fs.existsSync(installRoot), false);
  assert.equal(fs.existsSync(profile), true);
});

test("compatibility aliases use the configured application description", (t) => {
  const fixture = createFixture(t);
  const compatibilityDesktopId = "com.adamandhisagents.example-legacy";
  const fixtureConfig = {
    ...config,
    compatibilityDesktopIds: [compatibilityDesktopId]
  };
  fs.writeFileSync(
    path.join(fixture.repo, "app.config.js"),
    `"use strict";\n\nmodule.exports = ${JSON.stringify(fixtureConfig, null, 2)};\n`
  );

  const result = run(fixture, "install.sh");
  assert.equal(result.status, 0, result.stderr);
  const alias = fs.readFileSync(
    path.join(
      fixture.home,
      ".local",
      "share",
      "applications",
      `${compatibilityDesktopId}.desktop`
    ),
    "utf8"
  );
  const entry = (key) => alias.split("\n").find((line) => line.startsWith(`${key}=`));
  const expectedRoot = path.join(
    fixture.home,
    ".local",
    "opt",
    "aaha",
    config.repoName
  );
  assert.equal(entry("Comment"), `Comment=${config.comment}`);
  assert.equal(entry("NoDisplay"), "NoDisplay=true");
  assert.equal(
    entry("Exec"),
    `Exec="${path.join(expectedRoot, "app", config.executable)}"`
  );
});

test("--purge removes only the configured profile", (t) => {
  const fixture = createFixture(t);
  const installRoot = path.join(fixture.home, "MyLocalApps", config.repoName);
  const profile = path.join(fixture.home, ".config", config.profileName);
  const unrelated = path.join(fixture.home, ".config", "Unrelated");
  fs.mkdirSync(profile, { recursive: true });
  fs.mkdirSync(unrelated, { recursive: true });
  assert.equal(run(fixture, "install.sh", ["--install-root", installRoot]).status, 0);
  const result = run(fixture, "uninstall.sh", ["--purge", "--install-root", installRoot]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(profile), false);
  assert.equal(fs.existsSync(unrelated), true);
});

test("unknown arguments fail before changing anything", (t) => {
  const fixture = createFixture(t);
  const marker = path.join(fixture.home, "marker");
  fs.writeFileSync(marker, "safe");
  const install = run(fixture, "install.sh", ["--unknown"]);
  const uninstall = run(fixture, "uninstall.sh", ["--destroy-everything"]);
  assert.equal(install.status, 2);
  assert.equal(uninstall.status, 2);
  assert.equal(fs.readFileSync(marker, "utf8"), "safe");
});

test("dangerous and malformed install roots are rejected", (t) => {
  const fixture = createFixture(t);
  const candidates = [
    "/",
    fixture.home,
    config.repoName,
    path.join(fixture.home, "MyLocalApps", "wrong-name"),
    `${fixture.home}/MyLocalApps/../${config.repoName}`
  ];
  for (const candidate of candidates) {
    const result = run(fixture, "install.sh", ["--install-root", candidate]);
    assert.equal(result.status, 2, `${candidate}: ${result.stderr}`);
  }
});

test("receipt mismatch refuses deletion", (t) => {
  const fixture = createFixture(t);
  const installRoot = path.join(fixture.home, "MyLocalApps", config.repoName);
  assert.equal(run(fixture, "install.sh", ["--install-root", installRoot]).status, 0);
  fs.writeFileSync(receiptPath(fixture), `${path.join(fixture.home, "Other", config.repoName)}\n`);
  const result = run(fixture, "uninstall.sh", ["--install-root", installRoot]);
  assert.equal(result.status, 1);
  assert.equal(fs.existsSync(installRoot), true);
});

test("missing or tampered marker refuses deletion", (t) => {
  const fixture = createFixture(t);
  const installRoot = path.join(fixture.home, "MyLocalApps", config.repoName);
  assert.equal(run(fixture, "install.sh", ["--install-root", installRoot]).status, 0);
  fs.writeFileSync(path.join(installRoot, ".aaha-install"), "tampered\n");
  const result = run(fixture, "uninstall.sh", ["--install-root", installRoot]);
  assert.equal(result.status, 1);
  assert.equal(fs.existsSync(installRoot), true);
});

test("unpacked helper substitutions cannot influence authenticated image installation", t => {
  const fixture = createFixture(t);
  const helper = path.join(fixture.repo, "dist/linux-unpacked/chrome-sandbox");
  const outside = path.join(fixture.root, "outside"); fs.writeFileSync(outside, "untouched"); fs.chmodSync(outside, 0o644);
  fs.rmSync(helper); fs.symlinkSync(outside, helper);
  const r = run(fixture, "install.sh"); assert.equal(r.status, 0, r.stderr);
  const dest = path.join(fixture.home, ".local/opt/aaha", config.repoName, "app");
  assert.equal(fs.readFileSync(path.join(dest, "payload.txt"), "utf8"), "authenticated fixture");
  assert.equal(fs.existsSync(path.join(dest, "chrome-sandbox")), false);
  assert.equal(fs.readFileSync(outside,"utf8"), "untouched");
  assert.equal(fs.statSync(outside).mode & 0o7777, 0o644);
  fs.symlinkSync(outside, path.join(dest, "chrome-sandbox"));
  const update = run(fixture, "install.sh"); assert.equal(update.status, 0, update.stderr);
  assert.equal(fs.existsSync(path.join(dest, "chrome-sandbox")), false);
});
test("bad checksums and multiple images fail before replacing an installed app", t => {
  const f = createFixture(t); assert.equal(run(f,"install.sh").status,0);
  const dest = path.join(f.home,".local/opt/aaha",config.repoName,"app/payload.txt");
  fs.appendFileSync(f.appImage,"tamper");
  assert.notEqual(run(f,"install.sh").status,0);
  assert.equal(fs.readFileSync(dest,"utf8"),"authenticated fixture");
  fs.copyFileSync(f.appImage,path.join(f.repo,"dist/extra.AppImage"));
  assert.notEqual(run(f,"install.sh").status,0);
  assert.equal(fs.readFileSync(dest,"utf8"),"authenticated fixture");
});

test("XDG migration, upgrades, preservation and purge share one profile root", t => {
  const f = createFixture(t); f.xdg = path.join(f.home, "configuration");
  const legacy = path.join(f.xdg, "Legacy Profile"); fs.mkdirSync(legacy, {recursive:true});
  fs.writeFileSync(path.join(legacy, "state"), "retain");
  fs.writeFileSync(path.join(f.repo,"app.config.js"), `module.exports=${JSON.stringify({...config,legacyProfileNames:["Legacy Profile"]})};`);
  assert.equal(run(f,"install.sh").status,0);
  const profile = path.join(f.xdg,config.profileName);
  assert.equal(fs.readFileSync(path.join(profile,"state"),"utf8"),"retain");
  assert.equal(run(f,"install.sh").status,0);
  assert.equal(run(f,"uninstall.sh").status,0);
  assert.ok(fs.existsSync(profile));
  assert.equal(run(f,"install.sh").status,0);
  assert.equal(run(f,"uninstall.sh",["--purge"]).status,0);
  assert.equal(fs.existsSync(profile),false); assert.ok(fs.existsSync(legacy));
});
test("dangling helpers and regular privileged-mode leftovers are discarded on upgrades", t => {
  const f=createFixture(t);const unused=path.join(f.repo,"dist/linux-unpacked/chrome-sandbox");
  fs.rmSync(unused);fs.symlinkSync(path.join(f.root,"missing"),unused);
  assert.equal(run(f,"install.sh").status,0);
  const helper=path.join(f.home,".local/opt/aaha",config.repoName,"app/chrome-sandbox");
  fs.writeFileSync(helper,"modified helper");fs.chmodSync(helper,0o4755);
  assert.equal(run(f,"install.sh").status,0); assert.equal(fs.existsSync(helper),false);
});
test("linked destination replacement and linked markers fail without touching external targets", t => {
  const f=createFixture(t); assert.equal(run(f,"install.sh").status,0);
  const root=path.join(f.home,".local/opt/aaha",config.repoName);const outside=path.join(f.root,"outside");fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside,"keep"),"untouched");
  fs.rmSync(path.join(root,"app"),{recursive:true});fs.symlinkSync(outside,path.join(root,"app"));
  assert.notEqual(run(f,"install.sh").status,0);assert.equal(fs.readFileSync(path.join(outside,"keep"),"utf8"),"untouched");
  const marker=path.join(root,".aaha-install");const copy=path.join(f.root,"marker");fs.renameSync(marker,copy);fs.symlinkSync(copy,marker);
  assert.notEqual(run(f,"uninstall.sh").status,0);assert.ok(fs.existsSync(path.join(outside,"keep")));
});
test("missing authentication and failed extraction leave the current app intact", t => {
  const f=createFixture(t); assert.equal(run(f,"install.sh").status,0);
  const dest=path.join(f.home,".local/opt/aaha",config.repoName,"app/payload.txt");
  const unsigned=spawnSync("bash",["install.sh"],{cwd:f.repo,encoding:"utf8",env:{...process.env,AAHA_HOME:f.home,AAHA_STATE_HOME:f.stateHome}});
  assert.notEqual(unsigned.status,0);assert.equal(fs.readFileSync(dest,"utf8"),"authenticated fixture");
  fs.writeFileSync(f.appImage,"#!/bin/sh\nexit 74\n");
  const hash=crypto.createHash("sha256").update(fs.readFileSync(f.appImage)).digest("hex");
  fs.writeFileSync(path.join(f.repo,"dist/SHA256SUMS"),`${hash}  ${path.basename(f.appImage)}\n`);
  assert.notEqual(run(f,"install.sh").status,0);assert.equal(fs.readFileSync(dest,"utf8"),"authenticated fixture");
});

test("stage path replacement fails reverification before installation changes", t => {
  const f=createFixture(t);assert.equal(run(f,"install.sh").status,0);
  const destination=path.join(f.home,".local/opt/aaha",config.repoName,"app/payload.txt");
  fs.writeFileSync(path.join(f.bin,"cp"),`#!/bin/bash
/usr/bin/cp "$@" || exit
last="\${!#}"
case "$last" in */.stage.*/*|*/.stage.*/)
  for image in "$last"/*.AppImage; do printf tampered >> "$image"; done;;
esac
`);fs.chmodSync(path.join(f.bin,"cp"),0o755);
  assert.notEqual(run(f,"install.sh").status,0);
  assert.equal(fs.readFileSync(destination,"utf8"),"authenticated fixture");
});

test("signed installation verifies a separately supplied key without source-side build artifacts",t => {
  const f=createFixture(t);fs.rmSync(path.join(f.repo,"build"),{recursive:true});const key=path.join(f.root,"private.key"),pub=path.join(f.root,"public.pub");
  let r=spawnSync("minisign",["-G","-W","-s",key,"-p",pub],{encoding:"utf8"});assert.equal(r.status,0,r.stderr);
  const info={app:config.repoName,version:require("../package.json").version,templateVersion:"3.0.0",repository:"https://github.com/example/fixture",sourceCommit:"a".repeat(40),tag:`v${require("../package.json").version}`,lockfileSha256:"b".repeat(64),tools:{node:process.version},electron:"44.7.0",architecture:"x64"};
  fs.writeFileSync(path.join(f.repo,"dist/BUILDINFO.json"),JSON.stringify(info));
  fs.writeFileSync(path.join(f.repo,"dist/SHA256SUMS"),[path.basename(f.appImage),"BUILDINFO.json"].map(n=>`${crypto.createHash("sha256").update(fs.readFileSync(path.join(f.repo,"dist",n))).digest("hex")}  ${n}\n`).join(""));
  r=spawnSync("minisign",["-Sm",path.join(f.repo,"dist/SHA256SUMS"),"-s",key],{encoding:"utf8"});assert.equal(r.status,0,r.stderr);
  for(let i=0;i<2;i++) {
    r=spawnSync("bash",["install.sh","--public-key",pub],{cwd:f.repo,encoding:"utf8",env:{...process.env,PATH:`${f.bin}:${process.env.PATH}`,AAHA_HOME:f.home,AAHA_STATE_HOME:f.stateHome,XDG_CONFIG_HOME:"",AAHA_SKIP_DESKTOP_REFRESH:"1"}});
    assert.equal(r.status,0,r.stderr);
  }
});
