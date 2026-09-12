// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Copyright (c) 2015-2016 Yuya Ochiai

const CopyPlugin = require('copy-webpack-plugin');
const {merge} = require('webpack-merge');

const base = require('./webpack.config.base');

module.exports = merge(base, {
    entry: {
        index: './src/main/app/index.ts',
    },
    externals: {
        'macos-notification-state': 'require("macos-notification-state")',
        'windows-focus-assist': 'require("windows-focus-assist")',
        'registry-js': 'require("registry-js")',
        'cf-prefs': 'require("cf-prefs")',
        koffi: 'require("koffi")',
    },
    externalsPresets: {
        electronMain: true,
    },
    module: {
        rules: [{
            test: /\.node$/,
            loader: 'node-loader',
        }],
    },
    plugins: [
        new CopyPlugin({
            patterns: [{
                from: 'assets/**/*',
                context: 'src',
            }],
        }),
    ],
    node: {
        __filename: true,
        __dirname: true,
    },
    target: 'electron-main',
    resolve: {
        alias: {
            // The ESM entry embeds its build-machine import.meta.url when bundled.
            // Use the equivalent Node entry so public binaries contain no build path.
            yargs$: require.resolve('yargs'),
        },
    },
});
