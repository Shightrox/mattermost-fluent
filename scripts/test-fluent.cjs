// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Runs the actual controller and stylesheet in sandboxed Electron/Chromium.
// All data is synthetic; no Mattermost account or network service is used.
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts');

if (!process.versions.electron) {
    const {spawnSync} = require('child_process');
    const env = {...process.env};
    delete env.ELECTRON_RUN_AS_NODE;
    const result = spawnSync(require('electron'), [__filename], {env, stdio: 'inherit', windowsHide: true});
    process.exit(result.status ?? 1);
}

const {app, BrowserWindow} = require('electron');
app.on('window-all-closed', () => {});
const http = require('http');
const babel = require('@babel/core');
app.setPath('userData', path.join(app.getPath('temp'), 'mattermost-fluent-ui-tests'));
const pause = (ms = 50) => new Promise((resolve) => setTimeout(resolve, ms));
let server;

async function run() {
    fs.mkdirSync(output, {recursive: true});
    let source = babel.transformFileSync(path.join(root, 'src/app/preload/fluent/controller.ts'), {
        configFile: false,
        presets: [['@babel/preset-env', {targets: {chrome: '140'}}], '@babel/preset-typescript'],
    }).code.replace('require("common/fluentScroll")', 'scrollAPI').replace('require("./navigation")', 'navigationAPI').replace('require("./context")', 'contextAPI').replace('require("./composer")', 'composerAPI').replace('require("./media")', 'mediaAPI').replace('require("./personal")', 'personalAPI').replace('require("./entrances")', 'entrancesAPI').replace('require("./spacing")', 'spacingAPI');
    source = source.replace('require("common/fluentLiquid")', 'liquidAPI');
    const liquidSource = babel.transformFileSync(path.join(root, 'src/common/fluentLiquid.ts'), {configFile:false,presets:[['@babel/preset-env',{targets:{chrome:'140'}}], '@babel/preset-typescript']}).code;
    const contextSource = babel.transformFileSync(path.join(root, 'src/app/preload/fluent/context.ts'), {
        configFile: false,
        presets: [['@babel/preset-env', {targets: {chrome: '140'}}], '@babel/preset-typescript'],
    }).code.replace('require("./search")', 'searchAPI');
    const searchSource = babel.transformFileSync(path.join(root, 'src/app/preload/fluent/search.ts'), {
        configFile: false,
        presets: [['@babel/preset-env', {targets: {chrome: '140'}}], '@babel/preset-typescript'],
    }).code;
    const navigationSource = babel.transformFileSync(path.join(root, 'src/app/preload/fluent/navigation.ts'), {
        configFile: false,
        presets: [['@babel/preset-env', {targets: {chrome: '140'}}], '@babel/preset-typescript'],
    }).code;
    const scrollSource = babel.transformFileSync(path.join(root, 'src/common/fluentScroll.ts'), {
        configFile: false,
        presets: [['@babel/preset-env', {targets: {chrome: '140'}}], '@babel/preset-typescript'],
    }).code;
    const adapters = ['composer', 'media', 'personal', 'entrances', 'spacing'].map(name => {
        const code = babel.transformFileSync(path.join(root, 'src/app/preload/fluent/'+name+'.ts'), {configFile:false,presets:[['@babel/preset-env',{targets:{chrome:'140'}}], '@babel/preset-typescript']}).code;
        return `const ${name}API = (() => { const exports = {}; ${code}; return exports; })();`;
    }).join('\n');
    const preload = path.join(output, 'fluent-test-preload.cjs');
    fs.writeFileSync(preload, `${adapters}
const scrollAPI = (() => { const exports = {}; ${scrollSource}; return exports; })();
const liquidAPI = (() => { const exports = {}; ${liquidSource}; return exports; })();
        const navigationAPI = (() => { const exports = {}; ${navigationSource}; return exports; })();
        const searchAPI = (() => { const exports = {}; ${searchSource}; return exports; })();
        const contextAPI = (() => { const exports = {}; ${contextSource}; return exports; })();
        const api = (() => { const exports = {}; ${source}; return exports; })();
        const {contextBridge} = require('electron');
        window.addEventListener('DOMContentLoaded', () => {
            const controller = api.createFluentController(document, window);
            contextBridge.exposeInMainWorld('fluentTest', {...controller, isServerPage: api.isFluentServerPage});
        });`);
    const html = fs.readFileSync(path.join(__dirname, 'fixtures/fluent.html'));
    server = http.createServer((req, res) => {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src data:");
        res.end(html);
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    await app.whenReady();
    const win = new BrowserWindow({width: 1280, height: 850, show: false, webPreferences: {preload, offscreen: true, backgroundThrottling: false, sandbox: true, contextIsolation: true, nodeIntegration: false}});
    win.webContents.on('console-message', (event) => console.log('renderer', event.message));
    await win.loadURL(`${origin}/work/team/channels/design`);
    await win.webContents.insertCSS(fs.readFileSync(path.join(root, 'src/common/palette.fluent.css'), 'utf8'), {cssOrigin: 'user'});
    for (const file of ['src/common/tokens.fluent.css', 'src/app/preload/fluent/styles.fluent.css', 'src/app/preload/fluent/layout.fluent.css', 'src/common/icons.fluent.css', 'src/common/motion.fluent.css', 'src/app/preload/fluent/navigation.fluent.css', 'src/app/preload/fluent/context.fluent.css', 'src/app/preload/fluent/chat.fluent.css', 'src/app/preload/fluent/sidebar.fluent.css', 'src/app/preload/fluent/surfaces.fluent.css', 'src/app/preload/fluent/personal.fluent.css']) {
        await win.webContents.insertCSS(fs.readFileSync(path.join(root, file), 'utf8'));
    }
    const evaluate = (code) => win.webContents.executeJavaScript(code);
    const settings = {enabled: true, motion: true, material: 'solid', serverURL: `${origin}/work/`};
    const update = (patch = {}) => evaluate(`window.fluentTest.update(${JSON.stringify({...settings, ...patch})})`);
    const marked = () => evaluate("document.documentElement.hasAttribute('data-mm-fluent')");
    const pointer = (id) => evaluate(`document.getElementById('${id}').dispatchEvent(new PointerEvent('pointerover', {bubbles:true, pointerType:'mouse'}))`);
    const waitFor = async (condition) => {
        const deadline = Date.now() + 4000;
        while (!await evaluate(condition)) {
            assert.ok(Date.now() < deadline, `Timed out: ${condition}`);
            await pause();
        }
    };

    await evaluate(`document.querySelector('.workspace').classList.add('main-wrapper');
        document.querySelector('.workspace').style.borderRadius = '16px';
        document.querySelector('.workspace').style.margin = '0 0 4px 4px';
        const heading = document.createElement('span'); heading.className = 'heading';
        heading.textContent = 'design'; document.querySelector('#channel-header').append(heading);`);
    await update();
    assert.equal(await marked(), true, 'recognized UI is styled');
    await update({enabled:false});
    await evaluate(`const style=document.createElement('style');style.id='spacing-style';style.textContent='.SpacingFixture > * + * {margin-left:8px}.SpacingFixture > div {margin-left:3px}.PanelHeader__right div + div {margin-left:12px}';document.head.append(style);
        const fixture=document.createElement('section');fixture.id='spacing-test';fixture.innerHTML='<div class="SpacingFixture"><div>A</div>text<span>B</span><div>C</div></div><div class="PanelHeader__right"><div>A</div><span>B</span><div>C</div><div>D</div></div>';document.body.append(fixture);
        window.spacingMargins=()=>Array.from(document.querySelectorAll('#spacing-test > div > *')).map(e=>getComputedStyle(e).marginLeft);void 0;`);
    const spacingBaseline=await evaluate('window.spacingMargins()');
    await update();await pause(100);
    assert.deepEqual(await evaluate('window.spacingMargins()'),spacingBaseline,'spacing selector rewrite preserves values and specificity');
    assert.ok(await evaluate("document.querySelector('#spacing-style').sheet.cssRules[0].selectorText.includes('data-mm-fluent-spaced')"),'late stylesheet is optimized');
    await evaluate("document.querySelector('.PanelHeader__right span').remove();const p=document.querySelector('.SpacingFixture');p.prepend(p.lastElementChild)");await pause(50);
    const spacingMutated=await evaluate('window.spacingMargins()');
    await update({enabled:false});await pause(50);
    assert.deepEqual(await evaluate('window.spacingMargins()'),spacingMutated,'insert/reorder/removal match restored native selectors');
    assert.equal(await evaluate("document.querySelector('#spacing-style').sheet.cssRules[0].selectorText"),'.SpacingFixture > * + *','native selector restored on opt-out');
    assert.equal(await evaluate("document.querySelectorAll('[data-mm-fluent-spaced], [data-mm-fluent-after-div]').length"),0,'all spacing markers removed');
    await evaluate("document.querySelector('#spacing-test').remove();document.querySelector('#spacing-style').remove()");
    await update();
    await evaluate(`const scroller=document.createElement('div');scroller.id='wheel-fixture';
        scroller.style.cssText='position:fixed;right:0;top:50px;width:120px;height:100px;overflow:auto;line-height:20px';
        scroller.innerHTML='<div style="height:2000px"><textarea></textarea></div>';document.querySelector('#SidebarContainer, #sidebar-left').append(scroller);
        window.testWheel=(options={})=>{const e=new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaMode:1,deltaY:3,...options});document.querySelector('#wheel-fixture').dispatchEvent(e);return e.defaultPrevented};void 0;`);
    assert.equal(await evaluate('window.testWheel()'), true, 'stepped wheel uses smooth scrolling');
    await update();
    await waitFor("document.querySelector('#wheel-fixture').scrollTop >= 59");
    const wheelPosition = await evaluate("document.querySelector('#wheel-fixture').scrollTop");
    assert.ok(wheelPosition >= 59 && wheelPosition <= 61, 'wheel reaches the exact intended distance: ' + wheelPosition);
    await evaluate("document.body.append(document.querySelector('#wheel-fixture'))");
    assert.equal(await evaluate('window.testWheel()'), false, 'conversation wheel is not intercepted by the sidebar handler');
    await evaluate("document.querySelector('#SidebarContainer, #sidebar-left').append(document.querySelector('#wheel-fixture'))");
    assert.equal(await evaluate('window.testWheel({deltaMode:0,deltaY:4.25})'), false, 'precision input stays native');
    assert.equal(await evaluate('window.testWheel({ctrlKey:true})'), false, 'zoom stays native');
    assert.equal(await evaluate(`(()=>{const e=new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaMode:1,deltaY:3});document.querySelector('#wheel-fixture textarea').dispatchEvent(e);return e.defaultPrevented})()`), false, 'editor scrolling stays native');
    await evaluate("window.testWheel(); document.querySelector('#wheel-fixture').scrollTop=300");
    await pause(120);
    assert.equal(await evaluate("document.querySelector('#wheel-fixture').scrollTop"), 300, 'external navigation cancels pending scroll');
    await evaluate('window.testWheel(); window.testWheel({deltaY:-3})');
    await waitFor("Math.abs(document.querySelector('#wheel-fixture').scrollTop-240)<1");
    await evaluate(`document.querySelector('#wheel-fixture').scrollTop=0;
        const nested=document.createElement('div');nested.id='nested-wheel';nested.style.cssText='height:40px;overflow:auto;overscroll-behavior:contain';nested.innerHTML='<div style="height:300px"></div>';document.querySelector('#wheel-fixture').firstElementChild.prepend(nested);nested.scrollTop=260;`);
    assert.equal(await evaluate(`(()=>{const e=new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaMode:1,deltaY:3});document.querySelector('#nested-wheel').dispatchEvent(e);return e.defaultPrevented})()`), false, 'nested scroll containment is respected');
    await evaluate("document.querySelector('#nested-wheel').style.overscrollBehavior='auto'");
    assert.equal(await evaluate(`(()=>{const e=new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaMode:1,deltaY:3});document.querySelector('#nested-wheel').dispatchEvent(e);return e.defaultPrevented})()`), true, 'exhausted nested scroller chains to its parent');
    await update({motion:false});
    assert.equal(await evaluate('window.testWheel()'), false, 'motion opt-out leaves wheel native');
    await evaluate("document.querySelector('#wheel-fixture').remove()");
    await update();
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.main-wrapper')).borderTopLeftRadius"), '0px', 'no second window corner below titlebar');
    assert.equal(await evaluate("document.querySelector('.main-wrapper').getBoundingClientRect().left"), 0, 'sidebar meets the window edge without an inset material strip');
    await evaluate("document.querySelector('#channel-header .heading').textContent = 'engineering'");
    assert.equal(await evaluate("document.querySelector('#channel-header .heading').getAnimations().length"), 1, 'channel title fades on text replacement');
    await update({motion: false});
    assert.equal(await evaluate("document.querySelector('#channel-header .heading').getAnimations().length"), 0, 'motion opt-out cancels in-flight title animation');
    await evaluate("document.querySelector('#channel-header .heading').textContent = 'design'");
    assert.equal(await evaluate("document.querySelector('#channel-header .heading').getAnimations().length"), 0, 'motion opt-out prevents new text animation');
    await update();
    await win.webContents.debugger.attach('1.3');
    await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', {features: [{name: 'prefers-reduced-motion', value: 'reduce'}]});
    await evaluate("document.querySelector('#channel-header .heading').textContent = 'releases'");
    assert.equal(await evaluate("document.querySelector('#channel-header .heading').getAnimations().length"), 0, 'OS reduced motion prevents title animation');
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.btn')).transitionDuration"), '0s', 'OS reduced motion disables control transitions');
    await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', {features: []});
    win.webContents.debugger.detach();
    assert.equal(await evaluate("window.fluentTest.isServerPage('https://host/workevil/team', 'https://host/work')"), false, 'subpath boundary enforced');
    assert.equal(await evaluate("window.fluentTest.isServerPage('https://host.evil/work', 'https://host/work')"), false, 'origin boundary enforced');
    assert.equal(await evaluate("window.fluentTest.isServerPage('file:///work', 'file:///')"), false, 'non-HTTP pages excluded');

    await pointer('dm-1');
    await waitFor("Boolean(document.querySelector('.mm-fluent-hover').style.transform)");
    const first = await evaluate("document.querySelector('.mm-fluent-hover').style.transform");
    for (const id of ['dm-2', 'dm-3', 'dm-4', 'dm-2']) {
        await pointer(id);
    }
    await waitFor(`document.querySelector('.mm-fluent-hover').style.transform !== ${JSON.stringify(first)}`);
    const final = await evaluate("document.querySelector('.mm-fluent-hover').style.transform");
    assert.notEqual(first, final, 'highlight moves to latest target');
    assert.equal(await evaluate("document.querySelectorAll('.mm-fluent-hover').length"), 1, 'one highlight, no per-row overlays');
    assert.equal(await evaluate("document.querySelectorAll('.SidebarLink').length"), 10, 'original rows preserved');

    await evaluate("document.querySelector('textarea').value = 'Unsent draft'; document.querySelector('textarea').focus()");
    await update({enabled: false});
    assert.equal(await marked(), false, 'off removes scope');
    assert.equal(await evaluate("document.querySelector('.mm-fluent-hover')"), null, 'off removes highlight');
    assert.equal(await evaluate("document.querySelector('textarea').value"), 'Unsent draft', 'draft survives toggle');
    await update({serverURL: 'https://another.example'});
    assert.equal(await marked(), false, 'other origins remain unstyled');
    await update({serverURL: `${origin}/other/`});
    assert.equal(await marked(), false, 'other subpaths remain unstyled');

    await update({motion: false});
    await pointer('dm-1'); await pause(); await pointer('dm-2'); await pause();
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.mm-fluent-hover')).transitionDuration"), '0s', 'motion switch disables movement');
    await evaluate("document.dispatchEvent(new Event('scroll'))");
    assert.equal(await evaluate("document.querySelector('.mm-fluent-hover').hasAttribute('data-visible')"), false, 'scroll hides stale highlight');

    await evaluate("window.savedSidebar = document.getElementById('sidebar-left'); window.savedSidebar.remove()");
    await pause();
    assert.equal(await marked(), false, 'SPA removal returns to stock');
    await evaluate("document.querySelector('.workspace').prepend(window.savedSidebar)");
    await pause();
    assert.equal(await marked(), true, 'SPA remount reattaches');
    await evaluate("document.getElementById('sidebar-left').id = 'SidebarContainer'");
    await update();
    assert.equal(await marked(), true, 'modern sidebar supported');
    assert.equal(await evaluate("document.querySelector('.mm-fluent-hover').parentElement.id"), 'SidebarContainer', 'highlight participates in sidebar stacking context');
    await evaluate(`const drafts=document.createElement('div');drafts.className='SidebarDrafts';
        drafts.innerHTML='<a class="SidebarLink"><i class="icon icon-send"></i><span>Drafts</span><span class="badge"><i class="icon icon-draft-indicator icon-pencil-outline"></i><span class="draft-count">19</span></span></a>';
        document.getElementById('SidebarContainer').append(drafts);
        const stock=document.createElement('style');stock.textContent='#SidebarContainer .SidebarDrafts .SidebarLink .badge {padding:0 !important}';document.head.append(stock);`);
    for (const count of ['19', '1999']) {
        const geometry = await evaluate(`(()=>{const badge=document.querySelector('.SidebarDrafts .badge');
            const count=badge.querySelector('.draft-count');count.textContent='${count}';
            const icon=badge.querySelector('i').getBoundingClientRect(),text=count.getBoundingClientRect(),box=badge.getBoundingClientRect();
            return {padding:getComputedStyle(badge).paddingLeft,gap:text.left-icon.right,fits:text.right<=box.right-5,width:box.width};})()`);
        assert.equal(geometry.padding, '6px', 'draft badge overrides the zero-padding server rule');
        assert.ok(geometry.gap >= 4, 'draft icon and count have a real gap');
        assert.equal(geometry.fits, true, 'wide counts retain trailing padding');
    }
    await evaluate("document.querySelector('.SidebarDrafts').remove()");
    await evaluate("document.getElementById('SidebarContainer').id = 'sidebar-left'");
    await update();
    await pointer('dm-3');
    await pause(200);
    fs.writeFileSync(path.join(output, 'fluent-preview-dark.png'), (await win.webContents.capturePage()).toPNG());
    const liquidPoint = await evaluate("(()=>{const r=document.getElementById('dm-3').getBoundingClientRect();return {x:Math.round(r.left+40),y:Math.round(r.top+r.height/2)}})()");
    win.webContents.sendInputEvent({type:'mouseMove',...liquidPoint});
    await waitFor("Boolean(document.querySelector('[data-fluent-liquid]:not([hidden])'))");
    assert.equal(await evaluate(`document.elementFromPoint(${liquidPoint.x},${liquidPoint.y}).closest('.SidebarLink').id`),'dm-3','liquid never intercepts hit testing');
    win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...liquidPoint});
    await pause(40);
    assert.ok(await evaluate("document.querySelector('.fluent-liquid-ripple').getAnimations().length"),'click ripple animates');
    fs.writeFileSync(path.join(output, 'fluent-liquid-click.png'), (await win.webContents.capturePage()).toPNG());
    win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...liquidPoint});
    await pause(550);
    assert.equal(await evaluate("document.querySelector('.fluent-liquid-ripple').getAnimations().length"),0,'ripple stops at rest');
    await evaluate("window.liquidWrites=0;window.liquidObserver=new MutationObserver(records=>window.liquidWrites+=records.length);window.liquidObserver.observe(document.querySelector('[data-fluent-liquid]'),{attributes:true,subtree:true})");
    await pause(150);
    assert.equal(await evaluate('window.liquidWrites'),0,'idle liquid performs no DOM writes');
    await evaluate('window.liquidObserver.disconnect()');
    await evaluate("document.dispatchEvent(new Event('scroll'))");
    assert.equal(await evaluate("document.querySelector('[data-fluent-liquid]').hidden"),true,'scroll hides liquid');
    await update({motion:false});
    assert.equal(await evaluate("document.querySelector('[data-fluent-liquid]')"),null,'motion opt-out removes liquid');
    await update();
    await evaluate("document.body.classList.add('light')");
    await update({theme: 'light'});
    await pause();
    fs.writeFileSync(path.join(output, 'fluent-preview-light.png'), (await win.webContents.capturePage()).toPNG());

    await evaluate("document.body.style.setProperty('--center-channel-bg', '#884499'); document.body.style.setProperty('--center-channel-color', '#112233')");
    await update({theme: 'dark'});
    assert.equal(await evaluate("getComputedStyle(document.body).getPropertyValue('--center-channel-bg').trim()"), '#191919', 'client dark theme overrides server inline palette');
    await update({theme: 'light'});
    assert.equal(await evaluate("getComputedStyle(document.body).getPropertyValue('--center-channel-bg').trim()"), '#ffffff', 'client light theme reaches web content');
    for (const theme of ['dark', 'light']) {
        for (const tint of ['slate', 'ocean', 'forest', 'plum', 'sand']) {
            await update({theme, tint, accent: 'rose'});
            const tinted = await evaluate("({surface:getComputedStyle(document.body).getPropertyValue('--fp-surface').trim(),canvas:getComputedStyle(document.documentElement).getPropertyValue('--fluent-chat-canvas').trim(),accent:getComputedStyle(document.body).getPropertyValue('--fp-accent').trim()})");
            assert.equal(tinted.surface, tinted.canvas, 'chat and window use the same tint');
            await update({theme, tint, accent: 'teal'});
            assert.equal(await evaluate("getComputedStyle(document.body).getPropertyValue('--fp-surface').trim()"), tinted.surface, 'changing accent retains window tint');
            assert.notEqual(await evaluate("getComputedStyle(document.body).getPropertyValue('--fp-accent').trim()"), tinted.accent, 'accent updates independently');
        }
    }
    await update({enabled:false});
    assert.equal(await evaluate("document.documentElement.hasAttribute('data-mm-fluent-tint')"), false, 'disable removes tint');
    await update({theme:'light'});
    assert.equal(await evaluate("getComputedStyle(document.body).getPropertyValue('--fp-surface').trim()"), '#ffffff', 'neutral resets tint');
    await evaluate(`const header=document.createElement('header');header.id='global-header';
        header.innerHTML='<button id="fixture-tools">Tools</button><div class="GlobalSearchNav"><button id="fixture-search">Search</button></div>';
        header.querySelector('#fixture-search').onclick=()=>{window.searchOpened=true};document.body.prepend(header)`);
    await update({theme: 'dark', compactHeader: true});
    assert.equal(await evaluate("document.documentElement.hasAttribute('data-mm-fluent-compact')"), true, 'known header becomes a flyout');
    await evaluate("document.querySelector('textarea').focus();window.fluentTest.openToolbar('tools')");
    assert.equal(await evaluate("document.activeElement.id"), 'fixture-tools', 'toolbar receives keyboard focus');
    await evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");
    await pause();
    assert.equal(await evaluate("document.activeElement.tagName"), 'TEXTAREA', 'Escape returns to draft');
    assert.equal(await evaluate("document.documentElement.hasAttribute('data-mm-fluent-toolbar-open')"), false, 'Escape closes flyout');
    await evaluate("window.fluentTest.openToolbar('tools');window.fluentTest.openToolbar('close')");
    await pause();
    assert.equal(await evaluate("document.activeElement.tagName"), 'TEXTAREA', 'native Escape bridge restores draft focus');
    await evaluate("window.fluentTest.openToolbar('search')");
    assert.equal(await evaluate('window.searchOpened'), true, 'search uses the original webapp control');
    await update({enabled: false});
    assert.equal(await evaluate("document.documentElement.hasAttribute('data-mm-fluent-compact')"), false, 'disable restores the stock toolbar');
    await evaluate("document.getElementById('global-header').remove()");
    await update({theme: 'light'});
    // Reproduce legacy applyTheme: literal CSS appended after client CSS, plus
    // an inline important palette and a separately painted RHS.
    await evaluate(`document.body.classList.add('app__body');
        document.body.style.setProperty('--center-channel-bg', '#884499', 'important');
        const rhs = document.createElement('aside'); rhs.id = 'rhsContainer'; document.body.append(rhs);
        const legacy = document.createElement('style'); legacy.textContent = 'body.app__body {color:#ffeedd} .app__body #post-list, .app__body #rhsContainer {background:#884499;color:#ffeedd}'; document.head.append(legacy);`);
    for (const [theme, expected] of [['light', 'rgb(255, 255, 255)'], ['dark', 'rgb(25, 25, 25)']]) {
        await update({theme});
        for (const selector of ['#post-list', '#rhsContainer']) {
            assert.equal(await evaluate(`getComputedStyle(document.querySelector('${selector}')).backgroundColor`), expected, `${theme} reaches legacy ${selector}`);
        }
    }
    await update({theme: 'dark'});
    await pause();
    fs.writeFileSync(path.join(output, 'fluent-v3-channels-dark.png'), (await win.webContents.capturePage()).toPNG());
    await update({theme: 'light'});
    await pause();
    fs.writeFileSync(path.join(output, 'fluent-v3-channels-light.png'), (await win.webContents.capturePage()).toPNG());
    const editorFixture = fs.readFileSync(path.join(__dirname, 'fixtures/editors.html'), 'utf8');
    await evaluate(`document.body.insertAdjacentHTML('beforeend', ${JSON.stringify(editorFixture)})`);
    await update({theme: 'dark'});
    for (const index of [0, 1]) {
        await evaluate(`document.querySelectorAll('.editor-fixture textarea')[${index}].focus()`);
        const editor = await evaluate(`(() => {
            const area = document.querySelectorAll('.editor-fixture textarea')[${index}];
            const body = area.closest('.AdvancedTextEditor__body');
            const wrapper = body.parentElement;
            return {outerShadow:getComputedStyle(wrapper).boxShadow, outerBorder:getComputedStyle(wrapper).borderWidth,
                innerBorder:getComputedStyle(body).borderTopWidth, inputBorder:getComputedStyle(area).borderWidth,
                fits:body.getBoundingClientRect().right <= wrapper.getBoundingClientRect().right,
                font:getComputedStyle(area).fontFamily};
        })()`);
        assert.equal(editor.outerShadow, 'none', 'layout wrapper has no focus underline');
        assert.equal(editor.outerBorder, '0px', 'layout wrapper has no border');
        assert.equal(editor.innerBorder, '1px', 'exactly one body border');
        assert.equal(editor.inputBorder, '0px', 'textarea has no nested border');
        assert.equal(editor.fits, true, 'editor fits available width');
        assert.match(editor.font, /Segoe UI/, 'editor uses the prose font');
    }
    // Reproduce the stock one-line 46px minimum with the Fluent 22px line.
    await evaluate("document.querySelector('.editor-fixture textarea').value='';document.querySelector('.editor-fixture textarea').style.cssText='height:46px;padding:13px 16px 12px'");
    const singleLine = await evaluate("(()=>{const e=document.querySelector('.editor-fixture textarea');return {client:e.clientHeight,scroll:e.scrollHeight}})()");
    assert.ok(singleLine.client >= singleLine.scroll, 'empty editor has no phantom vertical scrollbar at the stock minimum');
    await update({theme: 'dark', accent: 'violet', textSize: 'large'});
    assert.equal(await evaluate("getComputedStyle(document.body).getPropertyValue('--fp-accent').trim()"), '#c4b5fd', 'local accent reaches server content');
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.editor-fixture textarea')).fontSize"), '17px', 'large message type reaches the composer');
    assert.equal(await evaluate("(()=>{const e=document.querySelector('.editor-fixture textarea');return e.clientHeight >= e.scrollHeight})()"), true, 'large empty editor fits a full line');
    await update({theme: 'light', accent: 'green'});
    assert.equal(await evaluate("getComputedStyle(document.body).getPropertyValue('--fp-accent').trim()"), '#247348', 'light accent has its own readable shade');
    await update({enabled: false});
    assert.equal(await evaluate("document.documentElement.hasAttribute('data-mm-fluent-accent') || document.documentElement.hasAttribute('data-mm-fluent-text-size')"), false, 'disable cleans personalization attributes');
    await update({theme: 'dark'});

    await pause();
    fs.writeFileSync(path.join(output, 'fluent-v4-editors.png'), (await win.webContents.capturePage()).toPNG());
    win.webContents.debugger.attach('1.3');
    await win.webContents.debugger.sendCommand('DOM.enable');
    await win.webContents.debugger.sendCommand('CSS.enable');
    const documentNode = await win.webContents.debugger.sendCommand('DOM.getDocument');
    const textNode = await win.webContents.debugger.sendCommand('DOM.querySelector', {nodeId: documentNode.root.nodeId, selector: '.editor-fixture .post-message__text'});
    const fonts = await win.webContents.debugger.sendCommand('CSS.getPlatformFontsForNode', {nodeId: textNode.nodeId});
    console.log('Actual UI fonts:', fonts.fonts.map((font) => font.familyName));
    if (process.platform === 'win32') {
        assert.ok(fonts.fonts.length > 0 && fonts.fonts.every((font) => font.familyName.startsWith('Segoe UI')), 'Cyrillic and Latin message text actually render in Segoe UI');
    }
    win.webContents.debugger.detach();
    await evaluate("document.querySelector('.editor-fixture').remove()");
    await update({theme: 'server'});
    assert.equal(await evaluate("document.documentElement.dataset.mmFluentTheme"), 'dark', 'legacy theme cannot bypass the owned palette');
    await update({enabled: false});
    assert.equal(await evaluate("getComputedStyle(document.body).getPropertyValue('--center-channel-bg').trim()"), '#884499', 'server palette restored intact');
    await update();

    // Modern sidebar adapter: retain original routing and react-owned controls.
    await evaluate(`const sidebar=document.querySelector('#sidebar-left');
        const container=document.createElement('div');container.id='SidebarContainer';sidebar.before(container);container.append(sidebar);
        container.insertAdjacentHTML('afterbegin','<div id="lhsNavigator"></div><ul class="SidebarGlobalThreads"><a id="sidebarItem_threads" href="/work/team/threads">Threads<span class="badge">12</span></a></ul><ul class="SidebarDrafts"><a id="sidebarItem_drafts" href="/work/team/drafts">Drafts<span class="badge">19</span></a></ul>');
        const global=document.createElement('div');global.id='global-header';global.innerHTML='<button aria-expanded="false"><i class="icon-bookmark-outline"></i></button>';document.body.append(global);
        window.navigationClicks=[];
        for(const id of ['sidebarItem_threads','sidebarItem_drafts'])document.getElementById(id).onclick=e=>{e.preventDefault();window.navigationClicks.push(id);history.pushState({},'', '/work/team/'+(id.endsWith('threads')?'threads':'drafts'));};
        global.querySelector('button').onclick=e=>{const b=e.currentTarget;b.setAttribute('aria-expanded',String(b.getAttribute('aria-expanded')!=='true'));};
        const conversation=sidebar.querySelector('.SidebarLink.active');conversation.href='/work/team/channels/design';conversation.onclick=e=>{e.preventDefault();window.navigationClicks.push('conversation');history.pushState({},'',conversation.href);};void 0;`);
    await waitFor("document.querySelectorAll('.FluentNavigation button').length===4");
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.SidebarDrafts')).display"), 'none', 'duplicate entries hidden only after adapter installed');
    assert.equal(await evaluate("document.querySelector('[data-section=drafts] .FluentNavigation__count').textContent"), '19', 'draft counter mirrored without its pencil icon');
    await evaluate("document.querySelector('[data-section=drafts]').click()");
    await waitFor("document.querySelector('[data-section=drafts]').hasAttribute('aria-current')");
    await evaluate("document.querySelector('[data-section=chats]').click()");
    await waitFor("document.querySelector('[data-section=chats]').hasAttribute('aria-current')");
    await evaluate("document.querySelector('[data-section=threads]').click()");
    await waitFor("document.querySelector('[data-section=threads]').hasAttribute('aria-current')");
    assert.deepEqual(await evaluate('window.navigationClicks'), ['sidebarItem_drafts', 'conversation', 'sidebarItem_threads'], 'new navigation delegates each action to original controls');
    await evaluate("document.querySelector('[data-section=saved]').click()");
    await waitFor("document.querySelector('[data-section=saved]').hasAttribute('aria-current')");
    await evaluate("document.querySelector('[data-section=chats]').click();document.querySelector('#sidebarItem_drafts .badge').textContent='123'");
    await waitFor("document.querySelector('[data-section=drafts] .FluentNavigation__count').textContent==='123'");
    await evaluate("document.querySelector('#sidebarItem_drafts .badge').firstChild.data='124'");
    await waitFor("document.querySelector('[data-section=drafts] .FluentNavigation__count').textContent==='124'");
    assert.equal(await evaluate("document.querySelector('#global-header button').getAttribute('aria-expanded')"), 'false', 'return to conversation closes saved panel through stock action');
    await evaluate("document.querySelector('#sidebarItem_drafts').remove()");
    await waitFor("document.querySelector('[data-section=drafts]').disabled");
    assert.equal(await evaluate("document.querySelectorAll('.FluentNavigation button').length"), 4, 'empty drafts do not remove or shift the navigation');
    await update({enabled:false});
    assert.equal(await evaluate("document.querySelector('.FluentNavigation')"), null, 'disable removes navigation');
    assert.notEqual(await evaluate("getComputedStyle(document.querySelector('.SidebarDrafts')).display"), 'none', 'disable restores original navigation');
    await evaluate("document.querySelector('#sidebarItem_threads').remove()");
    await update();
    assert.equal(await evaluate("document.documentElement.hasAttribute('data-mm-fluent-navigation')"), false, 'unknown navigation keeps stock layout');

    // The narrow context keeps the original conversation mounted, but removes
    // it from keyboard navigation until the panel is closed or Fluent disabled.
    await evaluate(`document.querySelector('.main').id='channel_view';
        const panel=document.createElement('div');panel.id='sidebar-right';panel.innerHTML='<div class="sidebar-right-container"><button id="rhsCloseButton">Close</button></div>';document.querySelector('.workspace').append(panel);
        panel.querySelector('button').onclick=()=>panel.remove();void 0;`);
    win.setSize(900, 850);
    await waitFor("document.documentElement.hasAttribute('data-mm-fluent-context-narrow')");
    assert.equal(await evaluate("document.querySelector('#channel_view').inert"), true, 'covered conversation cannot receive keyboard focus');
    assert.notEqual(await evaluate("getComputedStyle(document.querySelector('#channel_view')).display"), 'none', 'conversation and draft stay mounted at their normal size');
    await update({enabled:false});
    assert.equal(await evaluate("document.querySelector('#channel_view').inert"), false, 'disable restores previous keyboard accessibility');
    assert.equal(await evaluate("document.querySelector('.FluentContext')"), null, 'disable removes context controls');
    await update();
    await waitFor("Boolean(document.querySelector('.FluentContext'))");
    await evaluate("document.querySelector('.FluentContext [data-context=back]').click()");
    await waitFor("!document.documentElement.hasAttribute('data-mm-fluent-context')");
    assert.equal(await evaluate("document.querySelector('#channel_view').inert"), false, 'closing context restores the conversation');
    win.setSize(1280, 850);


    await update({motion:true}); await pause(850);
    const entrances = await evaluate(`(async () => {
        const post = document.createElement('div'); post.dataset.testid='postView';post.id='fresh-fixture';
        post.innerHTML='<a class="post__permalink" href="/work/pl/fresh" aria-labelledby="'+Date.now()+'"></a><div class="post__content">Fresh message</div>';
        document.body.append(post);await new Promise(requestAnimationFrame);
        const fresh=post.querySelector('.post__content').getAnimations().length;
        post.remove();document.body.append(post.cloneNode(true));await new Promise(requestAnimationFrame);
        const remount=document.querySelector('#fresh-fixture .post__content').getAnimations().length;
        const old=post.cloneNode(true);old.id='old-fixture';old.querySelector('a').href='/work/pl/old';old.querySelector('a').setAttribute('aria-labelledby',Date.now()-60000);document.body.append(old);await new Promise(requestAnimationFrame);
        const history=old.querySelector('.post__content').getAnimations().length;
        old.remove();document.getElementById('fresh-fixture').remove();return {fresh,remount,history};
    })()`);
    assert.equal(entrances.fresh,1,'fresh timestamp gets opacity entrance');
    assert.equal(entrances.remount,0,'virtualized remount does not replay');
    assert.equal(entrances.history,0,'history does not animate');

    await evaluate(`document.getElementById('SidebarContainer').remove();document.getElementById('global-header').remove();
        const auth = document.createElement('div'); auth.className = 'header-footer-route';
        auth.innerHTML = '<div class="header-footer-route-container"><div class="login-body"><div class="login-body-content" style="display:flex"><div class="login-body-message"><h1 class="login-body-message-title">Log in to your account</h1><p class="login-body-message-subtitle">Collaborate with your team in real-time</p></div><div class="login-body-action"><div class="login-body-card"><div class="login-body-card-content"><h2 class="login-body-card-title">Log in</h2><input class="form-control" value="draft@example.test"><button class="login-body-card-form-button-submit">Log in</button></div></div></div></div></div></div>';
        document.body.append(auth); document.querySelector('.workspace').style.display = 'none';`);
    await pause();
    await update({theme: 'dark', material: 'acrylic'});
    assert.equal(await evaluate("document.documentElement.dataset.mmFluentSurface"), 'auth', 'SPA login recognized without sidebar');
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.login-body-card')).borderRadius"), '12px', 'login card restyled');
    assert.equal(await evaluate("document.querySelector('.mm-fluent-hover')"), null, 'login has no channel marker');
    await pause();
    fs.writeFileSync(path.join(output, 'fluent-login-dark.png'), (await win.webContents.capturePage()).toPNG());
    await update({theme: 'light'});
    await pause();
    fs.writeFileSync(path.join(output, 'fluent-login-light.png'), (await win.webContents.capturePage()).toPNG());
    await update({enabled: false});
    assert.equal(await evaluate("document.querySelector('.header-footer-route input').value"), 'draft@example.test', 'login input preserved');
    assert.equal(await evaluate("document.documentElement.hasAttribute('data-mm-fluent-theme')"), false, 'disable removes palette');

    await evaluate("window.fluentTest.dispose(); document.body.append(document.createElement('span'))");
    await pause();
    assert.equal(await marked(), false, 'dispose does not reattach after mutation');
    assert.equal(await evaluate("document.querySelector('.mm-fluent-hover')"), null);
    win.destroy();

    // Exercise the shipped preload as well, including its one-way IPC bridge and
    // CSS insertion under CSP. No test API is present in this window.
    const builtPreload = path.join(root, 'dist/externalAPI.js');
    if (!fs.existsSync(builtPreload)) {
        throw new Error('Run npm run build before testing the production preload.');
    }
    const integrated = new BrowserWindow({show: false, webPreferences: {preload: builtPreload, offscreen: true, backgroundThrottling: false, sandbox: true, contextIsolation: true, nodeIntegration: false}});
    let preloadError;
    integrated.webContents.on('preload-error', (_event, _path, error) => {preloadError = error;});
    await integrated.loadURL(`${origin}/work/team/channels/design`);
    integrated.webContents.send('fluent-settings-changed', {...settings, theme: 'light'});
    await pause(150);
    assert.equal(preloadError, undefined, 'production preload loads without errors');
    assert.equal(await integrated.webContents.executeJavaScript("document.documentElement.hasAttribute('data-mm-fluent')"), true, 'production IPC activates styling');
    assert.equal(await integrated.webContents.executeJavaScript("getComputedStyle(document.querySelector('.mm-fluent-hover')).pointerEvents"), 'none', 'bundled CSS applied under CSP');
    assert.equal(await integrated.webContents.executeJavaScript("typeof window.desktopAPI"), 'object', 'original desktop API remains available');
    assert.equal(await integrated.webContents.executeJavaScript("typeof window.require"), 'undefined', 'no Node access exposed to server');
    assert.equal(await integrated.webContents.executeJavaScript("getComputedStyle(document.querySelector('#post-list')).backgroundColor"), 'rgb(255, 255, 255)', 'production palette reaches content');
    integrated.webContents.send('fluent-settings-changed', {...settings, theme: 'dark'});
    await pause(150);
    assert.equal(await integrated.webContents.executeJavaScript("getComputedStyle(document.querySelector('#post-list')).backgroundColor"), 'rgb(25, 25, 25)', 'production theme changes content live');
    integrated.webContents.send('fluent-settings-changed', {...settings, enabled: false});
    await pause();
    assert.equal(await integrated.webContents.executeJavaScript("document.documentElement.hasAttribute('data-mm-fluent')"), false, 'production IPC deactivates styling');
    integrated.destroy();
    console.log('PASS: Fluent Chromium checks (scope, navigation, motion, hover, drafts, cleanup); two preview screenshots saved.');
}
run().then(() => {server?.close(); app.quit();}).catch((error) => {
    console.error(error);
    server?.close();
    app.exit(1);
});
