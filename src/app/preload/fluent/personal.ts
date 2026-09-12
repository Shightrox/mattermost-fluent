// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {FluentViewSettings} from 'types/fluent';

type Space = {
    id: string;
    name: string;
    accent: string;
    opacity: number;
    compact: boolean;
    links: Array<{path: string; name: string}>;
};
type Saved = {active: string; spaces: Space[]};

// Non-sensitive presentation preferences in this server's local browser storage.
// No account preferences, channel categories or permissions are changed remotely.
export function createFluentPersonal(doc: Document, win: Window) {
    const root = doc.documentElement;
    let host: HTMLElement | null = null;
    let focusButton: HTMLButtonElement | null = null;
    let focus = false;
    let settings: FluentViewSettings | undefined;
    let storageKey = '';
    let saved: Saved = {active: '', spaces: []};
    const accents = ['blue', 'violet', 'green', 'teal', 'rose', 'amber', 'coral', 'indigo'];
    const ru = () => root.lang.startsWith('ru') || (/[А-Яа-я]/).test(doc.querySelector('#sidebarItem_threads')?.textContent ?? '');
    const text = (russian: string, english: string) => (ru() ? russian : english);
    const validPath = (path: string) => {
        try {
            const url = new URL(path, win.location.href);
            const base = new URL(settings!.serverURL).pathname.replace(/\/$/, '');
            return url.origin === win.location.origin && url.pathname.startsWith(`${base}/`) && url.pathname.includes('/channels/');
        } catch {
            return false;
        }
    };
    const persist = () => {
        try {
            win.localStorage.setItem(storageKey, JSON.stringify(saved));
        } catch {
            // Storage can be disabled;
            // Keep the current session usable.
        }
    };
    const apply = () => {
        const space = saved.spaces.find((item) => item.id === saved.active);
        root.toggleAttribute('data-fluent-focus', focus);
        root.toggleAttribute('data-fluent-density-compact', Boolean(space?.compact));
        root.setAttribute('data-mm-fluent-accent', space?.accent ?? settings?.accent ?? 'blue');
        root.style.setProperty('--fluent-chat-opacity', `${space?.opacity ?? settings?.chatOpacity ?? 75}%`);
        focusButton?.setAttribute('aria-pressed', String(focus));
        host?.querySelectorAll<HTMLAnchorElement>('nav a').forEach((link) => {
            if (new URL(link.href).pathname === win.location.pathname) {
                link.setAttribute('aria-current', 'page');
            } else {
                link.removeAttribute('aria-current');
            }
        });
        if (focusButton) {
            focusButton.title = text(focus ? 'Вернуть навигацию' : 'Сосредоточиться на чате', focus ? 'Restore navigation' : 'Focus on conversation');
            focusButton.setAttribute('aria-label', focusButton.title);
        }
    };
    const button = (label: string, icon: string, action: () => void) => {
        const control = doc.createElement('button');
        control.type = 'button';
        control.title = label;
        control.setAttribute('aria-label', label);
        const glyph = doc.createElement('i');
        glyph.className = `icon icon-${icon}`;
        glyph.setAttribute('aria-hidden', 'true');
        control.append(glyph);
        control.addEventListener('click', action);
        return control;
    };
    const render = () => {
        if (!host) {
            return;
        }
        host.replaceChildren();
        const row = doc.createElement('div');
        row.className = 'FluentPersonal__row';
        const select = doc.createElement('select');
        select.setAttribute('aria-label', text('Личная подборка', 'Personal collection'));
        const options = [{id: '', name: text('Все переписки', 'All conversations')}, ...saved.spaces];
        options.forEach((space) => {
            const option = doc.createElement('option');
            option.value = space.id;
            option.textContent = space.name;
            select.append(option);
        });
        select.value = saved.active;
        select.addEventListener('change', () => {
            saved.active = select.value;
            persist();
            render();
            apply();
            host?.querySelector('select')?.focus();
        });
        const details = doc.createElement('details');
        details.id = 'FluentPersonalSettings';
        const summary = doc.createElement('summary');
        summary.textContent = text('Настроить подборки', 'Manage collections');
        details.append(summary);
        const form = doc.createElement('form');
        const name = doc.createElement('input');
        name.placeholder = text('Название новой подборки', 'New collection name');
        name.setAttribute('aria-label', name.placeholder);
        name.maxLength = 40;
        name.required = true;
        const add = button(text('Создать подборку', 'Create collection'), 'plus', () => {});
        add.type = 'submit';
        form.append(name, add);
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            if (!name.value.trim() || saved.spaces.length >= 12) {
                return;
            }
            const space: Space = {id: win.crypto.randomUUID(), name: name.value.trim(), accent: settings?.accent ?? 'blue', opacity: settings?.chatOpacity ?? 75, compact: false, links: []};
            saved.spaces.push(space);
            saved.active = space.id;
            persist();
            render();
            apply();
            host?.querySelector('select')?.focus();
        });
        details.append(form);
        const manage = button(text('Настроить подборки', 'Manage collections'), 'tune', () => {
            details.open = !details.open;
            if (details.open) {
                name.focus();
            }
        });
        manage.setAttribute('aria-controls', details.id);
        manage.setAttribute('aria-expanded', 'false');
        details.addEventListener('toggle', () => manage.setAttribute('aria-expanded', String(details.open)));
        row.append(select, manage);
        host.append(row);
        const space = saved.spaces.find((item) => item.id === saved.active);
        if (space) {
            const pin = button(text('Закрепить текущий диалог', 'Pin current conversation'), 'pin-outline', () => {
                const path = win.location.pathname;
                if (!validPath(path) || space.links.some((link) => link.path === path) || space.links.length >= 40) {
                    return;
                }
                const label = (doc.querySelector('#channelHeaderTitle, #channel-header .heading') ?? doc.querySelector('#channel-header .channel-header__trigger'))?.textContent?.trim() || path.split('/').pop()!;
                space.links.push({path, name: label.slice(0, 120)});
                persist();
                render();
                host?.querySelector('select')?.focus();
            });
            row.append(pin);
            const links = doc.createElement('nav');
            links.setAttribute('aria-label', space.name);
            space.links.forEach((link) => {
                const item = doc.createElement('div');
                item.className = 'FluentPersonal__row';
                const anchor = doc.createElement('a');
                anchor.href = link.path;
                anchor.textContent = link.name;
                if (win.location.pathname === link.path) {
                    anchor.setAttribute('aria-current', 'page');
                }
                anchor.addEventListener('click', (event) => {
                    const native = Array.from(doc.querySelectorAll<HTMLAnchorElement>('.SidebarChannel .SidebarLink[href]')).find((node) => new URL(node.href).pathname === link.path);
                    if (native && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
                        event.preventDefault();
                        native.click();
                    }
                });
                item.append(anchor, button(text('Убрать из подборки', 'Unpin'), 'close', () => {
                    space.links = space.links.filter((entry) => entry !== link);
                    persist();
                    render();
                    host?.querySelector('select')?.focus();
                }));
                links.append(item);
            });
            if (!space.links.length) {
                const hint = doc.createElement('p');
                hint.textContent = text('Откройте диалог и закрепите его кнопкой справа.', 'Open a conversation and pin it with the button above.');
                links.append(hint);
            }
            host.append(links);
            const label = (caption: string, control: HTMLElement) => {
                const wrapper = doc.createElement('label');
                wrapper.append(doc.createTextNode(caption), control);
                details.append(wrapper);
            };
            const rename = doc.createElement('input');
            rename.value = space.name;
            rename.maxLength = 40;
            rename.addEventListener('change', () => {
                if (rename.value.trim()) {
                    space.name = rename.value.trim();
                    select.selectedOptions[0].textContent = space.name;
                    links.setAttribute('aria-label', space.name);
                    persist();
                } else {
                    rename.value = space.name;
                }
            });
            label(text('Название подборки', 'Collection name'), rename);
            const accent = doc.createElement('select');
            accents.forEach((value, index) => {
                const option = doc.createElement('option');
                option.value = value;
                option.textContent = (ru() ? ['Небо', 'Ирис', 'Шалфей', 'Бирюза', 'Роза', 'Янтарь', 'Коралл', 'Индиго'] : ['Sky', 'Iris', 'Sage', 'Teal', 'Rose', 'Amber', 'Coral', 'Indigo'])[index];
                accent.append(option);
            });
            accent.value = space.accent;
            accent.addEventListener('change', () => {
                space.accent = accent.value;
                persist();
                apply();
            });
            label(text('Акцент', 'Accent'), accent);
            const opacity = doc.createElement('input');
            opacity.type = 'range';
            opacity.min = '30';
            opacity.max = '100';
            opacity.value = String(space.opacity);
            opacity.addEventListener('input', () => {
                space.opacity = Number(opacity.value);
                apply();
            });
            opacity.addEventListener('change', persist);
            label(text('Плотность фона чата', 'Chat background density'), opacity);
            const compact = doc.createElement('input');
            compact.type = 'checkbox';
            compact.checked = space.compact;
            compact.addEventListener('change', () => {
                space.compact = compact.checked;
                persist();
                apply();
            });
            label(text('Компактная навигация', 'Compact navigation'), compact);
            const remove = button(text('Удалить подборку', 'Delete collection'), 'delete-outline', () => {
                saved.spaces = saved.spaces.filter((entry) => entry !== space);
                saved.active = '';
                persist();
                render();
                apply();
                host?.querySelector('select')?.focus();
            });
            details.append(remove);
        }
        const local = doc.createElement('p');
        local.textContent = text('Подборки и их оформление сохраняются только на этом устройстве.', 'Collections and their appearance are saved only on this device.');
        details.append(local);
        host.append(details);
    };
    const dispose = () => {
        host?.remove();
        host = null;
        focusButton?.remove();
        focusButton = null;
        root.removeAttribute('data-fluent-focus');
        root.removeAttribute('data-fluent-density-compact');
    };
    return {
        update(next: FluentViewSettings, enabled: boolean) {
            settings = next;
            if (!enabled) {
                dispose();
                return;
            }
            const key = `fluent.personal.v1:${next.serverURL}`;
            if (key !== storageKey) {
                storageKey = key;
                saved = {active: '', spaces: []};
                try {
                    const data = JSON.parse(win.localStorage.getItem(key) ?? '{}') as Saved;
                    if (Array.isArray(data.spaces)) {
                        saved.spaces = data.spaces.filter((space) => typeof space.id === 'string' && typeof space.name === 'string' && space.name.length <= 40 && accents.includes(space.accent) && Number.isFinite(space.opacity) && space.opacity >= 30 && space.opacity <= 100 && typeof space.compact === 'boolean' && Array.isArray(space.links)).slice(0, 12).map((space) => ({...space, links: space.links.filter((link) => typeof link.path === 'string' && validPath(link.path) && typeof link.name === 'string').slice(0, 40)}));
                        saved.active = saved.spaces.some((space) => space.id === data.active) ? data.active : '';
                    }
                } catch {
                    // Malformed or unavailable local storage never blocks login.
                }
            }
            const sidebar = doc.querySelector('#SidebarContainer');
            if (sidebar && !host?.isConnected) {
                host = doc.createElement('section');
                host.className = 'FluentPersonal';
                const navigation = sidebar.querySelector('.FluentNavigation');
                if (navigation?.parentElement === sidebar) {
                    navigation.after(host);
                } else {
                    sidebar.append(host);
                }
                render();
            }
            const header = doc.querySelector('#channel-header > .flex-parent');
            if (header && !focusButton?.isConnected) {
                focusButton = button(text('Сосредоточиться на чате', 'Focus on conversation'), 'fluent-focus', () => {
                    focus = !focus;
                    apply();
                });
                focusButton.className = 'FluentFocus';
                header.append(focusButton);
            }
            apply();
        },
        dispose,
    };
}
