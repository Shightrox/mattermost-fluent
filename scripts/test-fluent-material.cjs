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



const alpha = async selector => evaluate(`(()=>{const value=getComputedStyle(document.querySelector(${JSON.stringify(selector)})).backgroundColor;const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const context=canvas.getContext('2d');context.fillStyle=value;context.fillRect(0,0,1,1);return context.getImageData(0,0,1,1).data[3]/255})()`);
for(const material of ['solid','mica','acrylic']) {
 for(const chatOpacity of [30,75,100]) {
  wc.send('fluent-settings-changed',{...settings,material,chatOpacity});await pause(250);
  const sidebar=await alpha('#SidebarContainer'), chat=await alpha('#channel_view');
  assert.ok(Math.abs(chat-(material==='solid'?1:chatOpacity/100))<0.01, 'chat alpha matches requested material/density');
  assert.ok(material==='solid'?sidebar===1:sidebar>0&&sidebar<0.9,'sidebar retains the native material');
  console.log('PASS material', {material,chatOpacity,sidebar,chat});
 }
}
wc.send('fluent-settings-changed',{...settings,material:'acrylic',chatOpacity:30});await pause(200);
wc.debugger.attach('1.3');await wc.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-transparency',value:'reduce'}]});await pause(200);
assert.equal(await alpha('#channel_view'),1);assert.equal(await alpha('#SidebarContainer'),1);
wc.debugger.detach();win.destroy();app.quit();})().catch(e=>{console.error(e);app.exit(1)});
