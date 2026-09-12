// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Real local webapp + production preload. No debug port or working accounts.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
if(!process.versions.electron){const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;const r=require('child_process').spawnSync(require('electron'),[__filename],{env,stdio:'inherit',windowsHide:true});process.exit(r.status??1);}
const {app,BrowserWindow,ipcMain,session}=require('electron');
app.setPath('userData',path.join(app.getPath('temp'),'mattermost-fluent-lab-harness'));
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const unavailableCaptures=[];
(async()=>{const lab=JSON.parse(fs.readFileSync('artifacts/fluent-lab-session.json','utf8'));assert.equal(lab.origin,'http://localhost:18065');await app.whenReady();
for(const [name,value] of Object.entries({'get-app-info':{name:'Mattermost Fluent',version:'6.3.0'},'get-is-dev-mode':false,'get-dark-mode':true,'can-popout':false,'can-use-popout-option':false,'request-browser-history-status':{canGoBack:false,canGoForward:false},'notify_mention':undefined}))ipcMain.handle(name,()=>value);
const ses=session.fromPartition('fluent-lab');
for(const [name,value] of [['MMAUTHTOKEN',lab.token],['MMUSERID',lab.userId]])await ses.cookies.set({url:lab.origin,name,value,httpOnly:name==='MMAUTHTOKEN',sameSite:'lax'});
const win=new BrowserWindow({width:1440,height:960,show:false,webPreferences:{session:ses,preload:path.resolve(process.env.FLUENT_PERF_PRELOAD||'dist/externalAPI.js'),sandbox:true,contextIsolation:true,nodeIntegration:false,offscreen:true,backgroundThrottling:false}});
const wc=win.webContents;wc.setUserAgent(wc.getUserAgent()+' Mattermost/6.3.0');const evaluate=s=>wc.executeJavaScript(s);const settings={enabled:true,motion:true,material:'solid',theme:'dark',accent:'blue',textSize:'standard',compactHeader:true,serverURL:lab.origin};
// The desktop webapp sends routes to main, which returns them to its router.
// Keep this loop local to the fixture window and its synthetic team.
ipcMain.on('browser-history-push',(event,route)=>{if(event.sender===wc&&typeof route==='string'&&route.startsWith('/'+lab.team+'/'))wc.send('browser-history-push',route);});
wc.on('did-finish-load',()=>wc.send('fluent-settings-changed',settings));
await win.loadURL(lab.origin+'/'+lab.team+'/channels/'+lab.channelName);
const wait=async(s)=>{const end=Date.now()+20000;while(!await evaluate(s)){if(Date.now()>end){fs.writeFileSync('artifacts/fluent-lab-timeout.png',(await wc.capturePage()).toPNG());console.log(await evaluate("({path:location.pathname,text:document.body.innerText.slice(0,1800)})"));throw Error('Timed out: '+s);}await pause(100);}};
await wait("Boolean(document.querySelector('#post_textbox'))");await pause(700);
await evaluate("Array.from(document.querySelectorAll('*')).find(e=>!e.childElementCount&&e.textContent.trim().startsWith('No thanks'))?.click()");await pause(200);
await evaluate("document.querySelector('#post_textbox').focus();document.querySelector('#post_textbox').select()");await wc.insertText('');
assert.equal(await evaluate("document.querySelector('#post_textbox').value"),'','reset only the lab draft before testing');
console.log('Local webapp ready',await evaluate("({fluent:document.documentElement.hasAttribute('data-mm-fluent'),editor:!!document.querySelector('#post_textbox'),sidebar:!!document.querySelector('#SidebarContainer')})"));

wc.debugger.attach('1.3');await wc.debugger.sendCommand('Performance.enable');
const metrics=async()=>Object.fromEntries((await wc.debugger.sendCommand('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
const result=[];
for(const enabled of [false,true,false,true]){
 wc.send('fluent-settings-changed',{...settings,enabled});await pause(600);
 const e=await evaluate("(()=>{const e=document.getElementById('postListScrollContainer');e.scrollTop=e.scrollHeight-e.clientHeight-150;const r=e.getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()");await pause(350);
 const idleStart=await metrics();await pause(2000);const before=await metrics();
 await evaluate(`window.scrollSample={intervals:[],positions:[],running:true};(()=>{let last=performance.now();const sample=t=>{const s=window.scrollSample;if(!s.running)return;s.intervals.push(t-last);s.positions.push(document.getElementById('postListScrollContainer').scrollTop);last=t;requestAnimationFrame(sample)};requestAnimationFrame(sample)})()`);
 for(let i=0;i<20;i++){await wc.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mouseWheel',x:e.x,y:e.y,deltaX:0,deltaY:i<10?-80:80});await pause(50);}
 await pause(600);const after=await metrics();
 const frames=await evaluate(`(()=>{const s=window.scrollSample;s.running=false;const intervals=s.intervals.slice(1).sort((a,b)=>a-b);return {p95:intervals[Math.floor(intervals.length*.95)],max:Math.max(...intervals),over25ms:intervals.filter(t=>t>25).length,travel:Math.max(...s.positions)-Math.min(...s.positions)}})()`);
 const delta=(a,b,name)=>Math.round((b[name]-a[name])*1000)/1000;
 result.push({enabled,frames,idleTaskSeconds:delta(idleStart,before,'TaskDuration'),activeTaskSeconds:delta(before,after,'TaskDuration'),layoutSeconds:delta(before,after,'LayoutDuration'),styleSeconds:delta(before,after,'RecalcStyleDuration'),heapMB:Math.round(after.JSHeapUsedSize/1024/1024),nodes:after.Nodes});
}
fs.writeFileSync(process.env.FLUENT_PERF_OUTPUT||'artifacts/fluent-v27-performance.json',JSON.stringify({environment:{electron:process.versions.electron,chrome:process.versions.chrome,os:require('os').release(),arch:process.arch,offscreen:true},scenario:'20 Chromium wheel inputs, two seconds idle, same local channel; not a display FPS benchmark',result},null,2));console.log(result);wc.debugger.detach();win.destroy();app.quit();})().catch(e=>{console.error(e);app.exit(1)});
