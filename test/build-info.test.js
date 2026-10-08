"use strict";
const test=require("node:test");const assert=require("node:assert/strict");
const fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {signerVersion}=require("../scripts/build-info.js");
test("unsigned build metadata records an unavailable signer without requiring it",t=>{
  const empty=fs.mkdtempSync(path.join(os.tmpdir(),"aaha-no-signer-"));t.after(()=>fs.rmSync(empty,{recursive:true,force:true}));
  assert.equal(signerVersion({...process.env,PATH:empty}),null);
});
test("metadata records an installed signer and surfaces broken signer execution",t=>{
  const bin=fs.mkdtempSync(path.join(os.tmpdir(),"aaha-signer-version-"));t.after(()=>fs.rmSync(bin,{recursive:true,force:true}));
  const signer=path.join(bin,"minisign");fs.writeFileSync(signer,"#!/bin/sh\necho 'minisign fixture-version'\n");fs.chmodSync(signer,0o755);
  assert.equal(signerVersion({...process.env,PATH:bin}),"minisign fixture-version");
  fs.writeFileSync(signer,"#!/bin/sh\nexit 72\n");assert.throws(()=>signerVersion({...process.env,PATH:bin}),/minisign/i);
});
