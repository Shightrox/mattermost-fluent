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
const win=new BrowserWindow({width:1440,height:960,show:false,webPreferences:{session:ses,preload:path.resolve(process.env.FLUENT_PERF_PRELOAD || 'dist/externalAPI.js'),sandbox:true,contextIsolation:true,nodeIntegration:false,offscreen:true,backgroundThrottling:false}});
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
for(const enabled of [false,true,false,true]) {
 wc.send('fluent-settings-changed',{...settings,enabled});await pause(500);
 await evaluate("document.querySelector('#post_textbox').focus();document.querySelector('#post_textbox').select()");await wc.insertText('');
 const before=await metrics(),latencies=[];
 for(let i=0;i<40;i++) {
  const start=performance.now();
  wc.sendInputEvent({type:'char',keyCode:'a'});
  await evaluate('new Promise(resolve => requestAnimationFrame(() => resolve(true)))');
  latencies.push(performance.now()-start);
 }
 const after=await metrics();
 const points=await evaluate("Array.from(document.querySelectorAll('#channel_view .post__content > .post__img + div')).map(e=>{const r=e.getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round((Math.max(r.top,150)+Math.min(r.bottom,innerHeight-130))/2),visible:r.bottom>150&&r.top<innerHeight-130}}).filter(p=>p.visible).map(({x,y})=>({x,y})).slice(0,10)");
 assert.ok(points.length>2);
 const hoverStart=await metrics();
 for(let i=0;i<40;i++) {
  wc.sendInputEvent({type:'mouseMove',...points[i%points.length]});
  await evaluate('new Promise(resolve => requestAnimationFrame(() => resolve(true)))');
 }
 const hoverEnd=await metrics();
 assert.equal(await evaluate("document.querySelector('#post_textbox').value.length"),40);
 latencies.sort((a,b)=>a-b);
 result.push({enabled,hoverTaskMs:Math.round((hoverEnd.TaskDuration-hoverStart.TaskDuration)*1000),hoverStyleMs:Math.round((hoverEnd.RecalcStyleDuration-hoverStart.RecalcStyleDuration)*1000),medianMs:Math.round(latencies[20]),p95Ms:Math.round(latencies[38]),taskMs:Math.round((after.TaskDuration-before.TaskDuration)*1000),styleMs:Math.round((after.RecalcStyleDuration-before.RecalcStyleDuration)*1000),layoutMs:Math.round((after.LayoutDuration-before.LayoutDuration)*1000)});
}
await evaluate("document.querySelector('#post_textbox').select()");await wc.insertText('');
fs.writeFileSync('artifacts/fluent-input-performance.json',JSON.stringify({scenario:'40 Chromium char events and 40 chat pointer moves; renderer rAF acknowledgment, not physical display latency',result},null,2));
console.log(result);wc.debugger.detach();win.destroy();app.quit();})().catch(e=>{console.error(e);app.exit(1)});
