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
await win.loadURL(lab.origin+'/'+lab.team+'/channels/'+'conversation-preview');
const wait=async(s)=>{const end=Date.now()+20000;while(!await evaluate(s)){if(Date.now()>end){fs.writeFileSync('artifacts/fluent-lab-timeout.png',(await wc.capturePage()).toPNG());console.log(await evaluate("({path:location.pathname,text:document.body.innerText.slice(0,1800)})"));throw Error('Timed out: '+s);}await pause(100);}};
await wait("Boolean(document.querySelector('#post_textbox'))");await pause(700);
await evaluate("Array.from(document.querySelectorAll('*')).find(e=>!e.childElementCount&&e.textContent.trim().startsWith('No thanks'))?.click()");await pause(200);
await evaluate("document.querySelector('#post_textbox').focus();document.querySelector('#post_textbox').select()");await wc.insertText('');
assert.equal(await evaluate("document.querySelector('#post_textbox').value"),'','reset only the lab draft before testing');
console.log('Local webapp ready',await evaluate("({fluent:document.documentElement.hasAttribute('data-mm-fluent'),editor:!!document.querySelector('#post_textbox'),sidebar:!!document.querySelector('#SidebarContainer')})"));

await wait("Boolean(document.querySelector('.FluentPersonal')) && Boolean(document.querySelector('.FluentFocus'))");
const personalKey='fluent.personal.v1:'+lab.origin;
const original=await evaluate(`localStorage.getItem(${JSON.stringify(personalKey)})`);
await evaluate("document.querySelector('.FluentPersonal button[aria-label=\"Manage collections\"]').click(); document.querySelector('.FluentPersonal form input').value='Review space'; document.querySelector('.FluentPersonal form').requestSubmit()");
await pause(150);
await evaluate("document.querySelector('.FluentPersonal button[aria-label=\"Pin current conversation\"]').click()");
assert.ok(await evaluate("document.querySelector('.FluentPersonal nav a').textContent.length>0"));
await evaluate("document.querySelector('.FluentPersonal button[aria-label=\"Manage collections\"]').click(); const s=document.querySelector('.FluentPersonal details select');s.value='violet';s.dispatchEvent(new Event('change'));const r=document.querySelector('.FluentPersonal input[type=range]');r.value=45;r.dispatchEvent(new Event('input'));r.dispatchEvent(new Event('change'))");
assert.equal(await evaluate("document.documentElement.dataset.mmFluentAccent"),'violet');
await evaluate("document.querySelector('.FluentPersonal input[type=checkbox]').click()");
assert.equal(await evaluate("Math.round(Array.from(document.querySelectorAll('.SidebarChannel .SidebarLink')).find(e=>e.getBoundingClientRect().height>0).getBoundingClientRect().height)"),30);
await evaluate("document.querySelector('.FluentPersonal input[type=checkbox]').click();document.querySelector('.FluentPersonal button[aria-label=\"Manage collections\"]').click()");
await evaluate("document.querySelector('#post_textbox').focus()");await wc.insertText('Focus draft');
for(const width of [1440,900]) {
 win.setSize(width,960);await pause(350);
 for(const theme of ['dark','light']) {
  wc.send('fluent-settings-changed',{...settings,theme});await pause(250);
  for(const focus of [true,false]) {
   await evaluate("document.querySelector('.FluentFocus').click()");await pause(350);
   const result=await evaluate(`(()=>{const h=document.querySelector('#channel-header').getBoundingClientRect();const b=document.querySelector('.FluentFocus').getBoundingClientRect();const c=document.querySelector('#channel_view').getBoundingClientRect();return {focus:document.documentElement.hasAttribute('data-fluent-focus'),sidebar:getComputedStyle(document.querySelector('#SidebarContainer')).display,headerButtonFits:b.top>=h.top&&b.bottom<=h.bottom,chatLeft:c.left,overflow:document.documentElement.scrollWidth>innerWidth+1,draft:document.querySelector('#post_textbox').value}})()`);
   assert.equal(result.focus,focus);assert.ok(result.headerButtonFits&&!result.overflow,JSON.stringify(result));assert.equal(result.draft,'Focus draft');
   if(focus) {assert.equal(result.sidebar,'none');assert.ok(result.chatLeft<5,JSON.stringify(result));}
   fs.writeFileSync(`artifacts/fluent-v25-${width}-${theme}-${focus?'focus':'normal'}.png`,(await wc.capturePage()).toPNG());
  }
 }
}
console.log('PASS focus geometry, header, draft, themes, 1440/900');
win.setSize(1440,960);await pause(350);
await evaluate("document.querySelector('.FluentFocus').click();document.querySelector('#channel-info-btn').click()");
await wait("Boolean(document.querySelector('.FluentContext'))");await pause(400);
const split=await evaluate(`(()=>{const r=document.querySelector('#sidebar-right').getBoundingClientRect();const c=document.querySelector('#channel_view').getBoundingClientRect();return {right:r.right,width:r.width,chatRight:c.right,left:r.left,viewport:innerWidth}})()`);
assert.ok(split.width>500&&split.left>=split.chatRight-1&&split.right<=split.viewport+1,JSON.stringify(split));
fs.writeFileSync('artifacts/fluent-v25-focus-context.png',(await wc.capturePage()).toPNG());
await evaluate("document.querySelector('#rhsCloseButton').click()");await pause(250);
await evaluate("document.querySelector('.FluentFocus').click()");
console.log('PASS focus context splits available width',split);

// Ensure styles survive the controller reapplying global defaults.
assert.equal(await evaluate("document.documentElement.dataset.mmFluentAccent"),'violet');
await evaluate("document.querySelector('#post_textbox').focus();document.querySelector('#post_textbox').select()");await wc.insertText('');
await new Promise(resolve=>{wc.once('did-finish-load',resolve);wc.reload();});await wait("Boolean(document.querySelector('.FluentPersonal nav a'))");
assert.equal(await evaluate("document.querySelector('.FluentPersonal > div select').selectedOptions[0].textContent"),'Review space');
assert.equal(await evaluate("document.documentElement.dataset.mmFluentAccent"),'violet');
console.log('PASS collection persistence, pin, appearance override');
if(original===null) await evaluate(`localStorage.removeItem(${JSON.stringify(personalKey)})`);else await evaluate(`localStorage.setItem(${JSON.stringify(personalKey)},${JSON.stringify(original)})`);
wc.send('fluent-settings-changed',{...settings,enabled:false});await pause(200);
assert.equal(await evaluate("document.querySelectorAll('.FluentPersonal,.FluentFocus').length"),0);
console.log('PASS cleanup');
win.destroy();app.quit();})().catch(e=>{console.error(e);app.exit(1)});
