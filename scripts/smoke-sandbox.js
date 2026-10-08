"use strict";
// Run only against a disposable generated fixture, never a real service/profile.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const [mode, target] = process.argv.slice(2);
if (!["development","installed","appimage"].includes(mode) || !target) throw Error("Usage: node scripts/smoke-sandbox.js development|installed|appimage /absolute/fixture-path");
const home = fs.mkdtempSync(path.join(os.tmpdir(), "aaha-live-sandbox-"));
const net = require("node:net");
let port;
let child; let logs="";
function delay(ms) { return new Promise(resolve => setTimeout(resolve,ms)); }
async function rpc(url,method) {
  return new Promise((resolve,reject) => {
    const socket=new WebSocket(url); const timer=setTimeout(()=>{socket.close();reject(Error("CDP timeout"));},5000);
    socket.onopen=()=>socket.send(JSON.stringify({id:1,method}));
    socket.onmessage=e=>{const value=JSON.parse(e.data);if(value.id===1){clearTimeout(timer);socket.close();value.error?reject(Error(value.error.message)):resolve(value.result);}};
    socket.onerror=()=>{clearTimeout(timer);reject(Error("CDP connection failure"));};
  });
}
async function main(){
  const reservation=net.createServer();
  await new Promise(resolve=>reservation.listen(0,"127.0.0.1",resolve));
  port=reservation.address().port;
  await new Promise(resolve=>reservation.close(resolve));
  const args=[`--remote-debugging-port=${port}`];
  const command=mode==="development"?"bash":target;
  const launchArgs=mode==="development"?[path.join(target,"scripts/launch.sh"),...args]:args;
  child=spawn(command,launchArgs,{env:{...process.env,AAHA_HOME:home,XDG_CONFIG_HOME:path.join(home,"config"),XDG_CACHE_HOME:path.join(home,"cache"),APPIMAGE_EXTRACT_AND_RUN:mode==="appimage"?"1":"",electron_config_cache:process.env.electron_config_cache},detached:true,stdio:["ignore","pipe","pipe"]});
  child.stdout.on("data",b=>logs+=b);child.stderr.on("data",b=>logs+=b);
  let endpoint;
  for(let i=0;i<100;i++){
    if(child.exitCode!==null)throw Error(`Launch exited ${child.exitCode}: ${logs}`);
    try{endpoint=await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();break;}catch{await delay(100);}
  }
  if(!endpoint)throw Error(`No browser endpoint: ${logs}`);
  await delay(1000);
  const info=await rpc(endpoint.webSocketDebuggerUrl,"SystemInfo.getProcessInfo");
  const browser=info.processInfo.find(p=>p.type==="browser");
  let parent=browser?.id;let owned=false;
  for(let i=0;parent && i<20;i++){
    if(parent===child.pid){owned=true;break;}
    const status=fs.readFileSync(`/proc/${parent}/status`,"utf8");
    parent=Number(/^PPid:\s+(\d+)/m.exec(status)?.[1]);
  }
  if(!owned)throw Error("CDP endpoint does not belong to this fixture launch");
  function fields(pid) {
    const status=fs.readFileSync(`/proc/${pid}/status`,"utf8");
    return Object.fromEntries(status.split("\n").filter(l=>/^(NSpid|Seccomp|Seccomp_filters|NoNewPrivs|Uid):/.test(l)).map(l=>{const [k,v]=l.split(":");return[k,v.trim()];}));
  }
  const baseline=fields(browser.id);
  const renderers=info.processInfo.filter(p=>p.type==="renderer");if(!renderers.length)throw Error("No renderer to verify");
  const evidence=[];
  for(const renderer of renderers){
    const entries=fields(renderer.id);
    if(entries.Seccomp!=="2" || entries.NoNewPrivs!=="1" || entries.NSpid.split(/\s+/).length<=baseline.NSpid.split(/\s+/).length || Number(entries.Seccomp_filters)<=Number(baseline.Seccomp_filters))throw Error(`Ineffective renderer sandbox relative to browser: ${JSON.stringify({baseline,entries})}`);
    evidence.push({pid:renderer.id,...entries});
  }
  console.log(JSON.stringify({mode,result:"PASS",browserBaseline:baseline,rendererEvidence:evidence}));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(async()=>{
  if(child){
    try { process.kill(-child.pid,"SIGTERM"); } catch(error) { if(error.code!=="ESRCH")throw error; }
    await delay(500);
    try { process.kill(-child.pid,"SIGKILL"); } catch(error) { if(error.code!=="ESRCH")throw error; }
  }
  fs.rmSync(home,{recursive:true,force:true});
});
