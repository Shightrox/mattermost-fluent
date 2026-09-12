// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import {useConfig} from 'renderer/hooks/useConfig';

import type {UniqueServer} from 'types/config';

import './FluentWorkspaceRail.scss';

type Props = {
    servers: UniqueServer[];
    activeServerId?: string;
    mentions: Record<string, number>;
    unreads: Record<string, boolean>;
    disabled: boolean;
};

export default function FluentWorkspaceRail({servers, activeServerId, mentions, unreads, disabled}: Props) {
    const {config} = useConfig();
    const intl = useIntl();
    if (!config?.fluentEnabled || window.process.platform !== 'win32' || servers.length < 2) {
        return null;
    }
    return (
        <nav
            className='FluentWorkspaceRail'
            aria-label={intl.formatMessage({id: 'fluent.workspaces', defaultMessage: 'Workspaces'})}
        >
            <div className='FluentWorkspaceRail__servers'>
                {servers.filter((server): server is UniqueServer & {id: string} => Boolean(server.id)).map((server) => (
                    <button
                        key={server.id}
                        type='button'
                        className='FluentWorkspaceRail__server'
                        aria-label={intl.formatMessage({id: 'fluent.workspaceLabel', defaultMessage: '{name}, {count} mentions'}, {name: server.name, count: mentions[server.id] ?? 0})}
                        title={server.name}
                        aria-current={activeServerId === server.id ? 'page' : undefined}
                        disabled={disabled}
                        onClick={() => window.desktop.serverDropdown.switchServer(server.id)}
                    >
                        <span aria-hidden='true'>{Array.from(server.name.trim()).slice(0, 2).join('').toLocaleUpperCase()}</span>
                        {(mentions[server.id] ?? 0) > 0 ? (
                            <span className='FluentWorkspaceRail__count'>{mentions[server.id] > 99 ? '99+' : mentions[server.id]}</span>
                        ) : unreads[server.id] && <span className='FluentWorkspaceRail__unread'/>}
                    </button>
                ))}
            </div>
            {config.enableServerManagement && (
                <button
                    type='button'
                    disabled={disabled}
                    title={intl.formatMessage({id: 'fluent.addWorkspace', defaultMessage: 'Add workspace'})}
                    aria-label={intl.formatMessage({id: 'fluent.addWorkspace', defaultMessage: 'Add workspace'})}
                    onClick={() => window.desktop.serverDropdown.showNewServerModal()}
                >
                    <i
                        className='icon icon-plus'
                        aria-hidden='true'
                    />
                </button>
            )}
        </nav>
    );
}
