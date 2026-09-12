// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {useConfig} from 'renderer/hooks/useConfig';

import './FluentIllustration.scss';

type Props = {fallback: React.ReactNode};

export default function FluentIllustration({fallback}: Props) {
    const {config} = useConfig();
    if (!config?.fluentEnabled) {
        return <>{fallback}</>;
    }
    return (
        <div
            className='FluentIllustration'
            aria-hidden='true'
        >
            <div className='FluentIllustration__window'>
                <div className='FluentIllustration__bar'><span/><span/><span/></div>
                <div className='FluentIllustration__layout'>
                    <div className='FluentIllustration__nav'>
                        <b/><i/><i/><i/><i/>
                    </div>
                    <div className='FluentIllustration__conversation'>
                        <div className='FluentIllustration__message'><b/><span><i/><i/></span></div>
                        <div className='FluentIllustration__message'><b/><span><i/><i/></span></div>
                        <div className='FluentIllustration__input'><span/>{'\u2197'}</div>
                    </div>
                </div>
            </div>
            <div className='FluentIllustration__accent'/>
        </div>
    );
}
