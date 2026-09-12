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
await win.loadURL(lab.origin+'/'+lab.team+'/channels/'+'conversation-preview');
const wait=async(s)=>{const end=Date.now()+20000;while(!await evaluate(s)){if(Date.now()>end){fs.writeFileSync('artifacts/fluent-lab-timeout.png',(await wc.capturePage()).toPNG());console.log(await evaluate("({path:location.pathname,text:document.body.innerText.slice(0,1800)})"));throw Error('Timed out: '+s);}await pause(100);}};
await wait("Boolean(document.querySelector('#post_textbox'))");await pause(700);
await evaluate("Array.from(document.querySelectorAll('*')).find(e=>!e.childElementCount&&e.textContent.trim().startsWith('No thanks'))?.click()");await pause(200);
await evaluate("document.querySelector('#post_textbox').focus();document.querySelector('#post_textbox').select()");await wc.insertText('');
assert.equal(await evaluate("document.querySelector('#post_textbox').value"),'','reset only the lab draft before testing');
console.log('Local webapp ready',await evaluate("({fluent:document.documentElement.hasAttribute('data-mm-fluent'),editor:!!document.querySelector('#post_textbox'),sidebar:!!document.querySelector('#SidebarContainer')})"));

for (const width of [1440, 900]) {
 win.setSize(width, 960); await pause(400);
 for (const theme of ['dark', 'light']) {
  wc.send('fluent-settings-changed', {...settings, theme}); await pause(500);
  const result = await evaluate(`(() => {
   const rect = e => {const r = e.getBoundingClientRect(); return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width}};
   const rows = Array.from(document.querySelectorAll('#channel_view [data-testid=postView]'));
   const own = rows.find(e => e.classList.contains('current--user'));
   const other = rows.find(e => !e.classList.contains('current--user') && e.textContent.includes('fluent-peer') && !e.textContent.includes('System'));
   const bubble = e => e.querySelector('.post__content > div:has(> .post__header)');
   const canvas = rect(document.querySelector('#channel_view'));
   const header = rect(document.querySelector('#channel-header'));
   const boxes = rows.map(bubble).filter(Boolean).map(rect);
   const footers = Array.from(document.querySelectorAll('#channel_view .ThreadFooter'));
   for (const footer of footers) {
    const parent = rect(bubble(footer.closest('[data-testid=postView]'))), child = rect(footer);
    if (child.left < parent.left || child.right > parent.right + 1) throw Error('Thread footer escaped its message bubble');
   }
   return {ownRight:rect(bubble(own)).right > rect(bubble(other)).right, headerFits:header.left>=canvas.left && header.right<=canvas.right+1, overflow:document.documentElement.scrollWidth>innerWidth+1, bubblesFit:boxes.every(b=>b.left>=canvas.left && b.right<=canvas.right+1)};
  })()`);
  assert.ok(result.ownRight && result.headerFits && result.bubblesFit && !result.overflow, JSON.stringify({width,theme,...result}));
  fs.writeFileSync('artifacts/fluent-v20-conversation-'+width+'-'+theme+'.png', (await wc.capturePage()).toPNG());
  console.log('PASS conversation composition', width, theme, result);
 }
}
win.destroy();app.quit();})().catch(e=>{console.error(e);app.exit(1)});
