// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ipcRenderer, webFrame} from 'electron';

import {FLUENT_SETTINGS_CHANGED, FLUENT_TOOLBAR_COMMAND} from 'common/communication';
import icons from 'common/icons.fluent.css';
import motion from 'common/motion.fluent.css';
import palette from 'common/palette.fluent.css';
import tokens from 'common/tokens.fluent.css';

import type {FluentViewSettings} from 'types/fluent';

import chatStyles from './chat.fluent.css';
import contextStyles from './context.fluent.css';
import {createFluentController} from './controller';
import layout from './layout.fluent.css';
import navigationStyles from './navigation.fluent.css';
import personalStyles from './personal.fluent.css';
import sidebarStyles from './sidebar.fluent.css';
import styles from './styles.fluent.css';
import surfaceStyles from './surfaces.fluent.css';

export function setupFluent() {
    if (!process.isMainFrame) {
        return;
    }
    let pending: FluentViewSettings | undefined;
    let controller: ReturnType<typeof createFluentController> | undefined;
    const onSettings = (_: Electron.IpcRendererEvent, settings: FluentViewSettings) => {
        pending = settings;
        controller?.update(settings);
    };
    ipcRenderer.on(FLUENT_SETTINGS_CHANGED, onSettings);
    const onCommand = (_: Electron.IpcRendererEvent, command: 'search' | 'tools' | 'close') => controller?.openToolbar(command);
    ipcRenderer.on(FLUENT_TOOLBAR_COMMAND, onCommand);
    window.addEventListener('DOMContentLoaded', () => {
        // Electron inserts bundled CSS without relaxing the server's CSP.
        webFrame.insertCSS(palette, {cssOrigin: 'user'});
        webFrame.insertCSS(tokens + styles + layout + icons + motion + navigationStyles + contextStyles + chatStyles + sidebarStyles + surfaceStyles + personalStyles);
        controller = createFluentController(document, window);
        if (pending) {
            controller.update(pending);
        }
    }, {once: true});
    window.addEventListener('unload', () => {
        ipcRenderer.off(FLUENT_SETTINGS_CHANGED, onSettings);
        ipcRenderer.off(FLUENT_TOOLBAR_COMMAND, onCommand);
        controller?.dispose();
    }, {once: true});
}
