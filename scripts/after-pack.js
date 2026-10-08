"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const { flipFuses, FuseVersion, FuseV1Options } = require("@electron/fuses");
module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== "linux") throw new Error("This template packages Linux applications only.");
  const name = context.packager.config.linux.executableName;
  const executable = path.join(context.appOutDir, name);
  if (!(await fs.lstat(executable)).isFile()) throw new Error("Native executable must be a regular file.");
  await flipFuses(executable, {
    version: FuseVersion.V1,
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.OnlyLoadAppFromAsar]: true
  });
  await fs.rename(executable, executable + ".bin");
  await fs.copyFile(path.join(__dirname, "launch.sh"), executable);
  await fs.chmod(executable, 0o755);
  const icons = path.join(context.appOutDir, "aaha-icons");
  await fs.mkdir(icons);
  for (const size of [16, 24, 32, 48, 64, 96, 128, 256, 512]) {
    const source = path.join(context.packager.projectDir, "build/icons", `${size}x${size}.png`);
    if (!(await fs.lstat(source)).isFile()) throw new Error("Icon must be a regular file.");
    await fs.copyFile(source, path.join(icons, `${size}x${size}.png`));
  }
  // rm unlinks a helper symlink rather than following its target.
  await fs.rm(path.join(context.appOutDir, "chrome-sandbox"), { force: true });
};
