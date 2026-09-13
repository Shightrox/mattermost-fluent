// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Repository artwork from synthetic showcase captures; no account or network access.
const fs = require('fs');
const path = require('path');
if (!process.versions.electron) {
    const env = {...process.env}; delete env.ELECTRON_RUN_AS_NODE;
    const result = require('child_process').spawnSync(require('electron'), [__filename], {env, stdio: 'inherit', windowsHide: true});
    process.exit(result.status ?? 1);
}
const {app, BrowserWindow} = require('electron');
app.commandLine.appendSwitch('force-device-scale-factor', '1');
app.setPath('userData', path.join(app.getPath('temp'), 'fluent-repository-art'));
const png = name => 'data:image/png;base64,' + fs.readFileSync('docs/images/' + name).toString('base64');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const css = `*{box-sizing:border-box}html,body{width:100%;height:100%;overflow:hidden}body{margin:0;font-family:'Segoe UI',sans-serif;color:#eef4f6;background:#11191e}body:before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 20% 100%,#327d8040,transparent 65%),radial-gradient(ellipse at 100% 0,#9b80cf35,transparent 70%);pointer-events:none}h1,p{margin:0}small{letter-spacing:3px;color:#91b7c4;font-weight:600}h1{font-size:66px;line-height:1.04;font-weight:600;letter-spacing:-3px}p{color:#afc0c9;line-height:1.6;font-size:20px}.shot{border:1px solid #ffffff24;border-radius:16px;box-shadow:0 30px 80px #0008}.tag{display:inline-block;background:#ffffff0a;border:1px solid #ffffff1a;border-radius:100px;padding:8px 14px;font-size:13px;color:#c2d5de}footer{position:absolute;left:56px;bottom:30px;color:#8a9da7;font-size:12px}`;
(async () => {
    await app.whenReady();
    const win = new BrowserWindow({show:false,width:1280,height:640,webPreferences:{offscreen:true,sandbox:true,backgroundThrottling:false}});
    const render = async (body,w,h,file) => {
        win.setContentSize(w,h);
        fs.writeFileSync('artifacts/repository-stage.html','<meta charset="utf-8"><style>'+css+'</style>'+body);
        await win.loadFile(path.resolve('artifacts/repository-stage.html'));
        await win.webContents.executeJavaScript('Promise.all(Array.from(document.images).map(i=>i.decode()))');
        await wait(100);
        fs.writeFileSync(file,(await win.webContents.capturePage()).toPNG());
    };
    await render(`<div style="position:absolute;left:56px;top:58px"><small>MATTERMOST FLUENT</small><h1 style="margin-top:45px">Work feels<br>a little<br><span style="color:#a9d8db">lighter.</span></h1><p style="margin-top:28px">Familiar conversations.<br>A softer Windows experience.</p><div style="margin-top:28px"><span class="tag">WINDOWS</span> <span class="tag">COMMUNITY PREVIEW</span></div></div><img class="shot" src="${png('showcase-dark.png')}" style="position:absolute;width:870px;left:490px;top:98px;transform:rotate(-3deg)"><footer>Client-side appearance · Fictional demo · Emulated backdrop</footer>`,1280,640,'docs/images/cover.png');
    // Same art, separate asset for GitHub's 2:1 social-preview slot.
    fs.copyFileSync('docs/images/cover.png','docs/images/social-preview.png');
    await render(`<div style="position:absolute;left:48px;top:36px"><small>A DIFFERENT MOOD. THE SAME WORKSPACE.</small></div><div style="position:absolute;inset:92px 36px 28px;display:grid;grid-template-columns:repeat(3,1fr);gap:22px">${[['dark','Ocean / Iris','Quiet after dark'],['light','Sand / Indigo','A brighter workspace'],['thread','Plum / Rose','A warmer conversation']].map(([file,title,sub])=>`<div style="overflow:hidden;border:1px solid #ffffff1d;border-radius:18px;background:#ffffff04"><img src="${png('showcase-'+file+'.png')}" style="width:100%;display:block"><div style="padding:22px"><h2 style="font-weight:500;font-size:23px;margin:0 0 8px">${title}</h2><p style="font-size:16px">${sub}</p></div></div>`).join('')}</div>`,1280,470,'docs/images/theme-gallery.png');
    const {GIFEncoder,quantize,applyPalette} = require(path.resolve('artifacts/visual-tools/node_modules/gifenc'));
    const source=require('@babel/core').transformFileSync('src/common/fluentLiquid.ts',{configFile:false,presets:[['@babel/preset-env',{targets:{chrome:'140'}}],'@babel/preset-typescript']}).code;
    const motion=fs.readFileSync('src/common/motion.fluent.css','utf8');
    await render(`<style>${motion}html{--fp-accent:#a6d9e2}button{position:absolute;top:133px;width:270px;height:58px;border-radius:12px;border:1px solid #ffffff26;background:#ffffff0b;color:#dce9ee;font:500 18px 'Segoe UI';text-align:left;padding-left:24px}#cursor{position:fixed;width:11px;height:11px;border:2px solid #e7f6ff;border-radius:50%;box-shadow:0 0 8px #000;pointer-events:none;z-index:2147483647}</style><small style="position:absolute;left:40px;top:32px">A LITTLE LIGHT, RIGHT WHERE YOU ARE.</small><p style="position:absolute;left:40px;top:67px;font-size:16px">Cursor-local glow. Click-origin ripples.</p><button style="left:40px">Explore a conversation</button><button style="left:330px">Make it yours</button><div id="cursor"></div><footer style="left:40px;bottom:20px;font-size:11px">Actual client effect · Isolated demonstration controls</footer>`,640,250,'artifacts/motion-still.png');
    await win.webContents.executeJavaScript(`(()=>{const exports={};${source};window.liquid=exports.createFluentLiquid(document,window);window.liquid.update(true)})()`);
    const gif=GIFEncoder();
    for(let i=0;i<64;i++){
        const x=Math.round(i<32?65+i*7:350+(i-32)*7),y=162;
        win.webContents.sendInputEvent({type:'mouseMove',x,y});
        if(i===18||i===48){win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,x,y});win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,x,y});}
        await win.webContents.executeJavaScript(`document.getElementById('cursor').style.cssText='left:${x-5}px;top:${y-5}px'`);
        await wait(55);
        const capture=(await win.webContents.capturePage()).resize({width:640,height:250});
        if(i===18){
            if(!await win.webContents.executeJavaScript('Boolean(document.querySelector("[data-fluent-liquid]:not([hidden])"))')) throw new Error('Liquid effect did not render');
            fs.writeFileSync('artifacts/liquid-check.png',capture.toPNG());
        }
        const pixels=capture.toBitmap();
        for(let p=0;p<pixels.length;p+=4){const blue=pixels[p];pixels[p]=pixels[p+2];pixels[p+2]=blue;}
        const palette=quantize(pixels,128);
        gif.writeFrame(applyPalette(pixels,palette),640,250,{palette,delay:90});
    }
    gif.finish();fs.writeFileSync('docs/images/liquid.gif',gif.bytes());
    win.destroy();app.quit();console.log('Repository artwork and liquid demonstration rendered.');
})().catch(error=>{console.error(error);app.exit(1);});
