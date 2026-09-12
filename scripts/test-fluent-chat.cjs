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
const incoming=(await api('/posts',{channel_id:lab.channelId,message:'Привет! Здесь проверяем новый Fluent чат.\n\nКороткие и длинные сообщения должны читаться одинаково удобно.'},peerLogin.token)).data;
const followup=(await api('/posts',{channel_id:lab.channelId,message:'Another message in the same author group.'},peerLogin.token)).data;
const own=(await api('/posts',{channel_id:lab.channelId,message:'Согласен. Проверим **выделение**, ссылки и код.\n\nhttps://example.com/'+('long-path-'.repeat(35))+'\n\n```typescript\nconst message = "'+('long code '.repeat(25))+'";\n```'})).data;
await wait(`Boolean(document.getElementById('post_${incoming.id}')&&document.getElementById('post_${own.id}'))`);await pause(350);
assert.ok(await evaluate(`document.getElementById('post_${incoming.id}').textContent.includes('Привет!')`),'Cyrillic fixture survives API and rendering');
for(const theme of ['dark','light']){
 wc.send('fluent-settings-changed',{...settings,theme});await pause(200);
 const result=await evaluate(`(()=>{const a=document.querySelector('#post_${incoming.id} .post__content > div:has(> .post__header)'),b=document.querySelector('#post_${own.id} .post__content > div:has(> .post__header)');const rows=Array.from(document.querySelectorAll('#channel_view [data-testid=postView]')).map(e=>e.getBoundingClientRect());return {different:getComputedStyle(a).backgroundColor!==getComputedStyle(b).backgroundColor,rounded:getComputedStyle(b).borderRadius,overlap:rows.some((r,i)=>i>0&&r.top<rows[i-1].bottom-1),overflow:document.documentElement.scrollWidth>innerWidth+1,codeFits:b.querySelector('.post-code').getBoundingClientRect().right<=b.getBoundingClientRect().right+1}})()`);
 const gap=await evaluate(`document.querySelector('#post_${followup.id} .post__content > div:has(> .post__header)').getBoundingClientRect().top-document.querySelector('#post_${incoming.id} .post__content > div:has(> .post__header)').getBoundingClientRect().bottom`);
 assert.ok(gap>=5,'consecutive bubbles have measured breathing room: '+gap);
 assert.ok(result.different&&result.codeFits&&!result.overflow&&!result.overlap,'incoming/own bubbles, long URL, code and virtual row geometry: '+JSON.stringify(result));
 fs.writeFileSync('artifacts/fluent-v14-chat-'+theme+'.png',(await wc.capturePage()).toPNG());
}
wc.debugger.attach('1.3');
async function checkScroll(selector){
 const setup=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});const max=e.scrollHeight-e.clientHeight;if(max<1000)throw Error('Scroll fixture too short');e.scrollTop=Math.floor(max*.7);const r=e.getBoundingClientRect();return {x:Math.round(r.x+r.width*.6),y:Math.round(r.y+r.height*.5)}})()`);
 await pause(350);
 await evaluate(`window.scrollCheck={start:document.querySelector(${JSON.stringify(selector)}).scrollTop,previous:document.querySelector(${JSON.stringify(selector)}).scrollTop,reversals:0,running:true};(()=>{const sample=()=>{const s=window.scrollCheck;if(!s.running)return;const next=document.querySelector(${JSON.stringify(selector)}).scrollTop;if(next>s.previous+1)s.reversals++;s.previous=next;requestAnimationFrame(sample)};requestAnimationFrame(sample)})()`);
 for(let i=0;i<8;i++){await wc.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mouseWheel',...setup,deltaX:0,deltaY:-60});await pause(70);}
 await pause(900);
 const result=await evaluate(`(()=>{const s=window.scrollCheck;s.running=false;return {distance:s.start-document.querySelector(${JSON.stringify(selector)}).scrollTop,reversals:s.reversals}})()`);
 assert.ok(Math.abs(result.distance-480)<=2,'native wheel distance preserved: '+JSON.stringify(result));assert.equal(result.reversals,0,'no backward jumps');console.log('PASS real Chromium scroll',selector,result);
}
await checkScroll('#postListScrollContainer');
for(let n=0;n<8;n++)await api('/posts',{channel_id:lab.channelId,root_id:incoming.id,message:Array.from({length:8},(_,i)=>'Thread scrolling paragraph '+n+'.'+i+'.').join('\n\n')});
await evaluate("document.getElementById('postListScrollContainer').scrollTop=1e8");
await wait(`Boolean(document.getElementById('${incoming.id}_message')?.querySelector('.ReplyButton'))`);
await evaluate(`document.getElementById('${incoming.id}_message').querySelector('.ReplyButton').click()`);
await wait("Boolean(document.getElementById('threadViewerScrollContainer'))");await pause(700);
await checkScroll('#threadViewerScrollContainer');
console.log('PASS: incoming/own chat surfaces, long URL/code, measured rows and both themes.');win.destroy();app.quit();})().catch(e=>{console.error(e);app.exit(1)});
