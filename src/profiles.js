"use strict";
const path = require("node:path");
const os = require("node:os");
function profileRoot(env = process.env) {
  const home = env.AAHA_HOME || env.HOME || os.homedir();
  if (!path.isAbsolute(home)) throw new Error("AAHA_HOME must be an absolute path.");
  return env.XDG_CONFIG_HOME && path.isAbsolute(env.XDG_CONFIG_HOME) ? path.normalize(env.XDG_CONFIG_HOME) : path.join(home, ".config");
}
module.exports = { profileRoot };
