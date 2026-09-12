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
const win=new BrowserWindow({width:1440,height:960,show:false,webPreferences:{session:ses,preload:path.resolve('dist/externalAPI.js'),sandbox:true,contextIsolation:true,nodeIntegration:false,offscreen:true,backgroundThrottling:false}});
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



await evaluate(`(()=>{const original=document.querySelector('.Separator');const clone=original.cloneNode(true);clone.id='fluent-separator-review';clone.style.cssText='position:fixed;left:400px;top:180px;width:300px;z-index:2000';clone.querySelector('span').textContent='New messages';document.querySelector('#channel_view').append(clone)})()`);
for (const theme of ['dark','light']) {
 wc.send('fluent-settings-changed',{...settings,theme});await pause(400);
 const geometry=await evaluate(`(()=>{const button=document.querySelector('.SidebarFilters_filterButton'),icon=button.querySelector('.icon'),label=document.querySelector('#fluent-separator-review .separator__text'),span=label.querySelector('span');const b=button.getBoundingClientRect(),i=icon.getBoundingClientRect(),l=label.getBoundingClientRect(),s=span.getBoundingClientRect();return {centerX:Math.abs((b.left+b.right-i.left-i.right)/2),centerY:Math.abs((b.top+b.bottom-i.top-i.bottom)/2),iconWidth:i.width,buttonWidth:b.width,innerBackground:getComputedStyle(span).backgroundColor,innerBorder:getComputedStyle(span).borderWidth,labelFits:s.top>=l.top&&s.bottom<=l.bottom&&s.left>=l.left&&s.right<=l.right}})()`);
 assert.ok(geometry.centerX<1 && geometry.centerY<1 && geometry.iconWidth===20 && geometry.buttonWidth===32,JSON.stringify(geometry));
 assert.ok(geometry.innerBackground==='rgba(0, 0, 0, 0)' && geometry.innerBorder==='0px' && geometry.labelFits,JSON.stringify(geometry));
 const rect=await evaluate(`(()=>{const r=document.querySelector('#fluent-separator-review').getBoundingClientRect();return {x:Math.floor(r.x),y:Math.floor(r.y),width:Math.ceil(r.width),height:60}})()`);
 fs.writeFileSync('artifacts/fluent-v23-separator-'+theme+'.png',(await wc.capturePage(rect)).toPNG());
 console.log('PASS',theme,geometry);
}
win.destroy();app.quit();})().catch(e=>{console.error(e);app.exit(1)});
