// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';

import './RadioSetting.scss';

export default function RadioSetting<T extends string>({
    id,
    onSave,
    label,
    subLabel,
    options,
    ...props
}: {
    id: string;
    onSave: (key: string, value: T) => void;
    label: React.ReactNode;
    subLabel?: React.ReactNode;
    value: T;
    options: Array<{value: T; label: React.ReactNode}>;
}) {
    const [value, setValue] = useState(props.value);
    useEffect(() => setValue(props.value), [props.value]);

    const save = (value: T) => {
        onSave(id, value);
        setValue(value);
    };

    return (
        <div className='RadioSetting'>
            <div
                className='RadioSetting__heading'
                id={`${id}-heading`}
            >{label}</div>
            {subLabel && (
                <p
                    className='RadioSetting__description'
                    id={`${id}-description`}
                >{subLabel}</p>
            )}
            <div
                className='RadioSetting__content'
                role='radiogroup'
                aria-labelledby={`${id}-heading`}
                aria-describedby={subLabel ? `${id}-description` : undefined}
            >
                {options.map((option, index) => (
                    <button
                        id={`RadioSetting_${id}_${option.value}`}
                        className='RadioSetting__radio'
                        key={`${index}`}
                        onClick={() => save(option.value)}
                        role='radio'
                        aria-checked={value === option.value}
                        tabIndex={value === option.value || (!options.some((item) => item.value === value) && index === 0) ? 0 : -1}
                        onKeyDown={(event) => {
                            const direction = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1;
                            if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
                                return;
                            }
                            event.preventDefault();
                            let next = (index + direction + options.length) % options.length;
                            if (event.key === 'Home') {
                                next = 0;
                            } else if (event.key === 'End') {
                                next = options.length - 1;
                            }
                            save(options[next].value);
                            event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
                        }}
                    >
                        <input
                            type='radio'
                            value={option.value}
                            name={id}
                            checked={value === option.value}
                            readOnly={true}
                            tabIndex={-1}
                            aria-hidden={true}
                        />
                        <label
                            htmlFor={`RadioSetting_${id}_${option.value}`}
                            className='RadioSetting__label'
                        >
                            {option.label}
                        </label>
                    </button>
                ))}
            </div>
        </div>
    );
}
