// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import MainWindow from 'app/mainWindow/mainWindow';
import {TOGGLE_LOADING_SCREEN_VISIBILITY} from 'common/communication';

import {LoadingScreen} from './loadingScreen';

jest.mock('electron', () => {
    const EventEmitter = jest.requireActual('events');
    const mockIpcMain = new EventEmitter();
    mockIpcMain.on = jest.fn();

    return {
        app: {emit: jest.fn()},
        ipcMain: mockIpcMain,
        WebContentsView: jest.fn().mockImplementation(() => {
            const {EventEmitter} = jest.requireActual('events');
            const mockWebContents = new EventEmitter();
            mockWebContents.send = jest.fn();
            mockWebContents.loadURL = jest.fn();
            mockWebContents.isLoading = jest.fn();
            mockWebContents.isDestroyed = jest.fn(() => false);

            return {
                webContents: mockWebContents,
                setBounds: jest.fn(),
            };
        }),
    };
});
jest.mock('main/performanceMonitor', () => ({
    registerView: jest.fn(),
}));
jest.mock('main/utils', () => ({
    getLocalPreload: jest.fn(),
    getWindowBoundaries: jest.fn(),
}));
jest.mock('app/mainWindow/mainWindow', () => ({
    get: jest.fn(),
    on: jest.fn(),
}));

describe('main/views/loadingScreen', () => {
    describe('show', () => {
        const mainWindow = {
            contentView: {
                addChildView: jest.fn(),
                removeChildView: jest.fn(),
                children: [],
                on: jest.fn(),
            },
            webContents: {
                id: 123,
            },
            isDestroyed: jest.fn(() => false),
            focus: jest.fn(),
        };
        const loadingScreen = new LoadingScreen(mainWindow);

        beforeEach(() => {
            jest.useFakeTimers();
            mainWindow.contentView.removeChildView.mockClear();
            mainWindow.contentView.children = [];
            MainWindow.get.mockReturnValue(mainWindow);
        });

        afterEach(() => {
            jest.clearAllTimers();
            jest.useRealTimers();
        });

        it('removes an invisible overlay when the renderer never acknowledges fading', () => {
            loadingScreen.show();
            loadingScreen.fade();
            jest.advanceTimersByTime(2000);
            expect(mainWindow.contentView.removeChildView).toHaveBeenCalledWith(loadingScreen.view);
        });

        it('does not let a previous fade timeout hide a new loading cycle', () => {
            loadingScreen.show();
            loadingScreen.fade();
            loadingScreen.show();
            jest.advanceTimersByTime(2000);
            expect(mainWindow.contentView.removeChildView).not.toHaveBeenCalled();
        });

        it('ignores another loading renderer and removes its own acknowledged overlay only once', () => {
            loadingScreen.show();
            loadingScreen.fade();
            loadingScreen.handleAnimationFinished({sender: {}});
            expect(mainWindow.contentView.removeChildView).not.toHaveBeenCalled();
            loadingScreen.handleAnimationFinished({sender: loadingScreen.view.webContents});
            jest.advanceTimersByTime(2000);
            expect(mainWindow.contentView.removeChildView).toHaveBeenCalledTimes(1);
        });

        it('should add the loading screen view to the window when not loading', () => {
            loadingScreen.view.webContents.isLoading.mockReturnValue(false);
            loadingScreen.show();
            expect(loadingScreen.view.webContents.send).toHaveBeenCalledWith(TOGGLE_LOADING_SCREEN_VISIBILITY, true);
            expect(mainWindow.contentView.addChildView).toHaveBeenCalledWith(loadingScreen.view);
        });

        it('should add the loading screen view to the window after loading finishes', () => {
            loadingScreen.view.webContents.isLoading.mockReturnValue(true);
            loadingScreen.show();

            // Simulate the 'did-finish-load' event
            loadingScreen.view.webContents.emit('did-finish-load');

            expect(loadingScreen.view.webContents.send).toHaveBeenCalledWith(TOGGLE_LOADING_SCREEN_VISIBILITY, true);
            expect(mainWindow.contentView.addChildView).toHaveBeenCalledWith(loadingScreen.view);
        });

        it('should not show the loading screen if fade() is called before did-finish-load fires', () => {
            loadingScreen.view.webContents.send.mockClear();
            mainWindow.contentView.addChildView.mockClear();

            loadingScreen.view.webContents.isLoading.mockReturnValue(true);
            loadingScreen.show();
            loadingScreen.fade();

            loadingScreen.view.webContents.emit('did-finish-load');

            expect(loadingScreen.view.webContents.send).not.toHaveBeenCalledWith(TOGGLE_LOADING_SCREEN_VISIBILITY, true);
            expect(mainWindow.contentView.addChildView).not.toHaveBeenCalled();
        });
    });
});
