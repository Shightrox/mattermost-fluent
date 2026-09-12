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

async function capture(name){await pause(450);assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth+1"),true,name+' fits');fs.writeFileSync('artifacts/fluent-v16-'+name+'.png',(await wc.capturePage()).toPNG());}
for(const theme of ['dark','light']){
 wc.send('fluent-settings-changed',{...settings,theme});await pause(200);
 await evaluate("document.querySelector('#channel-info-btn').click()");await wait("Boolean(document.querySelector('#channelInfoRHSChannelSettings'))");await capture('info-'+theme);
 await evaluate("document.querySelector('#rhsCloseButton').click();document.querySelector('#global-header .icon-settings-outline').closest('button').click()");await wait("Boolean(document.querySelector('.UserSettingsModal'))");await capture('settings-'+theme);
 assert.equal(await evaluate("getComputedStyle(document.querySelector('.UserSettingsModal .section-min__title')).fontFamily.includes('Segoe UI')"),true,'settings typography');
 await evaluate("document.querySelector('.UserSettingsModal .close').click()");await wait("!document.querySelector('.UserSettingsModal')");
 await evaluate("document.querySelector('#userAccountMenuButton').click()");await pause(200);await capture('account-'+theme);wc.sendInputEvent({type:'keyDown',keyCode:'Escape'});wc.sendInputEvent({type:'keyUp',keyCode:'Escape'});await pause(150);
}
await evaluate("Array.from(document.querySelectorAll('[data-testid=postView] .post__header .user-popover')).find(e=>e.getBoundingClientRect().top>100&&e.getBoundingClientRect().bottom<innerHeight).click()");await wait("Boolean(document.querySelector('.user-profile-popover'))");await capture('profile');
const profile=await evaluate("(()=>{const p=document.querySelector('.user-profile-popover').getBoundingClientRect();return {fits:p.left>=0&&p.right<=innerWidth&&p.top>=0&&p.bottom<=innerHeight,actions:document.querySelectorAll('.user-profile-popover-bottom-row button').length}})()");assert.ok(profile.fits&&profile.actions>0,'profile and native actions fit');
const auth=new BrowserWindow({width:1000,height:850,show:false,webPreferences:{partition:'fluent-auth-fixture',preload:path.resolve('dist/externalAPI.js'),sandbox:true,contextIsolation:true,nodeIntegration:false,offscreen:true,backgroundThrottling:false}});
auth.webContents.on('did-finish-load',()=>auth.webContents.send('fluent-settings-changed',settings));auth.webContents.setUserAgent(wc.getUserAgent());await auth.loadURL(lab.origin+'/login');await pause(1800);console.log(await auth.webContents.executeJavaScript("({path:location.pathname,text:document.body.innerText.slice(0,700),classes:document.body.className})"));
fs.writeFileSync('artifacts/auth-dom.html',await auth.webContents.executeJavaScript('document.body.innerHTML'));
for(const theme of ['dark','light']){auth.webContents.send('fluent-settings-changed',{...settings,theme});await pause(200);assert.equal(await auth.webContents.executeJavaScript("document.documentElement.getAttribute('data-mm-fluent-surface')"),'auth');fs.writeFileSync('artifacts/fluent-v16-login-'+theme+'.png',(await auth.webContents.capturePage()).toPNG());}
auth.destroy();win.destroy();console.log('PASS core surfaces and login, light/dark');app.quit();})().catch(e=>{console.error(e);app.exit(1)});
