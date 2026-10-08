"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
test("release guards reject tag, commit, published-release and asset inconsistencies before signing/building", t => {
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"aaha-release-"));t.after(()=>fs.rmSync(temporary,{recursive:true,force:true}));
  const bin=path.join(temporary,"bin");fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin,"git"),'#!/bin/sh\nprintf "%s\\n" aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n');
  fs.writeFileSync(path.join(bin,"gh"),`#!/bin/sh
case "$*" in
  api*) if [ "$CASE" = moved ]; then echo bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb; else echo aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa; fi;;
  *isDraft*) if [ "$CASE" = published ]; then echo false; else echo true; fi;;
  *assets*) echo 1;;
  *) echo 'Unexpected release operation' >&2;exit 98;;
esac
`);
  fs.writeFileSync(path.join(bin,"npm"),'#!/bin/sh\necho unexpected-build >&2\nexit 99\n');
  for(const command of ["git","gh","npm"])fs.chmodSync(path.join(bin,command),0o755);
  const version=require("../package.json").version;
  for(const [scenario,tag,expected] of [["invalid","../../bad",/Invalid tag/],["mismatch","v999.0.0",/Package\/tag/],["moved",`v${version}`,/tag moved/],["published",`v${version}`,/cannot be replaced/],["assets",`v${version}`,/Existing assets/]]){
    const r=spawnSync("bash",["scripts/release.sh","template"],{cwd:path.resolve(__dirname,".."),encoding:"utf8",env:{...process.env,PATH:`${bin}:${process.env.PATH}`,TAG:tag,CASE:scenario,GITHUB_REPOSITORY:"example/fixture"}});
    assert.notEqual(r.status,0);assert.match(r.stderr,expected);assert.doesNotMatch(r.stderr,/unexpected-build/);
  }
});
