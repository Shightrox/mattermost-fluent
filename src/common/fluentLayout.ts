// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export const FLUENT_WORKSPACE_RAIL_WIDTH = 56;

export function insetFluentWorkspace(bounds: {x: number; y: number; width: number; height: number}, enabled: boolean, serverCount: number) {
    const inset = enabled && serverCount > 1 ? FLUENT_WORKSPACE_RAIL_WIDTH : 0;
    return {...bounds, x: bounds.x + inset, width: Math.max(0, bounds.width - inset)};
}
