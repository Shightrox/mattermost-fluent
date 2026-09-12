// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import os from 'os';
import {nativeTheme} from 'electron';
import Config from 'common/config';
import {getFluentSettings} from './fluent';

jest.mock('os', () => ({release: jest.fn()}));
jest.mock('electron', () => ({nativeTheme: {shouldUseHighContrastColors: false, prefersReducedTransparency: false}}));
jest.mock('common/config', () => ({fluentEnabled: true, fluentMaterial: 'acrylic', fluentMotion: true, enableHardwareAcceleration: true}));

describe('Fluent material fallback', () => {
    const platform = process.platform;
    beforeEach(() => {
        Object.defineProperty(process, 'platform', {value: 'win32'});
        jest.mocked(os.release).mockReturnValue('10.0.22621');
        Object.assign(nativeTheme, {shouldUseHighContrastColors: false, prefersReducedTransparency: false});
        Object.assign(Config, {fluentEnabled: true, fluentMaterial: 'acrylic', fluentTheme: 'system', enableHardwareAcceleration: true});
    });
    afterEach(() => Object.defineProperty(process, 'platform', {value: platform}));

    it('enables the requested native material on supported Windows', () => {
        expect(getFluentSettings()).toEqual({enabled: true, motion: true, material: 'acrylic', theme: 'light', accent: 'blue', tint: 'neutral', textSize: 'standard', chatOpacity: 75});
    });
    it('uses solid on Windows 10', () => {
        jest.mocked(os.release).mockReturnValue('10.0.19045');
        expect(getFluentSettings().material).toBe('solid');
    });
    it('resolves explicit client themes independently of native event ordering', () => {
        Object.assign(Config, {fluentTheme: 'dark'});
        expect(getFluentSettings().theme).toBe('dark');
        Object.assign(Config, {fluentTheme: 'light'});
        expect(getFluentSettings().theme).toBe('light');
    });
    it('migrates the legacy server option to the owned dark palette', () => {
        Object.assign(Config, {fluentTheme: 'server'});
        expect(getFluentSettings().theme).toBe('dark');
    });
    it('uses solid on other platforms', () => {
        Object.defineProperty(process, 'platform', {value: 'linux'});
        expect(getFluentSettings().material).toBe('solid');
    });
    it('uses solid when hardware acceleration is disabled', () => {
        Object.assign(Config, {enableHardwareAcceleration: false});
        expect(getFluentSettings().material).toBe('solid');
    });
    it('honors reduced transparency', () => {
        Object.assign(nativeTheme, {prefersReducedTransparency: true});
        expect(getFluentSettings().material).toBe('solid');
    });
    it('leaves high contrast to the original UI', () => {
        Object.assign(nativeTheme, {shouldUseHighContrastColors: true});
        expect(getFluentSettings().enabled).toBe(false);
    });
    it('fully disables material when appearance is off', () => {
        Object.assign(Config, {fluentEnabled: false});
        expect(getFluentSettings()).toMatchObject({enabled: false, material: 'solid'});
    });
});
