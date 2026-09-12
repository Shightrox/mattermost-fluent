// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {insetFluentWorkspace} from './fluentLayout';

describe('workspace rail bounds', () => {
    const bounds = {x: 0, y: 40, width: 800, height: 560};
    it('reserves space without changing the titlebar or bottom edge', () => {
        expect(insetFluentWorkspace(bounds, true, 2)).toEqual({x: 56, y: 40, width: 744, height: 560});
        expect(bounds.width).toBe(800);
    });
    it('preserves stock and single-workspace geometry', () => {
        expect(insetFluentWorkspace(bounds, false, 3)).toEqual(bounds);
        expect(insetFluentWorkspace(bounds, true, 1)).toEqual(bounds);
    });
    it('never returns negative width', () => {
        expect(insetFluentWorkspace({...bounds, width: 20}, true, 2).width).toBe(0);
    });
});
