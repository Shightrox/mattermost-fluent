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
// Seed images only in the explicit localhost fixture, if missing.
const api = async (route, init = {}) => {
 const response = await fetch(lab.origin+'/api/v4'+route, {...init, headers:{Authorization:'Bearer '+lab.token,...init.headers}});
 assert.ok(response.ok, route+': '+response.status);return response.json();
};
const channel = await api('/teams/name/'+lab.team+'/channels/name/conversation-preview');
const posts = await api('/channels/'+channel.id+'/posts');
if (!Object.values(posts.posts).some(post=>post.message==='Image gallery fixture.')) {
 const ids=[];
 for (const [index,[width,height]] of [[640,480],[480,640],[800,400]].entries()) {
  const bitmap=Buffer.alloc(width*height*4);
  for (let i=0;i<bitmap.length;i+=4) {bitmap[i]=70+index*35;bitmap[i+1]=100+index*30;bitmap[i+2]=160;bitmap[i+3]=255;}
  const png=require('electron').nativeImage.createFromBitmap(bitmap,{width,height,scaleFactor:1}).toPNG();
  const form=new FormData();form.set('channel_id',channel.id);form.set('files',new Blob([png],{type:'image/png'}),'design-'+(index+1)+'.png');
  ids.push((await api('/files',{method:'POST',body:form})).file_infos[0].id);
 }
 await api('/posts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({channel_id:channel.id,message:'Image gallery fixture.',file_ids:ids})});
}
await win.loadURL(lab.origin+'/'+lab.team+'/channels/'+'conversation-preview');
const wait=async(s)=>{const end=Date.now()+20000;while(!await evaluate(s)){if(Date.now()>end){fs.writeFileSync('artifacts/fluent-lab-timeout.png',(await wc.capturePage()).toPNG());console.log(await evaluate("({path:location.pathname,text:document.body.innerText.slice(0,1800)})"));throw Error('Timed out: '+s);}await pause(100);}};
await wait("Boolean(document.querySelector('#post_textbox'))");await pause(700);
await evaluate("Array.from(document.querySelectorAll('*')).find(e=>!e.childElementCount&&e.textContent.trim().startsWith('No thanks'))?.click()");await pause(200);
await evaluate("document.querySelector('#post_textbox').focus();document.querySelector('#post_textbox').select()");await wc.insertText('');
assert.equal(await evaluate("document.querySelector('#post_textbox').value"),'','reset only the lab draft before testing');
console.log('Local webapp ready',await evaluate("({fluent:document.documentElement.hasAttribute('data-mm-fluent'),editor:!!document.querySelector('#post_textbox'),sidebar:!!document.querySelector('#SidebarContainer')})"));

const preferences = [];
ses.webRequest.onBeforeRequest({urls:[lab.origin+'/api/v4/users/*/preferences*']}, (details, callback) => {
 if (details.method !== 'GET') preferences.push(details.method);
 callback({});
});
const editor = "document.querySelector('#post_textbox').closest('.AdvancedTextEditor')";
await wait(editor+".classList.contains('mm-fluent-composer')");
assert.equal(await evaluate(editor+'.dataset.fluentTools'), 'closed');
await evaluate("document.querySelector('#post_textbox').focus()");
await wc.insertText('Local composer draft');
await evaluate(editor+".querySelector('#toggleFormattingBarButton').click()");
assert.equal(await evaluate(editor+'.dataset.fluentTools'), 'open');
assert.equal(await evaluate("document.querySelector('#post_textbox').value"), 'Local composer draft');
assert.ok(await evaluate(editor+".querySelector('[data-testid=formattingBarContainer]').contains(document.activeElement)"), 'keyboard opening focuses formatting');
wc.sendInputEvent({type:'keyDown',keyCode:'Escape'});wc.sendInputEvent({type:'keyUp',keyCode:'Escape'});await pause(100);
assert.equal(await evaluate(editor+'.dataset.fluentTools'), 'closed');
assert.equal(await evaluate('document.activeElement.id'), 'toggleFormattingBarButton');
assert.deepEqual(preferences, [], 'local formatting toggle must not update server preferences');
console.log('PASS composer draft, keyboard focus, Escape, no preference write');
await evaluate("document.querySelector('#post_textbox').focus();document.querySelector('#post_textbox').select()");await wc.insertText('');
await evaluate("document.querySelector('.MediaGallery__toggle[aria-expanded=false]')?.click()");
await wait("document.querySelectorAll('[data-fluent-gallery] .MediaGallery__tile').length===3");
for (const width of [1440, 900]) {
 win.setSize(width,960);await pause(500);
 for (const theme of ['dark','light']) {
  wc.send('fluent-settings-changed',{...settings,theme});await pause(300);
  const result = await evaluate(`(() => {
   const g=document.querySelector('[data-fluent-gallery]');
   const r=g.getBoundingClientRect();const t=Array.from(g.querySelectorAll('.MediaGallery__tile')).map(e=>e.getBoundingClientRect());
   return {paired:Math.abs(t[0].top-t[1].top)<1,wide:t[2].width>t[0].width*1.8,fit:t.every(b=>b.left>=r.left-1&&b.right<=r.right+1),overflow:document.documentElement.scrollWidth>innerWidth+1};
  })()`);
  assert.ok(result.paired&&result.wide&&result.fit&&!result.overflow,JSON.stringify({width,theme,...result}));
  fs.writeFileSync('artifacts/fluent-v24-media-'+width+'-'+theme+'.png',(await wc.capturePage()).toPNG());
 }
}
console.log('PASS image mosaic geometry in dark/light, wide/narrow');
const galleryHeight = await evaluate("document.querySelector('.MediaGallery').offsetHeight");
await evaluate("document.querySelector('.MediaGallery__toggle').click()");await pause(400);
assert.ok(await evaluate("document.querySelector('.MediaGallery').offsetHeight")<galleryHeight/2,'native gallery collapses');
await evaluate("document.querySelector('.MediaGallery__toggle').click()");await pause(400);
assert.ok(Math.abs(await evaluate("document.querySelector('.MediaGallery').offsetHeight")-galleryHeight)<2,'native gallery restores stable height');
console.log('PASS gallery collapse/expand');
await evaluate("document.querySelector('.MediaGallery__tile').click()");
await wait("Boolean(document.querySelector('.file-preview-modal__title'))");
const first=await evaluate("document.querySelector('.file-preview-modal__title').textContent");
await evaluate("document.querySelector('#previewArrowRight').click()");await pause(250);
assert.notEqual(await evaluate("document.querySelector('.file-preview-modal__title').textContent"),first);
await evaluate("document.querySelector('#previewArrowLeft').click()");await pause(250);
assert.equal(await evaluate("document.querySelector('.file-preview-modal__title').textContent"),first);
wc.sendInputEvent({type:'keyDown',keyCode:'Escape'});wc.sendInputEvent({type:'keyUp',keyCode:'Escape'});
await wait("!document.querySelector('.file-preview-modal__title')");
console.log('PASS viewer opens, next/previous, Escape');
wc.send('fluent-settings-changed',{...settings,enabled:false});await pause(300);
assert.equal(await evaluate("document.querySelectorAll('.mm-fluent-composer,[data-fluent-gallery]').length"),0,'cleanup restores native surfaces');
console.log('PASS disable restores native composer/gallery');
win.destroy();app.quit();})().catch(e=>{console.error(e);app.exit(1)});
