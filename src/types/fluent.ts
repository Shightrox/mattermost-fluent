// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type FluentSettings = {
    enabled: boolean;
    motion: boolean;
    accent?: 'blue' | 'violet' | 'green' | 'teal' | 'rose' | 'amber' | 'coral' | 'indigo';
    tint?: 'neutral' | 'slate' | 'ocean' | 'forest' | 'plum' | 'sand';
    textSize?: 'standard' | 'large';
    material: 'solid' | 'mica' | 'acrylic';
    chatOpacity?: number;
    theme?: 'light' | 'dark';
};

export type FluentViewSettings = FluentSettings & {serverURL: string; compactHeader?: boolean};
