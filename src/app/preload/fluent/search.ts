// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

type SearchFields = {query: string; channel: string; author: string; after: string; before: string};
const operators = {channel: 'in', author: 'from', after: 'after', before: 'before'} as const;

export function buildFluentSearch(fields: SearchFields) {
    return [fields.query.trim(), ...Object.entries(operators).map(([field, operator]) => {
        const value = fields[field as keyof typeof operators].trim();
        return value ? `${operator}:${value}` : '';
    })].filter(Boolean).join(' ');
}

export function createFluentSearch(doc: Document, win: Window) {
    let host: HTMLElement | null = null;
    let form: HTMLFormElement | null = null;
    let submitFrame = 0;
    let synchronize = () => {};
    let savedQuery = '';
    let savedFiles = false;
    let restoreFiles = false;
    const submitQuery = (query: string) => {
        const input = doc.querySelector<HTMLInputElement>('#sbrSearchBox');
        if (!input?.form) {
            return;
        }
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, query);
        input.dispatchEvent(new Event('input', {bubbles: true}));
        win.cancelAnimationFrame(submitFrame);
        submitFrame = win.requestAnimationFrame(() => {
            submitFrame = 0;
            if (input.isConnected) {
                input.form?.requestSubmit();
            }
        });
    };
    const dispose = () => {
        win.cancelAnimationFrame(submitFrame);
        submitFrame = 0;
        form?.remove();
        form = null;
        host = null;
        synchronize = () => {};
    };
    return {
        capture() {
            if (host?.isConnected) {
                savedQuery = doc.querySelector<HTMLInputElement>('#sbrSearchBox')?.value ?? '';
                savedFiles = host.querySelector('#filesTab')?.getAttribute('aria-selected') === 'true';
            }
        },
        hasSaved: () => Boolean(savedQuery),
        restore() {
            if (savedQuery) {
                restoreFiles = savedFiles;
                submitQuery(savedQuery);
            }
        },
        reset() {
            dispose();
            savedQuery = '';
            restoreFiles = false;
        },
        update(enabled: boolean) {
            const next = enabled ? doc.querySelector<HTMLElement>('#searchContainer:has(#messagesTab)') : null;
            const source = doc.querySelector<HTMLInputElement>('#sbrSearchBox');
            if (!next || !source?.form) {
                if (host || form) {
                    dispose();
                }
                return;
            }
            if (restoreFiles) {
                restoreFiles = false;
                next.querySelector<HTMLElement>('#filesTab')?.click();
            }
            if (next === host && form?.isConnected) {
                synchronize();
                return;
            }
            dispose();
            host = next;
            const russian = doc.documentElement.lang.startsWith('ru') || (/[А-Яа-я]/).test(doc.getElementById('sidebarItem_threads')?.textContent ?? '');
            const labels = russian ? ['Поиск', 'Текст или запрос', 'Канал', 'Имя пользователя', 'После даты', 'До даты', 'Найти'] : ['Search', 'Text or query', 'Channel', 'Username', 'After date', 'Before date', 'Search'];
            form = doc.createElement('form');
            form.className = 'FluentSearch';
            form.setAttribute('aria-label', labels[0]);
            const filters = doc.createElement('details');
            filters.className = 'FluentSearch__filters';
            const summary = doc.createElement('summary');
            summary.textContent = russian ? 'Канал, автор и даты' : 'Channel, author and dates';
            const filterFields = doc.createElement('div');
            filters.append(summary, filterFields);
            const fields = {} as Record<keyof SearchFields, HTMLInputElement>;
            (['query', 'channel', 'author', 'after', 'before'] as const).forEach((key, index) => {
                const label = doc.createElement('label');
                label.className = `FluentSearch__${key}`;
                const caption = doc.createElement('span');
                caption.textContent = labels[index + 1];
                const input = doc.createElement('input');
                input.name = key;
                input.type = index >= 3 ? 'date' : 'text';
                input.autocomplete = 'off';
                if (key === 'query') {
                    input.value = source.value;
                } else if (key === 'channel' || key === 'author') {
                    input.pattern = '[a-zA-Z0-9._\\-]+';
                    input.placeholder = key === 'channel' ? 'design' : 'username';
                }
                fields[key] = input;
                label.append(caption, input);
                if (key === 'query') {
                    form!.append(label);
                } else {
                    filterFields.append(label);
                }
            });
            form.append(filters);
            let lastQuery = source.value;
            synchronize = () => {
                const current = doc.querySelector<HTMLInputElement>('#sbrSearchBox')?.value;
                if (current !== undefined && current !== lastQuery) {
                    fields.query.value = current;
                    for (const key of Object.keys(operators) as Array<keyof typeof operators>) {
                        fields[key].value = '';
                    }
                    lastQuery = current;
                }
            };
            const submit = doc.createElement('button');
            submit.type = 'submit';
            submit.textContent = labels[6];
            form.append(submit);
            form.addEventListener('invalid', () => {
                filters.open = true;
            }, true);
            form.addEventListener('submit', (event) => {
                event.preventDefault();
                const input = doc.querySelector<HTMLInputElement>('#sbrSearchBox');
                if (!input?.form) {
                    return;
                }
                const query = buildFluentSearch(Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, field.value])) as SearchFields);
                lastQuery = query;
                savedQuery = query;

                // Use the native setter so React's own input tracker detects the
                // input event. Let React update before submitting its search form.
                submitQuery(query);
            });
            const heading = next.querySelector('.sidebar--right__header');
            if (heading?.parentElement === next) {
                heading.after(form);
            } else {
                next.prepend(form);
            }
        },
        dispose,
    };
}
