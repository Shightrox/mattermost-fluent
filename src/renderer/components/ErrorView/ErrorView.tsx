// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ErrorCode: https://code.google.com/p/chromium/codesearch#chromium/src/net/base/net_error_list.h

import React from 'react';
import {FormattedMessage} from 'react-intl';

import AlertImage from 'renderer/components/Images/alert';

import './ErrorView.scss';

type ErrorViewProps = {
    header: React.ReactNode;
    subHeader: React.ReactNode;
    bullets: React.ReactNode;
    contactAdmin: React.ReactNode;
    errorInfo?: string;
    url?: string;
    handleLink: () => void;
};

export default function ErrorView({
    header,
    subHeader,
    bullets,
    contactAdmin,
    errorInfo,
    url,
    handleLink,
}: ErrorViewProps) {
    return (
        <div className='ErrorView'>
            <AlertImage/>
            <i
                className='ErrorView-glyph icon icon-alert-outline'
                aria-hidden='true'
            />
            <span className='ErrorView-header'>
                {header}
            </span>
            <span>
                {subHeader}
            </span>
            <details className='ErrorView-help'>
                <summary>
                    <FormattedMessage
                        id='fluent.errorHelp'
                        defaultMessage='Connection help'
                    />
                </summary>
                <ul className='ErrorView-bullets'>
                    {bullets}
                    <li>
                        <FormattedMessage
                            id='renderer.components.errorView.troubleshooting.webContentsView.canReachFromBrowserWindow'
                            defaultMessage='Try opening <link>{url}</link> in a browser window.'
                            values={{
                                url,
                                link: (msg: React.ReactNode) => (
                                    <a
                                        onClick={handleLink}
                                        href='#'
                                    >
                                        {msg}
                                    </a>
                                ),
                            }}
                        />
                    </li>
                </ul>
            </details>
            <span>
                {contactAdmin}
            </span>
            {errorInfo && (
                <details className='ErrorView-techInfo'>
                    <summary>
                        <FormattedMessage
                            id='fluent.errorDetails'
                            defaultMessage='Technical details'
                        />
                    </summary>
                    <code>{errorInfo}</code>
                </details>
            )}
        </div>
    );
}
