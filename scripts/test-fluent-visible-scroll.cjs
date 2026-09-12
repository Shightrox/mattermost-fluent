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
// Seed only an isolated synthetic channel; never use a configured work server.
const api=async(route,body)=>{const r=await fetch(lab.origin+'/api/v4'+route,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+lab.token,...(body instanceof FormData?{}:{'Content-Type':'application/json'})},body:body?(body instanceof FormData?body:JSON.stringify(body)):undefined});if(!r.ok)throw Error('Fixture API '+r.status+' '+route);return r.json()};
const team=await api('/teams/name/'+lab.team);
let channel;try{channel=await api('/teams/'+team.id+'/channels/name/scroll-stress');}catch{channel=await api('/channels',{team_id:team.id,name:'scroll-stress',display_name:'Scroll stress lab',type:'O'});}
for(let n=channel.total_msg_count||0;n<160;n++){
 const file_ids=[];
 if(n%12===0){const width=960,height=540,b=Buffer.alloc(width*height*4);for(let i=0;i<width*height;i++){b[i*4]=(i%width)*255/width;b[i*4+1]=80;b[i*4+2]=Math.floor(i/width)*255/height;b[i*4+3]=255;}
 const png=require('electron').nativeImage.createFromBitmap(b,{width,height}).toPNG();const form=new FormData();form.set('channel_id',channel.id);form.set('files',new Blob([png],{type:'image/png'}),'scroll-fixture.png');const upload=await api('/files',form);file_ids.push(upload.file_infos[0].id);}
 await api('/posts',{channel_id:channel.id,message:'Scroll fixture '+n+'\n\n'+('Synthetic variable-height message for history anchoring and scrolling. '.repeat(1+n%7)),file_ids});
}
const ses=session.fromPartition('fluent-lab');
for(const [name,value] of [['MMAUTHTOKEN',lab.token],['MMUSERID',lab.userId]])await ses.cookies.set({url:lab.origin,name,value,httpOnly:name==='MMAUTHTOKEN',sameSite:'lax'});
assert.ok(fs.existsSync(path.resolve(process.env.FLUENT_PERF_PRELOAD||'dist/externalAPI.js')),'preload must exist');
const win=new BrowserWindow({width:1440,height:960,show:true,backgroundColor:'#00000000',backgroundMaterial:'acrylic',webPreferences:{session:ses,preload:path.resolve(process.env.FLUENT_PERF_PRELOAD||'dist/externalAPI.js'),sandbox:true,contextIsolation:true,nodeIntegration:false,offscreen:false,backgroundThrottling:false}});
const wc=win.webContents;wc.setUserAgent(wc.getUserAgent()+' Mattermost/6.3.0');const evaluate=s=>wc.executeJavaScript(s);const settings={enabled:true,motion:true,material:'solid',theme:'dark',accent:'blue',textSize:'standard',compactHeader:true,serverURL:lab.origin};
// The desktop webapp sends routes to main, which returns them to its router.
// Keep this loop local to the fixture window and its synthetic team.
ipcMain.on('browser-history-push',(event,route)=>{if(event.sender===wc&&typeof route==='string'&&route.startsWith('/'+lab.team+'/'))wc.send('browser-history-push',route);});
wc.on('did-finish-load',()=>wc.send('fluent-settings-changed',settings));
await win.loadURL(lab.origin+'/'+lab.team+'/channels/'+'scroll-stress');
const wait=async(s)=>{const end=Date.now()+20000;while(!await evaluate(s)){if(Date.now()>end){fs.writeFileSync('artifacts/fluent-lab-timeout.png',(await wc.capturePage()).toPNG());console.log(await evaluate("({path:location.pathname,text:document.body.innerText.slice(0,1800)})"));throw Error('Timed out: '+s);}await pause(100);}};
await wait("Boolean(document.querySelector('#post_textbox'))");await pause(700);
await evaluate("Array.from(document.querySelectorAll('*')).find(e=>!e.childElementCount&&e.textContent.trim().startsWith('No thanks'))?.click()");await pause(200);
await evaluate("document.querySelector('#post_textbox').focus();document.querySelector('#post_textbox').select()");await wc.insertText('');
assert.equal(await evaluate("document.querySelector('#post_textbox').value"),'','reset only the lab draft before testing');
console.log('Local webapp ready',await evaluate("({fluent:document.documentElement.hasAttribute('data-mm-fluent'),editor:!!document.querySelector('#post_textbox'),sidebar:!!document.querySelector('#SidebarContainer')})"));

