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

async function api(route,data,token=lab.token){const response=await fetch(lab.origin+'/api/v4'+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:data?JSON.stringify(data):undefined});if(!response.ok)throw Error('Local chat fixture: '+route+' '+response.status);return {data:await response.json(),token:response.headers.get('Token')};}
const peerCredentials={username:'fluent-peer',email:'peer@fluent-lab.invalid',password:'FluentLab-Only-2026!'};
let peer;try{peer=(await api('/users/username/fluent-peer')).data;}catch{peer=(await api('/users',peerCredentials)).data;}
const team=(await api('/teams/name/'+lab.team)).data;
try{await api('/teams/'+team.id+'/members',{team_id:team.id,user_id:peer.id});}catch(error){if(!String(error).endsWith('400'))throw error;}
try{await api('/channels/'+lab.channelId+'/members',{user_id:peer.id});}catch(error){if(!String(error).endsWith('400'))throw error;}
const peerLogin=await api('/users/login',{login_id:peerCredentials.username,password:peerCredentials.password});
const channel=(await api('/teams/'+team.id+'/channels/name/engineering')).data;
try{await api('/channels/'+channel.id+'/members',{user_id:peer.id});}catch(error){if(!String(error).endsWith('400'))throw error;}
await api('/posts',{channel_id:channel.id,message:'@designer Synthetic sidebar mention geometry check.'},peerLogin.token);await pause(600);
await wait("Boolean(document.querySelector('#sidebarItem_engineering .badge'))");
await evaluate("document.querySelector('#sidebarItem_engineering .unreadMentions').textContent='999';document.querySelector('#sidebarItem_engineering').focus()");
const geometry=await evaluate("(()=>{const r=document.querySelector('#sidebarItem_engineering'),label=r.querySelector('.SidebarChannelLinkLabel_wrapper').getBoundingClientRect(),badge=r.querySelector('.badge').getBoundingClientRect(),menu=r.querySelector('.SidebarMenu').getBoundingClientRect();return {label:label.toJSON(),badge:badge.toJSON(),menu:menu.toJSON(),fits:label.right<=badge.left+1&&badge.right<=menu.left+1,visible:getComputedStyle(r.querySelector('.SidebarMenu')).visibility==='visible'}})()");assert.ok(geometry.fits&&geometry.visible,'long count, title and keyboard menu have separate hit areas');
for(const theme of ['dark','light']){wc.send('fluent-settings-changed',{...settings,theme});await pause(300);fs.writeFileSync('artifacts/fluent-v16-sidebar-'+theme+'.png',(await wc.capturePage()).toPNG());}
win.destroy();console.log('PASS real mention, three-digit count geometry, keyboard menu and themes');app.quit();})().catch(e=>{console.error(e);app.exit(1)});
