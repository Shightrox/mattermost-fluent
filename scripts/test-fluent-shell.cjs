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
await win.loadFile(path.resolve('dist/renderer/index.html'));const evaluate=s=>wc.executeJavaScript(s);const deadline=Date.now()+10000;while(!await evaluate("document.querySelectorAll('.FluentWorkspaceRail__server').length===2")){assert.ok(Date.now()<deadline,'shell mounted');await pause(100);}
assert.equal(await evaluate("getComputedStyle(document.querySelector('.FluentCommands')).webkitAppRegion"),'drag','empty command strip is a window drag region');
assert.equal(await evaluate("Array.from(document.querySelectorAll('.FluentCommands button')).every(e=>getComputedStyle(e).webkitAppRegion==='no-drag')"),true,'toolbar controls remain clickable');
let historyCommand;ipcMain.on('fluent-toolbar-command',(_,command)=>{historyCommand=command;});
assert.equal(await evaluate("document.querySelector('[aria-label=Back]').disabled"),false);
assert.equal(await evaluate("document.querySelector('[aria-label=Forward]').disabled"),true);
wc.send('fluent-history-status',{canGoBack:false,canGoForward:true});await pause(80);
assert.equal(await evaluate("document.querySelector('[aria-label=Back]').disabled"),true);
await evaluate("document.querySelector('[aria-label=Forward]').click()");await pause(50);assert.equal(historyCommand,'forward');
await evaluate("document.querySelectorAll('.FluentWorkspaceRail__server')[1].click()");await pause(150);assert.equal(switched,'engineering','workspace action reaches existing IPC');assert.equal(await evaluate("document.querySelector('[aria-current=page]').title"),'Engineering','active indicator follows server switch');
wc.send('update_mentions_for_server','engineering',false,120,true);await pause(80);assert.equal(await evaluate("document.querySelector('.FluentWorkspaceRail__count').textContent"),'99+');
for(const width of [1200,800]){win.setSize(width,800);await pause(100);assert.equal(await evaluate("document.querySelector('.FluentWorkspaceRail').getBoundingClientRect().width"),56);assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth"),true);fs.writeFileSync('artifacts/fluent-shell-'+width+'.png',(await wc.capturePage()).toPNG());}
config.fluentEnabled=false;wc.send('reload-config');await pause(150);assert.equal(await evaluate("document.querySelector('.FluentWorkspaceRail')===null"),true,'stock layout has no rail');config.fluentEnabled=true;servers=[current];wc.send('reload-config');wc.send('server-removed','studio');await pause(200);assert.equal(await evaluate("document.querySelector('.FluentWorkspaceRail')===null"),true,'single server has no rail');wc.send('load_fail',current.id+'-tab','ERR_CONNECTION_REFUSED','https://studio.invalid');await pause(400);
assert.ok(await evaluate("Boolean(document.querySelector('.ErrorView-help'))"));
await evaluate("document.querySelector('.ErrorView-help summary').click();document.querySelector('.ErrorView-techInfo summary').click()");
assert.ok(await evaluate("document.querySelector('.ErrorView-techInfo').open"));
fs.writeFileSync('artifacts/fluent-v25-connection-error.png',(await wc.capturePage()).toPNG());
console.log('PASS connection help and technical details');
win.destroy();console.log('PASS: production shell, switching, badges, sizes, off and single-server states');app.quit();})().catch(e=>{console.error(e);app.exit(1)});
