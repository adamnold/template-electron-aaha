"use strict";
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");
function check(command, args) {
  const r = spawnSync(command, args, { stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status || 1);
}
for (const directory of ["src", "scripts", "test"]) {
  for (const name of fs.readdirSync(directory).filter(n => n.endsWith(".js"))) check(process.execPath, ["--check", `${directory}/${name}`]);
}
check(process.execPath, ["--check", "app.config.js"]);
for (const file of ["build.sh", "install.sh", "uninstall.sh", "new-app.sh", ...fs.readdirSync("scripts").filter(n => n.endsWith(".sh")).map(n => `scripts/${n}`)]) check("bash", ["-n", file]);
check(process.execPath, ["scripts/validate-config.js", ...process.argv.slice(2)]);