wc.debugger.attach('1.3');await wc.debugger.sendCommand('Performance.enable');
const metrics=async()=>Object.fromEntries((await wc.debugger.sendCommand('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
let historyRequests=0;await wc.debugger.sendCommand('Network.enable');wc.debugger.on('message',(_,method,params)=>{if(method==='Network.requestWillBeSent'&&params.request.url.includes('/posts?'))historyRequests++;});
if(process.env.FLUENT_SCROLL_PROFILE){await wc.debugger.sendCommand('Profiler.enable');await wc.debugger.sendCommand('Profiler.start');}
const trace=[];if(process.env.FLUENT_SCROLL_TRACE){wc.debugger.on('message',(_,m,p)=>{if(m==='Tracing.dataCollected')trace.push(...p.value)});await wc.debugger.sendCommand('Tracing.start',{categories:'devtools.timeline,disabled-by-default-devtools.timeline.invalidationTracking',options:'record-as-much-as-possible'});}
const result=[];
for(const material of (process.env.FLUENT_SCROLL_HISTORY?['acrylic']:['solid','acrylic','acrylic','solid'])){
 const enabled=!process.env.FLUENT_SCROLL_STOCK;win.setBackgroundMaterial(material==='acrylic'?'acrylic':'none');
 wc.send('fluent-settings-changed',{...settings,enabled,material,chatOpacity:90});await pause(600);
 assert.equal(await evaluate("document.documentElement.hasAttribute('data-mm-fluent')"),enabled,'requested appearance is active');
 const e=await evaluate("(()=>{const e=document.getElementById('postListScrollContainer');e.scrollTop=e.scrollHeight-e.clientHeight-150;const r=e.getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()");await pause(350);
 const requestsBefore=historyRequests;const idleStart=await metrics();await pause(2000);const before=await metrics();
 await evaluate(`window.scrollSample={intervals:[],positions:[],running:true};(()=>{let last=performance.now();const sample=t=>{const s=window.scrollSample;if(!s.running)return;s.intervals.push(t-last);s.positions.push(document.getElementById('postListScrollContainer').scrollTop);last=t;requestAnimationFrame(sample)};requestAnimationFrame(sample)})()`);
 for(let i=0;i<(process.env.FLUENT_SCROLL_HISTORY?240:80);i++){await wc.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mouseWheel',x:e.x,y:e.y,deltaX:0,deltaY:(i<(process.env.FLUENT_SCROLL_HISTORY?200:40)?-120:120)});await pause(16);}
 await pause(600);const after=await metrics();
 const frames=await evaluate(`(()=>{const s=window.scrollSample;s.running=false;const intervals=s.intervals.slice(1).sort((a,b)=>a-b);return {p95:intervals[Math.floor(intervals.length*.95)],max:Math.max(...intervals),over25ms:intervals.filter(t=>t>25).length,travel:Math.max(...s.positions)-Math.min(...s.positions)}})()`);
 assert.ok(await evaluate("Array.from(document.querySelectorAll('#postListScrollContainer [data-testid=postView]')).some(e=>{const r=e.getBoundingClientRect();return r.bottom>100&&r.top<innerHeight-100})"),'visible messages remain after history and direction reversal');
 if(process.env.FLUENT_SCROLL_HISTORY)assert.ok(historyRequests>requestsBefore,'history scenario must actually load older posts');
 const delta=(a,b,name)=>Math.round((b[name]-a[name])*1000)/1000;
 result.push({enabled,material,frames,historyRequests:historyRequests-requestsBefore,idleTaskSeconds:delta(idleStart,before,'TaskDuration'),activeTaskSeconds:delta(before,after,'TaskDuration'),layoutSeconds:delta(before,after,'LayoutDuration'),styleSeconds:delta(before,after,'RecalcStyleDuration'),heapMB:Math.round(after.JSHeapUsedSize/1024/1024),nodes:after.Nodes});
}
if(process.env.FLUENT_SCROLL_PROFILE){const {profile}=await wc.debugger.sendCommand('Profiler.stop');fs.writeFileSync('artifacts/fluent-history-profile.json',JSON.stringify(profile));}
if(process.env.FLUENT_SCROLL_TRACE){await new Promise(async resolve=>{const end=(_,m)=>{if(m==='Tracing.tracingComplete'){wc.debugger.removeListener('message',end);resolve()}};wc.debugger.on('message',end);await wc.debugger.sendCommand('Tracing.end')});fs.writeFileSync('artifacts/fluent-scroll-trace.json',JSON.stringify(trace));}
console.log('Native GPU status', app.getGPUFeatureStatus());
fs.writeFileSync(process.env.FLUENT_PERF_OUTPUT||'artifacts/fluent-visible-scroll.json',JSON.stringify({environment:{electron:process.versions.electron,chrome:process.versions.chrome,os:require('os').release(),arch:process.arch,offscreen:false},scenario:process.env.FLUENT_SCROLL_HISTORY?'240 wheel inputs, 200 up / 40 down, native visible window, history loading':'80 wheel inputs, 40 up / 40 down, alternating solid/acrylic',cpuProfiler:Boolean(process.env.FLUENT_SCROLL_PROFILE),trace:Boolean(process.env.FLUENT_SCROLL_TRACE),result},null,2));console.log(result);wc.debugger.detach();win.destroy();app.quit();})().catch(e=>{console.error(e);app.exit(1)});
