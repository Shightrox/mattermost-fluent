// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fluentThemeSource, resolveFluentTheme} from './fluentTheme';

describe('owned Fluent palette', () => {
    it.each([undefined, 'server', 'dark'])('uses graphite for %s', (source) => {
        expect(fluentThemeSource(source)).toBe('dark');
        expect(resolveFluentTheme(source, false)).toBe('dark');
    });
    it('retains the light variant and system choice', () => {
        expect(resolveFluentTheme('light', true)).toBe('light');
        expect(resolveFluentTheme('system', false)).toBe('light');
        expect(resolveFluentTheme('system', true)).toBe('dark');
    });
});
