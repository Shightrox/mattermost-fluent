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
let searchedTerms='';ses.webRequest.onBeforeRequest({urls:[lab.origin+'/api/v4/teams/*/posts/search']},(details,callback)=>{try{searchedTerms=JSON.parse(Buffer.concat(details.uploadData.map(x=>x.bytes)).toString()).terms;}catch{}callback({});});wc.on('did-finish-load',()=>wc.send('fluent-settings-changed',settings));
await win.loadURL(lab.origin+'/'+lab.team+'/channels/'+lab.channelName);
const wait=async(s)=>{const end=Date.now()+20000;while(!await evaluate(s)){if(Date.now()>end){fs.writeFileSync('artifacts/fluent-lab-timeout.png',(await wc.capturePage()).toPNG());console.log(await evaluate("({path:location.pathname,text:document.body.innerText.slice(0,1800)})"));throw Error('Timed out: '+s);}await pause(100);}};
await wait("Boolean(document.querySelector('#post_textbox'))");await pause(700);
await evaluate("Array.from(document.querySelectorAll('*')).find(e=>!e.childElementCount&&e.textContent.trim().startsWith('No thanks'))?.click()");await pause(200);
await evaluate("document.querySelector('#post_textbox').focus();document.querySelector('#post_textbox').select()");await wc.insertText('');
assert.equal(await evaluate("document.querySelector('#post_textbox').value"),'','reset only the lab draft before testing');
console.log('Local webapp ready',await evaluate("({fluent:document.documentElement.hasAttribute('data-mm-fluent'),editor:!!document.querySelector('#post_textbox'),sidebar:!!document.querySelector('#SidebarContainer')})"));
await evaluate("document.querySelector('#searchFormContainer').click()");await pause(400);await evaluate("document.querySelector('input[role=searchbox]').focus()");await wc.insertText('Fluent');wc.sendInputEvent({type:'keyDown',keyCode:'Return'});wc.sendInputEvent({type:'keyUp',keyCode:'Return'});await pause(800);await wait("Boolean(document.querySelector('.FluentSearch'))");await evaluate("document.querySelector('.FluentSearch [name=channel]').value='design';document.querySelector('.FluentSearch [name=author]').value='designer';document.querySelector('.FluentSearch [name=after]').value='2020-01-01';document.querySelector('.FluentSearch [name=before]').value='2030-01-01';document.querySelector('.FluentSearch').requestSubmit()");await pause(700);assert.equal(searchedTerms,'Fluent in:design from:designer after:2020-01-01 before:2030-01-01');console.log('PASS native filtered query:',searchedTerms);await evaluate("document.querySelector('.FluentSearch [name=channel]').value='bad channel';document.querySelector('.FluentSearch').requestSubmit()");await pause(100);assert.equal(await evaluate("document.querySelector('.FluentSearch [name=channel]').validity.valid"),false,'invalid channel handle is rejected');assert.equal(await evaluate("document.querySelector('.FluentSearch details').open"),true,'invalid hidden filter is revealed');await evaluate("document.querySelector('.FluentSearch [name=channel]').value='design'");
await evaluate("document.querySelector('#searchContainer .ReplyButton').click()");await wait("Boolean(document.querySelector('#reply_textbox'))");
await evaluate("document.querySelector('.FluentContext [data-context=search]').click()");await wait("Boolean(document.querySelector('#messagesTab'))");
assert.equal(await evaluate("document.querySelector('#sbrSearchBox').value"),searchedTerms,'result query survives opening a thread');
await evaluate("document.querySelector('#filesTab').click()");await wait("document.querySelector('#filesTab').getAttribute('aria-selected')==='true'");await pause(500);
assert.ok(await evaluate("document.querySelectorAll('.FileSearchResultItem').length>0"),'server file results available');
await evaluate("document.querySelector('.FluentContext [data-context=info]').click()");await wait("Boolean(document.querySelector('#channelInfoRHSChannelSettings'))");
await evaluate("document.querySelector('.FluentContext [data-context=search]').click()");await wait("document.querySelector('#filesTab')?.getAttribute('aria-selected')==='true'");
assert.equal(await evaluate("document.querySelector('#sbrSearchBox').value"),searchedTerms,'file search query survives opening channel info');
await evaluate("document.querySelector('#searchFormContainer').click()");await wait("Boolean(document.querySelector('input[role=searchbox]'))");await evaluate("document.querySelector('input[role=searchbox]').focus();document.querySelector('input[role=searchbox]').select()");await wc.insertText('Fluent');wc.sendInputEvent({type:'keyDown',keyCode:'Return'});wc.sendInputEvent({type:'keyUp',keyCode:'Return'});await wait("document.querySelector('.FluentSearch [name=query]')?.value==='Fluent'");console.log('PASS: query synchronized after native global search');
await evaluate("document.querySelector('.FluentContext [data-context=pins]').click()");await wait("document.querySelector('#searchContainer .no-results__title')?.textContent.includes('pinned')");console.log('PASS: pinned-message shortcut');
console.log('PASS: native server filters, thread return and file-result mode restoration.');
fs.writeFileSync('artifacts/fluent-v13-search.png',(await wc.capturePage()).toPNG());
win.destroy();app.quit();})().catch(e=>{console.error(e);app.exit(1)});
