// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef, useState} from 'react';

import './RangeSetting.scss';

type Props = {
    id: string;
    label: string;
    subLabel: string;
    value?: number;
    defaultValue: number;
    min: number;
    max: number;
    onSave: (key: string, value: number) => void;
};

export default function RangeSetting({id, label, subLabel, value: propValue, defaultValue, min, max, onSave}: Props) {
    const initial = propValue ?? defaultValue;
    const [value, setValue] = useState(initial);
    const saved = useRef(initial);
    useEffect(() => {
        setValue(initial);
        saved.current = initial;
    }, [initial]);
    const commit = () => {
        if (saved.current !== value) {
            saved.current = value;
            onSave(id, value);
        }
    };
    return (
        <div className='RangeSetting'>
            <label htmlFor={`rangeSetting_${id}`}>{label}</label>
            <p id={`${id}_description`}>{subLabel}</p>
            <div className='RangeSetting__control'>
                <input
                    id={`rangeSetting_${id}`}
                    type='range'
                    min={min}
                    max={max}
                    step={5}
                    value={value}
                    aria-describedby={`${id}_description`}
                    aria-valuetext={`${value}%`}
                    onChange={(event) => setValue(Number(event.target.value))}
                    onPointerUp={commit}
                    onKeyUp={commit}
                    onBlur={commit}
                />
                <output htmlFor={`rangeSetting_${id}`}>{`${value}%`}</output>
            </div>
        </div>
    );
}
