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
await wait("document.querySelectorAll('.FluentNavigation button').length===4");
await evaluate("document.querySelector('#post_textbox').focus()");await wc.insertText('Navigation draft stays intact.');
await pause(500);
for(const section of ['threads','drafts']){
    await wait(`!document.querySelector('.FluentNavigation [data-section=${section}]').disabled`);
    await evaluate(`document.querySelector('.FluentNavigation [data-section=${section}]').click()`);
    await wait(`location.pathname.endsWith('/${section}')`);
    await wait(`document.querySelector('.FluentNavigation [data-section=${section}]').hasAttribute('aria-current')`);
    await evaluate("document.querySelector('.FluentNavigation [data-section=chats]').click()");
    await wait("Boolean(document.querySelector('#post_textbox'))");
    assert.equal(await evaluate("document.querySelector('#post_textbox').value"),'Navigation draft stays intact.','draft survives '+section+' round trip');
}
await evaluate("document.querySelector('.FluentNavigation [data-section=saved]').click()");
await wait("document.querySelector('.FluentNavigation [data-section=saved]').hasAttribute('aria-current')");
await evaluate("document.querySelector('.FluentNavigation [data-section=chats]').click()");
await wait("document.querySelector('.FluentNavigation [data-section=chats]').hasAttribute('aria-current')");
await evaluate("document.querySelector('#channel-info-btn').click()");
await wait("Boolean(document.querySelector('#channelInfoRHSChannelSettings'))");
assert.ok(await evaluate("document.querySelector('#rhsContainer').innerText.includes('Thoughtful details. Better everyday conversations.')"),'header description remains accessible in channel info');
await evaluate("document.querySelector('#rhsCloseButton').click();document.querySelector('#post_textbox').focus();document.querySelector('#post_textbox').select()");await wc.insertText('');
console.log('PASS: production navigation, draft round trips, saved panel and channel description.');
// Dismiss optional onboarding only when the button is present; never accept terms.
console.log('Visible dialogs',await evaluate("Array.from(document.querySelectorAll('[role=dialog]')).map(e=>({id:e.id,buttons:Array.from(e.querySelectorAll('button')).map(b=>({id:b.id,label:b.getAttribute('aria-label')}))}))"));
for(const [theme,accent,textSize] of [['dark','blue','standard'],['light','violet','standard'],['dark','green','large']]){wc.send('fluent-settings-changed',{...settings,theme,accent,textSize});await pause(250);fs.writeFileSync(`artifacts/fluent-lab-${theme}-${accent}.png`,(await wc.capturePage()).toPNG());const sizes=await evaluate("(()=>{const e=document.querySelector('#post_textbox'),b=e.getBoundingClientRect();return {font:getComputedStyle(e).fontSize,height:b.height,client:e.clientHeight,scroll:e.scrollHeight}})()");assert.ok(sizes.client>=sizes.scroll,'empty one-line editor fits');console.log('Theme check',theme,accent,textSize,sizes);}
wc.send('fluent-settings-changed',settings);await pause(100);
await evaluate("document.querySelector('#post_textbox').focus()");await wc.insertText('Fluent laboratory: editor submission smoke test.');
console.log('Editor actions',await evaluate("Array.from(document.querySelectorAll('.AdvancedTextEditor button')).map(e=>({id:e.id,label:e.getAttribute('aria-label'),disabled:e.disabled}))"));
await evaluate("document.querySelector('.AdvancedTextEditor button[aria-label=\"Send Now\"]').click()");
await wait("document.querySelector('#post_textbox').value === ''");
const posts=await (await fetch(lab.origin+'/api/v4/channels/'+lab.channelId+'/posts',{headers:{Authorization:'Bearer '+lab.token}})).json();assert.ok(Object.values(posts.posts).some(p=>p.message==='Fluent laboratory: editor submission smoke test.'),'real webapp submitted the synthetic post');
// Upload a generated text fixture through the real webapp file input.
await evaluate("(()=>{const input=document.querySelector('input[type=file]');if(!input)throw Error('Missing file input');const transfer=new DataTransfer();transfer.items.add(new File(['Fluent local attachment fixture.'], 'fluent-fixture.txt', {type:'text/plain'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()");
await pause(1200);
await evaluate("document.querySelector('#post_textbox').focus()");await wc.insertText('Fluent laboratory: attachment smoke test.');
await wait("!document.querySelector('.AdvancedTextEditor button[aria-label=\"Send Now\"]').disabled");
await evaluate("document.querySelector('.AdvancedTextEditor button[aria-label=\"Send Now\"]').click()");
await wait("document.querySelector('#post_textbox').value === ''");
const uploaded=await (await fetch(lab.origin+'/api/v4/channels/'+lab.channelId+'/posts',{headers:{Authorization:'Bearer '+lab.token}})).json();assert.ok(Object.values(uploaded.posts).some(p=>p.message==='Fluent laboratory: attachment smoke test.'&&p.file_ids?.length),'real webapp submitted the attachment');
console.log('PASS: generated attachment uploaded and attached to a synthetic post.');
// Keep the thread fixture in the current virtualized window, even after many runs.
const latestAttachment=Object.values(uploaded.posts).filter(p=>p.message==='Fluent laboratory: attachment smoke test.'&&p.file_ids?.length).sort((a,b)=>b.create_at-a.create_at)[0];
const reply=await fetch(lab.origin+'/api/v4/posts',{method:'POST',headers:{Authorization:'Bearer '+lab.token,'Content-Type':'application/json'},body:JSON.stringify({channel_id:lab.channelId,root_id:latestAttachment.id,message:'Local thread fixture for this test run.\n\n'+Array.from({length:18},(_,i)=>'Context scroll fixture line '+(i+1)+'.').join('\n\n')})});assert.ok(reply.ok,'fresh thread fixture created on the local test server');

