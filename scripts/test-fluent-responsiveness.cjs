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
const win=new BrowserWindow({width:1440,height:960,show:true,webPreferences:{session:ses,preload:path.resolve(process.env.FLUENT_PERF_PRELOAD || 'dist/externalAPI.js'),sandbox:true,contextIsolation:true,nodeIntegration:false,offscreen:false,backgroundThrottling:true}});
const wc=win.webContents;wc.setUserAgent(wc.getUserAgent()+' Mattermost/6.3.0');const evaluate=s=>wc.executeJavaScript(s);const settings={enabled:true,motion:true,material:'solid',theme:'dark',accent:'blue',textSize:'standard',compactHeader:true,serverURL:lab.origin};
// The desktop webapp sends routes to main, which returns them to its router.
// Keep this loop local to the fixture window and its synthetic team.
ipcMain.on('browser-history-push',(event,route)=>{if(event.sender===wc&&typeof route==='string'&&route.startsWith('/'+lab.team+'/'))wc.send('browser-history-push',route);});
wc.on('did-finish-load',()=>wc.send('fluent-settings-changed',settings));
win.setAlwaysOnTop(true);await win.loadURL(lab.origin+'/'+lab.team+'/channels/'+lab.channelName);win.show();win.focus();wc.focus();
const wait=async(s)=>{const end=Date.now()+20000;while(!await evaluate(s)){if(Date.now()>end){console.log(await evaluate("({path:location.pathname,text:document.body.innerText.slice(0,1800)})"));throw Error('Timed out: '+s);}await pause(100);}};
await wait("Boolean(document.querySelector('#post_textbox'))");await pause(700);
await evaluate("Array.from(document.querySelectorAll('*')).find(e=>!e.childElementCount&&e.textContent.trim().startsWith('No thanks'))?.click()");await pause(200);
await evaluate("document.querySelector('#post_textbox').focus();document.querySelector('#post_textbox').select()");await wc.insertText('');
assert.equal(await evaluate("document.querySelector('#post_textbox').value"),'','reset only the lab draft before testing');
console.log('Local webapp ready',await evaluate("({fluent:document.documentElement.hasAttribute('data-mm-fluent'),editor:!!document.querySelector('#post_textbox'),sidebar:!!document.querySelector('#SidebarContainer')})"));

wc.debugger.attach('1.3');await wc.debugger.sendCommand('Performance.enable');
const metrics=async()=>Object.fromEntries((await wc.debugger.sendCommand('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
wc.send('fluent-settings-changed',settings);await wait("document.documentElement.hasAttribute('data-mm-fluent')");
const paths=await evaluate("Array.from(new Set(Array.from(document.querySelectorAll('.SidebarChannel .SidebarLink[href]')).map(e=>new URL(e.href).pathname))).filter(p=>p.includes('/channels/')).slice(0,2)");
assert.equal(paths.length,2,'two local fixture channels');
const timings=[];
for(let i=0;i<6;i++){
 const destination=paths[i%2];
 const point=await evaluate(`(()=>{const a=Array.from(document.querySelectorAll('.SidebarChannel .SidebarLink[href]')).find(e=>new URL(e.href).pathname===${JSON.stringify(destination)});a.scrollIntoView({block:'center'});const r=a.getBoundingClientRect();return {x:Math.round(r.left+50),y:Math.round(r.top+r.height/2)}})()`);
 const start=performance.now();
 wc.sendInputEvent({type:'mouseMove',...point});wc.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...point});wc.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...point});
 await wait(`location.pathname===${JSON.stringify(destination)}&&Boolean(document.querySelector('#post_textbox'))`);
 await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))');
 timings.push(Math.round(performance.now()-start));
 const expected='Unsent synthetic draft '+(i%2);
 if(i>=2)assert.equal(await evaluate("document.querySelector('#post_textbox').value"),expected,'draft retained across channel switches');
 else {await evaluate("document.querySelector('#post_textbox').focus();document.querySelector('#post_textbox').select()");await wc.insertText(expected);}
}
console.log('Switches complete',timings);const before=await metrics();win.hide();await wait('document.hidden');await pause(1000);const after=await metrics();
win.show();win.focus();wc.focus();await wait('!document.hidden');await pause(250);
assert.equal(await evaluate("document.documentElement.hasAttribute('data-mm-fluent')"),true,'appearance resumes');
assert.equal(await evaluate("document.querySelector('#post_textbox').value"),'Unsent synthetic draft 1','background preserves draft');
assert.equal(await evaluate("document.querySelectorAll('[data-fluent-liquid]').length<=1"),true,'one reusable liquid surface');
console.log({switchMs:timings,hiddenTaskMs:Math.round((after.TaskDuration-before.TaskDuration)*1000)});
fs.writeFileSync(process.env.FLUENT_PERF_OUTPUT||'artifacts/fluent-responsiveness.json',JSON.stringify({switchMs:timings,hiddenTaskMs:Math.round((after.TaskDuration-before.TaskDuration)*1000)},null,2));
win.destroy();app.quit();})().catch(e=>{console.error(e);app.exit(1)});
