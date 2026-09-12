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
Object.assign(config,{servers:[],notifications:{flashWindow:2,bounceIcon:true},spellCheckerLocales:[],fluentTheme:'dark',fluentMaterial:'solid',fluentMotion:true,fluentAccent:'blue',fluentTint:'neutral',fluentTextSize:'standard',viewLimit:15});
ipcMain.handle('get-modal-uncloseable',()=>false);const saved=[];ipcMain.on('update-configuration',(_,items)=>{saved.push(...items);for(const item of items)config[item.key]=item.data;wc.send('reload-config');});
ipcMain.handle('get-local-configuration',()=>config);ipcMain.handle('get-available-languages',()=>['en','ru']);ipcMain.handle('get-available-spell-checker-languages',()=>['en','ru']);
await win.loadFile(path.resolve('dist/renderer/settings.html'));const evaluate=s=>wc.executeJavaScript(s);await pause(600);await evaluate("document.getElementById('RadioSetting_fluentTheme_dark').focus()");wc.sendInputEvent({type:'keyDown',keyCode:'Left'});wc.sendInputEvent({type:'keyUp',keyCode:'Left'});await pause(1200);
assert.equal(await evaluate("document.getElementById('RadioSetting_fluentTheme_light').getAttribute('aria-checked')"),'true','arrow selects previous theme');assert.equal(await evaluate("document.activeElement.id"),'RadioSetting_fluentTheme_light','arrow moves focus');assert.ok(saved.some(item=>item.key==='fluentTheme'&&item.data==='light'),'keyboard selection uses existing save IPC');
assert.equal(await evaluate("document.querySelectorAll('#fluentTheme-heading + [role=radiogroup] button[tabindex=\"0\"]').length"),1,'single tab stop in radio group');
await evaluate("document.getElementById('rangeSetting_fluentChatOpacity').scrollIntoView({block:'center'});document.getElementById('rangeSetting_fluentChatOpacity').focus()");
const previousSaves=saved.length;
wc.sendInputEvent({type:'keyDown',keyCode:'Right'});await pause(100);
assert.equal(saved.length,previousSaves,'range changes stay local until the gesture finishes');
wc.sendInputEvent({type:'keyUp',keyCode:'Right'});await pause(1200);
assert.equal(await evaluate("document.getElementById('rangeSetting_fluentChatOpacity').value"),'80');
assert.ok(saved.some(item=>item.key==='fluentChatOpacity'&&item.data===80),'range keyboard adjustment uses validated configuration save');
await evaluate("document.getElementById('RadioSetting_fluentTint_neutral').scrollIntoView({block:'center'});document.getElementById('RadioSetting_fluentTint_neutral').focus()");
wc.sendInputEvent({type:'keyDown',keyCode:'End'});wc.sendInputEvent({type:'keyUp',keyCode:'End'});await pause(1200);
assert.ok(saved.some(item=>item.key==='fluentTint'&&item.data==='sand'),'tint saves via existing configuration IPC');
await evaluate("document.getElementById('RadioSetting_fluentAccent_blue').focus()");
wc.sendInputEvent({type:'keyDown',keyCode:'End'});wc.sendInputEvent({type:'keyUp',keyCode:'End'});await pause(1200);
assert.ok(saved.some(item=>item.key==='fluentAccent'&&item.data==='indigo'),'expanded accent saves');
await wc.reload();await pause(700);
assert.equal(await evaluate("document.getElementById('RadioSetting_fluentTint_sand').getAttribute('aria-checked')"),'true','tint restored from saved configuration');
assert.equal(await evaluate("document.getElementById('RadioSetting_fluentAccent_indigo').getAttribute('aria-checked')"),'true','accent restored independently');
for(const theme of ['light','dark']){
 config.fluentTheme=theme;wc.send('reload-config');await pause(200);
 for(const width of [1200,700]){
  win.setSize(width,900);await pause(150);
  const fit=await evaluate("Array.from(document.querySelectorAll('[id^=RadioSetting_fluentTint_], [id^=RadioSetting_fluentAccent_]')).every(e=>{const r=e.getBoundingClientRect();return r.width>60&&r.left>=0&&r.right<=innerWidth&&e.scrollWidth<=e.clientWidth+1})");
  assert.ok(fit,'palette controls fit '+theme+' '+width);
 }
 win.setSize(1200,900);await pause(150);
 await evaluate("document.getElementById('fluentAccent-heading').scrollIntoView({block:'start'})");
 fs.writeFileSync('artifacts/fluent-v30-settings-'+theme+'.png',(await wc.capturePage()).toPNG());
}
win.destroy();console.log('PASS settings keyboard, save/reload, independent tint/accent and responsive palettes');app.quit();})().catch(e=>{console.error(e);app.exit(1)});
