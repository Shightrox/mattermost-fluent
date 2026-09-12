// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Native capture stage: production renderers + isolated localhost demo data.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
if(!process.versions.electron){const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;const child=require('child_process').spawn(require('electron'),[__filename],{env,stdio:'inherit',windowsHide:true});child.on('exit',code=>process.exit(code??1));return;}
const {app,BrowserWindow,WebContentsView,ipcMain,session,screen}=require('electron');
app.setPath('userData',path.join(app.getPath('temp'),'fluent-public-showcase'));
const pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 await app.whenReady();const lab=JSON.parse(fs.readFileSync('artifacts/fluent-showcase-session.json','utf8'));assert.equal(lab.origin,'http://localhost:18065');
 const config={appName:'Mattermost Fluent',fluentEnabled:true,fluentMotion:true,fluentTheme:'dark',fluentTint:'ocean',fluentAccent:'violet',fluentMaterial:'acrylic',fluentTextSize:'standard',fluentChatOpacity:75,enableServerManagement:true};
 const servers=[{id:'northstar',name:'Northstar',url:lab.origin,isLoggedIn:true},{id:'sandbox',name:'Sandbox',url:'https://sandbox.invalid',isLoggedIn:true}];
 const tab={id:'design',serverId:'northstar',serverName:'Northstar',channelName:'design-lab',type:'tab'};
 const handlers={'get-configuration':()=>config,'get-local-configuration':()=>config,'get-ordered-servers':()=>servers,'get-current-server':()=>servers[0],'get-ordered-tabs-for-server':()=>[tab],'get-active-tab-for-server':()=>tab,'get-language-information':()=>({value:'en',url:{}}),'get-nonce':()=> 'fixture','get-app-info':()=>({name:'Mattermost Fluent',version:'6.3.0'}),'get-dark-mode':()=>config.fluentTheme==='dark','get-theme':()=>undefined,'get-full-screen-status':()=>false,'is-developer-mode-enabled':()=>false,'get-is-dev-mode':()=>false,'get-is-view-limit-reached':()=>false,'request-has-downloads':()=>false,'fluent-history-status':()=>({canGoBack:true,canGoForward:false}),'can-popout':()=>false,'can-use-popout-option':()=>false,'request-browser-history-status':()=>({canGoBack:false,canGoForward:false}),'notify_mention':()=>undefined};
 for(const [name,handler]of Object.entries(handlers))ipcMain.handle(name,handler);
 const area=screen.getPrimaryDisplay().workArea;
 const width=Math.min(1300,area.width-120),height=Math.min(860,area.height-120),x=Math.round(area.x+(area.width-width)/2),y=Math.round(area.y+(area.height-height)/2);
 const stage=new BrowserWindow({x:area.x,y:area.y,width:area.width,height:area.height,frame:false,show:false,skipTaskbar:true,webPreferences:{sandbox:true}});
 await stage.loadURL('data:text/html,'+encodeURIComponent('<html><body style="margin:0;background:#182734;overflow:hidden"><div style="height:100vh;background:radial-gradient(ellipse at 10% 90%,#54adad 0,transparent 55%),radial-gradient(ellipse at 85% 15%,#a18ccc 0,transparent 50%),linear-gradient(135deg,#121d2d,#334f59)"></div></body></html>'));
 stage.show();
 const win=new BrowserWindow({x,y,width,height,title:'Fluent Showcase — Synthetic',show:false,backgroundColor:'#00000000',backgroundMaterial:'acrylic',titleBarStyle:'hidden',titleBarOverlay:{color:'#00000000',symbolColor:'#d8e5ed',height:40},webPreferences:{preload:path.resolve('dist/internalAPI.js'),sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
 win.on('page-title-updated',event=>event.preventDefault());
 await win.loadFile(path.resolve('dist/renderer/index.html'));
 const ses=session.fromPartition('persist:public-synthetic-demo');
 for(const [name,value]of [['MMAUTHTOKEN',lab.token],['MMUSERID',lab.userId]])await ses.cookies.set({url:lab.origin,name,value,httpOnly:name==='MMAUTHTOKEN',sameSite:'lax'});
 ses.webRequest.onBeforeRequest((details,callback)=>{const url=new URL(details.url);callback({cancel:!['localhost',''].includes(url.hostname)&&!['data:','blob:','devtools:'].includes(url.protocol)});});
 const view=new WebContentsView({webPreferences:{session:ses,preload:path.resolve('dist/externalAPI.js'),sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
 view.setBackgroundColor('#00000000');win.contentView.addChildView(view);
 const bounds=()=>{const [w,h]=win.getContentSize();view.setBounds({x:56,y:40,width:w-56,height:h-40});};bounds();win.on('resize',bounds);
 const wc=view.webContents;wc.setUserAgent(wc.getUserAgent()+' Mattermost/6.3.0');
 const settings=()=>({enabled:true,motion:true,material:config.fluentMaterial,theme:config.fluentTheme,tint:config.fluentTint,accent:config.fluentAccent,chatOpacity:config.fluentChatOpacity,textSize:'standard',compactHeader:true,serverURL:lab.origin});
 wc.on('did-finish-load',()=>wc.send('fluent-settings-changed',settings()));
 ipcMain.on('browser-history-push',(event,route)=>{if(event.sender===wc&&typeof route==='string'&&route.startsWith('/'+lab.team+'/'))wc.send('browser-history-push',route);});
 await wc.loadURL(lab.origin+'/'+lab.team+'/channels/'+lab.channelName);
 win.show();win.setAlwaysOnTop(true);win.focus();
 const wait=async(code)=>{for(let i=0;i<100;i++){if(await wc.executeJavaScript(code))return;await pause(100);}throw Error('Showcase did not become ready');};
 await wait("Boolean(document.querySelector('#post_textbox'))");await pause(800);
 wc.send('fluent-settings-changed',settings());
 await wc.executeJavaScript("Array.from(document.querySelectorAll('*')).find(e=>!e.childElementCount&&e.textContent.trim().startsWith('No thanks'))?.click()");
 let previous='';
 const timer=setInterval(async()=>{try{
  const text=fs.readFileSync('artifacts/showcase-control.json','utf8');if(text===previous)return;previous=text;const command=JSON.parse(text);
  if(command.close){clearInterval(timer);win.destroy();if(!stage.isDestroyed())stage.destroy();app.quit();return;}
  if(['dark','light'].includes(command.theme))config.fluentTheme=command.theme;
  if(['solid','acrylic'].includes(command.material)){config.fluentMaterial=command.material;win.setBackgroundMaterial(command.material==='solid'?'none':'acrylic');win.setBackgroundColor(command.material==='solid'?(config.fluentTheme==='light'?'#f7f0e4':'#202020'):'#00000000');}
  if(['neutral','slate','ocean','forest','plum','sand'].includes(command.tint))config.fluentTint=command.tint;
  if(['blue','violet','green','teal','rose','amber','coral','indigo'].includes(command.accent))config.fluentAccent=command.accent;
  if(Number.isFinite(command.opacity))config.fluentChatOpacity=Math.max(30,Math.min(100,command.opacity));
  win.webContents.send('reload-config');wc.send('fluent-settings-changed',settings());win.setTitleBarOverlay({color:'#00000000',symbolColor:config.fluentTheme==='light'?'#253444':'#d8e5ed',height:40});
  if(command.thread)await wc.executeJavaScript(`document.getElementById('${lab.threadId}_message')?.querySelector('.ReplyButton')?.click()`);
  else await wc.executeJavaScript("document.querySelector('#rhsCloseButton')?.click()");
  if(command.export){await pause(700);fs.writeFileSync('artifacts/showcase-web.png',(await wc.capturePage()).toPNG());fs.writeFileSync('artifacts/showcase-window.png',(await win.capturePage()).toPNG());}
  console.log('Scene ready:',config.fluentTheme,config.fluentTint,config.fluentAccent);
 }catch(error){console.error(String(error));}},500);
 win.on('closed',()=>{clearInterval(timer);if(!stage.isDestroyed())stage.destroy();app.quit();});
 console.log('SHOWCASE READY: synthetic content only.');
})().catch(error=>{console.error(error);app.exit(1)});
