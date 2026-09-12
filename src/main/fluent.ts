// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import os from 'os';

import {nativeTheme} from 'electron';

import Config from 'common/config';
import {resolveFluentTheme} from 'common/fluentTheme';

import type {FluentSettings} from 'types/fluent';

export function getFluentSettings(): FluentSettings {
    const enabled = Config.fluentEnabled && !nativeTheme.shouldUseHighContrastColors;
    const supportsMaterial = process.platform === 'win32' && Number(String(os.release()).split('.')[2]) >= 22621;
    const material = enabled && supportsMaterial && Config.enableHardwareAcceleration && !nativeTheme.prefersReducedTransparency ? Config.fluentMaterial : 'solid';
    const theme = resolveFluentTheme(Config.fluentTheme, nativeTheme.shouldUseDarkColors);
    return {enabled, motion: Config.fluentMotion, material, theme, accent: Config.fluentAccent ?? 'blue', tint: Config.fluentTint ?? 'neutral', textSize: Config.fluentTextSize ?? 'standard', chatOpacity: Config.fluentChatOpacity ?? 75};
}
