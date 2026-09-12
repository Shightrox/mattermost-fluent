// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Production shell with synthetic workspaces; no network, user profile or debug port.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
if(!process.versions.electron){const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;const r=require('child_process').spawnSync(require('electron'),[__filename],{env,stdio:'inherit',windowsHide:true});process.exit(r.status??1);}
const {app,BrowserWindow,ipcMain}=require('electron');
app.setPath('userData',path.join(app.getPath('temp'),'mattermost-fluent-shell-fixture'));
const pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{await app.whenReady();let servers=[{id:'studio',name:'Studio',url:'https://studio.invalid',isLoggedIn:true},{id:'engineering',name:'Engineering',url:'https://engineering.invalid',isLoggedIn:true}];let current=servers[0];const config={appName:'Mattermost Fluent',fluentEnabled:true,fluentMotion:true,fluentTheme:'dark',fluentMaterial:'solid',enableServerManagement:true};
const tab=id=>({id:id+'-tab',serverId:id,serverName:id,channelName:'Design',type:'tab'});
const values={'fluent-history-status':()=>({canGoBack:true,canGoForward:false}),'get-configuration':()=>config,'get-ordered-servers':()=>servers,'get-current-server':()=>current,'get-ordered-tabs-for-server':(_,id)=>[tab(id)],'get-active-tab-for-server':(_,id)=>tab(id),'get-language-information':()=>({value:'en',url:{}}),'get-nonce':()=> 'fixture','get-app-info':()=>({name:'Mattermost Fluent',version:'6.3.0'}),'get-dark-mode':()=>true,'get-theme':()=>undefined,'get-full-screen-status':()=>false,'is-developer-mode-enabled':()=>false,'get-is-view-limit-reached':()=>false,'request-has-downloads':()=>false};
for(const [name,handler] of Object.entries(values))ipcMain.handle(name,handler);
const win=new BrowserWindow({width:1200,height:800,show:false,titleBarStyle:"hidden",titleBarOverlay:true,webPreferences:{preload:path.resolve('dist/internalAPI.js'),sandbox:true,contextIsolation:true,nodeIntegration:false,offscreen:true,backgroundThrottling:false}});const wc=win.webContents;wc.on('console-message',e=>console.log('shell',e.message));let switched;ipcMain.on('switch-server',(_,id)=>{switched=id;current=servers.find(s=>s.id===id);wc.send('server-switched',id);wc.send('set-active-view',id,id+'-tab');});

let completed=0;ipcMain.on('loading-screen-animation-finished',()=>completed++);
const errors=[];wc.on('console-message',event=>{if(event.level==='error'||event.level===3)errors.push(event.message);});
await win.loadFile(path.resolve('dist/renderer/loadingScreen.html'));
const evaluate=source=>wc.executeJavaScript(source);
const deadline=Date.now()+10000;
while(!await evaluate("Boolean(document.querySelector('.LoadingScreen-status'))")){assert.ok(Date.now()<deadline,'loading status renders inside IntlProvider');await pause(50);}
assert.ok(await evaluate("document.querySelector('.LoadingScreen-status').textContent.includes('Opening')"));
await pause(300);
fs.writeFileSync('artifacts/fluent-v26-loading.png',(await wc.capturePage()).toPNG());
wc.send('toggle-loading-screen-visibility',false);
const end=Date.now()+6000;while(!completed){assert.ok(Date.now()<end,'renderer acknowledges fade so native view can be removed');await pause(50);}
assert.equal(errors.some(e=>e.includes('intl')||e.includes('IntlProvider')),false,errors.join('\n'));
console.log('PASS production loading entry renders localized status and acknowledges fade',completed);
win.destroy();app.quit();})().catch(e=>{console.error(e);app.exit(1)});
