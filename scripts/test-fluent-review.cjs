// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Real local webapp + production preload. No debug port or working accounts.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
if(!process.versions.electron){const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;const r=require('child_process').spawnSync(require('electron'),[__filename],{env,stdio:'inherit',windowsHide:true});process.exit(r.status??1);}
const {app,BrowserWindow,ipcMain,session}=require('electron');
app.setPath('userData',path.join(app.getPath('temp'),'mattermost-fluent-lab-harness'));
const pause=ms=>new Promise(r=>setTimeout(r,ms));
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


async function capture(name){await pause(450);fs.writeFileSync('artifacts/fluent-v17-'+name+'.png',(await wc.capturePage()).toPNG());}
async function escape(){wc.sendInputEvent({type:'keyDown',keyCode:'Escape'});wc.sendInputEvent({type:'keyUp',keyCode:'Escape'});await pause(250);}
for (const theme of ['dark','light']) {
 wc.send('fluent-settings-changed',{...settings,theme});await pause(200);
 const headerCenters=await evaluate("['member_rhs','channelHeaderFilesButton','channel-info-btn'].map(id=>{const r=document.getElementById(id).querySelector('i').getBoundingClientRect();return r.y+r.height/2})");
 assert.ok(Math.max(...headerCenters)-Math.min(...headerCenters)<1,'header glyphs share one vertical center');
 const unreadColors=await evaluate("(()=>{const e=document.querySelector('#unreadIndicatorBottom');return {text:getComputedStyle(e).color,arrow:getComputedStyle(e.querySelector('path')).fill}})()");
 assert.equal(unreadColors.arrow,unreadColors.text,'unread arrow uses the readable label color');
 await evaluate("document.querySelector('#SidebarChannelNavigatorButton').click()");await wait("Boolean(document.querySelector('#quickSwitchInput'))");await capture('quick-switch-'+theme);
 assert.equal(await evaluate("(()=>{const e=document.querySelector('#quickSwitchModal .suggestion-list');return e.scrollWidth<=e.clientWidth+1})()"),true,'quick switch has no accidental horizontal scroll');
 await escape();assert.equal(await evaluate("Boolean(document.querySelector('#quickSwitchInput'))"),false,'Escape dismisses quick switch');
 await evaluate("document.querySelector('#newDirectMessageButton').click()");await wait("Boolean(document.querySelector('#moreDmModal'))");await capture('direct-message-'+theme);await escape();
 await evaluate("document.querySelector('.SidebarChannelGroupHeader .SidebarMenu_menuButton').click()");await wait("Boolean(document.querySelector('.menu_menuStyled [role=menu]'))");await capture('category-menu-'+theme);
 wc.sendInputEvent({type:'keyDown',keyCode:'Down'});wc.sendInputEvent({type:'keyUp',keyCode:'Down'});await pause(100);
 assert.equal(await evaluate("Boolean(document.activeElement.closest('[role=menu]'))"),true,'native menu keyboard focus stays in menu');await escape();
 await evaluate("document.querySelector('#emojiPickerButton').click()");await wait("Boolean(document.querySelector('#emojiGifPicker'))");await capture('emoji-'+theme);
 await evaluate("document.querySelector('#emojiGifPicker .emoji-picker__item').click()");await pause(200);
 assert.ok(await evaluate("document.querySelector('#post_textbox').value.length>0"),'native emoji action inserts into the local draft');
 await evaluate("document.querySelector('#post_textbox').focus();document.querySelector('#post_textbox').select()");await wc.insertText('');
 await evaluate("document.querySelector('#member_rhs').click()");await wait("Boolean(document.querySelector('.channel-members-rhs'))");await capture('members-'+theme);await evaluate("document.querySelector('#rhsCloseButton').click()");
}
win.setSize(840,680);await pause(400);await capture('chat-narrow');
await evaluate("document.querySelector('#emojiPickerButton').click()");await wait("Boolean(document.querySelector('#emojiGifPicker'))");await capture('emoji-narrow');
assert.ok(await evaluate("(()=>{const r=document.querySelector('#emojiGifPicker').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1})()"),'picker fits narrow viewport');await escape();
assert.equal(await evaluate("document.querySelector('#post_textbox').value"),'','review left no local draft');
win.destroy();console.log('PASS extended visual review: dialogs, menu keyboard, emoji input, responsive picker');app.quit();})().catch(e=>{console.error(e);app.exit(1)});