await evaluate("document.querySelector('#post_textbox').focus()");await wc.insertText('Unsent local draft\nSecond line stays in the editor.');wc.send('fluent-settings-changed',{...settings,enabled:false});await pause(100);wc.send('fluent-settings-changed',{...settings,accent:'violet'});await pause(100);assert.equal(await evaluate("document.querySelector('#post_textbox').value"),'Unsent local draft\nSecond line stays in the editor.');
wc.send('fluent-settings-changed',{...settings,textSize:'large'});await pause(250);assert.equal(await evaluate("(()=>{const e=document.querySelector('#post_textbox');return e.clientHeight>=e.scrollHeight})()"),true,'changing message size immediately resizes a multiline draft');console.log('Live draft resize',await evaluate("(()=>{const e=document.querySelector('#post_textbox');return {client:e.clientHeight,scroll:e.scrollHeight,ref:document.querySelector('#post_textbox-reference').scrollHeight}})()"));
wc.reload();await wait("Boolean(document.querySelector('#post_textbox'))");await pause(400);assert.equal(await evaluate("document.querySelector('#post_textbox').value"),'Unsent local draft\nSecond line stays in the editor.','draft survives reload');
console.log('Reply actions',await evaluate("Array.from(document.querySelectorAll('button,a,[role=button]')).filter(e=>/reply|replies/i.test((e.getAttribute('aria-label')||'')+' '+e.textContent)).map(e=>({id:e.id,cl:e.className,label:e.getAttribute('aria-label')}))"));
await wait(`Boolean(document.getElementById('${latestAttachment.id}_message')?.querySelector('.ReplyButton'))`);await evaluate(`document.getElementById('${latestAttachment.id}_message').querySelector('.ReplyButton').click()`);await wait("Boolean(document.querySelector('#rhsContainer textarea, .sidebar--right textarea'))");await pause(300);
await wait("Boolean(document.querySelector('.FluentContext'))");
await evaluate("document.querySelector('#reply_textbox').focus();document.querySelector('#reply_textbox').select()");await wc.insertText('Context reply draft stays intact.');
await evaluate("document.querySelector('#threadViewerScrollContainer').scrollTop=80");await pause(200);
const savedThreadScroll=await evaluate("document.querySelector('#threadViewerScrollContainer').scrollTop");assert.ok(savedThreadScroll>0,'thread fixture has a nonzero scroll position');
for(const section of ['files','info','members']){
    await evaluate(`document.querySelector('.FluentContext [data-context=${section}]').click()`);await pause(400);
    await wait(`document.querySelector('.FluentContext [data-context=${section}]').getAttribute('aria-pressed')==='true'`);
    assert.equal(await evaluate("Boolean(document.querySelector('#reply_textbox'))"),false,section+' replaces the thread content');
    await wait("!document.querySelector('.FluentContext [data-context=thread]').disabled");
    await evaluate("document.querySelector('.FluentContext [data-context=thread]').click()");
    await wait("Boolean(document.querySelector('#reply_textbox'))");await pause(250);
    assert.equal(await evaluate("document.querySelector('#reply_textbox').value"),'Context reply draft stays intact.','reply draft survives '+section);
    assert.ok(Math.abs(await evaluate("document.querySelector('#threadViewerScrollContainer').scrollTop")-savedThreadScroll)<3,'thread position survives '+section);
    assert.equal(await evaluate("document.querySelector('#post_textbox').value"),'Unsent local draft\nSecond line stays in the editor.','channel draft survives context switch');
}
await evaluate("document.querySelector('#reply_textbox').focus();document.querySelector('#reply_textbox').select()");await wc.insertText('');
console.log('PASS: context switching preserves both drafts and thread scroll.');
for(const [width,height,zoom] of [[1440,960,1],[1200,900,1.25],[1200,900,1.5],[840,680,1],[600,720,1]]){wc.setZoomFactor(zoom);await pause(200);win.setSize(width,height);await pause(200);await wait(`Math.abs(innerWidth-${width/zoom})<3`);const layout=await evaluate("(()=>{const e=document.querySelector('#post_textbox'),c=e.closest('.AdvancedTextEditor__body'),b=e.getBoundingClientRect(),r=c.getBoundingClientRect();return {viewport:innerWidth,right:r.right,editorWidth:b.width,fits:b.right<=r.right+1&&b.left>=r.left-1,overflow:document.documentElement.scrollWidth>innerWidth+1}})()");assert.ok(layout.fits&&layout.editorWidth>80&&!layout.overflow,'editor and canvas fit the viewport');const contextLayout=await evaluate("(()=>{const p=document.querySelector('#sidebar-right').getBoundingClientRect(),c=document.querySelector('#channel_view');return {left:p.left,right:p.right,width:p.width,narrow:document.documentElement.hasAttribute('data-mm-fluent-context-narrow'),inert:c.inert,hidden:getComputedStyle(c).visibility==='hidden'}})()");console.log('Context dimensions',width,contextLayout);assert.ok(contextLayout.left>=-1&&contextLayout.right<=layout.viewport+1,'context fits the viewport');if(width/zoom<=1100)assert.ok(contextLayout.narrow&&contextLayout.inert&&contextLayout.hidden&&contextLayout.width>300,'narrow mode has one usable context and no focusable covered editor');else assert.ok(!contextLayout.inert&&!contextLayout.hidden,'wide mode restores conversation accessibility');console.log('Viewport',width,height,zoom,layout,contextLayout);try{fs.writeFileSync('artifacts/fluent-lab-'+width+'-'+zoom+'.png',(await wc.capturePage()).toPNG());}catch(error){if(!String(error).includes('UnknownVizError'))throw error;unavailableCaptures.push({width,height,zoom});console.warn('UNVERIFIED screenshot: offscreen compositor capture failed',width,height,zoom);}}
await evaluate("document.querySelector('.FluentContext [data-context=info]').click()");await wait("Boolean(document.querySelector('#channelInfoRHSChannelSettings'))");
assert.equal(await evaluate("document.querySelector('#channel_view').inert"),true,'context switching in narrow mode keeps the covered conversation inert');
await evaluate("document.querySelector('.FluentContext [data-context=thread]').click()");await wait("Boolean(document.querySelector('#reply_textbox'))");
await evaluate("document.querySelector('.FluentContext [data-context=back]').click()");await wait("!document.documentElement.hasAttribute('data-mm-fluent-context')");
assert.equal(await evaluate("document.querySelector('#channel_view').inert"),false,'back restores keyboard navigation');
await wait("document.activeElement.id==='post_textbox'");assert.equal(await evaluate("document.activeElement.id"),'post_textbox','back returns focus to the channel editor');
assert.equal(await evaluate("document.querySelector('#post_textbox').value"),'Unsent local draft\nSecond line stays in the editor.','narrow back preserves the channel draft');
await evaluate(`document.getElementById('${latestAttachment.id}_message').querySelector('.ReplyButton').click()`);await wait("Boolean(document.querySelector('#reply_textbox'))");
console.log('Sizing mirrors',await evaluate("Array.from(document.querySelectorAll('.AdvancedTextEditor .AutoHeight')).map(e=>({font:getComputedStyle(e).fontSize,line:getComputedStyle(e).lineHeight,children:Array.from(e.children).map(c=>({tag:c.tagName,cl:c.className,font:getComputedStyle(c).fontSize,line:getComputedStyle(c).lineHeight}))}))"));
assert.equal(await evaluate("(()=>{const e=document.querySelector('#reply_textbox');return e.clientHeight>=e.scrollHeight})()"),true,'empty thread editor has no phantom scrollbar');
console.log('Thread editor',await evaluate("Array.from(document.querySelectorAll('.AdvancedTextEditor textarea')).map(e=>({id:e.id,font:getComputedStyle(e).fontFamily,width:e.getBoundingClientRect().width,padding:getComputedStyle(e).padding,min:getComputedStyle(e).minHeight,client:e.clientHeight,scroll:e.scrollHeight,line:getComputedStyle(e).lineHeight}))"));
console.log('PASS: actual local server functional checks, themes, input, submission, draft reload, thread and viewport geometry.');if(unavailableCaptures.length)console.warn('Visual coverage incomplete:',JSON.stringify(unavailableCaptures));win.destroy();app.exit(unavailableCaptures.length ? 1 : 0);
})().catch(e=>{console.error(e);app.exit(1)});
