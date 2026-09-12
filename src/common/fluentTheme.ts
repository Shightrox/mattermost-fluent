// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Legacy "server" preferences are intentionally mapped to our dark palette.
// Disabling Fluent remains the single way to restore the server appearance.
export function fluentThemeSource(theme?: string): 'system' | 'light' | 'dark' {
    return theme === 'system' || theme === 'light' ? theme : 'dark';
}

export function resolveFluentTheme(theme: string | undefined, darkSystem: boolean): 'light' | 'dark' {
    const source = fluentThemeSource(theme);
    if (source === 'system') {
        return darkSystem ? 'dark' : 'light';
    }
    return source;
}
