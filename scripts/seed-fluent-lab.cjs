// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Synthetic localhost-only lab bootstrap. Credentials are not for deployment.
const fs=require('fs');const base='http://localhost:18065/api/v4';
async function request(route,data,token){const r=await fetch(base+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:data?JSON.stringify(data):undefined});const j=await r.json();if(!r.ok)throw Error(route+' '+r.status+' '+j.id);return {data:j,token:r.headers.get('Token')}}
(async()=>{const ping=await request('/system/ping');
const credentials={email:'designer@fluent-lab.invalid',username:'designer',password:'FluentLab-Only-2026!'};
try{await request('/users',credentials)}catch(e){if(!/400|403/.test(String(e)))throw e;}
const login=await request('/users/login',{login_id:credentials.username,password:credentials.password});const token=login.token;if(!token)throw Error('Missing lab token');
let teams=(await request('/users/me/teams',undefined,token)).data;let team=teams.find(t=>t.name==='fluent-studio');if(!team)team=(await request('/teams',{name:'fluent-studio',display_name:'Fluent Studio',type:'O'},token)).data;
let channels=(await request('/users/me/teams/'+team.id+'/channels',undefined,token)).data;
for(const name of ['design','engineering','inspiration','releases','announcements']){if(!channels.some(c=>c.name===name)){channels.push((await request('/channels',{team_id:team.id,name,display_name:name,type:'O',header:'Thoughtful details. Better everyday conversations.'},token)).data)}}
const channel=channels.find(c=>c.name==='design');const posts=(await request('/channels/'+channel.id+'/posts',undefined,token)).data;
if(!Object.values(posts.posts).some(p=>p.message.startsWith('Welcome to Fluent Studio.'))){for(const message of ['Welcome to Fluent Studio. This is an isolated design and compatibility workspace.','A calmer place to work.\n\nThe conversation stays readable. Navigation, menus and focus share one visual language.','## Interface review\n- One conversation canvas\n- Consistent outline icons\n- Local accents and message size\n\n> Small details should make everyday work easier.','```typescript\nconst appearance = {theme: "dark", accent: "sky"};\n```\nCode keeps its own typography.','Layout check: **bold**, *italic*, ~~removed~~, https://example.com, :wave: and a longer paragraph that wraps naturally when the thread pane opens.'])await request('/posts',{channel_id:channel.id,message},token);}
const latest=(await request('/channels/'+channel.id+'/posts',undefined,token)).data;const rootPost=Object.values(latest.posts).find(p=>p.message.startsWith('Welcome to Fluent Studio.'));if(rootPost&&!rootPost.reply_count)await request('/posts',{channel_id:channel.id,root_id:rootPost.id,message:'A synthetic thread reply for the right panel layout check.'},token);
fs.writeFileSync('artifacts/fluent-lab-session.json',JSON.stringify({origin:'http://localhost:18065',token,userId:login.data.id,team:team.name,channelId:channel.id,channelName:channel.name}));console.log('Lab ready: seeded synthetic messages and channels on localhost only.');
})().catch(e=>{console.error(e.message);process.exit(1)});
