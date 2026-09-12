// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Real local webapp + production preload. No debug port or working accounts.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
if(!process.versions.electron){const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;const r=require('child_process').spawnSync(require('electron'),[__filename],{env,stdio:'inherit',windowsHide:true});process.exit(r.status??1);}
const {app,BrowserWindow,ipcMain,session}=require('electron');
app.setPath('userData',path.join(app.getPath('temp'),'mattermost-fluent-lab-harness'));
const pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const lab=JSON.parse(fs.readFileSync('artifacts/fluent-lab-117-session.json','utf8'));assert.equal(lab.origin,'http://localhost:18067');await app.whenReady();
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
const channel = await api('/teams/name/'+lab.team+'/channels/name/'+lab.channelName);
const posts = await api('/channels/'+channel.id+'/posts');
if (!Object.values(posts.posts).some(post=>post.message===''&&post.file_ids?.length===3)) {
 const ids=[];
 for (const [index,[width,height]] of [[640,480],[480,640],[800,400]].entries()) {
  const bitmap=Buffer.alloc(width*height*4);
  for (let i=0;i<bitmap.length;i+=4) {bitmap[i]=70+index*35;bitmap[i+1]=100+index*30;bitmap[i+2]=160;bitmap[i+3]=255;}
  const png=require('electron').nativeImage.createFromBitmap(bitmap,{width,height,scaleFactor:1}).toPNG();
  const form=new FormData();form.set('channel_id',channel.id);form.set('files',new Blob([png],{type:'image/png'}),'design-'+(index+1)+'.png');
  ids.push((await api('/files',{method:'POST',body:form})).file_infos[0].id);
 }
 await api('/posts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({channel_id:channel.id,message:'',file_ids:ids})});
}
const refreshed = await api('/channels/'+channel.id+'/posts');
const root = Object.values(refreshed.posts).find(post=>post.message===''&&post.file_ids?.length===3);
if (!root.reply_count) await api('/posts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({channel_id:channel.id,root_id:root.id,message:'Local attachment thread fixture.'})});
await api('/users/'+lab.userId+'/preferences',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify([{user_id:lab.userId,category:'display_settings',name:'collapse_previews',value:'true'}])});
await win.loadURL(lab.origin+'/'+lab.team+'/channels/'+lab.channelName);
const wait=async(s)=>{const end=Date.now()+20000;while(!await evaluate(s)){if(Date.now()>end)throw Error(s);await pause(100);}};
await wait("Boolean(document.querySelector('#post_textbox'))");await pause(700);
await evaluate("Array.from(document.querySelectorAll('*')).find(e=>!e.childElementCount&&e.textContent.trim().startsWith('No thanks'))?.click()");await pause(200);
await evaluate("document.querySelector('#post_textbox').focus();document.querySelector('#post_textbox').select()");await wc.insertText('');
assert.equal(await evaluate("document.querySelector('#post_textbox').value"),'','reset only the lab draft before testing');
console.log('Local webapp ready',await evaluate("({fluent:document.documentElement.hasAttribute('data-mm-fluent'),editor:!!document.querySelector('#post_textbox'),sidebar:!!document.querySelector('#SidebarContainer')})"));

const check=async(label)=>{const result=await evaluate(`Array.from(document.querySelectorAll('[data-testid="fileAttachmentList"]')).map(list=>{const bubble=list.closest('.post__content').querySelector(':scope > .post__img + div').getBoundingClientRect(),r=list.getBoundingClientRect();return {width:r.width,fit:r.width>0&&r.left>=bubble.left-1&&r.right<=bubble.right+1,cards:Array.from(list.children).every(c=>{const b=c.getBoundingClientRect();return b.left>=r.left-1&&b.right<=r.right+1&&c.scrollWidth<=c.clientWidth+1})}})`);assert.ok(result.length&&result.every(r=>r.fit&&r.cards),label+JSON.stringify(result));};
for(const width of [1440,900,600]){win.setSize(width,960);for(const theme of ['dark','light']){wc.send('fluent-settings-changed',{...settings,theme});await pause(250);for(const own of [false,true]){await evaluate(`{const posts=document.querySelectorAll('[data-testid=postView]');posts[posts.length-1].classList.toggle('current--user',${own});}void 0`);await pause(80);await check(width+' '+theme+' '+own);}}}
win.setSize(1440,960);wc.setZoomFactor(1.25);await pause(300);await check('zoom125');
wc.setZoomFactor(1);await pause(200);
await evaluate(`document.getElementById('${root.id}_message').querySelector('.ReplyButton').click()`);
await wait("Boolean(document.querySelector('#reply_textbox'))");await pause(300);
await check('thread');
fs.writeFileSync('artifacts/fluent-legacy-attachments-fixed.png',(await wc.capturePage()).toPNG());
console.log('PASS legacy attachment-only cards, both lanes/themes, 600/900/1440, 125% zoom and thread');win.destroy();app.quit();})().catch(e=>{console.error(e);app.exit(1)});
