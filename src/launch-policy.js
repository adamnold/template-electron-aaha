"use strict";
const unsafe = new Set(["--no-sandbox", "--disable-sandbox", "--disable-namespace-sandbox", "--disable-seccomp-filter-sandbox", "--disable-gpu-sandbox", "--single-process", "--no-zygote", "--in-process-gpu"]);
function launchErrors(argv = process.argv, env = process.env, uid = process.getuid?.()) {
  const errors = [];
  if (uid === 0) errors.push("Run this per-user application without root privileges.");
  for (const key of ["ELECTRON_DISABLE_SANDBOX", "ELECTRON_RUN_AS_NODE"]) {
    if (Object.hasOwn(env, key)) errors.push(`Remove ${key}; effective sandboxing is required.`);
  }
  for (const arg of argv) {
    const option = arg.replace(/^-([^-])/, "--$1").split("=", 1)[0];
    if (unsafe.has(option)) errors.push(`Unsafe launch option: ${arg.split("=", 1)[0]}.`);
  }
  return errors;
}
module.exports = { launchErrors };
