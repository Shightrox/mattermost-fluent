// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Public artwork uses only these fictional accounts on the explicit local lab.
const fs=require('fs'),assert=require('assert/strict');
if(!process.versions.electron){const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;const r=require('child_process').spawnSync(require('electron'),[__filename],{env,stdio:'inherit',windowsHide:true});process.exit(r.status??1);}
const {app,nativeImage}=require('electron');
(async()=>{
 await app.whenReady();
 const lab=JSON.parse(fs.readFileSync('artifacts/fluent-lab-session.json','utf8'));assert.equal(lab.origin,'http://localhost:18065');
 const api=async(route,data,token=lab.token,method=data?'POST':'GET')=>{const response=await fetch(lab.origin+'/api/v4'+route,{method,headers:{Authorization:'Bearer '+token,...(data instanceof FormData?{}:{'Content-Type':'application/json'})},body:data?(data instanceof FormData?data:JSON.stringify(data)):undefined});if(!response.ok)throw Error(route+': '+response.status);return {data:await response.json(),token:response.headers.get('Token')}};
 const users=[];
 for(const [username,first_name,last_name] of [['alex-demo','Alex','Kim'],['maya-demo','Maya','Chen'],['jordan-demo','Jordan','Lee']]){
  let user;try{user=(await api('/users/username/'+username)).data;}catch{user=(await api('/users',{username,first_name,last_name,email:username+'@fluent-demo.invalid',password:'Local-Demo-Only-2026!'})).data;}
  const login=await api('/users/login',{login_id:username,password:'Local-Demo-Only-2026!'});users.push({...user,token:login.token});
 }
 let team;try{team=(await api('/teams/name/northstar-showcase')).data;}catch{team=(await api('/teams',{name:'northstar-showcase',display_name:'Northstar Studio',type:'O'})).data;}
 for(const user of users){try{await api('/teams/'+team.id+'/members',{team_id:team.id,user_id:user.id});}catch(error){if(!String(error).includes('400'))throw error;}}
 let design;
 for(const [name,display_name] of [['studio','studio'],['design-lab','design-lab'],['engineering','engineering'],['inspiration','inspiration']]){
  let channel;try{channel=(await api('/teams/'+team.id+'/channels/name/'+name)).data;}catch{channel=(await api('/channels',{team_id:team.id,name,display_name,type:'O',header:name==='design-lab'?'Small details. Better conversations.':''})).data;}
  for(const user of users){try{await api('/channels/'+channel.id+'/members',{user_id:user.id});}catch(error){if(!String(error).includes('400'))throw error;}}
  if(name==='design-lab')design=channel;
 }
 for(const user of users)await api('/users/'+user.id+'/preferences',[{user_id:user.id,category:'display_settings',name:'name_format',value:'full_name'},{user_id:user.id,category:'display_settings',name:'collapse_previews',value:'false'},{user_id:user.id,category:'tutorial_step',name:user.id,value:'999'}],user.token,'PUT');
 const posts=(await api('/channels/'+design.id+'/posts')).data;
 if(!Object.values(posts.posts).some(p=>!p.type)){
  await api('/posts',{channel_id:design.id,message:'Morning, team. A little room to think, a little color to make it ours. ✨'},users[1].token);
  const width=1100,height=280,bitmap=Buffer.alloc(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   const u=x/width,v=y/height,a=Math.exp(-((u-.22)**2*10+(v-.2)**2*3)),b=Math.exp(-((u-.78)**2*9+(v-.9)**2*5));
   const band=Math.sin(u*8+v*3)*.035;const i=(y*width+x)*4;
   bitmap[i]=60+145*a+85*b;bitmap[i+1]=35+80*a+125*b;bitmap[i+2]=25+90*a+75*b;
   if(v>.6+Math.sin(u*5)*.14+band){bitmap[i]*=.56;bitmap[i+1]*=.65;bitmap[i+2]*=.78;}bitmap[i+3]=255;
  }
  const form=new FormData();form.set('channel_id',design.id);form.set('files',new Blob([nativeImage.createFromBitmap(bitmap,{width,height}).toPNG()],{type:'image/png'}),'northern-light.png');
  const file=(await api('/files',form,users[1].token)).data.file_infos[0];
  const concept=(await api('/posts',{channel_id:design.id,message:'Today’s direction: soft light, quiet surfaces, clear focus.',file_ids:[file.id]},users[1].token)).data;
  await api('/reactions',{user_id:users[0].id,post_id:concept.id,emoji_name:'sparkles'},users[0].token);
  await api('/reactions',{user_id:users[2].id,post_id:concept.id,emoji_name:'heart'},users[2].token);
  await api('/posts',{channel_id:design.id,message:'Love this. Ocean glass with a little iris accent feels just right.',root_id:concept.id},users[2].token);
  await api('/posts',{channel_id:design.id,message:'And the colors stay local — everyone can make it their own.',root_id:concept.id},users[0].token);
  await api('/posts',{channel_id:design.id,message:'The calmer canvas makes the conversation stand out. Let’s keep it.'},users[0].token);
  await api('/posts',{channel_id:design.id,message:'I’ll collect the next round of ideas in a thread. Ready when you are. ☕'},users[2].token);
 }
 const latest=(await api('/channels/'+design.id+'/posts')).data;
 if(!Object.values(latest.posts).some(p=>p.message==='Exactly. Let’s build something that feels good to use.'))await api('/posts',{channel_id:design.id,message:'Exactly. Let’s build something that feels good to use.'},users[0].token);
 // Remove only setup notices in this newly-created synthetic showcase channel.
 // Keep the capture focused on the fictional conversation.
 for(const post of Object.values(latest.posts))if(post.type?.startsWith('system_'))await api('/posts/'+post.id,undefined,lab.token,'DELETE');
 fs.writeFileSync('artifacts/fluent-showcase-session.json',JSON.stringify({origin:lab.origin,team:team.name,channelName:design.name,channelId:design.id,userId:users[0].id,token:users[0].token,threadId:Object.values(latest.posts).find(p=>p.file_ids?.length)?.id}));
 console.log('Fictional Northstar showcase ready.');app.quit();
})().catch(error=>{console.error(error);app.exit(1)});
