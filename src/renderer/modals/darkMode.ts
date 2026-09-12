// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createFluentLiquid} from 'common/fluentLiquid';
import {createFluentScroll} from 'common/fluentScroll';
import {resolveFluentTheme} from 'common/fluentTheme';
import {resetTheme, setTheme} from 'renderer/utils';
import 'renderer/css/fluent.scss';

import type {CombinedConfig} from 'types/config';

export default function addDarkModeListener() {
    const scrolling = createFluentScroll(document, window);
    const liquid = createFluentLiquid(document, window);
    window.addEventListener('unload', liquid.dispose, {once: true});
    window.addEventListener('unload', scrolling.dispose, {once: true});
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
    const highContrast = window.matchMedia('(forced-colors: active)');
    const applyFluent = async () => {
        const config = await window.desktop.getConfiguration() as CombinedConfig;
        const root = document.documentElement;
        const enabled = (config.fluentEnabled ?? true) && !highContrast.matches;
        scrolling.update(enabled && config.fluentMotion !== false);
        liquid.update(enabled && config.fluentMotion !== false);
        root.toggleAttribute('data-mm-fluent-shell', enabled);
        if (!enabled) {
            root.removeAttribute('data-mm-fluent-accent');
            root.removeAttribute('data-mm-fluent-tint');
            root.removeAttribute('data-mm-fluent-text-size');
            root.removeAttribute('data-mm-fluent-theme');
            root.removeAttribute('data-mm-fluent-motion');
            root.removeAttribute('data-mm-fluent-material');
            return;
        }
        root.setAttribute('data-mm-fluent-accent', config.fluentAccent ?? 'blue');
        root.setAttribute('data-mm-fluent-tint', config.fluentTint ?? 'neutral');
        root.setAttribute('data-mm-fluent-text-size', config.fluentTextSize ?? 'standard');
        root.setAttribute('data-mm-fluent-theme', resolveFluentTheme(config.fluentTheme, systemTheme.matches));
        root.setAttribute('data-mm-fluent-motion', config.fluentMotion === false ? 'off' : 'on');
        root.setAttribute('data-mm-fluent-material', config.fluentMaterial ?? 'mica');
    };
    window.desktop.onReloadConfiguration(applyFluent);
    systemTheme.addEventListener('change', applyFluent);
    highContrast.addEventListener('change', applyFluent);
    applyFluent();
    const setDarkMode = (darkMode: boolean) => {
        applyFluent();
        if (darkMode) {
            document.body.classList.add('darkMode');
        } else {
            document.body.classList.remove('darkMode');
        }
    };
    window.desktop.onDarkModeChange(setDarkMode);
    window.desktop.getDarkMode().then(setDarkMode);
    window.desktop.onThemeChange(setTheme);
    window.desktop.onResetTheme(resetTheme);
    window.desktop.getTheme().then(setTheme);
}
