// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useIntl} from 'react-intl';

import {useConfig} from 'renderer/hooks/useConfig';

export default function FluentCommands({disabled, activeTabId}: {disabled: boolean; activeTabId?: string}) {
    const {config} = useConfig();
    const intl = useIntl();
    const [history, setHistory] = useState({canGoBack: false, canGoForward: false});
    useEffect(() => {
        let current = true;
        let received = false;
        setHistory({canGoBack: false, canGoForward: false});
        const off = window.desktop.onFluentHistory((status) => {
            received = true;
            setHistory(status);
        });
        window.desktop.getFluentHistory().then((status) => {
            if (current && !received) {
                setHistory(status);
            }
        }).catch(() => {});
        return () => {
            current = false;
            off();
        };
    }, [activeTabId]);
    if (!config?.fluentEnabled || window.process.platform !== 'win32') {
        return null;
    }
    const search = intl.formatMessage({id: 'fluent.commandSearch', defaultMessage: 'Search'});
    const tools = intl.formatMessage({id: 'fluent.commandTools', defaultMessage: 'Workspace controls'});
    return (
        <div className='FluentCommands'>
            <div className='FluentCommands__history'>
                <button
                    disabled={disabled || !history.canGoBack}
                    aria-label={intl.formatMessage({id: 'fluent.back', defaultMessage: 'Back'})}
                    title={intl.formatMessage({id: 'fluent.back', defaultMessage: 'Back'})}
                    onClick={() => window.desktop.openFluentToolbar('back')}
                >
                    <i
                        className='icon icon-arrow-left'
                        aria-hidden='true'
                    />
                </button>
                <button
                    disabled={disabled || !history.canGoForward}
                    aria-label={intl.formatMessage({id: 'fluent.forward', defaultMessage: 'Forward'})}
                    title={intl.formatMessage({id: 'fluent.forward', defaultMessage: 'Forward'})}
                    onClick={() => window.desktop.openFluentToolbar('forward')}
                >
                    <i
                        className='icon icon-arrow-right'
                        aria-hidden='true'
                    />
                </button>
            </div>
            <button
                className='FluentCommands__search'
                disabled={disabled}
                aria-label={search}
                onClick={() => window.desktop.openFluentToolbar('search')}
            >
                <i
                    className='icon icon-magnify'
                    aria-hidden='true'
                />
                <span>{search}</span>
            </button>
            <button
                disabled={disabled}
                aria-label={tools}
                title={tools}
                onClick={() => window.desktop.openFluentToolbar('tools')}
            >
                <i
                    className='icon icon-dots-horizontal'
                    aria-hidden='true'
                />
            </button>
        </div>
    );
}
