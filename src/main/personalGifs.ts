// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'path';

import {app, ipcMain} from 'electron';

import WebContentsManager from 'app/views/webContentsManager';
import {PERSONAL_GIFS} from 'common/communication';
import Config from 'common/config';
import {ipcValidate, personalGifRequestSchema} from 'common/Validator';

import type {GifRequest} from 'types/personalGifs';

import {PersonalGifStore} from './personalGifStore';

export function registerPersonalGifs() {
    const store = new PersonalGifStore(() => path.join(app.getPath('userData'), 'personal-gifs'));
    ipcMain.handle(PERSONAL_GIFS, ipcValidate(async (event, request: GifRequest) => {
        const view = WebContentsManager.getViewByWebContentsId(event.sender.id);
        const server = view && WebContentsManager.getServerURLByViewId(view.id);
        if (!Config.fluentEnabled || !server || event.senderFrame !== event.sender.mainFrame) {
            return {error: 'unavailable'};
        }
        const page = new URL(event.senderFrame.url);
        const base = server.pathname.replace(/\/$/, '');
        if (page.origin !== server.origin || !(page.pathname === base || page.pathname.startsWith(`${base}/`))) {
            return {error: 'unavailable'};
        }
        return store.request(request);
    }, [personalGifRequestSchema]));
}
